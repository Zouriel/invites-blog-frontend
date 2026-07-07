import { Component, model } from '@angular/core';
import type { UiTheme } from './ui-theme.service';

/**
 * Scoped theme boundary. Wrap any subtree to override the theme for just that
 * region — the token custom properties cascade to descendants. Uses
 * `display: contents` so it never introduces layout of its own.
 *
 *   <ui-theme-provider theme="light"> ... </ui-theme-provider>
 */
@Component({
  selector: 'ui-theme-provider',
  template: `<ng-content />`,
  host: { '[attr.data-theme]': 'theme()' },
  styles: `:host { display: contents; }`,
})
export class UiThemeProvider {
  theme = model<UiTheme>('dark');
}
