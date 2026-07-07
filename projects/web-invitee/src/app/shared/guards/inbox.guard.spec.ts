import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { inboxGuard } from './inbox.guard';
import { TokenStore } from '../services/token-store.service';

describe('inboxGuard', () => {
  const store = { isAuthenticated: false };

  function run() {
    return TestBed.runInInjectionContext(() =>
      inboxGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  beforeEach(() => {
    store.isAuthenticated = false;
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: TokenStore, useValue: store }],
    });
  });

  it('allows activation when authenticated', () => {
    store.isAuthenticated = true;
    expect(run()).toBe(true);
  });

  it('redirects to /login when not authenticated', () => {
    store.isAuthenticated = false;
    const result = run();
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toContain('/login');
  });
});
