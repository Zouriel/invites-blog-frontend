import { Component, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { UI_CONFIG, type UiSize } from 'ui';

/** `ui-search-input` — search field with icon and clear button (CVA). */
@Component({
  selector: 'ui-search-input',
  template: `
    <div class="wrap" [class.no-radius]="!radius()" [attr.data-size]="size()">
      <span class="icon" aria-hidden="true">🔍</span>
      <input
        class="ui-search"
        type="search"
        role="searchbox"
        [attr.placeholder]="placeholder()"
        [value]="value()"
        [disabled]="disabled()"
        (input)="handleInput($event)"
        (blur)="onTouched()" />
      @if (value()) {
        <button type="button" class="clear" tabindex="-1" aria-label="Clear search" (click)="clear()">×</button>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .wrap { display: flex; align-items: center; gap: var(--ui-space-2); padding: 0 var(--ui-space-3);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); background: var(--ui-color-surface);
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .wrap:focus-within { border-color: var(--ui-color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--ui-color-primary) 30%, transparent); }
    .wrap.no-radius { border-radius: 0; }
    .icon { font-size: 12px; opacity: 0.7; }
    .ui-search { flex: 1; min-width: 0; height: var(--ui-size-md); border: none; background: transparent;
      color: var(--ui-color-text); font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); outline: none; }
    .ui-search::-webkit-search-cancel-button { display: none; }
    .wrap[data-size="sm"] .ui-search { height: var(--ui-size-sm); font-size: var(--ui-font-size-sm); }
    .wrap[data-size="lg"] .ui-search { height: var(--ui-size-lg); font-size: var(--ui-font-size-lg); }
    .clear { border: none; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font-size: 16px; line-height: 1; }
    .clear:hover { color: var(--ui-color-text); }
  `,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => UiSearchInput), multi: true }],
})
export class UiSearchInput implements ControlValueAccessor {
  private config = inject(UI_CONFIG);
  placeholder = input('Search…');
  size = input<UiSize>('md');
  radius = input<boolean>(this.config.radius);

  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  private onChange: (v: string) => void = () => {};
  protected onTouched: () => void = () => {};

  writeValue(v: string): void { this.value.set(v ?? ''); }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected handleInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v);
  }
  protected clear(): void {
    this.value.set('');
    this.onChange('');
  }
}
