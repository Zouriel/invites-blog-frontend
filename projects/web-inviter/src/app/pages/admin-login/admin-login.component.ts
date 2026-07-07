import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiFormField, UiInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { AdminStore } from '../../shared/services/admin.store';

@Component({
  selector: 'app-admin-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiAlert, UiButton, UiCard, UiText, UiFormField, UiInput],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
})
export class AdminLoginComponent {
  private readonly api = inject(ApiService);
  private readonly admin = inject(AdminStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly form = this.fb.group({
    email: this.fb.control('', [Validators.required, Validators.email]),
    password: this.fb.control('', Validators.required),
  });

  protected error(control: 'email' | 'password'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) {
      return undefined;
    }
    return control === 'email' && c.hasError('email')
      ? 'Enter a valid email.'
      : 'This field is required.';
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.failed.set(false);
    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    this.api.adminLogin(email, password).subscribe({
      next: (res) => {
        this.admin.set(res.token);
        this.loading.set(false);
        this.router.navigate(['/admin/templates']);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }
}
