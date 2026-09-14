import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiAccordion, UiAccordionItem } from '@zouriel/ui/accordion';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { SITE_URL, SeoService } from '../../shared/services/seo.service';
import { TemplateCardComponent } from '../../shared/template-card/template-card.component';
import { OCCASIONS, occasionBySlug } from '../../shared/utils/constants/occasions';
import { Template } from '../../shared/utils/types/api.types';

/**
 * A landing page for one occasion, like /invitations/wedding. Written for what somebody planning
 * that occasion searches for, and prerendered so a search engine reads it without running anything.
 */
@Component({
  selector: 'app-occasion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TemplateCardComponent, UiAccordion, UiAccordionItem, UiButton, UiEmptyState, UiSkeleton, UiText],
  templateUrl: './occasion.component.html',
  styleUrl: './occasion.component.scss',
})
export class OccasionComponent {
  private readonly api = inject(ApiService);
  private readonly seo = inject(SeoService);

  /** Bound from the route param. */
  readonly occasion = input.required<string>();

  protected readonly data = computed(() => occasionBySlug(this.occasion()) ?? null);
  protected readonly others = computed(() => OCCASIONS.filter((o) => o.slug !== this.occasion()));

  private readonly designs = signal<Template[] | null>(null);
  protected readonly loading = computed(() => this.designs() === null);
  protected readonly matching = computed(() => {
    const category = this.data()?.category.toLowerCase();
    return (this.designs() ?? []).filter((t) => !t.isShowcase && t.category?.toLowerCase() === category);
  });

  constructor() {
    this.api.listTemplates().subscribe({
      next: (page) => this.designs.set(page.items ?? []),
      error: () => this.designs.set([]),
    });

    effect(() => {
      const path = `/invitations/${this.occasion()}`;
      const o = this.data();
      if (!o) {
        this.seo.set({ title: 'Page not found', description: 'That page does not exist.', noindex: true }, path);
        return;
      }
      this.seo.set(
        {
          title: o.heading,
          description: o.description,
          jsonLd: [
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: o.faq.map((f) => ({
                '@type': 'Question',
                name: f.q,
                acceptedAnswer: { '@type': 'Answer', text: f.a },
              })),
            },
            {
              '@context': 'https://schema.org',
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
                { '@type': 'ListItem', position: 2, name: 'Designs', item: `${SITE_URL}/templates` },
                { '@type': 'ListItem', position: 3, name: o.heading, item: SITE_URL + path },
              ],
            },
          ],
        },
        path,
      );
    });
  }
}
