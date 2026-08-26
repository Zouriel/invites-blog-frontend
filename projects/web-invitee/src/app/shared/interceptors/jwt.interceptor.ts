import { HttpInterceptorFn } from '@angular/common/http';
import { STORAGE_KEYS } from '../utils/constants/storage.constants';

/**
 * Attaches `Authorization: Bearer <jwt>` ONLY to the private invitee endpoints:
 *  - /api/me/...                          (inbox)
 *  - /api/invites/{inviteId}/rsvp         (authenticated RSVP from the inbox)
 * Public token endpoints (/api/invites/by-token/{token} view + rsvp) stay
 * unauthenticated — the link itself is the key.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url;
  const isMe = url.includes('/api/me/');
  // inviteId (single-segment) RSVP only — NOT /api/invites/by-token/{token}/rsvp.
  const isRsvpAuth = /\/api\/invites\/[^/]+\/rsvp$/.test(url);

  if (!isMe && !isRsvpAuth) {
    return next(req);
  }

  const token = localStorage.getItem(STORAGE_KEYS.jwt);
  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
