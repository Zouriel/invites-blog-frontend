import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  convertToParamMap,
  provideRouter,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { SessionStore } from '../services/session.store';
import { TokenStore } from '../services/token.store';
import { campaignAccessGuard } from './session.guard';

/**
 * Who may open a wizard step. The rule that matters most is the one that lets people IN: a creator
 * holding a possession token, or arriving from a resume link, must never be bounced to a sign-in
 * page they have no account for.
 */
describe('campaignAccessGuard', () => {
  let signedIn: boolean;
  let tokens: Record<string, string>;

  beforeEach(() => {
    signedIn = false;
    tokens = {};
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SessionStore, useValue: { isSessionValid: () => signedIn } },
        { provide: TokenStore, useValue: { get: (id: string) => tokens[id] ?? null } },
      ],
    });
  });

  function run(query: Record<string, string> = {}) {
    const route = {
      paramMap: convertToParamMap({ campaignId: 'camp-1' }),
      queryParamMap: convertToParamMap(query),
    } as ActivatedRouteSnapshot;
    const state = { url: '/create/camp-1/editor' } as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => campaignAccessGuard(route, state));
  }

  it('lets a signed-in account through', () => {
    signedIn = true;
    expect(run()).toBe(true);
  });

  it('lets a possession token for this campaign through', () => {
    tokens['camp-1'] = 'possession';
    expect(run()).toBe(true);
  });

  it('lets a resume link through', () => {
    expect(run({ resume: 'abc' })).toBe(true);
  });

  it('sends anyone else to sign in and back', () => {
    tokens['other-campaign'] = 'possession';
    const result = run() as UrlTree;
    expect(result).toBeInstanceOf(UrlTree);
    expect(result.toString()).toBe('/login?next=%2Fcreate%2Fcamp-1%2Feditor');
  });
});
