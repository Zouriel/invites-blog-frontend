import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { SessionStore } from './session.store';

/**
 * The tabs of each screen in the bar, in the order they are read.
 *
 * <p>They live HERE rather than in the three pages that draw them, and the pages import them back.
 * The rail has to know every stop to walk between them, and a second copy of these names would be a
 * copy that eventually disagrees — a renamed tab that the swipe still navigates to, and a page that
 * lands on its default because the name it was handed no longer means anything.</p>
 *
 * <p>The FIRST name of each set is that screen's default, and by convention it is left out of the
 * URL: `/inbox` and `/inbox?tab=received` are the same place, and only the shorter one is ever
 * written.</p>
 */
export const INBOX_TABS = ['received', 'mine', 'cancelled'] as const;
export const TEMPLATE_TABS = ['designs', 'requests', 'drafts'] as const;
export const ACCOUNT_TABS = ['profile', 'sign-in', 'creator'] as const;

export type InboxTab = (typeof INBOX_TABS)[number];
export type TemplateTab = (typeof TEMPLATE_TABS)[number];
export type AccountTab = (typeof ACCOUNT_TABS)[number];

/** One place the rail can stop: a route, and which of its tabs is open there. */
export interface RailStop {
  readonly path: string;
  readonly tab: string;
}

/**
 * Every tabbed screen in the bottom bar, laid end to end as one loop.
 *
 * <p>The bar has four destinations and each of them has tabs, which on a phone means the tabs are
 * reached by aiming at a strip of small targets at the top of the screen after aiming at a small
 * target at the bottom. Laid out flat they are just a sequence — received, hosting, cancelled, then
 * templates' tabs, then the account's — and a sequence can be swiped through the way every phone
 * gallery and every set of home screens is. It wraps, so there is no dead end in either direction
 * and no need to know which way is shorter.</p>
 *
 * <p><b>What is deliberately NOT on it:</b> "New", because it is a flow rather than a place and a
 * stray finger would carry someone out of a half-typed form; and "Sign out", because it is an action
 * — you cannot be swiped out of your account by accident, and it would end the loop by emptying it.
 * Both stay one tap away in the bar, which is where they belong.</p>
 *
 * <p>Membership is what arms the gesture: on a dashboard, an editor or the create flow the current
 * URL is not on the rail, {@link at} is -1, and a swipe means nothing. So this is only ever a faster
 * way between screens somebody was already going to reach — never a way to leave one unexpectedly.</p>
 */
@Injectable({ providedIn: 'root' })
export class TabRail {
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);

  /** "My designs" belongs to people who have designs; everyone else's templates start at requests. */
  private readonly templateTabs = computed<readonly string[]>(() =>
    this.session.isDesigner() ? TEMPLATE_TABS : TEMPLATE_TABS.filter((t) => t !== 'designs'),
  );

  readonly stops = computed<RailStop[]>(() => [
    ...INBOX_TABS.map((tab) => ({ path: '/inbox', tab })),
    ...this.templateTabs().map((tab) => ({ path: '/my-templates', tab })),
    ...ACCOUNT_TABS.map((tab) => ({ path: '/me', tab })),
  ]);

  /**
   * Read from the URL rather than remembered, so a tab reached by tapping it, by a shared link or by
   * the Back button all leave the rail pointing at the same place the reader is actually on.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** Where on the rail the reader is standing, or -1 if this screen isn't on it. */
  readonly at = computed(() => {
    const tree = this.router.parseUrl(this.url());
    const path = '/' + (tree.root.children['primary']?.segments.map((s) => s.path).join('/') ?? '');
    const stops = this.stops();
    const first = stops.find((s) => s.path === path);
    if (!first) return -1;
    // No tab in the URL means the screen's default, which is the first stop belonging to it.
    const tab = tree.queryParamMap.get('tab') ?? first.tab;
    const found = stops.findIndex((s) => s.path === path && s.tab === tab);
    return found >= 0 ? found : stops.indexOf(first);
  });

  /** Whether a swipe here means anything at all. */
  readonly active = computed(() => this.session.isSignedIn() && this.at() >= 0);

  /**
   * The next stop along, wrapping past either end. Does nothing off the rail.
   *
   * @returns whether it moved, once the navigation has finished.
   */
  go(step: 1 | -1): Promise<boolean> {
    const from = this.at();
    if (from < 0) return Promise.resolve(false);
    const stops = this.stops();
    const to = stops[(from + step + stops.length) % stops.length];
    return this.router.navigate([to.path], {
      // The default tab is spelt as its absence, matching what every one of these pages writes when
      // you tap the tab itself — otherwise the same screen would have two URLs depending on how you
      // arrived, and Back would step through both.
      queryParams: { tab: to.tab === this.first(to.path) ? null : to.tab },
      // A swipe is not a place in history. Walking back through nine of them to leave the app is
      // exactly the trap the browser Back button becomes when a gesture writes to it.
      replaceUrl: true,
    });
  }

  private first(path: string): string {
    return this.stops().find((s) => s.path === path)?.tab ?? '';
  }
}
