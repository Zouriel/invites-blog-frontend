import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiReveal, UiSectionLabel, UiMarquee, UiGrain } from 'ui/fx';
import { UiSkeleton } from 'ui/skeleton';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

type Step = { n: string; title: string; body: string };
type Channel = { icon: string; name: string; note: string };

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
    UiSkeleton,
    SafeUrlPipe,
  ],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  private readonly api = inject(ApiService);

  protected readonly templates = signal<Template[]>([]);
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

  protected readonly steps: Step[] = [
    { n: '01', title: 'Select', body: 'Pick a story-driven template from our editorial collection.' },
    { n: '02', title: 'Customize', body: 'Make it yours — words, dates, dress code, the little details.' },
    { n: '03', title: 'Upload', body: 'Drop in your guest list from a simple Excel sheet.' },
    { n: '04', title: 'Pay', body: 'One transparent price. No subscriptions, no surprises.' },
    { n: '05', title: 'Send', body: 'Every guest gets a personal, animated invitation link.' },
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
        this.templates.set(res.items.slice(0, 6));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
