import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionStore } from '../services/session.store';

/** Any signed-in account. */
export const signedInGuard: CanActivateFn = (_route, state) => {
  const store = inject(SessionStore);
  const router = inject(Router);

  return store.isSessionValid()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { next: state.url } });
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
