import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, viewChild } from '@angular/core';
import type { LoopPreset, MotionPreset } from './model/scene';

/** Canvas units to thumbnail pixels: a 120-unit slide is 14px across a 56px tile. */
const K = 0.12;

/**
 * A preset playing on a small sample, from the preset's own recipe — the same frames the editor writes
 * as keyframes, so the tile shows what you'll get. It uses the browser's animation API rather than
 * CSS, since every tile needs its own keyframes. It plays while the tile is hovered or focused, and
 * keeps playing on the chosen tile, so a grid of forty doesn't all move at once.
 */
@Component({
  selector: 'app-motion-thumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(pointerenter)': 'play()', '(pointerleave)': 'rest()', '[class.text]': 'kind() === "text"' },
  template: `
    <span class="stage">
      <span #subject class="subject" [class.clip]="clipped()">
        @if (kind() === 'text') {
          <span class="aa">Aa</span>
        } @else if (kind() === 'draw') {
          <svg viewBox="0 0 30 30" aria-hidden="true"><rect #stroke x="3" y="3" width="24" height="24" rx="4" pathLength="1" /></svg>
        } @else {
          <span class="box"></span>
        }
      </span>
    </span>
  `,
  styles: `
    :host { display: block; width: 100%; height: 100%; }
    .stage { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; perspective: 160px; overflow: hidden; }
    .subject { display: flex; align-items: center; justify-content: center; width: 30px; height: 30px; }
    .box { width: 100%; height: 100%; border-radius: 6px; background: var(--ui-color-primary); }
    .aa { font-family: var(--ui-font-default); font-weight: 600; font-size: 18px; color: var(--ui-color-primary); white-space: nowrap; }
    svg { width: 100%; height: 100%; overflow: visible; }
    rect { fill: none; stroke: var(--ui-color-primary); stroke-width: 2.5; stroke-dasharray: 1 1; }
  `,
})
export class MotionThumbComponent {
  private readonly destroyRef = inject(DestroyRef);

  preset = input<MotionPreset | LoopPreset | null>(null);
  slot = input<'enter' | 'exit' | 'loop'>('enter');
  /** Keep playing (the chosen tile). */
  active = input(false);

  private readonly subject = viewChild.required<ElementRef<HTMLElement>>('subject');
  private readonly stroke = viewChild<ElementRef<SVGRectElement>>('stroke');
  private animations: Animation[] = [];
  private hovering = false;

  protected readonly kind = computed(() => {
    const p = this.preset() as MotionPreset | null;
    if (p?.only === 'text' || p?.frames.some((f) => (f as { tracking?: number | null }).tracking != null)) return 'text';
    if (p?.only === 'shape') return 'draw';
    return 'box';
  });
  protected readonly clipped = computed(() => !!(this.preset() as MotionPreset | null)?.clipShape);

  constructor() {
    afterNextRender(() => this.build());
    effect(() => {
      this.preset();
      this.slot();
      this.build();
    });
    effect(() => {
      if (this.active()) this.play();
      else if (!this.hovering) this.rest();
    });
    this.destroyRef.onDestroy(() => this.animations.forEach((a) => a.cancel()));
  }

  protected play(): void {
    this.hovering = true;
    if (this.reduced()) return;
    this.animations.forEach((a) => a.play());
  }

  protected rest(): void {
    this.hovering = false;
    if (this.active()) return;
    // Resting on the settled state: an entrance shown arrived, an exit shown before it leaves.
    this.animations.forEach((a) => {
      a.pause();
      a.currentTime = this.slot() === 'exit' ? 0 : ((a.effect?.getComputedTiming().duration as number) ?? 0) * 0.99;
    });
  }

  private reduced(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private build(): void {
    const el = this.subject()?.nativeElement;
    if (!el || typeof el.animate !== 'function') return;
    this.animations.forEach((a) => a.cancel());
    this.animations = [];
    const preset = this.preset();
    if (!preset) return;
    const slot = this.slot();
    const loop = slot === 'loop';
    const frames = [...preset.frames].sort((a, b) => a.t - b.t);
    const t0 = frames[0]?.t ?? 0;
    const t1 = frames[frames.length - 1]?.t ?? 1;
    const span = Math.max(1e-6, t1 - t0);
    // Enter plays in the first 70% then holds; exit holds then plays in the last 70%; a loop is its cycle.
    const offset = (t: number) => (loop ? t : slot === 'enter' ? ((t - t0) / span) * 0.7 : 0.3 + ((t - t0) / span) * 0.7);

    const keyframes: Keyframe[] = [];
    const strokes: Keyframe[] = [];
    for (const f of frames) {
      const m = f as MotionPreset['frames'][number] & LoopPreset['frames'][number];
      const dx = m.dx * K;
      const dy = m.dy * K;
      const rotate = loop ? m.rotate : m.dRotate;
      const scale = m.scale ?? 1;
      const parts = [`translate(${dx}px, ${dy}px)`, `rotate(${rotate ?? 0}deg)`];
      if (m.rotateX != null || m.rotateY != null) parts.push(`rotateX(${m.rotateX ?? 0}deg)`, `rotateY(${m.rotateY ?? 0}deg)`);
      if (m.skewX != null) parts.push(`skewX(${m.skewX}deg)`);
      parts.push(`scale(${scale})`);
      const k: Keyframe = { offset: offset(f.t), transform: parts.join(' '), opacity: m.opacity ?? 1, easing: f.easing ?? 'linear' };
      if (m.blur != null) k['filter'] = `blur(${m.blur * 0.4}px)`;
      if (m.clip != null) {
        const c = m.clip;
        k['clipPath'] = c.length === 1 ? `circle(${c[0]}% at 50% 50%)` : `inset(${c[0]}% ${c[1]}% ${c[2]}% ${c[3]}%)`;
      }
      if (m.tracking != null) k['letterSpacing'] = `${m.tracking}em`;
      keyframes.push(k);
      if (m.draw != null) strokes.push({ offset: offset(f.t), strokeDashoffset: 1 - m.draw, easing: f.easing ?? 'linear' });
    }
    if (!loop) {
      // Hold the ends so the cycle reads: arrive, rest, repeat.
      if (keyframes[0].offset! > 0) keyframes.unshift({ ...keyframes[0], offset: 0 });
      if (keyframes[keyframes.length - 1].offset! < 1) keyframes.push({ ...keyframes[keyframes.length - 1], offset: 1 });
    }
    const timing: KeyframeAnimationOptions = {
      duration: loop ? 1400 : 1800, iterations: Infinity, fill: 'both',
      direction: loop && (preset as LoopPreset).alternate ? 'alternate' : 'normal',
    };
    const origin = preset.origin;
    if (origin?.length === 2) el.style.transformOrigin = `${origin[0] * 100}% ${origin[1] * 100}%`;
    else el.style.transformOrigin = '';
    try {
      this.animations.push(el.animate(keyframes, timing));
      const stroke = this.stroke()?.nativeElement;
      if (stroke && strokes.length) {
        if (strokes[0].offset! > 0) strokes.unshift({ ...strokes[0], offset: 0 });
        if (strokes[strokes.length - 1].offset! < 1) strokes.push({ ...strokes[strokes.length - 1], offset: 1 });
        this.animations.push(stroke.animate(strokes, timing));
      }
    } catch {
      // A browser that can't animate a property just shows the still tile.
    }
    if (this.active() && !this.reduced()) this.play();
    else this.rest();
  }
}
