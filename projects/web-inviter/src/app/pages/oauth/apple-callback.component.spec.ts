import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { AppleCallbackComponent } from './apple-callback.component';

const account = { id: 'a1', email: 'x@privaterelay.appleid.com' };

function land(hash: string, redeem: () => unknown, next: string | null = null) {
  sessionStorage.clear();
  if (next) sessionStorage.setItem('ib.apple.next', next);
  history.replaceState(null, '', `/oauth/apple${hash}`);
  const api = { appleWebRedeem: vi.fn(redeem) };
  const session = { set: vi.fn() };
  TestBed.configureTestingModule({
    imports: [AppleCallbackComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: SessionStore, useValue: session },
    ],
  });
  const router = TestBed.inject(Router);
  const byUrl = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  TestBed.createComponent(AppleCallbackComponent);
  return { api, session, byUrl, nav };
}

describe('AppleCallbackComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('redeems the one-time code, signs in and goes where they were headed', () => {
    const { api, session, byUrl } = land('#code=one-time', () => of({ token: 'session-token', account }), '/events/abc');

    expect(api.appleWebRedeem).toHaveBeenCalledWith('one-time');
    expect(session.set).toHaveBeenCalledWith('session-token', account);
    expect(byUrl).toHaveBeenCalledWith('/events/abc', { replaceUrl: true });
    // The code is gone from the address bar.
    expect(window.location.hash).toBe('');
  });

  it('with nowhere kept it lands on the feed, like a Google sign-in', () => {
    const { byUrl } = land('#code=one-time', () => of({ token: 't', account }));
    expect(byUrl).toHaveBeenCalledWith('/feed', { replaceUrl: true });
  });

  it('never follows a kept address that leaves the site', () => {
    const { byUrl } = land('#code=one-time', () => of({ token: 't', account }), '//evil.example/x');
    expect(byUrl).toHaveBeenCalledWith('/feed', { replaceUrl: true });
  });

  it('a refused code goes back to sign-in with the reason', () => {
    const { session, nav } = land('#code=used', () => throwError(() => new Error('expired')));
    expect(session.set).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { appleError: 'apple_handoff' }, replaceUrl: true });
  });

  it('no code at all goes back to sign-in without calling the server', () => {
    const { api, nav } = land('', () => of({ token: 't', account }));
    expect(api.appleWebRedeem).not.toHaveBeenCalled();
    expect(nav).toHaveBeenCalledWith(['/login'], { queryParams: { appleError: 'apple_handoff' }, replaceUrl: true });
  });
});
