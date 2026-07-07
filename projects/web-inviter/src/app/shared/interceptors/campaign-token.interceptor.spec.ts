import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { campaignTokenInterceptor } from './campaign-token.interceptor';
import { TokenStore } from '../services/token.store';
import { environment } from '../../../environments/environment';

describe('campaignTokenInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let store: TokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([campaignTokenInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    store = TestBed.inject(TokenStore);
  });

  afterEach(() => httpMock.verify());

  it('attaches the campaign Bearer token for /api/campaigns/{id} calls', () => {
    spyOn(store, 'get').and.returnValue('secret-token');

    http.get(`${environment.apiBase}/api/campaigns/abc/pricing`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/api/campaigns/abc/pricing`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer secret-token');
    req.flush({});
  });

  it('leaves unrelated calls untouched', () => {
    spyOn(store, 'get').and.returnValue('secret-token');

    http.get(`${environment.apiBase}/api/templates`).subscribe();

    const req = httpMock.expectOne(`${environment.apiBase}/api/templates`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
