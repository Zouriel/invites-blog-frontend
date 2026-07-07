import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, output, input, signal } from '@angular/core';

export interface UiMenubarItem { label: string; value: string; disabled?: boolean; }
export interface UiMenubarMenu { label: string; items: UiMenubarItem[]; }

/** `ui-menubar` — application-style horizontal menu bar with dropdown menus (one open at a time). */
@Component({
  selector: 'ui-menubar',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <div class="mb" role="menubar">
      @for (menu of menus(); track menu.label; let i = $index) {
        <button type="button" class="top" role="menuitem" cdkOverlayOrigin #o="cdkOverlayOrigin"
                [class.open]="openIndex() === i" (click)="toggle(i)" (mouseenter)="hoverOpen(i)">
          {{ menu.label }}
        </button>
        <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="o" [cdkConnectedOverlayOpen]="openIndex() === i"
                     [cdkConnectedOverlayPositions]="positions" (overlayOutsideClick)="openIndex.set(null)">
          <div class="panel" role="menu">
            @for (item of menu.items; track item.value) {
              <button type="button" role="menuitem" class="mi" [disabled]="item.disabled" (click)="choose(item)">{{ item.label }}</button>
            }
          </div>
        </ng-template>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .mb { display: flex; gap: 2px; background: var(--ui-color-surface); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); padding: 2px; font-family: var(--ui-font-default); }
    .top { padding: var(--ui-space-1) var(--ui-space-3); background: none; border: none; border-radius: 5px; cursor: pointer;
      color: var(--ui-color-text); font: inherit; font-size: var(--ui-font-size-sm); }
    .top:hover, .top.open { background: var(--ui-color-surface-raised); }
    .top:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .panel { display: flex; flex-direction: column; min-width: 160px; margin-top: 4px; padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2); }
    .mi { padding: var(--ui-space-2) var(--ui-space-3); background: none; border: none; border-radius: 6px; text-align: left;
      cursor: pointer; color: var(--ui-color-text); font: inherit; font-size: var(--ui-font-size-md); }
    .mi:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    .mi:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class UiMenubar {
  menus = input<UiMenubarMenu[]>([]);
  select = output<UiMenubarItem>();
  protected readonly openIndex = signal<number | null>(null);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
  ];

  protected toggle(i: number): void { this.openIndex.update((cur) => (cur === i ? null : i)); }
  protected hoverOpen(i: number): void { if (this.openIndex() !== null) this.openIndex.set(i); }
  protected choose(item: UiMenubarItem): void {
    if (item.disabled) return;
    this.select.emit(item);
    this.openIndex.set(null);
  }
}
