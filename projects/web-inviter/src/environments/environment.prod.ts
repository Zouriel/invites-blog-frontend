// Production: the app is served behind Caddy which proxies /api/* and /assets/* to the API on the
// same origin, so all API/asset URLs are relative (no CORS, works on any host it's served from).
export const environment = {
  production: true,
  apiBase: '',
  assetsBase: '/assets',
  inviteeBase: 'https://me.invites.blog',
};
