import { GUIDES } from './guides';
import { GUIDE_ROUTES } from './guide.routes';
import { serverRoutes } from '../../app.routes.server';
import { routes } from '../../app.routes';

describe('help centre routes', () => {
  it('every guide has its own route, a body to load, and its own search tags', () => {
    for (const g of GUIDES) {
      const route = GUIDE_ROUTES.find((r) => r.path === g.slug);
      expect(route, g.slug).toBeDefined();
      expect(typeof route!.loadComponent, g.slug).toBe('function');
      expect(route!.data?.['seo']?.title, g.slug).toBeTruthy();
      expect(route!.data?.['seo']?.description, g.slug).toBeTruthy();
    }
  });

  it('slugs are unique', () => {
    const slugs = GUIDES.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('every guide body actually loads', async () => {
    for (const g of GUIDES) {
      const route = GUIDE_ROUTES.find((r) => r.path === g.slug)!;
      const component = await (route.loadComponent as () => Promise<unknown>)();
      expect(component, g.slug).toBeTruthy();
    }
  });

  it('the overview has search tags', () => {
    expect(GUIDE_ROUTES.find((r) => r.path === '')?.data?.['seo']?.title).toBeTruthy();
  });

  it('each guide is prerendered', async () => {
    const entry = serverRoutes.find((r) => r.path === 'guide/:slug') as {
      getPrerenderParams?: () => Promise<{ slug: string }[]>;
    };
    expect(serverRoutes.some((r) => r.path === 'guide')).toBe(true);
    const params = await entry.getPrerenderParams!();
    expect(params.map((p) => p.slug)).toEqual(GUIDES.map((g) => g.slug));
  });

  it('the old template guide address redirects with a function, not a string', () => {
    const old = routes.find((r) => r.path === 'template-guide');
    expect(typeof old?.redirectTo).toBe('function');
  });
});
