import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiNumberInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { setCatalog, usd } from '../../shared/utils/plans';
import { Prices } from '../../shared/utils/types/api.types';

type Field = { key: keyof Prices; label: string; hint: string; suffix: string; max: number; step?: number; precision?: number };

/**
 * What everything costs, changed without a release (Admin → Prices). Limits — space, albums, days,
 * emails included — stay in code, because the server enforces them; this is only the money.
 *
 * <p>A new price applies to whatever is charged from then on. The pages that state prices read them
 * as they open; the prerendered pages search engines see pick them up on the next web rebuild.</p>
 */
@Component({
  selector: 'app-admin-prices',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiAlert, UiButton, UiCard, UiConfirmDialog, UiFormField, UiNumberInput, UiSpinner, UiText],
  templateUrl: './admin-prices.component.html',
  styleUrl: './admin-prices.component.scss',
})
export class AdminPricesComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly groups: { title: string; fields: Field[] }[] = [
    {
      title: 'For hosts',
      fields: [
        { key: 'partyPass', label: 'Party pass', hint: 'Once, for one event', suffix: 'MVR', max: 100000 },
        { key: 'weddingPass', label: 'Wedding pass', hint: 'Once, for one event', suffix: 'MVR', max: 100000 },
        { key: 'keepPhotosYearly', label: 'Keep your photos', hint: 'A year, for one event', suffix: 'MVR', max: 100000 },
        { key: 'sendingPerBlock', label: 'Emailed invitations', hint: 'For every 100 beyond what a pass includes', suffix: 'MVR', max: 100000 },
      ],
    },
    {
      title: 'For professionals',
      fields: [
        { key: 'studioMonthly', label: 'Studio, a month', hint: '', suffix: 'MVR', max: 1000000 },
        { key: 'studioYearly', label: 'Studio, a year', hint: '', suffix: 'MVR', max: 1000000 },
        { key: 'studioDiscountPercent', label: 'Studio discount on passes', hint: 'Off each pass a Studio buys for a client', suffix: '%', max: 90 },
        { key: 'venueMonthlyFrom', label: 'Venue, a month from', hint: 'Larger properties are quoted', suffix: 'MVR', max: 1000000 },
      ],
    },
    {
      title: 'Dollars',
      fields: [
        { key: 'mvrPerUsd', label: 'Rufiyaa to the dollar', hint: 'For the approximate dollar prices shown alongside', suffix: 'MVR', max: 1000, step: 0.01, precision: 2 },
      ],
    },
  ];

  protected readonly saved = signal<Prices | null>(null);
  protected readonly defaults = signal<Prices | null>(null);
  protected readonly draft = signal<Prices | null>(null);
  protected readonly failed = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmingReset = signal(false);

  protected readonly changed = computed(() => {
    const d = this.draft();
    const s = this.saved();
    return !!d && !!s && (Object.keys(d) as (keyof Prices)[]).some((k) => d[k] !== s[k]);
  });

  protected readonly atDefaults = computed(() => {
    const s = this.saved();
    const d = this.defaults();
    return !!s && !!d && (Object.keys(d) as (keyof Prices)[]).every((k) => s[k] === d[k]);
  });

  /** What a Studio pays for each pass at the drafted discount, the way the server rounds it. */
  protected readonly studioPasses = computed(() => {
    const d = this.draft();
    if (!d) return null;
    const off = (price: number) => Math.round((price * (100 - d.studioDiscountPercent)) / 100);
    return { party: off(d.partyPass), wedding: off(d.weddingPass) };
  });

  /** The same checks the server makes, so Save says why before it is pressed. */
  protected readonly problems = computed(() => {
    const d = this.draft();
    if (!d) return [];
    const out: string[] = [];
    for (const g of this.groups)
      for (const f of g.fields)
        if (f.key !== 'studioDiscountPercent' && !(d[f.key] > 0)) out.push(`${f.label} must be more than 0.`);
    if (d.studioDiscountPercent < 0 || d.studioDiscountPercent > 90) out.push('The Studio discount must be between 0 and 90%.');
    if (d.weddingPass < d.partyPass) out.push("The Wedding pass can't cost less than the Party pass.");
    if (d.studioYearly < d.studioMonthly) out.push("Studio a year can't cost less than a month.");
    return out;
  });

  constructor() {
    this.api.adminPrices().subscribe({
      next: (r) => {
        this.defaults.set(r.defaults);
        this.adopt(r.current);
      },
      error: () => this.failed.set(true),
    });
  }

  private adopt(p: Prices): void {
    this.saved.set(p);
    this.draft.set({ ...p });
  }

  protected set(key: keyof Prices, value: number | null): void {
    this.draft.update((d) => (d ? { ...d, [key]: value ?? 0 } : d));
  }

  protected dollars(key: keyof Prices): string {
    const d = this.draft();
    if (!d || key === 'mvrPerUsd' || key === 'studioDiscountPercent') return '';
    return usd(d[key], d.mvrPerUsd);
  }

  protected isDefault(key: keyof Prices): boolean {
    return this.draft()?.[key] === this.defaults()?.[key];
  }

  protected save(): void {
    const d = this.draft();
    if (!d || this.saving() || this.problems().length) return;
    this.saving.set(true);
    this.api.adminSetPrices(d).subscribe({
      next: (p) => {
        this.adopt(p);
        this.saving.set(false);
        this.refreshCatalog();
        this.toast.success('Prices saved. Everything charged from now on uses them.');
      },
      error: () => this.saving.set(false),
    });
  }

  protected reset(): void {
    this.api.adminResetPrices().subscribe({
      next: (p) => {
        this.adopt(p);
        this.refreshCatalog();
        this.toast.success('Back to the prices in code.');
      },
    });
  }

  protected undo(): void {
    const s = this.saved();
    if (s) this.draft.set({ ...s });
  }

  /** So this tab's own copy of the site (the pricing page, the landing) shows the new prices too. */
  private refreshCatalog(): void {
    this.api.plans().subscribe({ next: (c) => setCatalog(c), error: () => {} });
  }
}
