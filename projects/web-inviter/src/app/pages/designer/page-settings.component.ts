import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiChipInput, UiColorPicker, UiInput, UiSelect, type UiSelectOption } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { UiToastService } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import type { CustomField, DesignScene } from './model/scene';
import { isFontKey } from './model/scene-ops';

/**
 * The page itself: its theme, the fonts and roles it offers, and any fields the
 * author invented. What's here is exactly what the inviter will be asked to fill in or allowed to change.
 */
@Component({
  selector: 'app-page-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiButton, UiIconButton, UiChipInput, UiColorPicker, UiInput, UiSelect, UiPanelSection,
  ],
  template: `
    <header class="head">
      <span class="kind">Page</span>
      <p class="hint">Select something on the canvas to edit it. These settings are for the whole template.</p>
    </header>

    @if (store.scene(); as scene) {
      <ui-panel-section title="Theme colours">
        <p class="hint">Whoever uses the template can change these. Elements that use them follow along.</p>
        @for (t of colors(); track t.key) {
          <div class="theme">
            <ui-input size="sm" [ngModel]="t.label" (ngModelChange)="updateTheme(t.key, { label: $event }, 'label')" [attr.aria-label]="t.key + ' label'" />
            <ui-color-picker [ngModel]="t.value" (ngModelChange)="updateTheme(t.key, { value: $event }, 'value')" [swatches]="[]" />
            <ui-icon-button size="sm" label="Remove colour" [disabled]="required(t.key)" (click)="removeTheme(t.key)">×</ui-icon-button>
          </div>
        }
        <ui-button size="sm" variant="outline" (click)="addColor()">+ Add a colour</ui-button>
      </ui-panel-section>

      <ui-panel-section title="Theme fonts">
        @for (t of fonts(); track t.key) {
          <div class="theme">
            <ui-input size="sm" [ngModel]="t.label" (ngModelChange)="updateTheme(t.key, { label: $event }, 'label')" [attr.aria-label]="t.key + ' label'" />
            <ui-select size="sm" [options]="fontOptions()" [ngModel]="t.value" (ngModelChange)="updateTheme(t.key, { value: $event })" label="Font" />
            <ui-icon-button size="sm" label="Remove font" (click)="removeTheme(t.key)">×</ui-icon-button>
          </div>
        }
        <ui-button size="sm" variant="outline" (click)="addFont()">+ Add a font</ui-button>
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
        <ui-chip-input [ngModel]="scene.roles" (ngModelChange)="setRoles($event)" placeholder="Add a role and press Enter" />
      </ui-panel-section>

      <ui-panel-section title="Custom fields" [badge]="scene.fields.length" [open]="scene.fields.length > 0">
        <p class="hint">Anything the inviter should fill in that isn't already a field — a gift note, a meal choice.</p>
        @for (f of scene.fields; track f.path; let i = $index) {
          <div class="field">
            <div class="grid2">
              <ui-input size="sm" [ngModel]="f.label" (ngModelChange)="updateField(i, { label: $event }, 'label')" placeholder="Label" />
              <ui-select size="sm" [options]="fieldTypes" [ngModel]="f.type" (ngModelChange)="updateField(i, { type: $event })" label="Type" />
            </div>
            <code class="path">{{ f.path }}</code>
            @if (f.type === 'select') {
              <ui-chip-input [ngModel]="f.options ?? []" (ngModelChange)="updateField(i, { options: $event })" placeholder="Add a choice" />
            }
            <ui-input size="sm" [ngModel]="f.sample ?? ''" (ngModelChange)="updateField(i, { sample: $event || null }, 'sample')" placeholder="Example shown while designing" />
            @if (scene.roles.length) {
              <ui-select size="sm" [options]="roleOptions()" [ngModel]="f.roleScope ?? ''" (ngModelChange)="updateField(i, { roleScope: $event || null })" label="Filled in by" />
            }
            <ui-button size="sm" variant="ghost" (click)="removeField(i)">Remove field</ui-button>
          </div>
        }
        <div class="add-field">
          <ui-input size="sm" [(ngModel)]="newFieldLabel" placeholder="New field, e.g. Gift note" (keydown.enter)="addField()" />
          <ui-button size="sm" variant="outline" [disabled]="!newFieldLabel.trim()" (click)="addField()">Add</ui-button>
        </div>
      </ui-panel-section>
    }
  `,
  styles: `
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
  `,
})
export class PageSettingsComponent {
  protected readonly store = inject(DesignStore);
  private readonly toast = inject(UiToastService);

  protected newFieldLabel = '';

  protected readonly colors = computed(() => (this.store.scene()?.theme ?? []).filter((t) => !isFontKey(t.key)));
  protected readonly fonts = computed(() => (this.store.scene()?.theme ?? []).filter((t) => isFontKey(t.key)));
  protected readonly catalogFonts = computed(() => this.store.catalog()?.fonts ?? []);
  protected readonly fontOptions = computed<UiSelectOption[]>(() => this.catalogFonts().map((f) => ({ value: f.id, label: f.name })));
  protected readonly roleOptions = computed<UiSelectOption[]>(() => [
    { value: '', label: 'Shared by every role' }, ...(this.store.scene()?.roles ?? []).map((r) => ({ value: r, label: r })),
  ]);
  protected readonly fieldTypes: UiSelectOption[] = [
    { value: 'text', label: 'Short text' }, { value: 'textarea', label: 'Long text' }, { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' }, { value: 'url', label: 'Link' }, { value: 'color', label: 'Colour' }, { value: 'select', label: 'Choice' },
  ];

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
    if (inUse) this.toast.show({ message: 'Some elements used that — they will fall back to defaults. Check will list them.', tone: 'warning', action: { label: 'Undo', run: () => this.store.undo() } });
  }

  protected toggleOffered(id: string): void {
    this.edit((s) => ({ ...s, fonts: s.fonts.includes(id) ? s.fonts.filter((f) => f !== id) : [...s.fonts, id] }));
  }

  protected setRoles(roles: string[]): void {
    this.edit((s) => ({ ...s, roles: [...new Set(roles.map((r) => r.trim()).filter(Boolean))] }));
  }

  protected updateField(index: number, patch: Partial<CustomField>, coalesce?: string): void {
    this.edit((s) => ({ ...s, fields: s.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)) }), coalesce ? `field:${index}:${coalesce}` : undefined);
  }

  protected addField(): void {
    const label = this.newFieldLabel.trim();
    if (!label) return;
    const words = label.replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/);
    let key = words.map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).join('') || 'field';
    if (!/^[a-z]/.test(key)) key = 'field' + key;
    const scene = this.store.scene()!;
    let path = `event.${key}`;
    for (let n = 2; scene.fields.some((f) => f.path === path) || this.store.catalog()?.variables.some((v) => v.path === path); n++) path = `event.${key}${n}`;
    this.edit((s) => ({ ...s, fields: [...s.fields, { path, label, type: 'text', options: null, roleScope: null, sample: null }] }));
    this.newFieldLabel = '';
  }

  protected removeField(index: number): void {
    const path = this.store.scene()!.fields[index].path;
    const inUse = JSON.stringify(this.store.scene()!.elements).includes(`"${path}"`);
    this.edit((s) => ({ ...s, fields: s.fields.filter((_, i) => i !== index) }));
    if (inUse) this.toast.show({ message: 'Elements still use that field — Check will point them out.', tone: 'warning', action: { label: 'Undo', run: () => this.store.undo() } });
  }
}
