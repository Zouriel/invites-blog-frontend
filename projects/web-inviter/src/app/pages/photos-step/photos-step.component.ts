import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import {
  WIZARD_STEPS,
  WIZARD_STEPS_IMPORTED,
  wizardStepEyebrow,
} from '../../shared/utils/constants/app.constants';
import { MediaBucket } from '../../shared/utils/types/api.types';
import { formatBytes, mvr, passSummary, plan, planLabel, usd, windowLine } from '../../shared/utils/plans';

/**
 * Room for photos: what this event's plan gives the camera, and where to get more.
 *
 * <p>Every event has a media bucket. How much it holds comes from the organiser's plan (or an event
 * pass on the event), not from a size chosen here. It comes after the invitation wizard, just before
 * Share, and it is also the only step for an event with no invitation at all; `?then=dashboard` sends
 * the host to the event instead of on to Share.</p>
 *
 * <p>The bucket is normally made with the event. If it is missing it is made here, so this step always
 * has one to describe.</p>
 */
@Component({
  selector: 'app-photos-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCard, UiSpinner, UiText, WizardStepsComponent],
  template: `
    <section class="wrap">
      <div class="ib-container ib-container--narrow">
        @if (inWizard()) {
          <app-wizard-steps [active]="stepKey" [steps]="steps()" [campaignId]="campaignId()" />
        }
        <header class="head">
          <span class="eyebrow">{{ inWizard() ? eyebrow() : 'Photos' }}</span>
          <ui-text variant="h1">Room for photos</ui-text>
          <ui-text variant="body" class="lead">
            Guests can add photos and videos {{ freeWindow }}, and for longer with a pass.
            How much your event can hold depends on its plan.
          </ui-text>
        </header>

        @if (bucket(); as b) {
          <ui-card padding="lg">
            <div class="now">
              <span class="now__label">This event</span>
              <span class="now__plan">{{ planName() }}</span>
              <span class="now__space">{{ space() }} of photos and videos</span>
            </div>

            @if (b.tier === 'Free') {
              <ul class="options">
                @for (p of passes; track p.kind) {
                  <li>
                    <strong>{{ p.name }}</strong> · {{ summary(p) }} ·
                    {{ mvr(p.price) }} <span class="usd">{{ usd(p.price) }}</span> for this event ·
                    <a routerLink="/inquire" [queryParams]="{ topic: p.kind === 'WeddingPass' ? 'wedding' : 'party', event: campaignId() }">Ask us to add it</a>
                  </li>
                }
              </ul>
              <p class="note">
                Free keeps photos for {{ free.retentionDays }} days after the event; a pass keeps them for a year.
                <a routerLink="/pricing">See the plans</a>
              </p>
            } @else {
              @if (current(); as c) {
                <p class="note">Includes {{ summary(c) }}.</p>
              }
              <p class="note">
                You can see everything that's included on the <a routerLink="/pricing">plans page</a>.
              </p>
            }
          </ui-card>

          <div class="actions">
            <ui-button variant="primary" size="lg" (click)="next()">Continue</ui-button>
          </div>
        } @else {
          <div class="centered"><ui-spinner /></div>
        }
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: clamp(2rem, 5vw, 3.5rem) 0 4rem; }
    .head { margin-bottom: 1.75rem; }
    .lead { display: block; color: var(--ui-color-text-muted); margin-top: 0.6rem; }
    .centered { display: flex; justify-content: center; padding: 3rem 0; }
    .now { display: flex; flex-direction: column; gap: 0.2rem; }
    .now__label { font-size: 0.75rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .now__plan { font-size: 1.5rem; font-weight: 700; }
    .now__space { color: var(--ui-color-text-muted); }
    .options { list-style: none; margin: 1.25rem 0 0; padding: 1rem 0 0; border-top: 1px solid var(--ui-color-border);
      display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.95rem; }
    .note { margin: 1rem 0 0; font-size: 0.9rem; color: var(--ui-color-text-muted); }
    .usd { color: var(--ui-color-text-muted); font-size: 0.85em; }
    .options a { color: var(--ui-color-primary); font-weight: 600; }
    .note a { color: var(--ui-color-primary); font-weight: 600; }
    .actions { display: flex; gap: 0.75rem; align-items: center; margin-top: 1.5rem; }
  `,
})
export class PhotosStepComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly campaignId = input.required<string>();
  /** 'dashboard' when there is no invitation to share, so the host goes to the event instead. */
  readonly then = input<string | undefined>(undefined);

  protected readonly stepKey = WizardStepKey.Photos;
  protected readonly inWizard = computed(() => this.then() !== 'dashboard');

  private readonly isImported = signal(false);
  protected readonly steps = computed(() => (this.isImported() ? WIZARD_STEPS_IMPORTED : WIZARD_STEPS));
  protected readonly eyebrow = computed(() => wizardStepEyebrow(WizardStepKey.Photos, undefined, this.steps()));

  protected readonly bucket = signal<MediaBucket | null>(null);
  protected readonly passes = [plan('PartyPass'), plan('WeddingPass')];
  protected readonly free = plan('Free');
  protected readonly summary = passSummary;
  protected readonly mvr = mvr;
  protected readonly usd = usd;
  protected readonly freeWindow = windowLine(plan('Free').maxWindowDays);
  /** The event's plan when it has one worth describing: a pass or a venue's. */
  protected readonly current = computed(() => {
    const t = this.bucket()?.tier;
    return t === 'PartyPass' || t === 'WeddingPass' || t === 'Venue' ? plan(t) : null;
  });
  protected readonly planName = computed(() => planLabel(this.bucket()?.tier ?? 'Free'));
  protected readonly space = computed(() => formatBytes(this.bucket()?.capacityBytes ?? 0));

  ngOnInit(): void {
    this.api.getCampaignSummaryQuiet(this.campaignId()).subscribe({
      next: (s) => {
        // A save the date has no album, so this step has nothing to say: on to sharing it.
        if (s.kind === 'saveTheDate') {
          this.next();
          return;
        }
        this.isImported.set(!!s.isImported);
        this.loadBucket();
      },
      error: () => this.loadBucket(),
    });
  }

  private loadBucket(): void {
    this.api.campaignBucket(this.campaignId()).subscribe({
      next: (b) => (b ? this.bucket.set(b) : this.makeBucket()),
      error: () => this.makeBucket(),
    });
  }

  private makeBucket(): void {
    this.api.createCampaignBucket(this.campaignId()).subscribe({
      next: (b) => this.bucket.set(b),
      error: () => this.next(),
    });
  }

  protected next(): void {
    void this.router.navigate(
      this.inWizard() ? ['/create', this.campaignId(), 'delivery'] : ['/dashboard', this.campaignId()],
    );
  }
}
