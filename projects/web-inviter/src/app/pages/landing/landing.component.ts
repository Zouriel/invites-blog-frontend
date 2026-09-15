import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
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
import { ApiService } from '../../shared/api/api.service';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { PhoneFrameComponent } from '../../shared/device/phone-frame.component';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';
import { OCCASIONS } from '../../shared/utils/constants/occasions';
import { Template } from '../../shared/utils/types/api.types';

/** The live design's loop: a pause at the top, slowly down, a pause at the end, slowly back up. */
const LOOP_HOLD_MS = 1500;
const LOOP_RUN_MS = 36000;

function loopProgress(clock: number): number {
  const ease = (x: number) => 0.5 - Math.cos(Math.PI * x) / 2;
  const at = clock % (2 * (LOOP_HOLD_MS + LOOP_RUN_MS));
  if (at < LOOP_HOLD_MS) return 0;
  if (at < LOOP_HOLD_MS + LOOP_RUN_MS) return ease((at - LOOP_HOLD_MS) / LOOP_RUN_MS);
  if (at < 2 * LOOP_HOLD_MS + LOOP_RUN_MS) return 1;
  return 1 - ease((at - 2 * LOOP_HOLD_MS - LOOP_RUN_MS) / LOOP_RUN_MS);
}

/**
 * The front door, for somebody who has never signed in.
 *
 * <p>It tells three things and one price, in the same quiet language as the app behind it: an
 * invitation (animated, or your own design), a bucket that collects everyone's photos, and the event
 * as a post people who were there can like and comment on. Then what is free. One idea per screen,
 * one real picture per idea, and nothing that moves unless it is the product.</p>
 */
@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, NgTemplateOutlet, PhoneFrameComponent, RouterLink, SafeUrlPipe, UiAvatar, UiButton, UiCarousel, UiReveal, BrandMarkComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly templates = signal<Template[]>([]);
  /** Posters that failed to load; those fall back to the drawn card. */
  private readonly broken = signal(new Set<string>());

  /** Real designs with a real poster image. A preview that points at a page is not an image. */
  private readonly posters = computed(() =>
    this.templates()
      .filter((t) => !t.isShowcase && !!t.previewImageUrl && !t.previewImageUrl.endsWith('.html'))
      .filter((t) => !this.broken().has(t.previewImageUrl!)),
  );

  /** The design beside "Animated": Layla & Yusuf (A Love Story), whose big lettering reads at a glance. */
  protected readonly animatedDesign = computed(
    () => this.posters().find((t) => t.slug === 'a-love-story') ?? this.posters()[0] ?? null,
  );

  /** The design itself, not its picture: the page a guest opens. */
  protected readonly liveUrl = computed(() => {
    const t = this.animatedDesign();
    return t?.packageUrl ? t.packageUrl + 'index.html' : null;
  });
  /** In the browser, once the card is near the screen, the real design loads over its poster. */
  protected readonly liveOn = signal(false);
  /** The design has loaded, so it can fade in over the poster and start taking the scroll. */
  protected readonly liveReady = signal(false);
  private lastProgress = -1;
  /** Whether enough of the card is on screen to be worth playing. */
  private liveVisible = false;
  /** Milliseconds of play so far; paused time doesn't count. */
  private liveClock = 0;
  private liveFrameRequest = 0;

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
    '500 MB of photos and videos for every event',
    'Your event’s page, with likes and comments',
  ];

  protected readonly paid = [
    'invites.blog emails your guests for you, from $5 for 50 guests',
    'Your event needs more photo space, from $12 a year',
  ];

  private readonly heroVideo = viewChild<ElementRef<HTMLVideoElement>>('heroVideo');
  private readonly liveArt = viewChild<ElementRef<HTMLElement>>('liveArt');
  private readonly liveFrame = viewChild<ElementRef<HTMLIFrameElement>>('liveFrame');

  constructor() {
    // The page is prerendered, so the video element exists before Angular sets it muted, and a
    // browser only autoplays a muted video. Start it once the app is running, unless the reader
    // prefers less motion (then the still shows and the video stays paused).
    afterNextRender(() => {
      const video = this.heroVideo()?.nativeElement;
      if (!video) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        video.pause();
        return;
      }
      video.muted = true;
      if (video.paused) void video.play().catch(() => {});
    });

    // The example post swipes through its photos on its own. Started here, in the browser, rather
    // than with the carousel's autoplay: a timer running during prerender would keep the page from
    // ever settling. Not for anyone who prefers less motion.
    afterNextRender(() => {
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const timer = window.setInterval(() => this.moment.update((i) => (i + 1) % this.moments.length), 3800);
      this.destroyRef.onDestroy(() => window.clearInterval(timer));
    });

    // The animated example is the real design, playing on its own: once the card is on screen it
    // scrolls slowly to the end, back to the top, and round again, so the whole invitation is seen
    // however fast the reader scrolls. It drives the design's own scroll by message (the same one the
    // invitation page uses on iPhone), so the card never traps a finger meant for the page. Loaded
    // only when the card is close, paused while it is off screen, and not for anyone who prefers
    // less motion: they keep the poster.
    afterNextRender(() => {
      const art = this.liveArt()?.nativeElement;
      if (!art || typeof IntersectionObserver === 'undefined') return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

      const near = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          this.liveOn.set(true);
          near.disconnect();
        },
        { rootMargin: '400px 0px' },
      );
      near.observe(art);

      const seen = new IntersectionObserver(
        (entries) => {
          this.liveVisible = entries.some((e) => e.isIntersecting);
          if (this.liveVisible) this.playLive();
        },
        { threshold: 0.4 },
      );
      seen.observe(art);

      this.destroyRef.onDestroy(() => {
        near.disconnect();
        seen.disconnect();
        cancelAnimationFrame(this.liveFrameRequest);
      });
    });

    this.api.listTemplates().subscribe({
      next: (res) => this.templates.set(res.items),
      // The page reads the same without a poster: the drawn invitation card stands in.
      error: () => {},
    });
  }

  protected onLiveLoad(): void {
    // The same couple as the poster, so the picture and the moving design agree.
    this.liveFrame()?.nativeElement.contentWindow?.postMessage({ __inviteData: this.liveData }, '*');
    this.liveReady.set(true);
    this.lastProgress = -1;
    this.playLive();
  }

  private readonly liveData = {
    event: {
      brideNickname: 'Layla',
      groomNickname: 'Yusuf',
      brideName: 'Layla Hassan',
      groomName: 'Yusuf Ibrahim',
      hashtag: '#LaylaAndYusuf',
      weekday: 'Sunday',
      day: '12',
      month: 'October',
      year: '2026',
      time: '07.00 PM',
      venue: { name: 'Hulhumalé Beach Garden' },
    },
    guest: { name: 'Leena' },
  };

  /** Start (or resume) the loop, if the design is loaded and the card is on screen. */
  private playLive(): void {
    if (this.liveFrameRequest || !this.liveVisible || !this.liveReady()) return;
    let last = 0;
    const tick = (now: number) => {
      this.liveFrameRequest = 0;
      if (!this.liveVisible || !this.liveReady()) return;
      // A long gap (a background tab) counts as one frame, so the loop resumes where it was.
      if (last) this.liveClock += Math.min(now - last, 100);
      last = now;
      this.sendProgress(loopProgress(this.liveClock));
      this.liveFrameRequest = requestAnimationFrame(tick);
    };
    this.liveFrameRequest = requestAnimationFrame(tick);
  }

  private sendProgress(progress: number): void {
    const target = this.liveFrame()?.nativeElement.contentWindow;
    if (!target || Math.abs(progress - this.lastProgress) < 0.0002) return;
    this.lastProgress = progress;
    // The design runs sandboxed with no origin of its own, so there is no narrower target to name.
    target.postMessage({ __inviteProgress: progress }, '*');
  }

  protected onPosterError(url: string | null | undefined): void {
    if (url) this.broken.update((set) => new Set(set).add(url));
  }
}
