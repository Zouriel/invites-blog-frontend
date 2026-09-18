/**
 * The designer's renderer in the browser. The server stays the authority — it compiles everything that
 * is published, and Check comes from it — but the editor's preview is rendered here, so an edit shows
 * as soon as it's made instead of after a round trip.
 *
 * <p>Same output as the server's `DesignEngine.Build` preview: the page compiled with the editor bridge,
 * then bound with sample data. `parity.spec.ts` holds the two together.</p>
 */
import { compile, type CompileOptions } from './compiler';
import type { RenderCatalog } from './css';
import { bind } from './binder';
import { normalizeScene } from './model';
import { sampleData, type SampleMode } from './sample-data';

export type { RenderCatalog } from './css';
export type { SampleMode } from './sample-data';
export { compile, compileDesign } from './compiler';
export { bind } from './binder';
export { normalizeScene } from './model';
export { sampleData } from './sample-data';

export interface PreviewOptions {
  fontBaseUrl: string;
  sample: SampleMode;
  /** Blocks to show; null shows every block the scene uses. */
  blocks?: readonly string[] | null;
  hidden?: ReadonlySet<string>;
  /** Where the page opens, in scroll units. */
  scroll?: number;
  /** False for the full-screen preview: no editor bridge. */
  editor?: boolean;
  title?: string;
}

export interface RenderedPreview {
  html: string;
  /** Size of the unbound, published compile — what the limits count. */
  bytes: number;
}

export function renderPreview(rawScene: unknown, catalog: RenderCatalog, options: PreviewOptions): RenderedPreview {
  const scene = normalizeScene(rawScene);
  const title = options.title ?? 'Invitation';
  const published = compile(scene, catalog, { fontBaseUrl: options.fontBaseUrl, title });
  const compileOptions: CompileOptions = {
    fontBaseUrl: options.fontBaseUrl,
    title,
    editorPreview: options.editor ?? true,
    initialScroll: Math.max(0, options.scroll ?? 0),
    hiddenElementIds: options.hidden,
  };
  const page = compileOptions.editorPreview || compileOptions.hiddenElementIds?.size ? compile(scene, catalog, compileOptions) : published;
  const html = bind(page, sampleData(scene, catalog, options.sample, options.blocks ?? null));
  return { html, bytes: new TextEncoder().encode(published).length };
}

/**
 * A bound page as a parser sees it, with the inline payload rewritten canonically — how two pages that
 * were serialised differently (the server's parser and the browser's) are compared.
 */
export function canonicalHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const payload = doc.getElementById('invite-data');
  if (payload?.textContent) payload.textContent = JSON.stringify(JSON.parse(payload.textContent));
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

/** Where two strings part ways, with a little context — for drift reports. */
export function firstDifference(a: string, b: string): { at: number; ours: string; theirs: string } | null {
  if (a === b) return null;
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return { at: i, ours: a.slice(Math.max(0, i - 80), i + 80), theirs: b.slice(Math.max(0, i - 80), i + 80) };
}
