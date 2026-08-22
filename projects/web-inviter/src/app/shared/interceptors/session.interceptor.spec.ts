import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { UiToastService } from 'ui/dialog';
import { sessionInterceptor } from './session.interceptor';
import { SessionStore } from '../services/session.store';
import { environment } from '../../../environments/environment';

describe('sessionInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let store: SessionStore;
  let toast: { danger: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { danger: vi.fn() };
    router = { navigate: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        { provide: UiToastService, useValue: toast },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SessionStore);
  });

  afterEach(() => httpMock.verify());

  it('attaches the session token to account-scoped calls', () => {
    vi.spyOn(store, 'get').mockReturnValue('session-token');

    http.get(`${environment.apiBase}/api/me/campaigns`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/api/me/campaigns`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush({});
  });

  // Replying to an invitation is account-authorised; sending it without the token meant a 403 and
  // an RSVP that silently never landed.
  it('attaches the session token when replying to an invitation', () => {
    vi.spyOn(store, 'get').mockReturnValue('session-token');

    http.post(`${environment.apiBase}/api/invites/abc-123/rsvp`, {}).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/api/invites/abc-123/rsvp`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer session-token');
    req.flush({});
  });

  it('ends the session when an account-scoped call is rejected', () => {
    const clear = vi.spyOn(store, 'clear');
    vi.spyOn(store, 'get').mockReturnValue('session-token');

    http.get(`${environment.apiBase}/api/me/campaigns`).subscribe({ error: () => {} });
    httpMock
      .expectOne(`${environment.apiBase}/api/me/campaigns`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(clear).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  // A rejected sign-in is not an expired session: signing in is how you GET a session. Treating it
  // as expiry hid the server's real reason ("Google did not return an email address") behind a
  // session-expired toast and bounced the visitor to /login mid sign-up.
  it.each([
    '/api/auth/login',
    '/api/auth/oauth/google',
    '/api/auth/register/designer',
    '/api/auth/code/request',
  ])('leaves the session alone when %s is rejected', (path) => {
    const clear = vi.spyOn(store, 'clear');

    http.post(`${environment.apiBase}${path}`, {}).subscribe({ error: () => {} });
    httpMock
      .expectOne(`${environment.apiBase}${path}`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(clear).not.toHaveBeenCalled();
    expect(toast.danger).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
