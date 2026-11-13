import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../../environments/environment';

/**
 * Since 2026-11-13 the site is two hosts:
 * - **invites.blog**, the public site: the landing page, Plans, guides, the policies, design pages, and
 *   what printed QR cards open (`/q/…`). Prerendered and indexed.
 * - **app.invites.blog**, the signed-in web app: feed, inbox, new event, dashboards, the designer,
 *   billing, settings, sign-in, admin. No landing page: `/` opens the feed.
 *
 * One build serves both. Caddy sends a full page load of an app address on invites.blog to the same
 * address on app.invites.blog (302); this decides the same thing for a click inside the page, which
 * never reaches Caddy. Both lists must agree: deploy repo `Caddyfile.d/invites-blog.caddy`, matcher
 * `@app_paths`.
 */
export type HostConfig = {
  /** https://invites.blog, or '' when one host serves everything (staging, local development). */
  siteOrigin: string;
  /** https://app.invites.blog, or ''. */
  appOrigin: string;
};

export const HOST_CONFIG = new InjectionToken<HostConfig>('HOST_CONFIG', {
  providedIn: 'root',
  factory: () => ({ siteOrigin: environment.siteOrigin, appOrigin: environment.appOrigin }),
});

/** The page's own address and the ways of leaving it: a seam, because leaving can't be undone in a test. */
export type BrowserLocation = {
  origin(): string;
  /** Path, query and fragment of the current address. */
  current(): string;
  assign(url: string): void;
  replace(url: string): void;
};

export const BROWSER_LOCATION = new InjectionToken<BrowserLocation>('BROWSER_LOCATION', {
  providedIn: 'root',
  factory: () => ({
    origin: () => window.location.origin,
    current: () => window.location.pathname + window.location.search + window.location.hash,
    assign: (url: string) => window.location.assign(url),
    replace: (url: string) => window.location.replace(url),
  }),
});

/** Addresses the public site serves itself. Everything else belongs to the app. */
const SITE_EXACT = new Set([
  '/',
  '/pricing',
  '/guide',
  '/bring-your-own',
  '/inquire',
  '/privacy',
  '/child-safety',
  '/delete-account',
  '/terms',
  '/refunds',
  '/security',
  '/contact',
  // The example event is a look around for visitors, so it works on both hosts.
  '/example-event',
  // Carrying a sign-in over to the app (SessionHandoff).
  '/handoff',
  // Google's sign-in popup returns here (the redirect URI registered with Google is on invites.blog),
  // and an Apple sign-in started before the move may still land here.
  '/oauth/callback',
  '/oauth/apple',
]);

/** Prefixes the public site serves: design pages, occasion pages, guides, and printed QR cards. */
const SITE_PREFIXES = ['/templates/', '/invitations/', '/guide/', '/q/'];

/** The path of an in-app URL, without query or fragment. */
export function pathOf(url: string): string {
  const path = url.split(/[?#]/)[0] || '/';
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

/** Whether invites.blog shows this page itself rather than sending it to app.invites.blog. */
export function isSitePath(url: string): boolean {
  const path = pathOf(url);
  return SITE_EXACT.has(path) || SITE_PREFIXES.some((p) => path.startsWith(p) && path.length > p.length);
}

/**
 * A `next` that is safe to go to: a path on this site (not `//elsewhere`, no backslashes or control
 * characters, which browsers quietly turn into another host). Null for anything else.
 */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || next.length > 2000) return null;
  if (!next.startsWith('/') || next.startsWith('//')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f\s]/.test(next)) return null;
  return next;
}

@Injectable({ providedIn: 'root' })
export class HostSplit {
  private readonly config = inject(HOST_CONFIG);
  private readonly location = inject(BROWSER_LOCATION);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Two hosts are configured (production). */
  readonly enabled = !!this.config.siteOrigin && !!this.config.appOrigin;

  /** This page is on the public site, invites.blog. Prerendering counts as the site: those pages are served there. */
  onSite(): boolean {
    if (!this.enabled) return false;
    return !this.browser || this.location.origin() === this.config.siteOrigin;
  }

  /** This page is on the web app's host, app.invites.blog. */
  onApp(): boolean {
    return this.enabled && this.browser && this.location.origin() === this.config.appOrigin;
  }

  /** An address in the web app: absolute when the app has its own host, else the path itself. */
  appUrl(path: string): string {
    return this.enabled ? this.config.appOrigin + path : path;
  }

  /** An address on the public site: absolute when the site has its own host, else the path itself. */
  siteUrl(path: string): string {
    return this.enabled ? this.config.siteOrigin + path : path;
  }

  /**
   * Where the site's API calls that must reach invites.blog go from the app's host: Sign in with Apple's
   * start and redeem, whose cookies live on the host Apple returns to. '' (same origin) otherwise.
   */
  siteApiOrigin(): string {
    return this.onApp() ? this.config.siteOrigin : '';
  }

  /** Origins whose pages may post a sign-in result to this one (the Google popup's return page). */
  trustedOrigins(): string[] {
    const own = this.browser ? this.location.origin() : '';
    return [...new Set([own, ...(this.enabled ? [this.config.siteOrigin, this.config.appOrigin] : [])].filter(Boolean))];
  }
}
