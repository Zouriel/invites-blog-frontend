import { HTTP_TRANSFER_CACHE_ORIGIN_MAP } from '@angular/common/http';
import { ApplicationConfig, mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';
import {
  PRERENDER_API_ORIGIN,
  PRERENDER_PUBLIC_ORIGIN,
  SERVER_API_ORIGIN,
} from './shared/prerender/server-api-origin';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    { provide: SERVER_API_ORIGIN, useValue: PRERENDER_API_ORIGIN },
    // Store responses under the address the browser will use, even when built against another API.
    {
      provide: HTTP_TRANSFER_CACHE_ORIGIN_MAP,
      useValue: { [PRERENDER_API_ORIGIN]: PRERENDER_PUBLIC_ORIGIN },
    },
  ],
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
