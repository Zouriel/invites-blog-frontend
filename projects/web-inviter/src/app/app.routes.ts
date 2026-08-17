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
    // Where the OAuth popup lands. Deliberately NOT guarded — it has no session yet.
    path: 'designer/oauth-callback',
    loadComponent: () =>
      import('./pages/designer-login/oauth-callback.component').then(
        (m) => m.OAuthCallbackComponent,
      ),
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
    path: 'templates',
    loadComponent: () =>
      import('./pages/templates/templates.component').then((m) => m.TemplatesComponent),
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
    path: 'guide',
    loadComponent: () => import('./pages/guide/guide.component').then((m) => m.GuideComponent),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import('./pages/pricing/pricing.component').then((m) => m.PricingComponent),
  },
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
