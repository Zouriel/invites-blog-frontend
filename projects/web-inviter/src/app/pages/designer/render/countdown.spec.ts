import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bind, compile, normalizeScene, type RenderCatalog } from './index';
import { TEMPLATE_RUNTIME } from './scripts';

/**
 * The countdown on a guest's page: the compiled element carries no date, the binder hides it when the
 * event has no start, and the platform runtime (generated from TemplateRuntime.cs) counts it down from
 * `event.startsAt` on the event's own clock. The runtime is run here as the page runs it, against a fixed
 * clock.
 */
const FIXTURES = 'projects/web-inviter/src/app/pages/designer/render/testing/parity-fixtures.json.gz';
const fixtures = JSON.parse(gunzipSync(readFileSync(existsSync(FIXTURES) ? FIXTURES : FIXTURES.replace(/^projects\/web-inviter\//, ''))).toString('utf8'));
const catalog: RenderCatalog = fixtures.catalog;

/* eslint-disable @typescript-eslint/no-explicit-any */
function page(countdown: any): string {
  const scene: any = structuredClone(fixtures.cases.find((c: any) => c.published && c.name.includes('blank')).scene);
  scene.elements = [{ id: 'cd', type: 'countdown', x: 30, y: 100, w: 330, h: 96, countdown }];
  return compile(normalizeScene(scene), catalog, { fontBaseUrl: '/assets/fonts/' });
}

// 6:30 PM on Saturday 28 August 2027 in the Maldives (UTC+5).
const START = '2027-08-28T13:30:00Z';

/** Binds the page, puts its body in this document and runs the platform's runtime at `now`. */
function run(countdown: any, now: string, event: any = { startsAt: START, timeZone: 'Indian/Maldives' }): HTMLElement {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const doc = new DOMParser().parseFromString(bind(page(countdown), { event }), 'text/html');
  document.body.innerHTML = doc.body.innerHTML;
  for (const s of Array.from(document.body.querySelectorAll('script'))) if (!s.id) s.remove();
  new Function(TEMPLATE_RUNTIME)();
  return document.querySelector('[data-countdown]') as HTMLElement;
}

const shown = (el: HTMLElement) => Array.from(el.querySelectorAll('[data-u]')).map((u) => u.textContent).join(' ');

describe('countdown', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('counts the exact time left, down to seconds, and keeps counting', () => {
    const el = run({}, '2027-08-26T12:29:58Z'); // 2 days, 1 hour, 0 minutes and 2 seconds before
    expect(shown(el)).toBe('2days 01hour 00minutes 02seconds');
    vi.advanceTimersByTime(1000);
    expect(shown(el)).toBe('2days 01hour 00minutes 01second');
    vi.advanceTimersByTime(2000);
    expect(shown(el)).toBe('2days 00hours 59minutes 59seconds');
    expect(el.hasAttribute('data-done')).toBe(false);
  });

  it('counts calendar days on the event\'s clock when it shows days only', () => {
    // 11 PM on the Friday in the Maldives: tomorrow is the day, though 19.5 hours remain.
    expect(shown(run({ units: 'days' }, '2027-08-27T18:00:00Z'))).toBe('1day');
    vi.useRealTimers();
    // 1 AM on the Friday there, still Thursday in UTC: already the day before.
    expect(shown(run({ units: 'days' }, '2027-08-26T20:00:00Z'))).toBe('1day');
    vi.useRealTimers();
    // 11 PM on the Thursday there.
    expect(shown(run({ units: 'days' }, '2027-08-26T18:00:00Z'))).toBe('2days');
  });

  it('says its words on the day and hides the day after', () => {
    const morning = run({ units: 'days', done: 'See you tonight' }, '2027-08-28T03:00:00Z');
    expect(morning.hasAttribute('data-done')).toBe(true);
    expect(morning.querySelector('.cx')!.textContent).toBe('See you tonight');
    vi.useRealTimers();

    // Seconds: done once the start has passed, not before.
    const before = run({}, '2027-08-28T13:29:59Z');
    expect(before.hasAttribute('data-done')).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(before.hasAttribute('data-done')).toBe(true);
    vi.useRealTimers();

    const after = run({}, '2027-08-29T00:00:00Z'); // 5 AM the next day in the Maldives
    expect(after.style.display).toBe('none');
  });

  it('with nothing to say on the day, keeps its place but shows nothing', () => {
    const el = run({ done: '' }, '2027-08-28T14:00:00Z');
    expect(el.hasAttribute('data-done')).toBe(true);
    expect(el.style.visibility).toBe('hidden');
  });

  it('hides when the event has no start', () => {
    const doc = new DOMParser().parseFromString(bind(page({}), { event: {} }), 'text/html');
    expect((doc.querySelector('[data-countdown]') as HTMLElement).style.display).toBe('none');
    const withStart = new DOMParser().parseFromString(bind(page({}), { event: { startsAt: START } }), 'text/html');
    // Shown all the way up: neither it nor the element box around it is hidden.
    for (let n: Element | null = withStart.querySelector('[data-countdown]'); n && n !== withStart.body; n = n.parentElement)
      expect((n as HTMLElement).style.display, n.className).toBe('');
  });
});
