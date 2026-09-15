/**
 * The help centre's guides, in reading order. One list feeds the side navigation, the phone
 * dropdown, the overview page, the previous/next links, the routes and their search tags, and the
 * prerender list — so a guide added here shows up everywhere at once.
 */
export type GuideGroup = 'Getting started' | 'Invitations' | 'After the invitations' | 'For designers';

export type Guide = {
  slug: string;
  group: GuideGroup;
  /** The heading on the page and the label in the navigation. */
  title: string;
  /** The line under the heading, and the overview's summary. */
  lead: string;
  seo: { title: string; description: string };
};

export const GUIDE_GROUPS: GuideGroup[] = ['Getting started', 'Invitations', 'After the invitations', 'For designers'];

export const GUIDES: Guide[] = [
  {
    slug: 'account',
    group: 'Getting started',
    title: 'Your account',
    lead: 'Create an account, sign in, and put your email and phone number on the same account.',
    seo: {
      title: 'Your account: sign up, sign in and add your phone',
      description:
        'How to create an invites.blog account, sign in, and add your phone number or email so invitations sent to either reach one account.',
    },
  },
  {
    slug: 'create-an-event',
    group: 'Getting started',
    title: 'Create an event',
    lead: 'Start an event, add an invitation if you want one, and finish by sharing it.',
    seo: {
      title: 'How to create an event',
      description:
        'The steps for creating an event on invites.blog, with an animated invitation, your own design, or no invitation at all.',
    },
  },
  {
    slug: 'animated-invitations',
    group: 'Invitations',
    title: 'Animated invitations',
    lead: 'A design that shows each guest their own name, the details meant for them, a reply button and a camera on the day.',
    seo: {
      title: 'Animated invitations: design, roles, theme and content',
      description:
        'Choose an animated invitation design, set up roles so guests see the right details, change its colours and fill in its words and photos.',
    },
  },
  {
    slug: 'your-own-design',
    group: 'Invitations',
    title: 'Your own design',
    lead: 'Made your invitation in Canva or somewhere else? Upload it and still get a guest list, replies and photos.',
    seo: {
      title: 'Use your own invitation design',
      description:
        'Upload a picture or video you made yourself, share one open link or send it to a guest list, and still collect replies and photos.',
    },
  },
  {
    slug: 'guest-list',
    group: 'Invitations',
    title: 'Guest list',
    lead: 'Your guest list is an Excel file with one guest per row. Here is exactly how to set it out so every invitation reaches the right person.',
    seo: {
      title: 'Guest list guide',
      description:
        'How to prepare your guest list spreadsheet for invites.blog: the columns, roles, a good example and common mistakes.',
    },
  },
  {
    slug: 'sharing',
    group: 'Invitations',
    title: 'Sharing and sending',
    lead: 'Share the links yourself for free, or have invites.blog email each guest their own link. Replies come back to your event.',
    seo: {
      title: 'Sharing and sending invitations',
      description:
        'Share invitation links yourself or have invites.blog email every guest, what sending costs, and where replies show up.',
    },
  },
  {
    slug: 'photo-buckets',
    group: 'After the invitations',
    title: 'Photo buckets',
    lead: 'Every event has a bucket: one place for the photos and videos everyone takes.',
    seo: {
      title: 'Photo buckets: collect every guest’s photos',
      description:
        'How guests add photos with the camera in their invitation or a printed QR code, who can see them, bucket sizes by plan, and downloading.',
    },
  },
  {
    slug: 'feed',
    group: 'After the invitations',
    title: 'Your feed',
    lead: 'Each event becomes a post in your feed, with its photos, a caption, likes and comments.',
    seo: {
      title: 'Your feed: event posts, likes and comments',
      description:
        'How event posts work on invites.blog: who sees them, likes, comments and replies, and how organisers set the caption and cover photos.',
    },
  },
  {
    slug: 'celebrants',
    group: 'After the invitations',
    title: 'People the event is for',
    lead: 'Add the couple, the birthday child or whoever the event is for, so it shows up in their account too.',
    seo: {
      title: 'Adding the people an event is for',
      description:
        'Add the people an event is for so they can see who is coming and every photo, and give them full access when they help organise.',
    },
  },
  {
    slug: 'templates',
    group: 'For designers',
    title: 'Making a template',
    lead: 'Everything you need to build an animated invitation template: what to put in the file, how the platform fills it in for each guest, and how to get it into the gallery.',
    seo: {
      title: 'Making an invitation template',
      description: 'The reference for designers building animated HTML invitation templates for invites.blog.',
    },
  },
];

export function guideBySlug(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}
