import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { MediaBucket, MediaBucketQr } from '../utils/types/api.types';
import { BucketPanelComponent } from './bucket-panel.component';

const code = {
  id: 'q1', url: null, cameraUrl: 'https://invites.blog/q/abc?camera=1', imageUrl: '/assets/q.png', label: null,
  allowAnonymous: true, tokenHint: 'abc', scanCount: 2, uploadCount: 1, revoked: false, lastUsedAt: null,
  createdAt: '2026-11-01T10:00:00Z',
} as unknown as MediaBucketQr;

function mount(over: Partial<MediaBucket>, codes: MediaBucketQr[] = [code]) {
  const bucket = {
    id: 'b1', campaignId: 'c1', name: 'Photos', isDefault: true, usedBytes: 0, capacityBytes: 1, itemCount: 0,
    tier: 'Free', windowDays: 1, maxWindowDays: 1, ...over,
  } as MediaBucket;
  const api = { mediaBucket: vi.fn(() => of(bucket)), mediaBucketQrs: vi.fn(() => of(codes)) };
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, provideRouter([])] });
  const fixture = TestBed.createComponent(BucketPanelComponent);
  fixture.componentRef.setInput('bucketId', 'b1');
  fixture.componentRef.setInput('initial', bucket);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('bucket panel: after the photo window', () => {
  it('shows one line instead of the code, its link, print, download and New code', () => {
    const el = mount({ windowClosed: true, windowClosesAt: '2026-08-29T19:00:00Z', timeZone: 'Indian/Maldives' });
    const line = el.querySelector('[data-window-closed]')?.textContent ?? '';
    expect(line).toContain('Photo window closed on');
    expect(line).toContain('Guests can still view the album.');
    expect(el.querySelector('.code__img')).toBeNull();
    expect(el.textContent).not.toContain('Print a table card');
    expect(el.textContent).not.toContain('Download code');
    expect(el.textContent).not.toContain('Copy link');
    expect(el.textContent).not.toContain('New code');
    expect(el.textContent).not.toContain('Make a QR code');
  });

  it('shows the code and its actions while the window is open or not yet open', () => {
    const el = mount({ windowClosed: false });
    expect(el.querySelector('[data-window-closed]')).toBeNull();
    expect(el.querySelector('.code__img')).not.toBeNull();
    expect(el.textContent).toContain('Print a table card');
    expect(el.textContent).toContain('New code');
  });

  it('a closed album with no code offers no way to make one', () => {
    const el = mount({ windowClosed: true, windowClosesAt: '2026-08-29T19:00:00Z' }, []);
    expect(el.textContent).not.toContain('Make a QR code');
  });
});
