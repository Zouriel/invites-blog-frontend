import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import { wizardFlowFor, wizardStepEyebrow } from '../../shared/utils/constants/app.constants';
import { BillingEvent, BillingItem, CampaignSummary } from '../../shared/utils/types/api.types';
import { mvr, passSummary, plan, usd, windowLine } from '../../shared/utils/plans';

type Choice = 'Free' | 'Party' | 'Wedding';

/**
 * The plan step: the last thing before an event goes out. Free, a Party pass or a Wedding pass —
 * chosen, and a pass paid for, BEFORE anything is sent. Until then the event is a draft: no album,
 * no codes, no camera (the server refuses them).
 *
 * <p>An invitation carries on to Share; an event with no invitation (photos only, `?then=dashboard`)
 * is finished right here and opens on its dashboard.</p>
 *
 * <p>A design a Studio made for this host takes the Studio discount off a pass automatically (the
 * price says so). While online payment is off, choosing a pass sends the host to "Ask us" and the
 * event waits here; when we add the pass, they're emailed to come back and finish.</p>
 */
@Component({
  selector: 'app-photos-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, UiAlert, UiBadge, UiButton, UiSpinner, UiText, WizardStepsComponent],
  template: `
    <section class="wrap">
      <div class="ib-container ib-container--narrow">
        @if (inWizard()) {
          <app-wizard-steps [active]="stepKey" [steps]="steps()" [campaignId]="campaignId()" />
        }
        <header class="head">
          <span class="eyebrow">{{ inWizard() ? eyebrow() : 'Plan' }}</span>
          <ui-text variant="h1">Choose your plan</ui-text>
          <ui-text variant="body" class="lead">
            @if (saveTheDate()) {
              Sharing your save the date is free. A pass adds invitations emailed for you, and moves to
              your invitation when you make it.
            } @else {
              Free is free. A pass is paid once, for this event: more room for photos, more albums, more days,
              and invitations emailed for you.
            }
          </ui-text>
        </header>

        @if (event(); as e) {
          @if (e.atVenue) {
            <ui-alert tone="info" class="note">Your venue's plan covers this event.</ui-alert>
          } @else if (e.passActive) {
            <ui-alert tone="success" class="note">
              This event has a <strong>{{ e.pass }} pass</strong> until {{ e.passUntil | date: 'd MMM y' }}.
            </ui-alert>
          } @else if (e.offer.discountPercent > 0) {
            <ui-alert tone="success" class="note">
              <strong>{{ e.offer.discountPercent }}% off</strong> a pass: {{ e.offer.designedBy }} designed this for you.
            </ui-alert>
          }

          @if (!e.atVenue) {
            <div class="choices" role="radiogroup" aria-label="Plan">
              @for (c of choices(); track c.key) {
                <button type="button" class="choice" role="radio" [attr.aria-checked]="picked() === c.key"
                        [class.choice--on]="picked() === c.key" [disabled]="c.disabled" (click)="picked.set(c.key)">
                  <span class="choice__top">
                    <span class="choice__name">{{ c.name }}</span>
                    @if (c.current) { <ui-badge tone="success">This event's</ui-badge> }
                  </span>
                  <span class="choice__price">
                    @if (c.full && c.full !== c.price) { <s>{{ mvr(c.full) }}</s> }
                    {{ mvr(c.price) }}
                    @if (c.price) { <span class="choice__usd">{{ usd(c.price) }}</span> }
                  </span>
                  <span class="choice__what">{{ c.what }}</span>
                </button>
              }
            </div>
          }

          @if (waiting()) {
            <ui-alert tone="info" class="note">
              Online payment is almost here. Send us the request and we'll add the {{ picked() }} pass; we'll
              email you when it's on, and you can finish and send then.
            </ui-alert>
          }

          <div class="actions">
            <ui-button variant="primary" size="lg" [loading]="busy()" (click)="go()">{{ actionLabel() }}</ui-button>
            @if (waiting()) {
              <ui-button variant="ghost" (click)="picked.set('Free')">Go Free for now</ui-button>
            }
          </div>
        } @else {
          <div class="centered"><ui-spinner /></div>
        }
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: clamp(2rem, 5vw, 3.5rem) 0 4rem; }
    .head { margin-bottom: 1.5rem; }
    .lead { display: block; color: var(--ui-color-text-muted); margin-top: 0.6rem; }
    .centered { display: flex; justify-content: center; padding: 3rem 0; }
    .note { display: block; margin-bottom: 1rem; }
    .choices { display: flex; flex-direction: column; gap: 0.75rem; }
    .choice {
      display: flex; flex-direction: column; gap: 0.3rem; text-align: left; width: 100%;
      padding: 1rem 1.1rem; border-radius: var(--ui-radius, 12px); cursor: pointer; font: inherit;
      color: var(--ui-color-text); background: var(--ui-color-surface); border: 1.5px solid var(--ui-color-border);
    }
    .choice--on { border-color: var(--ui-color-primary); box-shadow: 0 0 0 1px var(--ui-color-primary); }
    .choice:disabled { opacity: 0.5; cursor: default; }
    .choice__top { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
    .choice__name { font-weight: 700; font-size: 1.05rem; }
    .choice__price { font-weight: 700; }
    .choice__price s { color: var(--ui-color-text-muted); font-weight: 400; margin-right: 0.3rem; }
    .choice__usd { color: var(--ui-color-text-muted); font-weight: 400; font-size: 0.85em; margin-left: 0.3rem; }
    .choice__what { color: var(--ui-color-text-muted); font-size: 0.9rem; }
    .actions { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-top: 1.5rem; }
  `,
})
export class PhotosStepComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();
  /** 'dashboard' for an event with no invitation: it finishes here and opens on its dashboard. */
  readonly then = input<string | undefined>(undefined);

  protected readonly stepKey = WizardStepKey.Photos;
  protected readonly mvr = mvr;
  protected readonly usd = usd;

  private readonly summary = signal<CampaignSummary | null>(null);
  protected readonly event = signal<BillingEvent | null>(null);
  protected readonly picked = signal<Choice>('Free');
  protected readonly busy = signal(false);
  /** A pass chosen while online payment is off: we add it by hand. */
  protected readonly waiting = signal(false);

  protected readonly saveTheDate = computed(() => this.summary()?.kind === 'saveTheDate');
  /** An event with no invitation: finished here rather than at Share. */
  private readonly photosOnly = computed(() => this.then() === 'dashboard' || !this.summary()?.template?.packageUrl);
  protected readonly inWizard = computed(() => !this.photosOnly());
  protected readonly steps = computed(() => {
    const s = this.summary();
    return s ? wizardFlowFor(s) : wizardFlowFor({ isImported: false, template: null });
  });
  protected readonly eyebrow = computed(() => wizardStepEyebrow(WizardStepKey.Photos, undefined, this.steps()));

  protected readonly choices = computed(() => {
    const e = this.event();
    if (!e) return [];
    const free = plan('Free');
    const has = e.passActive ? e.pass : null;
    return [
      {
        key: 'Free' as Choice, name: 'Free', price: 0, full: 0, current: !has,
        disabled: !!has,
        what: this.saveTheDate()
          ? 'Share your link yourself. No emails sent for you.'
          : `${free.eventBytes ? Math.round(free.eventBytes / 1024 ** 3) : 1} GB of photos, one album, guests add photos ${windowLine(free.maxWindowDays)}. Share your link yourself.`,
      },
      {
        key: 'Party' as Choice, name: 'Party pass', price: e.offer.partyPass, full: e.offer.fullPartyPass, current: has === 'Party',
        disabled: has === 'Wedding',
        what: passSummary(plan('PartyPass')),
      },
      {
        key: 'Wedding' as Choice, name: 'Wedding pass', price: e.offer.weddingPass, full: e.offer.fullWeddingPass, current: has === 'Wedding',
        disabled: false,
        what: passSummary(plan('WeddingPass')),
      },
    ];
  });

  /** What pressing the button does, said on it. */
  protected readonly actionLabel = computed(() => {
    const e = this.event();
    const choice = this.picked();
    const buying = !!e && !e.atVenue && choice !== 'Free' && !(e.passActive && e.pass === choice);
    if (buying) return this.waiting() ? 'Send us the request' : `Get the ${choice} pass`;
    return this.photosOnly() ? 'Finish' : 'Continue';
  });

  ngOnInit(): void {
    const id = this.campaignId();
    forkJoin({ summary: this.api.getCampaignSummaryQuiet(id), event: this.api.billingEvent(id) }).subscribe({
      next: ({ summary, event }) => {
        this.summary.set(summary);
        this.event.set(event);
        this.picked.set(event.passActive ? (event.pass as Choice) : 'Free');
      },
      error: () => this.router.navigate(['/dashboard', id]),
    });
    // Back from the gateway's page: the pass is applied by its webhook, usually before this loads.
    if (this.route.snapshot.queryParamMap.get('paid')) this.toast.success('Payment received. Your pass is on.');
  }

  protected go(): void {
    const e = this.event();
    if (!e || this.busy()) return;
    const choice = this.picked();
    const buying = !e.atVenue && choice !== 'Free' && !(e.passActive && e.pass === choice);

    if (!buying) {
      this.finish();
      return;
    }
    if (this.waiting()) {
      void this.router.navigate(['/inquire'], { queryParams: { topic: choice === 'Wedding' ? 'wedding' : 'party', event: e.campaignId } });
      return;
    }

    const item: BillingItem = choice === 'Wedding' ? 'wedding-pass' : 'party-pass';
    const back = `/create/${e.campaignId}/photos${this.then() === 'dashboard' ? '?then=dashboard' : ''}`;
    this.busy.set(true);
    this.api.billingCheckout(item, e.campaignId, 1, back).subscribe({
      next: (r) => {
        this.busy.set(false);
        if (r.available && r.checkoutUrl) {
          window.location.href = r.checkoutUrl;
          return;
        }
        this.waiting.set(true);
      },
      error: () => this.busy.set(false),
    });
  }

  /** On to Share, or — with nothing to send — finished now and open on its dashboard. */
  private finish(): void {
    const id = this.campaignId();
    if (!this.photosOnly()) {
      void this.router.navigate(['/create', id, 'delivery']);
      return;
    }
    this.busy.set(true);
    this.api.activateCampaign(id).subscribe({
      next: () => {
        this.busy.set(false);
        void this.router.navigate(['/dashboard', id]);
      },
      error: () => this.busy.set(false),
    });
  }
}
