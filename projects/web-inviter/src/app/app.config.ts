import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideUiConfig } from 'ui';

import { routes } from './app.routes';
import { campaignTokenInterceptor } from './shared/interceptors/campaign-token.interceptor';
import { adminInterceptor } from './shared/interceptors/admin.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withInterceptors([campaignTokenInterceptor, adminInterceptor])),
    provideUiConfig({ glass: true, radius: true }),
  ],
};
