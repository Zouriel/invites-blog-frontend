import { Component, input } from '@angular/core';

/** `ui-aspect-ratio` — constrains projected content to a fixed width:height ratio. */
@Component({
  selector: 'ui-aspect-ratio',
  template: `<div class="ar" [style.aspect-ratio]="ratio()"><ng-content /></div>`,
  styles: `
    :host { display: block; }
    .ar { width: 100%; overflow: hidden; border-radius: inherit; }
    .ar ::ng-deep > * { width: 100%; height: 100%; object-fit: cover; display: block; }
  `,
})
export class UiAspectRatio {
  /** e.g. '16 / 9', '4 / 3', '1 / 1'. */
  ratio = input('16 / 9');
}
