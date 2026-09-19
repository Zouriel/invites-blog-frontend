import { PLAN_CATALOG, formatBytes, mvr, plan } from '../../shared/utils/plans';

const party = plan('PartyPass');
const wedding = plan('WeddingPass');
const free = plan('Free');

/**
 * The pricing page's questions, shown on the page and given to search engines as structured data
 * (app.routes.ts). Kept apart from the page so the route can read it without loading the page, and
 * built from the one catalog so the answers can't drift from the prices.
 */
export const PRICING_FAQ = [
  {
    q: 'Is it really free to make an invitation?',
    a: `Yes. Designs, your wording, the guest list, replies and sharing your own link never cost anything, and every event gets ${formatBytes(free.eventBytes!)} for photos and videos. You pay only when one event needs more, or when invites.blog emails the invitations for you.`,
  },
  {
    q: 'Which pass is right for a wedding?',
    a: `The Wedding pass (${mvr(wedding.price)}, once). It gives that event ${formatBytes(wedding.eventBytes!)}, up to ${wedding.maxBuckets} albums for the nikah, the reception and the after-party, ${wedding.maxWindowDays} days for guests to add photos, private albums, and sending to ${wedding.includedInvites} guests. A Party pass (${mvr(party.price)}) suits birthdays and smaller parties.`,
  },
  {
    q: 'What does sending cost?',
    a: `Sharing the link yourself, on WhatsApp or anywhere, is free. When invites.blog emails each guest their own link it costs ${mvr(PLAN_CATALOG.sending.perBlock)} for every ${PLAN_CATALOG.sending.blockSize} guests. A Party pass includes the first ${party.includedInvites} and a Wedding pass the first ${wedding.includedInvites}.`,
  },
  {
    q: 'How long are the photos kept?',
    a: `${free.retentionDays} days after the event on Free, and a year with a pass. "Keep your photos" keeps them online for another year at ${mvr(PLAN_CATALOG.keepPhotos.price)}. When cover ends, uploads stop, guests can still look for 30 days, then only you can for another 60, and then they are removed. We email you before each step.`,
  },
  {
    q: 'I design invitations for clients. What is Studio?',
    a: `Studio is for designers and planners. Your clients' events are in one place, invitations you made for them say "Designed by" you, and you buy passes at ${PLAN_CATALOG.studioDiscountPercent}% off to include in your packages.`,
  },
  {
    q: 'We are a resort or hall. What is Venue?',
    a: 'Every wedding, vow renewal and retreat at your property gets its own photo albums, with your name and logo on the QR cards and galleries. Your staff run the events; guests need no app.',
  },
  {
    q: 'How do I pay?',
    a: 'Online payments are being set up. Until then, ask us and we will add the pass or switch your plan on.',
  },
];
