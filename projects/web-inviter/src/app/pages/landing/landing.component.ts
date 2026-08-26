import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Link02Icon from '@hugeicons/core-free-icons/Link02Icon';
import TelegramIcon from '@hugeicons/core-free-icons/TelegramIcon';
import WhatsappIcon from '@hugeicons/core-free-icons/WhatsappIcon';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiText } from '@zouriel/ui/text';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { UiReveal, UiSectionLabel, UiMarquee, UiGrain, UiDriftRow, UiSplitText } from '@zouriel/ui/fx';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { TemplateCardComponent } from '../../shared/template-card/template-card.component';

type Step = { n: string; title: string; body: string };
type Channel = { icon: IconSvgObject; name: string; note: string };
type TemplateGroup = { category: string; items: Template[] };

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HugeiconsIconComponent,
    RouterLink,
    UiButton,
    UiText,
    UiReveal,
    UiSectionLabel,
    UiMarquee,
    UiGrain,
    UiDriftRow,
    UiSplitText,
    UiSkeleton,
    TemplateCardComponent,
    BrandMarkComponent,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly api = inject(ApiService);

  protected readonly templates = signal<Template[]>([]);
  /** Templates grouped by category — one drifting rail is rendered per group. */
  protected readonly groups = signal<TemplateGroup[]>([]);
  protected readonly loading = signal(true);

  protected readonly occasions = [
    'Weddings',
    'Engagements',
    'Birthdays',
    'Anniversaries',
    'Graduations',
    'Ceremonies',
    'Celebrations',
  ];

  /** Words cycled in the hero headline. The first is duplicated at the end so
   *  the vertical rotator loops without a visible jump (see landing.scss). */
  private readonly heroBase = ['weddings', 'birthdays', 'engagements', 'ceremonies', 'celebrations'];
  protected readonly heroWords = [...this.heroBase, this.heroBase[0]];

  protected readonly steps: Step[] = [
    { n: '01', title: 'Choose', body: 'Browse the template gallery and pick a design that fits your event.' },
    { n: '02', title: 'Personalize', body: 'Fill in your own text, images, roles and venue in the builder — no code needed.' },
    { n: '03', title: 'Add guests', body: 'Upload an Excel list or add guests by hand. Everyone gets their own personalized link.' },
    { n: '04', title: 'Send & track', body: 'Dispatch by email and watch RSVPs land live on your dashboard.' },
  ];

  protected readonly channels: Channel[] = [
    // Drawn rather than emoji: these sat on the front page in whatever colours the reader's
    // platform paints them, next to a palette chosen with some care.
    { icon: Mail01Icon, name: 'Email', note: 'Delivered to every inbox' },
    { icon: Link02Icon, name: 'Direct link', note: 'Share anywhere you like' },
    { icon: TelegramIcon, name: 'Telegram', note: 'Coming soon' },
    { icon: WhatsappIcon, name: 'WhatsApp', note: 'Coming soon' },
  ];

  constructor() {
    this.api.listTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.items);
        this.groups.set(this.groupByCategory(res.items));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Bucket templates into per-category groups, preserving first-seen order. */
  private groupByCategory(items: Template[]): TemplateGroup[] {
    const byCat = new Map<string, Template[]>();
    for (const t of items) {
      const key = t.category?.trim() || 'Featured';
      (byCat.get(key) ?? byCat.set(key, []).get(key)!).push(t);
    }
    return [...byCat.entries()].map(([category, list]) => ({ category, items: list }));
  }
}
