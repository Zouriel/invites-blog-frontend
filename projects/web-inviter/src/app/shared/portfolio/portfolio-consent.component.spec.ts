import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { PortfolioConsentComponent } from './portfolio-consent.component';

type Consent = { flip(on: boolean): void; askingOff: () => boolean; save(on: boolean): Promise<void> };

async function mount(studio: boolean, consented: boolean, inPortfolio = 3) {
  const api = {
    portfolioConsent: vi.fn(() => of({ consented, consentedAt: null, photosInPortfolio: inPortfolio })),
    portfolioUploaders: vi.fn(() => of({ consented, groups: [] })),
    setPortfolioConsent: vi.fn((_: string, on: boolean) => of({ consented: on, consentedAt: null, photosInPortfolio: on ? inPortfolio : 0 })),
  };
  TestBed.configureTestingModule({
    imports: [PortfolioConsentComponent],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: SessionStore, useValue: { isStudio: signal(studio) } }],
  });
  const fixture = TestBed.createComponent(PortfolioConsentComponent);
  fixture.componentRef.setInput('campaignId', 'ev-1');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, api, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Consent };
}

describe('portfolio consent in album settings', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows nothing, and asks nothing, for an account that is not Studio', async () => {
    const { api, el } = await mount(false, false);
    expect(api.portfolioConsent).not.toHaveBeenCalled();
    expect(el.textContent?.trim()).toBe('');
  });

  it('records the consent at once when switched on', async () => {
    const { api, c, el } = await mount(true, false);
    expect(el.textContent).toContain('agreed to its photos being shown in my portfolio');
    await c.flip(true);
    expect(api.setPortfolioConsent).toHaveBeenCalledWith('ev-1', true);
  });

  it('asks before switching off, saying how many photos will leave', async () => {
    const { api, c, fixture } = await mount(true, true, 3);
    c.flip(false);
    fixture.detectChanges();
    expect(c.askingOff()).toBe(true);
    expect(api.setPortfolioConsent).not.toHaveBeenCalled();
    expect(document.body.textContent + (fixture.nativeElement as HTMLElement).textContent).toContain('3 photos from this event will leave your portfolio');
    await c.save(false);
    expect(api.setPortfolioConsent).toHaveBeenCalledWith('ev-1', false);
  });
});
