import { HttpInterceptorFn } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';

/**
 * Where the API is while pages are prerendered at build time. The app calls the API by relative
 * path because in production it shares the site's origin, but a build has no origin to be relative
 * to. Defaults to the live site, so a build prerenders with real designs; set PRERENDER_API_ORIGIN
 * to point a build somewhere else.
 */
export const PRERENDER_API_ORIGIN: string =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    'PRERENDER_API_ORIGIN'
  ] || 'https://invites.blog';

/**
 * The address the prerendered pages will be served from. Responses fetched while prerendering are
 * embedded in the page under their URL, and the browser only reuses one (instead of fetching it
 * again and redrawing) when it asks for the same URL. Defaults to the live site.
 */
export const PRERENDER_PUBLIC_ORIGIN: string =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[
    'PRERENDER_PUBLIC_ORIGIN'
  ] || 'https://invites.blog';

/** Provided only in the server config. */
export const SERVER_API_ORIGIN = new InjectionToken<string>('SERVER_API_ORIGIN');

/**
 * Turns a relative API path into a full URL: the API's address while prerendering, the page's own
 * origin in the browser. Both sides then name a request the same way, which is what lets the
 * browser pick up the prerendered response.
 */
export const serverApiOriginInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/')) return next(req);
  const origin =
    inject(SERVER_API_ORIGIN, { optional: true }) ??
    (typeof location !== 'undefined' ? location.origin : null);
  return origin ? next(req.clone({ url: origin + req.url })) : next(req);
};
