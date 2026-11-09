import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore } from './design.store';
import { ToolOptionsBarComponent } from './tool-options-bar.component';

describe('Tool options bar', () => {
  let store: DesignStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
  });

  function render() {
    const fixture = TestBed.createComponent(ToolOptionsBarComponent);
    fixture.detectChanges();
    return fixture;
  }

  const button = (root: HTMLElement, label: string) =>
    [...root.querySelectorAll<HTMLButtonElement>('button')]
      .find((candidate) => candidate.getAttribute('aria-label') === label || candidate.textContent?.trim() === label)!;

  const segmentedLabels = (root: HTMLElement) =>
    [...root.querySelectorAll<HTMLElement>('ui-segmented [role="radiogroup"]')].map((group) => group.getAttribute('aria-label'));

  const slide = (root: HTMLElement, label: string, value: number) => {
    const input = root.querySelector<HTMLInputElement>(`input[type="range"][aria-label="${label}"]`)!;
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  it('shows only the Select hint when no drawing tool is picked, keeping its place so the canvas never moves', () => {
    const root = render().nativeElement as HTMLElement;
    expect(root.querySelector('[role="toolbar"]')).toBeNull();
    expect(root.querySelector('.bar.idle')?.textContent).toContain('pick a tool on the left');
  });

  it('shows shape tiles and choosing Star resets its variable settings', () => {
    store.drawTool.set({ type: 'shape' });
    store.drawStyle.update((style) => ({ ...style, shapeSides: 9, shapeAmount: 0.7 }));
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.kinds .kind').length).toBeGreaterThan(5);
    button(root, 'Star').click();
    fixture.detectChanges();
    expect(store.drawStyle()).toMatchObject({ shapeKind: 'star', shapeSides: null, shapeAmount: null });
  });

  it('hides Fill for a line', () => {
    store.drawTool.set({ type: 'shape' });
    store.drawStyle.update((style) => ({ ...style, shapeKind: 'line', stroke: null }));
    const root = render().nativeElement as HTMLElement;

    expect(root.querySelector('app-color-ref-field [role="group"][aria-label="Fill"]')).toBeNull();
    expect(root.querySelector('app-color-ref-field [role="group"][aria-label="Colour"]')).not.toBeNull();
  });

  it('shows outline width and style only when a non-line shape has an outline colour', () => {
    store.drawTool.set({ type: 'shape' });
    store.drawStyle.update((style) => ({ ...style, shapeKind: 'rect', stroke: null }));
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(segmentedLabels(root)).toEqual([]);

    store.drawStyle.update((style) => ({ ...style, stroke: '#123456' }));
    fixture.detectChanges();
    expect(root.querySelector('input[type="range"][aria-label="Width"]')).not.toBeNull();
    expect(segmentedLabels(root)).toEqual(['Style']);
  });

  it('offers a text size slider and sets it to 44', () => {
    store.drawTool.set({ type: 'text' });
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;

    expect(segmentedLabels(root)).toEqual([]);
    slide(root, 'Size', 44);
    fixture.detectChanges();
    expect(store.drawStyle().textSize).toBe(44);
  });

  it('cancels the drawing tool', () => {
    store.drawTool.set({ type: 'shape' });
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;

    button(root, 'Cancel').click();
    fixture.detectChanges();
    expect(store.drawTool()).toBeNull();
    expect(root.querySelector('[role="toolbar"]')).toBeNull();
  });
});
