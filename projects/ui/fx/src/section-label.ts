import { Component, input } from '@angular/core';

/** `ui-section-label` — editorial mono section marker, e.g. `[ 00 · INDEX ]`. */
@Component({
  selector: 'ui-section-label',
  template: `
    <div class="sl">
      <span class="br">[</span>
      @if (index()) { <span class="idx">{{ index() }}</span><span class="dot">·</span> }
      <span class="label">{{ label() }}</span>
      <span class="br">]</span>
      <span class="rule"></span>
    </div>
  `,
  styles: `
    :host { display: block; }
    .sl { display: inline-flex; align-items: center; gap: 0.75rem;
      font-family: var(--ui-font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.4em;
      color: var(--ui-color-text-muted); }
    .br { color: color-mix(in srgb, var(--ui-color-danger) 80%, transparent); }
    .idx { color: var(--ui-color-text); }
    .dot { opacity: 0.4; }
    .label { color: var(--ui-color-text); }
    .rule { height: 1px; width: 3rem; background: linear-gradient(90deg, var(--ui-color-border), transparent); }
  `,
})
export class UiSectionLabel {
  index = input<string>('');
  label = input.required<string>();
}
