import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { UiToastService } from 'ui/dialog';
import { ApiService } from './api.service';
import { TokenStore } from '../services/token-store.service';
import { ApiError } from '../utils/types/api-error';
import { InboxCard } from '../utils/types/api.types';
import { environment } from '../../../environments/environment';

describe('ApiService (envelope unwrapping)', () => {
  let api: ApiService;
  let http: HttpTestingController;
  const toasts = { danger: vi.fn() };
  const tokens = { clearToken: vi.fn(), isAuthenticated: false };

  beforeEach(() => {
    toasts.danger.mockReset();
    tokens.clearToken.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: UiToastService, useValue: toasts },
        { provide: TokenStore, useValue: tokens },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps `.data` from a successful envelope', () => {
    let result: InboxCard[] | undefined;
    api.getMyInvites().subscribe((cards) => (result = cards));

    const req = http.expectOne(`${environment.apiBase}/api/me/invites`);
    req.flush({
      success: true,
      message: null,
      data: [{ inviteId: 'a1', eventTitle: 'Party' }],
      errors: null,
    });

    expect(result?.length).toBe(1);
    expect(result?.[0].inviteId).toBe('a1');
  });

  // A lapsed session on a private endpoint is answered by sending them back through verification,
  // so it must NOT also throw a red toast at them on the way — but the error still reaches the caller.
  it('ends the session quietly when a private endpoint reports an expired one', () => {
    let error: ApiError | undefined;
    api.getMyInvites().subscribe({ error: (e: ApiError) => (error = e) });

    const req = http.expectOne(`${environment.apiBase}/api/me/invites`);
    req.flush(
      { success: false, message: 'Session expired', data: null, errors: null },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(error).toBeInstanceOf(ApiError);
    expect(error?.message).toBe('Session expired');
    expect(error?.status).toBe(401);
    expect(tokens.clearToken).toHaveBeenCalled();
    expect(toasts.danger).not.toHaveBeenCalled();
  });

  it('surfaces the envelope message via a toast on an ordinary failure', () => {
    let error: ApiError | undefined;
    api.getInviteByToken('abc').subscribe({ error: (e: ApiError) => (error = e) });

    const req = http.expectOne(`${environment.apiBase}/api/invites/by-token/abc`);
    req.flush(
      { success: false, message: 'Something broke', data: null, errors: null },
      { status: 500, statusText: 'Server Error' },
    );

    expect(error?.message).toBe('Something broke');
    expect(toasts.danger).toHaveBeenCalledWith('Something broke');
    expect(tokens.clearToken).not.toHaveBeenCalled();
  });
});
