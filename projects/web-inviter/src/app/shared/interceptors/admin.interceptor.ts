import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AdminStore } from '../services/admin.store';

/**
 * Functional interceptor. Attaches the admin JWT as a Bearer header to any
 * request whose URL targets `/api/admin/…`, except the login endpoint (which
 * mints the token in the first place).
 */
export const adminInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AdminStore);

  if (!req.url.includes('/api/admin/') || req.url.includes('/api/admin/login')) {
    return next(req);
  }

  const token = store.get();
  if (!token || req.headers.has('Authorization')) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
