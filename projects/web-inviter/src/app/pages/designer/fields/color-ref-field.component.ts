import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiColorPicker } from '@zouriel/ui/form';
import { UiPopover } from '@zouriel/ui/overlay';
import { UiButton } from '@zouriel/ui/button';
import { DesignStore } from '../design.store';
import { isFontKey } from '../model/scene-ops';

/**
 * Picks a colour reference: one of the theme's colours (preferred — the inviter can recolour those),
 * none, or a fixed colour. Choosing a fixed colour offers to turn it into a theme colour on the spot,
 * which is how a template stays themeable without anyone having to plan for it.
 */
@Component({
  selector: 'app-color-ref-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiColorPicker, UiPopover, UiButton],
  template: `
    <div class="field" role="group" [attr.aria-label]="label()">
      <span class="label">{{ label() }}</span>
      <div class="swatches">
        @if (allowNone()) {
          <button type="button" class="sw none" [class.on]="!value()" (click)="changed.emit(null)" title="None" aria-label="None"></button>
        }
        @for (c of themeColors(); track c.key) {
          <button type="button" class="sw" [class.on]="value() === 'theme:' + c.key" [style.background]="c.value"
            [title]="c.label" [attr.aria-label]="c.label" [attr.aria-pressed]="value() === 'theme:' + c.key"
            (click)="changed.emit('theme:' + c.key)"></button>
        }
        <ui-popover [(open)]="pickerOpen" placement="bottom-end">
          <button popover-trigger type="button" class="sw custom" [class.on]="isCustom()" [style.background]="isCustom() ? value() : null"
            title="Fixed colour" aria-label="Fixed colour" (click)="draft.set(isCustom() ? value()! : '#888888')">
            @if (!isCustom()) { <span aria-hidden="true">+</span> }
          </button>
          <div class="picker">
            <ui-color-picker [ngModel]="draft()" (ngModelChange)="draft.set($event)" [swatches]="[]" />
            <div class="actions">
              <ui-button size="sm" variant="outline" (click)="useFixed()">Use fixed colour</ui-button>
              <ui-button size="sm" variant="primary" (click)="makeTheme()">Add to theme</ui-button>
            </div>
            <p class="hint">A theme colour can be changed by whoever uses the template.</p>
          </div>
        </ui-popover>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .field { display: grid; grid-template-columns: 74px minmax(0, 1fr); align-items: center; gap: 8px; }
    .label { font-size: 12px; color: var(--ui-color-text-muted); }
    .swatches { display: flex; flex-wrap: wrap; gap: 5px; }
    .sw { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 1px solid var(--ui-color-border-strong); cursor: pointer;
      display: grid; place-items: center; box-sizing: border-box; color: var(--ui-color-text-muted); font-size: 14px; line-height: 1; }
    .sw.on { box-shadow: 0 0 0 2px var(--ui-color-surface), 0 0 0 4px var(--ui-color-primary); }
    .sw:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .sw.none { background: linear-gradient(135deg, transparent 45%, var(--ui-color-danger) 45% 55%, transparent 55%), var(--ui-color-surface); }
    .sw.custom { background: conic-gradient(from 90deg, #f87171, #fbbf24, #34d399, #60a5fa, #a78bfa, #f87171); }
    .sw.custom.on { background-image: none; }
    .picker { display: grid; gap: 10px; width: 250px; }
    .actions { display: flex; gap: 6px; justify-content: flex-end; }
    .hint { margin: 0; font-size: 11.5px; color: var(--ui-color-text-muted); }
  `,
})
export class ColorRefFieldComponent {
  private readonly store = inject(DesignStore);

  label = input('Colour');
  value = input<string | null | undefined>(null);
  allowNone = input(true);
  readonly changed = output<string | null>();

  protected readonly draft = signal('#888888');
  protected readonly pickerOpen = signal(false);
  protected readonly themeColors = computed(() => (this.store.scene()?.theme ?? []).filter((t) => !isFontKey(t.key)));
  protected readonly isCustom = computed(() => !!this.value() && !this.value()!.startsWith('theme:'));

  protected useFixed(): void {
    this.pickerOpen.set(false);
    this.changed.emit(this.draft());
  }

  protected makeTheme(): void {
    this.pickerOpen.set(false);
    const scene = this.store.scene();
    if (!scene) return;
    const hex = this.draft();
    const existing = scene.theme.find((t) => !isFontKey(t.key) && t.value.toLowerCase() === hex.toLowerCase());
    if (existing) {
      this.changed.emit('theme:' + existing.key);
      return;
    }
    let n = 1;
    while (scene.theme.some((t) => t.key === `colour-${n}`)) n++;
    const key = `colour-${n}`;
    this.store.mutate((s) => ({ ...s, theme: [...s.theme, { key, label: `Colour ${n}`, value: hex }] }));
    this.changed.emit('theme:' + key);
  }
}
