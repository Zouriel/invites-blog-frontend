import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SessionStore } from './session.store';
import type { Account } from '../utils/types/api.types';

/** Photographer (2026-11-13) has the portfolio like Studio, but is not Studio (no AI designer). */
describe('SessionStore plans', () => {
  afterEach(() => TestBed.resetTestingModule());

  const on = (subscriptionTier: string) => {
    const s = TestBed.inject(SessionStore);
    s.account.set({ id: 'me', subscriptionTier } as unknown as Account);
    return s;
  };

  it('gives Photographer and Studio the portfolio, and nobody else', () => {
    const p = on('Photographer');
    expect([p.hasPortfolio(), p.isPhotographer(), p.isStudio()]).toEqual([true, true, false]);
    const v = on('Venue');
    expect([v.hasPortfolio(), v.isPhotographer(), v.isStudio()]).toEqual([true, false, true]);
    for (const t of ['Premium', 'None']) expect(on(t).hasPortfolio()).toBe(false);
  });
});
