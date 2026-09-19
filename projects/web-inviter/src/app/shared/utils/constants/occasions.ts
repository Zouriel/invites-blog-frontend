import { formatBytes, mvr, passSummary, plan } from '../plans';

/**
 * One landing page per occasion, at /invitations/{slug}. Each is written for what somebody planning
 * that occasion searches for, and lists the designs of the matching template category.
 */
export type Occasion = {
  slug: string;
  /** The template category these designs are filed under, exactly as the gallery names it. */
  category: string;
  /** The page's H1 and the start of its title. */
  heading: string;
  description: string;
  intro: string;
  /** What the invitation does for this occasion in particular. */
  points: string[];
  faq: { q: string; a: string }[];
};

const free = plan('Free');
const party = plan('PartyPass');
const wedding = plan('WeddingPass');

const SHARED_FAQ = [
  {
    q: 'Is it free?',
    a: `Making your invitation, collecting replies and sharing your link are free, and every event gets ${formatBytes(free.eventBytes!)} of guests’ photos. A Party pass (${mvr(party.price)}) or Wedding pass (${mvr(wedding.price)}) adds more space and albums for one big event, and includes invitations emailed for you.`,
  },
  {
    q: 'What makes it different from an image or PDF invitation?',
    a: 'It is built like a small web page rather than a picture. It moves as your guest scrolls, shows each guest their own name and the details meant for them, and lets them reply with one tap. On the day of the event it opens a camera, and every photo lands in your event.',
  },
  {
    q: 'Can I use my own design instead?',
    a: 'Yes. Upload a picture or video you already made, in Canva for example, and you still get the guest list, replies and everyone’s photos.',
  },
];

export const OCCASIONS: Occasion[] = [
  {
    slug: 'wedding',
    category: 'Wedding',
    heading: 'Animated wedding invitations',
    description:
      'Animated online wedding invitations that show each guest their own name, dress colours and schedule. Free to make, with RSVPs and every guest’s photos in one place.',
    intro:
      'A wedding invitation your guests scroll through, not just look at. Each guest opens their own link, sees their name, the colours to wear and the parts of the day meant for them, and replies in a tap.',
    points: [
      'Different details for family, friends and the bridal party',
      'Dress colours per guest, shown on their invitation',
      'A camera inside the invitation on the wedding day',
      'Every photo and video from your guests in one album',
    ],
    faq: [
      {
        q: 'Can the couple see the replies too?',
        a: 'Yes. Add the bride and groom to the event and it appears in their own account, with who is coming and all the photos, even if somebody else organised it.',
      },
      {
        q: 'Which pass does a wedding need?',
        a: `Most weddings take the Wedding pass (${mvr(wedding.price)}, once): ${passSummary(wedding)}. You can make the invitation and share it free first, and add the pass any time before the day.`,
      },
      ...SHARED_FAQ,
    ],
  },
  {
    slug: 'engagement',
    category: 'Engagement',
    heading: 'Animated engagement invitations',
    description:
      'Online engagement invitations that move, greet each guest by name and collect RSVPs and photos. Free to make.',
    intro:
      'Announce it with an invitation that feels like the occasion. Every guest gets their own animated invitation with their name on it, and you see who is coming as the replies arrive.',
    points: [
      'Each guest’s name on their own invitation',
      'Replies on your dashboard as they come in',
      'Guests take photos from the invitation on the night',
      'Share by email, or paste the links anywhere',
    ],
    faq: SHARED_FAQ,
  },
  {
    slug: 'birthday',
    category: 'Birthday',
    heading: 'Animated birthday invitations',
    description:
      'Animated online birthday party invitations with each guest’s name, one-tap RSVP and a shared photo album from the party. Free to make.',
    intro:
      'Birthday invitations that move when your guests open them. Each person gets their own link with their name on it, replies in a tap, and on the day uses the invitation to add their photos to the party album.',
    points: [
      'For kids’ parties, milestone birthdays and surprise parties',
      'Each guest sees their own name',
      'Photos from the party collected in one place',
      'No app for your guests to install',
    ],
    faq: SHARED_FAQ,
  },
  {
    slug: 'anniversary',
    category: 'Anniversary',
    heading: 'Animated anniversary invitations',
    description:
      'Online anniversary invitations that move, greet every guest by name and gather RSVPs and photos in one place. Free to make.',
    intro:
      'Celebrate the years with an invitation that opens like a keepsake. Each guest sees their own name, replies in a tap, and adds their photos from the celebration.',
    points: [
      'An animated invitation for each guest',
      'Replies listed on your dashboard',
      'Everyone’s photos from the day in one album',
      'Send by email or share the links yourself',
    ],
    faq: SHARED_FAQ,
  },
  {
    slug: 'baby-shower',
    category: 'Baby Shower',
    heading: 'Animated baby shower invitations',
    description:
      'Animated online baby shower invitations with each guest’s name, one-tap RSVP and a shared photo album. Free to make.',
    intro:
      'A baby shower invitation that moves, with each guest’s name on it. Guests reply in a tap, and every photo from the shower ends up with you.',
    points: [
      'Each guest’s name on their invitation',
      'One-tap replies, no account needed',
      'Photos from the shower in one place',
      'Share by email or any chat',
    ],
    faq: SHARED_FAQ,
  },
  {
    slug: 'corporate-event',
    category: 'Corporate Event',
    heading: 'Animated corporate event invitations',
    description:
      'Animated online invitations for galas, launches and company events, personalised per guest, with RSVP tracking and photos from the night. Free to make.',
    intro:
      'Invitations for launches, galas and company dinners that show each guest their own name and the details meant for them, with replies tracked on one dashboard.',
    points: [
      'Different details for staff, clients and VIPs',
      'RSVP tracking on one dashboard',
      'Guests add photos from the event through the invitation',
      'Upload your own branded design if you have one',
    ],
    faq: SHARED_FAQ,
  },
];

export function occasionBySlug(slug: string): Occasion | undefined {
  return OCCASIONS.find((o) => o.slug === slug);
}
