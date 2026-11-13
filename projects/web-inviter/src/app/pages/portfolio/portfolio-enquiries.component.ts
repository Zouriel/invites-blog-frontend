import { ChangeDetectionStrategy, Component, inject, input, OnInit, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiBadge } from '@zouriel/ui/badge';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { PortfolioEnquiry } from '../../shared/portfolio/portfolio.types';

/**
 * Messages visitors sent from the portfolio page, newest first. Opening it marks them read. Shown as the Portfolio
 * page's Enquiries tab (`embedded`); `/portfolio/enquiries` opens that tab.
 */
@Component({
  selector: 'app-portfolio-enquiries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackLinkComponent, DatePipe, HugeiconsIconComponent, UiBadge, UiEmptyState, UiSpinner, UiText],
  template: `
    <section [class.wrap]="!embedded()">
      <div [class.ib-container]="!embedded()" [class.narrow]="!embedded()">
        @if (!embedded()) {
          <app-back-link link="/portfolio" label="Portfolio" />
          <ui-text variant="h3" class="title">Enquiries</ui-text>
        }
        @if (list() === null) {
          <div class="center"><ui-spinner /></div>
        } @else if (!list()!.length) {
          <ui-empty-state heading="No messages yet" description="When someone sends a message from your page, it shows here and comes to your email." />
        } @else {
          <ul class="list">
            @for (e of list(); track e.id) {
              <li class="card">
                <div class="row">
                  <ui-text variant="h4">{{ e.name }}</ui-text>
                  @if (!e.read) { <ui-badge variant="primary">New</ui-badge> }
                </div>
                <ui-text variant="caption" class="muted">{{ e.createdAt | date: 'd MMM y, h:mm a' }}@if (e.eventDate) { · Event {{ e.eventDate | date: 'd MMM y' }} }</ui-text>
                <p class="msg">{{ e.message }}</p>
                <div class="reply">
                  @if (isEmail(e.contact)) {
                    <a class="btn" [href]="'mailto:' + e.contact"><hugeicons-icon [icon]="icons.mail" [size]="18" [strokeWidth]="1.8" /> Email {{ e.contact }}</a>
                  } @else {
                    <a class="btn" [href]="'https://wa.me/' + digits(e.contact)" target="_blank" rel="noopener"><hugeicons-icon [icon]="icons.enquiry" [size]="18" [strokeWidth]="1.8" /> WhatsApp</a>
                    <a class="btn" [href]="'tel:' + e.contact"><hugeicons-icon [icon]="icons.contact" [size]="18" [strokeWidth]="1.8" /> Call {{ e.contact }}</a>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </section>
  `,
  styles: `
    .wrap { padding: clamp(1rem, 3vw, 2.5rem) 0 6rem; }
    .narrow { max-width: 760px; }
    .title { display: block; margin: var(--ui-space-4) 0; }
    .center { display: grid; place-items: center; padding: var(--ui-space-12); }
    .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .card { padding: var(--ui-space-4); background: var(--ui-color-surface); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .muted { color: var(--ui-color-text-muted); }
    .msg { margin: var(--ui-space-3) 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .reply { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    .btn { display: inline-flex; align-items: center; gap: var(--ui-space-2); min-height: 44px; padding: 0 var(--ui-space-4);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-pill); color: var(--ui-color-text); text-decoration: none;
      overflow-wrap: anywhere; }
  `,
})
export class PortfolioEnquiriesComponent implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly icons = APP_ICONS;
  protected readonly list = signal<PortfolioEnquiry[] | null>(null);
  /** Inside the Portfolio page's tab: no page frame, back link or title of its own. */
  readonly embedded = input(false);
  /** The unread ones were marked read (the tab's count can go). */
  readonly seen = output<void>();

  // In ngOnInit, not the constructor: the parent's (seen) listener is attached only after construction.
  ngOnInit(): void {
    this.api.portfolioEnquiries().subscribe({
      next: (l) => {
        this.list.set(l);
        for (const e of l.filter((x) => !x.read)) this.api.markPortfolioEnquiryRead(e.id).subscribe({ error: () => {} });
        this.seen.emit();
      },
      error: () => this.list.set([]),
    });
  }

  protected isEmail(c: string): boolean {
    return c.includes('@');
  }

  protected digits(c: string): string {
    return c.replace(/\D/g, '');
  }
}
