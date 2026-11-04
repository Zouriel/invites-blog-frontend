import { CHARGE } from '../../shared/utils/constants/company';
import { BACK_TO_FREE, catalog, formatBytes, mvr, plan, usd, venueDiscount } from '../../shared/utils/plans';

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
  const gold = plan('GoldPass');
  const platinum = plan('PlatinumPass');
  const free = plan('Free');
  const premium = plan('Premium');
  const c = catalog();

  return [
    {
      q: 'Is it really free to make an invitation?',
      a: `Yes. Designs, your wording, the guest list, replies and sharing your own link never cost anything, and every event gets ${formatBytes(free.eventBytes!)} for photos and videos. You pay only when one event needs more, or when invites.blog emails the invitations for you.`,
    },
    {
      q: 'Which pass is right for a wedding?',
      a: `The Platinum pass (${price(platinum.price)}, once). It gives that event ${formatBytes(platinum.eventBytes!)}, up to ${platinum.maxBuckets} albums for the nikah, the reception and the after-party, guests adding photos until ${platinum.maxWindowDays} days after it starts, private albums, and sending to ${platinum.includedInvites} guests. A Gold pass (${price(gold.price)}) suits birthdays and smaller parties.`,
    },
    {
      q: 'What does sending cost?',
      a: `Sharing the link yourself, on WhatsApp or anywhere, is free. When invites.blog emails each guest their own link it costs ${price(c.sending.perBlock)} for every ${c.sending.blockSize} guests. A Gold pass includes the first ${gold.includedInvites} and a Platinum pass the first ${platinum.includedInvites}; on Free, add them to the event from Billing. Sending the same guest their invitation again is never counted twice.`,
    },
    {
      q: 'What happens when a pass runs out?',
      a: `We email you a month before and a week before. You can keep it another year for less than the pass, since no invitations are included: ${price(gold.extensionPrice ?? 0)} for a Gold pass, ${price(platinum.extensionPrice ?? 0)} for a Platinum pass. If you don't, the event goes back to Free: up to ${formatBytes(free.eventBytes!)} is kept for good, and we warn you ${BACK_TO_FREE.noticeDays} days before anything above that is removed, so you can download everything first.`,
    },
    {
      q: 'What can I add to an event I already have?',
      a: `From Billing: a pass, another year of the pass it has, ${c.sending.blockSize} more emailed invitations for ${price(c.sending.perBlock)}, and, once a pass has ended, "Keep your photos" (${price(c.keepPhotos.price)} a year) to keep everything without the pass. A free event needs none of these to keep its photos: they are kept forever.`,
    },
    {
      q: 'Can I send a save the date first?',
      a: `Yes, free to make and share. Guests get your design and a button to add the day to Google, Outlook or Apple Calendar; it has no replies or album, since those come with the invitation. When you make the invitation from it, the guest list comes along and anyone already emailed isn't counted twice.`,
    },
    {
      q: 'How long are the photos kept?',
      a: `Free albums are kept forever. With a pass, everything is kept for ${span(gold.retentionDays)}; when it ends the event goes back to Free and up to ${formatBytes(free.eventBytes!)} is kept forever. "Keep your photos" keeps everything for another ${c.keepPhotos.months === 12 ? 'year' : `${c.keepPhotos.months} months`} at ${price(c.keepPhotos.price)}. Before anything above ${formatBytes(free.eventBytes!)} is removed we email you and send a notification ${BACK_TO_FREE.noticeDays} days, ${BACK_TO_FREE.reminderDaysBefore} days and ${BACK_TO_FREE.finalDaysBefore} day before, so you can download everything. The cover photos and the earliest uploads are kept first.`,
    },
    {
      q: 'What is the Premium pass?',
      a: `A monthly subscription, ${price(premium.price)} a month, for people who host often. Every event you organise gets ${formatBytes(premium.eventBytes!)} for photos and videos instead of ${formatBytes(free.eventBytes!)}, no "Made with invites.blog" mark, and everything is kept for as long as you subscribe. A Gold or Platinum pass still adds more to any one event. If you stop, your events go back to Free: up to ${formatBytes(free.eventBytes!)} each is kept forever, and we warn you ${BACK_TO_FREE.noticeDays} days before anything above that is removed.`,
    },
    {
      q: 'Can I design my own invitation?',
      a: 'Yes. The template designer is free for every account: make a design, use it for your own events, publish it for one person, or share it in the gallery.',
    },
    {
      q: 'We are a resort or hall. What is Venue?',
      a: `An account for resorts and halls, ${mvr(plan('Venue').price)} a month. You make the events for your couples and buy their Gold or Platinum pass ${venueDiscount()}% off, renewals too, and charge them yourself, at your own price. Your name and logo go on the QR cards and albums, and your staff can run the events. It renews by itself each month on the card you paid with, until you turn that off in Billing. Get it from this page.`,
    },
    {
      q: 'How do I pay?',
      a: `You choose Free or a pass at the last step of setting up your event, before anything is sent; until then it stays a draft. A pass for an event you have already shared can be added from Billing. You pay by card (American Express, Visa, Mastercard, Maestro or UnionPay) on Bank of Maldives’ secure page, in ${CHARGE.name} (${CHARGE.code}), and the pass is on as soon as the payment is confirmed. Refunds are limited; see the Refunds page before you pay.`,
    },
    {
      q: 'Can I download all the photos?',
      a: 'Yes. On an album, choose Download all to get the whole album as one zip, however large. Or select photos and save them to your gallery, or share them to any app.',
    },
    {
      q: 'What time is shown on an invitation?',
      a: 'Each event has a time zone, which starts as yours and can be changed when you set the date and time. The date and time show in the event’s own time zone, with its label, for example 7:00 pm GMT+5. A guest in a different time zone also sees their own time beside it, for example (2:00 pm your time).',
    },
    {
      q: 'How do invitations get sent?',
      a: 'If you choose, invites.blog emails each guest their invitation for you, by email only. WhatsApp, Viber and Telegram are sent from your own phone or computer: each guest has three buttons that open that app with their personal link ready. Sending yourself is always free.',
    },
  ];
}
