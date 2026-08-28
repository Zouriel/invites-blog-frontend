import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, Template } from '../utils/types/api.types';

describe('ApiService (envelope)', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let toast: { danger: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    toast = { danger: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        ApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: UiToastService, useValue: toast },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps `.data` from a successful envelope', () => {
    let received: Template | undefined;
    api.getTemplate('rose').subscribe((t) => (received = t));

    const req = http.expectOne(`${environment.apiBase}/api/templates/rose`);
    const envelope: ApiEnvelope<Template> = {
      success: true,
      message: null,
      errors: null,
      data: {
        id: '1',
        name: 'Rose',
        slug: 'rose',
        category: 'wedding',
        description: '',
        previewImageUrl: null,
        previewAnimationUrl: null,
        isPremium: false,
        designerName: 'Studio',
        packageUrl: 'https://cdn/rose/',
        version: '1',
      },
    };
    req.flush(envelope);

    expect(received?.name).toBe('Rose');
    expect(toast.danger).not.toHaveBeenCalled();
  });

  it('surfaces the envelope message as a toast on error', () => {
    let errored = false;
    api.getTemplate('missing').subscribe({ error: () => (errored = true) });

    const req = http.expectOne(`${environment.apiBase}/api/templates/missing`);
    req.flush(
      { success: false, message: 'Not found', data: null, errors: null },
      { status: 404, statusText: 'Not Found' },
    );

    expect(errored).toBe(true);
    expect(toast.danger).toHaveBeenCalledWith('Not found');
  });

  // ----- editing a guest already on the list --------------------------------------------------

  /**
   * The dashboard's Edit button. Every part of this is a thing that silently does nothing when it
   * is wrong — a PUT sent as POST creates a second guest, a mistyped path 404s into a toast, and a
   * missing dashboard token is rejected for the one visitor who only has the emailed link.
   */
  describe('updateGuest', () => {
    it('PUTs the corrected guest to that guest\'s own path', () => {
      let done = false;
      api.updateGuest('camp-1', 'guest-9', { name: 'Rani', role: 'Bride' }).subscribe(() => (done = true));

      const req = http.expectOne(
        `${environment.apiBase}/api/campaigns/camp-1/guests/guest-9`,
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ name: 'Rani', role: 'Bride' });

      req.flush(null, { status: 204, statusText: 'No Content' });
      expect(done).toBe(true);
    });

    /**
     * A host who arrived by the emailed dashboard link has no session and no cached possession
     * token; this header is the only thing that authorises them. Without it the edit fails for
     * exactly the people most likely to be using it.
     */
    it('carries the dashboard token when there is one', () => {
      api.updateGuest('camp-1', 'guest-9', { name: 'Rani' }, 'magic-token').subscribe();

      const req = http.expectOne(`${environment.apiBase}/api/campaigns/camp-1/guests/guest-9`);
      expect(req.request.headers.get('Authorization')).toBe('Bearer magic-token');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    /** An empty string is how the dialog clears a field; it must survive as one, not be dropped. */
    it('sends a cleared field rather than omitting it', () => {
      api.updateGuest('camp-1', 'guest-9', { name: 'Rani', email: '', phone: '', role: '' }).subscribe();

      const req = http.expectOne(`${environment.apiBase}/api/campaigns/camp-1/guests/guest-9`);
      expect(req.request.body).toEqual({ name: 'Rani', email: '', phone: '', role: '' });
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });

  /**
   * The dashboard flattener. The server has always sent a role; the mapper dropped it, which is why
   * the column could not be shown and the edit dialog had nothing to prefill.
   */
  it('keeps a guest\'s role when flattening the dashboard', () => {
    let report: { guests: { role?: string | null }[] } | undefined;
    api.dashboard('camp-1', 'magic-token').subscribe((r) => (report = r));

    const req = http.expectOne((r) => r.url === `${environment.apiBase}/api/dashboard/camp-1`);
    req.flush({
      success: true,
      message: null,
      errors: null,
      data: {
        campaign: { id: 'camp-1', title: 'Raniya', status: 'Dispatched' },
        report: { sent: 1, failed: 0, viewed: 0, notSent: 0, rsvp: {} },
        guests: [
          { id: 'g1', name: 'Rani', phoneE164: '+9609752353', role: 'Bride', inviteStatus: 'Sent' },
          { id: 'g2', name: 'Ali', email: 'ali@example.com', inviteStatus: 'Sent' },
        ],
      },
    });

    expect(report!.guests.map((g) => g.role)).toEqual(['Bride', null]);
  });
});
