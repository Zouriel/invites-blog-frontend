import { CHARGE } from '../../shared/utils/constants/company';
import { catalog, formatBytes, mvr, plan, usd, venueDiscount } from '../../shared/utils/plans';

/** "MVR 699 (≈ $45)". */
const price = (amount: number) => `${mvr(amount)} (${usd(amount)})`;
/** "a year" for 365 days, otherwise the days. */
const span = (days: number | null) => (days === 365 ? 'a year' : `${days} days`);

/**
 * The pricing page's questions, shown on the page and given to search engines as structured data
 * (app.routes.ts). Kept apart from the page so the route can read it without loading the page, and
 * built from the catalog in force when asked, so the answers follow the prices an admin sets.
 */
export function pricingFaq(): { q: string; a: string }[] {
  const party = plan('PartyPass');
  const wedding = plan('WeddingPass');
  const free = plan('Free');
  const premium = plan('Premium');
  const c = catalog();
  const lapse = c.lapse;

  return [
    {
      q: 'Is it really free to make an invitation?',
      a: `Yes. Designs, your wording, the guest list, replies and sharing your own link never cost anything, and every event gets ${formatBytes(free.eventBytes!)} for photos and videos. You pay only when one event needs more, or when invites.blog emails the invitations for you.`,
    },
    {
      q: 'Which pass is right for a wedding?',
      a: `The Wedding pass (${price(wedding.price)}, once). It gives that event ${formatBytes(wedding.eventBytes!)}, up to ${wedding.maxBuckets} albums for the nikah, the reception and the after-party, guests adding photos until ${wedding.maxWindowDays} days after it starts, private albums, and sending to ${wedding.includedInvites} guests. A Party pass (${price(party.price)}) suits birthdays and smaller parties.`,
    },
    {
      q: 'What does sending cost?',
      a: `Sharing the link yourself, on WhatsApp or anywhere, is free. When invites.blog emails each guest their own link it costs ${price(c.sending.perBlock)} for every ${c.sending.blockSize} guests. A Party pass includes the first ${party.includedInvites} and a Wedding pass the first ${wedding.includedInvites}; on Free, add them to the event from Billing. Sending the same guest their invitation again is never counted twice.`,
    },
    {
      q: 'What happens when a pass runs out?',
      a: `We email you a month before and a week before. You can keep it another year for less than the pass, since no invitations are included: ${price(party.extensionPrice ?? 0)} for a Party pass, ${price(wedding.extensionPrice ?? 0)} for a Wedding pass. If you don't, the photos start to wind down as described below.`,
    },
    {
      q: 'Can I send a save the date first?',
      a: `Yes, free to make and share. Guests get your design and a button to add the day to Google, Outlook or Apple Calendar; it has no replies or album, since those come with the invitation. When you make the invitation from it, the guest list comes along and anyone already emailed isn't counted twice.`,
    },
    {
      q: 'How long are the photos kept?',
      a: `${free.retentionDays} days after the event on Free, and ${span(party.retentionDays)} with a pass. "Keep your photos" keeps them online for another ${c.keepPhotos.months === 12 ? 'year' : `${c.keepPhotos.months} months`} at ${price(c.keepPhotos.price)}. When cover ends, uploads stop, guests can still look for ${lapse.organiserOnlyDay} days, then only you can for another ${lapse.deleteDay - lapse.organiserOnlyDay}, and then they are removed. We email you before each step.`,
    },
    {
      q: 'What is the Premium pass?',
      a: `A monthly subscription, ${price(premium.price)} a month, for people who host often. Every event you organise gets ${formatBytes(premium.eventBytes!)} for photos and videos instead of ${formatBytes(free.eventBytes!)}, no "Made with invites.blog" mark, and its photos are kept for as long as you subscribe. A Party or Wedding pass still adds more to any one event. If you stop, the photos wind down as described below, counted from the day it ends.`,
    },
    {
      q: 'Can I design my own invitation?',
      a: 'Yes. The template designer is free for every account: make a design, use it for your own events, publish it for one person, or share it in the gallery.',
    },
    {
      q: 'We are a resort or hall. What is Venue?',
      a: `An account for resorts and halls, ${mvr(plan('Venue').price)} a month. You make the events for your couples and buy their Party or Wedding pass ${venueDiscount()}% off, renewals too, and charge them yourself, at your own price. Your name and logo go on the QR cards and albums, and your staff can run the events. It renews by itself each month on the card you paid with, until you turn that off in Billing. Get it from this page.`,
    },
    {
      q: 'How do I pay?',
      a: `You choose Free or a pass at the last step of setting up your event, before anything is sent; until then it stays a draft. A pass for an event you have already shared can be added from Billing. You pay by card (American Express, Visa, Mastercard, Maestro or UnionPay) on Bank of Maldives’ secure page, in ${CHARGE.name} (${CHARGE.code}), and the pass is on as soon as the payment is confirmed. Refunds are limited; see the Refunds page before you pay.`,
    },
  ];
}
