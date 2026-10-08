import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** What the badge shows, in its order, for screen readers and anyone the image fails for. */
export const ACCEPTED_CARDS = 'American Express, Visa, Mastercard, Maestro and UnionPay';

/**
 * The cards we accept, drawn wherever payment is offered (footer, pricing, security page, the review
 * step before paying). The image is the exact artwork Bank of Maldives supplied for this purpose
 * (public/cards/accepted-cards.jpg): their merchant rules ask for the brands in full colour and equal
 * prominence, and they asked for this file. Replace it only with artwork they supply.
 */
@Component({
  selector: 'app-card-brands',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      class="brands"
      src="/cards/accepted-cards.jpg"
      [alt]="'Cards accepted: ' + cards"
      [title]="cards"
      [style.height.px]="height()"
      width="736"
      height="150"
      loading="lazy"
    />
  `,
  styles: [
    `
      .brands {
        display: block;
        width: auto;
        max-width: 100%;
        border-radius: 8px;
      }
    `,
  ],
})
export class CardBrandsComponent {
  /** Height of the badge in pixels; the width follows the artwork's shape. */
  readonly height = input(28);
  protected readonly cards = ACCEPTED_CARDS;
}
