import { Component, input, output } from '@angular/core';

/**
 * `ui-backdrop` — full-viewport scrim behind overlays. Emits `(backdropClick)`.
 * Render conditionally with `@if`; it animates via the shared backdrop fade.
 */
@Component({
  selector: 'ui-backdrop',
  template: `
    <div
      class="ui-backdrop"
      [class.blur]="blur()"
      (click)="backdropClick.emit()"
      animate.enter="ui-backdrop-enter"
      animate.leave="ui-backdrop-leave"></div>
  `,
  styles: `
    .ui-backdrop { position: fixed; inset: 0; z-index: var(--ui-z-overlay); background: rgba(0, 0, 0, 0.55); }
    .ui-backdrop.blur { backdrop-filter: blur(3px); }
  `,
})
export class UiBackdrop {
  blur = input(false);
  backdropClick = output<void>();
}
