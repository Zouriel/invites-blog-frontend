import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { EventPhoto } from '../utils/types/api.types';
import { PhotoBoxComponent } from './photo-box.component';

const photo = (id: string, mine: boolean): EventPhoto => ({
  id, url: `/a/${id}.jpg`, thumbUrl: `/a/${id}_t.jpg`, originalUrl: `/a/${id}_o.jpg`, contentType: 'image/jpeg',
  width: 100, height: 100, uploaderName: mine ? 'Me' : 'Guest', canDelete: true, createdAt: '2026-11-01T10:00:00Z',
  uploaderUserId: mine ? 'me-1' : 'u-2', sizeBytes: 1000,
});

type Box = {
  selectionActions: () => { id: string }[];
  onSelectionAction(id: string): void;
  selected: () => ReadonlySet<string>;
  selectAll(): void;
  addingToPortfolio: () => boolean;
  portfolioIds: () => string[];
};

/** "Add to portfolio" in the album's selection bar (docs/PORTFOLIO.md §3): Studio accounts, after the event's consent. */
describe('photo box: Add to portfolio', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  async function mount(studio: boolean, consented: boolean) {
    const photos = [photo('a1', true), photo('b2', false)];
    api = {
      campaignPhotos: vi.fn(() => of({ campaignId: 'camp-1', eventTitle: 'Gala', count: 2, canUpload: false, photos })),
      portfolioConsent: vi.fn(() => of({ consented, consentedAt: null, photosInPortfolio: 0 })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: api },
        { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn(), info: vi.fn() } },
        { provide: SessionStore, useValue: { isStudio: signal(studio), isSignedIn: signal(true), account: signal({ id: 'me-1' }) } },
      ],
    });
    const fixture = TestBed.createComponent(PhotoBoxComponent);
    fixture.componentRef.setInput('campaignId', 'camp-1');
    fixture.componentRef.setInput('as', 'host');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const box = fixture.componentInstance as unknown as Box;
    box.selectAll();
    fixture.detectChanges();
    return box;
  }

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 360 });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)['clientWidth'];
  });

  it('shows for a Studio once the event has its consent, and opens the picker with the chosen photos', async () => {
    const box = await mount(true, true);
    expect(api['portfolioConsent']).toHaveBeenCalledWith('camp-1');
    expect(box.selectionActions().map((a) => a.id)).toContain('portfolio');
    box.onSelectionAction('portfolio');
    expect(box.addingToPortfolio()).toBe(true);
    expect(box.portfolioIds()).toEqual(['a1', 'b2']);
  });

  it('stays away without the consent', async () => {
    const box = await mount(true, false);
    expect(box.selectionActions().map((a) => a.id)).not.toContain('portfolio');
  });

  it('never shows, and never asks, for an account that is not Studio', async () => {
    const box = await mount(false, true);
    expect(api['portfolioConsent']).not.toHaveBeenCalled();
    expect(box.selectionActions().map((a) => a.id)).not.toContain('portfolio');
  });
});
