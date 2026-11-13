import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from './api.service';
import { BROWSER_LOCATION, HOST_CONFIG } from '../services/host-split';
import { environment } from '../../../environments/environment';

const base = environment.apiBase;

function on(origin: string) {
  TestBed.configureTestingModule({
    providers: [
      ApiService,
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: UiToastService, useValue: { danger: vi.fn() } },
      { provide: HOST_CONFIG, useValue: { siteOrigin: 'https://invites.blog', appOrigin: 'https://app.invites.blog' } },
      { provide: BROWSER_LOCATION, useValue: { origin: () => origin, current: () => '/', assign: vi.fn(), replace: vi.fn() } },
      { provide: PLATFORM_ID, useValue: 'browser' },
    ],
  });
  return { api: TestBed.inject(ApiService), http: TestBed.inject(HttpTestingController) };
}

describe('ApiService across the two hosts', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('from app.invites.blog, Sign in with Apple starts and redeems on invites.blog, with its cookies', () => {
    const { api, http } = on('https://app.invites.blog');
    api.appleWebStart().subscribe();
    api.appleWebRedeem('c').subscribe();
    const start = http.expectOne('https://invites.blog/api/auth/apple/web/start');
    const redeem = http.expectOne('https://invites.blog/api/auth/apple/web/redeem');
    expect([start.request.withCredentials, redeem.request.withCredentials]).toEqual([true, true]);
    start.flush({ success: true, data: { authorizeUrl: 'x' } });
    redeem.flush({ success: true, data: { token: 't', account: {} } });
  });

  it('on invites.blog they stay on the same origin, as do the hand-over calls everywhere', () => {
    const { api, http } = on('https://invites.blog');
    api.appleWebStart().subscribe();
    api.sessionHandoff().subscribe();
    api.sessionHandoffRedeem('c').subscribe();
    http.expectOne(`${base}/api/auth/apple/web/start`).flush({ success: true, data: { authorizeUrl: 'x' } });
    http.expectOne(`${base}/api/auth/handoff`).flush({ success: true, data: { code: 'c', expiresInSeconds: 60 } });
    const redeem = http.expectOne(`${base}/api/auth/handoff/redeem`);
    expect(redeem.request.body).toEqual({ code: 'c' });
    redeem.flush({ success: true, data: { token: 't', account: {} } });
  });
});
