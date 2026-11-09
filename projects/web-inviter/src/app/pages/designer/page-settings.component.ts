import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ICONS } from './designer-icons';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import { UiChipInput, UiColorPicker, UiInput, UiNumberInput, UiSelect, UiSwitch, type UiSelectOption } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import type { DesignScene } from './model/scene';
import { isFontKey, usedAssetIds } from './model/scene-ops';
import { screenContents, screenCount } from './model/screens';

/**
 * The page itself: its theme, the fonts and roles it offers, and any fields the
 * author invented. What's here is exactly what the inviter will be asked to fill in or allowed to change.
 */
@Component({
  selector: 'app-page-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, 
    FormsModule, UiButton, UiIconButton, UiChipInput, UiColorPicker, UiInput, UiSelect, UiSwitch, UiPanelSection, UiSegmented, UiNumberInput,
  ],
  template: `
    <header class="head">
      <span class="kind">Page</span>
      <p class="hint">Select something on the canvas to edit it. These settings are for the whole template.</p>
    </header>

    @if (store.scene(); as scene) {
      @if (files().count) {
        <ui-panel-section title="Files" [badge]="files().count" [open]="files().unused > 0">
          <p class="hint">The published page is {{ kb(store.preview()?.bytes ?? 0) }}: only files something shows go in it.</p>
          @if (files().unused) {
            <p class="hint">Not used any more: {{ files().unused }} {{ files().unused === 1 ? 'file' : 'files' }}, {{ kb(files().unusedBytes) }}, left from art that was deleted or replaced. They aren't saved or published; they're kept only until you leave, so Undo can still bring that art back.</p>
            <ui-button size="sm" variant="outline" (click)="store.removeUnusedAssets()">Remove unused files</ui-button>
          } @else {
            <p class="hint">Every file is in use.</p>
          }
        </ui-panel-section>
      }
      <ui-panel-section title="Screens" [badge]="screens()">
        <p class="hint">A screen is one phone-screen of scrolling. Copy one to make another page like it, or clear one to start it again. Things that run across several screens stay as they are.</p>
        <div class="screen-row pair">
          <span class="word">Copy</span>
          <ui-select size="sm" label="Copy screen" [options]="screenOptions()" [ngModel]="'' + copyFrom()" (ngModelChange)="copyFrom.set(+$event)" />
          <span class="word">to</span>
          <ui-select size="sm" label="Onto screen" [options]="targetOptions()" [ngModel]="'' + copyTo()" (ngModelChange)="copyTo.set(+$event)" />
        </div>
        <label class="switch"><ui-switch [ngModel]="copyStill()" (ngModelChange)="copyStill.set($event)" /> Without motion</label>
        <ui-button size="sm" variant="outline" [disabled]="copyFrom() === copyTo() || !onScreen(copyFrom())" (click)="store.copyScreen(copyFrom(), copyTo(), copyStill())">Copy {{ onScreen(copyFrom()) }} {{ onScreen(copyFrom()) === 1 ? 'thing' : 'things' }}</ui-button>
        <div class="screen-row">
          <ui-select size="sm" label="Clear screen" [options]="screenOptions()" [ngModel]="'' + clearN()" (ngModelChange)="clearN.set(+$event)" />
          <ui-button size="sm" variant="outline" [disabled]="!onScreen(clearN())" (click)="store.clearScreen(clearN())">Clear {{ onScreen(clearN()) }}</ui-button>
        </div>
      </ui-panel-section>
      <ui-panel-section title="Scrolling">
        <ui-segmented size="sm" label="When the guest scrolls" [options]="scrollModes" [value]="scene.stage ? 'stage' : 'page'" (valueChange)="store.setStage($event === 'stage')" />
        <p class="hint">
          @if (scene.stage) {
            Everything stays where you put it on the screen, however far the guest scrolls. Only motion moves things, and something with a bar on the timeline shows only during its bar. Turn on “Scrolls up with the page” for anything that should scroll away.
          } @else {
            The page scrolls like a web page: everything goes up with it unless it's pinned.
          }
        </p>
        <div class="length-row">
          <ui-number-input size="sm" label="Scrolls for" suffix="screens" [steppers]="true" [min]="0" [max]="100" [step]="0.5" [precision]="1"
            [ngModel]="round1(store.pageRange() / 844)" (ngModelChange)="store.setPageLength($event === null ? null : $event * 844)" ariaLabel="How far the page scrolls, in screens" />
          @if (scene.length) {
            <ui-button size="sm" variant="ghost" (click)="store.setPageLength(null)">Fit to what's on it</ui-button>
          }
        </div>
        <p class="hint">Or drag the End on the timeline. It can't end before the last bar does.</p>
      </ui-panel-section>
      @if (scene.kind !== 'saveTheDate') {
        <ui-panel-section title="Replies">
          <ui-segmented size="sm" label="Replies" [options]="replyModes" [value]="scene.noReplies ? 'none' : 'rsvp'" (valueChange)="setReplies($event)" />
          <p class="hint">
            @if (scene.noReplies) { This design doesn't take replies, so it needs no RSVP button and Check won't ask for one. }
            @else { Guests reply with this design's RSVP button. Choose “No replies” for a thank-you card, an announcement or anything else that doesn't ask. }
          </p>
        </ui-panel-section>
      }
      <ui-panel-section title="Theme colours">
        <p class="hint">Whoever uses the template can change these. Elements that use them follow along.</p>
        @for (t of colors(); track t.key) {
          <div class="theme">
            <ui-input size="sm" [ngModel]="t.label" (ngModelChange)="updateTheme(t.key, { label: $event }, 'label')" [attr.aria-label]="t.key + ' label'" />
            <ui-color-picker [ngModel]="t.value" (ngModelChange)="updateTheme(t.key, { value: $event }, 'value')" [swatches]="[]" />
            <ui-icon-button size="sm" label="Remove colour" [disabled]="required(t.key)" (click)="removeTheme(t.key)"><hugeicons-icon [icon]="icons.remove" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
          </div>
        }
        <ui-button size="sm" variant="outline" (click)="addColor()"><hugeicons-icon [icon]="icons.zoomIn" [size]="16" [strokeWidth]="1.8" /> Add a colour</ui-button>
      </ui-panel-section>

      <ui-panel-section title="Theme fonts">
        @for (t of fonts(); track t.key) {
          <div class="theme">
            <ui-input size="sm" [ngModel]="t.label" (ngModelChange)="updateTheme(t.key, { label: $event }, 'label')" [attr.aria-label]="t.key + ' label'" />
            <ui-select size="sm" [options]="fontOptions()" [fontPreview]="true" [ngModel]="t.value" (ngModelChange)="updateTheme(t.key, { value: $event })" label="Font" />
            <ui-icon-button size="sm" label="Remove font" (click)="removeTheme(t.key)"><hugeicons-icon [icon]="icons.remove" [size]="16" [strokeWidth]="1.8" /></ui-icon-button>
          </div>
        }
        <ui-button size="sm" variant="outline" (click)="addFont()"><hugeicons-icon [icon]="icons.zoomIn" [size]="16" [strokeWidth]="1.8" /> Add a font</ui-button>
        <div class="stack">
          <span class="label">Fonts the inviter can pick from</span>
          <div class="font-chips">
            @for (f of catalogFonts(); track f.id) {
              <button type="button" class="font-chip" [class.on]="scene.fonts.includes(f.id)" [attr.aria-pressed]="scene.fonts.includes(f.id)"
                [style.font-family]="f.stack" (click)="toggleOffered(f.id)">{{ f.name }}</button>
            }
          </div>
        </div>
      </ui-panel-section>

      <ui-panel-section title="Roles" [open]="scene.roles.length > 0">
        <p class="hint">Groups of guests — "Bride's side", "VIP". Elements can be filled in per role.</p>
        <ui-chip-input [ngModel]="scene.roles" (ngModelChange)="setRoles($event)" placeholder="Add a role and press Enter" label="Roles" />
      </ui-panel-section>

      <p class="hint">Your own fields (a gift note, a meal choice) are under Fields, on the left.</p>
    }
  `,
  styles: `
    .length-row { display: flex; gap: 8px; align-items: end; margin-top: 8px; }
    :host { display: block; font-size: 13px; }
    .head { padding: 12px; border-bottom: 1px solid var(--ui-color-border); display: grid; gap: 4px; }
    .kind { font: 600 11px var(--ui-font-default); letter-spacing: .06em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .hint { margin: 0; font-size: 11.5px; line-height: 1.45; color: var(--ui-color-text-muted); }
    .theme { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 6px; align-items: center; }
    .stack { display: grid; gap: 6px; margin-top: 4px; }
    .label { font-size: 12px; color: var(--ui-color-text-muted); }
    .font-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .font-chip { padding: 3px 9px; border-radius: var(--ui-radius-pill); border: 1px solid var(--ui-color-border); background: var(--ui-color-surface);
      color: var(--ui-color-text-muted); font-size: 14px; cursor: pointer; }
    .font-chip.on { border-color: var(--ui-color-primary); color: var(--ui-color-text); background: var(--ui-color-selected); }
    .font-chip:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .field { display: grid; gap: 6px; padding: 8px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-sm); }
    .grid2 { display: grid; grid-template-columns: minmax(0, 1fr) 110px; gap: 6px; }
    .path { font-size: 11px; color: var(--ui-color-text-muted); }
    .add-field { display: grid; grid-template-columns: 1fr auto; gap: 6px; }
    .screen-row { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; margin: 6px 0; }
    .screen-row.pair { grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr); }
    .word { font-size: 12px; color: var(--ui-color-text-muted); }
    .switch { display: flex; align-items: center; gap: 8px; font-size: 12px; margin: 4px 0 8px; }
  `,
})
export class PageSettingsComponent {
  protected readonly round1 = (v: number) => Math.round(v * 10) / 10;
  protected readonly replyModes = [{ value: 'rsvp', label: 'RSVP button' }, { value: 'none', label: 'No replies' }];

  protected setReplies(value: string | null): void {
    if (!value) return;
    this.store.mutate((s) => {
      const { noReplies: _old, ...rest } = s;
      return value === 'none' ? { ...rest, noReplies: true } : rest;
    });
  }

  protected readonly scrollModes = [{ value: 'stage', label: 'Things stay on screen' }, { value: 'page', label: 'The page scrolls' }];
  protected readonly icons = ICONS;
  protected readonly store = inject(DesignStore);
  private readonly snackbar = inject(UiSnackbarService);


  /** The design's files: how many, and how many (and how much) nothing shows. */
  protected readonly files = computed(() => {
    const scene = this.store.scene();
    if (!scene) return { count: 0, unused: 0, unusedBytes: 0 };
    const used = usedAssetIds(scene);
    const unused = Object.entries(scene.assets).filter(([id]) => !used.has(id));
    return { count: Object.keys(scene.assets).length, unused: unused.length, unusedBytes: unused.reduce((t, [, a]) => t + a.data.length + (a.mask?.length ?? 0), 0) };
  });
  /** Screens: how many, and the pickers for copying and clearing one. */
  protected readonly screens = computed(() => (this.store.scene() ? screenCount(this.store.scene()!) : 1));
  protected readonly screenOptions = computed<UiSelectOption[]>(() => Array.from({ length: this.screens() }, (_, k) => ({ value: String(k + 1), label: `Screen ${k + 1}` })));
  protected readonly targetOptions = computed<UiSelectOption[]>(() => [...this.screenOptions(), { value: String(this.screens() + 1), label: `Screen ${this.screens() + 1} (new)` }]);
  protected readonly copyFrom = signal(1);
  protected readonly copyTo = signal(2);
  protected readonly copyStill = signal(false);
  protected readonly clearN = signal(1);
  /** How many things are only on a screen (what Copy and Clear act on). */
  protected onScreen(n: number): number {
    const scene = this.store.scene();
    return scene ? screenContents(scene, n).only.length : 0;
  }

  protected readonly kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  protected readonly colors = computed(() => (this.store.scene()?.theme ?? []).filter((t) => !isFontKey(t.key)));
  protected readonly fonts = computed(() => (this.store.scene()?.theme ?? []).filter((t) => isFontKey(t.key)));
  protected readonly catalogFonts = computed(() => this.store.catalog()?.fonts ?? []);
  protected readonly fontOptions = computed<UiSelectOption[]>(() => this.catalogFonts().map((f) => ({ value: f.id, label: f.name, fontFamily: f.stack })));

  protected required(key: string): boolean {
    return (this.store.catalog()?.requiredThemeKeys ?? ['accent', 'bg', 'text']).includes(key);
  }

  private edit(fn: (s: DesignScene) => DesignScene, key?: string): void {
    this.store.mutate(fn, key ? `page:${key}` : undefined);
  }

  protected updateTheme(key: string, patch: { label?: string; value?: string }, coalesce?: string): void {
    this.edit((s) => ({ ...s, theme: s.theme.map((t) => (t.key === key ? { ...t, ...patch } : t)) }), coalesce ? `theme:${key}:${coalesce}` : undefined);
  }

  protected addColor(): void {
    const scene = this.store.scene()!;
    let n = 1;
    while (scene.theme.some((t) => t.key === `colour-${n}`)) n++;
    this.edit((s) => ({ ...s, theme: [...s.theme, { key: `colour-${n}`, label: `Colour ${n}`, value: '#6a97c0' }] }));
  }

  protected addFont(): void {
    const scene = this.store.scene()!;
    let n = 1;
    while (scene.theme.some((t) => t.key === `font-${n}`)) n++;
    const font = this.catalogFonts()[0]?.id ?? 'inter';
    this.edit((s) => ({ ...s, theme: [...s.theme, { key: `font-${n}`, label: `Font ${n}`, value: font }] }));
  }

  protected removeTheme(key: string): void {
    const inUse = JSON.stringify(this.store.scene()?.elements ?? []).includes(`"theme:${key}"`);
    this.edit((s) => ({ ...s, theme: s.theme.filter((t) => t.key !== key) }));
    if (inUse) this.snackbar.show({ message: 'Some elements used that — they will fall back to defaults. Check will list them.', action: { label: 'Undo', run: () => this.store.undo() } });
  }

  protected toggleOffered(id: string): void {
    this.edit((s) => ({ ...s, fonts: s.fonts.includes(id) ? s.fonts.filter((f) => f !== id) : [...s.fonts, id] }));
  }

  protected setRoles(roles: string[]): void {
    this.edit((s) => ({ ...s, roles: [...new Set(roles.map((r) => r.trim()).filter(Boolean))] }));
  }



}
