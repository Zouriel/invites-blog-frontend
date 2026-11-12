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
import { catalog, formatBytes, mvr, plan } from '../../shared/utils/plans';

/** What the form is being used to ask for. Everything but `design` is a plan, until payments are online. */
type Topic = 'design' | 'gold' | 'platinum' | 'keep' | 'sending' | 'premium' | 'venue';

type TopicCopy = { eyebrow: string; title: string; lead: string; subject: string; ask: string; done: string };

const DONE_PLAN = 'We’ll email you to arrange it, and switch it on as soon as it’s paid.';

/** The names from before the passes were renamed: links already sent or saved keep working. */
const OLD_TOPICS: Record<string, Topic> = { party: 'gold', wedding: 'platinum' };

const TOPICS: Record<Exclude<Topic, 'design'>, TopicCopy> = {
  gold: {
    eyebrow: 'Gold pass', title: 'Add a Gold pass',
    lead: `${mvr(plan('GoldPass').price)} once, for one event. Tell us which event and we’ll add it.`,
    subject: 'Gold pass', ask: 'Please add a Gold pass to my event.', done: DONE_PLAN,
  },
  platinum: {
    eyebrow: 'Platinum pass', title: 'Add a Platinum pass',
    lead: `${mvr(plan('PlatinumPass').price)} once, for the whole wedding. Tell us which event and we’ll add it.`,
    subject: 'Platinum pass', ask: 'Please add a Platinum pass to my event.', done: DONE_PLAN,
  },
  keep: {
    eyebrow: 'Keep your photos', title: 'Keep your photos online',
    lead: `${mvr(catalog().keepPhotos.price)} a year. Tell us which event and we’ll keep its albums for another year.`,
    subject: 'Keep your photos', ask: 'Please keep my event’s photos online for another year.', done: DONE_PLAN,
  },
  sending: {
    eyebrow: 'Emailed invitations', title: 'Email more guests',
    lead: `${mvr(catalog().sending.perBlock)} for every ${catalog().sending.blockSize}. Tell us how many more guests you’d like us to email.`,
    subject: 'More emailed invitations', ask: 'Please add emailed invitations to my event. How many: ', done: DONE_PLAN,
  },
  premium: {
    eyebrow: 'Premium pass', title: 'The Premium pass',
    lead: `${mvr(plan('Premium').price)} a month. Every event you organise gets ${formatBytes(plan('Premium').eventBytes!)}, no mark, and keeps its photos while you subscribe.`,
    subject: 'Premium pass', ask: 'I’d like the Premium pass.', done: 'We’ll email you to set up the Premium pass.',
  },
  venue: {
    eyebrow: 'Studio', title: 'Studio',
    lead: `${mvr(plan('Venue').price)} a month. Every event you organise gets ${formatBytes(plan('Venue').eventBytes ?? 0)}, with your picture and name on its albums and posts. Tell us about your business.`,
    subject: 'Studio', ask: 'We’d like Studio for our business.', done: 'We’ll email you about it.',
  },
};

/**
 * The public "ask us" form. By default it asks for a custom-designed invitation; with `?topic=` it
 * asks for a plan instead — a pass, Keep your photos, more emailed invitations, Premium or Studio (topic `venue`) — and
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

  private readonly askedFor = this.params.get('topic') ?? '';
  private readonly named = Object.hasOwn(OLD_TOPICS, this.askedFor) ? OLD_TOPICS[this.askedFor] : this.askedFor;
  protected readonly topic: Topic = (Object.keys(TOPICS) as Topic[]).includes(this.named as Topic)
    ? (this.named as Topic)
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
