import { DecimalPipe } from '@angular/common';
import {
  Component, ElementRef, effect, input, signal, viewChild,
} from '@angular/core';

/**
 * `ui-pdf-viewer` — renders a PDF with page navigation and zoom. `pdfjs-dist`
 * is loaded via a dynamic import so it ships only when this component is used
 * (its own secondary entry point; pair with `@defer` for full lazy loading).
 * Override `workerSrc` to self-host the worker instead of the CDN default.
 */
@Component({
  selector: 'ui-pdf-viewer',
  imports: [DecimalPipe],
  template: `
    <div class="pv">
      <div class="bar">
        <button type="button" (click)="prev()" [disabled]="page() <= 1" aria-label="Previous page">‹</button>
        <span class="pg">{{ page() }} / {{ pages() || '—' }}</span>
        <button type="button" (click)="next()" [disabled]="page() >= pages()" aria-label="Next page">›</button>
        <span class="spacer"></span>
        <button type="button" (click)="zoomBy(-0.2)" aria-label="Zoom out">−</button>
        <span class="pct">{{ (scale() * 100) | number:'1.0-0' }}%</span>
        <button type="button" (click)="zoomBy(0.2)" aria-label="Zoom in">+</button>
      </div>
      <div class="stage">
        @if (error()) { <div class="msg err">{{ error() }}</div> }
        @else if (loading()) { <div class="msg">Loading PDF…</div> }
        <canvas #canvas [class.hidden]="loading() || error()"></canvas>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .pv { display: flex; flex-direction: column; height: 100%; min-height: 240px; background: var(--ui-color-surface); border-radius: var(--ui-radius); overflow: hidden; }
    .bar { display: flex; align-items: center; gap: var(--ui-space-2); padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .bar button { width: 28px; height: 26px; border: 1px solid var(--ui-color-border); background: var(--ui-color-surface); color: var(--ui-color-text); border-radius: 6px; cursor: pointer; }
    .bar button:disabled { opacity: 0.4; cursor: not-allowed; }
    .spacer { flex: 1; }
    .pg, .pct { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .stage { flex: 1; overflow: auto; display: flex; align-items: flex-start; justify-content: center; padding: var(--ui-space-3); background: var(--ui-color-bg); }
    canvas { box-shadow: var(--ui-shadow-2); background: #fff; }
    canvas.hidden { display: none; }
    .msg { padding: var(--ui-space-4); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .msg.err { color: var(--ui-color-danger); }
  `,
})
export class UiPdfViewer {
  src = input.required<string>();
  workerSrc = input<string>();

  protected readonly page = signal(1);
  protected readonly pages = signal(0);
  protected readonly scale = signal(1.2);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private doc: any = null;

  constructor() {
    // (Re)load whenever src changes.
    effect(() => {
      const url = this.src();
      this.load(url);
    });
    // Re-render whenever page or scale changes (and a doc is loaded).
    effect(() => {
      const p = this.page();
      const s = this.scale();
      if (this.doc) this.render(p, s);
    });
  }

  private async load(url: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const pdfjs = await import('pdfjs-dist');
      pdfjs.GlobalWorkerOptions.workerSrc =
        this.workerSrc() ?? `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
      this.doc = await pdfjs.getDocument(url).promise;
      this.pages.set(this.doc.numPages);
      this.page.set(1);
      await this.render(1, this.scale());
    } catch (e) {
      this.error.set(`Could not load PDF: ${e}`);
    } finally {
      this.loading.set(false);
    }
  }

  private async render(pageNum: number, scale: number): Promise<void> {
    if (!this.doc) return;
    try {
      const page = await this.doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = this.canvas().nativeElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport }).promise;
    } catch (e) {
      this.error.set(`Render failed: ${e}`);
    }
  }

  protected prev(): void { this.page.update((p) => Math.max(1, p - 1)); }
  protected next(): void { this.page.update((p) => Math.min(this.pages(), p + 1)); }
  protected zoomBy(d: number): void { this.scale.update((s) => Math.min(4, Math.max(0.4, +(s + d).toFixed(2)))); }
}
