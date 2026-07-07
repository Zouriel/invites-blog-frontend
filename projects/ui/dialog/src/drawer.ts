import { CdkTrapFocus } from '@angular/cdk/a11y';
import { DOCUMENT } from '@angular/common';
import { Component, computed, effect, inject, input, model } from '@angular/core';
import { UI_CONFIG } from 'ui';

export type UiDrawerSide = 'left' | 'right' | 'top' | 'bottom';

let drawerSeq = 0;

/**
 * `ui-drawer` — edge-anchored sheet. Slides in from `side`, traps focus, locks
 * scroll, and dismisses on Escape / backdrop click.
 */
@Component({
  selector: 'ui-drawer',
  imports: [CdkTrapFocus],
  template: `
    @if (open()) {
      <div class="backdrop" animate.enter="ui-backdrop-enter" animate.leave="ui-backdrop-leave" (click)="onBackdrop()"></div>
      <div
        class="panel"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        [attr.data-side]="side()"
        [class.glass]="glass()"
        [style.--ui-slide-from]="slideFrom()"
        role="dialog"
        aria-modal="true"
        [attr.aria-labelledby]="title() ? labelId : null"
        (keydown.escape)="onEscape()"
        animate.enter="ui-sheet-enter"
        animate.leave="ui-sheet-leave">
        @if (title()) {
          <header class="hd">
            <span [id]="labelId" class="title">{{ title() }}</span>
            <button class="x" type="button" aria-label="Close" (click)="open.set(false)">×</button>
          </header>
        }
        <div class="bd"><ng-content /></div>
      </div>
    }
  `,
  styles: `
    .backdrop { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: rgba(0,0,0,0.55); }
    .panel {
      position: fixed; z-index: var(--ui-z-overlay);
      display: flex; flex-direction: column;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border);
      box-shadow: var(--ui-shadow-3); font-family: var(--ui-font-default);
    }
    .panel.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .panel[data-side="left"]   { top: 0; left: 0; bottom: 0; width: min(360px, 90vw); border-radius: 0 var(--ui-radius) var(--ui-radius) 0; }
    .panel[data-side="right"]  { top: 0; right: 0; bottom: 0; width: min(360px, 90vw); border-radius: var(--ui-radius) 0 0 var(--ui-radius); }
    .panel[data-side="top"]    { top: 0; left: 0; right: 0; height: min(320px, 80vh); border-radius: 0 0 var(--ui-radius) var(--ui-radius); }
    .panel[data-side="bottom"] { bottom: 0; left: 0; right: 0; height: min(320px, 80vh); border-radius: var(--ui-radius) var(--ui-radius) 0 0; }
    .hd { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3); padding: var(--ui-space-4); border-bottom: 1px solid var(--ui-color-border); }
    .title { font-weight: 600; font-size: var(--ui-font-size-lg); }
    .bd { padding: var(--ui-space-4); overflow: auto; flex: 1; }
    .x { border: none; background: transparent; color: var(--ui-color-text-muted); font-size: 22px; line-height: 1; cursor: pointer; }
    .x:hover { color: var(--ui-color-text); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 6px; }
  `,
})
export class UiDrawer {
  private config = inject(UI_CONFIG);
  private doc = inject(DOCUMENT);
  open = model(false);
  side = input<UiDrawerSide>('right');
  title = input<string>();
  closeOnBackdrop = input(true);
  closeOnEscape = input(true);
  glass = input<boolean>(this.config.glass);
  protected readonly labelId = `ui-drawer-${drawerSeq++}`;

  protected readonly slideFrom = computed(() => {
    switch (this.side()) {
      case 'left': return 'translateX(-100%)';
      case 'right': return 'translateX(100%)';
      case 'top': return 'translateY(-100%)';
      case 'bottom': return 'translateY(100%)';
    }
  });

  constructor() {
    effect(() => {
      const body = this.doc.body;
      if (body) body.style.overflow = this.open() ? 'hidden' : '';
    });
  }

  protected onBackdrop(): void { if (this.closeOnBackdrop()) this.open.set(false); }
  protected onEscape(): void { if (this.closeOnEscape()) this.open.set(false); }
}
