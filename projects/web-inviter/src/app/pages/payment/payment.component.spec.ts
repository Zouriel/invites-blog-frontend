import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { UiToastService } from 'ui/dialog';
import { PaymentComponent } from './payment.component';
import { environment } from '../../../environments/environment';

describe('PaymentComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PaymentComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: UiToastService,
          useValue: jasmine.createSpyObj<UiToastService>('UiToastService', ['danger']),
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('renders the empty state when pricing fails to load', () => {
    const fixture = TestBed.createComponent(PaymentComponent);
    fixture.componentRef.setInput('campaignId', 'abc');
    fixture.detectChanges();

    httpMock
      .expectOne(`${environment.apiBase}/api/campaigns/abc/pricing`)
      .flush(
        { success: false, message: 'No guests', data: null, errors: null },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('ui-empty-state')).toBeTruthy();
  });
});
