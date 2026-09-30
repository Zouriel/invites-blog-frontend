import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { CardBrandsComponent } from '../../shared/brand/card-brands.component';
import { COMPANY, COMPANY_ADDRESS_LINE } from '../../shared/utils/constants/company';

/**
 * The bottom of every public page: the name, the policies, who runs the site and how to reach them,
 * and the cards accepted. The places people go (designs, pricing, the guide) are in the header.
 *
 * <p>The company line and the card logos are not decoration: Bank of Maldives' card rules require the
 * business name, address, contact details and accepted brands to be on the site.</p>
 */
@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, BrandMarkComponent, CardBrandsComponent],
  template: `
    <footer class="ftr">
      <div class="ftr__inner">
        <div class="ftr__row">
          <a routerLink="/" class="brand">
            <app-brand-mark [size]="20" />
            <span>invites<span class="brand__accent">Blog</span></span>
          </a>
          <nav class="ftr__links" aria-label="Policies">
            <a routerLink="/terms">Terms</a>
            <a routerLink="/refunds">Refunds</a>
            <a routerLink="/privacy">Privacy</a>
            <a routerLink="/security">Security</a>
            <a routerLink="/contact">Contact</a>
          </nav>
        </div>
        <div class="ftr__row ftr__row--company">
          <address class="ftr__company">
            invites.blog ({{ company.tradingName }}) is a business of {{ company.legalName }} (reg. {{ company.registrationNumber }}),
            {{ addressLine }}.
            <a [href]="'tel:' + company.phoneHref">{{ company.phone }}</a> ·
            <a [href]="'mailto:' + company.email">{{ company.email }}</a>
          </address>
          <app-card-brands [height]="36" />
        </div>
        <span class="ftr__year">© {{ year }} {{ company.legalName }}. Prices in {{ company.currency }}.</span>
      </div>
    </footer>
  `,
  styles: [
    `
      .ftr {
        margin-top: 4rem;
        border-top: 1px solid var(--ui-color-border);
        padding: 1.25rem clamp(1.1rem, 4vw, 3rem) 1.5rem;
      }
      .ftr__inner {
        display: flex;
        flex-direction: column;
        gap: 0.9rem;
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        font-size: 0.85rem;
        color: var(--ui-color-text-muted);
      }
      .ftr__row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.75rem 1.5rem;
      }
      .ftr__row--company {
        justify-content: space-between;
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
      .brand__accent {
        color: var(--ui-color-primary);
      }
      .ftr__links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem 1.25rem;
      }
      .ftr__links a,
      .ftr__company a {
        color: var(--ui-color-text-muted);
        font-weight: 500;
        text-decoration: none;
      }
      .ftr__links a:hover,
      .ftr__company a:hover {
        color: var(--ui-color-primary);
      }
      .ftr__company {
        flex: 1 1 22rem;
        font-style: normal;
        line-height: 1.55;
      }
      .ftr__year {
        font-size: 0.8rem;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
  protected readonly company = COMPANY;
  protected readonly addressLine = COMPANY_ADDRESS_LINE;
}
