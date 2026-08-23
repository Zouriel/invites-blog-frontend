import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiAlert } from '@zouriel/ui/alert';
import { UiResult } from '@zouriel/ui/feedback';
import { UiInput, UiTextarea, UiNumberInput, UiFormField, UiSelect } from '@zouriel/ui/form';
import { UiContainer, UiStack } from '@zouriel/ui/layout';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { RsvpStatus } from '../../shared/utils/enums/rsvp-status.enum';
import { RsvpBody, RsvpQuestion } from '../../shared/utils/types/api.types';

/** Questions that predate the configurable form and still have their own columns server-side. */
const RESERVED_KEYS = new Set(['guestCount', 'mealPreference', 'arrivalTime', 'comment']);

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
    UiSelect,
    FormsModule,
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

  /**
   * What this host chose to ask. Handed over by the invitation view rather than fetched again; when
   * this page is opened cold (a bookmarked link, say) the invitation is re-read to find them, since
   * asking the wrong questions is worse than one extra request.
   */
  protected readonly questions = signal<RsvpQuestion[]>(
    ((history.state?.questions as RsvpQuestion[] | undefined) ?? []),
  );
  protected readonly answers = signal<Record<string, string>>({});

  /** A head count means nothing from someone who isn't coming, so most questions drop away. */
  protected readonly visibleQuestions = computed(() =>
    this.status() === RsvpStatus.NotGoing
      ? this.questions().filter((q) => q.askIfNotGoing)
      : this.questions(),
  );

  protected readonly yesNo = [
    { label: 'Yes', value: 'Yes' },
    { label: 'No', value: 'No' },
  ];

  protected readonly form = this.fb.group({
    status: this.fb.control<RsvpStatus>(RsvpStatus.Going, [Validators.required]),
    guestCount: this.fb.control<number>(1),
    mealPreference: this.fb.control(''),
    arrivalTime: this.fb.control(''),
    comment: this.fb.control(''),
  });

  private readonly status = toSignal(this.form.controls.status.valueChanges, {
    initialValue: this.form.controls.status.value,
  });

  // Token flows in from the /i/:token/rsvp route param (or, for older links, a query param / state).
  protected readonly token = signal<string>(
    this.route.snapshot.paramMap.get('token') ??
      this.route.snapshot.queryParamMap.get('token') ??
      (history.state?.token as string | undefined) ??
      '',
  );
  // Inbox flow reaches this page as /invites/:inviteId/rsvp with no token — RSVP is then done
  // via the authenticated (JWT) endpoint, ownership-checked server-side.
  protected readonly inviteId = signal<string>(this.route.snapshot.paramMap.get('inviteId') ?? '');

  constructor() {
    if (!this.questions().length && this.token()) {
      this.api.getInviteByToken(this.token()).subscribe({
        next: (invite) => this.questions.set(invite.rsvpQuestions ?? []),
        // Not being able to read them is no reason to block the reply itself.
        error: () => this.questions.set([]),
      });
    }
  }

  setStatus(status: RsvpStatus): void {
    this.form.controls.status.setValue(status);
  }

  protected choicesOf(question: RsvpQuestion): { label: string; value: string }[] {
    return (question.options ?? []).map((o) => ({ label: o, value: o }));
  }

  protected answerOf(question: RsvpQuestion): string {
    return this.answers()[question.key] ?? '';
  }

  protected answer(question: RsvpQuestion, value: string): void {
    this.answers.update((all) => ({ ...all, [question.key]: value }));
  }

  protected get missingRequired(): boolean {
    return this.visibleQuestions().some((q) => q.required && !this.answers()[q.key]?.trim());
  }

  submit(): void {
    if (this.loading()) return;
    const token = this.token();
    const inviteId = this.inviteId();
    if (!token && !inviteId) return; // nothing to address the RSVP to

    if (this.missingRequired) return;

    // The four original questions keep their own fields — the dashboard reads them by name — and
    // anything else the host added rides along as an answer keyed by question.
    const asked = new Set(this.visibleQuestions().map((q) => q.key));
    const given = this.answers();
    const value = (key: string) => (asked.has(key) ? given[key]?.trim() || undefined : undefined);
    const extra: Record<string, string> = {};
    for (const q of this.visibleQuestions()) {
      if (RESERVED_KEYS.has(q.key)) continue;
      const v = given[q.key]?.trim();
      if (v) extra[q.key] = v;
    }

    const raw = this.form.getRawValue();
    const count = value('guestCount');
    const body: RsvpBody = {
      status: raw.status,
      guestCount: count ? Number(count) : undefined,
      mealPreference: value('mealPreference'),
      arrivalTime: value('arrivalTime'),
      comment: value('comment'),
      answers: Object.keys(extra).length ? extra : undefined,
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
