import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GUIDE_GROUPS, GUIDES } from '../guides';

/** /guide: every guide, grouped, with the line that says what each one covers. */
@Component({
  selector: 'app-guide-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    @for (group of groups; track group.label) {
      <section class="group">
        <h2>{{ group.label }}</h2>
        <ul class="list">
          @for (g of group.guides; track g.slug) {
            <li>
              <a class="item" [routerLink]="['/guide', g.slug]">
                <span class="item__title">{{ g.title }}</span>
                <span class="item__lead">{{ g.lead }}</span>
              </a>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styleUrls: ['../guide-prose.scss'],
  styles: `
    .group + .group {
      margin-top: 2.5rem;
    }
    .list {
      display: block;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .list li {
      max-width: none;
      border-top: 1px solid var(--ui-color-border);
    }
    .list li:last-child {
      border-bottom: 1px solid var(--ui-color-border);
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 1rem 0.25rem;
      text-decoration: none;
      color: var(--ui-color-text);
    }
    .item:hover .item__title {
      color: var(--ui-color-primary);
    }
    .item:focus-visible {
      outline: none;
      box-shadow: var(--ui-focus-ring);
    }
    .item__title {
      font-weight: 600;
      font-size: 1.05rem;
    }
    .item__lead {
      max-width: 65ch;
      line-height: 1.55;
      color: var(--ui-color-text-muted);
    }
  `,
})
export class GuideOverviewComponent {
  protected readonly groups = GUIDE_GROUPS.map((label) => ({
    label,
    guides: GUIDES.filter((g) => g.group === label),
  }));
}
