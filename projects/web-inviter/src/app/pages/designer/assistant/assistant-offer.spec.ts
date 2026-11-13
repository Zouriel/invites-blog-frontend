import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { EMPTY } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { CheckoutFlow } from '../../../shared/checkout/checkout-flow.service';
import { SessionStore } from '../../../shared/services/session.store';
import { AssistantPanelComponent } from './assistant-panel.component';
import { DesignAssistant } from './design-assistant';

/** The Ask AI tab when the account may not use it (docs/PRICING-2026-11.md §3). */
function mount(reason: 'addon' | 'premium') {
  const assistant = {
    load: vi.fn(async () => {}), loadError: signal(null), loaded: signal(true), allowed: signal(false), messages: signal([]), working: signal(false),
    status: signal({ allowed: false, reason, usedUsd: 0, allowanceUsd: 5, resetsAt: '2026-12-01T00:00:00Z' }),
  };
  TestBed.configureTestingModule({
    imports: [AssistantPanelComponent],
    providers: [
      provideRouter([]),
      { provide: DesignAssistant, useValue: assistant },
      { provide: CheckoutFlow, useValue: { start: vi.fn(() => EMPTY), review: signal(null) } },
      { provide: UiToastService, useValue: { info: vi.fn() } },
      { provide: SessionStore, useValue: { isSignedIn: signal(true), isPremium: signal(false), account: signal({ id: 'me', subscriptionTier: 'None' }) } },
    ],
  });
  const fixture = TestBed.createComponent(AssistantPanelComponent);
  fixture.detectChanges();
  return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
}

describe('Ask AI offer', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('on Premium without it ("addon"): offers to add the AI designer, MVR 77 a month', () => {
    const text = mount('addon');
    expect(text).toContain('Add the AI designer');
    expect(text).toContain('Add it to your Premium for MVR 77 a month');
  });

  it('anyone else ("premium"): offers Premium with the AI designer', () => {
    const text = mount('premium');
    expect(text).toContain('Get Premium with the AI designer');
    expect(text).toContain('an add-on to Premium');
  });
});
