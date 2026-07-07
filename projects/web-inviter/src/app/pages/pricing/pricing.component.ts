import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiText } from 'ui/text';
import { UiFormField, UiNumberInput } from 'ui/form';
import { UiColumn, UiTable } from 'ui/table';

type PriceRow = Record<'guests' | 'price', string>;

@Component({
  selector: 'app-pricing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ReactiveFormsModule,
    UiButton,
    UiCard,
    UiText,
    UiFormField,
    UiNumberInput,
    UiTable,
  ],
  templateUrl: './pricing.component.html',
  styleUrl: './pricing.component.scss',
})
export class PricingComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly countControl = this.fb.control<number>(50);
  private readonly count = toSignal(this.countControl.valueChanges, {
    initialValue: this.countControl.value,
  });

  protected readonly features = [
    'All templates, fully animated',
    'Per-guest personalization',
    'Email & direct-link delivery',
    'Live RSVP dashboard',
  ];

  protected readonly priceDefs: UiColumn<PriceRow>[] = [
    { key: 'guests', header: 'Guests' },
    { key: 'price', header: 'Price', align: 'right' },
  ];

  protected readonly priceRows: PriceRow[] = [
    { guests: 'Up to 50', price: '$5' },
    { guests: '60', price: '$6' },
    { guests: '100', price: '$10' },
    { guests: '200', price: '$20' },
  ];

  protected readonly estimate = computed(() => {
    const n = this.count() ?? 0;
    if (n <= 0) {
      return '$0';
    }
    const extra = Math.max(0, n - 50);
    const blocks = Math.ceil(extra / 10);
    return `$${5 + blocks}`;
  });

  protected readonly year = signal(new Date().getFullYear());
}
