import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiReveal, UiSectionLabel, UiMarquee, UiGrain, UiDriftRow, UiSplitText } from 'ui/fx';
import { UiSkeleton } from 'ui/skeleton';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

type Step = { n: string; title: string; body: string };
type Channel = { icon: string; name: string; note: string };
type TemplateGroup = { category: string; items: Template[] };

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButton,
    UiCard,
    UiText,
    UiReveal,
    UiSectionLabel,
    UiMarquee,
    UiGrain,
    UiDriftRow,
    UiSplitText,
    UiSkeleton,
    SafeUrlPipe,
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
    { n: '01', title: 'Inquire', body: 'Tell us about your event — the occasion, your style, the feeling you want.' },
    { n: '02', title: 'Design', body: 'We craft a one-of-a-kind animated invitation, made just for you.' },
    { n: '03', title: 'Refine', body: 'We share a preview and perfect the colors, wording and details together.' },
    { n: '04', title: 'Deliver', body: 'Your finished invitation arrives by email, ready to share with your guests.' },
  ];

  protected readonly channels: Channel[] = [
    { icon: '✉️', name: 'Email', note: 'Delivered to every inbox' },
    { icon: '🔗', name: 'Direct link', note: 'Share anywhere you like' },
    { icon: '📨', name: 'Telegram', note: 'Coming soon' },
    { icon: '💬', name: 'WhatsApp', note: 'Coming soon' },
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
