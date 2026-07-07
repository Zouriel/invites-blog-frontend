import { Component, computed, effect, input, signal } from '@angular/core';

/** `ui-code-viewer` — monospace source view with line numbers (content or fetched src). */
@Component({
  selector: 'ui-code-viewer',
  template: `
    <div class="cv">
      <div class="bar"><span class="lang">{{ language() }}</span></div>
      @if (loading()) { <div class="msg">Loading…</div> }
      @else if (error()) { <div class="msg err">{{ error() }}</div> }
      @else {
        <div class="body">
          <div class="gutter" aria-hidden="true">@for (n of lineNumbers(); track n) { <span>{{ n }}</span> }</div>
          <pre class="code"><code>{{ text() }}</code></pre>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .cv { display: flex; flex-direction: column; height: 100%; background: var(--ui-color-surface); border-radius: var(--ui-radius); overflow: hidden; }
    .bar { padding: var(--ui-space-1) var(--ui-space-3); background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .lang { font-family: var(--ui-font-default); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ui-color-text-muted); }
    .body { display: flex; flex: 1; overflow: auto; }
    .gutter { display: flex; flex-direction: column; padding: var(--ui-space-3) var(--ui-space-2); text-align: right;
      color: var(--ui-color-text-muted); font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); line-height: 1.5;
      user-select: none; border-right: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .code { margin: 0; padding: var(--ui-space-3); flex: 1; }
    code { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: pre; line-height: 1.5; }
    .msg { padding: var(--ui-space-4); color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .msg.err { color: var(--ui-color-danger); }
  `,
})
export class UiCodeViewer {
  src = input<string>();
  content = input<string>();
  language = input('text');
  protected readonly fetched = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly text = computed(() => this.content() ?? this.fetched() ?? '');
  protected readonly lineNumbers = computed(() => {
    const lines = this.text().split('\n').length;
    return Array.from({ length: Math.max(1, lines) }, (_, i) => i + 1);
  });

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
