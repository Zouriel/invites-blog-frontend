import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionStore } from './session.store';
import { TabRail } from './tab-rail';

@Component({ template: '' })
class Blank {}

/**
 * The order of the loop, and where it refuses to run.
 *
 * <p>Everything here is a URL: the rail reads one and writes one, and holds nothing of its own. That
 * is what makes it agree with the tab strips, the bottom bar and the Back button at once, and it is
 * the thing worth pinning down — a rail that remembers its own position drifts from the page the
 * moment somebody taps a tab instead of swiping to it.</p>
 */
describe('TabRail', () => {
  const isDesigner = signal(false);

  async function railAt(url: string): Promise<{ rail: TabRail; router: Router }> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'feed', component: Blank },
          { path: 'inbox', component: Blank },
          { path: 'my-templates', component: Blank },
          { path: 'me', component: Blank },
          { path: 'dashboard/:id', component: Blank },
          { path: '**', component: Blank },
        ]),
        {
          provide: SessionStore,
          useValue: { isSignedIn: signal(true), isDesigner, isAdmin: signal(false) },
        },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    return { rail: TestBed.inject(TabRail), router };
  }

  beforeEach(() => isDesigner.set(false));

  it('runs feed → inbox → templates → me, the bar\'s order', async () => {
    const { rail } = await railAt('/feed');
    expect(rail.stops().map((s) => `${s.path}:${s.tab}`)).toEqual([
      '/feed:feed',
      '/inbox:inbox',
      '/my-templates:browse',
      '/my-templates:requests',
      '/my-templates:drafts',
      '/me:me',
    ]);
  });

  it('gives a designer Studio (their published templates), right after Browse', async () => {
    isDesigner.set(true);
    const { rail } = await railAt('/my-templates');
    // Browse is everybody's and comes first on that screen; Studio follows it. The designer itself is
    // in the top bar, not a tab.
    expect(rail.stops()[2]).toEqual({ path: '/my-templates', tab: 'browse' });
    expect(rail.stops()[3]).toEqual({ path: '/my-templates', tab: 'designs' });
  });

  it('leaves the designer out for a customer', async () => {
    isDesigner.set(false);
    const { rail } = await railAt('/my-templates');
    const tabs = rail.stops().map((s) => s.tab);
    expect(tabs).not.toContain('designer');
    expect(tabs).not.toContain('designs');
  });

  it('reads the screen it is on, tab and all', async () => {
    expect((await railAt('/feed')).rail.at()).toBe(0);
    expect((await railAt('/my-templates?tab=requests')).rail.at()).toBe(3);
    expect((await railAt('/me')).rail.at()).toBe(5);
  });

  it('walks to the next tab of the same screen', async () => {
    const { rail, router } = await railAt('/my-templates');
    await rail.go(1);
    expect(router.url).toBe('/my-templates?tab=requests');
  });

  it('crosses from one screen to the next', async () => {
    const { rail, router } = await railAt('/inbox');
    await rail.go(1);
    expect(router.url).toBe('/my-templates');
  });

  it('spells a screen’s first tab as no tab at all', async () => {
    const { rail, router } = await railAt('/my-templates?tab=requests');
    await rail.go(-1);
    expect(router.url).toBe('/my-templates');
  });

  it('loops, in both directions', async () => {
    const last = await railAt('/me');
    await last.rail.go(1);
    expect(last.router.url).toBe('/feed');

    const first = await railAt('/feed');
    await first.rail.go(-1);
    expect(first.router.url).toBe('/me');
  });

  it('means nothing on a screen that is not on it', async () => {
    const { rail, router } = await railAt('/dashboard/abc');
    expect(rail.at()).toBe(-1);
    expect(rail.active()).toBe(false);
    expect(await rail.go(1)).toBe(false);
    expect(router.url).toBe('/dashboard/abc');
  });

  it('treats an unknown tab as its screen’s first', async () => {
    const { rail } = await railAt('/my-templates?tab=nonsense');
    expect(rail.at()).toBe(2);
  });
});
