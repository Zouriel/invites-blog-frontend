import { Component, input } from '@angular/core';

/**
 * `ui-avatar-group` — overlapping stack of avatars. Project `ui-avatar`
 * elements; they overlap by the `--ui-avatar-overlap` amount.
 */
@Component({
  selector: 'ui-avatar-group',
  template: `<div class="grp" role="group"><ng-content /></div>`,
  styles: `
    :host { display: inline-flex; }
    .grp { display: inline-flex; }
    .grp ::ng-deep ui-avatar:not(:first-child) { margin-left: calc(-1 * var(--ui-space-3)); }
    .grp ::ng-deep ui-avatar .ui-avatar { box-shadow: 0 0 0 2px var(--ui-color-bg); }
  `,
})
export class UiAvatarGroup {
  /** Maximum avatars before collapsing (consumer-managed; informational). */
  max = input<number>();
}
