import {
  CdkConnectedOverlay, CdkOverlayOrigin, ConnectedPosition,
} from '@angular/cdk/overlay';
import { Component, inject, input, model } from '@angular/core';
import { UI_CONFIG } from 'ui';

export type UiPopoverPlacement = 'bottom' | 'top' | 'bottom-start' | 'bottom-end';

/**
 * `ui-popover` — click-triggered floating panel anchored to its trigger via the
 * CDK Overlay. Project the trigger with `[popover-trigger]` and the panel body
 * as default content. Dismisses on outside click and Escape.
 */
@Component({
  selector: 'ui-popover',
  imports: [CdkOverlayOrigin, CdkConnectedOverlay],
  template: `
    <span
      class="trigger"
      cdkOverlayOrigin
      #origin="cdkOverlayOrigin"
      (click)="toggle()">
      <ng-content select="[popover-trigger]" />
    </span>

    <ng-template
      cdkConnectedOverlay
      [cdkConnectedOverlayOrigin]="origin"
      [cdkConnectedOverlayOpen]="open()"
      [cdkConnectedOverlayPositions]="positions"
      [cdkConnectedOverlayHasBackdrop]="false"
      (overlayOutsideClick)="open.set(false)"
      (detach)="open.set(false)">
      <div
        class="ui-popover"
        [class.glass]="glass()"
        [class.no-radius]="!radius()"
        role="dialog"
        (keydown.escape)="open.set(false)"
        animate.enter="ui-scale-enter"
        animate.leave="ui-scale-leave">
        <ng-content />
      </div>
    </ng-template>
  `,
  styles: `
    .trigger { display: inline-flex; }
    .ui-popover {
      min-width: 180px; max-width: 320px;
      margin-top: var(--ui-space-2);
      padding: var(--ui-space-3);
      background: var(--ui-color-surface-raised); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      box-shadow: var(--ui-shadow-2);
      font-family: var(--ui-font-default);
    }
    .ui-popover.no-radius { border-radius: 0; }
    .ui-popover.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
  `,
})
export class UiPopover {
  private config = inject(UI_CONFIG);
  open = model(false);
  placement = input<UiPopoverPlacement>('bottom-start');
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected get positions(): ConnectedPosition[] {
    const map: Record<UiPopoverPlacement, ConnectedPosition> = {
      'bottom':       { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top' },
      'bottom-start': { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
      'bottom-end':   { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
      'top':          { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom' },
    };
    const primary = map[this.placement()];
    return [primary, map['top']];
  }
}
