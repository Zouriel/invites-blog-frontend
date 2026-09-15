import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
import { UiReveal } from '@zouriel/ui/fx';
import { ApiService } from '../../shared/api/api.service';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { OCCASIONS } from '../../shared/utils/constants/occasions';
import { Template } from '../../shared/utils/types/api.types';

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
  imports: [HugeiconsIconComponent, NgTemplateOutlet, RouterLink, UiAvatar, UiButton, UiReveal, BrandMarkComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly api = inject(ApiService);

  private readonly templates = signal<Template[]>([]);
  /** Posters that failed to load; those fall back to the drawn card. */
  private readonly broken = signal(new Set<string>());

  /** Real designs with a real poster image. A preview that points at a page is not an image. */
  private readonly posters = computed(() =>
    this.templates()
      .filter((t) => !t.isShowcase && !!t.previewImageUrl && !t.previewImageUrl.endsWith('.html'))
      .filter((t) => !this.broken().has(t.previewImageUrl!)),
  );

  /** The design in the hero phone, and the one beside "Animated". Different when there are two. */
  protected readonly heroDesign = computed(() => this.posters()[0] ?? null);
  protected readonly animatedDesign = computed(() => this.posters()[1] ?? this.posters()[0] ?? null);
  /** The post's cover: a third design where there is one, so the page doesn't repeat itself. */
  protected readonly postDesign = computed(() => this.posters()[2] ?? this.posters()[0] ?? null);

  protected readonly occasions = OCCASIONS;

  protected readonly qrIcon = QrCodeIcon;
  protected readonly albumIcon = Album02Icon;
  protected readonly arrowIcon = ArrowRight01Icon;
  protected readonly heartIcon = FavouriteIcon;
  protected readonly commentIcon = BubbleChatIcon;
  protected readonly tickIcon = Tick02Icon;

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

  constructor() {
    this.api.listTemplates().subscribe({
      next: (res) => this.templates.set(res.items),
      // The page reads the same without a poster: the drawn invitation card stands in.
      error: () => {},
    });
  }

  protected onPosterError(url: string | null | undefined): void {
    if (url) this.broken.update((set) => new Set(set).add(url));
  }
}
