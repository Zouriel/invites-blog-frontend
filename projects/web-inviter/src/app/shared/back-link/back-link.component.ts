import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../icons/app-icons';

/**
 * The one way a page offers "back": an arrow and where it goes. A link when there's a place to go
 * (`link`, with `query`), a button when the page steps back within itself (`(back)` with no link).
 */
@Component({
  selector: 'app-back-link',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, HugeiconsIconComponent],
  template: `
    @if (link(); as to) {
      <a class="back" [routerLink]="to" [queryParams]="query()">
        <hugeicons-icon [icon]="icon" [size]="16" [strokeWidth]="1.8" />{{ label() }}
      </a>
    } @else {
      <button type="button" class="back" (click)="back.emit()">
        <hugeicons-icon [icon]="icon" [size]="16" [strokeWidth]="1.8" />{{ label() }}
      </button>
    }
  `,
  styles: `
    :host { display: block; margin-bottom: 1.25rem; }
    .back { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0; border: 0; background: none; font: inherit;
      font-size: 0.9rem; font-weight: 600; color: var(--ui-color-text-muted); text-decoration: none; cursor: pointer; }
    .back:hover { color: var(--ui-color-primary); }
    .back:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: var(--ui-radius-sm); }
  `,
})
export class BackLinkComponent {
  /** Where it goes. Leave it out for a button that emits `back`. */
  readonly link = input<string | readonly unknown[] | null>(null);
  readonly query = input<Record<string, unknown> | null>(null);
  readonly label = input('Back');
  readonly back = output<void>();
  protected readonly icon = APP_ICONS.back;
}
