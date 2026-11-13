import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiGuidance } from '@zouriel/ui/guidance';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '../../../environments/environment';
import { SessionStore } from '../services/session.store';
import { GuidanceService, GuidanceStoreAdapter } from './guidance.service';
import { GuidanceState, NO_PROGRESS } from './guidance.types';

const API = environment.apiBase;

// The test browser has no storage; the device copy needs one.
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });
const flush = () => new Promise((r) => setTimeout(r, 0));

function state(over: Partial<GuidanceState> = {}): GuidanceState {
  return { tipsOn: true, seen: [], welcomeUntil: new Date(Date.now() + 86400000).toISOString(), progress: { ...NO_PROGRESS }, newRoles: [], ...over };
}

/** The session: a signed-in account (or none), switchable. */
function session(id: string | null) {
  const account = signal<{ id: string } | null>(id ? { id } : null);
  return { account, isSignedIn: computed(() => !!account()) };
}

describe('GuidanceService (the account store, offline queue)', () => {
  let http: HttpTestingController;
  let sess: ReturnType<typeof session>;

  async function setup(id: string | null) {
    sess = session(id);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UiToastService, useValue: { danger: vi.fn(), success: vi.fn(), info: vi.fn() } },
        { provide: SessionStore, useValue: sess },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const g = TestBed.inject(GuidanceService);
    TestBed.tick(); // the account effect
    await flush();
    return g;
  }

  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
  });

  it('loads the account state from the server and keeps a copy on the device', async () => {
    const g = await setup('acc-1');
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ seen: ['offer.welcome'], tipsOn: true }) });
    await flush();
    expect(g.loaded()).toBe(true);
    expect(g.isSeen('offer.welcome')).toBe(true);
    expect(g.inWelcome()).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('ib.guidance.acc-1')!).state.seen).toEqual(['offer.welcome']);
  });

  it('queues a seen id while offline and sends it once back online, merged with what the server has', async () => {
    const g = await setup('acc-1');
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state() });
    await flush();

    g.markSeen(['tip.me.settings']);
    // The write fails (offline): the id stays seen here and stays queued, on the device.
    http.expectOne(`${API}/api/me/guidance/seen`).error(new ProgressEvent('offline'), { status: 0 });
    await flush();
    expect(g.isSeen('tip.me.settings')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('ib.guidance.acc-1')!).queue).toEqual(['tip.me.settings']);

    // Back online: the queue goes first, then the state is read again, the queued id kept.
    const refreshing = g.refresh();
    const send = http.expectOne(`${API}/api/me/guidance/seen`);
    expect(send.request.body).toEqual({ ids: ['tip.me.settings'] });
    send.flush(null, { status: 204, statusText: 'No Content' });
    await flush();
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ seen: ['offer.host', 'tip.me.settings'] }) });
    await refreshing;
    expect(g.isSeen('offer.host')).toBe(true);
    expect(g.isSeen('tip.me.settings')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('ib.guidance.acc-1')!).queue).toEqual([]);
  });

  it('keeps a queued id across a reload (a new service reads the device copy and sends it)', async () => {
    window.localStorage.setItem('ib.guidance.acc-1', JSON.stringify({ state: state({ seen: ['tip.album.qr'] }), queue: ['tip.album.qr'] }));
    const g = await setup('acc-1');
    expect(g.isSeen('tip.album.qr')).toBe(true);
    http.expectOne(`${API}/api/me/guidance/seen`).flush(null, { status: 204, statusText: 'No Content' });
    await flush();
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ seen: ['tip.album.qr'] }) });
    await flush();
    expect(g.isSeen('tip.album.qr')).toBe(true);
    expect(JSON.parse(window.localStorage.getItem('ib.guidance.acc-1')!).queue).toEqual([]);
  });

  it('signed out, everything stays on the device and nothing is sent', async () => {
    const g = await setup(null);
    await flush();
    g.markSeen(['offer.demo']);
    await g.setTipsOn(false);
    http.expectNone(() => true);
    expect(g.isSeen('offer.demo')).toBe(true);
    expect(g.tipsOn()).toBe(false);
    expect(JSON.parse(window.localStorage.getItem('ib.guidance.guest')!).state.tipsOn).toBe(false);
  });

  it('"Show tips again" clears what was seen and turns tips on, on the server too', async () => {
    const g = await setup('acc-1');
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ seen: ['offer.welcome'], tipsOn: false }) });
    await flush();
    const resetting = g.reset();
    http.expectOne(`${API}/api/me/guidance/reset`).flush(null, { status: 204, statusText: 'No Content' });
    await flush();
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state() });
    await resetting;
    expect(g.isSeen('offer.welcome')).toBe(false);
    expect(g.tipsOn()).toBe(true);
  });

  it('answering a role card acknowledges it on the server and hides it everywhere', async () => {
    const g = await setup('acc-1');
    const role = { campaignId: 'e1', title: 'Wedding', coverUrl: null, access: 'look' as const, addedBy: 'Mariyam', addedAt: '2026-11-01T00:00:00Z' };
    http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ newRoles: [role] }) });
    await flush();
    expect(g.newRoles().length).toBe(1);
    g.ackRole('e1');
    expect(g.newRoles().length).toBe(0);
    expect(g.isSeen('offer.role.e1')).toBe(true);
    http.expectOne(`${API}/api/me/roles/e1/ack`).flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(`${API}/api/me/guidance/seen`).flush(null, { status: 204, statusText: 'No Content' });
  });

  describe('through the library controller', () => {
    it('a seen tip never shows again, and a shown one is seen for good', async () => {
      const g = await setup('acc-1');
      http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ seen: ['tip.inbox.new'] }) });
      await flush();
      const ui = new UiGuidance(new GuidanceStoreAdapter(g));
      const show = vi.fn(async () => 'closed' as const);

      expect(await ui.requestTip('tip.inbox.new', show)).toBeNull();
      expect(show).not.toHaveBeenCalled();

      expect(await ui.requestTip('tip.me.settings', show)).toBe('closed');
      expect(show).toHaveBeenCalledTimes(1);
      http.match(`${API}/api/me/guidance/seen`).forEach((r) => r.flush(null, { status: 204, statusText: 'No Content' }));
      // A fresh controller (a reload) still refuses it: the account remembers.
      const again = new UiGuidance(new GuidanceStoreAdapter(g));
      expect(await again.requestTip('tip.me.settings', show)).toBeNull();
      expect(show).toHaveBeenCalledTimes(1);
    });

    it('tips off: nothing shows, offers and tours included', async () => {
      const g = await setup('acc-1');
      http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state({ tipsOn: false }) });
      await flush();
      const ui = new UiGuidance(new GuidanceStoreAdapter(g));
      const show = vi.fn(async () => 'finished' as const);
      expect(await ui.requestTip('offer.welcome', show, { kind: 'offer' })).toBeNull();
      expect(await ui.requestTip('tour.host', show, { kind: 'tour' })).toBeNull();
      expect(await ui.requestTip('tip.feed.templates', show)).toBeNull();
      expect(show).not.toHaveBeenCalled();
    });

    it('"Turn off tips" in a tour turns them off on the account', async () => {
      const g = await setup('acc-1');
      http.expectOne(`${API}/api/me/guidance`).flush({ success: true, data: state() });
      await flush();
      const ui = new UiGuidance(new GuidanceStoreAdapter(g));
      await ui.requestTip('tour.welcome', async () => 'turnedOff', { kind: 'tour' });
      await flush();
      // Whichever write went first, the other follows once it is answered.
      http.match(`${API}/api/me/guidance/seen`).forEach((r) => r.flush(null, { status: 204, statusText: 'No Content' }));
      await flush();
      expect(g.tipsOn()).toBe(false);
      const put = http.match(`${API}/api/me/guidance`).find((r) => r.request.method === 'PUT');
      expect(put?.request.body).toEqual({ tipsOn: false });
    });
  });
});
