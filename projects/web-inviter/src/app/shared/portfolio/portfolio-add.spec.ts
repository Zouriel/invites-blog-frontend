import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { PortfolioWizardComponent } from '../../pages/portfolio/portfolio-wizard.component';
import { PortfolioPhotoPickerComponent } from './portfolio-photo-picker.component';
import { AddToPortfolioComponent } from './add-to-portfolio.component';
import { Portfolio, PortfolioEventPhotos } from './portfolio.types';

// Owner's report 2026-11-13: setup and "Add photos" reported success although nothing was added.

const PORTFOLIO = {
  id: 'p1', handle: 'studio', publicUrl: 'https://invites.blog/@studio', displayName: 'Studio', tagline: null, logoUrl: null,
  coverPhotoId: null, coverUrl: null, coverImageUrl: null, coverSource: 'none', theme: 'oxblood', accent: 'theme', font: 'classic',
  contact: { whatsApp: null, viber: null, instagram: null, phone: null, email: null, enquiries: true },
  published: false, publishedAt: null, setupDone: false, photoCount: 0, photoLimit: 500, unreadEnquiries: 0, sections: [], collections: [],
} as unknown as Portfolio;

const NOTHING = 'None of these could be added: they were added by guests. Only photos you uploaded yourself can go in your portfolio.';

function toast() {
  return { success: vi.fn(), info: vi.fn(), danger: vi.fn(), warning: vi.fn() };
}

type Wizard = {
  step: { set(n: number): void };
  addFirst(p: { campaignId: string; eventTitle: string; photoIds: string[] }): Promise<void>;
  addError: () => string | null;
  firstAdded: () => string | null;
  canNext(): boolean;
};

async function wizard(add: () => unknown) {
  const api = { addPortfolioPhotos: vi.fn(add), myCampaigns: vi.fn(() => of([])), portfolioHandleCheck: vi.fn() };
  const t = toast();
  TestBed.configureTestingModule({
    imports: [PortfolioWizardComponent],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: UiToastService, useValue: t }],
  });
  const fixture = TestBed.createComponent(PortfolioWizardComponent);
  fixture.componentRef.setInput('portfolio', PORTFOLIO);
  fixture.detectChanges();
  const w = fixture.componentInstance as unknown as Wizard;
  w.step.set(3);
  fixture.detectChanges();
  return { w, api, t, fixture };
}

describe('adding photos never reports success when nothing was added', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('setup: a refusal stays on the photos step with the reason, and Next stays off', async () => {
    const { w, t } = await wizard(() => throwError(() => Object.assign(new Error(NOTHING), { status: 422 })));
    await w.addFirst({ campaignId: 'e1', eventTitle: 'Wedding', photoIds: ['a', 'b'] });
    expect(w.addError()).toBe(NOTHING);
    expect(w.firstAdded()).toBeNull();
    expect(w.canNext()).toBe(false);
    expect(t.success).not.toHaveBeenCalled();
  });

  it('setup: photos that were all there already are not a success either', async () => {
    const { w } = await wizard(() => of({ added: 0, alreadyIn: 2, skippedGuest: 0, skippedVideo: 0, collectionId: 'c', message: 'No photos added. 2 were already there.', portfolio: PORTFOLIO }));
    await w.addFirst({ campaignId: 'e1', eventTitle: 'Wedding', photoIds: ['a', 'b'] });
    expect(w.firstAdded()).toBeNull();
    expect(w.addError()).toBe('No photos added. 2 were already there.');
    expect(w.canNext()).toBe(false);
  });

  it('setup: photos that went in let them carry on', async () => {
    const { w } = await wizard(() => of({ added: 2, alreadyIn: 0, skippedGuest: 1, skippedVideo: 0, collectionId: 'c', message: '2 photos added.', portfolio: PORTFOLIO }));
    await w.addFirst({ campaignId: 'e1', eventTitle: 'Wedding', photoIds: ['a', 'b', 'c'] });
    expect(w.firstAdded()).toContain('2 photos added.');
    expect(w.addError()).toBeNull();
    expect(w.canNext()).toBe(true);
  });

  it('album "Add to portfolio": a refusal shows in the dialog, which stays open', async () => {
    const t = toast();
    const api = {
      portfolio: vi.fn(() => of(PORTFOLIO)),
      addPortfolioPhotos: vi.fn(() => throwError(() => Object.assign(new Error(NOTHING), { status: 422 }))),
    };
    TestBed.configureTestingModule({
      imports: [AddToPortfolioComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: UiToastService, useValue: t }],
    });
    const fixture = TestBed.createComponent(AddToPortfolioComponent);
    fixture.componentRef.setInput('photoIds', ['a']);
    const c = fixture.componentInstance as unknown as { open: { set(v: boolean): void; (): boolean }; newTitle: string; add(): Promise<void>; error: () => string | null };
    c.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    c.newTitle = 'Weddings';
    await c.add();
    fixture.detectChanges();
    expect(c.error()).toBe(NOTHING);
    expect(c.open()).toBe(true);
    expect(t.success).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('they were added by guests');
  });
});

describe('the portfolio photo picker offers what the server says can go in', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows only eligible photos and says why the others are left out', async () => {
    const album: PortfolioEventPhotos = {
      consented: true, eligibleCount: 1, guestCount: 2, videoCount: 1,
      photos: [
        { id: 'mine', thumbUrl: '/m.jpg', url: '/m.jpg', width: 1, height: 1, eligible: true, reason: null, reasonText: null, inPortfolio: false },
        { id: 'g1', thumbUrl: '/g1.jpg', url: '/g1.jpg', width: 1, height: 1, eligible: false, reason: 'guest', reasonText: 'Added by a guest', inPortfolio: false },
        { id: 'g2', thumbUrl: '/g2.jpg', url: '/g2.jpg', width: 1, height: 1, eligible: false, reason: 'guest', reasonText: 'Added by a guest', inPortfolio: false },
        { id: 'v', thumbUrl: '/v.jpg', url: '/v.mp4', width: 1, height: 1, eligible: false, reason: 'video', reasonText: "Videos can't be added", inPortfolio: false },
      ],
    };
    const api = {
      myCampaigns: vi.fn(() => of([{ id: 'e1', title: 'Wedding', relation: 'organiser', photoCount: 4, previewImageUrl: null }])),
      portfolioConsent: vi.fn(() => of({ consented: true, consentedAt: null, photosInPortfolio: 0 })),
      portfolioEventPhotos: vi.fn(() => of(album)),
      portfolioUploaders: vi.fn(() => of({ consented: true, groups: [] })),
    };
    TestBed.configureTestingModule({ imports: [PortfolioPhotoPickerComponent], providers: [{ provide: ApiService, useValue: api }] });
    const fixture = TestBed.createComponent(PortfolioPhotoPickerComponent);
    fixture.detectChanges();
    await (fixture.componentInstance as unknown as { chooseEvent(id: string): Promise<void> }).chooseEvent('e1');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(api.portfolioEventPhotos).toHaveBeenCalledWith('e1');
    expect([...el.querySelectorAll('img.thumb')].map((i) => i.getAttribute('src'))).toEqual(['/m.jpg']);
    expect(el.textContent).toContain('2 were added by guests and 1 is a video.');
  });
});
