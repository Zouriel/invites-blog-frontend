import { Component, computed, effect, input, signal } from '@angular/core';

/** `ui-text-viewer` — displays plain text from a `content` string or a fetched `src` URL. */
@Component({
  selector: 'ui-text-viewer',
  template: `
    <div class="tv">
      @if (loading()) { <div class="msg">Loading…</div> }
      @else if (error()) { <div class="msg err">{{ error() }}</div> }
      @else { <pre class="text">{{ text() }}</pre> }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .tv { height: 100%; overflow: auto; background: var(--ui-color-surface); border-radius: var(--ui-radius); }
    .text { margin: 0; padding: var(--ui-space-3); font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm);
      color: var(--ui-color-text); white-space: pre-wrap; word-break: break-word; line-height: 1.5; }
    .msg { padding: var(--ui-space-4); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .msg.err { color: var(--ui-color-danger); }
  `,
})
export class UiTextViewer {
  src = input<string>();
  content = input<string>();
  protected readonly fetched = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly text = computed(() => this.content() ?? this.fetched() ?? '');

  constructor() {
    effect(() => {
      const url = this.src();
      if (!url || this.content() !== undefined) return;
      this.loading.set(true);
      this.error.set(null);
      fetch(url)
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((t) => this.fetched.set(t))
        .catch((e) => this.error.set(String(e)))
        .finally(() => this.loading.set(false));
    });
  }
}
