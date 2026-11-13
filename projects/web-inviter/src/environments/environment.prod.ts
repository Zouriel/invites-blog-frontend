// Production: the app is served behind Caddy which proxies /api/* and /assets/* to the API on the
// same origin, so all API/asset URLs are relative (no CORS, works on any host it's served from).
export const environment = {
  production: true,
  apiBase: '',
  assetsBase: '/assets',
  inviteeBase: 'https://me.invites.blog',
  /**
   * The public site (landing, plans, policies, guest QR pages) and the signed-in web app, when they are
   * two hosts (production since 2026-11-13: invites.blog and app.invites.blog). Empty = one host serves
   * everything (staging, local development) and nothing is redirected between hosts.
   */
  siteOrigin: 'https://invites.blog',
  appOrigin: 'https://app.invites.blog',
  /** The currency cards are charged in: MVR. (Staging's BML test account takes only dollars.) */
  chargeCurrency: 'MVR' as 'MVR' | 'USD',
};
