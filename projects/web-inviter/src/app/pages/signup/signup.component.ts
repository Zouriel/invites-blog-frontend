import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiFormField, UiInput } from 'ui/form';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { OAuthPopupService } from '../../shared/services/oauth-popup.service';
import { SessionStore } from '../../shared/services/session.store';
import { Account, ExternalAuthProvider } from '../../shared/utils/types/api.types';

const MIN_PASSWORD = 10;

/**
 * Designer sign-up — the only self-service way onto the platform beyond receiving invitations.
 *
 * It grants exactly one role, Designer, and nothing published skips review, so an open sign-up buys
 * someone the right to submit work rather than the right to appear in the gallery.
 */
@Component({
  selector: 'app-signup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe, ReactiveFormsModule, RouterLink, UiAlert, UiButton, UiCard, UiFormField, UiInput,
    UiText,
  ],
  templateUrl: './signup.component.html',
  styleUrl: './signup.component.scss',
})
export class SignupComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly oauth = inject(OAuthPopupService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly minPassword = MIN_PASSWORD;
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly providers = signal<ExternalAuthProvider[]>([]);

  protected readonly form = this.fb.group({
    displayName: this.fb.control('', Validators.required),
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required, Validators.minLength(MIN_PASSWORD)]),
  });

  constructor() {
    this.api.authOptions().subscribe({
      next: (o) => this.providers.set(o.oAuthProviders),
      error: () => this.providers.set([]),
    });
  }

  protected error(control: 'displayName' | 'email' | 'password'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) return undefined;
    if (control === 'email') return 'Enter a valid email address.';
    if (control === 'password') return `Use at least ${MIN_PASSWORD} characters.`;
    return 'This field is required.';
  }

  protected submit(): void {
    if (this.form.invalid || this.busy()) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.failure.set(null);
    this.busy.set(true);
    this.api
      .registerDesigner({
        email: v.email.trim(),
        password: v.password,
        displayName: v.displayName.trim(),
      })
      .subscribe({
        next: (res) => this.land(res.token, res.account),
        error: (e: Error) => {
          this.busy.set(false);
          this.failure.set(e.message);
        },
      });
  }

  /** Same dance as the sign-in page: the popup returns an ID token, the server verifies it. */
  protected async withProvider(provider: ExternalAuthProvider): Promise<void> {
    this.failure.set(null);
    this.busy.set(true);
    try {
      const idToken = await this.oauth.signIn(provider);
      this.api.oauthLogin(provider.provider, idToken).subscribe({
        next: (res) => this.landAsCreator(res.token, res.account),
        error: (e: Error) => {
          this.busy.set(false);
          this.failure.set(e.message);
        },
      });
    } catch (e) {
      this.busy.set(false);
      this.failure.set((e as Error).message);
    }
  }

  private land(token: string, account: Account): void {
    this.session.set(token, account);
    this.busy.set(false);
    void this.router.navigate([account.roles.includes('Designer') ? '/designer' : '/inbox']);
  }

  /**
   * Signing in with Google only ever returns the account you already have — which on THIS page,
   * where the button says create a creator account, left an existing customer signed in as a
   * customer with nothing to show for it. Ask for the role explicitly instead.
   */
  private landAsCreator(token: string, account: Account): void {
    if (account.roles.includes('Designer')) {
      this.land(token, account);
      return;
    }
    // The role has to be requested with the new session, so store it before asking.
    this.session.set(token, account);
    this.api.becomeDesigner().subscribe({
      next: (res) => this.land(res.token, res.account),
      // Already-a-creator races aside, the session is real either way — let them in as they are.
      error: () => this.land(token, account),
    });
  }
}
