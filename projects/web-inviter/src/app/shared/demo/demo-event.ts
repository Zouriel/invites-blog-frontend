import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import type {
  Celebrant,
  DashboardApiResponse,
  EventPhotoBox,
  FeedCovers,
  MediaBucket,
} from '../utils/types/api.types';

/**
 * GET /api/demo/event: the organiser dashboard's response for a made-up wedding, plus what the
 * dashboard's other parts would each have asked for. Everything about the example event comes from
 * this one response (docs/GUIDANCE.md section 7).
 */
export type DemoEvent = Omit<DashboardApiResponse, 'campaign'> & {
  campaign: NonNullable<DashboardApiResponse['campaign']> & { id: string };
  demo: true;
  celebrants: Celebrant[];
  buckets: MediaBucket[];
  album: EventPhotoBox;
  covers: FeedCovers;
};

/** Every id in the example event starts with this, and no real record does. */
export const DEMO_ID_PREFIX = 'de300000-0000-4000-8000-';

/** What a refused action says, wherever it shows (the toast of a call that reached the guard). */
export const DEMO_REFUSAL = 'This is an example event, so nothing here can be changed. Start your own to do this for real.';

/** The example event, once it has been fetched, for the interceptor below. */
@Injectable({ providedIn: 'root' })
export class DemoEventStore {
  readonly event = signal<DemoEvent | null>(null);
}

/**
 * The example event's guard. Any request naming an example id is answered here and never reaches
 * the network: reads from the one demo response, every write refused. So the real dashboard and
 * its parts can draw the example without a single call to the API about it, and a missed button
 * can't change anything.
 */
export const demoInterceptor: HttpInterceptorFn = (req, next) => {
  if (!mentionsDemo(req)) return next(req);
  const store = inject(DemoEventStore);
  return answer(req, store);
};

function mentionsDemo(req: HttpRequest<unknown>): boolean {
  if (req.url.includes(DEMO_ID_PREFIX)) return true;
  // A write naming one in its body (e.g. "download these photos") is the example's too.
  if (req.method !== 'GET' && req.body != null) {
    try {
      return JSON.stringify(req.body).includes(DEMO_ID_PREFIX);
    } catch {
      return false;
    }
  }
  return false;
}

function ok(body: unknown): Observable<HttpEvent<unknown>> {
  return of(new HttpResponse({ status: 200, body: { success: true, data: body } }));
}

function refuse(req: HttpRequest<unknown>, status = 403): Observable<HttpEvent<unknown>> {
  return throwError(
    () =>
      new HttpErrorResponse({
        status,
        url: req.url,
        error: { success: false, message: DEMO_REFUSAL },
      }),
  );
}

/** The read answers, by path. Anything else about the example is refused, never forwarded. */
function answer(req: HttpRequest<unknown>, store: DemoEventStore): Observable<HttpEvent<unknown>> {
  const d = store.event();
  if (req.method !== 'GET') return refuse(req);
  if (!d) return refuse(req, 404);
  const path = req.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0];
  const campaign = d.campaign.id;
  const bucket = d.buckets[0]?.id;
  const routes: [string, () => unknown][] = [
    [`/api/me/campaigns/${campaign}/dashboard`, () => ({ campaign: d.campaign, report: d.report, guests: d.guests, rsvpQuestions: d.rsvpQuestions, sending: d.sending })],
    [`/api/campaigns/${campaign}/bucket`, () => d.buckets[0] ?? null],
    [`/api/campaigns/${campaign}/buckets`, () => d.buckets],
    [`/api/campaigns/${campaign}/celebrants`, () => d.celebrants],
    [`/api/me/feed/${campaign}/covers`, () => d.covers],
    [`/api/media-buckets/${bucket}`, () => d.buckets[0]],
    [`/api/media-buckets/${bucket}/media`, () => d.album],
  ];
  const hit = routes.find(([p]) => path === p);
  return hit ? ok(hit[1]()) : refuse(req, 404);
}
