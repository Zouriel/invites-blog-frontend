import { describe, expect, it } from 'vitest';
import type { DesignElement } from './scene';
import { resizeGroup } from './scene-ops';

const base = (id: string, extra: Partial<DesignElement>): DesignElement => ({
  id, type: 'shape', x: 0, y: 0, w: 10, h: 10, rotate: 0, scale: 1, opacity: 1, keyframes: [], ...extra,
});
const style = { size: 20, weight: 400, align: 'center' as const, valign: 'middle' as const, lineHeight: 1.2, letterSpacing: 0.05 };

describe('resizing a group', () => {
  const text = base('t', { type: 'text', x: 10, y: 20, w: 100, h: 40, text: { runs: [{ text: 'Hi' }], style } });
  const box = base('b', {
    x: 50, y: 60, w: 40, h: 30,
    shape: { kind: 'rect', sides: 6, fill: '#000', stroke: '#fff', strokeWidth: 2, radius: 6 },
    keyframes: [{ t: 0, x: 50, y: 80, blur: 4 }, { t: 1, y: 60 }],
    loop: { frames: [{ t: 0.5, dx: 4, dy: -10 }], repeat: 2, alternate: false },
  });
  const pill = base('p', { type: 'rsvp', x: 0, y: 100, w: 80, h: 30, button: { label: 'RSVP', strokeWidth: 1, radius: 999, style } });
  const inner = base('g2', { type: 'group', x: 100, y: 0, w: 50, h: 50, children: [base('c', { x: 10, y: 10, w: 20, h: 20 })] });
  const group = base('g', { type: 'group', x: 30, y: 40, w: 200, h: 150, children: [text, box, pill, inner] });

  it('grows everything in it, in proportion, keeping its own place on the page', () => {
    const g = resizeGroup(group, 400, 300);
    expect([g.x, g.y, g.w, g.h]).toEqual([30, 40, 400, 300]);
    const [t, b, p, g2] = g.children!;
    expect([t.x, t.y, t.w, t.h, t.text!.style.size]).toEqual([20, 40, 200, 80, 40]);
    expect(t.text!.style.letterSpacing).toBe(0.05); // in em: already follows the size
    expect([b.x, b.y, b.w, b.h, b.shape!.strokeWidth, b.shape!.radius]).toEqual([100, 120, 80, 60, 4, 12]);
    // Its motion moves twice as far, from twice as far along.
    expect(b.keyframes).toEqual([{ t: 0, x: 100, y: 160, blur: 8 }, { t: 1, y: 120 }]);
    expect(b.loop!.frames[0]).toMatchObject({ dx: 8, dy: -20 });
    expect([p.button!.style.size, p.button!.radius]).toEqual([40, 999]); // a pill stays a pill
    expect([g2.x, g2.w, g2.children![0].x, g2.children![0].w]).toEqual([200, 100, 20, 40]);
  });

  it('pulled one way, text follows the smaller stretch so it never overflows', () => {
    const g = resizeGroup(group, 400, 150);
    expect(g.children![0].text!.style.size).toBe(20);
    expect(g.children![0].w).toBe(200);
  });

  it('pulled out of proportion, stretches its fitted pictures and illustrations with it; in proportion, leaves them', () => {
    const gif = base('f', { type: 'image', w: 100, h: 100, image: { asset: 'a', fit: 'contain', radius: 0 } });
    const photo = base('ph', { type: 'image', w: 100, h: 100, image: { asset: 'a', fit: 'cover', radius: 0 } });
    const art = base('s', { type: 'svg', w: 100, h: 100, svg: { asset: 's', fills: {} } });
    const g = base('g', { type: 'group', w: 100, h: 100, children: [gif, photo, art] });
    const tall = resizeGroup(g, 100, 200).children!;
    expect(tall[0].image!.fit).toBe('stretch');
    expect(tall[1].image!.fit).toBe('cover'); // a filled photo crops, as photos do
    expect(tall[2].svg!.stretch).toBe(true);
    const even = resizeGroup(g, 200, 200).children!;
    expect([even[0].image!.fit, even[2].svg!.stretch]).toEqual(['contain', undefined]);
  });
});
