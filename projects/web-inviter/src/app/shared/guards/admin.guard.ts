import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminStore } from '../services/admin.store';

/**
 * Functional guard. Allows navigation when an admin token is present, otherwise
 * redirects to the admin login page.
 */
export const adminGuard: CanActivateFn = () => {
  const store = inject(AdminStore);
  const router = inject(Router);

  // isSessionValid() also rejects (and clears) an expired token, so a stale session redirects to login.
  if (store.isSessionValid()) {
    return true;
  }
  return router.createUrlTree(['/admin/login']);
};
