import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { AppleWebSignInService } from '../../shared/services/apple-web-sign-in.service';
import { SessionStore } from '../../shared/services/session.store';
import { ExternalAuthProvider } from '../../shared/utils/types/api.types';
import { LoginComponent } from './login.component';

const google: ExternalAuthProvider = { provider: 'google', clientId: 'g', authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth' };
const apple: ExternalAuthProvider = {
  provider: 'apple',
  clientId: 'blog.invites.web',
  authorizeUrl: 'https://appleid.apple.com/auth/authorize',
  redirectUri: 'https://invites.blog/auth/apple/callback',
};

function render(providers: ExternalAuthProvider[], query: Record<string, string> = {}, startUrl = 'https://appleid.apple.com/auth/authorize?state=s') {
  sessionStorage.clear();
  const navigate = vi.fn();
  const api = {
    authOptions: () => of({ smsAvailable: false, oAuthProviders: providers }),
    appleWebStart: vi.fn(() => (startUrl ? of({ authorizeUrl: startUrl }) : throwError(() => new Error("Sign in with Apple isn't available on the website yet.")))),
  };
  TestBed.configureTestingModule({
    imports: [LoginComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: api },
      { provide: SessionStore, useValue: { isSessionValid: () => false, set: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
    ],
  });
  TestBed.inject(AppleWebSignInService).navigate = navigate;
  const fixture = TestBed.createComponent(LoginComponent);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api, navigate };
}

describe('LoginComponent: Sign in with Apple', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows no Apple button when the server does not list Apple for the website', () => {
    const { el } = render([google]);
    expect(el.querySelector('ui-social-button[provider="apple"], ui-social-button button[data-provider="apple"]')).toBeNull();
    expect(el.querySelector('button[data-provider="google"]')!.textContent).toContain('Continue with Google');
  });

  it("shows Apple's own button beside Google's when the server lists it", () => {
    const { el } = render([apple, google]);
    const button = el.querySelector('button[data-provider="apple"]');
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Continue with Apple');
    // Both are the library's matching pair: the same component, wording and options, each with its logo.
    const gButton = el.querySelector('button[data-provider="google"]')!;
    expect(gButton.textContent).toContain('Continue with Google');
    expect(el.querySelectorAll('app-provider-button').length).toBe(0);
    for (const b of [button!, gButton]) {
      expect(b.classList.contains('expand')).toBe(true);
      // Owner 2026-11-04: white, with the corners of the site's own buttons.
      expect(b.getAttribute('data-shape')).toBe('rounded');
      expect(b.getAttribute('data-look')).toBe('light');
      expect(b.querySelector('.slot svg')).not.toBeNull();
    }
    expect(button!.getAttribute('data-look')).toBe(gButton.getAttribute('data-look'));
  });

  it('pressing it goes to the URL the server started, keeping where they were headed', async () => {
    const { fixture, el, api, navigate } = render([apple, google], { next: '/events/abc' });

    (el.querySelector('button[data-provider="apple"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api.appleWebStart).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('https://appleid.apple.com/auth/authorize?state=s');
    expect(sessionStorage.getItem('ib.apple.next')).toBe('/events/abc');
  });

  it('a refused start says why and leaves the page where it is', async () => {
    const { fixture, el, navigate } = render([apple], {}, '');

    (el.querySelector('button[data-provider="apple"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(navigate).not.toHaveBeenCalled();
    expect(el.textContent).toContain("isn't available on the website");
  });

  it('back from Apple with an error shows fixed wording, never text from the URL', () => {
    const { el } = render([apple], { appleError: 'apple_state' });
    expect(el.textContent).toContain('That Apple sign-in expired');

    TestBed.resetTestingModule();
    const crafted = render([apple], { appleError: 'Your account is locked, call 555-0100' });
    expect(crafted.el.textContent).not.toContain('555-0100');
    expect(crafted.el.textContent).toContain("Apple sign-in didn't work");
  });

  it('cancelling at Apple shows nothing', () => {
    const { el } = render([apple], { appleError: 'apple_cancelled' });
    expect(el.querySelector('ui-alert')).toBeNull();
  });
});
