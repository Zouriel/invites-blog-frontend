import { Component, ElementRef, forwardRef, inject, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** `ui-editable-text` — click-to-edit inline text (CVA). Enter commits, Escape cancels. */
@Component({
  selector: 'ui-editable-text',
  template: `
    @if (editing()) {
      <input #inp class="edit" [value]="draft()" [disabled]="disabled()"
             (input)="draft.set($any($event.target).value)"
             (keydown.enter)="commit()" (keydown.escape)="cancel()" (blur)="commit()" />
    } @else {
      <button type="button" class="view" [disabled]="disabled()" (click)="edit()">
        <span [class.placeholder]="!value()">{{ value() || placeholder() }}</span>
        <span class="pencil" aria-hidden="true">✎</span>
      </button>
    }
  `,
  styles: `
    :host { display: inline-block; }
    .view { display: inline-flex; align-items: center; gap: var(--ui-space-2); background: none; border: 1px solid transparent;
      border-radius: var(--ui-radius); padding: 2px var(--ui-space-2); cursor: text; color: var(--ui-color-text);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); }
    .view:hover { border-color: var(--ui-color-border); }
    .view:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .placeholder { color: var(--ui-color-text-muted); }
    .pencil { opacity: 0; font-size: 12px; color: var(--ui-color-text-muted); }
    .view:hover .pencil { opacity: 1; }
    .edit { padding: 2px var(--ui-space-2); background: var(--ui-color-surface); border: 1px solid var(--ui-color-primary);
      border-radius: var(--ui-radius); color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
      outline: none; box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiEditableText), multi: true }],
})
export class UiEditableText implements ControlValueAccessor {
  placeholder = input('Empty');
  private inp = viewChild<ElementRef<HTMLInputElement>>('inp');

  protected readonly value = signal('');
  protected readonly draft = signal('');
  protected readonly editing = signal(false);
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected edit(): void {
    if (this.disabled()) return;
    this.draft.set(this.value());
    this.editing.set(true);
    queueMicrotask(() => { const el = this.inp()?.nativeElement; el?.focus(); el?.select(); });
  }
  protected commit(): void {
    if (!this.editing()) return;
    this.value.set(this.draft());
    this.editing.set(false);
    this.onChange(this.value());
    this.onTouched();
  }
  protected cancel(): void { this.editing.set(false); }
}
