import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TokenStore } from '../services/token-store.service';

/** Guards the inbox: no jwt → bounce to /login (returning to /inbox after). */
export const inboxGuard: CanActivateFn = () => {
  const tokens = inject(TokenStore);
  const router = inject(Router);
  if (tokens.isAuthenticated) {
    return true;
  }
  return router.createUrlTree(['/login'], {
    queryParams: { returnTo: '/inbox' },
  });
};
