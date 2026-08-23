import { Routes } from '@angular/router';
import { roleGuard, signedInGuard } from './shared/guards/session.guard';

export const routes: Routes = [
  { path: 'admin', pathMatch: 'full', redirectTo: 'admin/templates' },
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
  {
    path: 'my-templates',
    canActivate: [roleGuard('Designer', 'Admin')],
    loadComponent: () =>
      import('./pages/my-templates/my-templates.component').then((m) => m.MyTemplatesComponent),
  },
  {
    path: 'admin/templates',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-templates/admin-templates.component').then(
        (m) => m.AdminTemplatesComponent,
      ),
  },
  {
    path: 'admin/upload',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-upload/admin-upload.component').then((m) => m.AdminUploadComponent),
  },
  {
    path: 'admin/designers',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-designers/admin-designers.component').then(
        (m) => m.AdminDesignersComponent,
      ),
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
    path: 'admin/template-submissions',
    canActivate: [roleGuard('Admin')],
    loadComponent: () =>
      import('./pages/admin-template-review/admin-template-review.component').then(
        (m) => m.AdminTemplateReviewComponent,
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
    path: 'signup',
    loadComponent: () => import('./pages/signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    // A designer's own view of the request queue — the counterpart to the admin's Inquiries page.
    // Must be declared BEFORE 'designer' so the more specific path wins.
    path: 'designer/requests',
    canActivate: [roleGuard('Designer', 'Admin')],
    loadComponent: () =>
      import('./pages/designer-requests/designer-requests.component').then(
        (m) => m.DesignerRequestsComponent,
      ),
  },
  {
    path: 'designer',
    canActivate: [roleGuard('Designer', 'Admin')],
    loadComponent: () =>
      import('./pages/designer-dashboard/designer-dashboard.component').then(
        (m) => m.DesignerDashboardComponent,
      ),
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
    path: 'inquire',
    loadComponent: () =>
      import('./pages/inquire/inquire.component').then((m) => m.InquireComponent),
  },
  {
    path: '',
    loadComponent: () =>
      import('./pages/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'request-template',
    loadComponent: () =>
      import('./pages/request-template/request-template.component').then(
        (m) => m.RequestTemplateComponent,
      ),
  },
  {
    path: 'templates/:slug',
    loadComponent: () =>
      import('./pages/template-detail/template-detail.component').then(
        (m) => m.TemplateDetailComponent,
      ),
  },
  {
    path: 'create/:campaignId/editor',
    loadComponent: () =>
      import('./pages/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'create/:campaignId/theming',
    loadComponent: () =>
      import('./pages/theming/theming.component').then((m) => m.ThemingComponent),
  },
  {
    path: 'create/:campaignId/roles',
    loadComponent: () =>
      import('./pages/roles/roles.component').then((m) => m.RolesComponent),
  },
  {
    path: 'create/:campaignId/guests',
    loadComponent: () =>
      import('./pages/guests/guests.component').then((m) => m.GuestsComponent),
  },
  {
    path: 'create/:campaignId/guests/review',
    loadComponent: () =>
      import('./pages/guests-review/guests-review.component').then(
        (m) => m.GuestsReviewComponent,
      ),
  },
  {
    path: 'create/:campaignId/venue',
    loadComponent: () => import('./pages/venue/venue.component').then((m) => m.VenueComponent),
  },
  {
    path: 'create/:campaignId/rsvp',
    loadComponent: () =>
      import('./pages/rsvp-questions/rsvp-questions.component').then(
        (m) => m.RsvpQuestionsComponent,
      ),
  },
  {
    path: 'create/:campaignId/inviter',
    loadComponent: () =>
      import('./pages/inviter/inviter.component').then((m) => m.InviterComponent),
  },
  {
    path: 'create/:campaignId/delivery',
    loadComponent: () =>
      import('./pages/delivery/delivery.component').then((m) => m.DeliveryComponent),
  },
  {
    path: 'create/:campaignId/success',
    loadComponent: () =>
      import('./pages/success/success.component').then((m) => m.SuccessComponent),
  },
  {
    path: 'dashboard/:campaignId',
    loadComponent: () =>
      import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    // How to author a template. Public and unguarded on purpose: a prospective designer (human or
    // an AI helping them write a template) needs to read this before they have any account at all,
    // and it has nothing sensitive in it — it's the same reference as TEMPLATE-GUIDE.md in the repo.
    path: 'template-guide',
    loadComponent: () =>
      import('./pages/template-guide/template-guide.component').then((m) => m.TemplateGuideComponent),
  },
  {
    path: 'guide',
    loadComponent: () => import('./pages/guide/guide.component').then((m) => m.GuideComponent),
  },
  // Parked until the customer side is ready. The page is still in ./pages/pricing — put this back
  // rather than writing it again.
  // {
  //   path: 'pricing',
  //   loadComponent: () =>
  //     import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
  // },
  {
    path: 'privacy',
    loadComponent: () =>
      import('./pages/privacy/privacy.component').then((m) => m.PrivacyComponent),
  },
  {
    path: 'terms',
    loadComponent: () => import('./pages/terms/terms.component').then((m) => m.TermsComponent),
  },
  { path: '**', redirectTo: '' },
];
