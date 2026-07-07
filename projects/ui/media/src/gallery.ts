import { Component, computed, input, signal } from '@angular/core';

export interface UiGalleryImage {
  src: string;
  thumb?: string;
  alt?: string;
}

/** `ui-gallery` — responsive thumbnail grid with a lightbox (prev/next, Esc to close). */
@Component({
  selector: 'ui-gallery',
  template: `
    <div class="grid" [style.--ui-gallery-min]="minThumb()">
      @for (img of images(); track $index) {
        <button type="button" class="thumb" (click)="openAt($index)" [attr.aria-label]="img.alt || 'Open image'">
          <img [src]="img.thumb || img.src" [alt]="img.alt || ''" loading="lazy" />
        </button>
      }
    </div>
    @if (lightbox() >= 0) {
      <div class="lb" (click)="close()" (keydown.escape)="close()" tabindex="0" role="dialog" aria-label="Image viewer"
           animate.enter="ui-fade-enter" animate.leave="ui-fade-leave">
        <img [src]="current()?.src" [alt]="current()?.alt || ''" (click)="$event.stopPropagation()" />
        <button type="button" class="nav prev" aria-label="Previous" (click)="step(-1, $event)">‹</button>
        <button type="button" class="nav next" aria-label="Next" (click)="step(1, $event)">›</button>
        <button type="button" class="x" aria-label="Close" (click)="close()">✕</button>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--ui-gallery-min, 120px), 1fr)); gap: var(--ui-space-2); }
    .thumb { padding: 0; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; cursor: pointer; background: none; aspect-ratio: 1; }
    .thumb:hover { border-color: var(--ui-color-primary); }
    .thumb:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lb { position: fixed; inset: 0; z-index: var(--ui-z-overlay); display: flex; align-items: center; justify-content: center;
      background: rgba(0,0,0,0.85); }
    .lb > img { max-width: 86vw; max-height: 86vh; border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-3); }
    .nav, .x { position: absolute; border: none; background: rgba(255,255,255,0.12); color: #fff; cursor: pointer; border-radius: 50%; }
    .nav { top: 50%; transform: translateY(-50%); width: 44px; height: 44px; font-size: 22px; }
    .prev { left: var(--ui-space-4); } .next { right: var(--ui-space-4); }
    .x { top: var(--ui-space-4); right: var(--ui-space-4); width: 36px; height: 36px; font-size: 16px; }
    .nav:hover, .x:hover { background: rgba(255,255,255,0.25); }
  `,
})
export class UiGallery {
  images = input<UiGalleryImage[]>([]);
  minThumb = input('120px');
  protected readonly lightbox = signal(-1);
  protected readonly current = computed(() => this.images()[this.lightbox()]);

  protected openAt(i: number): void { this.lightbox.set(i); }
  protected close(): void { this.lightbox.set(-1); }
  protected step(d: number, e: Event): void {
    e.stopPropagation();
    const n = this.images().length;
    this.lightbox.update((i) => (i + d + n) % n);
  }
}
