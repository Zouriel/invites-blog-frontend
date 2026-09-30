// Staging (staging.invites.blog): the production build pointed at the staging guest site. Same-origin
// API and assets, as in production.
export const environment = {
  production: true,
  apiBase: '',
  assetsBase: '/assets',
  inviteeBase: 'https://mestaging.invites.blog',
  /** The currency cards are charged in: MVR. (Staging's BML test account takes only dollars.) */
  chargeCurrency: 'USD' as 'MVR' | 'USD',
};
