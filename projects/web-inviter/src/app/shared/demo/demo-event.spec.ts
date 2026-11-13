import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEMO_REFUSAL, DemoEvent, DemoEventStore, demoInterceptor } from './demo-event';

const C = 'de300000-0000-4000-8000-000000000001';
const B = 'de300000-0000-4000-8000-000000000002';
const P = 'de300000-0000-4000-8000-000000001000';

const demo = {
  demo: true,
  campaign: { id: C, title: 'Aisha & Ibrahim', viewer: 'organiser' },
  report: { total: 24, sent: 24, failed: 0, viewed: 20, notSent: 0 },
  guests: [],
  rsvpQuestions: [],
  sending: { included: 100, extra: 0, used: 24, total: 100, left: 76 },
  celebrants: [{ id: 'de300000-0000-4000-8000-000000000050', name: 'Aisha' }],
  buckets: [{ id: B, name: 'Photos' }],
  album: { campaignId: C, count: 1, canUpload: false, photos: [{ id: P }] },
  covers: { bucketId: B, photoIds: [P], max: 6 },
} as unknown as DemoEvent;

describe('demoInterceptor (the example event never reaches the API)', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([demoInterceptor])), provideHttpClientTesting()],
    });
    TestBed.inject(DemoEventStore).event.set(demo);
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());

  it('answers the dashboard and each of its parts from the one demo response', async () => {
    const dash = await firstValueFrom(http.get<{ data: { campaign: { title: string } } }>(`http://x/api/me/campaigns/${C}/dashboard`));
    expect(dash.data.campaign.title).toBe('Aisha & Ibrahim');
    expect((await firstValueFrom(http.get<{ data: unknown[] }>(`http://x/api/campaigns/${C}/buckets`))).data).toEqual(demo.buckets);
    expect((await firstValueFrom(http.get<{ data: unknown }>(`http://x/api/media-buckets/${B}/media`))).data).toEqual(demo.album);
    expect((await firstValueFrom(http.get<{ data: unknown }>(`http://x/api/campaigns/${C}/celebrants`))).data).toEqual(demo.celebrants);
    expect((await firstValueFrom(http.get<{ data: unknown }>(`http://x/api/me/feed/${C}/covers`))).data).toEqual(demo.covers);
    backend.expectNone(() => true);
  });

  it('refuses every write about the example, by URL or body, without sending it', async () => {
    const writes = [
      http.post(`http://x/api/campaigns/${C}/guests`, { name: 'x' }),
      http.put(`http://x/api/campaigns/${C}/title`, { title: 'x' }),
      http.delete(`http://x/api/campaigns/${C}`),
      http.post(`http://x/api/me/favourites/${P}`, {}),
      http.post(`http://x/api/me/favourites/download-link`, { ids: [P] }),
    ];
    for (const w of writes) {
      await expect(firstValueFrom(w)).rejects.toMatchObject({ status: 403, error: { message: DEMO_REFUSAL } });
    }
    backend.expectNone(() => true);
  });

  it('refuses any other read naming an example id rather than forwarding it', async () => {
    await expect(firstValueFrom(http.get(`http://x/api/billing/events/${C}`))).rejects.toMatchObject({ status: 404 });
    backend.expectNone(() => true);
  });

  it('leaves everything else alone', () => {
    http.get('http://x/api/me/feed').subscribe();
    backend.expectOne('http://x/api/me/feed').flush({});
  });
});
