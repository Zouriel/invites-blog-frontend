// Production: served behind Caddy which proxies /api/* and /assets/* to the API on the same origin,
// so API/asset URLs are relative (no CORS).
export const environment = {
  production: true,
  apiBase: '',
  assetsBase: '/assets',
};
