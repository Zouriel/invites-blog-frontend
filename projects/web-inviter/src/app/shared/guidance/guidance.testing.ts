import { Provider, computed, signal } from '@angular/core';
import { GuidanceService } from './guidance.service';
import { GuidanceNewRole, GuidanceProgress, NO_PROGRESS } from './guidance.types';

/**
 * A GuidanceService for specs: the account's tips state as plain signals, nothing fetched. Pages that
 * show tips inject the real one, which talks to the API and the session; specs that are about
 * something else give them this.
 */
export function guidanceStub(init: {
  tipsOn?: boolean;
  seen?: string[];
  inWelcome?: boolean;
  progress?: Partial<GuidanceProgress>;
  newRoles?: GuidanceNewRole[];
  loaded?: boolean;
} = {}) {
  const seen = signal(new Set(init.seen ?? []));
  const tipsOn = signal(init.tipsOn ?? true);
  const roles = signal(init.newRoles ?? []);
  const stub = {
    loaded: signal(init.loaded ?? true),
    tipsOn,
    progress: signal({ ...NO_PROGRESS, ...init.progress }),
    seenIds: seen,
    inWelcome: signal(init.inWelcome ?? false),
    newRoles: computed(() => roles().filter((r) => !seen().has(`offer.role.${r.campaignId}`))),
    isSeen: (id: string) => seen().has(id),
    markSeen: (ids: readonly string[]) => seen.update((s) => new Set([...s, ...ids])),
    setTipsOn: async (on: boolean) => tipsOn.set(on),
    reset: async () => {
      seen.set(new Set());
      tipsOn.set(true);
    },
    ackRole: (id: string) => {
      seen.update((s) => new Set([...s, `offer.role.${id}`]));
      roles.update((r) => r.filter((x) => x.campaignId !== id));
    },
    roleFor: (id: string) => roles().find((r) => r.campaignId === id) ?? null,
    ready: () => Promise.resolve(),
    refresh: () => Promise.resolve(),
    readDayCount: () => 0,
    writeDayCount: () => {},
  };
  return stub;
}

export function provideGuidanceStub(init: Parameters<typeof guidanceStub>[0] = {}): Provider {
  return { provide: GuidanceService, useValue: guidanceStub(init) };
}
