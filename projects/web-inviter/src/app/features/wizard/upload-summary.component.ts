import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UiCard, UiStatCard } from 'ui/card';
import { UiBadge } from 'ui/badge';
import { UiAlert } from 'ui/alert';
import { UiText } from 'ui/text';
import { UploadResult } from '../../shared/utils/types/api.types';

/** Read-only validation summary for an uploaded guest list. */
@Component({
  selector: 'app-upload-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiCard, UiStatCard, UiBadge, UiAlert, UiText],
  template: `
    <ui-card padding="lg" class="summary">
      <div class="stats">
        <ui-stat-card label="Rows" [value]="result().totalRows" />
        <ui-stat-card label="Valid" [value]="result().validRows" trend="up" />
        <ui-stat-card
          label="Invalid"
          [value]="result().invalidRows"
          [trend]="result().invalidRows > 0 ? 'down' : 'up'"
        />
        <ui-stat-card label="Duplicates" [value]="result().duplicates" />
        <ui-stat-card label="No email" [value]="result().missingEmail" />
        <ui-stat-card label="No phone" [value]="result().missingPhone" />
      </div>

      <div class="dists">
        @if (roles().length) {
          <div class="dist">
            <ui-text variant="label">By role</ui-text>
            <div class="tags">
              @for (r of roles(); track r.key) {
                <ui-badge tone="neutral">{{ r.key }} · {{ r.value }}</ui-badge>
              }
            </div>
          </div>
        }
        @if (genders().length) {
          <div class="dist">
            <ui-text variant="label">By gender</ui-text>
            <div class="tags">
              @for (g of genders(); track g.key) {
                <ui-badge tone="neutral">{{ g.key }} · {{ g.value }}</ui-badge>
              }
            </div>
          </div>
        }
      </div>

      @if (result().warnings?.length) {
        <ui-alert class="note" tone="warning" heading="Warnings">
          <ul>
            @for (w of result().warnings; track $index) {
              <li>{{ w }}</li>
            }
          </ul>
        </ui-alert>
      }
      @if (result().errors?.length) {
        <ui-alert class="note" tone="danger" heading="Errors">
          <ul>
            @for (e of result().errors; track $index) {
              <li>{{ e }}</li>
            }
          </ul>
        </ui-alert>
      }

      <ui-alert class="note" [tone]="result().canContinue ? 'success' : 'danger'">
        {{
          result().canContinue
            ? 'This list is ready — you can continue.'
            : 'Please resolve the errors before continuing.'
        }}
      </ui-alert>
    </ui-card>
  `,
  styles: [
    `
      .summary {
        display: block;
      }
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: var(--ui-space-2);
        margin-bottom: var(--ui-space-4);
      }
      .dists {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ui-space-4);
        margin-bottom: var(--ui-space-3);
      }
      .tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--ui-space-1);
        margin-top: 0.4rem;
      }
      .note {
        display: block;
        margin-top: var(--ui-space-3);
      }
      ul {
        margin: 0;
        padding-left: 1.2rem;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class UploadSummaryComponent {
  readonly result = input.required<UploadResult>();

  protected readonly roles = computed(() =>
    Object.entries(this.result().roleDistribution ?? {}).map(([key, value]) => ({ key, value })),
  );
  protected readonly genders = computed(() =>
    Object.entries(this.result().genderDistribution ?? {}).map(([key, value]) => ({ key, value })),
  );
}
