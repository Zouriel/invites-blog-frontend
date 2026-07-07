import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG } from 'ui';

/** `ui-chip-input` — tokenized text entry (CVA; value is string[]). Enter adds, Backspace removes. */
@Component({
  selector: 'ui-chip-input',
  template: `
    <div class="ci" [class.no-radius]="!radius()" (click)="focusInput()">
      @for (chip of chips(); track $index) {
        <span class="chip">{{ chip }}<button type="button" class="x" tabindex="-1" aria-label="Remove" (click)="removeAt($index, $event)">×</button></span>
      }
      <input #inp class="entry" [attr.placeholder]="chips().length ? '' : placeholder()"
             [disabled]="disabled()" (keydown)="onKey($event)" (blur)="onTouched()" />
    </div>
  `,
  styles: `
    :host { display: block; }
    .ci { display: flex; flex-wrap: wrap; gap: var(--ui-space-1); align-items: center; min-height: var(--ui-size-md);
      padding: 3px var(--ui-space-2); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); cursor: text;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .ci:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .ci.no-radius { border-radius: 0; }
    .chip { display: inline-flex; align-items: center; gap: 2px; height: 22px; padding: 0 var(--ui-space-2);
      background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); border: 1px solid var(--ui-color-primary);
      border-radius: 999px; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); }
    .x { border: none; background: none; color: inherit; cursor: pointer; font-size: 13px; line-height: 1; padding: 0; }
    .entry { flex: 1; min-width: 80px; border: none; background: transparent; outline: none; color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); height: 22px; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiChipInput), multi: true }],
})
export class UiChipInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  placeholder = input('Add tag…');
  radius = input<boolean>(this.config.radius);

  protected readonly chips = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (v: string[]) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string[]): void { this.chips.set(v ?? []); }
  registerOnChange(fn: (v: string[]) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onKey(e: KeyboardEvent): void {
    const input = e.target as HTMLInputElement;
    if ((e.key === 'Enter' || e.key === ',') && input.value.trim()) {
      e.preventDefault();
      this.chips.update((c) => [...c, input.value.trim()]);
      input.value = '';
      this.onChange(this.chips());
    } else if (e.key === 'Backspace' && !input.value && this.chips().length) {
      this.chips.update((c) => c.slice(0, -1));
      this.onChange(this.chips());
    }
  }
  protected removeAt(i: number, e: Event): void {
    e.stopPropagation();
    this.chips.update((c) => c.filter((_, idx) => idx !== i));
    this.onChange(this.chips());
  }
  protected focusInput(): void {}
}
