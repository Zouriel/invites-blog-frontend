import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { CheckoutFlow } from '../checkout/checkout-flow.service';
import { SessionStore } from '../services/session.store';
import { PremiumOfferComponent } from './premium-offer.component';

/** The offer raised by the AI designer and by Download all is the Plans page's Premium card (docs/PRICING-2026-11.md). */
async function mount(reason: 'ai' | 'download', account: Record<string, unknown> | null) {
  const checkout = { start: vi.fn(() => EMPTY), review: signal(null) };
  TestBed.configureTestingModule({
    imports: [PremiumOfferComponent],
    providers: [
      provideRouter([]),
      { provide: CheckoutFlow, useValue: checkout },
      { provide: UiToastService, useValue: { info: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(!!account), account: signal(account) } },
    ],
  });
  const fixture = TestBed.createComponent(PremiumOfferComponent);
  fixture.componentRef.setInput('reason', reason);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  const text = () => (document.body.textContent ?? '').replace(/\s+/g, ' ');
  const button = (re: RegExp) => Array.from(document.querySelectorAll('ui-button button')).find((b) => re.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
  return { fixture, checkout, text, button };
}

describe('the Premium offer', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('for the AI designer, not on Premium: Premium with the tick on, MVR 154, buying premium-ai-monthly', async () => {
    const { text, button, checkout } = await mount('ai', { id: 'me', subscriptionTier: 'None' });
    expect(text()).toContain('Design with the AI designer');
    expect(text()).toContain('Add the AI designer');
    button(/Subscribe · MVR 154 a month/)!.click();
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'premium-ai-monthly', returnPath: '/billing' }));
  });

  it('for the AI designer, on Premium without it: only the add-on (designer-ai-add)', async () => {
    const { button, checkout } = await mount('ai', {
      id: 'me', subscriptionTier: 'Premium', subscriptionEndsAt: null, addOns: [{ key: 'designer-ai', active: false, renews: false, endsAt: null }],
    });
    expect(button(/Subscribe/)).toBeUndefined();
    button(/Add the AI designer/)!.click();
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'designer-ai-add' }));
  });

  it('for Download all: Premium alone (MVR 77), the tick left off', async () => {
    const { text, button, checkout } = await mount('download', { id: 'me', subscriptionTier: 'None' });
    expect(text()).toContain('Download more than 10 at once with Premium');
    button(/Subscribe · MVR 77 a month/)!.click();
    expect(checkout.start).toHaveBeenCalledWith(expect.objectContaining({ item: 'premium-monthly' }));
  });
});
