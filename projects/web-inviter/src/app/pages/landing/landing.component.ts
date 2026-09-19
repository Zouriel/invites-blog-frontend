import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
// One module per icon, not the package barrel (the barrel is 12,000 modules).
import Album02Icon from '@hugeicons/core-free-icons/Album02Icon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCarousel, UiCarouselSlide } from '@zouriel/ui/media';
import { UiReveal } from '@zouriel/ui/fx';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { PhoneFrameComponent } from '../../shared/device/phone-frame.component';
import { OCCASIONS } from '../../shared/utils/constants/occasions';
import { PLAN_CATALOG, formatBytes, mvr, plan, spaceLadder, usd } from '../../shared/utils/plans';

/**
 * The front door, for somebody who has never signed in.
 *
 * <p>It tells three things and one price, in the same quiet language as the app behind it: an
 * invitation (animated, or your own design), albums that collect everyone's photos, and the event
 * as a post people who were there can like and comment on. Then what is free. One idea per screen,
 * one real picture per idea, and nothing that moves unless it is the product.</p>
 */
@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, NgTemplateOutlet, PhoneFrameComponent, RouterLink, UiAvatar, UiButton, UiCarousel, UiReveal, BrandMarkComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly occasions = OCCASIONS;

  protected readonly qrIcon = QrCodeIcon;
  protected readonly albumIcon = Album02Icon;
  protected readonly arrowIcon = ArrowRight01Icon;
  protected readonly heartIcon = FavouriteIcon;
  protected readonly commentIcon = BubbleChatIcon;
  protected readonly tickIcon = Tick02Icon;

  /**
   * The example post's photos, each with the comment and likes shown while it's on screen. Real photos
   * from Pexels (free for commercial use, no attribution required).
   */
  protected readonly moments = [
    { photo: '/media/post-first-dance.v2.webp', alt: 'The couple kissing on a glowing dance floor under flowers', who: 'Leena', text: 'That glowing dance floor! Best first dance ever.', likes: 64 },
    { photo: '/media/post-sparklers.v2.webp', alt: 'Guests holding sparklers around the couple at night', who: 'Imran', text: 'The sparkler send-off was magic.', likes: 72 },
    { photo: '/media/post-cake.v2.webp', alt: 'The couple cutting a white rose cake together', who: 'Hassan', text: 'That cake was almost too pretty to cut.', likes: 41 },
    { photo: '/media/post-dancefloor.v2.webp', alt: 'Guests dancing under string lights', who: 'Mariyam', text: 'Nobody sat down once the music started.', likes: 57 },
    { photo: '/media/post-laughing.v2.webp', alt: 'Two friends laughing together', who: 'Aishath', text: 'Caught us mid-laugh. Love this one.', likes: 88 },
  ];
  protected readonly slides: UiCarouselSlide[] = this.moments.map((m) => ({ image: m.photo, alt: m.alt }));
  /** Which photo the example post is showing. Advanced by a timer in the browser only. */
  protected readonly moment = signal(0);

  /** Stand-in tiles for the bucket picture: how many, and how strongly each is tinted. */
  protected readonly tiles = [18, 32, 12, 26, 40, 16, 30, 22, 36];

  protected readonly free = [
    'Any design, animated or your own',
    'Your guest list and every reply',
    'Sharing the links yourself',
    `${formatBytes(plan('Free').eventBytes!)} of photos and videos for every event`,
    'Your event’s page, with likes and comments',
  ];

  protected readonly paid = [
    `A big event needs more: a Party pass is ${mvr(plan('PartyPass').price)} (${usd(plan('PartyPass').price)}), a Wedding pass ${mvr(plan('WeddingPass').price)} (${usd(plan('WeddingPass').price)}), once per event`,
    `invites.blog emails your guests for you: ${mvr(PLAN_CATALOG.sending.perBlock)} per ${PLAN_CATALOG.sending.blockSize}, or included with a pass`,
    `You want the photos kept past their plan: ${mvr(PLAN_CATALOG.keepPhotos.price)} a year`,
    `You do this for a living: Studio for designers and planners, Venue for resorts and halls`,
  ];

  protected readonly spaceFact = spaceLadder().replace(/^./, (c) => c.toUpperCase()) + '.';

  private readonly heroVideo = viewChild<ElementRef<HTMLVideoElement>>('heroVideo');
  private readonly inviteVideo = viewChild<ElementRef<HTMLVideoElement>>('inviteVideo');

  constructor() {
    // Both recordings (Velvet Curtain in the phone, A Love Story beside "Animated"). The page is
    // prerendered, so each video element exists before Angular sets it muted, and a browser only
    // autoplays a muted video. Start them once the app is running, unless the reader prefers less
    // motion (then the stills show and the videos stay paused).
    afterNextRender(() => {
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      for (const ref of [this.heroVideo(), this.inviteVideo()]) {
        const video = ref?.nativeElement;
        if (!video) continue;
        if (reduced) {
          video.pause();
          continue;
        }
        video.muted = true;
        if (video.paused) void video.play().catch(() => {});
      }
    });

    // The example post swipes through its photos on its own. Started here, in the browser, rather
    // than with the carousel's autoplay: a timer running during prerender would keep the page from
    // ever settling. Not for anyone who prefers less motion.
    afterNextRender(() => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const timer = window.setInterval(() => this.moment.update((i) => (i + 1) % this.moments.length), 3800);
      this.destroyRef.onDestroy(() => window.clearInterval(timer));
    });
  }
}
