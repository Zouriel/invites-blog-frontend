import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api/api.service';
import { MediaBucket } from '../utils/types/api.types';
import { BucketPanelComponent } from '../bucket-panel/bucket-panel.component';
import { BucketSettingsComponent } from './bucket-settings.component';

/** The panel above has its own calls and its own specs; this file is about the face switch. */
@Component({ selector: 'app-bucket-panel', template: '' })
class PanelStub {
  readonly bucketId = input<string>();
  readonly initial = input<unknown>();
  readonly plain = input<boolean>();
  readonly changed = output<MediaBucket>();
}

type Settings = {
  faceSwitch: () => boolean;
  askingFacesOn: () => boolean;
  askingFacesOff: () => boolean;
  guestsTold: boolean;
  faceFlipped: (on: boolean) => void;
  faceCancelled: () => void;
  saveFaces: (on: boolean) => void;
};

function mount(over: Partial<MediaBucket>) {
  const bucket = { id: 'b1', faceGrouping: false, faceGroupingAvailable: true, ...over } as MediaBucket;
  const api = {
    bucketAccess: vi.fn(() => of({ isRestricted: false, guests: [] })),
    setBucketFaceGrouping: vi.fn((_id: string, on: boolean) => of({ ...bucket, faceGrouping: on })),
  };
  TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }, provideRouter([])] });
  TestBed.overrideComponent(BucketSettingsComponent, { remove: { imports: [BucketPanelComponent] }, add: { imports: [PanelStub] } });
  const fixture = TestBed.createComponent(BucketSettingsComponent);
  fixture.componentRef.setInput('bucket', bucket);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  fixture.detectChanges();
  return { fixture, api, changed, el: fixture.nativeElement as HTMLElement, c: fixture.componentInstance as unknown as Settings };
}

describe('bucket settings: group by face', () => {
  it('is hidden when the album cannot offer it', () => {
    const { el } = mount({ faceGroupingAvailable: false });
    expect(el.textContent).not.toContain('Group photos by face');
  });

  it('shows the switch, and turning it on only asks until the box is ticked', () => {
    const { fixture, api, changed, c, el } = mount({});
    expect(el.textContent).toContain('Group photos by face');
    c.faceFlipped(true);
    fixture.detectChanges();
    expect(c.askingFacesOn()).toBe(true);
    expect(api.setBucketFaceGrouping).not.toHaveBeenCalled();
    // Not ticked: confirming does nothing.
    c.saveFaces(true);
    expect(api.setBucketFaceGrouping).not.toHaveBeenCalled();
    c.guestsTold = true;
    c.saveFaces(true);
    expect(api.setBucketFaceGrouping).toHaveBeenCalledWith('b1', true, true);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ faceGrouping: true }));
    expect(c.askingFacesOn()).toBe(false);
    expect(c.faceSwitch()).toBe(true);
  });

  it('puts the switch back when the confirm is cancelled', () => {
    const { api, c } = mount({});
    c.faceFlipped(true);
    expect(c.faceSwitch()).toBe(true);
    c.faceCancelled();
    expect(c.faceSwitch()).toBe(false);
    expect(api.setBucketFaceGrouping).not.toHaveBeenCalled();
  });

  it('asks before turning off, then sends off', () => {
    const { api, c, changed } = mount({ faceGrouping: true });
    expect(c.faceSwitch()).toBe(true);
    c.faceFlipped(false);
    expect(c.askingFacesOff()).toBe(true);
    expect(api.setBucketFaceGrouping).not.toHaveBeenCalled();
    c.saveFaces(false);
    expect(api.setBucketFaceGrouping).toHaveBeenCalledWith('b1', false, false);
    expect(changed).toHaveBeenCalledWith(expect.objectContaining({ faceGrouping: false }));
    expect(c.faceSwitch()).toBe(false);
  });
});
