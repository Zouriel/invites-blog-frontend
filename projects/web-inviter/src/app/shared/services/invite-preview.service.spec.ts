import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { ApiService } from '../api/api.service';
import { InvitePreviewService } from './invite-preview.service';

describe('InvitePreviewService ("View invite")', () => {
  afterEach(() => vi.restoreAllMocks());

  function setup(result: 'ok' | 'fail') {
    const tab = { opener: {} as unknown, closed: false, location: { href: '' }, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
    const previewLink = vi.fn(() =>
      result === 'ok' ? of({ url: 'https://me.invites.blog/h/preview/abc' }) : throwError(() => new Error('no')),
    );
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { previewLink } }] });
    return { tab, open, previewLink, sut: TestBed.inject(InvitePreviewService) };
  }

  it('opens the tab in the click, cut off from this page, then points it at the preview link', () => {
    const { tab, open, previewLink, sut } = setup('ok');
    sut.open('c1');
    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(tab.opener).toBeNull();
    expect(previewLink).toHaveBeenCalledWith('c1');
    expect(tab.location.href).toBe('https://me.invites.blog/h/preview/abc');
  });

  it('closes the blank tab when the server refuses', () => {
    const { tab, sut } = setup('fail');
    sut.open('c1');
    expect(tab.close).toHaveBeenCalled();
  });
});
