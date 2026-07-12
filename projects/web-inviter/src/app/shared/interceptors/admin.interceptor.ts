import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UiToastService } from 'ui/dialog';
import { AdminStore } from '../services/admin.store';

/**
 * Functional interceptor. Attaches the admin JWT as a Bearer header to any request whose URL targets
 * `/api/admin/…` (except the login endpoint, which mints the token). If such a request comes back
 * 401 — the token expired or was rejected — it ends the staff session: clears the token, warns, and
 * redirects to the admin login page.
 */
export const adminInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AdminStore);
  const router = inject(Router);
  const toast = inject(UiToastService);

  const isAdminApi = req.url.includes('/api/admin/') && !req.url.includes('/api/admin/login');
  if (!isAdminApi) {
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
        toast.danger('Your staff session expired. Please sign in again.');
        void router.navigate(['/admin/login']);
      }
      return throwError(() => err);
    }),
  );
};
