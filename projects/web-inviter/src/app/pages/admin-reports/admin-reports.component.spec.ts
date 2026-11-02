import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { AdminContentReport } from '../../shared/utils/types/api.types';
import { AdminReportsComponent } from './admin-reports.component';

// jsdom has no ResizeObserver; ui-textarea watches its own size with one.
globalThis.ResizeObserver ??= class {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
} as unknown as typeof ResizeObserver;

const report = (over: Partial<AdminContentReport> = {}): AdminContentReport => ({
  id: 'r-1', kind: 'comment', targetId: 'c-1', campaignId: 'camp-1', eventTitle: 'Celebration Gala', reason: 'hateful',
  note: 'Slurs', snapshot: 'old words', status: 'Open', resolution: null, resolutionNote: null, createdAt: '2026-11-02T10:00:00Z',
  resolvedAt: null, reporterName: 'Reviewer', reporterEmail: 'r@example.com', subjectUserId: 'u-2', subjectName: 'Sample Guest',
  subjectEmail: 'g@example.com', subjectActive: true, currentText: 'the words now', currentImageUrl: null, itemGone: false,
  reportCount: 3, ...over,
});

async function mount(list: AdminContentReport[]) {
  const api = {
    contentReports: vi.fn(() => of(list)),
    resolveContentReport: vi.fn(() => of(list[0])),
    setUserSuspended: vi.fn(() => of(null)),
  };
  TestBed.configureTestingModule({
    imports: [AdminReportsComponent],
    providers: [provideRouter([]), { provide: ApiService, useValue: api }, { provide: UiToastService, useValue: { success: vi.fn(), danger: vi.fn() } }],
  });
  const fixture = TestBed.createComponent(AdminReportsComponent);
  const settle = async () => {
    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r));
    }
  };
  await settle();
  const el = fixture.nativeElement as HTMLElement;
  const button = (label: string) =>
    Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label) as HTMLButtonElement;
  return { fixture, api, el, settle, button, text: () => el.textContent ?? '' };
}

describe('AdminReportsComponent', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('shows what was reported, why, by whom, whose it is and how many reports', async () => {
    const { api, text } = await mount([report()]);
    expect(api.contentReports).toHaveBeenCalledWith('open');
    for (const s of ['Comment', 'Hateful', 'Celebration Gala', 'Slurs', 'the words now', 'Reviewer', 'Sample Guest', 'Active', '3 reports']) {
      expect(text()).toContain(s);
    }
  });

  it('shows the snapshot once the item is gone, and offers no Remove', async () => {
    const { text, el } = await mount([report({ itemGone: true, currentText: null })]);
    expect(text()).toContain('When it was reported:');
    expect(text()).toContain('old words');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Remove for everyone'))).toBe(false);
  });

  it('removes for everyone only after confirming, with the note', async () => {
    const { api, button, fixture, settle } = await mount([report()]);
    (fixture.componentInstance as unknown as { notes: Record<string, string> }).notes['r-1'] = 'gone';
    button('Remove for everyone').click();
    await settle();
    expect(api.resolveContentReport).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Remove this comment for everyone?');
    button('Remove').click();
    await settle();
    expect(api.resolveContentReport).toHaveBeenCalledWith('r-1', 'remove', 'gone');
    expect(api.contentReports).toHaveBeenCalledTimes(2);
  });

  it('dismisses without a confirm', async () => {
    const { api, button, settle } = await mount([report()]);
    button('Dismiss').click();
    await settle();
    expect(api.resolveContentReport).toHaveBeenCalledWith('r-1', 'dismiss', null);
  });

  it('suspends after confirming, and offers Reinstate for a suspended account', async () => {
    const { api, button, settle } = await mount([report()]);
    button('Suspend account').click();
    await settle();
    expect(api.setUserSuspended).not.toHaveBeenCalled();
    button('Suspend').click();
    await settle();
    expect(api.setUserSuspended).toHaveBeenCalledWith('u-2', true);
    TestBed.resetTestingModule();

    const second = await mount([report({ subjectActive: false })]);
    expect(second.text()).toContain('Suspended');
    second.button('Reinstate account').click();
    await second.settle();
    second.button('Reinstate').click();
    await second.settle();
    expect(second.api.setUserSuspended).toHaveBeenCalledWith('u-2', false);
  });

  it('loads the tab picked: Resolved, then All', async () => {
    const { api, fixture, settle } = await mount([]);
    const cmp = fixture.componentInstance as unknown as { setTab: (i: number) => void };
    cmp.setTab(1);
    await settle();
    cmp.setTab(2);
    await settle();
    expect(api.contentReports.mock.calls.map((c) => (c as unknown[])[0])).toEqual(['open', 'resolved', 'all']);
  });
});
