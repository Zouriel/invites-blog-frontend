import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiProgressBar } from '@zouriel/ui/progress';
import { UiText } from '@zouriel/ui/text';
import { BillingItem } from '../utils/types/api.types';
import { PlanStatus } from './plan-status';

/**
 * The event dashboard's plan card (docs/PLANS-UX.md): the plan in its tier's colour and one plain
 * line, the event's space, the warning that matters now, and only the actions that mean something,
 * each a button in its tier's colour. Every piece is the UI library's; the wording comes from
 * planStatus().
 */
@Component({
  selector: 'app-plan-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiAlert, UiBadge, UiButton, UiProgressBar, UiText],
  template: `
    @let s = status();
    <div class="head">
      <ui-text variant="h4">Your plan</ui-text>
      <ui-badge [tier]="s.tier">{{ s.name }}</ui-badge>
    </div>
    <p class="line">{{ s.line }}</p>

    @if (s.space) {
      <div class="space">
        <span class="space__used">{{ s.space }}</span>
        <ui-progress-bar [value]="s.percent" [tone]="s.meterTone" [label]="'This event’s albums are ' + s.percent + '% full'" />
        @if (s.spaceNote) {
          <p class="space__note">{{ s.spaceNote }}</p>
        }
      </div>
    }

    @if (s.alert; as al) {
      <ui-alert [tone]="al.tone" [heading]="al.heading">{{ al.text }}</ui-alert>
    }

    @if (s.venueNote) {
      <p class="note">{{ s.venueNote }}</p>
    }

    @if (s.actions.length) {
      <div class="actions">
        @for (a of s.actions; track a.item) {
          @if (a.tier) {
            <ui-button [tier]="a.tier" [loading]="busy() === a.item" (click)="act.emit(a.item)">{{ a.label }}</ui-button>
          } @else {
            <ui-button variant="outline" [loading]="busy() === a.item" (click)="act.emit(a.item)">{{ a.label }}</ui-button>
          }
        }
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .line, .note, .space__note { margin: 0; line-height: 1.5; }
    .line { color: var(--ui-color-text); }
    .note, .space__note { color: var(--ui-color-text-muted); font-size: 0.9rem; }
    .space { display: flex; flex-direction: column; gap: var(--ui-space-1); }
    .space__used { font-weight: 600; font-variant-numeric: tabular-nums; }
    .actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
  `,
})
export class PlanStatusComponent {
  readonly status = input.required<PlanStatus>();
  /** Which action is waiting on the server. */
  readonly busy = input<BillingItem | null>(null);
  readonly act = output<BillingItem>();
}
