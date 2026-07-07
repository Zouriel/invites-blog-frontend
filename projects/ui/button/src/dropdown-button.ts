import { CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition } from '@angular/cdk/overlay';
import { Component, inject, input, output, signal } from '@angular/core';
import { UI_CONFIG, type UiSize } from 'ui';
import type { UiButtonVariant } from './button';

export interface UiDropdownItem { label: string; value: string; disabled?: boolean; danger?: boolean; }

/** `ui-dropdown-button` — a button that opens a menu of actions (CDK Overlay). */
@Component({
  selector: 'ui-dropdown-button',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <button class="ddb" cdkOverlayOrigin #o="cdkOverlayOrigin" [attr.data-variant]="variant()" [attr.data-size]="size()"
            [class.no-radius]="!radius()" [disabled]="disabled()" aria-haspopup="menu" [attr.aria-expanded]="open()" (click)="open.set(!open())">
      <ng-content /><span class="caret" aria-hidden="true">▾</span>
    </button>
    <ng-template cdkConnectedOverlay [cdkConnectedOverlayOrigin]="o" [cdkConnectedOverlayOpen]="open()"
                 [cdkConnectedOverlayPositions]="positions" (overlayOutsideClick)="open.set(false)">
      <div class="menu" role="menu">
        @for (item of items(); track item.value) {
          <button type="button" role="menuitem" class="mi" [class.danger]="item.danger" [disabled]="item.disabled" (click)="choose(item)">{{ item.label }}</button>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: inline-flex; }
    .ddb { display: inline-flex; align-items: center; gap: var(--ui-space-2); height: var(--ui-size-md); padding: 0 var(--ui-space-4);
      background: var(--ui-color-surface); color: var(--ui-color-text); border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius); font-family: var(--ui-font-default); font-size: 14px; cursor: pointer; }
    .ddb:hover:not(:disabled) { background: var(--ui-color-surface-raised); }
    .ddb:disabled { opacity: 0.5; cursor: not-allowed; }
    .ddb:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ddb.no-radius { border-radius: 0; }
    .ddb[data-variant="primary"] { background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); border-color: transparent; }
    .ddb[data-variant="primary"]:hover:not(:disabled) { background: var(--ui-color-primary-hover); }
    .ddb[data-size="sm"] { height: var(--ui-size-sm); font-size: 13px; padding: 0 var(--ui-space-3); }
    .ddb[data-size="lg"] { height: var(--ui-size-lg); font-size: 15px; }
    .caret { font-size: 10px; }
    .menu { display: flex; flex-direction: column; min-width: 170px; margin-top: var(--ui-space-1); padding: var(--ui-space-1);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-2); }
    .mi { padding: var(--ui-space-2) var(--ui-space-3); background: none; border: none; border-radius: 6px; text-align: left;
      cursor: pointer; color: var(--ui-color-text); font: inherit; font-family: var(--ui-font-default); font-size: var(--ui-font-size-md); }
    .mi:hover:not(:disabled) { background: color-mix(in srgb, var(--ui-color-primary) 18%, transparent); }
    .mi.danger { color: var(--ui-color-danger); }
    .mi:disabled { opacity: 0.5; cursor: not-allowed; }
  `,
})
export class UiDropdownButton {
  private config = inject(UI_CONFIG);
  items = input<UiDropdownItem[]>([]);
  variant = input<UiButtonVariant>('secondary');
  size = input<UiSize>('md');
  disabled = input(false);
  radius = input<boolean>(this.config.radius);
  select = output<UiDropdownItem>();
  protected readonly open = signal(false);
  protected readonly positions: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
  ];
  protected choose(item: UiDropdownItem): void {
    if (item.disabled) return;
    this.select.emit(item);
    this.open.set(false);
  }
}
