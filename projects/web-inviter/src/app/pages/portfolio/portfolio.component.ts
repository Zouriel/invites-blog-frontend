import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiEmptyState, UiStarterCard } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { SessionStore } from '../../shared/services/session.store';
import { Portfolio, PortfolioOptions } from '../../shared/portfolio/portfolio.types';
import { PortfolioEditorComponent } from './portfolio-editor.component';
import { PortfolioWizardComponent } from './portfolio-wizard.component';

/**
 * A Studio's portfolio controls (docs/PORTFOLIO.md): the first-time setup until it is done, then the editor.
 * Reached from the briefcase in the top bar and from Me. Other accounts are told it comes with Studio.
 */
@Component({
  selector: 'app-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, PortfolioEditorComponent, PortfolioWizardComponent, UiEmptyState, UiSpinner, UiStarterCard],
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
            <app-portfolio-editor [portfolio]="p" [options]="options()" (changed)="portfolio.set($event)" />
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
