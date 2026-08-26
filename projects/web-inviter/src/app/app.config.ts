import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideUiConfig } from '@zouriel/ui';

import { routes } from './app.routes';
import { handleStaleBuildNavigationError } from './shared/utils/stale-build';
import { campaignTokenInterceptor } from './shared/interceptors/campaign-token.interceptor';
import { sessionInterceptor } from './shared/interceptors/session.interceptor';

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
    provideHttpClient(withInterceptors([campaignTokenInterceptor, sessionInterceptor])),
    // glass: false — the frosted treatment puts a translucent panel over whatever is behind it, and
    // over a photograph (a confirm dialog on the dashboard, sitting above the photo grid) the text
    // became unreadable. A dialog asking whether to cancel a campaign is the last place to be
    // guessing at the words. Set through the library's own config rather than overridden in CSS, so
    // every surface it governs — modals, drawers, cards, the navbar — agrees.
    provideUiConfig({ glass: false, radius: true }),
  ],
};
