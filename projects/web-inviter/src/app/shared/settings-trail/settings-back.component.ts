import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { BackLinkComponent } from '../back-link/back-link.component';
import { SettingsTrail } from './settings-trail';

/** "‹ Settings", on a page opened from the gear's menu; nothing when the page was reached another way. */
@Component({
  selector: 'app-settings-back',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackLinkComponent],
  template: `
    @if (trail.active()) {
      <app-back-link link="/me/settings" label="Settings" />
    }
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class SettingsBackComponent {
  protected readonly trail = inject(SettingsTrail);
}
