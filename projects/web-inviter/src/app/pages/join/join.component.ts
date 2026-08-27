import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiFormField, UiInput, UiPasswordInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';

const MIN_PASSWORD = 8;

/**
 * Creating an account as someone who receives invitations.
 *
 * <p>Until this existed the only ways in were a Google or Microsoft account, or designer sign-up —
 * which grants a role a guest has no use for. Anyone whose address is neither of the two providers
 * simply could not get in, and being invited is the commonest reason to want to.</p>
 *
 * <p><b>Why it takes two steps.</b> Invitations are matched to an account by its email address
 * alone, which is what lets somebody invited before they signed up find their post waiting. So an
 * address nobody proved would hand its owner's invitations to whoever typed it. The code proves the
 * address; the password is only how they get back in afterwards.</p>
 */
@Component({
  selector: 'app-join',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, UiAlert, UiButton, UiCard, UiFormField, UiInput,
    UiPasswordInput, UiText,
  ],
  templateUrl: './join.component.html',
  styleUrl: './join.component.scss',
})
export class JoinComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly minPassword = MIN_PASSWORD;
  protected readonly busy = signal(false);
  protected readonly failure = signal<string | null>(null);

  /** The address a code was sent to, and the challenge it belongs to. Null until step one lands. */
  protected readonly challengeId = signal<string | null>(null);
  protected readonly sentTo = signal('');

  protected readonly emailForm = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
  });

  protected readonly detailsForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.minLength(6)]),
    displayName: this.fb.control(''),
    password: this.fb.control('', [Validators.required, Validators.minLength(MIN_PASSWORD)]),
  });

  protected sendCode(): void {
    if (this.emailForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.failure.set(null);

    const email = this.emailForm.getRawValue().email.trim();
    this.api.startSignUp(email).subscribe({
      next: (sent) => {
        this.challengeId.set(sent.challengeId);
        this.sentTo.set(email);
        this.busy.set(false);
      },
      error: (e) => {
        this.failure.set(e?.error?.message ?? 'That code could not be sent. Check the address.');
        this.busy.set(false);
      },
    });
  }

  protected create(): void {
    const challenge = this.challengeId();
    if (!challenge || this.detailsForm.invalid || this.busy()) return;
    this.busy.set(true);
    this.failure.set(null);

    const { code, password, displayName } = this.detailsForm.getRawValue();
    this.api.completeSignUp(challenge, code.trim(), password, displayName.trim() || undefined).subscribe({
      next: (result) => {
        this.session.set(result.token, result.account);
        this.busy.set(false);
        void this.router.navigate(['/inbox']);
      },
      error: (e) => {
        this.failure.set(e?.error?.message ?? 'That did not work. Check the code and try again.');
        this.busy.set(false);
      },
    });
  }

  /** Back to the address step, so a typo in the email is not a dead end. */
  protected useAnotherAddress(): void {
    this.challengeId.set(null);
    this.detailsForm.reset();
    this.failure.set(null);
  }
}
