import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAvatar, UiBadge } from '@zouriel/ui/badge';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiPosterGrid, UiPosterView } from '@zouriel/ui/media';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { eventPoster } from '../../shared/event-poster/event-poster';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { SessionStore } from '../../shared/services/session.store';
import { planLabel, planTier } from '../../shared/utils/plans';
import { MyCampaign } from '../../shared/utils/types/api.types';

/**
 * Me: who is signed in, then the events they host. The account itself (how it's reached, its plan,
 * billing, signing out) is one tap further, behind the gear.
 */
@Component({
  selector: 'app-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, HugeiconsIconComponent, RouterLink,
    UiAvatar, UiBadge, UiButton, UiEmptyState, UiIconButton, UiPosterGrid, UiPosterView, UiSpinner, UiText,
  ],
  templateUrl: './me.component.html',
  styleUrls: ['./me.component.scss', '../../shared/event-poster/event-poster.scss'],
})
export class MeComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly appIcons = APP_ICONS;
  protected readonly planLabel = planLabel;
  protected readonly planTier = planTier;
  protected readonly account = this.session.account;

  protected readonly loading = signal(true);
  private readonly all = signal<MyCampaign[]>([]);

  /** A cancelled event isn't listed. */
  protected readonly hosted = computed(() => this.all().filter((c) => c.status !== 'Cancelled'));

  /**
   * Pictures only. The one thing a tile may say is that an event isn't finished (a dot): the old
   * "Not finished · Continue" badge was how a host found the draft they had left, and a grid of
   * pictures would otherwise hide it.
   */
  protected readonly posters = computed(() =>
    this.hosted().map((c) => eventPoster(c.title, c.previewImageUrl, c.colours, this.unfinished(c) ? { tone: 'warning', label: 'Not finished' } : null)),
  );

  protected readonly open = signal(false);
  private readonly index = signal(0);
  protected readonly current = computed(() => this.hosted()[this.index()] ?? null);
  protected readonly currentPoster = computed(() => this.posters()[this.index()] ?? null);

  protected show(i: number): void {
    this.index.set(i);
    this.open.set(true);
  }

  /** Waiting for the host: a wizard step left, or a save the date that never got its design. */
  protected unfinished(c: MyCampaign): boolean {
    return !!c.resumeStep || (c.kind === 'saveTheDate' && c.mediaOnly);
  }

  /** The one line under the name: however this person is reached. */
  protected readonly contact = computed(() => {
    const a = this.account();
    return [a?.email, a?.phoneE164].filter(Boolean).join(' · ');
  });

  constructor() {
    this.api.myCampaigns().subscribe({
      next: (list) => {
        this.all.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openSettings(): void {
    void this.router.navigate(['/me/settings']);
  }

  /** An unfinished event picks up where it was left; a finished one opens its dashboard. */
  protected link(c: MyCampaign): unknown[] {
    return c.resumeStep ? ['/create', c.id, c.resumeStep] : ['/dashboard', c.id];
  }
}
