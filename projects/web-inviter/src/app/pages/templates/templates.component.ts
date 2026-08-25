import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { UiContainer } from '@zouriel/ui/layout';
import { UiText } from '@zouriel/ui/text';
import { UiButton } from '@zouriel/ui/button';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { UiSectionLabel } from '@zouriel/ui/fx';
import { ApiService } from '../../shared/api/api.service';
import { Template } from '../../shared/utils/types/api.types';
import { TemplateCardComponent } from '../../shared/template-card/template-card.component';

/**
 * The gallery.
 *
 * Templates are the product, and until now the only way to browse them was an auto-scrolling row on
 * the landing page — fine as a teaser, but you cannot scan a moving target, filter it, or link
 * someone to it. This is the page that does those jobs.
 *
 * The chosen category lives in the URL (?category=Wedding), so a filtered gallery is a link you can
 * send someone and a state that survives a refresh.
 */
@Component({
  selector: 'app-templates',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiContainer, UiText, UiButton, UiSkeleton, UiSectionLabel, TemplateCardComponent],
  templateUrl: './templates.component.html',
  styleUrl: './templates.component.scss',
})
export class TemplatesComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /** Every active template, fetched once. Filtering is local: the set is small and it keeps the
      chips instant instead of round-tripping for something the browser already has. */
  private readonly all = toSignal<Template[] | null>(
    this.api.listTemplates().pipe(map((p) => p.items ?? [])),
    { initialValue: null },
  );

  protected readonly loading = computed(() => this.all() === null);

  protected readonly categories = computed(() => {
    const items = this.all() ?? [];
    return [...new Set(items.map((t) => t.category).filter(Boolean))].sort();
  });

  protected readonly selected = toSignal<string | null>(
    this.route.queryParamMap.pipe(map((p) => p.get('category'))),
    { initialValue: null },
  );

  protected readonly shown = computed(() => {
    const items = this.all() ?? [];
    const cat = this.selected();
    return cat ? items.filter((t) => t.category === cat) : items;
  });

  protected select(category: string | null): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly skeletons = signal([0, 1, 2, 3, 4, 5]);
}
