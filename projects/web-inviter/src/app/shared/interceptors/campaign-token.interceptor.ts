import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TokenStore } from '../services/token.store';
import { environment } from '../../../environments/environment';

/**
 * Functional interceptor (spec §4.6.2).
 * For requests to `{apiBase}/api/campaigns/{id}/...` it looks up the campaign
 * access token stored in localStorage and attaches it as a Bearer header.
 */
export const campaignTokenInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(TokenStore);

  if (!req.url.startsWith(environment.apiBase)) {
    return next(req);
  }

  const path = req.url.slice(environment.apiBase.length);
  const match = /^\/api\/campaigns\/([^/?]+)/.exec(path);
  if (!match) {
    return next(req);
  }

  const campaignId = match[1];
  const token = store.get(campaignId);
  if (!token || req.headers.has('Authorization')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
