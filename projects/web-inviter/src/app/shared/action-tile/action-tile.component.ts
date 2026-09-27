import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiCard } from '@zouriel/ui/card';
import { UiSpinner } from '@zouriel/ui/spinner';
import { AppIcon } from '../icons/app-icons';

/**
 * A square action: an icon, what it does, and one short line (a price, a limit). For a handful of
 * things side by side that each start something, where a row of buttons reads as a toolbar nobody
 * can tell apart.
 */
@Component({
  selector: 'app-action-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiCard, UiSpinner],
  template: `
    <button type="button" class="tile" [disabled]="busy()" (click)="pressed.emit()">
      <ui-card padding="md" [interactive]="true" class="tile__card">
        <span class="tile__body">
        <span class="tile__icon" aria-hidden="true">
          @if (busy()) {
            <ui-spinner size="sm" />
          } @else {
            <hugeicons-icon [icon]="icon()" [size]="26" [strokeWidth]="1.7" />
          }
        </span>
        <strong class="tile__title">{{ title() }}</strong>
        @if (note()) {
          <span class="tile__note">{{ note() }}</span>
        }
        </span>
      </ui-card>
    </button>
  `,
  styles: `
    :host {
      display: block;
    }
    .tile {
      display: block;
      width: 100%;
      height: 100%;
      padding: 0;
      border: 0;
      background: none;
      font: inherit;
      color: inherit;
      text-align: center;
      cursor: pointer;
    }
    .tile:disabled {
      cursor: progress;
    }
    .tile:focus-visible {
      outline: none;
    }
    .tile:focus-visible .tile__card {
      box-shadow: var(--ui-focus-ring);
      border-radius: var(--ui-radius-lg);
    }
    .tile__card {
      display: block;
      height: 100%;
    }
    .tile__body {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.4rem;
      min-height: 7.5rem;
    }
    .tile__icon {
      display: grid;
      place-items: center;
      width: 3rem;
      height: 3rem;
      border-radius: 999px;
      color: var(--ui-color-primary);
      background: color-mix(in srgb, var(--ui-color-primary) 12%, transparent);
    }
    .tile__title {
      font-size: 0.95rem;
      line-height: 1.25;
    }
    .tile__note {
      font-size: 0.82rem;
      color: var(--ui-color-text-muted);
    }
  `,
})
export class ActionTileComponent {
  readonly icon = input.required<AppIcon>();
  readonly title = input.required<string>();
  readonly note = input('');
  readonly busy = input(false);
  readonly pressed = output<void>();
}
