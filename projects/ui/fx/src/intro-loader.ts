import { Component, OnInit, input, model, output, signal } from '@angular/core';

/**
 * `ui-intro-loader` — full-screen intro veil that wipes away after `duration`
 * (or when `[(open)]` is set false). Project a logo/wordmark as content.
 */
@Component({
  selector: 'ui-intro-loader',
  template: `
    @if (open()) {
      <div class="veil" [class.leaving]="leaving()">
        <div class="inner">
          <ng-content />
          <div class="track"><div class="fill"></div></div>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .veil { position: fixed; inset: 0; z-index: var(--ui-z-toast, 1200); display: flex; align-items: center; justify-content: center;
      background: var(--ui-color-bg); transition: opacity .6s cubic-bezier(.16,1,.3,1), transform .7s cubic-bezier(.16,1,.3,1); }
    .veil.leaving { opacity: 0; transform: translateY(-3%); pointer-events: none; }
    .inner { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-4);
      font-family: var(--ui-font-display); color: var(--ui-color-text); }
    .track { width: 160px; height: 2px; background: var(--ui-color-border); border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; width: 0; border-radius: inherit;
      background: var(--ui-gradient-brand, linear-gradient(90deg, var(--ui-color-primary), var(--ui-color-primary-hover)));
      box-shadow: var(--ui-glow-amber, none); animation: ui-intro-fill var(--ui-intro-dur, 1400ms) cubic-bezier(.16,1,.3,1) forwards; }
    @keyframes ui-intro-fill { from { width: 0; } to { width: 100%; } }
    @media (prefers-reduced-motion: reduce) { .veil { transition: none; } .fill { animation: none; width: 100%; } }
  `,
  host: { '[style.--ui-intro-dur]': 'duration() + "ms"' },
})
export class UiIntroLoader implements OnInit {
  open = model(true);
  duration = input(1400);
  done = output<void>();
  protected readonly leaving = signal(false);

  ngOnInit(): void {
    if (typeof window === 'undefined') return;
    setTimeout(() => this.leaving.set(true), this.duration());
    setTimeout(() => { this.open.set(false); this.done.emit(); }, this.duration() + 650);
  }
}
