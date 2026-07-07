import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiInput, UiOtpInput } from 'ui/form';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';

type Step = 'email' | 'code' | 'results';

const OTP_LENGTH = 6;

/**
 * "Did you request a template?" — a small email-OTP flow.
 * Step 1 collects the requester's email and sends a code; step 2 verifies it and
 * fetches the templates reserved for that email; step 3 either lets them start a
 * campaign from a ready template or explains that it isn't ready yet.
 */
@Component({
  selector: 'app-request-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UiBadge,
    UiButton,
    UiCard,
    UiEmptyState,
    UiFormField,
    UiInput,
    UiOtpInput,
    UiText,
  ],
  templateUrl: './request-template.component.html',
  styleUrl: './request-template.component.scss',
})
export class RequestTemplateComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly otpLength = OTP_LENGTH;

  /** The step-state machine. */
  protected readonly step = signal<Step>('email');

  protected readonly sending = signal(false);
  protected readonly verifying = signal(false);
  /** Which template is currently spinning up a campaign (id), if any. */
  protected readonly creatingId = signal<string | null>(null);

  private challengeId = '';
  private accessToken = '';
  /** The verified email, echoed back to the user for confidence. */
  protected readonly email = signal('');
  protected readonly templates = signal<Template[]>([]);

  protected readonly emailForm = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
  });

  protected readonly codeForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.minLength(OTP_LENGTH)]),
  });

  protected emailError(): string | undefined {
    const c = this.emailForm.controls.email;
    if (!c.touched || c.valid) {
      return undefined;
    }
    return c.hasError('required') ? 'Your email is required.' : 'Enter a valid email address.';
  }

  /** Step 1 → send the OTP and advance to the code step. */
  protected submitEmail(): void {
    if (this.emailForm.invalid || this.sending()) {
      this.emailForm.markAllAsTouched();
      return;
    }
    const email = this.emailForm.getRawValue().email.trim();
    this.sending.set(true);
    this.api.requestOtp(email).subscribe({
      next: (challenge) => {
        this.challengeId = challenge.challengeId;
        this.email.set(email);
        this.sending.set(false);
        this.step.set('code');
      },
      error: () => this.sending.set(false),
    });
  }

  /** Step 2 → verify the code, then load the dedicated templates for this email. */
  protected submitCode(): void {
    if (this.codeForm.invalid || this.verifying()) {
      this.codeForm.markAllAsTouched();
      return;
    }
    const code = this.codeForm.getRawValue().code.trim();
    this.verifying.set(true);
    this.api.verifyOtp(this.challengeId, code).subscribe({
      next: (tokens) => {
        this.accessToken = tokens.accessToken;
        this.loadDedicated();
      },
      // ApiService already toasts the failure; let the user retry the code.
      error: () => this.verifying.set(false),
    });
  }

  private loadDedicated(): void {
    this.api.myDedicatedTemplates(this.accessToken).subscribe({
      next: (list) => {
        this.templates.set(list);
        this.verifying.set(false);
        this.step.set('results');
      },
      error: () => this.verifying.set(false),
    });
  }

  /** Start the normal paid flow from a dedicated template (mirrors template-detail). */
  protected use(template: Template): void {
    if (this.creatingId()) {
      return;
    }
    this.creatingId.set(template.id);
    const title = `${template.name} invitation`;
    this.api.createCampaign(template.id, title).subscribe({
      next: (res) => {
        this.api.storeToken(res.campaignId, res.accessToken);
        this.api.storeMeta(res.campaignId, {
          packageUrl: template.packageUrl,
          templateName: template.name,
          title,
        });
        this.router.navigate(['/create', res.campaignId, 'editor']);
      },
      error: () => this.creatingId.set(null),
    });
  }

  /** Back to the email step to retry with a different address. */
  protected changeEmail(): void {
    this.codeForm.reset();
    this.step.set('email');
  }
}
