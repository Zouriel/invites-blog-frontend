import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withNavigationErrorHandler,
} from '@angular/router';
import { provideUiConfig } from '@zouriel/ui';

import { routes } from './app.routes';
import { handleStaleBuildNavigationError } from './shared/utils/stale-build';
import { jwtInterceptor } from './shared/interceptors/jwt.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top' }),
      // A tab opened before the last deploy asks for lazy chunks that no longer exist;
      // without this the click silently does nothing.
      withNavigationErrorHandler(handleStaleBuildNavigationError),
    ),
    provideHttpClient(withInterceptors([jwtInterceptor])),
    provideUiConfig({ glass: false, radius: true }),
  ],
};
