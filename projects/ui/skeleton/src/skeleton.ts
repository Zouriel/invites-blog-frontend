import { Component, input } from '@angular/core';

/** `ui-skeleton` — content placeholder shown while data loads. */
@Component({
  selector: 'ui-skeleton',
  template: ``,
  host: {
    class: 'ui-skeleton',
    'aria-hidden': 'true',
    '[class.circle]': "shape() === 'circle'",
    '[class.text]': "shape() === 'text'",
    '[style.width]': 'width()',
    '[style.height]': 'height()',
  },
  styles: `
    :host {
      display: block;
      background: linear-gradient(
        90deg,
        var(--ui-color-surface) 25%,
        var(--ui-color-surface-raised) 37%,
        var(--ui-color-surface) 63%
      );
      background-size: 400% 100%;
      border-radius: var(--ui-radius);
      animation: ui-skeleton-shimmer 1.4s ease infinite;
    }
    :host(.circle) { border-radius: 50%; }
    :host(.text) { height: 0.85em; border-radius: 4px; }
    @keyframes ui-skeleton-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
    @media (prefers-reduced-motion: reduce) { :host { animation: none; } }
  `,
})
export class UiSkeleton {
  shape = input<'rect' | 'circle' | 'text'>('rect');
  width = input<string>();
  height = input<string>();
}
