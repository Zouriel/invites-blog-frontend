import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiFormField, UiInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DesignerStore } from '../../shared/services/designer.store';
import { OAuthPopupService } from '../../shared/services/oauth-popup.service';
import { ExternalAuthProvider } from '../../shared/utils/types/api.types';

/**
 * Designer sign-in and sign-up in one screen — structurally the same as `admin-login`, with a mode
 * toggle and the OAuth buttons the server reports as configured. When no provider is configured the
 * buttons don't render at all, so nobody clicks something that can't work.
 */
@Component({
  selector: 'app-designer-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, UiAlert, UiButton, UiCard, UiText, UiFormField, UiInput],
  templateUrl: './designer-login.component.html',
  styleUrl: './designer-login.component.scss',
})
export class DesignerLoginComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(DesignerStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly oauth = inject(OAuthPopupService);

  protected readonly registering = signal(false);
  protected readonly loading = signal(false);
  protected readonly failure = signal<string | null>(null);
  protected readonly providers = signal<ExternalAuthProvider[]>([]);
  protected readonly oauthPending = signal<string | null>(null);

  protected readonly heading = computed(() =>
    this.registering() ? 'Become a designer' : 'Designer sign in',
  );

  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', [Validators.required]),
    displayName: this.fb.control(''),
  });

  constructor() {
    // Silently ignore failures here — the email/password form still works without OAuth.
    this.api.designerProviders().subscribe({
      next: (list) => this.providers.set(list),
      error: () => this.providers.set([]),
    });
  }

  /** Runs the provider's sign-in popup, then exchanges the ID token it returns for our own session. */
  protected async signInWith(provider: ExternalAuthProvider): Promise<void> {
    this.failure.set(null);
    this.oauthPending.set(provider.provider);
    try {
      const idToken = await this.oauth.signIn(provider);
      this.api.designerOAuth(provider.provider, idToken).subscribe({
        next: (res) => {
          this.store.set(res.token, res.designer);
          this.oauthPending.set(null);
          void this.router.navigate(['/designer']);
        },
        error: (err: Error) => {
          this.oauthPending.set(null);
          this.failure.set(err.message);
        },
      });
    } catch (err) {
      this.oauthPending.set(null);
      this.failure.set(err instanceof Error ? err.message : 'Sign-in was cancelled.');
    }
  }

  protected toggleMode(): void {
    this.registering.update((v) => !v);
    this.failure.set(null);
  }

  protected error(control: 'email' | 'password' | 'displayName'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) return undefined;
    if (control === 'email' && c.hasError('email')) return 'Enter a valid email.';
    if (control === 'password' && c.hasError('minlength')) return 'Use at least 10 characters.';
    return 'This field is required.';
  }

  protected submit(): void {
    // Sign-up asks for a name and a longer password; sign-in doesn't re-litigate either.
    const password = this.form.controls.password;
    const displayName = this.form.controls.displayName;
    if (this.registering()) {
      password.setValidators([Validators.required, Validators.minLength(10)]);
      displayName.setValidators([Validators.required]);
    } else {
      password.setValidators([Validators.required]);
      displayName.clearValidators();
    }
    password.updateValueAndValidity({ emitEvent: false });
    displayName.updateValueAndValidity({ emitEvent: false });

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.failure.set(null);
    this.loading.set(true);
    const value = this.form.getRawValue();
    const request$ = this.registering()
      ? this.api.designerRegister(value.email, value.password, value.displayName)
      : this.api.designerLogin(value.email, value.password);

    request$.subscribe({
      next: (res) => {
        this.store.set(res.token, res.designer);
        this.loading.set(false);
        void this.router.navigate(['/designer']);
      },
      error: (err: Error) => {
        this.loading.set(false);
        this.failure.set(err.message);
      },
    });
  }
}
