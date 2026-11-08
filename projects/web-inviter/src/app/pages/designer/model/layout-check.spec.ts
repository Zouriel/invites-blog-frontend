import { describe, expect, it } from 'vitest';
import type { DesignElement, DesignScene } from './scene';
import { layoutIssues } from './layout-check';

const style = { size: 20, weight: 400, align: 'center' as const, valign: 'middle' as const, lineHeight: 1.2, letterSpacing: 0 };
const text = (id: string, extra: Partial<DesignElement> = {}): DesignElement => ({
  id, name: id, type: 'text', x: 40, y: 100, w: 300, h: 40, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  text: { runs: [{ text: id }], style }, ...extra,
});
const scene = (elements: DesignElement[], stage = true): DesignScene =>
  ({ schema: 3, canvas: {}, theme: [], fonts: [], roles: [], fields: [], assets: {}, stage, length: 1688, elements }) as unknown as DesignScene;
const codes = (s: DesignScene) => layoutIssues(s).map((i) => `${i.code}:${i.elementId}`);

describe('layout check', () => {
  it('is quiet about a tidy screen', () => {
    expect(layoutIssues(scene([text('Names', { y: 100 }), text('Date', { y: 200 })]))).toEqual([]);
  });

  it('finds things off the sides, partly off, and below the screen on a stage', () => {
    const s = scene([text('Gone', { x: 420, y: 400 }), text('Half', { x: 250, w: 300 }), text('Low', { y: 900, track: { start: 0, end: 844 } })]);
    expect(codes(s)).toEqual(['off_screen:Gone', 'partly_off_screen:Half', 'off_screen:Low']);
    expect(layoutIssues(s)[0].message).toBe('“Gone” is off the side of the screen (all screens).');
  });

  it('finds text on top of text while both show, but not when they show on different screens', () => {
    const a = text('Title', { track: { start: 0, end: 844 } });
    expect(codes(scene([a, text('Subtitle', { y: 110, track: { start: 0, end: 844 } })]))).toEqual(['text_overlap:Subtitle']);
    expect(codes(scene([a, text('Next page', { y: 110, track: { start: 844, end: 1688 } })]))).toEqual([]);
  });
});
