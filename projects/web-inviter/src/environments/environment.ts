export const environment = {
  production: false,
  apiBase: 'http://localhost:8080',
  assetsBase: 'http://localhost:8080/assets',
  inviteeBase: 'http://localhost:4201',
  /**
   * The public site (landing, plans, policies, guest QR pages) and the signed-in web app, when they are
   * two hosts (production since 2026-11-13: invites.blog and app.invites.blog). Empty = one host serves
   * everything (staging, local development) and nothing is redirected between hosts.
   */
  siteOrigin: '',
  appOrigin: '',
  /** The currency cards are charged in: MVR. (Staging's BML test account takes only dollars.) */
  chargeCurrency: 'MVR' as 'MVR' | 'USD',
};
