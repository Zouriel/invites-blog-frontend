import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';

export type UiDriftDirection = 'auto' | 'left' | 'right';

/**
 * `ui-drift-row` — a horizontal rail that gently auto-scrolls ("drifts") on its
 * own yet stays fully scrollable, swipeable and draggable by the user. Project
 * any content (cards, media, chips) straight inside:
 *
 *   <ui-drift-row [speed]="26" direction="auto" gap="1.4rem">
 *     <article class="card">…</article>
 *     <article class="card">…</article>
 *   </ui-drift-row>
 *
 * Behaviour:
 * - Drifts toward a random side by default (`direction="auto"`), or a fixed
 *   side with `direction="left" | "right"`, ping-ponging at each end.
 * - Pauses the drift while the user hovers, grabs/drags, swipes or wheels the
 *   rail, then resumes after `resumeDelay` ms of stillness.
 * - Click-drag to scroll on desktop (a real click still fires if you don't
 *   drag); native touch swipe on mobile.
 * - Honors `prefers-reduced-motion`: no auto-drift, but still scrollable.
 *
 * Self-contained — no global CSS required.
 */
@Component({
  selector: 'ui-drift-row',
  template: `
    <div #vp class="drift" [style.--gap]="gap()">
      <div class="drift__track"><ng-content /></div>
    </div>
  `,
  host: { '[class.faded]': 'fade() && overflowing()' },
  styles: `
    :host { display: block; }
    .drift {
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      cursor: grab;
      overscroll-behavior-x: contain;
    }
    .drift::-webkit-scrollbar { display: none; }
    .drift.grabbing { cursor: grabbing; user-select: none; }
    .drift__track {
      display: flex;
      gap: var(--gap, 1.5rem);
      width: max-content;
      padding: 0.35rem 0.15rem;
    }
    :host(.faded) .drift {
      mask-image: linear-gradient(90deg, transparent, #000 3.5%, #000 96.5%, transparent);
      -webkit-mask-image: linear-gradient(90deg, transparent, #000 3.5%, #000 96.5%, transparent);
    }
  `,
})
export class UiDriftRow implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private vp = viewChild.required<ElementRef<HTMLDivElement>>('vp');

  /** Drift speed in pixels per second. */
  speed = input(26);
  /** Initial drift side. `auto` picks a random side per instance. */
  direction = input<UiDriftDirection>('auto');
  /** Flex gap between projected items (any CSS length). */
  gap = input('1.5rem');
  /** Pause the drift while the pointer is over the rail. */
  pauseOnHover = input(true);
  /** Ms of stillness after an interaction before the drift resumes. */
  resumeDelay = input(1800);
  /** Edge-fade mask so items dissolve at the rail's edges. */
  fade = input(true);

  /** Whether the rail actually overflows — the edge fade only shows when it does. */
  protected readonly overflowing = signal(false);

  private ro?: ResizeObserver;
  private dir = 1;
  private raf = 0;
  private last = 0;
  /** Float scroll accumulator — sub-pixel drift would otherwise round to 0. */
  private pos = 0;
  private paused = false;
  private hovering = false;
  private resumeTimer: ReturnType<typeof setTimeout> | undefined;

  // drag-to-scroll state
  private down = false;
  private dragging = false;
  private startX = 0;
  private startScroll = 0;
  private readonly DRAG_THRESHOLD = 6;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const el = this.vp().nativeElement;

    const d = this.direction();
    this.dir = d === 'left' ? -1 : d === 'right' ? 1 : Math.random() < 0.5 ? -1 : 1;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.zone.runOutsideAngular(() => {
      el.addEventListener('pointerenter', this.onEnter);
      el.addEventListener('pointerleave', this.onLeave);
      el.addEventListener('wheel', this.onInteract, { passive: true });
      el.addEventListener('touchstart', this.onInteract, { passive: true });
      el.addEventListener('pointerdown', this.onPointerDown);

      if (!reduce) {
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.tick);
      }

      // Track whether the rail overflows so the edge fade only shows when it
      // can actually scroll (otherwise it dims the first/last item at rest).
      this.measure();
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(() => this.measure());
        this.ro.observe(el);
        this.ro.observe(el.firstElementChild ?? el);
      }
    });
  }

  private measure(): void {
    const el = this.vp().nativeElement;
    this.overflowing.set(el.scrollWidth - el.clientWidth > 1);
  }

  private readonly tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    const el = this.vp().nativeElement;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 1) return;

    // While hovered/dragging/paused, follow the user's scroll position so the
    // drift picks up seamlessly from wherever they left it.
    if (this.paused || this.dragging || (this.pauseOnHover() && this.hovering)) {
      this.pos = el.scrollLeft;
      return;
    }

    this.pos += this.dir * this.speed() * dt;
    if (this.pos <= 0) {
      this.pos = 0;
      this.dir = 1;
    } else if (this.pos >= max) {
      this.pos = max;
      this.dir = -1;
    }
    el.scrollLeft = this.pos;
  };

  private readonly onEnter = () => (this.hovering = true);
  private readonly onLeave = () => (this.hovering = false);

  private pauseThenResume(): void {
    this.paused = true;
    clearTimeout(this.resumeTimer);
    this.resumeTimer = setTimeout(() => (this.paused = false), this.resumeDelay());
  }
  private readonly onInteract = () => this.pauseThenResume();

  private readonly onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.down = true;
    this.dragging = false;
    this.startX = e.clientX;
    this.startScroll = this.vp().nativeElement.scrollLeft;
    window.addEventListener('pointermove', this.onPointerMove, { passive: false });
    window.addEventListener('pointerup', this.onPointerUp, { passive: true });
  };

  private readonly onPointerMove = (e: PointerEvent) => {
    if (!this.down) return;
    const dx = e.clientX - this.startX;
    const el = this.vp().nativeElement;
    if (!this.dragging && Math.abs(dx) > this.DRAG_THRESHOLD) {
      this.dragging = true;
      el.classList.add('grabbing');
      el.setPointerCapture?.(e.pointerId);
    }
    if (this.dragging) {
      el.scrollLeft = this.startScroll - dx;
      e.preventDefault();
    }
  };

  private readonly onPointerUp = () => {
    this.down = false;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    if (this.dragging) {
      const el = this.vp().nativeElement;
      el.classList.remove('grabbing');
      // Swallow the click that fires right after a drag so cards don't navigate.
      const suppress = (ev: Event) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      el.addEventListener('click', suppress, { capture: true, once: true });
      setTimeout(() => el.removeEventListener('click', suppress, true), 0);
      this.dragging = false;
    }
    this.pauseThenResume();
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    clearTimeout(this.resumeTimer);
    this.ro?.disconnect();
    const el = this.vp?.().nativeElement;
    if (el) {
      el.removeEventListener('pointerenter', this.onEnter);
      el.removeEventListener('pointerleave', this.onLeave);
      el.removeEventListener('wheel', this.onInteract);
      el.removeEventListener('touchstart', this.onInteract);
      el.removeEventListener('pointerdown', this.onPointerDown);
    }
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
  }
}
