import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
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

  // Launch is email-only: guests verify the email address a host invited them with.
  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
  });

  goHome(): void {
    this.router.navigate(['/']);
  }

  submit(): void {
    const email = this.form.controls.email.value.trim();
    if (!email || this.form.controls.email.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }

    const body: OtpRequestBody = { channel: OtpChannel.Email, email };

    this.loading.set(true);
    this.api.requestOtp(body).subscribe({
      next: (res) => {
        this.otpSession.save(res.challengeId, res.expiresInSeconds, email);
        const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/inbox';
        this.router.navigate(['/verify'], { queryParams: { returnTo } });
      },
      error: () => this.loading.set(false),
    });
  }
}
