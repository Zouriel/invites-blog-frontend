import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UiToastHost } from 'ui/dialog';
import { UiScrollProgress } from 'ui/fx';
import { HeaderComponent } from './layout/header/header.component';
import { FooterComponent } from './layout/footer/footer.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, UiToastHost, UiScrollProgress],
  template: `
    <ui-scroll-progress />
    <app-header />
    <main class="app-main">
      <router-outlet />
    </main>
    <app-footer />
    <ui-toast-host position="bottom-right" />
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        min-height: 100dvh;
      }
      .app-main {
        flex: 1;
      }
    `,
  ],
})
export class App {}
