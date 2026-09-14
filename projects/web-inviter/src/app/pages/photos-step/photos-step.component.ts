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
import { formatBytes, planLabel } from '../../shared/utils/plans';

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
            Guests can add photos and videos to your event from the day before it until the day after.
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
                <li><strong>Basic</strong> · 20 GB to share out, up to 10 GB per event · $12 a year</li>
                <li><strong>Event pass</strong> · 50 GB for this event, sending to 50 guests included · $19 once</li>
                <li><strong>Premium</strong> · 200 GB to share out, up to 50 GB per event · $9 a month</li>
              </ul>
              <p class="note">
                The free plan keeps photos for 90 days after the event.
                <a routerLink="/pricing">See the plans</a> to keep more, for longer.
              </p>
            } @else {
              <p class="note">
                You can see what's included on the <a routerLink="/pricing">plans page</a>.
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
  protected readonly planName = computed(() => planLabel(this.bucket()?.tier ?? 'Free'));
  protected readonly space = computed(() => formatBytes(this.bucket()?.capacityBytes ?? 0));

  ngOnInit(): void {
    if (this.inWizard()) {
      this.api.getCampaignSummary(this.campaignId()).subscribe({
        next: (s) => this.isImported.set(!!s.isImported),
        error: () => {},
      });
    }

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
