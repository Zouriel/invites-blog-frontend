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
import {
  DEFAULT_COUNTRY,
  DEFAULT_COUNTRY_CODE,
} from '../../shared/utils/constants/storage.constants';
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

  protected readonly OtpChannel = OtpChannel;
  protected readonly channel = signal<OtpChannel>(OtpChannel.Sms);
  protected readonly loading = signal(false);

  protected readonly form = this.fb.group({
    countryCode: this.fb.control(DEFAULT_COUNTRY_CODE),
    phone: this.fb.control(''),
    email: this.fb.control('', [Validators.email]),
  });

  setChannel(channel: OtpChannel): void {
    this.channel.set(channel);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  submit(): void {
    const { countryCode, phone, email } = this.form.getRawValue();
    const isSms = this.channel() === OtpChannel.Sms;

    if (isSms && !phone.trim()) {
      this.form.controls.phone.markAsTouched();
      return;
    }
    if (!isSms && !email.trim()) {
      this.form.controls.email.markAsTouched();
      return;
    }

    const body: OtpRequestBody = isSms
      ? {
          channel: OtpChannel.Sms,
          phone: `${countryCode.trim()}${phone.replace(/\s+/g, '')}`,
          defaultCountry: DEFAULT_COUNTRY,
        }
      : { channel: OtpChannel.Email, email: email.trim() };

    this.loading.set(true);
    this.api.requestOtp(body).subscribe({
      next: (res) => {
        this.otpSession.save(
          res.challengeId,
          res.expiresInSeconds,
          isSms ? body.phone! : body.email!,
        );
        const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/inbox';
        this.router.navigate(['/verify'], { queryParams: { returnTo } });
      },
      error: () => this.loading.set(false),
    });
  }
}
