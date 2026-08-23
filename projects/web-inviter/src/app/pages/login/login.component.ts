import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiFormField, UiInput, UiOtpInput, UiPasswordInput } from '@zouriel/ui/form';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { OAuthPopupService } from '../../shared/services/oauth-popup.service';
import { SessionStore } from '../../shared/services/session.store';
import { CodeSent, ExternalAuthProvider } from '../../shared/utils/types/api.types';

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
    UiOtpInput, UiPasswordInput, UiTab, UiTabs, UiText,
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
  protected identifier = '';
  protected code = '';

  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly smsAvailable = signal(true);
  /** Only providers this server actually has credentials for — no button that can't work. */
  protected readonly providers = signal<ExternalAuthProvider[]>([]);
  /** Set once a code is on its way — the form then asks for the code instead of the identifier. */
  protected readonly sent = signal<CodeSent | null>(null);

  protected readonly codeHint = computed(() => {
    const s = this.sent();
    if (!s) return '';
    return s.channel === 'sms' ? `We texted a code to ${s.sentTo}.` : `We emailed a code to ${s.sentTo}.`;
  });

  constructor() {
    this.api.authOptions().subscribe({
      next: (o) => {
        this.smsAvailable.set(o.smsAvailable);
        this.providers.set(o.oAuthProviders);
      },
      // Assume it works rather than hiding the tab on a transient failure; the request itself
      // reports honestly if SMS is off.
      error: () => this.smsAvailable.set(true),
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

  protected sendCode(): void {
    if (!this.identifier.trim()) {
      this.failure.set('Enter your phone number or email.');
      return;
    }
    this.failure.set(null);
    this.busy.set(true);
    this.api.requestSignInCode(this.identifier.trim()).subscribe({
      next: (s) => {
        this.sent.set(s);
        this.busy.set(false);
      },
      error: (e: Error) => this.fail(e),
    });
  }

  protected verifyCode(): void {
    const sent = this.sent();
    if (!sent || this.code.trim().length < 6) {
      this.failure.set('Enter the 6-digit code.');
      return;
    }
    this.failure.set(null);
    this.busy.set(true);
    this.api.verifySignInCode(sent.challengeId, this.code.trim()).subscribe({
      next: (res) => this.land(res.token, res.account),
      error: (e: Error) => this.fail(e),
    });
  }

  /** Back to the identifier step to correct a typo, without reloading the page. */
  protected startOver(): void {
    this.sent.set(null);
    this.code = '';
    this.failure.set(null);
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
    // Otherwise land them where their roles make most sense. Everyone else gets the inbox: the
    // reason most people sign in at all is an invitation waiting for them.
    if (account.roles.includes('Admin')) void this.router.navigate(['/admin/templates']);
    else if (account.roles.includes('Designer')) void this.router.navigate(['/my-templates']);
    else void this.router.navigate(['/inbox']);
  }

  private fail(error: Error): void {
    this.busy.set(false);
    this.failure.set(error.message);
  }
}
