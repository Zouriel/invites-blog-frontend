import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { FaceNoticeComponent } from './face-notice.component';

function mount(full: boolean) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(FaceNoticeComponent);
  fixture.componentRef.setInput('full', full);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('face notice', () => {
  it('shows one sentence and More on the page, then everything with a Privacy link', () => {
    const { fixture, el } = mount(false);
    expect(el.textContent).toContain('Photos here are grouped by face.');
    expect(el.textContent).not.toContain('numeric template');
    (el.querySelector('button.more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.textContent).toContain('numeric template of each face');
    expect(el.textContent).toContain('never shared or sold');
    expect(el.querySelector('a')!.getAttribute('href')).toBe('/privacy#faces');
  });

  it('shows everything at once in the opt-out sheet', () => {
    const { el } = mount(true);
    expect(el.textContent).toContain('The host turned this on.');
    expect(el.querySelector('button.more')).toBeNull();
  });
});
