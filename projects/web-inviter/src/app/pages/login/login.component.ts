import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiFormField, UiInput, UiPasswordInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { OAuthPopupService } from '../../shared/services/oauth-popup.service';
import { SessionStore } from '../../shared/services/session.store';
import { ExternalAuthProvider } from '../../shared/utils/types/api.types';

/**
 * The one way in. Two tabs rather than one clever field: staff and designers know they have a
 * password, customers know they have a phone, and neither has to discover which mode the box is in.
 *
 * There is no separate admin or designer login any more — everyone lands here and the roles on the
 * issued session decide what the app shows them next.
 */
@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TitleCasePipe, FormsModule, RouterLink, UiAlert, UiButton, UiCard, UiFormField, UiInput,
    UiPasswordInput, UiText,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly oauth = inject(OAuthPopupService);

  protected email = '';
  protected password = '';

  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  /** Only providers this server actually has credentials for — no button that can't work. */
  protected readonly providers = signal<ExternalAuthProvider[]>([]);

  constructor() {
    this.api.authOptions().subscribe({
      // smsAvailable is ignored: signing in to the platform is email + password or a provider, and
      // no one-time code — codes authenticate a GUEST to one invitation, not an account.
      next: (o) => this.providers.set(o.oAuthProviders),
      // A transient failure must not hide the sign-in buttons; the sign-in request reports honestly.
      error: () => {},
    });
  }

  /**
   * The popup returns an ID token; the SERVER verifies it against the provider's published keys
   * before anything is trusted, so a token minted for another application signs nobody in here.
   */
  protected async withProvider(provider: ExternalAuthProvider): Promise<void> {
    this.failure.set(null);
    this.busy.set(true);
    try {
      const idToken = await this.oauth.signIn(provider);
      this.api.oauthLogin(provider.provider, idToken).subscribe({
        next: (res) => this.land(res.token, res.account),
        error: (e: Error) => this.fail(e),
      });
    } catch (e) {
      this.fail(e as Error);
    }
  }

  protected signIn(): void {
    if (!this.email.trim() || !this.password) {
      this.failure.set('Enter your email and password.');
      return;
    }
    this.failure.set(null);
    this.busy.set(true);
    this.api.signInWithPassword(this.email.trim(), this.password).subscribe({
      next: (res) => this.land(res.token, res.account),
      error: (e: Error) => this.fail(e),
    });
  }

  private land(token: string, account: import('../../shared/utils/types/api.types').Account): void {
    this.session.set(token, account);
    this.busy.set(false);

    // Honour where they were headed before the guard intercepted them.
    const next = this.route.snapshot.queryParamMap.get('next');
    if (next) {
      void this.router.navigateByUrl(next);
      return;
    }
    // Otherwise everyone lands on their invitations. Admins and designers used to go straight to
    // their work queues, which skipped past the thing they signed in as a PERSON to see — and both
    // those queues are one click away in the header, while an invitation sent to them is not.
    void this.router.navigate(['/inbox']);
  }

  private fail(error: Error): void {
    this.busy.set(false);
    this.failure.set(error.message);
  }
}
