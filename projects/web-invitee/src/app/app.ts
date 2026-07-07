import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastHost } from 'ui/dialog';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, UiToastHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <ui-toast-host />
  `,
})
export class App {}
