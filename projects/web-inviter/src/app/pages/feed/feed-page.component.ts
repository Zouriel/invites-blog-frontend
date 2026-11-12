import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { FEED_TABS } from '../../shared/services/tab-rail';
import { TemplateGalleryComponent } from '../../shared/template-gallery/template-gallery.component';
import { FeedComponent } from './feed.component';
import { UiOfferCard } from '@zouriel/ui/guidance';
import { GuidanceService } from '../../shared/guidance/guidance.service';
import { RoleOffersComponent } from '../../shared/guidance/role-offers.component';
import { ItemAnchorsDirective } from '../../shared/guidance/item-anchors.directive';
import { afterPaint, offerGate, tourRunner } from '../../shared/guidance/guidance-helpers';
import { TIP, TIP_TEXT, TOURS, tabTip } from '../../shared/guidance/tips';

/**
 * Where a signed-in person lands: every event they're part of, as posts, and next to them the
 * public templates. The gallery is here rather than its own page so the place people start is also
 * the place they find a design.
 */
@Component({
  selector: 'app-feed-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FeedComponent, ItemAnchorsDirective, RoleOffersComponent, TemplateGalleryComponent, UiOfferCard, UiTab, UiTabs],
  template: `
    <section class="wrap">
      <div class="ib-container">
        <!-- Guidance (docs/GUIDANCE.md): a card for each event this account was made a celebrant of,
             else, in its first month, the welcome tour's offer. -->
        <app-role-offers class="offers" />
        @if (welcome.visible()) {
          <ui-offer-card
            class="offers"
            heading="New to invites.blog? Take a quick tour."
            primaryLabel="Show me"
            secondaryLabel="Not now"
            [tipsOff]="true"
            (primaryClick)="welcome.end('finished')"
            (secondaryClick)="welcome.end('skipped')"
            (dismissed)="welcome.end('closed')"
            (tipsOffClick)="welcome.end('turnedOff')"
          />
        }
        <ui-tabs label="Feed" [selectedIndex]="selectedTab()" (selectedIndexChange)="onTabChange($event)" [appItemAnchors]="tabAnchors">
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
    .offers { display: block; max-width: 36rem; margin: 0 auto 1.25rem; }
  `,
})
export class FeedPageComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Read from the live URL: a swipe between the tabs changes only the query string. */
  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  private readonly guidance = inject(GuidanceService);
  protected readonly welcome = offerGate();
  private readonly runTour = tourRunner();
  protected readonly tabAnchors = [null, 'feed.tab-templates'];
  private asked = false;

  constructor() {
    // Once the account's state is in: the welcome offer (then its tour), else the Templates tab tip.
    effect(() => {
      if (!this.guidance.loaded() || this.asked) return;
      this.asked = true;
      untracked(() => void this.guide());
    });
  }

  private async guide(): Promise<void> {
    const g = this.guidance;
    // Somebody's event waiting for them comes first; the welcome can wait for another visit.
    if (!g.inWelcome() || g.newRoles().length) return;
    const offer = await this.welcome.ask(TIP.offerWelcome);
    if (offer === 'finished') {
      await afterPaint();
      await this.runTour(TOURS.welcome);
      return;
    }
    if (offer !== null) return;
    await afterPaint();
    await this.runTour(tabTip(TIP.feedTemplates, 'feed.tab-templates', TIP_TEXT.feedTemplates), {
      kind: 'tip',
      skipWhen: g.progress().hasEvent,
    });
  }

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
