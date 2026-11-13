import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiResult } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../shared/api/api.service';
import { DemoEventStore } from '../../shared/demo/demo-event';
import { DashboardComponent } from '../dashboard/dashboard.component';

/**
 * "See an example event" (docs/GUIDANCE.md section 7): the real event dashboard, drawn from the made-up
 * wedding GET /api/demo/event returns, read-only. Public, so someone deciding whether to sign up can
 * look around too. Nothing about it reaches the API but that one read (see demoInterceptor).
 */
@Component({
  selector: 'app-example-event',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DashboardComponent, UiButton, UiResult, UiSpinner],
  template: `
    @if (id(); as id) {
      <app-dashboard [campaignId]="id" [demo]="true" />
    } @else if (failed()) {
      <section class="state">
        <ui-result status="error" title="The example didn't load" subtitle="Check your connection and try again.">
          <ui-button variant="primary" (click)="load()">Try again</ui-button>
        </ui-result>
      </section>
    } @else {
      <section class="state"><ui-spinner /></section>
    }
  `,
  styles: `
    :host { display: block; }
    .state { display: flex; justify-content: center; padding: 4rem 1rem; }
  `,
})
export class ExampleEventComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(DemoEventStore);
  protected readonly id = signal<string | null>(this.store.event()?.campaign.id ?? null);
  protected readonly failed = signal(false);

  constructor() {
    if (!this.id()) this.load();
  }

  protected load(): void {
    this.failed.set(false);
    this.api.demoEvent().subscribe({
      next: (d) => {
        this.store.event.set(d);
        this.id.set(d.campaign.id);
      },
      error: () => this.failed.set(true),
    });
  }
}
