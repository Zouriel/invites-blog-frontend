import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../services/session.store';
import { TokenStore } from '../services/token.store';
import { FeatureStore } from '../services/feature.store';

/** Any signed-in account. */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);

  return store.isSessionValid()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/**
 * A page of one campaign that its creator may open without an account: the wizard steps.
 *
 * <p>These can't simply require a session. A possession token — the one creation handed back, kept
 * in TokenStore, or a `?resume=` link from the "continue later" email — authorises them for somebody
 * who never signed in. But a visitor with neither a session nor a token has nothing the server will
 * accept, and used to land on a page of half-drawn failures. Send only them to sign in.</p>
 */
export const campaignAccessGuard: CanActivateFn = (route, state) => {
  const campaignId = route.paramMap.get('campaignId');
  if (inject(SessionStore).isSessionValid()) return true;
  if (route.queryParamMap.get('resume')) return true;
  if (campaignId && inject(TokenStore).get(campaignId)) return true;
  return inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });
};

/**
 * A role-gated route. Someone signed in but lacking the role is sent home rather than to the login
 * page — bouncing them to sign in again would imply the session was the problem when it wasn't.
 */
export function roleGuard(...allowed: string[]): CanActivateFn {
  return (_route, state) => {
    const store = inject(SessionStore);
    const router = inject(Router);

    if (!store.isSessionValid()) {
      return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
    }
    return allowed.some((role) => store.roles().includes(role)) ? true : router.createUrlTree(['/']);
  };
}

/**
 * A feature still being tested: signed in AND on the testers list for it (or released, or an admin).
 * Anyone else goes home — the feature isn't something they're missing a sign-in for.
 */
export function featureGuard(feature: string): CanActivateFn {
  return async (_route, state) => {
    const store = inject(SessionStore);
    const router = inject(Router);
    const features = inject(FeatureStore);
    if (!store.isSessionValid()) return router.createUrlTree(['/login'], { queryParams: { next: state.url } });
    await features.ready();
    return features.has(feature) ? true : router.createUrlTree(['/my-templates']);
  };
}
