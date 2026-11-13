import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
// One module per icon, not the package barrel (the barrel is 12,000 modules).
import Album02Icon from '@hugeicons/core-free-icons/Album02Icon';
import BrowserIcon from '@hugeicons/core-free-icons/BrowserIcon';
import InstagramIcon from '@hugeicons/core-free-icons/InstagramIcon';
import PlayStoreIcon from '@hugeicons/core-free-icons/PlayStoreIcon';
import ArrowRight01Icon from '@hugeicons/core-free-icons/ArrowRight01Icon';
import BubbleChatIcon from '@hugeicons/core-free-icons/BubbleChatIcon';
import FavouriteIcon from '@hugeicons/core-free-icons/FavouriteIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { UiAvatar, UiChip, UiStoreBadge } from '@zouriel/ui/badge';
import { UiLink } from '@zouriel/ui/link';
import { UiButton } from '@zouriel/ui/button';
import { UiCarousel, UiCarouselSlide } from '@zouriel/ui/media';
import { UiReveal } from '@zouriel/ui/fx';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { PhoneFrameComponent } from '../../shared/device/phone-frame.component';
import { APP_STORE_URL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../../shared/utils/constants/app-links';
import { SessionHandoffService } from '../../shared/services/session-handoff.service';
import { HostSplit } from '../../shared/services/host-split';
import { OCCASIONS } from '../../shared/utils/constants/occasions';
import { catalog, designerAddOn, formatBytes, mvr, plan, spaceLadder, usd } from '../../shared/utils/plans';

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
  imports: [HugeiconsIconComponent, NgTemplateOutlet, PhoneFrameComponent, RouterLink, UiAvatar, UiChip, UiLink, UiStoreBadge, UiButton, UiCarousel, UiReveal, BrandMarkComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly destroyRef = inject(DestroyRef);

  protected readonly occasions = OCCASIONS;
  protected readonly appStoreUrl = APP_STORE_URL;
  protected readonly instagramUrl = INSTAGRAM_URL;
  protected readonly instagramHandle = INSTAGRAM_HANDLE;
  protected readonly playStoreIcon = PlayStoreIcon;
  protected readonly browserIcon = BrowserIcon;
  protected readonly instagramIcon = InstagramIcon;
  private readonly split = inject(HostSplit);
  private readonly handoff = inject(SessionHandoffService);
  private readonly router = inject(Router);

  /** The web app at app.invites.blog (taking the sign-in along, if this browser has one here). */
  protected useInBrowser(): void {
    if (this.split.enabled) void this.handoff.goToApp('/feed');
    else void this.router.navigateByUrl('/feed');
  }

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

  /** What the template designer can do, in plain words. */
  protected readonly designerFeatures = [
    'A timeline with keyframes: things fade, fly, spin, grow, draw themselves and loop',
    'Text that splits into words or letters, with fonts to pick from',
    'Shapes, a pen and brushes, and thousands of free public-domain pictures to import',
    'Fields guests fill in: their name, the date, the venue, a reply button and a camera',
    'Works on a phone as well as a computer',
    'Publish privately, for one person, or to the public Templates gallery',
  ];

  protected readonly designerSteps = [
    { title: '1. Start', text: 'Begin from a starter or a blank page.' },
    { title: '2. Design and animate', text: 'Place things, then set when and how they move.' },
    { title: '3. Preview', text: 'Scroll it as a guest would, on a phone-sized screen.' },
    { title: '4. Publish', text: 'Use it for your event, or share it in the gallery.' },
  ];

  /** The smaller features, each one line. */
  protected readonly features = [
    { title: 'Send it your way', text: 'Email goes out automatically. Send from your own WhatsApp, Viber or Telegram with one tap per guest, from any country.' },
    { title: 'The right time, everywhere', text: 'Every date is shown in the event’s time zone, in your language’s order, with your own time beside it when it differs.' },
    { title: 'Replies and guest list', text: 'Upload a guest list or add people one by one, give each a role, and watch the replies. Or let visitors reply with their name.' },
    { title: 'Save the date', text: 'Send a date first, with Add to calendar, and turn it into the full invitation later.' },
    { title: 'Download everything', text: 'Select photos by pressing and holding, save them to your gallery, share them to any app, or download a whole album as one zip.' },
    { title: 'Favourites and filters', text: 'Double-tap a photo to heart it, see the counts, find your hearts in one place, and filter an album by person or by photos and videos.' },
  ];

  protected readonly free = [
    'Any design, animated or your own, and the designer to make one',
    'Your guest list and every reply',
    'Sharing the links yourself',
    `${formatBytes(plan('Free').eventBytes!)} of photos and videos for every event`,
    'Your event’s page, with likes and comments',
  ];

  protected readonly paid = [
    `A big event needs more: a Gold pass is ${mvr(plan('GoldPass').price)} (${usd(plan('GoldPass').price)}), a Platinum pass ${mvr(plan('PlatinumPass').price)} (${usd(plan('PlatinumPass').price)}), once per event`,
    `invites.blog emails your guests for you: ${mvr(catalog().sending.perBlock)} per ${catalog().sending.blockSize}, or included with a pass`,
    `You want the photos kept past their plan: ${mvr(catalog().keepPhotos.price)} a year`,
    `You host often: Premium, ${mvr(plan('Premium').price)} a month, gives every event ${formatBytes(plan('Premium').eventBytes!)}, keeps its photos and downloads whole albums; add the AI designer for ${mvr(designerAddOn().price)} more`,
    `You run events for a living: Studio, ${mvr(plan('Venue').price)} a month, gives every event you organise ${formatBytes(plan('Venue').eventBytes!)} and puts your picture and name on its albums and posts`,
    `You're a photographer: Photographer, ${mvr(plan('Photographer').price)} a month, gives you a portfolio page and every event you organise ${formatBytes(plan('Photographer').eventBytes!)}`,
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
