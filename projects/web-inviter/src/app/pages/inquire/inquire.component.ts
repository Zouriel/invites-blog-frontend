import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiInput, UiTextarea, UiFormField } from '@zouriel/ui/form';
import { UiResult } from '@zouriel/ui/feedback';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { PLAN_CATALOG, mvr, plan } from '../../shared/utils/plans';

/** What the form is being used to ask for. Everything but `design` is a plan, until payments are online. */
type Topic = 'design' | 'party' | 'wedding' | 'keep' | 'sending' | 'studio' | 'studio-passes' | 'venue';

type TopicCopy = { eyebrow: string; title: string; lead: string; subject: string; ask: string; done: string };

const DONE_PLAN = 'We’ll email you to arrange it, and switch it on as soon as it’s paid.';

const TOPICS: Record<Exclude<Topic, 'design'>, TopicCopy> = {
  party: {
    eyebrow: 'Party pass', title: 'Add a Party pass',
    lead: `${mvr(plan('PartyPass').price)} once, for one event. Tell us which event and we’ll add it.`,
    subject: 'Party pass', ask: 'Please add a Party pass to my event.', done: DONE_PLAN,
  },
  wedding: {
    eyebrow: 'Wedding pass', title: 'Add a Wedding pass',
    lead: `${mvr(plan('WeddingPass').price)} once, for the whole wedding. Tell us which event and we’ll add it.`,
    subject: 'Wedding pass', ask: 'Please add a Wedding pass to my event.', done: DONE_PLAN,
  },
  keep: {
    eyebrow: 'Keep your photos', title: 'Keep your photos online',
    lead: `${mvr(PLAN_CATALOG.keepPhotos.price)} a year. Tell us which event and we’ll keep its albums for another year.`,
    subject: 'Keep your photos', ask: 'Please keep my event’s photos online for another year.', done: DONE_PLAN,
  },
  sending: {
    eyebrow: 'Emailed invitations', title: 'Email more guests',
    lead: `${mvr(PLAN_CATALOG.sending.perBlock)} for every ${PLAN_CATALOG.sending.blockSize}. Tell us how many more guests you’d like us to email.`,
    subject: 'More emailed invitations', ask: 'Please add emailed invitations to my event. How many: ', done: DONE_PLAN,
  },
  studio: {
    eyebrow: 'Studio', title: 'Studio for designers and planners',
    lead: `${mvr(plan('Studio').price)} a month. Tell us about your work and we’ll set it up.`,
    subject: 'Studio plan', ask: 'I’d like the Studio plan.', done: 'We’ll email you to set up Studio.',
  },
  'studio-passes': {
    eyebrow: 'Studio', title: 'More passes for your clients',
    lead: `On Studio a Wedding pass is ${mvr(plan('WeddingPass').studioPrice ?? 0)} and a Party pass ${mvr(plan('PartyPass').studioPrice ?? 0)}. Tell us how many.`,
    subject: 'Studio passes', ask: 'Please add passes to my Studio. How many, and which: ', done: DONE_PLAN,
  },
  venue: {
    eyebrow: 'Venue', title: 'Venue for resorts and halls',
    lead: `From ${mvr(plan('Venue').price)} a month. Tell us about your property and we’ll talk you through it.`,
    subject: 'Venue plan', ask: 'We’d like the Venue plan for our property.', done: 'We’ll email you to talk it through.',
  },
};

/**
 * The public "ask us" form. By default it asks for a custom-designed invitation; with `?topic=` it
 * asks for a plan instead — a pass, Keep your photos, more emailed invitations, Studio or Venue — and
 * with `?event=` it names the event, so the team knows exactly what to switch on. Every request lands
 * in admin Inquiries, its occasion saying what it is for.
 */
@Component({
  selector: 'app-inquire',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule, RouterLink, UiButton, UiCard, UiText, UiInput, UiTextarea,
    UiFormField, UiResult,
  ],
  templateUrl: './inquire.component.html',
  styleUrl: './inquire.component.scss',
})
export class InquireComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly params = inject(ActivatedRoute).snapshot.queryParamMap;

  protected readonly topic: Topic = (Object.keys(TOPICS) as Topic[]).includes(this.params.get('topic') as Topic)
    ? (this.params.get('topic') as Topic)
    : 'design';
  /** The copy for a plan request; null for a design inquiry. */
  protected readonly copy = this.topic === 'design' ? null : TOPICS[this.topic];

  protected readonly submitting = signal(false);
  protected readonly done = signal(false);
  protected readonly eventTitle = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: this.fb.control(this.session.displayName() ?? '', Validators.required),
    email: this.fb.control(this.session.account()?.email ?? '', [Validators.required, Validators.email]),
    occasion: this.fb.control(this.copy?.subject ?? '', Validators.required),
    message: this.fb.control(this.copy?.ask ?? '', Validators.required),
  });

  protected readonly doneText = computed(() =>
    this.copy?.done ?? 'We’ll be in touch by email to talk through your event and design your invitation.');

  constructor() {
    // Name the event the request is about, so nobody has to ask which one.
    const eventId = this.params.get('event');
    if (eventId && this.copy) {
      this.api.getCampaignSummary(eventId).subscribe({
        next: (s) => {
          this.eventTitle.set(s.title);
          const m = this.form.controls.message;
          m.setValue(`${m.value}\nEvent: ${s.title} (${eventId})`);
        },
        error: () => {
          const m = this.form.controls.message;
          m.setValue(`${m.value}\nEvent: ${eventId}`);
        },
      });
    }
  }

  protected error(control: 'name' | 'email' | 'occasion' | 'message'): string | undefined {
    const c = this.form.controls[control];
    if (!c.touched || c.valid) return undefined;
    if (control === 'email') return 'Enter a valid email address.';
    return 'This field is required.';
  }

  protected submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    this.api
      .submitInquiry({
        name: v.name.trim(),
        email: v.email.trim(),
        occasion: v.occasion.trim(),
        message: v.message.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.done.set(true);
        },
        error: () => this.submitting.set(false),
      });
  }
}
