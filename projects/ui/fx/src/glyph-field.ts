import {
  AfterViewInit, Component, ElementRef, NgZone, OnDestroy, inject, input, viewChild,
} from '@angular/core';

/**
 * `ui-glyph-field` — animated binary/glyph field rendered to a canvas. A
 * reusable, asset-free take on the portfolio's binary-face background: a grid
 * of flickering glyphs lit by a drifting intensity field, tinted along the
 * brand ramp (ember → blood → rose). Use as a fixed page backdrop (`fixed`)
 * or contained within a positioned parent. Honors `prefers-reduced-motion`.
 */
@Component({
  selector: 'ui-glyph-field',
  template: `<canvas #cv class="gf" [class.fixed]="fixed()" [style.opacity]="opacity()" aria-hidden="true"></canvas>`,
  styles: `
    :host { display: contents; }
    .gf { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; mix-blend-mode: screen; }
    .gf.fixed { position: fixed; z-index: 0; }
  `,
})
export class UiGlyphField implements AfterViewInit, OnDestroy {
  private zone = inject(NgZone);
  private cv = viewChild.required<ElementRef<HTMLCanvasElement>>('cv');

  fixed = input(false);
  opacity = input(0.55);
  chars = input('01');
  cell = input(16);
  speed = input(1);
  /** Color ramp dim → mid → bright. Defaults track the dramatic brand ramp. */
  colors = input<[string, string, string]>(['#5a2832', '#e63946', '#fbbf24']);

  private raf = 0;
  private ro?: ResizeObserver;
  private destroyed = false;

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    const canvas = this.cv().nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const glyphs = this.chars();
    const [cDim, cMid, cBright] = this.colors();

    let w = 0, h = 0, cols = 0, rows = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      const r = canvas.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      const cs = this.cell();
      cols = Math.ceil(w / cs); rows = Math.ceil(h / cs);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `700 ${Math.round(this.cell() * 0.82)}px ui-monospace, Menlo, monospace`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    };
    size();
    this.ro = new ResizeObserver(() => size());
    this.ro.observe(canvas);

    const hash = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const lerpColor = (a: string, b: string, t: number) => {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
      const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
      return `rgb(${Math.round(ar + (br - ar) * t)},${Math.round(ag + (bg - ag) * t)},${Math.round(ab + (bb - ab) * t)})`;
    };

    const cs = () => this.cell();
    const draw = (time: number) => {
      if (this.destroyed) return;
      const t = time * 0.001 * this.speed();
      ctx.clearRect(0, 0, w, h);
      const c = cs();
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          // drifting intensity field, brightest toward centre
          const nx = gx / cols - 0.5, ny = gy / rows - 0.5;
          const wave = Math.sin(gx * 0.18 + t * 0.9) * 0.5 + Math.cos(gy * 0.21 - t * 0.7) * 0.5;
          const radial = 1 - Math.min(1, Math.hypot(nx, ny) * 1.7);
          let lum = radial * 0.7 + wave * 0.25 + 0.05;
          if (lum < 0.12) continue;
          const h0 = hash(gx, gy);
          const phase = Math.floor(t * 0.9 + h0 * 9);
          const flick = hash(gx + phase, gy + 7) > 0.86 ? 1 : 0;
          const idx = (Math.floor(h0 * glyphs.length) + flick) % glyphs.length;
          const col = lum < 0.4 ? lerpColor(cDim, cMid, lum / 0.4) : lerpColor(cMid, cBright, (lum - 0.4) / 0.6);
          ctx.globalAlpha = Math.min(1, lum * 1.2);
          ctx.fillStyle = col;
          ctx.fillText(glyphs[idx], gx * c + c / 2, gy * c + c / 2);
        }
      }
      ctx.globalAlpha = 1;
      if (!reduce) this.raf = requestAnimationFrame(draw);
    };

    this.zone.runOutsideAngular(() => {
      if (reduce) { draw(0); } else { this.raf = requestAnimationFrame(draw); }
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
  }
}
