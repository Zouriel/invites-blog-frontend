import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAvatar, UiBadge } from '@zouriel/ui/badge';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { EventTileComponent } from '../../shared/event-tile/event-tile.component';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { SessionStore } from '../../shared/services/session.store';
import { planLabel } from '../../shared/utils/plans';
import { MyCampaign } from '../../shared/utils/types/api.types';

/**
 * Me: who is signed in, then the events they host. The account itself (how it's reached, its plan,
 * billing, signing out) is one tap further, behind the gear.
 */
@Component({
  selector: 'app-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, EventTileComponent, HugeiconsIconComponent, RouterLink,
    UiAvatar, UiBadge, UiButton, UiEmptyState, UiIconButton, UiSpinner, UiText,
  ],
  templateUrl: './me.component.html',
  styleUrl: './me.component.scss',
})
export class MeComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  protected readonly appIcons = APP_ICONS;
  protected readonly planLabel = planLabel;
  protected readonly account = this.session.account;

  protected readonly loading = signal(true);
  private readonly all = signal<MyCampaign[]>([]);

  /** A cancelled event isn't listed. */
  protected readonly hosted = computed(() => this.all().filter((c) => c.status !== 'Cancelled'));

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
