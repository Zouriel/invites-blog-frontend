import { PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateChildFn, Router } from '@angular/router';
import { HostSplit, isSitePath, pathOf } from '../services/host-split';
import { SessionHandoffService } from '../services/session-handoff.service';

/**
 * Keeps each page on its host (HostSplit). On invites.blog an app page opens on app.invites.blog,
 * with the sign-in taken along; on app.invites.blog the landing page isn't there, so `/` is the feed
 * (which asks someone signed out to sign in). A full page load of an app address on invites.blog never
 * gets this far: Caddy redirects it first.
 */
export const hostGuard: CanActivateChildFn = (_route, state) => {
  if (!isPlatformBrowser(inject(PLATFORM_ID))) return true;
  const split = inject(HostSplit);
  if (split.onSite() && !isSitePath(state.url)) {
    void inject(SessionHandoffService).goToApp(state.url);
    return false;
  }
  if (split.onApp() && pathOf(state.url) === '/') {
    const tree = inject(Router).parseUrl(state.url);
    return inject(Router).createUrlTree(['/feed'], { queryParams: tree.queryParams });
  }
  return true;
};
