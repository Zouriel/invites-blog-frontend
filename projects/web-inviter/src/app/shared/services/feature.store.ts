import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import { SessionStore } from './session.store';

export const FEATURE_TEMPLATE_DESIGNER = 'template-designer';

/**
 * The unreleased features this account may use — released ones, anything an admin switched on for
 * them as a tester, or everything for an admin. Only decides what the app SHOWS: the server refuses
 * the feature's requests to everyone else regardless.
 */
@Injectable({ providedIn: 'root' })
export class FeatureStore {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);

  private readonly features = signal<ReadonlySet<string>>(new Set());
  readonly loaded = signal(false);
  private loading: Promise<void> | null = null;

  readonly templateDesigner = computed(() => this.features().has(FEATURE_TEMPLATE_DESIGNER));

  constructor() {
    effect(() => {
      const signedIn = this.session.isSignedIn();
      untracked(() => {
        if (signedIn) void this.refresh();
        else {
          this.features.set(new Set());
          this.loaded.set(false);
        }
      });
    });
  }

  has(feature: string): boolean {
    return this.features().has(feature);
  }

  /** Resolves once the list is known — for guards, which can't decide on a guess. */
  ready(): Promise<void> {
    if (this.loaded()) return Promise.resolve();
    return this.refresh();
  }

  refresh(): Promise<void> {
    this.loading ??= firstValueFrom(this.api.myFeatures())
      .then((list) => this.features.set(new Set(list ?? [])))
      .catch(() => this.features.set(new Set()))
      .finally(() => {
        this.loaded.set(true);
        this.loading = null;
      });
    return this.loading;
  }
}
