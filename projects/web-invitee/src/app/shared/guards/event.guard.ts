import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { TokenStore } from '../services/token-store.service';

/**
 * Guards the shared campaign link (/e/:campaignId): the invite is only shown after email OTP, so an
 * unauthenticated visitor is bounced to /login and returned to this exact link once verified.
 */
export const eventGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const tokens = inject(TokenStore);
  const router = inject(Router);
  if (tokens.isAuthenticated) {
    return true;
  }
  const campaignId = route.paramMap.get('campaignId') ?? '';
  return router.createUrlTree(['/login'], {
    queryParams: { returnTo: `/e/${campaignId}`, note: 'private-invite' },
  });
};
