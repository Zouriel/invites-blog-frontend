import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { routes } from '../../app.routes';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { Portfolio } from '../../shared/portfolio/portfolio.types';
import { PortfolioComponent } from './portfolio.component';

const P = {
  id: 'p1', handle: 'studio', publicUrl: 'https://invites.blog/@studio', displayName: 'Lens Studio', tagline: null,
  logoUrl: null, coverImageUrl: null, coverSource: 'none', coverPhotoId: null, coverUrl: null,
  theme: 'oxblood', accent: 'theme', font: 'classic',
  contact: { whatsApp: null, viber: null, instagram: null, phone: null, email: null, enquiries: true },
  published: true, publishedAt: null, setupDone: true, photoCount: 0, photoLimit: 500, unreadEnquiries: 2,
  sections: [], collections: [],
} as unknown as Portfolio;

function setup() {
  const api = {
    portfolio: vi.fn(() => of(P)),
    portfolioOptions: vi.fn(() => of(null)),
    portfolioEnquiries: vi.fn(() =>
      of([
        { id: 'e1', name: 'Aisha', contact: 'a@b.c', eventDate: null, message: 'Hi', createdAt: '2026-11-13T10:00:00Z', read: false },
        { id: 'e2', name: 'Ali', contact: '+9607000000', eventDate: null, message: 'Hello', createdAt: '2026-11-12T10:00:00Z', read: false },
      ]),
    ),
    markPortfolioEnquiryRead: vi.fn(() => of({})),
  };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'portfolio', component: PortfolioComponent }, ...routes.filter((r) => r.path === 'portfolio/enquiries')]),
      { provide: ApiService, useValue: api },
      { provide: SessionStore, useValue: { isStudio: signal(true), hasPortfolio: signal(true), get: () => 'tok', isSignedIn: signal(true) } },
    ],
  });
  return api;
}

async function open(url: string) {
  const router = TestBed.inject(Router);
  const { RouterTestingHarness } = await import('@angular/router/testing');
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url);
  harness.detectChanges();
  await harness.fixture.whenStable();
  harness.detectChanges();
  return { harness, router, el: harness.routeNativeElement as HTMLElement };
}

const tabs = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('[role="tab"]')];

describe('portfolio page tabs: Page / Enquiries', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('opens on Page with the unread count on the Enquiries tab, and does not load messages yet', async () => {
    const api = setup();
    const { el } = await open('/portfolio');
    const [page, enquiries] = tabs(el);
    expect(page.textContent).toContain('Page');
    expect(page.getAttribute('aria-selected')).toBe('true');
    expect(enquiries.querySelector('.tab__badge')?.textContent?.trim()).toBe('2');
    expect(enquiries.textContent).toContain('2 new');
    expect(api.portfolioEnquiries).not.toHaveBeenCalled();
  });

  it('the Enquiries tab lists the messages, marks them read and the count goes; the address keeps the tab', async () => {
    const api = setup();
    const { el, harness, router } = await open('/portfolio');
    tabs(el)[1].click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/portfolio?tab=enquiries');
    expect(api.portfolioEnquiries).toHaveBeenCalledTimes(1);
    expect(el.textContent).toContain('Aisha');
    expect(api.markPortfolioEnquiryRead).toHaveBeenCalledTimes(2);
    expect(tabs(el)[1].querySelector('.tab__badge')).toBeNull();
    // No page frame or back link of its own inside the tab.
    expect(el.querySelector('app-portfolio-enquiries app-back-link')).toBeNull();
  });

  it('the old /portfolio/enquiries address (push notifications) lands on the Enquiries tab', async () => {
    setup();
    const { el, router } = await open('/portfolio/enquiries');
    expect(router.url).toBe('/portfolio?tab=enquiries');
    expect(tabs(el)[1].getAttribute('aria-selected')).toBe('true');
    expect(el.textContent).toContain('Aisha');
  });
});
