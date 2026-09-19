import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { campaignAccessGuard, designerGuard, roleGuard, signedInGuard } from './shared/guards/session.guard';
import { GUIDE_ROUTES } from './pages/guide/guide.routes';
import { pricingFaq } from './pages/pricing/pricing-faq';
import { formatBytes, mvr, plan } from './shared/utils/plans';

export const routes: Routes = [
  // The admin pages that were separate (System templates, Reports, Designers) are tabs now.
  // The old paths stay as redirects: they are in bookmarks and in the browser history of everyone
  // who has ever used the admin panel, and a dead link is a worse outcome than a hop.
  {
    path: 'admin',
    pathMatch: 'full',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/administrative/administrative.component').then(
        (m) => m.AdministrativeComponent,
      ),
  },
  // Also a function: the string 'admin' was verified in a browser to land on the home page instead.
  { path: 'admin/templates', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/admin') },
  // A FUNCTION, not a string. A query string inside redirectTo is silently dropped, so the string
  // form landed every old link on the first tab — which is the one thing these redirects exist to
  // avoid. Verified in a browser: the string form sent /admin/designers to /admin.
  // The template upload and review screens are gone (templates are made in the designer); their old
  // links land on the admin page, and a designer's old dashboard links on the designer.
  { path: 'admin/template-submissions', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/admin') },
  { path: 'admin/upload', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/admin') },
  { path: 'designer', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/template-designer') },
  { path: 'designer/requests', pathMatch: 'full', redirectTo: () => inject(Router).parseUrl('/template-designer') },
  {
    path: 'admin/designers',
    pathMatch: 'full',
    redirectTo: () => inject(Router).parseUrl('/admin/settings?tab=designers'),
  },
  // One sign-in for everyone now; the old paths still work so existing links and bookmarks land
  // somewhere sensible instead of a dead end.
  { path: 'admin/login', pathMatch: 'full', redirectTo: 'login' },
  { path: 'designer/login', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'me',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/me/me.component').then((m) => m.MeComponent),
  },
  // The professional plans' pages. Open to any signed-in account; each explains its plan to anyone
  // not on it, and the server decides who sees what.
  {
    path: 'studio',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/studio/studio.component').then((m) => m.StudioComponent),
  },
  {
    path: 'venue',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/venue-home/venue-home.component').then((m) => m.VenueHomeComponent),
  },
  {
    // Open to any signed-in account: a customer has no designs, but they do have the templates
    // reserved for them, and that tab is the only way to reach one now.
    path: 'my-templates',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./pages/my-templates/my-templates.component').then((m) => m.MyTemplatesComponent),
  },
  // The template designer's page in the menu: designer accounts get the designer; anyone else who
  // lands here is told it's for designers.
  {
    path: 'template-designer',
    title: 'Template designer · invites.blog',
    loadComponent: () => import('./pages/designer/designer-home.component').then((m) => m.DesignerHomeComponent),
  },
  // The template designer. Full-screen: the app shell hides its header and bottom bar on /design.
  {
    path: 'design/new',
    canActivate: [designerGuard],
    loadComponent: () => import('./pages/designer/design-new.component').then((m) => m.DesignNewComponent),
  },
  {
    path: 'design/import/:templateId',
    canActivate: [designerGuard],
    loadComponent: () => import('./pages/designer/design-import.component').then((m) => m.DesignImportComponent),
  },
  {
    path: 'design/:id/preview',
    canActivate: [designerGuard],
    loadComponent: () => import('./pages/designer/design-preview.component').then((m) => m.DesignPreviewComponent),
  },
  {
    path: 'design/:id',
    canActivate: [designerGuard],
    loadComponent: () => import('./pages/designer/design-editor.component').then((m) => m.DesignEditorComponent),
  },
  {
    path: 'admin/template-types',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-template-types/admin-template-types.component').then(
        (m) => m.AdminTemplateTypesComponent,
      ),
  },
  {
    path: 'admin/settings',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-settings/admin-settings.component').then(
        (m) => m.AdminSettingsComponent,
      ),
  },
  {
    path: 'admin/inquiries',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-inquiries/admin-inquiries.component').then(
        (m) => m.AdminInquiriesComponent,
      ),
  },
  {
    path: 'admin/inquiries/:id',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-inquiry-detail/admin-inquiry-detail.component').then(
        (m) => m.AdminInquiryDetailComponent,
      ),
  },
  {
    // Where the OAuth popup lands, and the redirect URI registered with each provider.
    // Deliberately NOT guarded — it has no session yet.
    path: 'oauth/callback',
    loadComponent: () =>
      import('./pages/oauth/oauth-callback.component').then((m) => m.OAuthCallbackComponent),
  },
  {
    // Creating an account as someone who receives invitations. Separate from /signup, which grants
    // the Designer role and is not what a guest wants.
    path: 'join',
    loadComponent: () => import('./pages/join/join.component').then((m) => m.JoinComponent),
  },
  {
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    // Creating anything starts here: the name and the night first, what it HAS second.
    path: 'events/new',
    // Signed in only: every event gets a media bucket, and a bucket belongs to an account.
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./pages/new-event/new-event.component').then((m) => m.NewEventComponent),
  },
  {
    // Where a signed-in person lands: what arrived, and what they sent.
    path: 'inbox',
    canActivate: [signedInGuard],
    loadComponent: () => import('./pages/inbox/inbox.component').then((m) => m.InboxComponent),
  },
  {
    // An invitation you received, opened with your account rather than an invitation link.
    path: 'invitation/:campaignId',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./pages/invitation/invitation.component').then((m) => m.InvitationComponent),
  },
  {
    // An album without an invitation is made from New event ("Skip, no invitation"), so the old
    // stand-alone page sends people there. 'new' must come BEFORE ':bucketId' or the id route eats it.
    path: 'buckets/new',
    redirectTo: 'events/new',
  },
  {
    path: 'buckets/:bucketId',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./pages/media-bucket/media-bucket.component').then((m) => m.MediaBucketComponent),
  },
  {
    // Where a scanned QR code lands. Deliberately UNGUARDED — the whole point is that somebody at a
    // party with no account can add to a bucket, and the printed token is their authorization.
    path: 'q/:token',
    loadComponent: () =>
      import('./pages/bucket-contribute/bucket-contribute.component').then(
        (m) => m.BucketContributeComponent,
      ),
  },
  {
    // Bring your own design. Unguarded: a visitor with a finished picture should not have to make an
    // account before finding out whether we can take it.
    path: 'bring-your-own',
    data: {
      seo: {
        title: 'Use your own invitation design',
        description:
          'Made your invitation in Canva or elsewhere? Upload the picture or video and still get a guest list, RSVPs and every guest’s photos.',
      },
    },
    loadComponent: () =>
      import('./pages/bring-your-own/bring-your-own.component').then(
        (m) => m.BringYourOwnComponent,
      ),
  },
  {
    path: 'inquire',
    data: {
      seo: {
        title: 'Talk to us',
        description:
          'Ask us to add a Party or Wedding pass to your event, set up Studio or Venue, or have our designers make an animated invitation just for you.',
      },
    },
    loadComponent: () =>
      import('./pages/inquire/inquire.component').then((m) => m.InquireComponent),
  },
  {
    path: '',
    data: {
      seo: {
        title: 'Animated online invitations for weddings and events',
        description:
          'Animated invitations or your own design, photo albums every guest can add to, and a page for your event to look back on. Free to make and share; a pass when one big event needs more.',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'Organization',
            name: 'invites.blog',
            url: 'https://invites.blog',
            logo: 'https://invites.blog/icon.svg',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: 'invites.blog',
            url: 'https://invites.blog',
          },
          {
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: 'invites.blog',
            url: 'https://invites.blog',
            applicationCategory: 'LifestyleApplication',
            operatingSystem: 'Any',
            description:
              "Animated HTML invitations personalised for every guest, with one-tap RSVP and a camera that collects everyone's photos and videos from the event.",
            offers: {
              '@type': 'Offer',
              price: '0',
              priceCurrency: 'MVR',
              description:
                'Free to make and share, with photo albums for every event. A pass adds more for one big event.',
            },
          },
        ],
      },
    },
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    // The gallery. Must be declared BEFORE 'templates/:slug', or the slug route would swallow it.
    path: 'templates',
    data: {
      seo: {
        title: 'Animated invitation designs',
        description:
          'Browse animated, scroll-driven invitation designs for weddings, birthdays, engagements and corporate events. Each one personalises itself for every guest.',
      },
    },
    loadComponent: () =>
      import('./pages/templates/templates.component').then((m) => m.TemplatesComponent),
  },
  {
    path: 'templates/:slug',
    data: { seoByPage: true },
    loadComponent: () =>
      import('./pages/template-detail/template-detail.component').then(
        (m) => m.TemplateDetailComponent,
      ),
  },
  {
    path: 'create/:campaignId/editor',
    canActivate: [campaignAccessGuard],
    loadComponent: () => import('./pages/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'create/:campaignId/theming',
    canActivate: [campaignAccessGuard],
    loadComponent: () =>
      import('./pages/theming/theming.component').then((m) => m.ThemingComponent),
  },
  {
    path: 'create/:campaignId/roles',
    canActivate: [campaignAccessGuard],
    loadComponent: () => import('./pages/roles/roles.component').then((m) => m.RolesComponent),
  },
  {
    path: 'create/:campaignId/guests',
    canActivate: [campaignAccessGuard],
    loadComponent: () => import('./pages/guests/guests.component').then((m) => m.GuestsComponent),
  },
  {
    path: 'create/:campaignId/guests/review',
    canActivate: [campaignAccessGuard],
    loadComponent: () =>
      import('./pages/guests-review/guests-review.component').then((m) => m.GuestsReviewComponent),
  },
  {
    path: 'create/:campaignId/venue',
    canActivate: [campaignAccessGuard],
    loadComponent: () => import('./pages/venue/venue.component').then((m) => m.VenueComponent),
  },
  {
    path: 'create/:campaignId/rsvp',
    canActivate: [campaignAccessGuard],
    loadComponent: () =>
      import('./pages/rsvp-questions/rsvp-questions.component').then(
        (m) => m.RsvpQuestionsComponent,
      ),
  },
  {
    path: 'create/:campaignId/inviter',
    canActivate: [campaignAccessGuard],
    loadComponent: () =>
      import('./pages/inviter/inviter.component').then((m) => m.InviterComponent),
  },
  {
    // How much room the photos get. After the invitation, or on its own when there is no invitation.
    path: 'create/:campaignId/photos',
    canActivate: [signedInGuard],
    loadComponent: () =>
      import('./pages/photos-step/photos-step.component').then((m) => m.PhotosStepComponent),
  },
  {
    path: 'create/:campaignId/delivery',
    canActivate: [campaignAccessGuard],
    loadComponent: () =>
      import('./pages/delivery/delivery.component').then((m) => m.DeliveryComponent),
  },
  {
    path: 'create/:campaignId/success',
    canActivate: [campaignAccessGuard],
    loadComponent: () =>
      import('./pages/success/success.component').then((m) => m.SuccessComponent),
  },
  {
    path: 'dashboard/:campaignId',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    // The old hand-written-template reference is gone (templates are made in the designer); its old
    // address lands on the guides. A FUNCTION redirect, like the admin ones above: the string form was
    // verified to misbehave here.
    path: 'template-guide',
    pathMatch: 'full',
    redirectTo: () => inject(Router).parseUrl('/guide'),
  },
  {
    // The help centre: /guide lists every guide, /guide/:slug is one of them. Public and unguarded, so
    // it can be read before anyone has an account.
    path: 'guide',
    loadComponent: () =>
      import('./pages/guide/guide-shell.component').then((m) => m.GuideShellComponent),
    children: GUIDE_ROUTES,
  },
  {
    path: 'privacy',
    data: {
      seo: {
        title: 'Privacy Policy',
        description: 'How invites.blog handles your data and your guests’ data.',
      },
    },
    loadComponent: () =>
      import('./pages/privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'terms',
    data: { seo: { title: 'Terms of Service', description: 'The terms for using invites.blog.' } },
    loadComponent: () => import('./pages/terms/terms.component').then((m) => m.TermsComponent),
  },
  {
    // One page per occasion, written for what people planning it search for.
    path: 'invitations/:occasion',
    data: { seoByPage: true },
    loadComponent: () =>
      import('./pages/occasion/occasion.component').then((m) => m.OccasionComponent),
  },
  {
    path: 'pricing',
    data: {
      // Getters, read when the page opens: by then the app has loaded the prices in force, so the
      // description and the FAQ given to search engines match what the page itself says.
      seo: {
        title: 'Pricing: free invitations, a pass per event for more',
        get description() {
          return `Invitations, replies and sharing your link are free, with ${formatBytes(plan('Free').eventBytes!)} of photos for every event. A Party pass is ${mvr(plan('PartyPass').price)} and a Wedding pass ${mvr(plan('WeddingPass').price)}, once per event. Studio and Venue plans for professionals.`;
        },
        get jsonLd() {
          return [
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: pricingFaq().map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
            },
          ];
        },
      },
    },
    loadComponent: () => import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
  },
  { path: '**', redirectTo: '' },
];
