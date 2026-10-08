import { refundLine } from './checkout-review.component';
import { BillingItem } from '../utils/types/api.types';

/**
 * The refund terms said before paying must match what is being bought: a plan that renews is
 * cancelled, not refunded; a pass is refundable until it's used; sent emails never are. Every item
 * on sale is listed, so a new one can't silently fall into the pass wording.
 */
describe('refund terms on the review step', () => {
  const plans: BillingItem[] = ['premium-monthly', 'venue-monthly'];
  const passes: BillingItem[] = ['party-pass', 'wedding-pass', 'party-extension', 'wedding-extension', 'keep-photos'];

  it.each(plans)('%s is a renewing plan: turning off renewal, no refund of the period', (item) => {
    expect(refundLine(item)).toContain('Turning off renewal');
    expect(refundLine(item)).not.toContain('Refundable until');
  });

  it.each(passes)('%s is refundable until used', (item) => {
    expect(refundLine(item)).toContain('Refundable until');
  });

  it('emailed invitations are not refundable once sent', () => {
    expect(refundLine('sending')).toContain('not refundable once sent');
  });
});
