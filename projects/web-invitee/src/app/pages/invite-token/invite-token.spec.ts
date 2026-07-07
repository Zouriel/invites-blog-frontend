import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InviteTokenComponent } from './invite-token';
import { ApiService } from '../../shared/api/api.service';
import { InviteByToken } from '../../shared/utils/types/api.types';
import { InviteViewState } from '../../shared/utils/enums/view-state.enum';

function setup(response: InviteByToken) {
  const api = { getInviteByToken: vi.fn().mockReturnValue(of(response)) };
  TestBed.configureTestingModule({
    imports: [InviteTokenComponent],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }],
  });
  const fixture = TestBed.createComponent(InviteTokenComponent);
  fixture.detectChanges();
  return fixture;
}

describe('InviteTokenComponent (three documented cases)', () => {
  it('renders the sandboxed iframe on a successful package response', () => {
    const fixture = setup({ packageUrl: 'https://cdn.test/pkg/', data: { title: 'Hi' } });
    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance['state']()).toBe(InviteViewState.Ready);
    const frame = el.querySelector('iframe');
    expect(frame).toBeTruthy();
    expect(frame?.getAttribute('sandbox')).toBe('allow-scripts');
  });

  it('shows the OTP gate when requiresOtp is true', () => {
    const fixture = setup({ requiresOtp: true });
    expect(fixture.componentInstance['state']()).toBe(InviteViewState.Otp);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.textContent).toContain('private');
  });

  it('shows the cancelled result when cancelled is true', () => {
    const fixture = setup({ cancelled: true, message: 'Called off' });
    expect(fixture.componentInstance['state']()).toBe(InviteViewState.Cancelled);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('iframe')).toBeNull();
    expect(el.textContent).toContain('cancelled');
  });
});
