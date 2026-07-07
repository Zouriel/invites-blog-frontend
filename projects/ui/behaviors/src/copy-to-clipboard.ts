import { DOCUMENT } from '@angular/common';
import { Directive, inject, input, output, signal } from '@angular/core';

/**
 * `uiCopyToClipboard` — copies the bound text to the clipboard on click and
 * exposes a transient `copied` state. Emits `(copied)` / `(copyFailed)`.
 */
@Directive({
  selector: '[uiCopyToClipboard]',
  exportAs: 'uiCopy',
  host: { '(click)': 'copy()', '[attr.data-copied]': 'copied() || null' },
})
export class UiCopyToClipboard {
  private doc = inject(DOCUMENT);
  text = input<string>('', { alias: 'uiCopyToClipboard' });
  readonly copied = signal(false);
  copyEvent = output<string>({ alias: 'copied' });
  copyFailed = output<unknown>();

  async copy(): Promise<void> {
    const value = this.text();
    try {
      await this.doc.defaultView?.navigator.clipboard.writeText(value);
      this.copied.set(true);
      this.copyEvent.emit(value);
      setTimeout(() => this.copied.set(false), 1500);
    } catch (err) {
      this.copyFailed.emit(err);
    }
  }
}
