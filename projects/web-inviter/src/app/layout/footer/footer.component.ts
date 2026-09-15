import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';

/**
 * One quiet line at the bottom of the page: the name, the legal pages and the year. The places people
 * go (designs, pricing, the guide) are in the header already. The company's details will sit on this
 * same line when there are any to show.
 */
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandMarkComponent],
  template: `
    <footer class="ftr">
      <div class="ftr__inner">
        <a routerLink="/" class="brand">
          <app-brand-mark [size]="20" />
          <span>invites<span class="brand__dot">.</span>blog</span>
        </a>
        <nav class="ftr__links" aria-label="Legal">
          <a routerLink="/privacy">Privacy</a>
          <a routerLink="/terms">Terms</a>
        </nav>
        <span class="ftr__year">© {{ year }} invites.blog</span>
      </div>
    </footer>
  `,
  styles: [
    `
      .ftr {
        margin-top: 4rem;
        border-top: 1px solid var(--ui-color-border);
        padding: 1.25rem clamp(1.1rem, 4vw, 3rem);
      }
      .ftr__inner {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem 1.5rem;
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        font-size: 0.85rem;
        color: var(--ui-color-text-muted);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        margin-right: auto;
        font-family: var(--ui-font-display);
        font-size: 1.05rem;
        font-weight: 700;
        color: var(--ui-color-text);
        text-decoration: none;
      }
      .brand app-brand-mark {
        color: var(--ui-color-text);
      }
      .brand__dot {
        color: var(--ui-color-primary);
      }
      .ftr__links {
        display: flex;
        gap: 1.25rem;
      }
      .ftr__links a {
        color: var(--ui-color-text-muted);
        font-weight: 500;
        text-decoration: none;
      }
      .ftr__links a:hover {
        color: var(--ui-color-primary);
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
