import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DemoEventStore, demoInterceptor } from '../../shared/demo/demo-event';
import { provideGuidanceStub } from '../../shared/guidance/guidance.testing';
import { DashboardComponent } from './dashboard.component';
import { DEMO_FIXTURE } from './demo.fixture';

/** Requests that reached the network and were about the example, or writes of any kind. (The visitor's
 *  country, /api/geo, is the app's own and has nothing to do with it.) */
function aboutTheExample(backend: HttpTestingController): string[] {
  return backend
    .match(() => true)
    .map((r) => r.request)
    .filter((r) => r.method !== 'GET' || r.urlWithParams.includes('de300000-'))
    .map((r) => `${r.method} ${r.urlWithParams}`);
}

async function mount() {
  TestBed.configureTestingModule({
    imports: [DashboardComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([demoInterceptor])),
      provideHttpClientTesting(),
      provideGuidanceStub({ inWelcome: true }),
    ],
  });
  TestBed.inject(DemoEventStore).event.set(DEMO_FIXTURE);
  const nav = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const backend = TestBed.inject(HttpTestingController);
  const f = TestBed.createComponent(DashboardComponent);
  f.componentRef.setInput('campaignId', DEMO_FIXTURE.campaign.id);
  f.componentRef.setInput('demo', true);
  document.body.appendChild(f.nativeElement);
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      f.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
  };
  await settle();
  return { f, el: f.nativeElement as HTMLElement, backend, settle, nav };
}

describe('the example event (dashboard in demo mode)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    TestBed.resetTestingModule();
  });

  it('draws the made-up wedding with its banner, from the demo response alone', async () => {
    const { el, backend } = await mount();
    expect(el.textContent).toContain('This is an example event.');
    expect(el.textContent).toContain('Nothing here is real.');
    expect(el.textContent).toContain('Aisha & Ibrahim');
    expect(el.textContent).toContain('Mariyam Hassan');
    expect(aboutTheExample(backend)).toEqual([]);
  });

  it('pressing every button sends nothing; the ones that would change it ask to start your own', async () => {
    const { el, backend, settle } = await mount();
    const buttons = [...el.querySelectorAll<HTMLElement>('button, a[href], input[type="checkbox"]')].filter(
      (b) => !b.closest('[role="tablist"]') && !b.closest('[data-demo-ok]'),
    );
    expect(buttons.length).toBeGreaterThan(5);
    for (const b of buttons) b.click();
    await settle();
    // Nothing reached the network: no write, and no read about the example either.
    expect(aboutTheExample(backend)).toEqual([]);
    expect(document.body.textContent).toContain('Start your own event');
  });

  // UI audit 2026-11-13: a Studio event said "Emailing guests isn't included on Free". The note names the event's own
  // plan (Studio, Photographer and Premium events include no emailed invitations either; only a pass does).
  it('names the event\'s own plan when emailing guests is not included', async () => {
    const { f } = await mount();
    const cmp = f.componentInstance as unknown as { passInfo: { set(v: unknown): void }; sendingPlanName(): string };
    const names: string[] = [];
    for (const plan of ['Free', 'Premium', 'Photographer', 'Venue']) {
      cmp.passInfo.set({ plan });
      names.push(cmp.sendingPlanName());
    }
    expect(names).toEqual(['Free', 'Premium', 'Photographer', 'Studio']);
    cmp.passInfo.set(null);
    expect(cmp.sendingPlanName()).toBe("this event's plan");
  });

  it('"Start your own" goes to a new event', async () => {
    const { el, nav } = await mount();
    const start = [...el.querySelectorAll<HTMLElement>('[data-demo-ok]')].find((b) => b.textContent?.includes('Start your own'))!;
    (start.querySelector('button') ?? start).click();
    expect(nav).toHaveBeenCalledWith(['/events/new']);
  });
});
