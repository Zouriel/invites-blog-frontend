import { Component, inject, input, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/** `ui-code-block` — monospace code panel with language label and copy button. */
@Component({
  selector: 'ui-code-block',
  template: `
    <div class="cb" [class.no-radius]="!radius()">
      <div class="bar">
        <span class="lang">{{ language() }}</span>
        <button type="button" class="copy" (click)="copy()">{{ copied() ? 'Copied ✓' : 'Copy' }}</button>
      </div>
      <pre class="code"><code>{{ code() }}</code></pre>
    </div>
  `,
  styles: `
    :host { display: block; }
    .cb { border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; background: var(--ui-color-surface); }
    .cb.no-radius { border-radius: 0; }
    .bar { display: flex; align-items: center; justify-content: space-between; padding: var(--ui-space-1) var(--ui-space-3);
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border); }
    .lang { font-family: var(--ui-font-default); font-size: 12px; color: var(--ui-color-text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .copy { border: none; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font-family: var(--ui-font-default); font-size: 12px; }
    .copy:hover { color: var(--ui-color-text); }
    .copy:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 4px; }
    .code { margin: 0; padding: var(--ui-space-3); overflow: auto; }
    code { font-family: var(--ui-font-mono); font-size: var(--ui-font-size-sm); color: var(--ui-color-text); white-space: pre; }
  `,
})
export class UiCodeBlock {
  private doc = inject(DOCUMENT);
  code = input('');
  language = input('text');
  radius = input(true);
  protected readonly copied = signal(false);

  protected async copy(): Promise<void> {
    const text = this.code();
    try {
      await this.doc.defaultView?.navigator.clipboard.writeText(text);
    } catch {
      /* clipboard unavailable; ignore */
    }
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1500);
  }
}
