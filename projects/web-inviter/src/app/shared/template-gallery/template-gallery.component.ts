import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiSkeleton } from '@zouriel/ui/skeleton';
import { ApiService } from '../api/api.service';
import { Template } from '../utils/types/api.types';
import { TemplateCardComponent } from '../template-card/template-card.component';

/**
 * Every public template, filterable, as a grid.
 *
 * <p>Lifted out of the gallery PAGE so the same grid can be a tab on My templates without either
 * copy drifting from the other. The page keeps its own headline and lede; what is shared is the
 * part that actually does something — the occasion filters and the cards.</p>
 *
 * <p>The chosen occasion lives in the URL (`?category=Wedding`), which is what makes a filtered
 * gallery a link somebody can send and a state that survives a refresh. That works unchanged inside
 * a tab, because the tab is in the URL too.</p>
 */
@Component({
  selector: 'app-template-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiSkeleton, TemplateCardComponent],
  templateUrl: './template-gallery.component.html',
  styleUrl: './template-gallery.component.scss',
})
export class TemplateGalleryComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  /**
   * Set when the grid was opened from an event with no invitation yet, so a card says "use this"
   * rather than merely "open". Read from the URL by the page; passed in when a host embeds it.
   */
  readonly forEventInput = input<string | null>(null, { alias: 'forEvent' });

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

  private readonly forEventParam = toSignal<string | null>(
    this.route.queryParamMap.pipe(map((p) => p.get('forEvent'))),
    { initialValue: null },
  );

  /** Whichever was given: the input wins, and the URL is the fallback the page relies on. */
  protected readonly forEvent = computed(() => this.forEventInput() ?? this.forEventParam());

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
    // merge, so choosing an occasion inside a tab does not throw the tab away.
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { category },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  protected readonly skeletons = signal([0, 1, 2, 3, 4, 5]);
}
