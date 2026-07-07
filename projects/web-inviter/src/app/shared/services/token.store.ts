import { Injectable } from '@angular/core';
import { CampaignMeta } from '../utils/types/api.types';

/**
 * Stores per-campaign access tokens + non-secret context in localStorage.
 * Key format: `ib_token_{campaignId}` (spec §4.6.2), meta: `ib_meta_{campaignId}`.
 */
@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly prefix = 'ib_token_';
  private readonly metaPrefix = 'ib_meta_';

  set(campaignId: string, token: string): void {
    try {
      localStorage.setItem(this.prefix + campaignId, token);
    } catch {
      /* storage unavailable (SSR / private mode) — ignore */
    }
  }

  get(campaignId: string): string | null {
    try {
      return localStorage.getItem(this.prefix + campaignId);
    } catch {
      return null;
    }
  }

  clear(campaignId: string): void {
    try {
      localStorage.removeItem(this.prefix + campaignId);
    } catch {
      /* ignore */
    }
  }

  setMeta(campaignId: string, meta: CampaignMeta): void {
    try {
      const current = this.getMeta(campaignId);
      localStorage.setItem(
        this.metaPrefix + campaignId,
        JSON.stringify({ ...current, ...meta }),
      );
    } catch {
      /* ignore */
    }
  }

  getMeta(campaignId: string): CampaignMeta {
    try {
      const raw = localStorage.getItem(this.metaPrefix + campaignId);
      return raw ? (JSON.parse(raw) as CampaignMeta) : {};
    } catch {
      return {};
    }
  }
}
