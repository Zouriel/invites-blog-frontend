import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { UiEmptyState, UiStarterCard } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { SessionStore } from '../../shared/services/session.store';
import { Portfolio, PortfolioOptions } from '../../shared/portfolio/portfolio.types';
import { PortfolioEditorComponent } from './portfolio-editor.component';
import { PortfolioEnquiriesComponent } from './portfolio-enquiries.component';
import { PortfolioWizardComponent } from './portfolio-wizard.component';

/**
 * A Studio's portfolio controls (docs/PORTFOLIO.md): the first-time setup until it is done, then the editor.
 * Reached from the briefcase in the top bar and from Me. Other accounts are told it comes with Studio.
 * Once set up it has two tabs: Page (the editor) and Enquiries (with the unread count); `?tab=enquiries` (and the
 * old `/portfolio/enquiries`, which push notifications open) lands on Enquiries.
 */
@Component({
  selector: 'app-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HugeiconsIconComponent,
    PortfolioEditorComponent,
    PortfolioEnquiriesComponent,
    PortfolioWizardComponent,
    UiEmptyState,
    UiSpinner,
    UiStarterCard,
    UiTab,
    UiTabs,
  ],
  template: `
    <section class="wrap">
      <div class="ib-container narrow">
        @if (state() === 'loading') {
          <div class="center"><ui-spinner /></div>
        } @else if (state() === 'not-studio') {
          <ui-empty-state heading="Portfolio comes with Photographer and Studio" description="Photographer and Studio accounts get a page at invites.blog/@yourname to show their work.">
            <div empty-starters>
              <ui-starter-card heading="See the plans" description="What it includes and costs" (pressed)="goPlans()">
                <hugeicons-icon starter-icon [icon]="icons.portfolio" [size]="20" [strokeWidth]="1.8" />
              </ui-starter-card>
            </div>
          </ui-empty-state>
        } @else if (portfolio(); as p) {
          @if (!p.handle || !p.setupDone) {
            <app-portfolio-wizard [portfolio]="p" [options]="options()" (changed)="portfolio.set($event)" (finished)="portfolio.set($event)" />
          } @else {
            <ui-tabs label="Portfolio" [selectedIndex]="tab()" (selectedIndexChange)="setTab($event)">
              <ui-tab label="Page" [icon]="icons.portfolio">
                <app-portfolio-editor [portfolio]="p" [options]="options()" (changed)="portfolio.set($event)" />
              </ui-tab>
              <ui-tab label="Enquiries" [icon]="icons.enquiry" [badge]="p.unreadEnquiries" [badgeLabel]="unreadLabel()">
                @if (tab() === 1) {
                  <app-portfolio-enquiries [embedded]="true" (seen)="markSeen()" />
                }
              </ui-tab>
            </ui-tabs>
          }
        }
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: clamp(1rem, 3vw, 2.5rem) 0 6rem; }
    .narrow { max-width: 760px; }
    .center { display: grid; place-items: center; padding: var(--ui-space-12); }
  `,
})
export class PortfolioComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  protected readonly icons = APP_ICONS;

  protected readonly portfolio = signal<Portfolio | null>(null);
  protected readonly options = signal<PortfolioOptions | null>(null);
  protected readonly state = signal<'loading' | 'ready' | 'not-studio'>('loading');

  private readonly route = inject(ActivatedRoute);
  /** 0 = Page, 1 = Enquiries; kept in the address (?tab=enquiries) so a link or Back lands on the same tab. */
  protected readonly tab = toSignal(this.route.queryParamMap.pipe(map((q) => (q.get('tab') === 'enquiries' ? 1 : 0))), {
    initialValue: 0,
  });
  protected readonly unreadLabel = computed(() => {
    const n = this.portfolio()?.unreadEnquiries ?? 0;
    return n ? `${n} new` : undefined;
  });

  protected setTab(i: number): void {
    void this.router.navigate([], { queryParams: { tab: i === 1 ? 'enquiries' : null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** The Enquiries tab marked them read: the count goes. */
  protected markSeen(): void {
    const p = this.portfolio();
    if (p?.unreadEnquiries) this.portfolio.set({ ...p, unreadEnquiries: 0 });
  }

  constructor() {
    this.api.portfolioOptions().subscribe({ next: (o) => this.options.set(o), error: () => {} });
    if (!this.session.hasPortfolio()) {
      this.state.set('not-studio');
      return;
    }
    this.api.portfolio().subscribe({
      next: (p) => {
        this.portfolio.set(p);
        this.state.set('ready');
      },
      error: () => this.state.set('not-studio'),
    });
  }

  protected goPlans(): void {
    void this.router.navigate(['/pricing']);
  }
}
