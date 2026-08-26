import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiInput, UiFormField } from '@zouriel/ui/form';
import { UiContainer, UiStack } from '@zouriel/ui/layout';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { catchError, of } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { OtpSessionStore } from '../../shared/services/otp-session.service';
import { OtpChannel } from '../../shared/utils/enums/otp-channel.enum';
import { CampaignOtpResult } from '../../shared/utils/types/api.types';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    ReactiveFormsModule,
    UiAlert,
    UiButton,
    UiCard,
    UiInput,
    UiFormField,
    UiContainer,
    UiStack,
    UiTab,
    UiTabs,
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
  /** Shown when the entered contact isn't on the campaign's guest list, or the event was cancelled. */
  protected readonly gateMessage = signal('');

  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
  });

  // A bare local number is fine — the server normalises against defaultCountry.
  protected readonly phoneForm = this.fb.group({
    phone: this.fb.control('', [Validators.required, Validators.minLength(7)]),
  });

  private readonly authOptions = toSignal(
    this.api.getAuthOptions().pipe(catchError(() => of({ smsAvailable: false }))),
    { initialValue: { smsAvailable: false } },
  );

  /**
   * A number is offered ONLY when opening a specific invitation (returnTo = /e/{id}). There the code
   * is gated on that one campaign's guest list, so proving a number says "I am on this list" and
   * nothing more. Inbox sign-in stays email-only: it is the broader identity, deciding which
   * invitations across every campaign a person can read.
   */
  protected readonly phoneAllowed = computed(
    () => this.authOptions().smsAvailable && this.campaignId !== null,
  );

  private get returnTo(): string {
    return this.route.snapshot.queryParamMap.get('returnTo') ?? '/inbox';
  }

  private get campaignId(): string | null {
    return this.returnTo.match(/^\/e\/([^/?#]+)/)?.[1] ?? null;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  submit(): void {
    if (this.loading()) return;
    const email = this.form.controls.email.value.trim();
    if (!email || this.form.controls.email.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }
    this.gateMessage.set('');

    // A shared campaign link is guest-list gated: the backend sends a code ONLY if this contact is
    // actually invited — otherwise we say so and nothing is sent.
    const campaignId = this.campaignId;
    if (campaignId) {
      this.requestForCampaign(campaignId, { email }, email);
      return;
    }

    this.loading.set(true);
    this.api.requestOtp({ channel: OtpChannel.Email, email }).subscribe({
      next: (res) => this.goVerify(res.challengeId, email),
      error: () => this.loading.set(false),
    });
  }

  submitPhone(): void {
    if (this.loading()) return;
    const campaignId = this.campaignId;
    if (!campaignId) return; // a number is never offered outside the campaign gate
    const phone = this.phoneForm.controls.phone.value.trim();
    if (!phone || this.phoneForm.controls.phone.invalid) {
      this.phoneForm.controls.phone.markAsTouched();
      return;
    }
    this.gateMessage.set('');
    this.requestForCampaign(campaignId, { phone, defaultCountry: 'MV' }, phone);
  }

  private requestForCampaign(
    campaignId: string,
    contact: { email?: string; phone?: string; defaultCountry?: string },
    destination: string,
  ): void {
    this.loading.set(true);
    this.api.requestCampaignOtp(campaignId, contact).subscribe({
      next: (res: CampaignOtpResult) => {
        this.loading.set(false);
        if (res.cancelled) {
          this.gateMessage.set('This event has been cancelled.');
          return;
        }
        if (!res.invited || !res.challengeId) {
          this.gateMessage.set(
            contact.phone
              ? "That number isn't on the guest list for this invitation. Check the number your host has for you — or try your email address instead."
              : "That email isn't on the guest list for this invitation. Double-check the address your host used — if it's different, try that one.",
          );
          return;
        }
        this.goVerify(res.challengeId, destination);
      },
      error: () => this.loading.set(false),
    });
  }

  private goVerify(challengeId: string, destination: string): void {
    this.otpSession.save(challengeId, destination);
    this.router.navigate(['/verify'], { queryParams: { returnTo: this.returnTo } });
  }
}
