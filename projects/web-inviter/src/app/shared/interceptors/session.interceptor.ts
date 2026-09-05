import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { UiToastService } from '@zouriel/ui/dialog';
import { SessionStore } from '../services/session.store';

/**
 * Attaches the one session token to every account-scoped call, and ends the session on a 401.
 *
 * Replaces the separate admin and designer interceptors: there's a single token now, so the rule is
 * about which ENDPOINTS need an account rather than which kind of user is calling. The auth
 * endpoints are excluded because they're what mint the token in the first place.
 */
const ACCOUNT_SCOPED = [
  '/api/admin/',
  '/api/designer/',
  '/api/my-templates',
  '/api/me/',
  // Both halves of the release consent are account acts now — the designer's from their
  // session, the requester's from the verified email on theirs.
  '/api/template-release/',
  '/api/auth/',
  // Replying to an invitation you received. Answering is authorised by the account's verified
  // contacts, so without the token this went out anonymous and came back 403.
  '/api/invites/',
  // Campaign work. The possession token from the emailed link still wins where the browser holds
  // one — campaignTokenInterceptor runs first and this one never overwrites an Authorization header
  // — but an account that owns the campaign can now reach it without ever having had that link.
  '/api/campaigns/',
  // Media buckets. A bucket belongs to an ACCOUNT — it can outlive any one event and may never have
  // had one — so every route under here needs the session. Note this is the owner's side only: the
  // contributor endpoints live under /api/q/ precisely so that somebody who scanned a printed code
  // reaches them with no session at all, and they must stay off this list.
  '/api/media-buckets',
];
// Every anonymous endpoint under /api/auth. A 401 from one of these means "those credentials were
// wrong", NOT "your session ended" — treating it as the latter clears a token the caller may not even
// have, bounces them to /login, and buries the real reason under a session-expired toast.
const PUBLIC_AUTH = [
  '/api/auth/login',
  '/api/auth/options',
  '/api/auth/code/',
  '/api/auth/register/',
  '/api/auth/signup',
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
      // Only a token we actually sent can be expired. Campaign work can 401 for a stale magic link
      // held by someone with no account at all, and ending a session they never had would bounce
      // them to /login for no reason.
      if (err.status === 401 && token) {
        store.clear();
        toast.danger('Your session expired. Please sign in again.');
        void router.navigate(['/login']);
      }
      return throwError(() => err);
    }),
  );
};
