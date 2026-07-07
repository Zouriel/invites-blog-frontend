import { Component, Injectable, inject, input, signal } from '@angular/core';

export type UiToastTone = 'info' | 'success' | 'warning' | 'danger';

export interface UiToastOptions {
  message: string;
  title?: string;
  tone?: UiToastTone;
  /** Auto-dismiss after ms. Pass 0 to keep until dismissed. Default 4000. */
  duration?: number;
}

export interface UiToast extends Required<Omit<UiToastOptions, 'title'>> {
  id: number;
  title?: string;
}

let toastSeq = 0;

/**
 * `UiToastService` — enqueue transient notifications. Render once with
 * `<ui-toast-host />` near the app root.
 */
@Injectable({ providedIn: 'root' })
export class UiToastService {
  readonly toasts = signal<UiToast[]>([]);

  show(opts: UiToastOptions): number {
    const id = ++toastSeq;
    const toast: UiToast = {
      id,
      message: opts.message,
      title: opts.title,
      tone: opts.tone ?? 'info',
      duration: opts.duration ?? 4000,
    };
    this.toasts.update((list) => [...list, toast]);
    if (toast.duration > 0) {
      setTimeout(() => this.dismiss(id), toast.duration);
    }
    return id;
  }

  info(message: string, title?: string) { return this.show({ message, title, tone: 'info' }); }
  success(message: string, title?: string) { return this.show({ message, title, tone: 'success' }); }
  warning(message: string, title?: string) { return this.show({ message, title, tone: 'warning' }); }
  danger(message: string, title?: string) { return this.show({ message, title, tone: 'danger' }); }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}

/** `ui-toast-host` — fixed-corner renderer for queued toasts. */
@Component({
  selector: 'ui-toast-host',
  template: `
    <div class="host" [attr.data-position]="position()" aria-live="polite" aria-atomic="false">
      @for (t of toasts.toasts(); track t.id) {
        <div
          class="toast"
          [attr.data-tone]="t.tone"
          [attr.role]="t.tone === 'danger' || t.tone === 'warning' ? 'alert' : 'status'"
          animate.enter="ui-slide-left-enter"
          animate.leave="ui-fade-leave">
          <span class="icon" aria-hidden="true">{{ glyph[t.tone] }}</span>
          <div class="content">
            @if (t.title) { <strong class="title">{{ t.title }}</strong> }
            <span class="msg">{{ t.message }}</span>
          </div>
          <button class="x" type="button" aria-label="Dismiss" (click)="toasts.dismiss(t.id)">×</button>
        </div>
      }
    </div>
  `,
  styles: `
    .host {
      position: fixed; z-index: var(--ui-z-toast);
      display: flex; flex-direction: column; gap: var(--ui-space-2);
      padding: var(--ui-space-4); pointer-events: none;
      max-width: min(380px, 90vw);
    }
    .host[data-position="top-right"]    { top: 0; right: 0; }
    .host[data-position="top-left"]     { top: 0; left: 0; }
    .host[data-position="bottom-right"] { bottom: 0; right: 0; }
    .host[data-position="bottom-left"]  { bottom: 0; left: 0; }
    .toast {
      pointer-events: auto;
      display: flex; align-items: flex-start; gap: var(--ui-space-2);
      padding: var(--ui-space-2) var(--ui-space-3);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-left-width: 3px;
      border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default); font-size: var(--ui-font-size-md);
    }
    .toast[data-tone="info"]    { border-left-color: var(--ui-color-primary); }
    .toast[data-tone="success"] { border-left-color: var(--ui-color-success); }
    .toast[data-tone="warning"] { border-left-color: var(--ui-color-warning); }
    .toast[data-tone="danger"]  { border-left-color: var(--ui-color-danger); }
    .content { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .title { font-weight: 600; }
    .msg { color: var(--ui-color-text-muted); }
    .x { border: none; background: transparent; color: var(--ui-color-text-muted); cursor: pointer; font-size: 18px; line-height: 1; }
    .x:hover { color: var(--ui-color-text); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 4px; }
  `,
})
export class UiToastHost {
  protected readonly toasts = inject(UiToastService);
  position = input<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('bottom-right');
  protected readonly glyph: Record<UiToastTone, string> = {
    info: 'ℹ', success: '✓', warning: '⚠', danger: '✕',
  };
}
