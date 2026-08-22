import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UiToastService } from 'ui/dialog';
import { SessionStore } from '../services/session.store';

/**
 * Attaches the one session token to every account-scoped call, and ends the session on a 401.
 *
 * Replaces the separate admin and designer interceptors: there's a single token now, so the rule is
 * about which ENDPOINTS need an account rather than which kind of user is calling. The auth
 * endpoints are excluded because they're what mint the token in the first place.
 */
const ACCOUNT_SCOPED = ['/api/admin/', '/api/designer/', '/api/my-templates', '/api/me/', '/api/auth/'];
// Every anonymous endpoint under /api/auth. A 401 from one of these means "those credentials were
// wrong", NOT "your session ended" — treating it as the latter clears a token the caller may not even
// have, bounces them to /login, and buries the real reason under a session-expired toast.
const PUBLIC_AUTH = [
  '/api/auth/login',
  '/api/auth/options',
  '/api/auth/code/',
  '/api/auth/register/',
  '/api/auth/oauth/',
];

export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(SessionStore);
  const router = inject(Router);
  const toast = inject(UiToastService);

  const needsToken =
    ACCOUNT_SCOPED.some((p) => req.url.includes(p)) && !PUBLIC_AUTH.some((p) => req.url.includes(p));
  if (!needsToken) {
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
        toast.danger('Your session expired. Please sign in again.');
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
