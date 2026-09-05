import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import type { IconSvgObject } from '@hugeicons/angular';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Link02Icon from '@hugeicons/core-free-icons/Link02Icon';
import WhatsappIcon from '@hugeicons/core-free-icons/WhatsappIcon';
import QrCodeIcon from '@hugeicons/core-free-icons/QrCodeIcon';
import Album02Icon from '@hugeicons/core-free-icons/Album02Icon';
import DatabaseIcon from '@hugeicons/core-free-icons/DatabaseIcon';
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

  /** Icons for the media-bucket section. Imported one module at a time, as the rest of the app does. */
  protected readonly qrIcon = QrCodeIcon;
  protected readonly albumIcon = Album02Icon;
  protected readonly databaseIcon = DatabaseIcon;

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
    { n: '01', title: 'Choose', body: 'Pick a design from the gallery, or commission one made only for your event.' },
    { n: '02', title: 'Personalize', body: 'Your words, your photographs, your roles and venue — in the builder, with no code.' },
    { n: '03', title: 'Add guests', body: 'Upload a spreadsheet or add them by hand. Everyone gets their own link, with their own name on it.' },
    { n: '04', title: 'Send & track', body: 'Send by email and watch replies land on your dashboard as they come in.' },
    // The journey used to stop at "sent", which is where an invitation ends and an event begins.
    { n: '05', title: 'Keep the night', body: 'Your guests shoot the evening from inside their invitation, and every photo collects in one place.' },
  ];

  protected readonly channels: Channel[] = [
    // Drawn rather than emoji: these sat on the front page in whatever colours the reader's
    // platform paints them, next to a palette chosen with some care.
    { icon: Mail01Icon, name: 'Email', note: 'Delivered to every inbox' },
    { icon: Link02Icon, name: 'Direct link', note: 'Share anywhere you like' },
    // WhatsApp and Telegram were listed here as equals with a "coming soon" note, which put two
    // things that do not exist in a row of four on the page that explains what you get.
    { icon: WhatsappIcon, name: 'WhatsApp', note: 'Next on the list' },
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
