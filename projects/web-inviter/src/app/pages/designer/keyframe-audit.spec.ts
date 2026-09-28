import { describe, it } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { compile, normalizeScene, type RenderCatalog } from './render';
import type { DesignElement, DesignScene, MotionPreset } from './model/scene';
import { effectAt, findElement, pinOffsetAt, pivotShift, placeAt, scrollRange, stateAt, trackOf, visibleAt } from './model/scene-ops';
import { keyframeScroll, retimeTrack, tOn, withPreset } from './model/keyframe-timing';
import { EFFECT_MOVES, applyMove } from './model/effect-moves';

/**
 * The keyframe audit: does the page show, at each keyframe's place in the scroll, what that keyframe
 * says? Builds scenes the way the editor does (presets, effect moves, keyframes placed at the playhead,
 * bars trimmed, split text) and writes each compiled page with what the editor's model expects at every
 * keyframe and between them. `render/testing/keyframe-audit.mjs` loads them in a real browser — with
 * scroll-driven animations and with the old-browser script — and compares.
 *
 * <p>Runs only when asked: `KEYFRAME_AUDIT_OUT=<file>`.</p>
 */

const FIXTURES = 'projects/web-inviter/src/app/pages/designer/render/testing/parity-fixtures.json.gz';
type Catalog = RenderCatalog & { enterPresets: MotionPreset[]; exitPresets: MotionPreset[] };

interface Expect { opacity: number; cx?: number; cy?: number; blur?: number }
interface Sample { scroll: number; sel: string; pieces?: boolean; what: string; expect: Expect }
interface Case { name: string; html: string; samples: Sample[] }

const theme = [
  { key: 'accent', label: 'Accent', value: '#8c2f39' }, { key: 'bg', label: 'Bg', value: '#ffffff' },
  { key: 'text', label: 'Text', value: '#222222' }, { key: 'gold', label: 'Gold', value: '#c9a45c' },
  { key: 'heading-font', label: 'Heading', value: 'playfair-display' }, { key: 'body-font', label: 'Body', value: 'inter' },
];
const blankScene = (stage: boolean, elements: DesignElement[]): DesignScene =>
  ({ schema: 3, canvas: {}, theme, fonts: [], roles: [], fields: [], elements, assets: {}, stage, length: 4000 });
const shape = (id: string, y: number): DesignElement => ({
  id, type: 'shape', x: 110, y, w: 170, h: 110, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  shape: { kind: 'rect', sides: 6, fill: 'theme:accent', stroke: 'theme:gold', strokeWidth: 3, radius: 0 },
});
const text = (id: string, y: number, words = 'Save the date for us'): DesignElement => ({
  id, type: 'text', x: 20, y, w: 350, h: 90, rotate: 0, scale: 1, opacity: 1, keyframes: [],
  text: { runs: [{ text: words }], style: { font: 'theme:heading-font', size: 30, weight: 600, color: 'theme:text', align: 'center', valign: 'middle', lineHeight: 1.2, letterSpacing: 0 } },
});

function load(): Catalog {
  const path = existsSync(FIXTURES) ? FIXTURES : FIXTURES.replace(/^projects\/web-inviter\//, '');
  return JSON.parse(gunzipSync(readFileSync(path)).toString('utf8')).catalog;
}

/** What the editor's model says the page shows for a top-level element at a scroll position. */
function expected(scene: DesignScene, el: DesignElement, scroll: number): Expect {
  const s = stateAt(scene, el, scroll);
  const opacity = visibleAt(scene, el, scroll) ? s.opacity : 0;
  const frames = el.keyframes;
  // Where the box is: only checked when nothing bends it out of its rectangle.
  const flat = !frames.some((k) => k.rotateX || k.rotateY || k.skewX || k.skewY) && !el.loop;
  const out: Expect = { opacity };
  if (flat && opacity > 0.02) {
    const p = pivotShift(el, s);
    out.cx = s.x + el.w / 2 + p.x;
    out.cy = s.y + el.h / 2 + p.y + pinOffsetAt(scene, el, scroll) - scroll;
  }
  if (frames.some((k) => k.blur != null)) out.blur = effectAt(scene, el, 'blur', scroll);
  return out;
}

/** Samples at every keyframe, halfway between each pair, and just outside the bar. */
function samplesFor(scene: DesignScene, index: number, el: DesignElement): Sample[] {
  const track = trackOf(scene, el);
  const sel = `.e${index}`;
  const split = el.type === 'text' && !!el.text?.split && el.keyframes.length > 0;
  const at = [...new Set(el.keyframes.map((k) => keyframeScroll(track, k.t)))].sort((a, b) => a - b);
  const out: Sample[] = [];
  const add = (scroll: number, what: string) => {
    const s = Math.round(scroll);
    if (s < 0 || s > scrollRange(scene)) return;
    out.push({ scroll: s, sel, pieces: split, what, expect: expected(scene, el, s) });
  };
  at.forEach((a, i) => {
    add(a, `keyframe ${i + 1} (at ${Math.round(a)})`);
    // Split text is only claimed exact at keyframes, where every piece has arrived or not yet left.
    if (!split && i + 1 < at.length && at[i + 1] - a > 8) add((a + at[i + 1]) / 2, `between keyframes ${i + 1} and ${i + 2}`);
  });
  if (scene.stage && el.track) {
    add(track.start - 3, 'just before its bar');
    add(track.end - 1, 'the last unit of its bar');
    add(track.end, 'the end of its bar');
  }
  add(scrollRange(scene), 'the bottom of the page');
  return out;
}

function caseOf(name: string, scene: DesignScene, catalog: Catalog): Case {
  const html = compile(normalizeScene(scene), catalog, { fontBaseUrl: '/f/' });
  const samples = scene.elements.flatMap((el, i) => (el.keyframes.length || el.track ? samplesFor(scene, i, el) : []));
  return { name, html, samples };
}

describe('keyframe audit export', () => {
  it('writes the audit pages when asked', () => {
    const out = process.env['KEYFRAME_AUDIT_OUT'];
    if (!out) return;
    const catalog = load();
    const cases: Case[] = [];
    const stageBar = { start: 300, end: 2600 };

    // 1. Every way in and way out, on a scrolling page and on a stage.
    for (const stage of [false, true]) {
      for (const slot of ['enter', 'exit'] as const) {
        const list = slot === 'enter' ? catalog.enterPresets : catalog.exitPresets;
        for (const p of list) {
          const el = p.only === 'text' || p.split ? text('a', stage ? 300 : 1500) : shape('a', stage ? 300 : 1500);
          const scene = blankScene(stage, [el]);
          scene.elements = [withPreset(scene, el, p, slot, list, stageBar)];
          cases.push(caseOf(`${slot}-${p.id}-${stage ? 'stage' : 'page'}`, scene, catalog));
        }
      }
    }

    // 2. In and out together, then the bar trimmed both ways: the ways in and out keep their length at their ends.
    const pairs: [string, string][] = [['fade', 'fade'], ['rise', 'sink'], ['zoom-in', 'zoom-out'], ['word-fade', 'fade'], ['letter-rise', 'fade-up'], ['blur-in', 'blur-out']];
    for (const stage of [false, true]) {
      for (const [i, o] of pairs) {
        const pin = catalog.enterPresets.find((p) => p.id === i)!;
        const pout = catalog.exitPresets.find((p) => p.id === o)!;
        const el0 = pin.split || pin.only === 'text' ? text('a', stage ? 300 : 1500) : shape('a', stage ? 300 : 1500);
        let scene = blankScene(stage, [el0]);
        let el = withPreset(scene, el0, pin, 'enter', catalog.enterPresets, stageBar);
        el = withPreset({ ...scene, elements: [el] }, el, pout, 'exit', catalog.exitPresets, stageBar);
        scene = { ...scene, elements: [el] };
        cases.push(caseOf(`pair-${i}-${o}-${stage ? 'stage' : 'page'}`, scene, catalog));
        const t = trackOf(scene, el);
        const longer = retimeTrack(scene, el, { start: t.start, end: t.end + 700 }).element;
        cases.push(caseOf(`pair-${i}-${o}-${stage ? 'stage' : 'page'}-longer`, { ...scene, elements: [longer] }, catalog));
        const shorter = retimeTrack(scene, el, { start: t.start + 100, end: t.end - 150 }).element;
        cases.push(caseOf(`pair-${i}-${o}-${stage ? 'stage' : 'page'}-shorter`, { ...scene, elements: [shorter] }, catalog));
      }
    }

    // 3. Every effect move, from the playhead.
    for (const stage of [false, true]) {
      for (const m of EFFECT_MOVES) {
        const el = m.only === 'text' ? text('a', 300) : shape('a', stage ? 300 : 900);
        const scene = applyMove(blankScene(stage, [el]), 'a', m, 500, 360);
        cases.push(caseOf(`move-${m.id}-${stage ? 'stage' : 'page'}`, scene, catalog));
      }
    }

    // 4. Keyframes placed by hand at the playhead, as the canvas does: here, moved there, faded and grown later.
    for (const stage of [false, true]) {
      const el0 = shape('a', stage ? 300 : 900);
      let scene = blankScene(stage, [el0]);
      const track = { start: 0, end: 4000 };
      let el: DesignElement = { ...el0, track, keyframes: [{ t: tOn(track, 400), x: el0.x, y: el0.y, rotate: 0, scale: 1, opacity: 1 }] };
      scene = { ...scene, elements: [el] };
      el = placeAt(scene, el, 900, { x: 40, rotate: 30 }).element;
      scene = { ...scene, elements: [el] };
      el = placeAt(scene, el, 1500, { opacity: 0.25, scale: 1.5 }).element;
      scene = { ...scene, elements: [el] };
      el = placeAt(scene, el, 1501, { x: 60 }).element; // a unit on: the same keyframe
      scene = { ...scene, elements: [el] };
      cases.push(caseOf(`hand-${stage ? 'stage' : 'page'}`, scene, catalog));
      // Trimming its bar leaves every keyframe where it was.
      const trimmed = retimeTrack(scene, el, { start: 200, end: 1800 }).element;
      cases.push(caseOf(`hand-${stage ? 'stage' : 'page'}-trimmed`, { ...scene, elements: [trimmed] }, catalog));
    }

    // 5. Split text: words and letters, in and out with a change between, and a lone guest name.
    for (const stage of [false, true]) {
      for (const by of ['word', 'letter'] as const) {
        const el0 = { ...text('a', stage ? 300 : 1200), track: { start: 400, end: 1600 } };
        const t = el0.track;
        const el: DesignElement = {
          ...el0,
          text: { ...el0.text!, split: { by, stagger: 0.6 } },
          keyframes: [
            { t: tOn(t, 400), opacity: 0, y: el0.y + 40, easing: 'ease-out' }, { t: tOn(t, 650), opacity: 1, y: el0.y },
            { t: tOn(t, 1000), scale: 1 }, { t: tOn(t, 1150), scale: 1.3 },
            { t: tOn(t, 1400), opacity: 1, easing: 'ease-in' }, { t: tOn(t, 1600), opacity: 0 },
          ],
        };
        cases.push(caseOf(`split-${by}-${stage ? 'stage' : 'page'}`, blankScene(stage, [el]), catalog));
      }
    }

    writeFileSync(out, JSON.stringify(cases));
  });
});
