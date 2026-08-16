import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiBadge } from 'ui/badge';
import { UiText } from 'ui/text';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { UiReveal } from 'ui/fx';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { SafeUrlPipe } from '../../shared/pipes/safe-url.pipe';

@Component({
  selector: 'app-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    UiButton,
    UiCard,
    UiBadge,
    UiText,
    UiSpinner,
    UiEmptyState,
    UiReveal,
    SafeUrlPipe,
  ],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
})
export class TemplatesComponent {
  private readonly api = inject(ApiService);

  protected readonly all = signal<Template[]>([]);
  protected readonly categories = signal<string[]>([]);
  protected readonly active = signal<string | null>(null);
  protected readonly loading = signal(true);

  protected readonly visible = computed(() => {
    const cat = this.active();
    return cat ? this.all().filter((t) => t.category === cat) : this.all();
  });

  constructor() {
    this.api.listTemplates().subscribe({
      next: (res) => {
        this.all.set(res.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.categories().subscribe({
      next: (cats) => this.categories.set(cats),
    });
  }

  protected select(cat: string | null): void {
    this.active.set(cat);
  }

  /**
   * The card's static preview image, or null when the template hasn't got one yet. Community
   * submissions always upload one; older platform templates were seeded with their live page URL
   * (`…/index.html`) as a stand-in, and those still fall back to the iframe until a real image is
   * uploaded — rendering a whole animated page per card is exactly what this replaces.
   */
  protected staticPreview(template: Template): string | null {
    const url = template.previewImageUrl;
    if (!url || url.endsWith('.html') || url.endsWith('/')) return null;
    return url;
  }
}
