import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { WizardStepsComponent } from '../../features/wizard/wizard-steps.component';
import { ApiService } from '../../shared/api/api.service';
import { WizardStepKey } from '../../shared/utils/enums/app.enums';
import {
  WIZARD_STEPS,
  WIZARD_STEPS_IMPORTED,
  wizardStepEyebrow,
} from '../../shared/utils/constants/app.constants';
import { MediaBucket, MediaBucketPlan } from '../../shared/utils/types/api.types';

/**
 * How much room the event's photos get.
 *
 * <p>Every event has a media bucket, and it starts on the free size. This step is where the host can
 * move it to a bigger one; skipping keeps the free one. It comes after the invitation wizard, just
 * before Share, and it is also the only step for an event with no invitation at all — in that case
 * `?then=dashboard` sends the host to the event instead of on to Share.</p>
 *
 * <p>The bucket is normally made with the event. If it is missing (an event started before that, or
 * a request that failed) it is made here, so this step never has nothing to size.</p>
 */
@Component({
  selector: 'app-photos-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiCard, UiSpinner, UiText, WizardStepsComponent],
  template: `
    <section class="wrap">
      <div class="ib-container ib-container--narrow">
        @if (inWizard()) {
          <app-wizard-steps [active]="stepKey" [steps]="steps()" />
        }
        <header class="head">
          <span class="eyebrow">{{ inWizard() ? eyebrow() : 'Photos' }}</span>
          <ui-text variant="h1">Room for photos</ui-text>
          <ui-text variant="body" class="lead">
            Guests can add photos and videos from the night to your event. It comes with 2 GB for free,
            which is a few hundred photos. For a big event you can pick more space.
          </ui-text>
        </header>

        @if (!bucket()) {
          <div class="centered"><ui-spinner /></div>
        } @else {
          <ui-card padding="lg">
            <div class="plans">
              <button type="button" class="plan" [class.plan--picked]="picked() === 'Free'" (click)="picked.set('Free')"
                      [disabled]="!freeAvailable()">
                <span class="plan__gb">{{ freeGb() }} GB</span>
                <span class="plan__price">Free</span>
                <span class="plan__term">included</span>
              </button>
              @for (plan of plans(); track plan.tier) {
                <button type="button" class="plan" [class.plan--picked]="picked() === plan.tier" (click)="picked.set(plan.tier)">
                  <span class="plan__gb">{{ plan.gb }} GB</span>
                  <span class="plan__price">{{ plan.currency }} {{ plan.price }}</span>
                  <span class="plan__term">every {{ plan.termMonths }} months</span>
                </button>
              }
            </div>
            <p class="note">You can change this later from the event page.</p>
          </ui-card>

          <div class="actions">
            <ui-button variant="primary" size="lg" [loading]="saving()" (click)="save()">
              {{ changing() ? 'Save and continue' : 'Continue' }}
            </ui-button>
            <ui-button variant="ghost" [disabled]="saving()" (click)="next()">Skip</ui-button>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: clamp(2rem, 5vw, 3.5rem) 0 4rem; }
    .head { margin-bottom: 1.75rem; }
    .lead { display: block; color: var(--ui-color-text-muted); margin-top: 0.6rem; }
    .centered { display: flex; justify-content: center; padding: 3rem 0; }
    .plans { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 0.75rem; }
    .plan { display: flex; flex-direction: column; align-items: flex-start; gap: 0.15rem; padding: 0.9rem 1rem;
      font: inherit; text-align: left; color: inherit; background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); cursor: pointer; }
    .plan:disabled { opacity: 0.5; cursor: default; }
    .plan:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .plan--picked { border-color: var(--ui-color-primary);
      box-shadow: 0 0 0 1px var(--ui-color-primary); background: color-mix(in srgb, var(--ui-color-primary) 8%, var(--ui-color-surface)); }
    .plan__gb { font-size: 1.25rem; font-weight: 700; }
    .plan__price { font-weight: 600; }
    .plan__term { font-size: 0.8rem; color: var(--ui-color-text-muted); }
    .note { margin: 1rem 0 0; font-size: 0.85rem; color: var(--ui-color-text-muted); }
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
  protected readonly plans = signal<MediaBucketPlan[]>([]);
  protected readonly picked = signal<string>('Free');
  protected readonly saving = signal(false);

  /** The free size as the bucket reports it, so a change in configuration shows the right number. */
  protected readonly freeGb = computed(() => (this.bucket()?.tier === 'Free' ? this.bucket()!.gb : 2));
  /** A bucket already moved onto a paid size can't go back down to free from here. */
  protected readonly freeAvailable = computed(() => this.bucket()?.tier === 'Free');
  protected readonly changing = computed(() => !!this.bucket() && this.picked() !== this.bucket()!.tier);

  ngOnInit(): void {
    if (this.inWizard()) {
      this.api.getCampaignSummary(this.campaignId()).subscribe({
        next: (s) => this.isImported.set(!!s.isImported),
        error: () => {},
      });
    }

    this.api.campaignBucket(this.campaignId()).subscribe({
      next: (b) => (b ? this.use(b) : this.makeBucket()),
      error: () => this.makeBucket(),
    });
  }

  private makeBucket(): void {
    this.api.createCampaignBucket(this.campaignId()).subscribe({
      next: (b) => this.use(b),
      error: () => this.next(),
    });
  }

  private use(b: MediaBucket): void {
    this.bucket.set(b);
    this.picked.set(b.tier);
    this.api.mediaBucketPlans(b.id).subscribe({ next: (p) => this.plans.set(p), error: () => {} });
  }

  protected save(): void {
    const b = this.bucket();
    if (!b || this.saving()) return;
    if (!this.changing()) {
      this.next();
      return;
    }
    this.saving.set(true);
    this.api.chooseMediaBucketTier(b.id, this.picked()).subscribe({
      next: () => this.next(),
      error: () => this.saving.set(false),
    });
  }

  protected next(): void {
    void this.router.navigate(
      this.inWizard() ? ['/create', this.campaignId(), 'delivery'] : ['/dashboard', this.campaignId()],
    );
  }
}
