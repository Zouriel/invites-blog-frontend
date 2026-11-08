import { describe, expect, it } from 'vitest';
import { flattenContour, pathBounds } from '@zouriel/ui/canvas';
import type { DesignElement, DesignScene } from './scene';
import { DEFAULTS, generate, generatedOf, mulberry32, regenerate, themeColors, type GeneratorOptions } from './generators';

const scene: DesignScene = {
  schema: 3, canvas: {},
  theme: [
    { key: 'bg', label: 'Background', value: '#ffffff' }, { key: 'text', label: 'Text', value: '#222222' },
    { key: 'accent', label: 'Accent', value: '#b08d57' }, { key: 'leaf', label: 'Leaf', value: '#5a7d4a' }, { key: 'heading-font', label: 'Heading', value: 'lora' },
  ],
  fonts: [], roles: [], fields: [], elements: [], assets: {},
};

const strip = (el: DesignElement): unknown => JSON.parse(JSON.stringify(el, (k, v) => (k === 'id' ? undefined : v)));

describe('generators', () => {
  it('a small explicit random generator: same seed, same numbers', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const xs = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(xs);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    // Fixed values, so a change to the generator (which would reshuffle every saved design) shows here.
    // Produced by running the reference mulberry32 in node (see the generator's source), not written by hand.
    expect(xs.map((x) => Math.round(x * 1e6))).toEqual([601104, 448291, 852466, 669734, 174814]);
    expect(mulberry32(43)()).not.toBe(xs[0]);
  });

  it('draws with the theme’s colours, never the page or text colour', () => {
    expect(themeColors(scene)).toEqual(['theme:accent', 'theme:leaf']);
  });

  for (const kind of ['scatter', 'blob', 'vine'] as const) {
    it(`${kind}: the same seed makes the same thing; another seed another`, () => {
      const a = generate(scene, DEFAULTS[kind], 7);
      expect(strip(generate(scene, DEFAULTS[kind], 7))).toEqual(strip(a));
      expect(strip(generate(scene, DEFAULTS[kind], 8))).not.toEqual(strip(a));
      expect(generatedOf(a)).toEqual({ options: DEFAULTS[kind], seed: 7 });
    });
  }

  it('scatter: the count asked for, sizes in range, spread over the area, theme colours', () => {
    for (const shape of ['dots', 'stars', 'hearts', 'confetti'] as const) {
      const g = generate(scene, { kind: 'scatter', shape, count: 30, minSize: 10, maxSize: 20, area: 'top' }, 3);
      expect(g.type).toBe('group');
      expect(g.children).toHaveLength(30);
      for (const c of g.children!) {
        expect(c.type).toBe('shape');
        expect(['theme:accent', 'theme:leaf']).toContain(c.shape!.fill);
        expect(Math.max(c.w, c.h)).toBeLessThanOrEqual(24.1);
        expect(Math.max(c.w, c.h)).toBeGreaterThanOrEqual(3.5);
        // Within the top band of the screen (centres; the group is in screen units).
        const cy = g.y + c.y + c.h / 2;
        expect(cy).toBeGreaterThanOrEqual(12 - 0.1);
        expect(cy).toBeLessThanOrEqual(280 + 0.1);
      }
    }
    // Evenly spread: no two dots of 24 sit on top of each other.
    const dots = generate(scene, { kind: 'scatter', shape: 'dots', count: 24, minSize: 8, maxSize: 8, area: 'screen' }, 11).children!;
    const centres = dots.map((d) => ({ x: d.x + 4, y: d.y + 4 }));
    let closest = Infinity;
    centres.forEach((a, i) => centres.slice(i + 1).forEach((b) => (closest = Math.min(closest, Math.hypot(a.x - b.x, a.y - b.y)))));
    expect(closest).toBeGreaterThan(30);
  });

  it('scatter round the edges keeps the middle clear', () => {
    const g = generate(scene, { kind: 'scatter', shape: 'dots', count: 40, minSize: 6, maxSize: 6, area: 'edges' }, 5);
    for (const c of g.children!) {
      const x = g.x + c.x + 3;
      const y = g.y + c.y + 3;
      expect(x > 70 && x < 320 && y > 150 && y < 694).toBe(false);
    }
  });

  it('blob: one smooth closed shape whose wobble grows with the setting', () => {
    const spread = (wobble: number) => {
      const el = generate(scene, { kind: 'blob', points: 8, wobble, size: 200 }, 9);
      expect(el.type).toBe('shape');
      expect(el.shape!.kind).toBe('path');
      const contour = el.shape!.path!.contours[0];
      expect(contour.closed).toBe(true);
      expect(contour.points).toHaveLength(8);
      // Smooth: every point has both handles, in line (no corners).
      for (const p of contour.points) {
        const a = Math.atan2(p.y - p.in!.y, p.x - p.in!.x);
        const b = Math.atan2(p.out!.y - p.y, p.out!.x - p.x);
        expect(Math.abs(Math.sin(a - b))).toBeLessThan(1e-3);
      }
      expect(Math.max(el.w, el.h)).toBeCloseTo(200, 0);
      const pts = flattenContour(contour, 12);
      const c = { x: el.shape!.path!.width / 2, y: el.shape!.path!.height / 2 };
      const r = pts.map((p) => Math.hypot(p.x - c.x, p.y - c.y));
      return Math.max(...r) / Math.min(...r);
    };
    expect(spread(0)).toBeLessThan(1.1);
    expect(spread(0.5)).toBeGreaterThan(spread(0.15));
  });

  it('vine: a stem with the leaves asked for, alternating sides, smaller towards the tip', () => {
    const g = generate(scene, { kind: 'vine', leaves: 8, curl: 0.5, length: 400, direction: 'up', leafSize: 40 }, 4);
    const [stem, ...leaves] = g.children!;
    expect(stem.shape).toMatchObject({ kind: 'path', fill: null, stroke: 'theme:accent' });
    expect(stem.shape!.path!.contours[0].closed).toBe(false);
    expect(leaves).toHaveLength(8);
    expect(leaves.every((l) => l.shape!.fill === 'theme:leaf')).toBe(true);
    expect(leaves[0].h).toBeGreaterThan(leaves[7].h);
    // Each leaf's stalk end sits on the stem, and neighbours point to opposite sides of it.
    const stemPts = flattenContour(stem.shape!.path!.contours[0], 16).map((p) => ({ x: p.x + stem.x, y: p.y + stem.y }));
    const base = (l: DesignElement) => {
      const a = (l.rotate * Math.PI) / 180;
      return { x: l.x + l.w / 2 - Math.sin(a) * l.h / 2, y: l.y + l.h / 2 + Math.cos(a) * l.h / 2 };
    };
    for (const l of leaves) {
      const b = base(l);
      const d = Math.min(...stemPts.map((p) => Math.hypot(p.x - b.x, p.y - b.y)));
      expect(d).toBeLessThan(6);
    }
    // Each leaf points off to one side of the stem (against the stem's direction where it grows from), the next to the other.
    const side = (l: DesignElement) => {
      const b = base(l);
      let j = 0;
      stemPts.forEach((p, k) => { if (Math.hypot(p.x - b.x, p.y - b.y) < Math.hypot(stemPts[j].x - b.x, stemPts[j].y - b.y)) j = k; });
      const t = { x: stemPts[Math.min(stemPts.length - 1, j + 1)].x - stemPts[Math.max(0, j - 1)].x, y: stemPts[Math.min(stemPts.length - 1, j + 1)].y - stemPts[Math.max(0, j - 1)].y };
      const a = (l.rotate * Math.PI) / 180;
      return Math.sign(t.x * -Math.cos(a) - t.y * Math.sin(a));
    };
    const sides = leaves.map(side);
    expect(sides.every((v) => v !== 0)).toBe(true);
    sides.slice(1).forEach((v, i) => expect(v).toBe(-sides[i]));
    // A curlier vine bends further from a straight line.
    const sideways = (curl: number) => {
      const s = generate(scene, { ...DEFAULTS.vine, curl }, 4).children![0];
      return pathBounds(s.shape!.path!.contours)!.w;
    };
    expect(sideways(0.9)).toBeGreaterThan(sideways(0.08) * 2);
  });

  it('vine grows the way asked', () => {
    const up = generate(scene, { ...DEFAULTS.vine, curl: 0.05, direction: 'up' }, 2);
    const across = generate(scene, { ...DEFAULTS.vine, curl: 0.05, direction: 'across' }, 2);
    expect(up.h).toBeGreaterThan(up.w * 2);
    expect(across.w).toBeGreaterThan(across.h * 2);
  });

  it('Shuffle makes it again where it was moved to, keeping what was set on it', () => {
    const blob = generate(scene, DEFAULTS.blob, 1);
    const moved = { ...blob, x: blob.x + 50, y: blob.y + 900, w: 300, h: 150, name: 'Backdrop', shape: { ...blob.shape!, fill: '#ff0000' } };
    const again = regenerate(scene, moved, { seed: 2 })!;
    expect(again).toMatchObject({ x: moved.x, y: moved.y, w: 300, h: 150, name: 'Backdrop', id: blob.id });
    expect(again.shape!.fill).toBe('#ff0000');
    expect(again.shape!.path).not.toEqual(blob.shape!.path);
    expect(generatedOf(again)!.seed).toBe(2);

    const vine = generate(scene, DEFAULTS.vine, 1);
    const placed = { ...vine, x: vine.x - 40, y: vine.y + 1000, opacity: 0.6 };
    const options: GeneratorOptions = { ...DEFAULTS.vine, leaves: 4 };
    const changed = regenerate(scene, placed, { options })!;
    expect(changed.children).toHaveLength(5);
    expect(changed.opacity).toBe(0.6);
    // Same seed, fewer leaves: the frame it was made in moved with it.
    const fresh = generate(scene, options, 1);
    expect(changed.x).toBeCloseTo(fresh.x - 40, 1);
    expect(changed.y).toBeCloseTo(fresh.y + 1000, 1);
    expect(regenerate(scene, { ...vine, recipe: null }, { seed: 3 })).toBeNull();
    expect(regenerate(scene, vine, { options: DEFAULTS.blob })).toBeNull();
  });

  it('reads back nothing from a sticker or a bad recipe, and clamps silly options', () => {
    const el = generate(scene, DEFAULTS.scatter, 1);
    expect(generatedOf({ ...el, recipe: { id: 'petals', seed: 1 } })).toBeNull();
    expect(generatedOf({ ...el, recipe: { id: 'gen:{oops', seed: 1 } })).toBeNull();
    const big = generate(scene, { kind: 'scatter', shape: 'dots', count: 5000, minSize: 30, maxSize: 2, area: 'screen' }, 1);
    expect(big.children).toHaveLength(120);
    expect(big.children!.every((c) => c.w >= 30)).toBe(true);
  });
});
