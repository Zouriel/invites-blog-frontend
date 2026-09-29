import { ChangeDetectionStrategy, Component, input } from '@angular/core';

const BRANDS = [
  { file: 'visa', name: 'Visa' },
  { file: 'mastercard', name: 'Mastercard' },
  { file: 'amex', name: 'American Express' },
  { file: 'unionpay', name: 'UnionPay' },
] as const;

/**
 * The cards we accept, in their own colours and all the same size. The bank's rules ask for exactly
 * that wherever payment is offered, so this is the one place the row is drawn.
 *
 * <p>The logos in public/cards/ are the "flat-rounded" set from
 * github.com/aaronfagan/svg-credit-card-payment-icons (Apache License 2.0).</p>
 */
@Component({
  selector: 'app-card-brands',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="brands" aria-label="Cards accepted">
      @for (b of brands; track b.file) {
        <li>
          <img [src]="'/cards/' + b.file + '.svg'" [alt]="b.name" [title]="b.name" [style.height.px]="height()" loading="lazy" />
        </li>
      }
    </ul>
  `,
  styles: [
    `
      .brands {
        display: flex;
        flex-wrap: wrap;
        gap: 0.4rem;
        margin: 0;
        padding: 0;
        list-style: none;
      }
      img {
        display: block;
        width: auto;
      }
    `,
  ],
})
export class CardBrandsComponent {
  /** Height of each logo in pixels; the width follows the card shape. */
  readonly height = input(24);
  protected readonly brands = BRANDS;
}
