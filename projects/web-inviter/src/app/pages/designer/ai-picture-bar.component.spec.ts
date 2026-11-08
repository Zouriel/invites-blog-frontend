import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiService } from '../../shared/api/api.service';
import { AiPictureBarComponent, resetAiPictureStatus } from './ai-picture-bar.component';
import { DesignStore } from './design.store';
import type { AiPictureStatus, ArtImport } from './model/scene';

const status = (extra: Partial<AiPictureStatus> = {}): AiPictureStatus =>
  ({ allowed: true, available: true, reason: null, used: 2, limit: 50, resetsAt: '2026-12-01T00:00:00Z', ...extra });

const lace = { name: 'Lace', width: 400, height: 100 } as ArtImport;

describe('Create with AI bar', () => {
  const aiPictureStatus = vi.fn();
  const createAiPicture = vi.fn();
  const placed = vi.fn();

  beforeEach(() => {
    resetAiPictureStatus();
    aiPictureStatus.mockReset();
    createAiPicture.mockReset();
    placed.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: { aiPictureStatus, createAiPicture } },
        { provide: DesignStore, useValue: { createAiPicture: (p: string, s: string) => { placed(p, s); return firstValueFrom(createAiPicture(p, s)); } } },
      ],
    });
  });
  afterEach(() => resetAiPictureStatus());

  async function render() {
    const fixture = TestBed.createComponent(AiPictureBarComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const text = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const button = (el: HTMLElement, label: string) =>
    [...el.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLButtonElement;

  it('stays hidden for accounts an admin has not allowed', async () => {
    aiPictureStatus.mockReturnValue(of(status({ allowed: false, available: false, reason: 'not_allowed' })));
    const el = (await render()).nativeElement as HTMLElement;
    expect(el.querySelector('section')).toBeNull();
  });

  it('stays hidden when the status cannot be read', async () => {
    aiPictureStatus.mockReturnValue(throwError(() => new Error('nope')));
    const el = (await render()).nativeElement as HTMLElement;
    expect(el.querySelector('section')).toBeNull();
  });

  it('shows the bar with what is left this month, and makes the picture described', async () => {
    aiPictureStatus.mockReturnValue(of(status()));
    createAiPicture.mockReturnValue(of(lace));
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(el)).toContain('Create with AI');
    expect(text(el)).toContain('48 of 50 pictures left this month');
    expect(button(el, 'Create').disabled).toBe(true);

    let added = 0;
    fixture.componentInstance.added.subscribe(() => added++);
    button(el, 'White lace border').click();
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('ui-segmented button:nth-child(3)')?.click();
    fixture.detectChanges();
    aiPictureStatus.mockReturnValue(of(status({ used: 3 })));
    button(el, 'Create').click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(placed).toHaveBeenCalledWith('White lace border', 'strip');
    expect(added).toBe(1);
    expect(text(el)).toContain('47 of 50 pictures left this month');
  });

  it('keeps a refusal on screen until it is dismissed', async () => {
    aiPictureStatus.mockReturnValue(of(status()));
    createAiPicture.mockReturnValue(throwError(() => new Error("That description didn't pass the picture maker's safety check — try different words.")));
    const fixture = await render();
    const el = fixture.nativeElement as HTMLElement;
    button(el, 'Gold wax seal').click();
    fixture.detectChanges();
    button(el, 'Create').click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(text(el)).toContain("didn't pass the picture maker's safety check");

    vi.useFakeTimers();
    vi.advanceTimersByTime(30_000);
    vi.useRealTimers();
    fixture.detectChanges();
    expect(text(el)).toContain("didn't pass the picture maker's safety check");

    button(el, 'OK').click();
    fixture.detectChanges();
    expect(text(el)).not.toContain('safety check');
  });

  it('says when this month is used up and does not offer Create', async () => {
    aiPictureStatus.mockReturnValue(of(status({ available: false, reason: 'limit', used: 50 })));
    const el = (await render()).nativeElement as HTMLElement;
    button(el, 'Satin ribbon bow').click();
    expect(text(el)).toContain('You’ve made this month’s 50 pictures');
    expect(button(el, 'Create').disabled).toBe(true);
  });
});

