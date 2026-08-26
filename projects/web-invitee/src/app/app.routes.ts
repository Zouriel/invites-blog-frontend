import { Routes } from '@angular/router';
import { inboxGuard } from './shared/guards/inbox.guard';
import { eventGuard } from './shared/guards/event.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login').then((m) => m.LoginComponent),
  },
  {
    path: 'verify',
    loadComponent: () => import('./pages/verify/verify').then((m) => m.VerifyComponent),
  },
  {
    path: 'inbox',
    canActivate: [inboxGuard],
    loadComponent: () => import('./pages/inbox/inbox').then((m) => m.InboxComponent),
  },
  {
    // Shared campaign link: email-OTP-gated, then shows the visitor's personalized invite.
    path: 'e/:campaignId',
    canActivate: [eventGuard],
    loadComponent: () =>
      import('./pages/event-invite/event-invite').then((m) => m.EventInviteComponent),
  },
  {
    path: 'invites/:inviteId/rsvp',
    loadComponent: () => import('./pages/rsvp/rsvp').then((m) => m.RsvpComponent),
  },
  {
    path: 'invites/:inviteId',
    loadComponent: () =>
      import('./pages/invite-detail/invite-detail').then((m) => m.InviteDetailComponent),
  },
  {
    path: 'privacy/remove/:token',
    loadComponent: () =>
      import('./pages/privacy-remove/privacy-remove').then((m) => m.PrivacyRemoveComponent),
  },
  { path: '**', redirectTo: '' },
];
