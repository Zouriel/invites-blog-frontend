import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiInput, UiFormField } from '@zouriel/ui/form';
import { UiContainer, UiStack } from '@zouriel/ui/layout';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { OtpSessionStore } from '../../shared/services/otp-session.service';
import { TokenStore } from '../../shared/services/token-store.service';
import { ApiError } from '../../shared/utils/types/api-error';

@Component({
  selector: 'app-verify',
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
  templateUrl: './verify.html',
  styleUrl: './verify.scss',
})
export class VerifyComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(ApiService);
  private otpSession = inject(OtpSessionStore);
  private tokens = inject(TokenStore);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly dest = this.otpSession.destination;

  protected readonly form = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.minLength(6)]),
  });

  private readonly codeValue = toSignal(this.form.controls.code.valueChanges, { initialValue: '' });
  protected readonly canSubmit = computed(() => this.codeValue().length === 6);

  private readonly challengeId = this.otpSession.challengeId;

  constructor() {
    if (!this.challengeId) {
      this.router.navigate(['/login']);
    }

    // Codes get pasted with the words around them ("123456 is your invites.blog code") and with
    // stray spaces. Keep the digits, drop everything else, and stop at six so a long paste can't
    // leave the field in a state the submit button silently refuses.
    // Emits on purpose: canSubmit reads valueChanges, so a silent setValue would leave it judging
    // the raw paste and keep the button disabled. The equality guard stops the echo after one pass.
    this.form.controls.code.valueChanges.pipe(takeUntilDestroyed()).subscribe((raw) => {
      const digits = (raw ?? '').replace(/\D/g, '').slice(0, 6);
      if (digits !== raw) this.form.controls.code.setValue(digits);
    });
  }

  verify(): void {
    if (!this.canSubmit() || this.loading()) {
      return;
    }
    this.error.set('');
    this.loading.set(true);
    this.api.verifyOtp({ challengeId: this.challengeId, code: this.form.controls.code.value }).subscribe({
      next: (res) => {
        this.tokens.setToken(res.accessToken);
        this.otpSession.clearChallenge();
        const returnTo = this.route.snapshot.queryParamMap.get('returnTo') ?? '/inbox';
        this.router.navigateByUrl(returnTo);
      },
      error: (err: ApiError) => {
        this.loading.set(false);
        this.error.set(err.message);
      },
    });
  }

  back(): void {
    this.router.navigate(['/login']);
  }
}
