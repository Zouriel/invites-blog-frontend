import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiInput, UiFormField } from 'ui/form';
import { UiContainer, UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { OtpSessionStore } from '../../shared/services/otp-session.service';
import { OtpChannel } from '../../shared/utils/enums/otp-channel.enum';
import { OtpRequestBody } from '../../shared/utils/types/api.types';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiAlert,
    UiButton,
    UiCard,
    UiInput,
    UiFormField,
    UiContainer,
    UiStack,
    UiText,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class LoginComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(ApiService);
  private otpSession = inject(OtpSessionStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  /** Shown when the entered email isn't on the campaign's guest list, or the event was cancelled. */
  protected readonly gateMessage = signal('');

  // Launch is email-only: guests verify the email address a host invited them with.
  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
  });

  private get returnTo(): string {
    return this.route.snapshot.queryParamMap.get('returnTo') ?? '/inbox';
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  submit(): void {
    const email = this.form.controls.email.value.trim();
    if (!email || this.form.controls.email.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }
    this.gateMessage.set('');

    // A shared campaign link (returnTo = /e/{campaignId}) is guest-list gated: we ask the backend to
    // send a code ONLY if this email is actually invited — otherwise we say so and never send an email.
    const campaignId = this.returnTo.match(/^\/e\/([^/?#]+)/)?.[1];
    if (campaignId) {
      this.requestForCampaign(campaignId, email);
      return;
    }

    // Inbox login (no campaign context): send unconditionally.
    const body: OtpRequestBody = { channel: OtpChannel.Email, email };
    this.loading.set(true);
    this.api.requestOtp(body).subscribe({
      next: (res) => this.goVerify(res.challengeId, email),
      error: () => this.loading.set(false),
    });
  }

  private requestForCampaign(campaignId: string, email: string): void {
    this.loading.set(true);
    this.api.requestCampaignOtp(campaignId, email).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.cancelled) {
          this.gateMessage.set('This event has been cancelled.');
          return;
        }
        if (!res.invited || !res.challengeId) {
          this.gateMessage.set(
            "That email isn't on the guest list for this invitation. Double-check the address your host used — if it's different, try that one.",
          );
          return;
        }
        this.goVerify(res.challengeId, email);
      },
      error: () => this.loading.set(false),
    });
  }

  private goVerify(challengeId: string, email: string): void {
    this.otpSession.save(challengeId, email);
    this.router.navigate(['/verify'], { queryParams: { returnTo: this.returnTo } });
  }
}
