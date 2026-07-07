import { Component, OnDestroy, OnInit, effect, input, signal } from '@angular/core';

export interface UiCarouselSlide {
  image: string;
  alt?: string;
  caption?: string;
}

/** `ui-carousel` — image slideshow with arrows, dots, and optional autoplay. */
@Component({
  selector: 'ui-carousel',
  template: `
    <div class="cz" (pointerenter)="paused.set(true)" (pointerleave)="paused.set(false)">
      <div class="track" [style.transform]="'translateX(' + (-index() * 100) + '%)'">
        @for (s of slides(); track $index) {
          <div class="slide">
            <img [src]="s.image" [alt]="s.alt || ''" />
            @if (s.caption) { <div class="caption">{{ s.caption }}</div> }
          </div>
        }
      </div>
      @if (slides().length > 1) {
        <button type="button" class="arrow prev" aria-label="Previous slide" (click)="prev()">‹</button>
        <button type="button" class="arrow next" aria-label="Next slide" (click)="next()">›</button>
        <div class="dots">
          @for (s of slides(); track $index) {
            <button type="button" class="dot" [class.active]="$index === index()" [attr.aria-label]="'Go to slide ' + ($index + 1)" (click)="index.set($index)"></button>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .cz { position: relative; overflow: hidden; border-radius: var(--ui-radius); background: var(--ui-color-bg); }
    .track { display: flex; transition: transform var(--ui-motion-slow) var(--ui-ease-standard); }
    .slide { position: relative; flex: 0 0 100%; }
    .slide img { width: 100%; height: 100%; max-height: 360px; object-fit: cover; display: block; }
    .caption { position: absolute; left: 0; right: 0; bottom: 0; padding: var(--ui-space-3); background: linear-gradient(transparent, rgba(0,0,0,0.6));
      color: #fff; font-family: var(--ui-font-default); font-size: var(--ui-font-size-sm); }
    .arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; border-radius: 50%;
      border: none; background: rgba(0,0,0,0.45); color: #fff; cursor: pointer; font-size: 18px; }
    .arrow:hover { background: rgba(0,0,0,0.65); }
    .prev { left: var(--ui-space-2); } .next { right: var(--ui-space-2); }
    .dots { position: absolute; bottom: var(--ui-space-2); left: 0; right: 0; display: flex; justify-content: center; gap: 6px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; border: none; background: rgba(255,255,255,0.5); cursor: pointer; padding: 0; }
    .dot.active { background: #fff; }
  `,
})
export class UiCarousel implements OnInit, OnDestroy {
  slides = input<UiCarouselSlide[]>([]);
  /** Autoplay interval in ms; 0 disables. */
  autoplay = input(0);
  protected readonly index = signal(0);
  protected readonly paused = signal(false);
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const n = this.slides().length;
      if (this.index() >= n && n > 0) this.index.set(0);
    });
  }

  ngOnInit(): void {
    const ms = this.autoplay();
    if (ms > 0) this.timer = setInterval(() => { if (!this.paused()) this.next(); }, ms);
  }
  ngOnDestroy(): void { if (this.timer) clearInterval(this.timer); }

  protected next(): void { this.index.update((i) => (i + 1) % Math.max(1, this.slides().length)); }
  protected prev(): void { this.index.update((i) => (i - 1 + this.slides().length) % Math.max(1, this.slides().length)); }
}
