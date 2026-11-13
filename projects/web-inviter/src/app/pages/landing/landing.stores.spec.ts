import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BROWSER_LOCATION, HOST_CONFIG } from '../../shared/services/host-split';
import { SessionHandoffService } from '../../shared/services/session-handoff.service';
import { LandingComponent } from './landing.component';

describe('Landing: the stores row', () => {
  afterEach(() => TestBed.resetTestingModule());

  function mount() {
    const handoff = { goToApp: vi.fn(async (_n: string) => {}) };
    TestBed.configureTestingModule({
      imports: [LandingComponent],
      providers: [
        provideRouter([]),
        { provide: HOST_CONFIG, useValue: { siteOrigin: 'https://invites.blog', appOrigin: 'https://app.invites.blog' } },
        { provide: BROWSER_LOCATION, useValue: { origin: () => 'https://invites.blog', current: () => '/', assign: vi.fn(), replace: vi.fn() } },
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: SessionHandoffService, useValue: handoff },
      ],
    });
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, handoff };
  }

  it('beside the App Store badge: Google Play coming soon (not a link), the web app, and Instagram', () => {
    const { el, handoff } = mount();
    const band = el.querySelector('section.app')!;
    expect(band.querySelector('ui-store-badge')).not.toBeNull();

    const soon = band.querySelector('ui-chip')!;
    expect(soon.textContent).toContain('Google Play: coming soon');
    expect(soon.closest('a')).toBeNull();
    expect(soon.querySelector('a')).toBeNull();

    const insta = band.querySelector('ui-link a') as HTMLAnchorElement;
    expect(insta.getAttribute('href')).toBe('https://instagram.com/invites.blog');
    expect(insta.textContent).toContain('@invites.blog');
    expect(insta.querySelector('hugeicons-icon')).not.toBeNull();

    const browser = Array.from(band.querySelectorAll('ui-button')).find((b) => b.textContent?.includes('Use in browser')) as HTMLElement;
    (browser.querySelector('button') as HTMLButtonElement).click();
    expect(handoff.goToApp).toHaveBeenCalledWith('/feed');
  });
});
