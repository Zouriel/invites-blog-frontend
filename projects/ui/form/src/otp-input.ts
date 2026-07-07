import { Component, ElementRef, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-otp-input` — fixed-length one-time-code entry (CVA; value is the joined string). */
@Component({
  selector: 'ui-otp-input',
  template: `
    <div class="ui-otp" role="group" aria-label="One-time code">
      @for (i of slots(); track i) {
        <input
          class="cell"
          [attr.inputmode]="numeric() ? 'numeric' : 'text'"
          maxlength="1"
          [value]="chars()[i] || ''"
          [disabled]="disabled()"
          [attr.aria-label]="'Digit ' + (i + 1)"
          (input)="onInput($event, i)"
          (keydown)="onKeydown($event, i)"
          (paste)="onPaste($event, i)"
          (focus)="select($event)"
          (blur)="onTouched()" />
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-otp { display: inline-flex; gap: var(--ui-space-2); }
    .cell {
      width: var(--ui-size-md); height: var(--ui-size-lg); text-align: center;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background: var(--ui-color-surface); color: var(--ui-color-text);
      font-family: var(--ui-font-mono); font-size: var(--ui-font-size-lg); outline: none;
      transition: border-color var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .cell:focus { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .cell:disabled { opacity: 0.55; }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiOtpInput), multi: true }],
})
export class UiOtpInput implements ControlValueAccessor {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  length = input(6);
  numeric = input(true);

  protected readonly chars = signal<string[]>([]);
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  protected slots(): number[] {
    return Array.from({ length: this.length() }, (_, i) => i);
  }

  writeValue(v: string): void { this.chars.set((v ?? '').slice(0, this.length()).split('')); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected onInput(e: Event, index: number): void {
    const input = e.target as HTMLInputElement;
    let ch = input.value.slice(-1);
    if (this.numeric() && ch && !/[0-9]/.test(ch)) { input.value = this.chars()[index] || ''; return; }
    const next = [...this.chars()];
    next[index] = ch;
    this.chars.set(next);
    this.emit();
    if (ch) this.focusCell(index + 1);
  }

  protected onKeydown(e: KeyboardEvent, index: number): void {
    if (e.key === 'Backspace' && !this.chars()[index]) { this.focusCell(index - 1); }
    else if (e.key === 'ArrowLeft') this.focusCell(index - 1);
    else if (e.key === 'ArrowRight') this.focusCell(index + 1);
  }

  // Distribute a pasted code across the cells (the common "paste the whole code" case).
  protected onPaste(e: ClipboardEvent, index: number): void {
    e.preventDefault();
    const raw = e.clipboardData?.getData('text') ?? '';
    const value = this.numeric() ? raw.replace(/\D/g, '') : raw.replace(/\s/g, '');
    if (!value) return;

    const len = this.length();
    const next = Array.from({ length: len }, (_, i) => this.chars()[i] ?? '');
    for (let i = 0; i < value.length && index + i < len; i++) {
      next[index + i] = value[i];
    }
    this.chars.set(next);
    this.emit();
    this.focusCell(Math.min(index + value.length, len - 1));
  }

  protected select(e: Event): void { (e.target as HTMLInputElement).select(); }

  private emit(): void {
    this.onChange(this.chars().join(''));
  }
  private focusCell(i: number): void {
    const cells = this.host.nativeElement.querySelectorAll<HTMLInputElement>('.cell');
    cells[i]?.focus();
  }
}
