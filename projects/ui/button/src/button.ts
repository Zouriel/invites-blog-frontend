import { Component, inject, input } from '@angular/core';
import { UI_CONFIG, type UiSize } from 'ui';

export type UiButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive';

/**
 * `ui-button` — the action primitive. Wires `glass`/`radius` to the global
 * UiConfig defaults (overridable per instance) and uses only design tokens.
 */
@Component({
  selector: 'ui-button',
  template: `
    <button
      class="ui-btn"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.block]="block()"
      [attr.type]="type()"
      [attr.data-variant]="variant()"
      [attr.data-size]="size()"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() || null">
      @if (loading()) { <span class="spin" aria-hidden="true"></span> }
      <ng-content />
    </button>
  `,
  styles: `
    :host { display: inline-flex; }
    :host(.block-host), .ui-btn.block { width: 100%; }
    .ui-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: var(--ui-space-2);
      height: var(--ui-size-md);
      padding: 0 var(--ui-space-4);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface);
      color: var(--ui-color-text);
      font-family: var(--ui-font-default);
      font-size: 14px;
      font-weight: 500;
      letter-spacing: -0.01em;
      cursor: pointer;
      white-space: nowrap;
      transition: background var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard),
                  transform var(--ui-motion-fast) var(--ui-ease-standard),
                  opacity var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-btn:hover:not(:disabled) { background: var(--ui-color-surface-raised); }
    .ui-btn:active:not(:disabled) { transform: scale(0.98); }
    .ui-btn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .ui-btn.no-radius { border-radius: 0; }
    .ui-btn.glass {
      background: var(--ui-glass-bg);
      backdrop-filter: blur(var(--ui-glass-blur));
      border-color: var(--ui-glass-border);
    }
    .ui-btn[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; padding: 0 var(--ui-space-3); }
    .ui-btn[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; padding: 0 var(--ui-space-6); }
    .ui-btn[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ui-btn[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    .ui-btn[data-variant="secondary"] { background: var(--ui-color-secondary); color: #fff; border-color: transparent; }
    .ui-btn[data-variant="secondary"]:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-secondary) 85%, #fff); }
    .ui-btn[data-variant="outline"] { background: transparent; }
    .ui-btn[data-variant="destructive"] { background: var(--ui-color-danger); color: #fff; border-color: transparent; }
    .ui-btn[data-variant="destructive"]:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-danger) 88%, #fff); }
    .ui-btn[data-variant="ghost"] { background: transparent; border-color: transparent; }
    .ui-btn[data-variant="link"] { background: transparent; border-color: transparent; color: var(--ui-color-primary); text-decoration: underline; padding: 0; height: auto; }
    .ui-btn[data-variant="link"]:hover:not(:disabled) { background: transparent; color: var(--ui-color-primary-hover); }
    .spin {
      width: 1em; height: 1em; border-radius: 50%;
      border: 2px solid currentColor; border-right-color: transparent;
      animation: ui-btn-spin var(--ui-motion-slow) linear infinite;
    }
    @keyframes ui-btn-spin { to { transform: rotate(360deg); } }
  `,
  host: { '[class.block-host]': 'block()' },
})
export class UiButton {
  private config = inject(UI_CONFIG);
  variant = input<UiButtonVariant>('primary');
  size = input<UiSize>('md');
  type = input<'button' | 'submit' | 'reset'>('button');
  disabled = input(false);
  loading = input(false);
  block = input(false);
  /** Opt-in glass treatment. Buttons are solid by default (not driven by the
   *  global glass config, which targets surface components only). */
  glass = input(false);
  radius = input<boolean>(this.config.radius);
}
