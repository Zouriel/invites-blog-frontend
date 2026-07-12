import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiAlert } from 'ui/alert';
import { UiResult } from 'ui/feedback';
import { UiInput, UiTextarea, UiNumberInput, UiFormField } from 'ui/form';
import { UiContainer, UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { RsvpStatus } from '../../shared/utils/enums/rsvp-status.enum';
import { RsvpBody } from '../../shared/utils/types/api.types';

@Component({
  selector: 'app-rsvp',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiAlert,
    UiResult,
    UiInput,
    UiTextarea,
    UiNumberInput,
    UiFormField,
    UiContainer,
    UiStack,
    UiText,
  ],
  templateUrl: './rsvp.html',
  styleUrl: './rsvp.scss',
})
export class RsvpComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  protected readonly RsvpStatus = RsvpStatus;
  protected readonly options: readonly { value: RsvpStatus; label: string }[] = [
    { value: RsvpStatus.Going, label: 'Going' },
    { value: RsvpStatus.Maybe, label: 'Maybe' },
    { value: RsvpStatus.NotGoing, label: 'Not going' },
  ];

  protected readonly loading = signal(false);
  protected readonly done = signal(false);

  protected readonly form = this.fb.group({
    status: this.fb.control<RsvpStatus>(RsvpStatus.Going, [Validators.required]),
    guestCount: this.fb.control<number>(1),
    mealPreference: this.fb.control(''),
    arrivalTime: this.fb.control(''),
    comment: this.fb.control(''),
  });

  // Token flows in via query param from the /i/:token screen (or router state).
  protected readonly token = signal<string>(
    this.route.snapshot.queryParamMap.get('token') ??
      (history.state?.token as string | undefined) ??
      '',
  );
  // Inbox flow reaches this page as /invites/:inviteId/rsvp with no token — RSVP is then done
  // via the authenticated (JWT) endpoint, ownership-checked server-side.
  protected readonly inviteId = signal<string>(this.route.snapshot.paramMap.get('inviteId') ?? '');

  setStatus(status: RsvpStatus): void {
    this.form.controls.status.setValue(status);
  }

  submit(): void {
    if (this.loading()) return;
    const token = this.token();
    const inviteId = this.inviteId();
    if (!token && !inviteId) return; // nothing to address the RSVP to

    const raw = this.form.getRawValue();
    const body: RsvpBody = {
      status: raw.status,
      guestCount: raw.guestCount ?? undefined,
      mealPreference: raw.mealPreference.trim() || undefined,
      arrivalTime: raw.arrivalTime.trim() || undefined,
      comment: raw.comment.trim() || undefined,
    };

    // Token from the /i/:token link → anonymous by-token RSVP; otherwise the authenticated
    // inbox flow → RSVP by invite id (JWT + server-side ownership check).
    const request$ = token
      ? this.api.rsvpByToken(token, body)
      : this.api.rsvpByInviteId(inviteId, body);

    this.loading.set(true);
    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.done.set(true);
      },
      error: () => this.loading.set(false),
    });
  }

  statusLabel(status: RsvpStatus): string {
    return status === RsvpStatus.NotGoing ? 'not going' : status.toLowerCase();
  }

  back(): void {
    if (this.token()) {
      this.router.navigate(['/i', this.token()]);
    } else {
      this.router.navigate(['/inbox']);
    }
  }
}
