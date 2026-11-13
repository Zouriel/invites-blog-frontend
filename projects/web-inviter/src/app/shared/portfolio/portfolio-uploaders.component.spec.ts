import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../api/api.service';
import { PortfolioPhotoPickerComponent } from './portfolio-photo-picker.component';
import { PortfolioUploadersComponent } from './portfolio-uploaders.component';
import { PortfolioEventPhotos, PortfolioUploaders } from './portfolio.types';

// Owner's report 2026-11-13 night: he took photos at an event through a guest link (as "Immy"), so none were his.

const UNCLAIMED: PortfolioUploaders = {
  consented: true,
  groups: [
    { key: 'guest:g1', name: 'Mai', photoCount: 171, videoCount: 0, thumbUrls: ['/a/1.jpg', '/a/2.jpg', '/a/3.jpg', '/a/4.jpg', '/a/5.jpg'], claimed: false, claimedAt: null },
    { key: 'guest:g2', name: 'Immy', photoCount: 89, videoCount: 2, thumbUrls: ['/a/6.jpg'], claimed: false, claimedAt: null },
  ],
};
const CLAIMED: PortfolioUploaders = {
  consented: true,
  groups: [UNCLAIMED.groups[0], { ...UNCLAIMED.groups[1], claimed: true, claimedAt: '2026-11-13T20:00:00Z' }],
};

function toast() {
  return { success: vi.fn(), info: vi.fn(), danger: vi.fn(), warning: vi.fn() };
}

function api(state: PortfolioUploaders = UNCLAIMED) {
  return {
    portfolioUploaders: vi.fn(() => of(state)),
    claimPortfolioUploader: vi.fn(() => of({ count: 89, message: '89 photos are now yours.', uploaders: CLAIMED })),
    unclaimPortfolioUploader: vi.fn(() => of({ count: 89, removedFromPortfolio: 0, message: 'Done.', uploaders: UNCLAIMED })),
  };
}

type Block = {
  claim(g: PortfolioUploaders['groups'][number]): Promise<void>;
  askUndo(g: PortfolioUploaders['groups'][number]): void;
  unclaim(): Promise<void>;
  undoing: () => unknown;
};

async function mount(a = api()) {
  const t = toast();
  TestBed.configureTestingModule({
    imports: [PortfolioUploadersComponent],
    providers: [{ provide: ApiService, useValue: a }, { provide: UiToastService, useValue: t }],
  });
  const fixture = TestBed.createComponent(PortfolioUploadersComponent);
  fixture.componentRef.setInput('campaignId', 'ev-1');
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, a, t, changed, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Block };
}

describe('"These are mine" (who took these photos)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists each name with its count, up to four thumbnails and a "This is me" button', async () => {
    const { el, a } = await mount();
    expect(a.portfolioUploaders).toHaveBeenCalledWith('ev-1');
    expect(el.textContent).toContain('Which of these are you?');
    expect(el.textContent).toContain('Mai');
    expect(el.textContent).toContain('171 photos');
    expect(el.textContent).toContain('89 photos, 2 videos');
    const rows = el.querySelectorAll('ui-list-item');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelectorAll('.thumbs img')).toHaveLength(4);
    expect(rows[0].textContent).toContain('This is me');
  });

  it('shows nothing when the event has no consent (or the API refused)', async () => {
    const { el } = await mount(api({ consented: false, groups: UNCLAIMED.groups }));
    expect(el.textContent?.trim()).toBe('');
  });

  it('claims the tapped name, shows the new state and tells the page to reload', async () => {
    const { c, a, t, changed, fixture, el } = await mount();
    await c.claim(UNCLAIMED.groups[1]);
    fixture.detectChanges();
    expect(a.claimPortfolioUploader).toHaveBeenCalledWith('ev-1', 'guest:g2');
    expect(t.success).toHaveBeenCalledWith('89 photos are now yours.');
    expect(changed).toHaveBeenCalledTimes(1);
    const immy = el.querySelectorAll('ui-list-item')[1];
    expect(immy.textContent).toContain('yours');
    expect(immy.textContent).toContain('Not me');
  });

  it('asks before "Not me", and only undoes once confirmed', async () => {
    const { c, a, changed } = await mount(api(CLAIMED));
    c.askUndo(CLAIMED.groups[1]);
    expect(c.undoing()).toBeTruthy();
    expect(a.unclaimPortfolioUploader).not.toHaveBeenCalled();
    await c.unclaim();
    expect(a.unclaimPortfolioUploader).toHaveBeenCalledWith('ev-1', 'guest:g2');
    expect(changed).toHaveBeenCalledTimes(1);
  });
});

describe('the photo picker after "This is me"', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('reloads the event photos so the claimed ones become selectable', async () => {
    const before: PortfolioEventPhotos = {
      consented: true, eligibleCount: 0, guestCount: 1, videoCount: 0,
      photos: [{ id: 'x1', thumbUrl: '/t.jpg', url: '/u.jpg', width: 1, height: 1, eligible: false, reason: 'guest', reasonText: 'Added by a guest', inPortfolio: false }],
    };
    const after: PortfolioEventPhotos = { ...before, eligibleCount: 1, guestCount: 0, photos: [{ ...before.photos[0], eligible: true, reason: null, reasonText: null }] };
    const a = {
      ...api(),
      myCampaigns: vi.fn(() => of([{ id: 'ev-1', title: 'Raniya', relation: 'organiser', photoCount: 1, previewImageUrl: null }])),
      portfolioConsent: vi.fn(() => of({ consented: true, consentedAt: null, photosInPortfolio: 0 })),
      portfolioEventPhotos: vi.fn().mockReturnValueOnce(of(before)).mockReturnValueOnce(of(after)),
    };
    TestBed.configureTestingModule({
      imports: [PortfolioPhotoPickerComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: a }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(PortfolioPhotoPickerComponent);
    fixture.detectChanges();
    const picker = fixture.componentInstance as unknown as { chooseEvent(id: string): Promise<void>; own: () => unknown[] };
    await picker.chooseEvent('ev-1');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(picker.own()).toHaveLength(0);

    const block = fixture.debugElement.query(By.directive(PortfolioUploadersComponent));
    expect(block).toBeTruthy();
    // Nothing can be added yet: the block is framed and set apart.
    expect((block.nativeElement as HTMLElement).querySelector('.mine--prominent')).toBeTruthy();
    await (block.componentInstance as unknown as Block).claim(UNCLAIMED.groups[1]);
    fixture.detectChanges();
    expect(a.portfolioEventPhotos).toHaveBeenCalledTimes(2);
    expect(picker.own()).toHaveLength(1);
  });
});
