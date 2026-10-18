import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { FEED_TABS } from '../../shared/services/tab-rail';
import { TemplateGalleryComponent } from '../../shared/template-gallery/template-gallery.component';
import { FeedComponent } from './feed.component';

/**
 * Where a signed-in person lands: every event they're part of, as posts, and next to them the
 * public templates. The gallery is here rather than its own page so the place people start is also
 * the place they find a design.
 */
@Component({
  selector: 'app-feed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedComponent, TemplateGalleryComponent, UiTab, UiTabs],
  template: `
    <section class="wrap">
      <div class="ib-container">
        <ui-tabs label="Feed" [selectedIndex]="selectedTab()" (selectedIndexChange)="onTabChange($event)">
          <ui-tab label="Posts"><app-feed /></ui-tab>
          <ui-tab label="Templates"><app-template-gallery /></ui-tab>
        </ui-tabs>
      </div>
    </section>
  `,
  styles: `
    /* Posts bleed their photos to the screen edge with 50vw, which counts a desktop scrollbar; clip
       the few pixels that makes, or a narrow desktop window scrolls sideways. */
    .wrap {
      padding: clamp(1rem, 3vw, 2.5rem) 0 4rem;
      overflow-x: clip;
    }
  `,
})
export class FeedPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Read from the live URL: a swipe between the tabs changes only the query string. */
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  protected readonly selectedTab = computed(() =>
    Math.max(0, (FEED_TABS as readonly string[]).indexOf(this.params().get('tab') ?? '')),
  );

  /** Mirrors the tab into ?tab=…, the first tab spelt as no tab at all, like the other tabbed screens. */
  protected onTabChange(index: number): void {
    const key = FEED_TABS[index];
    if (!key) return;
    this.router.navigate([], {
      relativeTo: this.route,
      // The gallery's occasion filter belongs to the Templates tab; leaving it drops it.
      queryParams: { tab: index === 0 ? null : key, category: index === 1 ? this.params().get('category') : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
