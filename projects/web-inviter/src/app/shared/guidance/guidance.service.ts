import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { UiGuidanceStore } from '@zouriel/ui/guidance';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { GuidanceNewRole, GuidanceProgress, GuidanceState, NO_PROGRESS } from './guidance.types';

/** At most this many ids in one POST /api/me/guidance/seen (the server refuses more). */
const SEEN_BATCH = 50;
/** How long a tip waits for the account's state before deciding from the device's copy. */
const READY_WAIT_MS = 4000;
/** Returning to the tab re-reads the state at most this often. */
const REFRESH_GAP_MS = 60_000;

const KEY_PREFIX = 'ib.guidance.';
const DAY_KEY = 'ib.guidance.day';

/** What the device keeps per account: the last state seen, and the writes still to send. */
type Cached = {
  state: GuidanceState;
  /** Seen ids not yet accepted by the server. */
  queue: string[];
  /** A switch flip not yet accepted by the server. */
  tipsOnPending?: boolean | null;
  /** A "Show tips again" not yet accepted by the server. */
  resetPending?: boolean;
};

function emptyState(): GuidanceState {
  return { tipsOn: true, seen: [], welcomeUntil: null, progress: { ...NO_PROGRESS }, newRoles: [] };
}

/**
 * The account's guidance state (docs/GUIDANCE.md): what it has seen, whether tips are on, its
 * progress and new celebrant roles. Lives on the account (/api/me/guidance) so web and phone agree;
 * the browser keeps a copy for offline use and queues "seen" until the server has it. Signed out,
 * the browser's copy is all there is.
 *
 * Pages read the signals here (checklist, role cards); the library's UiGuidance reads and writes
 * through {@link GuidanceStoreAdapter}.
 */
@Injectable({ providedIn: 'root' })
export class GuidanceService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly doc = inject(DOCUMENT);

  private readonly cache = signal<Cached>({ state: emptyState(), queue: [] });
  /** True once the server has answered for the account signed in now (or there is none). */
  readonly loaded = signal(false);

  readonly tipsOn = computed(() => this.cache().state.tipsOn);
  readonly progress = computed<GuidanceProgress>(() => this.cache().state.progress ?? NO_PROGRESS);
  readonly seenIds = computed(() => new Set(this.cache().state.seen));
  /** Celebrant roles not yet answered, less the ones whose card was closed on this device. */
  readonly newRoles = computed<GuidanceNewRole[]>(() =>
    (this.cache().state.newRoles ?? []).filter((r) => !this.seenIds().has(roleOfferId(r.campaignId))),
  );
  /** Inside the first 30 days of the account: welcome tips, the checklist and the welcome tour. */
  readonly inWelcome = computed(() => {
    const until = this.cache().state.welcomeUntil;
    return !!until && Date.parse(until) > Date.now();
  });

  private accountKey: string | null = null;
  private loadWaiters: (() => void)[] = [];
  private lastRefresh = 0;
  private flushing = false;
  private flushAgain = false;

  constructor() {
    // A different account (or none) means a different state: read the device's copy at once, then
    // the server's.
    effect(() => {
      const id = this.session.account()?.id ?? null;
      const signedIn = this.session.isSignedIn();
      untracked(() => this.switchTo(signedIn && id ? id : null));
    });
    const win = this.doc.defaultView;
    if (win) {
      // Back to the tab: the phone may have changed things (a tip seen there, an event started).
      this.doc.addEventListener('visibilitychange', () => {
        if (this.doc.visibilityState === 'visible' && Date.now() - this.lastRefresh > REFRESH_GAP_MS) void this.refresh();
      });
      win.addEventListener('online', () => void this.refresh());
    }
  }

  isSeen(id: string): boolean {
    return this.seenIds().has(id);
  }

  /** Resolves once the account's state has loaded, or after a short wait (then the device's copy decides). */
  ready(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      this.loadWaiters.push(done);
      setTimeout(done, READY_WAIT_MS);
    });
  }

  /** Re-reads the account's state and sends anything queued. Signed out it does nothing. */
  async refresh(): Promise<void> {
    if (!this.accountKey || this.accountKey === 'guest') {
      this.markLoaded();
      return;
    }
    const key = this.accountKey;
    this.lastRefresh = Date.now();
    await this.flush();
    try {
      const server = await firstValueFrom(this.api.guidance());
      if (this.accountKey !== key || !server) return;
      const c = this.cache();
      // What the server has, plus what this device has seen but not sent yet.
      const seen = Array.from(new Set([...(server.seen ?? []), ...c.queue]));
      const tipsOn = c.tipsOnPending ?? server.tipsOn;
      this.write({ ...c, state: { ...server, seen, tipsOn, progress: server.progress ?? NO_PROGRESS, newRoles: server.newRoles ?? [] } });
    } catch {
      // Offline or the server is busy: the device's copy stands.
    } finally {
      if (this.accountKey === key) this.markLoaded();
    }
  }

  markSeen(ids: readonly string[]): void {
    const fresh = ids.filter((id) => !this.seenIds().has(id));
    if (!fresh.length) return;
    const c = this.cache();
    const signedIn = this.accountKey && this.accountKey !== 'guest';
    this.write({
      ...c,
      state: { ...c.state, seen: [...c.state.seen, ...fresh] },
      queue: signedIn ? [...c.queue, ...fresh] : c.queue,
    });
    if (signedIn) void this.flush();
  }

  async setTipsOn(on: boolean): Promise<void> {
    const c = this.cache();
    const signedIn = this.accountKey && this.accountKey !== 'guest';
    this.write({ ...c, state: { ...c.state, tipsOn: on }, tipsOnPending: signedIn ? on : null });
    if (signedIn) await this.flush();
  }

  async reset(): Promise<void> {
    const c = this.cache();
    const signedIn = this.accountKey && this.accountKey !== 'guest';
    this.write({ state: { ...c.state, seen: [], tipsOn: true }, queue: [], tipsOnPending: null, resetPending: !!signedIn });
    if (signedIn) {
      await this.flush();
      await this.refresh();
    }
  }

  /** The celebrant card was answered (opened, or closed): it stops showing everywhere. */
  ackRole(campaignId: string): void {
    this.markSeen([roleOfferId(campaignId)]);
    const c = this.cache();
    this.write({ ...c, state: { ...c.state, newRoles: c.state.newRoles.filter((r) => r.campaignId !== campaignId) } });
    if (this.accountKey && this.accountKey !== 'guest') this.api.ackRole(campaignId).subscribe({ error: () => {} });
  }

  /** The role as the account's state knew it (who added them, what access), for the dashboard's card. */
  roleFor(campaignId: string): GuidanceNewRole | null {
    return (this.cache().state.newRoles ?? []).find((r) => r.campaignId === campaignId) ?? null;
  }

  // ---------- one-off tips per day (this device) ----------

  readDayCount(day: string): number {
    try {
      const raw = JSON.parse(this.doc.defaultView?.localStorage.getItem(DAY_KEY) ?? 'null') as { day: string; n: number } | null;
      return raw?.day === day ? raw.n : 0;
    } catch {
      return 0;
    }
  }

  writeDayCount(day: string, n: number): void {
    try {
      this.doc.defaultView?.localStorage.setItem(DAY_KEY, JSON.stringify({ day, n }));
    } catch {
      /* not remembering the count only means a reload starts the day again */
    }
  }

  // ---------- internals ----------

  /** Sends what is queued, in order: a reset first (it clears), then the switch, then seen ids. */
  private async flush(): Promise<void> {
    if (!this.accountKey || this.accountKey === 'guest') return;
    // One sender at a time; a write that arrives meanwhile is sent when it finishes.
    if (this.flushing) {
      this.flushAgain = true;
      return;
    }
    const key = this.accountKey;
    this.flushing = true;
    this.flushAgain = false;
    let failed = false;
    try {
      if (this.cache().resetPending) {
        await firstValueFrom(this.api.resetGuidance());
        if (this.accountKey !== key) return;
        this.write({ ...this.cache(), resetPending: false });
      }
      const pendingOn = this.cache().tipsOnPending;
      if (pendingOn !== null && pendingOn !== undefined) {
        await firstValueFrom(this.api.setTipsOn(pendingOn));
        if (this.accountKey !== key) return;
        if (this.cache().tipsOnPending === pendingOn) this.write({ ...this.cache(), tipsOnPending: null });
      }
      while (this.cache().queue.length && this.accountKey === key) {
        const batch = this.cache().queue.slice(0, SEEN_BATCH);
        await firstValueFrom(this.api.markGuidanceSeen(batch));
        if (this.accountKey !== key) return;
        const sent = new Set(batch);
        this.write({ ...this.cache(), queue: this.cache().queue.filter((id) => !sent.has(id)) });
      }
    } catch {
      // Kept for the next try: coming back online, returning to the tab, or the next seen tip.
      failed = true;
    } finally {
      this.flushing = false;
    }
    if (this.flushAgain && !failed) await this.flush();
  }

  private switchTo(accountId: string | null): void {
    const key = accountId ?? 'guest';
    if (key === this.accountKey) return;
    this.accountKey = key;
    this.loaded.set(false);
    this.cache.set(this.read(key));
    void this.refresh();
  }

  private markLoaded(): void {
    this.loaded.set(true);
    const waiters = this.loadWaiters;
    this.loadWaiters = [];
    waiters.forEach((w) => w());
  }

  private read(key: string): Cached {
    try {
      const raw = this.doc.defaultView?.localStorage.getItem(KEY_PREFIX + key);
      if (raw) {
        const c = JSON.parse(raw) as Cached;
        if (c?.state && Array.isArray(c.state.seen)) {
          return { ...c, queue: c.queue ?? [], state: { ...emptyState(), ...c.state } };
        }
      }
    } catch {
      /* unreadable copy: start clean */
    }
    return { state: emptyState(), queue: [] };
  }

  private write(c: Cached): void {
    this.cache.set(c);
    if (!this.accountKey) return;
    try {
      this.doc.defaultView?.localStorage.setItem(KEY_PREFIX + this.accountKey, JSON.stringify(c));
    } catch {
      /* storage off: the state still holds for this visit */
    }
  }
}

/** The celebrant card's id: one per event (offer.role.{campaignId}). */
export function roleOfferId(campaignId: string): string {
  return `offer.role.${campaignId.toLowerCase()}`;
}

/**
 * The library's store, backed by {@link GuidanceService}. Every read waits (briefly) for the
 * account's state so a tip seen on the phone doesn't flash up here before the server has answered.
 */
export class GuidanceStoreAdapter implements UiGuidanceStore {
  constructor(private readonly g: GuidanceService) {}

  async tipsOn(): Promise<boolean> {
    await this.g.ready();
    return this.g.tipsOn();
  }

  async seen(id: string): Promise<boolean> {
    await this.g.ready();
    return this.g.isSeen(id);
  }

  markSeen(ids: readonly string[]): void {
    this.g.markSeen(ids);
  }

  setTipsOn(on: boolean): Promise<void> {
    return this.g.setTipsOn(on);
  }

  reset(): Promise<void> {
    return this.g.reset();
  }

  readDayCount(day: string): number {
    return this.g.readDayCount(day);
  }

  writeDayCount(day: string, count: number): void {
    this.g.writeDayCount(day, count);
  }
}
