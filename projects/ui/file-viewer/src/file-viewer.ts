import { Component, computed, input } from '@angular/core';
import { UiPdfViewer } from 'ui/pdf-viewer';
import { UiImageViewer } from './image-viewer';
import { UiVideoPlayer } from './video-player';
import { UiAudioPlayer } from './audio-player';
import { UiTextViewer } from './text-viewer';
import { UiCodeViewer } from './code-viewer';

type FileType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'code' | 'unknown';

const EXT: Record<string, FileType> = {
  png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image', bmp: 'image', avif: 'image',
  mp4: 'video', webm: 'video', mov: 'video', ogv: 'video', m4v: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio', aac: 'audio',
  pdf: 'pdf',
  txt: 'text', md: 'text', log: 'text', csv: 'text', rtf: 'text',
  ts: 'code', tsx: 'code', js: 'code', jsx: 'code', json: 'code', css: 'code', scss: 'code', html: 'code', xml: 'code', yml: 'code', yaml: 'code', py: 'code', java: 'code', go: 'code', rs: 'code', sh: 'code',
};

/**
 * `ui-file-viewer` — detects a file's type from `kind`/extension and delegates
 * to the matching sub-renderer. The PDF branch lazy-loads `pdfjs-dist` via
 * `@defer` so it never ships unless a PDF is opened. Unsupported types fall
 * back to metadata + a download link. Embed inline or inside `ui-window`.
 */
@Component({
  selector: 'ui-file-viewer',
  imports: [UiImageViewer, UiVideoPlayer, UiAudioPlayer, UiTextViewer, UiCodeViewer, UiPdfViewer],
  template: `
    <div class="fv">
      @switch (type()) {
        @case ('image') { <ui-image-viewer [src]="src()" [alt]="name() || ''" /> }
        @case ('video') { <ui-video-player [src]="src()" /> }
        @case ('audio') { <ui-audio-player [src]="src()" [title]="name()" /> }
        @case ('text')  { <ui-text-viewer [src]="src()" /> }
        @case ('code')  { <ui-code-viewer [src]="src()" [language]="ext()" /> }
        @case ('pdf') {
          @defer (on immediate) {
            <ui-pdf-viewer [src]="src()" />
          } @placeholder {
            <div class="fallback"><span class="big">📕</span><span>Loading PDF viewer…</span></div>
          }
        }
        @default {
          <div class="fallback">
            <span class="big">📄</span>
            <span class="nm">{{ name() || src() }}</span>
            <span class="muted">Preview not available for this file type.</span>
            <a class="dl" [href]="src()" [attr.download]="name() || true">Download</a>
          </div>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .fv { height: 100%; min-height: 200px; }
    .fallback { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--ui-space-2);
      height: 100%; padding: var(--ui-space-6); text-align: center; font-family: var(--ui-font-default); color: var(--ui-color-text-muted); }
    .big { font-size: 40px; }
    .nm { color: var(--ui-color-text); word-break: break-all; }
    .dl { color: var(--ui-color-primary); text-decoration: none; font-size: var(--ui-font-size-sm); }
    .dl:hover { text-decoration: underline; }
  `,
})
export class UiFileViewer {
  src = input.required<string>();
  name = input<string>();
  /** Explicit type override or MIME/extension; otherwise inferred from the URL. */
  kind = input<string>();

  protected readonly ext = computed(() => {
    const k = this.kind();
    if (k && !k.includes('/')) return k.toLowerCase();
    const fromName = (this.name() || this.src()).split('?')[0].split('.').pop() || '';
    return fromName.toLowerCase();
  });

  protected readonly type = computed<FileType>(() => {
    const k = this.kind();
    if (k && (['image', 'video', 'audio', 'pdf', 'text', 'code'] as string[]).includes(k)) return k as FileType;
    if (k?.startsWith('image/')) return 'image';
    if (k?.startsWith('video/')) return 'video';
    if (k?.startsWith('audio/')) return 'audio';
    if (k === 'application/pdf') return 'pdf';
    return EXT[this.ext()] ?? 'unknown';
  });
}
