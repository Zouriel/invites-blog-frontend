import { PrerenderFallback, RenderMode, ServerRoute } from '@angular/ssr';
import { OCCASIONS } from './shared/utils/constants/occasions';
import { PRERENDER_API_ORIGIN } from './shared/prerender/server-api-origin';

/**
 * Which pages are written out as HTML at build time. Only the public ones: search engines and chat
 * previews read these without running any JavaScript. Everything behind a sign-in stays a
 * client-rendered page, served from index.csr.html.
 */
const prerendered = (path: string): ServerRoute => ({ path, renderMode: RenderMode.Prerender });

export const serverRoutes: ServerRoute[] = [
  prerendered(''),
  prerendered('templates'),
  {
    path: 'templates/:slug',
    renderMode: RenderMode.Prerender,
    // A design published after this build still opens; it is rendered in the browser instead.
    fallback: PrerenderFallback.Client,
    async getPrerenderParams() {
      try {
        const res = await fetch(`${PRERENDER_API_ORIGIN}/api/templates?pageSize=200`);
        const items: { slug: string; isShowcase?: boolean }[] = (await res.json())?.data?.items ?? [];
        return items.filter((t) => !t.isShowcase).map((t) => ({ slug: t.slug }));
      } catch {
        return [];
      }
    },
  },
  {
    path: 'invitations/:occasion',
    renderMode: RenderMode.Prerender,
    fallback: PrerenderFallback.Client,
    getPrerenderParams: async () => OCCASIONS.map((o) => ({ occasion: o.slug })),
  },
  prerendered('guide'),
  prerendered('bring-your-own'),
  prerendered('inquire'),
  prerendered('template-guide'),
  prerendered('privacy'),
  prerendered('terms'),
  { path: '**', renderMode: RenderMode.Client },
];
