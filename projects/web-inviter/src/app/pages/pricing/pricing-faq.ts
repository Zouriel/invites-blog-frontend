import { catalog, formatBytes, mvr, plan, usd } from '../../shared/utils/plans';

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
  const venue = plan('Venue');
  const studio = plan('Studio');
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
      a: `Sharing the link yourself, on WhatsApp or anywhere, is free. When invites.blog emails each guest their own link it costs ${price(c.sending.perBlock)} for every ${c.sending.blockSize} guests. A Party pass includes the first ${party.includedInvites} and a Wedding pass the first ${wedding.includedInvites}; on Free, ask us to add them. Sending the same guest their invitation again is never counted twice.`,
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
      q: 'I design invitations for clients. What is Studio?',
      a: `Studio is for designers and planners. It includes the template designer, to make and publish your own designs. Your clients' events are in one place, invitations you made for them say "Designed by" you, and a client you design for gets ${c.studioDiscountPercent}% off their pass automatically (their first event on that design). It is ${price(studio.price)} a month or ${price(studio.yearlyPrice!)} a year.`,
    },
    {
      q: 'We are a resort or hall. What is Venue?',
      a: `Every wedding, vow renewal and retreat at your property gets its own photo albums (${formatBytes(venue.eventBytes!)} and up to ${venue.maxBuckets} albums each), with your name and logo on the QR cards and galleries. Your staff run the events; guests need no app. From ${price(venue.price)} a month.`,
    },
    {
      q: 'How do I pay?',
      a: 'Online payments are being set up. Until then, ask us and we will add the pass or switch your plan on.',
    },
  ];
}
