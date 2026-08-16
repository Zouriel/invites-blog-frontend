import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { DesignerStore } from '../services/designer.store';

/**
 * Functional guard. Allows navigation when a designer session is present, otherwise redirects to the
 * designer sign-in page. Mirrors `adminGuard`, against the separate designer session.
 */
export const designerGuard: CanActivateFn = () => {
  const store = inject(DesignerStore);
  const router = inject(Router);

  return store.isSessionValid() ? true : router.createUrlTree(['/designer/login']);
};
