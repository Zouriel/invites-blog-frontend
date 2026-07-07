import { HttpInterceptorFn } from '@angular/common/http';
import { STORAGE_KEYS } from '../utils/constants/storage.constants';

/**
 * Attaches `Authorization: Bearer <jwt>` ONLY to the private invitee endpoints:
 *  - /api/me/...            (inbox)
 *  - /api/invites/{id}/claim
 * Public token endpoints (/api/invites/by-token/...) stay unauthenticated — the
 * link itself is the key.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  const isMe = url.includes('/api/me/');
  const isClaim = /\/api\/invites\/[^/]+\/claim$/.test(url);

  if (!isMe && !isClaim) {
    return next(req);
  }

  const token = localStorage.getItem(STORAGE_KEYS.jwt);
  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
