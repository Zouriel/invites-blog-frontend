/**
 * Draws a compiled page onto a canvas exactly as the browser lays it out: the page's own HTML and CSS
 * inside an SVG `foreignObject`, drawn as an image. Nothing is approximated (unlike model/poster.ts),
 * so text, effects, masks and blends come out as the guest's page shows them.
 *
 * <p>An SVG drawn as an image loads nothing from outside, so the page's fonts are fetched and written in
 * (its pictures already are). Scroll-driven motion has no scroll there, so every animation is held at
 * its first moment; callers only send still content.</p>
 */

export interface RasterizeOptions {
  /** The area drawn, in design units, from the page's top left. */
  width: number;
  height: number;
  /** Canvas pixels per design unit. */
  scale: number;
  /** Turns a font URL found in the page into one this page can fetch. */
  resolveUrl?: (url: string) => string;
}

export async function rasterizePage(html: string, opts: RasterizeOptions): Promise<HTMLCanvasElement> {
  const svg = await pageSvg(html, opts);
  const W = Math.max(1, Math.round(opts.width * opts.scale));
  const H = Math.max(1, Math.round(opts.height * opts.scale));
  const img = new Image();
  img.width = W;
  img.height = H;
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  if (!g) throw new Error('No canvas.');
  // Safari decodes the pictures inside an SVG image late: draw again once they're in.
  g.drawImage(img, 0, 0, W, H);
  await new Promise((r) => setTimeout(r, 120));
  g.clearRect(0, 0, W, H);
  g.drawImage(img, 0, 0, W, H);
  g.getImageData(0, 0, 1, 1); // Throws here, not later, where a browser won't read back such a drawing.
  return canvas;
}

/**
 * The page as a standalone SVG document `width` x `height` units, drawn at `scale` pixels each. It is laid
 * out at one CSS pixel per unit, as on a 390-wide phone (the reference size: effect filters are written in
 * those pixels), and the SVG's view box scales the drawing up, so text and edges stay sharp.
 */
export async function pageSvg(html: string, opts: RasterizeOptions): Promise<string> {
  const W = Math.max(1, Math.round(opts.width * opts.scale));
  const H = Math.max(1, Math.round(opts.height * opts.scale));
  const w = opts.width, h = opts.height;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('script, .ib-tail, meta, title').forEach((n) => n.remove());
  let css = [...doc.querySelectorAll('style')].map((s) => s.textContent ?? '').join('\n');
  doc.querySelectorAll('style').forEach((s) => s.remove());

  // The document's root and body rules land on our wrapper (`.ib-r`), the html rule nowhere (no page
  // colour); a design unit is one pixel instead of a share of the screen's width.
  css = css.replace(/(^|[}\s]):root\{/g, '$1.ib-r{').replace(/(^|[}\s])html\{/g, '$1.ib-no{').replace(/(^|[}\s])body\{/g, '$1.ib-r{');
  css = await inlineFonts(css, opts.resolveUrl ?? ((u) => u));
  css += `.ib-r{--u:1px;position:relative;width:${w}px;height:${h}px;overflow:hidden}`;
  css += `.ib-r .ib-page{width:${w}px!important;height:${h}px!important;margin:0!important;background:none!important}`;
  // No scroll here: hold every animation at its start (the content is still, so that is how it rests).
  css += '.ib-r *{animation-timeline:auto!important;animation-play-state:paused!important;animation-delay:0s!important;transition:none!important}';

  const wrap = doc.createElement('div');
  wrap.className = 'ib-r';
  const style = doc.createElement('style');
  style.textContent = css;
  wrap.append(style, ...Array.from(doc.body.childNodes));
  const xhtml = new XMLSerializer().serializeToString(wrap);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><foreignObject x="0" y="0" width="${w}" height="${h}">${xhtml}</foreignObject></svg>`;
}

/** Writes each `url("…woff2")` in the stylesheet in as a data: URI; one that can't be fetched is left (and falls back). */
async function inlineFonts(css: string, resolve: (url: string) => string): Promise<string> {
  const urls = [...new Set([...css.matchAll(/url\("([^"]+\.woff2)"\)/g)].map((m) => m[1]))];
  const data = await Promise.all(urls.map(async (url) => {
    try {
      const res = await fetch(resolve(url.replaceAll('&amp;', '&')));
      if (!res.ok) return null;
      return 'data:font/woff2;base64,' + base64(new Uint8Array(await res.arrayBuffer()));
    } catch {
      return null;
    }
  }));
  urls.forEach((url, i) => {
    if (data[i]) css = css.replaceAll(`url("${url}")`, `url("${data[i]}")`);
  });
  return css;
}

function base64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

/** Where anything is drawn (alpha above zero), in pixels; null when nothing is. */
export function paintedBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const { width: W, height: H } = canvas;
  const data = canvas.getContext('2d')!.getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    const row = y * W * 4;
    for (let x = 0; x < W; x++) {
      if (data[row + x * 4 + 3] === 0) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Part of a canvas as a WebP (PNG where the browser can't write WebP, as Safari can't). */
export function canvasPart(canvas: HTMLCanvasElement, part: { x: number; y: number; w: number; h: number }): Promise<Blob> {
  const out = document.createElement('canvas');
  out.width = Math.max(1, part.w);
  out.height = Math.max(1, part.h);
  out.getContext('2d')!.drawImage(canvas, part.x, part.y, part.w, part.h, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) =>
    out.toBlob((blob) => {
      if (blob && blob.type === 'image/webp') resolve(blob);
      else out.toBlob((png) => (png ? resolve(png) : reject(new Error('Could not draw the picture.'))), 'image/png');
    }, 'image/webp', 0.95));
}
