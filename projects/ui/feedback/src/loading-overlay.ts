import { Component, input } from '@angular/core';

/**
 * `ui-loading-overlay` — covers its positioned parent with a dimmed, blurred
 * veil + spinner while `loading` is true. Place inside a `position: relative`
 * container.
 */
@Component({
  selector: 'ui-loading-overlay',
  template: `
    @if (loading()) {
      <div class="veil" role="status" [attr.aria-label]="label()" animate.enter="ui-fade-enter" animate.leave="ui-fade-leave">
        <span class="spin" aria-hidden="true"></span>
        @if (label()) { <span class="lbl">{{ label() }}</span> }
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; display: contents; }
    .veil {
      position: absolute; inset: 0; z-index: 2;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--ui-space-2);
      background: color-mix(in srgb, var(--ui-color-bg) 55%, transparent);
      backdrop-filter: blur(2px);
      font-family: var(--ui-font-default);
    }
    .spin { width: 26px; height: 26px; border-radius: 50%; border: 3px solid var(--ui-color-border); border-top-color: var(--ui-color-primary); animation: ui-lo-spin var(--ui-motion-slow) linear infinite; }
    .lbl { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    @keyframes ui-lo-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 1.2s; } }
  `,
})
export class UiLoadingOverlay {
  loading = input(false);
  label = input('Loading…');
}
