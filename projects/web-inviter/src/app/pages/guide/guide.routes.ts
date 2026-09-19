import { Type, inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { GUIDES } from './guides';

/** Each guide's body, loaded on its own, keyed by its slug in GUIDES. A guide added there needs a body here. */
const BODIES: Record<string, () => Promise<Type<unknown>>> = {
  account: () => import('./account/account-guide.component').then((m) => m.AccountGuideComponent),
  'create-an-event': () =>
    import('./create-event/create-event-guide.component').then((m) => m.CreateEventGuideComponent),
  'animated-invitations': () => import('./animated/animated-guide.component').then((m) => m.AnimatedGuideComponent),
  'your-own-design': () => import('./own-design/own-design-guide.component').then((m) => m.OwnDesignGuideComponent),
  'guest-list': () => import('./guest-list/guest-list-guide.component').then((m) => m.GuestListGuideComponent),
  sharing: () => import('./sharing/sharing-guide.component').then((m) => m.SharingGuideComponent),
  'photo-buckets': () =>
    import('./photo-buckets/photo-buckets-guide.component').then((m) => m.PhotoBucketsGuideComponent),
  feed: () => import('./feed/feed-guide.component').then((m) => m.FeedGuideComponent),
  celebrants: () => import('./celebrants/celebrants-guide.component').then((m) => m.CelebrantsGuideComponent),
};

/**
 * The help centre's children: /guide (every guide) and /guide/:slug, each with its own search tags.
 * Public and prerendered (see app.routes.server.ts), so each guide's text is in the HTML crawlers get.
 */
export const GUIDE_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    data: {
      seo: {
        title: 'Guides',
        description:
          'Step-by-step guides to invites.blog: your account, creating an event, invitations, guest lists, sending, photo albums and your feed.',
      },
    },
    loadComponent: () => import('./overview/guide-overview.component').then((m) => m.GuideOverviewComponent),
  },
  ...GUIDES.map((g) => ({
    path: g.slug,
    data: { seo: g.seo },
    loadComponent: BODIES[g.slug],
  })),
  // A guide that doesn't exist (an old or mistyped link) lands on the list of the ones that do.
  { path: '**', redirectTo: () => inject(Router).parseUrl('/guide') },
];
