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

  it('surfaces the envelope message via a toast and throws an ApiError on failure', () => {
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
    expect(toasts.danger).toHaveBeenCalledWith('Session expired');
  });
});
