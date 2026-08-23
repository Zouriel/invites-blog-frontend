import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiInput, UiOtpInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { UiAlert } from '@zouriel/ui/alert';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { Template, TemplateRelease } from '../../shared/utils/types/api.types';

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
    UiAlert,
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
  private readonly toast = inject(UiToastService);
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
  /** Commissioned templates this person could agree to share with everyone. */
  protected readonly releases = signal<TemplateRelease[]>([]);
  protected readonly releasingId = signal<string | null>(null);

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
    // Commissions this person could release to the public gallery. Best-effort — the page still
    // works if it fails, it just won't offer the release.
    this.api.myCommissionedTemplates(this.accessToken).subscribe({
      next: (list) => this.releases.set(list),
      error: () => this.releases.set([]),
    });
  }

  /**
   * The requester's half of the two-party consent. Their template only reaches the public gallery
   * once the designer has agreed too — this records their side, nothing more.
   */
  protected release(item: TemplateRelease): void {
    this.releasingId.set(item.templateId);
    this.api.releaseAsRequester(item.templateId, this.accessToken).subscribe({
      next: (updated) => {
        this.releases.update((list) =>
          list.map((r) => (r.templateId === updated.templateId ? updated : r)),
        );
        this.releasingId.set(null);
        this.toast.success(
          updated.isPublic
            ? 'Shared — your design is now in the public gallery.'
            : 'Noted. It goes public once the designer agrees too.',
        );
      },
      error: () => this.releasingId.set(null),
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
        // The wizard now opens on Roles — theming and content are both scoped per role.
        this.router.navigate(['/create', res.campaignId, 'roles']);
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
