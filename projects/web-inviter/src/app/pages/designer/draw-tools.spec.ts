import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiService } from '../../shared/api/api.service';
import { DEFAULT_DRAW_STYLE, DesignStore } from './design.store';
import { drawnBox } from './editor-canvas.component';
import type { DesignScene } from './model/scene';

const scene = (stage: boolean): DesignScene => ({
  schema: 3, canvas: {}, fonts: [], roles: [], fields: [], elements: [], assets: {}, stage, length: 4000,
  theme: [{ key: 'accent', label: 'Accent', value: '#b08d57' }, { key: 'text', label: 'Text', value: '#222222' }, { key: 'rose', label: 'Rose', value: '#c97b84' }],
}) as unknown as DesignScene;

/** Drawing a new element with a tool from the desktop rail: the drag becomes its box. */
describe('drawn box', () => {
  it('is the box between where the drag started and ended, whichever way it went', () => {
    expect(drawnBox({ x0: 100, y0: 200, x1: 40, y1: 120, shift: false }, false, 'rect')).toMatchObject({ x: 40, y: 120, w: 60, h: 80, line: null });
    expect(drawnBox({ x0: 10, y0: 10, x1: 70, y1: 30, shift: false }, false, 'rect')).toMatchObject({ x: 10, y: 10, w: 60, h: 20 });
  });

  it('Shift keeps a shape square, growing towards the pointer', () => {
    expect(drawnBox({ x0: 100, y0: 100, x1: 40, y1: 80, shift: true }, false, 'rect')).toMatchObject({ x: 40, y: 40, w: 60, h: 60 });
  });

  it('an oval draws as an oval', () => {
    expect(drawnBox({ x0: 0, y0: 0, x1: 50, y1: 20, shift: false }, false, 'ellipse').round).toBe(true);
  });

  it('a line is its two ends; Shift snaps it to 45° steps', () => {
    expect(drawnBox({ x0: 10, y0: 10, x1: 110, y1: 60, shift: false }, true, 'line').line).toEqual({ x1: 10, y1: 10, x2: 110, y2: 60 });
    const snapped = drawnBox({ x0: 0, y0: 0, x1: 100, y1: 8, shift: true }, true, 'line').line!;
    expect(snapped.y2).toBeCloseTo(0, 6);
    expect(snapped.x2).toBeCloseTo(Math.hypot(100, 8), 6);
  });
});

describe('DesignStore.addDrawn', () => {
  let store: DesignStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DesignStore, { provide: ApiService, useValue: {} }] });
    store = TestBed.inject(DesignStore);
  });

  it('makes the picked shape, in the drawn box, with the options bar’s fill and outline, and selects it', () => {
    store.scene.set(scene(true));
    store.playhead.set(500);
    store.drawStyle.set({ ...DEFAULT_DRAW_STYLE, shapeKind: 'star', fill: 'theme:rose', stroke: 'theme:text', strokeWidth: 4, dash: 'dashed' });
    const el = store.addDrawn('shape', { x: 40.4, y: 100, w: 120, h: 90 })!;
    expect(el).toMatchObject({ type: 'shape', name: 'Star', x: 40, w: 120, h: 90, rotate: 0 });
    expect(el.shape).toMatchObject({ kind: 'star', fill: 'theme:rose', stroke: 'theme:text', strokeWidth: 4, dash: 'dashed' });
    // On a stage a thing stays where it is on the screen.
    expect(el.y).toBe(100);
    expect(store.selection()).toEqual([el.id]);
    expect(store.scene()!.elements.map((e) => e.id)).toEqual([el.id]);
  });

  it('on a scrolling page, places it on the page where the screen shows it', () => {
    store.scene.set(scene(false));
    store.playhead.set(500);
    expect(store.addDrawn('shape', { x: 0, y: 100, w: 50, h: 50 })!.y).toBe(600);
  });

  it('no outline colour means no outline, whatever the width', () => {
    store.scene.set(scene(true));
    store.drawStyle.set({ ...DEFAULT_DRAW_STYLE, stroke: null, strokeWidth: 4 });
    expect(store.addDrawn('shape', { x: 0, y: 0, w: 50, h: 50 })!.shape).toMatchObject({ stroke: null, strokeWidth: 0, fill: 'theme:accent' });
  });

  it('a line lies along the drag: its length, its angle, centred between the ends', () => {
    store.scene.set(scene(true));
    store.drawStyle.set({ ...DEFAULT_DRAW_STYLE, shapeKind: 'line', stroke: 'theme:rose', strokeWidth: 3 });
    const el = store.addDrawn('shape', { x: 0, y: 0, w: 0, h: 0 }, { x1: 100, y1: 100, x2: 200, y2: 200 })!;
    expect(el.w).toBe(Math.round(Math.hypot(100, 100)));
    expect(el.rotate).toBe(45);
    // Positions are whole units, so the middle can be half a unit out.
    expect(Math.abs(el.x + el.w / 2 - 150)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(el.y + el.h / 2 - 150)).toBeLessThanOrEqual(0.5);
    expect(el.shape).toMatchObject({ kind: 'line', stroke: 'theme:rose', strokeWidth: 3, fill: null });
  });

  it('text takes the picked size and colour', () => {
    store.scene.set(scene(true));
    store.drawStyle.set({ ...DEFAULT_DRAW_STYLE, textSize: 44, textColor: 'theme:rose' });
    const el = store.addDrawn('text', { x: 20, y: 30, w: 300, h: 70 })!;
    expect(el.text!.style).toMatchObject({ size: 44, color: 'theme:rose' });
    expect(el).toMatchObject({ x: 20, y: 30, w: 300, h: 70 });
  });

  it("a theme colour this design doesn't have falls back to its accent", () => {
    store.scene.set(scene(true));
    store.drawStyle.set({ ...DEFAULT_DRAW_STYLE, fill: 'theme:gone' });
    expect(store.addDrawn('shape', { x: 0, y: 0, w: 50, h: 50 })!.shape!.fill).toBe('theme:accent');
  });
});
