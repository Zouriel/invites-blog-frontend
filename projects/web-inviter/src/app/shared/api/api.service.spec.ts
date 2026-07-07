import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { UiToastService } from 'ui/dialog';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { ApiEnvelope, Template } from '../utils/types/api.types';

describe('ApiService (envelope)', () => {
  let api: ApiService;
  let http: HttpTestingController;
  let toast: jasmine.SpyObj<UiToastService>;

  beforeEach(() => {
    toast = jasmine.createSpyObj<UiToastService>('UiToastService', ['danger']);
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

    expect(errored).toBeTrue();
    expect(toast.danger).toHaveBeenCalledWith('Not found');
  });
});
