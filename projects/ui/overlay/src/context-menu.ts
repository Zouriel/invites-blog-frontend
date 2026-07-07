import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import {
  Component, Directive, OnDestroy, inject, input, output, signal,
} from '@angular/core';
import type { UiMenuItem } from './menu';

/** Internal panel rendered in the context-menu overlay. */
@Component({
  selector: 'ui-context-menu-panel',
  template: `
    <div class="cm" role="menu">
      @for (item of items(); track item.value) {
        <button type="button" role="menuitem" class="mi" [class.danger]="item.danger"
                [disabled]="item.disabled" (click)="pick(item)">{{ item.label }}</button>
      }
    </div>
  `,
  styles: `
    .cm { display: flex; flex-direction: column; min-width: 170px; padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); font-family: var(--ui-font-default);
      animation: ui-scale-in var(--ui-motion-fast) var(--ui-ease-standard); }
    .mi { padding: var(--ui-space-2) var(--ui-space-3); background: none; border: none; border-radius: 6px; text-align: left;
      cursor: pointer; color: var(--ui-color-text); font: inherit; font-size: var(--ui-font-size-md); }
    .mi:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    .mi.danger { color: var(--ui-color-danger); }
    .mi:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class UiContextMenuPanel {
  readonly items = signal<UiMenuItem[]>([]);
  onPick: (item: UiMenuItem) => void = () => {};
  protected pick(item: UiMenuItem): void {
    if (!item.disabled) this.onPick(item);
  }
}

/**
 * `uiContextMenu` — opens a menu at the pointer on right-click (CDK Overlay).
 * Bind the items and listen to `(contextSelect)`.
 */
@Directive({
  selector: '[uiContextMenu]',
  host: { '(contextmenu)': 'open($event)' },
})
export class UiContextMenu implements OnDestroy {
  private overlay = inject(Overlay);
  items = input<UiMenuItem[]>([], { alias: 'uiContextMenu' });
  contextSelect = output<UiMenuItem>();
  private ref: OverlayRef | null = null;

  protected open(e: MouseEvent): void {
    e.preventDefault();
    this.close();
    const positionStrategy = this.overlay.position().global()
      .left(`${e.clientX}px`).top(`${e.clientY}px`);
    this.ref = this.overlay.create({ positionStrategy, scrollStrategy: this.overlay.scrollStrategies.close() });
    const panel = this.ref.attach(new ComponentPortal(UiContextMenuPanel)).instance;
    panel.items.set(this.items());
    panel.onPick = (item) => { this.contextSelect.emit(item); this.close(); };
    setTimeout(() => this.ref?.outsidePointerEvents().subscribe(() => this.close()));
  }

  private close(): void {
    this.ref?.dispose();
    this.ref = null;
  }
  ngOnDestroy(): void { this.close(); }
}
