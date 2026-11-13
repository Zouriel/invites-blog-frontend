import { EventDayPipe } from '../../shared/pipes/event-time.pipe';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAvatarTag } from '@zouriel/ui/avatar-tag';
import { UiAvatar, UiBadge } from '@zouriel/ui/badge';
import { UiIconButton } from '@zouriel/ui/button';
import { UiEmptyState, UiStarterCard } from '@zouriel/ui/feedback';
import { UiChecklist, UiChecklistItem, UiHintOnce, UiTourAnchor } from '@zouriel/ui/guidance';
import { EmptyArtComponent } from '../../shared/guidance/empty-art.component';
import { GuidanceService } from '../../shared/guidance/guidance.service';
import { TIP, TIP_TEXT } from '../../shared/guidance/tips';
import { UiPosterAction, UiPosterCorner, UiPosterDetails, UiPosterGrid } from '@zouriel/ui/media';
import { InvitePreviewService } from '../../shared/services/invite-preview.service';
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
  imports: [EventDayPipe, 
    EmptyArtComponent, HugeiconsIconComponent,
    UiAvatar, UiAvatarTag, UiBadge, UiChecklist, UiEmptyState, UiHintOnce, UiIconButton, UiPosterAction, UiPosterCorner, UiPosterDetails, UiPosterGrid, UiSpinner,
    UiStarterCard, UiText, UiTourAnchor,
  ],
  templateUrl: './me.component.html',
  styleUrls: ['./me.component.scss', '../../shared/event-poster/event-poster.scss'],
})
export class MeComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly session = inject(SessionStore);
  private readonly previews = inject(InvitePreviewService);

  /** "View invite" on a tile: any event with an invitation to look at (not a photos-only album). */
  protected canPreview(c: MyCampaign | undefined): boolean {
    return !!c && !c.mediaOnly;
  }

  protected viewInvite(c: MyCampaign): void {
    this.previews.open(c.id);
  }

  protected readonly appIcons = APP_ICONS;
  protected readonly planLabel = planLabel;
  protected readonly planTier = planTier;
  protected readonly account = this.session.account;
  protected readonly guidance = inject(GuidanceService);
  protected readonly settingsTip = TIP_TEXT.meSettings;

  protected readonly loading = signal(true);
  private readonly all = signal<MyCampaign[]>([]);

  /** A cancelled event isn't listed. */
  protected readonly hosted = computed(() => this.all().filter((c) => c.status !== 'Cancelled'));

  /**
   * A dot also flags an unfinished event: it was how a host found the draft they had left, and it
   * shows before the words are read.
   */
  protected readonly posters = computed(() =>
    this.hosted().map((c) => eventPoster(c.title, c.previewImageUrl, c.colours, this.router.serializeUrl(this.router.createUrlTree(this.link(c))), this.unfinished(c) ? { tone: 'warning', label: 'Not finished' } : null)),
  );

  /** Same place the rows went; a Ctrl/Cmd click still opens a new tab (the tile is a link). */
  protected open(i: number): void {
    const href = this.posters()[i]?.href;
    if (href) void this.router.navigateByUrl(href);
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

  /** The newest event this account organises: where the checklist's guest, send and photo steps go. */
  private readonly newest = computed(() =>
    this.hosted()
      .filter((c) => c.relation !== 'celebrant')
      .reduce<MyCampaign | null>((a, c) => (!a || c.createdAt > a.createdAt ? c : a), null),
  );

  /** Shown this visit even once everything is done ("All set"), then never again. */
  private readonly checklistOpen = signal(false);

  protected readonly checklist = computed<UiChecklistItem[] | null>(() => {
    if (!this.checklistOpen()) return null;
    const p = this.guidance.progress();
    return [
      { id: 'name', label: 'Add your name and photo', done: p.hasName && p.hasPhoto },
      { id: 'event', label: 'Start an event', done: p.hasEvent },
      { id: 'guests', label: 'Add your guests', done: p.hasGuests },
      { id: 'send', label: 'Send it or share the link', done: p.hasSent },
      { id: 'photo', label: 'Get your first photo', done: p.hasPhotoInAlbum },
    ];
  });

  protected openStep(id: string): void {
    const c = this.newest();
    switch (id) {
      case 'name':
        return this.go('/me/settings/profile');
      case 'event':
        return this.go('/events/new');
      case 'guests':
      case 'send':
        return c ? this.go(`/dashboard/${c.id}`, { tab: 'dashboard' }) : this.go('/events/new');
      case 'photo':
        return c ? this.go(`/dashboard/${c.id}`) : this.go('/events/new');
    }
  }

  protected closeChecklist(): void {
    this.checklistOpen.set(false);
    this.guidance.markSeen([TIP.checklist]);
  }

  protected go(path: string, queryParams?: Record<string, string>): void {
    void this.router.navigate([path], { queryParams });
  }

  constructor() {
    // Decided once the account's state is in: inside the first month, tips on, not closed before.
    let decided = false;
    effect(() => {
      const g = this.guidance;
      if (decided || !g.loaded()) return;
      decided = true;
      untracked(() => {
        if (!g.tipsOn() || !g.inWelcome() || g.isSeen(TIP.checklist)) return;
        this.checklistOpen.set(true);
        const p = g.progress();
        // Everything done: "All set" this once, and never again.
        if (p.hasName && p.hasPhoto && p.hasEvent && p.hasGuests && p.hasSent && p.hasPhotoInAlbum) g.markSeen([TIP.checklist]);
      });
    });
    // Tips turned off elsewhere (a tour's "Turn off tips") take the list away too.
    effect(() => {
      if (!this.guidance.tipsOn()) untracked(() => this.checklistOpen.set(false));
    });
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
