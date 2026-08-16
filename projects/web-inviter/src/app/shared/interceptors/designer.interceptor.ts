import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UiToastService } from 'ui/dialog';
import { DesignerStore } from '../services/designer.store';

/**
 * Attaches the designer JWT to any `/api/designer/…` request except the auth endpoints, which mint
 * the token. A 401 back from such a request ends the designer session and returns them to sign-in.
 * Mirrors `adminInterceptor` for the separate designer session.
 */
export const designerInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(DesignerStore);
  const router = inject(Router);
  const toast = inject(UiToastService);

  const isDesignerApi =
    req.url.includes('/api/designer/') && !req.url.includes('/api/designer/auth/');
  if (!isDesignerApi) {
    return next(req);
  }

  const token = store.get();
  const request =
    token && !req.headers.has('Authorization')
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(request).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        store.clear();
        toast.danger('Your designer session expired. Please sign in again.');
        void router.navigate(['/designer/login']);
      }
      return throwError(() => err);
    }),
  );
};
