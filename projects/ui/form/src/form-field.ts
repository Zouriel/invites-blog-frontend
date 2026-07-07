import { Component, input } from '@angular/core';

/**
 * `ui-form-field` — label + hint + error wrapper for any control. The projected
 * control is wrapped by a `<label>`, giving implicit accessible-name
 * association without manual id wiring.
 */
@Component({
  selector: 'ui-form-field',
  template: `
    <div class="ui-field" [class.invalid]="!!error()">
      <label class="field-label">
        @if (label()) {
          <span class="lbl">
            {{ label() }}
            @if (required()) { <span class="req" aria-hidden="true">*</span> }
          </span>
        }
        <ng-content />
      </label>
      @if (hint() && !error()) { <span class="hint">{{ hint() }}</span> }
      @if (error()) { <span class="error" role="alert">{{ error() }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-field { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .field-label { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .lbl { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); font-weight: 600; color: var(--ui-color-text); }
    .req { color: var(--ui-color-danger); margin-left: 2px; }
    .hint { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .error { font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); color: var(--ui-color-danger); }
  `,
})
export class UiFormField {
  label = input<string>();
  hint = input<string>();
  error = input<string>();
  required = input(false);
}
