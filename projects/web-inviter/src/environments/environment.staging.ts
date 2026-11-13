// Staging (staging.invites.blog): the production build pointed at the staging guest site. Same-origin
// API and assets, as in production.
export const environment = {
  production: true,
  apiBase: '',
  assetsBase: '/assets',
  inviteeBase: 'https://mestaging.invites.blog',
  /**
   * The public site (landing, plans, policies, guest QR pages) and the signed-in web app, when they are
   * two hosts (production since 2026-11-13: invites.blog and app.invites.blog). Empty = one host serves
   * everything (staging, local development) and nothing is redirected between hosts.
   */
  siteOrigin: '',
  appOrigin: '',
  /** The currency cards are charged in: MVR. (Staging's BML test account takes only dollars.) */
  chargeCurrency: 'USD' as 'MVR' | 'USD',
};
