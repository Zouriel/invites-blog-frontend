import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuidanceService } from './guidance.service';
import { guidanceStub } from './guidance.testing';
import { RoleOffersComponent } from './role-offers.component';

const role = { campaignId: 'e1', title: 'Aisha & Ibrahim', coverUrl: null, access: 'look' as const, addedBy: 'Mariyam Hassan', addedAt: '2026-11-01T00:00:00Z' };

async function mount(init: Parameters<typeof guidanceStub>[0]) {
  const g = guidanceStub(init);
  const ack = vi.spyOn(g, 'ackRole');
  TestBed.configureTestingModule({ imports: [RoleOffersComponent], providers: [provideRouter([]), { provide: GuidanceService, useValue: g }] });
  const router = TestBed.inject(Router);
  const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const f = TestBed.createComponent(RoleOffersComponent);
  f.detectChanges();
  await f.whenStable();
  f.detectChanges();
  return { el: f.nativeElement as HTMLElement, f, ack, nav };
}

const button = (el: HTMLElement, text: string) =>
  [...el.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === text)!;

describe('the celebrant card (offer.role)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('says who added them, to what, and what they can do', async () => {
    const { el } = await mount({ newRoles: [role] });
    expect(el.textContent).toContain('Mariyam Hassan added you to “Aisha & Ibrahim” as a celebrant.');
    expect(el.textContent).toContain("You can see who's coming and all the photos.");
  });

  it('"Open event" acknowledges the role and opens its dashboard; the card is gone', async () => {
    const { el, f, ack, nav } = await mount({ newRoles: [role] });
    button(el, 'Open event').click();
    f.detectChanges();
    expect(ack).toHaveBeenCalledWith('e1');
    expect(nav).toHaveBeenCalledWith(['/dashboard', 'e1'], {});
    expect(el.querySelector('ui-offer-card')).toBeNull();
  });

  it('"Show me around" opens the dashboard with its tour', async () => {
    const { el, ack, nav } = await mount({ newRoles: [{ ...role, access: 'full' }] });
    expect(el.textContent).toContain('You can manage it with them.');
    button(el, 'Show me around').click();
    expect(ack).toHaveBeenCalledWith('e1');
    expect(nav).toHaveBeenCalledWith(['/dashboard', 'e1'], { queryParams: { tour: 'celebrant' } });
  });

  it('shows nothing while tips are off, or once answered', async () => {
    expect((await mount({ newRoles: [role], tipsOn: false })).el.querySelector('ui-offer-card')).toBeNull();
    TestBed.resetTestingModule();
    expect((await mount({ newRoles: [role], seen: ['offer.role.e1'] })).el.querySelector('ui-offer-card')).toBeNull();
  });
});
