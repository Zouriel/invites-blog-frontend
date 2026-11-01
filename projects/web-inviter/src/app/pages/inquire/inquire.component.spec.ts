import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { InquireComponent } from './inquire.component';

function open(topic: string | null): { topic: string; copy: { title: string } | null } {
  TestBed.configureTestingModule({
    imports: [InquireComponent],
    providers: [
      provideRouter([]),
      { provide: ApiService, useValue: { submitInquiry: () => of({}) } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(topic ? { topic } : {}) } } },
    ],
  });
  return TestBed.createComponent(InquireComponent).componentInstance as unknown as { topic: string; copy: { title: string } | null };
}

describe('InquireComponent topics', () => {
  it.each([
    ['gold', 'gold', 'Add a Gold pass'],
    ['platinum', 'platinum', 'Add a Platinum pass'],
    // Links from before the passes were renamed.
    ['party', 'gold', 'Add a Gold pass'],
    ['wedding', 'platinum', 'Add a Platinum pass'],
  ])('?topic=%s asks for %s', (asked, topic, title) => {
    const c = open(asked);
    expect(c.topic).toBe(topic);
    expect(c.copy?.title).toBe(title);
  });

  it('anything else is a design inquiry', () => {
    for (const asked of [null, 'silver', 'constructor', 'toString']) {
      TestBed.resetTestingModule();
      expect(open(asked).topic).toBe('design');
    }
  });
});
