import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpEventType } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { from, of, Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFileUpload } from '@zouriel/ui/form';
import { By } from '@angular/platform-browser';
import { ApiService } from '../api/api.service';
import { PortfolioWizardComponent } from '../../pages/portfolio/portfolio-wizard.component';
import { PortfolioCollectionComponent } from '../../pages/portfolio/portfolio-collection.component';
import { AddToPortfolioComponent } from './add-to-portfolio.component';
import { PortfolioUploaderComponent, UPLOAD_WORKERS } from './portfolio-uploader.component';
import { Portfolio, PortfolioCollection, PortfolioUploadEvent } from './portfolio.types';

// Owner 2026-11-13: photographers upload past work that was never on invites.blog into "uploads" collections;
// picks from events go in "events" collections; the two never mix.

const BASE = {
  id: 'p1', handle: 'studio', publicUrl: 'https://invites.blog/@studio', displayName: 'Studio', tagline: null, logoUrl: null,
  coverPhotoId: null, coverUrl: null, coverImageUrl: null, coverSource: 'none', theme: 'oxblood', accent: 'theme', font: 'classic',
  contact: { whatsApp: null, viber: null, instagram: null, phone: null, email: null, enquiries: true },
  published: false, publishedAt: null, setupDone: false, photoCount: 0, photoLimit: 500, unreadEnquiries: 0, sections: [], collections: [],
} as unknown as Portfolio;

const col = (id: string, kind: 'uploads' | 'events' | undefined, n = 0): PortfolioCollection => ({
  id, title: id, layout: 'grid', coverPhotoId: null, coverUrl: null, kind,
  photos: Array.from({ length: n }, (_, i) => ({ id: `${id}-${i}`, url: '/u.jpg', thumbUrl: '/t.jpg', width: 1, height: 1, campaignId: null, sourcePhotoId: null })),
});

const portfolio = (over: Partial<Portfolio> = {}): Portfolio => ({ ...BASE, ...over }) as Portfolio;

function toast() {
  return { success: vi.fn(), info: vi.fn(), danger: vi.fn(), warning: vi.fn() };
}

const file = (name: string, size = 1000, type = 'image/jpeg') => {
  const f = new File(['x'], name, { type });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

type Uploader = {
  add(files: File[]): void;
  retry(r: unknown): void;
  rows: () => { key: number; file: File; status: string; percent: number; error: string | null; canRetry: boolean }[];
  left: () => number;
};

describe('the portfolio upload box', () => {
  afterEach(() => TestBed.resetTestingModule());

  function setup(p: Portfolio = portfolio()) {
    const sends: { file: File; events: Subject<PortfolioUploadEvent> }[] = [];
    const api = {
      uploadPortfolioPhoto: vi.fn((_: string, f: File) => {
        const events = new Subject<PortfolioUploadEvent>();
        sends.push({ file: f, events });
        return events;
      }),
    };
    TestBed.configureTestingModule({
      imports: [PortfolioUploaderComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(PortfolioUploaderComponent);
    fixture.componentRef.setInput('collectionId', 'c1');
    fixture.componentRef.setInput('portfolio', p);
    const changed: Portfolio[] = [];
    fixture.componentInstance.changed.subscribe((x) => changed.push(x));
    fixture.detectChanges();
    return { fixture, api, sends, changed, u: fixture.componentInstance as unknown as Uploader };
  }

  it('sends each picture on its own, a few at a time, with its progress, and passes on the portfolio after each', () => {
    const { fixture, api, sends, changed, u } = setup();
    u.add([file('a.jpg'), file('b.heic', 2000, ''), file('c.png'), file('d.webp'), file('e.jpg')]);
    fixture.detectChanges();
    expect(api.uploadPortfolioPhoto).toHaveBeenCalledTimes(UPLOAD_WORKERS);
    expect(api.uploadPortfolioPhoto.mock.calls[0][0]).toBe('c1');
    expect(u.rows().map((r) => r.status)).toEqual(['sending', 'sending', 'sending', 'waiting', 'waiting']);

    sends[0].events.next({ kind: 'progress', share: 0.4 });
    fixture.detectChanges();
    expect(u.rows()[0].percent).toBe(40);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('ui-progress-bar').length).toBe(5);

    const after = portfolio({ photoCount: 1 });
    sends[0].events.next({ kind: 'done', result: { photo: {} as never, photoCount: 1, photoLimit: 500, photosLeft: 499, portfolio: after } });
    sends[0].events.complete();
    fixture.detectChanges();
    expect(changed).toEqual([after]);
    expect(u.rows()[0].status).toBe('done');
    // A free worker picks up the next one.
    expect(api.uploadPortfolioPhoto).toHaveBeenCalledTimes(UPLOAD_WORKERS + 1);
    expect(sends[3].file.name).toBe('d.webp');
    // The box's own list of names is off: this list is the one.
    expect((fixture.debugElement.query(By.directive(UiFileUpload)).componentInstance as UiFileUpload).showFiles()).toBe(false);
  });

  it('a dropped connection can be tried again; a file that is not a photo cannot', () => {
    const { fixture, api, sends, u } = setup();
    u.add([file('a.jpg'), file('b.gif')]);
    sends[0].events.error(Object.assign(new Error('The connection dropped. Try again.'), { status: 0, code: null }));
    sends[1].events.error(Object.assign(new Error("That file isn't a picture we can use."), { status: 400, code: 'not_an_image' }));
    fixture.detectChanges();
    const [a, b] = u.rows();
    expect(a.status).toBe('failed');
    expect(a.canRetry).toBe(true);
    expect(b.canRetry).toBe(false);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("That file isn't a picture we can use.");
    expect(Array.from(el.querySelectorAll('ui-button')).filter((x) => x.textContent?.includes('Try again')).length).toBe(1);

    u.retry(a);
    fixture.detectChanges();
    expect(api.uploadPortfolioPhoto).toHaveBeenCalledTimes(3);
    expect(sends[2].file.name).toBe('a.jpg');
    expect(u.rows()[0].status).toBe('sending');
  });

  it('refuses a picture over 30 MB and anything past the 500, without sending them, and shows what is left', () => {
    const { fixture, api, u } = setup(portfolio({ photoCount: 498 }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid=upload-count]')?.textContent).toContain('498 of 500 photos used.');
    expect(el.querySelector('[data-testid=upload-count]')?.textContent).toContain('2 left.');
    u.add([file('huge.jpg', 31 * 1024 * 1024), file('a.jpg'), file('b.jpg'), file('c.jpg')]);
    fixture.detectChanges();
    expect(api.uploadPortfolioPhoto).toHaveBeenCalledTimes(2);
    const rows = u.rows();
    expect(rows[0].error).toContain('under 30 MB');
    expect(rows[3].error).toContain('full');
    expect(rows[3].canRetry).toBe(false);
    expect(u.left()).toBe(0);
    expect(el.querySelector('[data-testid=upload-count]')?.textContent).toContain('full');
  });
});

describe('uploads and picks never mix', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('the album "Add to portfolio" lists only event collections', async () => {
    const p = portfolio({ collections: [col('mine', 'uploads', 3), col('weddings', 'events', 2), col('old', undefined, 1)] });
    const api = { portfolio: vi.fn(() => of(p)), addPortfolioPhotos: vi.fn() };
    TestBed.configureTestingModule({
      imports: [AddToPortfolioComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(AddToPortfolioComponent);
    fixture.componentRef.setInput('photoIds', ['a']);
    const c = fixture.componentInstance as unknown as {
      open: { set(v: boolean): void };
      choices: () => { value: string; label: string }[];
      target: () => string | null;
    };
    c.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(c.choices().map((x) => x.value)).toEqual(['weddings', 'old', expect.any(String)]);
    expect(c.choices().map((x) => x.label)).toContain('New collection');
    expect(c.target()).toBe('weddings');
  });

  it('an uploads collection shows the upload box, not the event picker', async () => {
    const p = portfolio({ collections: [col('mine', 'uploads', 2)] });
    // Answers later, like the real API (the page reads its route input when the answer comes).
    const api = { portfolio: vi.fn(() => from(Promise.resolve(p))), uploadPortfolioPhoto: vi.fn() };
    TestBed.configureTestingModule({
      imports: [PortfolioCollectionComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(PortfolioCollectionComponent);
    fixture.componentRef.setInput('id', 'mine');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-portfolio-uploader')).not.toBeNull();
    expect(el.textContent).toContain('Uploaded from your device');
    expect(el.textContent).not.toContain('Add photos');
  });

  it('an event collection keeps "Add photos" and has no upload box', async () => {
    const p = portfolio({ collections: [col('weddings', 'events', 2)] });
    const api = { portfolio: vi.fn(() => from(Promise.resolve(p))) };
    TestBed.configureTestingModule({
      imports: [PortfolioCollectionComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(PortfolioCollectionComponent);
    fixture.componentRef.setInput('id', 'weddings');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('app-portfolio-uploader')).toBeNull();
    expect(el.textContent).toContain('Add photos');
  });
});

describe('setup: the first collection asks where the photos are', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('"Upload your work" makes an uploads collection and Next waits for a picture', async () => {
    const made = portfolio({ collections: [col('new1', 'uploads', 0)] });
    const api = {
      addPortfolioCollection: vi.fn(() => of(made)),
      myCampaigns: vi.fn(() => of([])),
      portfolioHandleCheck: vi.fn(),
    };
    TestBed.configureTestingModule({
      imports: [PortfolioWizardComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(PortfolioWizardComponent);
    fixture.componentRef.setInput('portfolio', BASE);
    fixture.componentInstance.changed.subscribe((p) => fixture.componentRef.setInput('portfolio', p));
    fixture.detectChanges();
    const w = fixture.componentInstance as unknown as { step: { set(n: number): void }; chooseKind(k: string): Promise<void>; canNext(): boolean };
    w.step.set(3);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Upload your work');
    expect(el.textContent).toContain('Pick from an event');

    await w.chooseKind('uploads');
    fixture.detectChanges();
    expect(api.addPortfolioCollection).toHaveBeenCalledWith('My work', 'grid', 'uploads');
    expect(el.querySelector('app-portfolio-uploader')).not.toBeNull();
    expect(w.canNext()).toBe(false);

    fixture.componentRef.setInput('portfolio', portfolio({ photoCount: 1, collections: [col('new1', 'uploads', 1)] }));
    fixture.detectChanges();
    expect(w.canNext()).toBe(true);
  });

  it('"Pick from an event" shows the event picker and makes nothing yet', async () => {
    const api = { addPortfolioCollection: vi.fn(), myCampaigns: vi.fn(() => of([])), portfolioHandleCheck: vi.fn() };
    TestBed.configureTestingModule({
      imports: [PortfolioWizardComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: UiToastService, useValue: toast() }],
    });
    const fixture = TestBed.createComponent(PortfolioWizardComponent);
    fixture.componentRef.setInput('portfolio', BASE);
    fixture.detectChanges();
    const w = fixture.componentInstance as unknown as { step: { set(n: number): void }; chooseKind(k: string): Promise<void> };
    w.step.set(3);
    await w.chooseKind('events');
    fixture.detectChanges();
    expect(api.addPortfolioCollection).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-portfolio-photo-picker')).not.toBeNull();
  });
});

describe('ApiService.uploadPortfolioPhoto', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('posts the file as multipart to the collection, reports progress, and carries the refusal code', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: UiToastService, useValue: toast() }],
    });
    const api = TestBed.inject(ApiService);
    const http = TestBed.inject(HttpTestingController);
    const seen: PortfolioUploadEvent[] = [];
    api.uploadPortfolioPhoto('c1', file('a.heic', 10, 'image/heic')).subscribe((e) => seen.push(e));
    const req = http.expectOne((r) => r.url.endsWith('/api/me/portfolio/collections/c1/photos'));
    expect(req.request.method).toBe('POST');
    expect((req.request.body as FormData).get('file')).toBeInstanceOf(File);
    req.event({ type: HttpEventType.UploadProgress, loaded: 5, total: 10 });
    req.flush({ success: true, data: { photo: { id: 'x' }, photoCount: 1, photoLimit: 500, photosLeft: 499, portfolio: BASE } });
    expect(seen[0]).toEqual({ kind: 'progress', share: 0.5 });
    expect(seen[1].kind).toBe('done');

    let err: (Error & { code?: string }) | null = null;
    api.uploadPortfolioPhoto('c1', file('b.gif')).subscribe({ error: (e) => (err = e) });
    http
      .expectOne((r) => r.url.endsWith('/collections/c1/photos'))
      .flush(
        { success: false, message: "That file isn't a picture we can use.", data: null, errors: [{ message: 'x', field: null, code: 'not_an_image' }] },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(err!.message).toBe("That file isn't a picture we can use.");
    expect(err!.code).toBe('not_an_image');
    http.verify();
  });
});
