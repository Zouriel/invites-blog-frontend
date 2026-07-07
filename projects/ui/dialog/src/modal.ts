import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, effect, inject, input, model } from '@angular/core';
import { UI_CONFIG } from 'ui';

let modalSeq = 0;

/**
 * `ui-modal` — centered dialog with backdrop. Traps focus (CDK a11y), locks
 * body scroll while open, closes on Escape / backdrop click, and animates with
 * the shared scale + backdrop-fade animations.
 */
@Component({
  selector: 'ui-modal',
  imports: [CdkTrapFocus],
  template: `
    @if (open()) {
      <div class="backdrop" animate.enter="ui-backdrop-enter" animate.leave="ui-backdrop-leave" (click)="onBackdrop()"></div>
      <div
        class="panel-wrap"
        (keydown.escape)="onEscape()">
        <div
          class="panel"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          [class.glass]="glass()"
          [class.no-radius]="!radius()"
          [attr.data-size]="size()"
          role="dialog"
          aria-modal="true"
          [attr.aria-labelledby]="title() ? labelId : null"
          animate.enter="ui-scale-enter"
          animate.leave="ui-scale-leave"
          (click)="$event.stopPropagation()">
          @if (title()) {
            <header class="hd">
              <span [id]="labelId" class="title">{{ title() }}</span>
              <button class="x" type="button" aria-label="Close" (click)="open.set(false)">×</button>
            </header>
          }
          <div class="bd"><ng-content /></div>
          <footer class="ft"><ng-content select="[modal-footer]" /></footer>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed; inset: 0; z-index: var(--ui-z-overlay);
      background: rgba(0,0,0,0.55);
    }
    .panel-wrap {
      position: fixed; inset: 0; z-index: var(--ui-z-overlay);
      display: flex; align-items: center; justify-content: center;
      padding: var(--ui-space-4); pointer-events: none;
    }
    .panel {
      pointer-events: auto;
      width: 100%; max-width: 480px; max-height: 85vh; overflow: auto;
      display: flex; flex-direction: column;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-3); font-family: var(--ui-font-default);
    }
    .panel[data-size="sm"] { max-width: 360px; }
    .panel[data-size="lg"] { max-width: 720px; }
    .panel.no-radius { border-radius: 0; }
    .panel.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .hd { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); padding: var(--ui-space-3) var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border); }
    .title { font-weight: 600; font-size: var(--ui-font-size-lg); }
    .bd { padding: var(--ui-space-4); display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .ft { padding: var(--ui-space-3) var(--ui-space-4); border-top: 1px solid var(--ui-color-border); display: flex; gap: var(--ui-space-2); justify-content: flex-end; }
    .ft:empty { display: none; }
    .x { border: none; background: transparent; color: var(--ui-color-text-muted); font-size: 22px; line-height: 1; cursor: pointer; }
    .x:hover { color: var(--ui-color-text); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 6px; }
  `,
})
export class UiModal {
  private config = inject(UI_CONFIG);
  private doc = inject(DOCUMENT);
  open = model(false);
  title = input<string>();
  size = input<'sm' | 'md' | 'lg'>('md');
  closeOnBackdrop = input(true);
  closeOnEscape = input(true);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  protected readonly labelId = `ui-modal-${modalSeq++}`;

  constructor() {
    effect(() => {
      const body = this.doc.body;
      if (!body) return;
      body.style.overflow = this.open() ? 'hidden' : '';
    });
  }

  protected onBackdrop(): void {
    if (this.closeOnBackdrop()) this.open.set(false);
  }
  protected onEscape(): void {
    if (this.closeOnEscape()) this.open.set(false);
  }
}
