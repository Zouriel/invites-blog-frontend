import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { catchError, firstValueFrom, of, timeout } from 'rxjs';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideUiConfig } from '@zouriel/ui';

import { routes } from './app.routes';
import { handleStaleBuildNavigationError } from './shared/utils/stale-build';
import { campaignTokenInterceptor } from './shared/interceptors/campaign-token.interceptor';
import { sessionInterceptor } from './shared/interceptors/session.interceptor';
import { serverApiOriginInterceptor } from './shared/prerender/server-api-origin';
import { ApiService } from './shared/api/api.service';
import { setCatalog } from './shared/utils/plans';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
      // A tab opened before the last deploy asks for lazy chunks that no longer exist;
      // without this the click silently does nothing.
      withNavigationErrorHandler(handleStaleBuildNavigationError),
    ),
    provideHttpClient(
      withInterceptors([campaignTokenInterceptor, sessionInterceptor, serverApiOriginInterceptor]),
    ),
    // The public pages arrive prerendered; hydration picks them up instead of drawing them again.
    provideClientHydration(withEventReplay()),
    // glass: false — the frosted treatment puts a translucent panel over whatever is behind it, and
    // over a photograph (a confirm dialog on the dashboard, sitting above the photo grid) the text
    // became unreadable. A dialog asking whether to cancel a campaign is the last place to be
    // guessing at the words. Set through the library's own config rather than overridden in CSS, so
    // every surface it governs — modals, drawers, cards, the navbar — agrees.
    provideUiConfig({ glass: false, radius: true }),
    // The prices in force, before anything states one: an admin can change them without a release.
    // Prerendering fetches them from the live API and hands them to the browser in the transfer
    // state, so a prerendered page doesn't wait. If the API is slow or down, the prices in code stand.
    provideAppInitializer(() =>
      firstValueFrom(
        inject(ApiService).plans().pipe(timeout(3000), catchError(() => of(null))),
      ).then((c) => setCatalog(c)),
    ),
  ],
};
