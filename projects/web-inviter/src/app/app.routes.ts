import { Routes } from '@angular/router';

export const routes: Routes = [
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
    path: 'create/:campaignId/payment',
    loadComponent: () =>
      import('./pages/payment/payment.component').then((m) => m.PaymentComponent),
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
