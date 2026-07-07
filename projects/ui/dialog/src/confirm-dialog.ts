import { Component, input, model, output } from '@angular/core';
import { UiButton } from 'ui/button';
import { UiModal } from './modal';

/**
 * `ui-confirm-dialog` — a focused confirm/cancel prompt built on `ui-modal`.
 * Bind `[(open)]` and listen to `(confirm)` / `(cancel)`.
 */
@Component({
  selector: 'ui-confirm-dialog',
  imports: [UiModal, UiButton],
  template: `
    <ui-modal [(open)]="open" [title]="title()" size="sm">
      <p class="msg">{{ message() }}</p>
      <div modal-footer class="actions">
        <ui-button variant="outline" size="sm" (click)="cancelClick()">{{ cancelLabel() }}</ui-button>
        <ui-button [variant]="destructive() ? 'destructive' : 'primary'" size="sm" (click)="confirmClick()">
          {{ confirmLabel() }}
        </ui-button>
      </div>
    </ui-modal>
  `,
  styles: `
    .msg { margin: 0; color: var(--ui-color-text-muted); font-family: var(--ui-font-default); }
    .actions { display: flex; width: 100%; justify-content: space-between; gap: var(--ui-space-4); }
  `,
})
export class UiConfirmDialog {
  open = model(false);
  title = input('Are you sure?');
  message = input('');
  confirmLabel = input('Confirm');
  cancelLabel = input('Cancel');
  destructive = input(false);
  confirm = output<void>();
  cancel = output<void>();

  protected confirmClick(): void {
    this.confirm.emit();
    this.open.set(false);
  }
  protected cancelClick(): void {
    this.cancel.emit();
    this.open.set(false);
  }
}
