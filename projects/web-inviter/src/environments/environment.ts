export const environment = {
  production: false,
  apiBase: 'http://localhost:8080',
  assetsBase: 'http://localhost:8080/assets',
  inviteeBase: 'http://localhost:4201',
  /** The currency cards are charged in: MVR. (Staging's BML test account takes only dollars.) */
  chargeCurrency: 'MVR' as 'MVR' | 'USD',
};
