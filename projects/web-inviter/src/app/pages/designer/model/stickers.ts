import { REFERENCE_VIEWPORT, type DesignElement, type DesignLoop, type DesignPath, type DesignScene } from './scene';
import { newId, round } from './scene-ops';
import { seeded } from './motion-tools';

/**
 * Sticker groups: ready-made animated compositions — falling petals, a confetti burst, twinkling
 * stars, doors that swing open. Each one is a group of ordinary elements with ordinary keyframes and
 * loops, so after it's dropped in the designer can ungroup it and change anything. Layouts come from a
 * seed; the group remembers its recipe and seed so Shuffle can lay it out again.
 *
 * Colours come from the design's own theme (never fixed hex), so a sticker matches the page it lands on.
 */
export interface StickerRecipe {
  id: string;
  label: string;
  description: string;
  build: (ctx: RecipeContext) => DesignElement[];
  /** Pinned while it plays (doors, curtains). */
  pinned?: boolean;
}

export interface RecipeContext {
  rnd: () => number;
  /** Top of the screen the sticker is placed on, in page units. */
  top: number;
  /** Theme colour references to draw with, best first. */
  colors: string[];
  text: string;
  bg: string;
}

const W = 390;
const H = REFERENCE_VIEWPORT;

// ----- Outlines ----------------------------------------------------------------------------------

const P = (x: number, y: number, inn?: [number, number], out?: [number, number]) => ({
  x, y, ...(inn ? { in: { x: inn[0], y: inn[1] } } : {}), ...(out ? { out: { x: out[0], y: out[1] } } : {}),
});

const PETAL: DesignPath = { width: 100, height: 100, contours: [{ closed: true, points: [P(50, 0, [5, 35], [95, 35]), P(50, 100, [95, 75], [5, 75])] }] };
const HEART: DesignPath = {
  width: 100, height: 100,
  contours: [{ closed: true, points: [P(50, 95, [90, 65], [10, 65]), P(25, 20, [0, 35], [40, 10]), P(50, 30, [50, 20], [50, 20]), P(75, 20, [60, 10], [100, 35])] }],
};
const SPARKLE: DesignPath = {
  width: 100, height: 100,
  contours: [{ closed: true, points: [P(50, 0), P(60, 40), P(100, 50), P(60, 60), P(50, 100), P(40, 60), P(0, 50), P(40, 40)] }],
};
const CHEVRON: DesignPath = { width: 100, height: 50, contours: [{ closed: false, points: [P(0, 0), P(50, 45), P(100, 0)] }] };
const STRING: DesignPath = { width: 20, height: 100, contours: [{ closed: false, points: [P(10, 0, undefined, [0, 30]), P(10, 100, [20, 70])] }] };

// ----- Builders ----------------------------------------------------------------------------------

function base(type: DesignElement['type'], x: number, y: number, w: number, h: number, name: string): DesignElement {
  return { id: newId(), type, name, x: round(x, 1), y: round(y, 1), w: round(w, 1), h: round(h, 1), rotate: 0, scale: 1, opacity: 1, track: null, keyframes: [] };
}

function path(x: number, y: number, w: number, h: number, outline: DesignPath, fill: string | null, name: string, stroke: string | null = null, strokeWidth = 0): DesignElement {
  const el = base('shape', x, y, w, h, name);
  el.shape = { kind: 'path', sides: 6, fill, stroke, strokeWidth, radius: 0, path: structuredClone(outline) };
  return el;
}

function shape(kind: 'rect' | 'ellipse' | 'polygon', x: number, y: number, w: number, h: number, fill: string, name: string, extra: { radius?: number; sides?: number } = {}): DesignElement {
  const el = base('shape', x, y, w, h, name);
  el.shape = { kind, sides: extra.sides ?? 6, fill, stroke: null, strokeWidth: 0, radius: extra.radius ?? 0 };
  return el;
}

const between = (rnd: () => number, a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(rnd: () => number, list: T[]) => list[Math.floor(rnd() * list.length)];

function loop(preset: string, frames: DesignLoop['frames'], repeat: number, alternate = false): DesignLoop {
  return { preset, strength: 1, repeat, alternate, frames };
}

const sway = (deg: number, repeat: number): DesignLoop => loop('sway', [{ t: 0, rotate: -deg, easing: 'ease-in-out' }, { t: 1, rotate: deg }], repeat, true);
const float = (px: number, repeat: number): DesignLoop => loop('float', [{ t: 0, easing: 'ease-in-out' }, { t: 0.5, dy: -px, easing: 'ease-in-out' }, { t: 1 }], repeat);
const twinkle = (repeat: number): DesignLoop =>
  loop('twinkle', [{ t: 0, scale: 0.8, opacity: 0.3, easing: 'ease-in-out' }, { t: 0.5, scale: 1.2, easing: 'ease-in-out' }, { t: 1, scale: 0.8, opacity: 0.3 }], repeat);
const flicker = (repeat: number): DesignLoop =>
  loop('flicker', [{ t: 0 }, { t: 0.1, opacity: 0.6 }, { t: 0.2 }, { t: 0.35, opacity: 0.8 }, { t: 0.5 }, { t: 0.7, opacity: 0.7 }, { t: 0.8 }, { t: 1 }], repeat);

/** The scroll over which the screen the sticker sits on comes up, stays, and goes. */
const onScreen = (ctx: RecipeContext, spread = 0) => {
  const start = Math.max(0, Math.round(ctx.top - H * 0.6 + spread));
  return { start, end: start + Math.round(H * 1.5) };
};

// ----- Recipes -----------------------------------------------------------------------------------

export const STICKERS: StickerRecipe[] = [
  {
    id: 'petals', label: 'Falling petals', description: 'Petals drift down the screen, turning as they fall.',
    build: (ctx) => Array.from({ length: 12 }, (_, i) => {
      const size = between(ctx.rnd, 16, 30);
      const x = between(ctx.rnd, 0, W - size);
      const y = between(ctx.rnd, -120, 60);
      const el = path(x, y, size, size * 1.4, PETAL, pick(ctx.rnd, ctx.colors), `Petal ${i + 1}`);
      el.rotate = round(between(ctx.rnd, -60, 60), 1);
      el.opacity = round(between(ctx.rnd, 0.7, 1), 2);
      const t = onScreen(ctx, between(ctx.rnd, 0, 260));
      el.track = t;
      el.keyframes = [
        { t: 0, opacity: 0 },
        { t: 0.1, opacity: el.opacity },
        { t: 1, x: round(x + between(ctx.rnd, -70, 70), 1), y: round(y + H * 0.95, 1), rotate: round(el.rotate + between(ctx.rnd, 120, 260), 1), opacity: 0 },
      ];
      el.loop = sway(round(between(ctx.rnd, 12, 22), 1), 4);
      return el;
    }),
  },
  {
    id: 'confetti', label: 'Confetti burst', description: 'Confetti bursts out from the middle, then falls away.',
    build: (ctx) => Array.from({ length: 26 }, (_, i) => {
      const kind = pick(ctx.rnd, ['rect', 'ellipse', 'polygon'] as const);
      const size = between(ctx.rnd, 8, 18);
      const cx = W / 2 - size / 2;
      const cy = H / 2 - size / 2;
      const angle = (i / 26) * Math.PI * 2 + between(ctx.rnd, -0.2, 0.2);
      const dist = between(ctx.rnd, 110, 220);
      const el = shape(kind, cx, cy, size, kind === 'rect' ? size * 0.5 : size, pick(ctx.rnd, ctx.colors), `Confetti ${i + 1}`, { radius: 2, sides: 3 });
      el.track = { start: Math.max(0, Math.round(ctx.top - 520)), end: Math.round(ctx.top + 500) };
      const ox = round(cx + Math.cos(angle) * dist, 1);
      const oy = round(cy + Math.sin(angle) * dist, 1);
      el.keyframes = [
        { t: 0, scale: 0.2, opacity: 0 },
        { t: 0.25, x: ox, y: oy, scale: 1, opacity: 1, easing: 'ease-in' },
        { t: 1, x: round(ox + between(ctx.rnd, -40, 40), 1), y: round(oy + between(ctx.rnd, 320, 480), 1), rotate: round(between(ctx.rnd, -540, 540), 0), opacity: 0 },
      ];
      el.keyframes[0] = { ...el.keyframes[0], easing: 'ease-out' };
      return el;
    }),
  },
  {
    id: 'sparkles', label: 'Sparkles', description: 'Stars twinkle across the screen, each in its own time.',
    build: (ctx) => Array.from({ length: 14 }, (_, i) => {
      const size = between(ctx.rnd, 10, 26);
      const el = path(between(ctx.rnd, 0, W - size), between(ctx.rnd, 20, H - 40), size, size, SPARKLE, pick(ctx.rnd, ctx.colors), `Sparkle ${i + 1}`);
      el.track = onScreen(ctx, between(ctx.rnd, -200, 200));
      el.loop = twinkle(Math.round(between(ctx.rnd, 4, 8)));
      return el;
    }),
  },
  {
    id: 'balloons', label: 'Balloons', description: 'Balloons rise past you, swaying on their strings.',
    build: (ctx) => Array.from({ length: 6 }, (_, i) => {
      const size = between(ctx.rnd, 44, 64);
      const x = between(ctx.rnd, 0, W - size);
      const g = base('group', x, H + between(ctx.rnd, 0, 200), size, size * 2.4, `Balloon ${i + 1}`);
      const color = pick(ctx.rnd, ctx.colors);
      g.children = [
        path(size / 2 - 6, size * 1.2, 12, size * 1.2, STRING, null, 'String', ctx.text, 1),
        shape('polygon', size / 2 - 5, size * 1.18 - 4, 10, 8, color, 'Knot', { sides: 3 }),
        shape('ellipse', 0, 0, size, size * 1.22, color, 'Balloon'),
      ];
      g.track = onScreen(ctx, between(ctx.rnd, -100, 250));
      g.keyframes = [{ t: 0, y: g.y }, { t: 1, x: round(x + between(ctx.rnd, -40, 40), 1), y: round(-size * 3, 1) }];
      g.origin = { x: 0.5, y: 1 };
      g.loop = sway(6, 4);
      return g;
    }),
  },
  {
    id: 'hearts', label: 'Floating hearts', description: 'Hearts drift upwards, bobbing gently.',
    build: (ctx) => Array.from({ length: 8 }, (_, i) => {
      const size = between(ctx.rnd, 18, 40);
      const x = between(ctx.rnd, 0, W - size);
      const y = between(ctx.rnd, H * 0.5, H);
      const el = path(x, y, size, size, HEART, pick(ctx.rnd, ctx.colors), `Heart ${i + 1}`);
      el.track = onScreen(ctx, between(ctx.rnd, -100, 200));
      el.keyframes = [{ t: 0, opacity: 0 }, { t: 0.15, opacity: 0.9 }, { t: 0.85, opacity: 0.9 }, { t: 1, y: round(y - H * 0.7, 1), opacity: 0 }];
      el.loop = float(8, 4);
      return el;
    }),
  },
  {
    id: 'lights', label: 'Fairy lights', description: 'A string of lights across the top, flickering softly.',
    build: (ctx) => {
      const sag = 60;
      const wire = path(0, 40, W, sag + 4, {
        width: 390, height: sag + 4, contours: [{ closed: false, points: [P(0, 0, undefined, [130, sag * 1.3]), P(390, 0, [260, sag * 1.3])] }],
      }, null, 'Wire', ctx.text, 1);
      const bulbs = Array.from({ length: 13 }, (_, i) => {
        const t = (i + 0.5) / 13;
        // On the wire's curve: a cubic from (0,0) to (390,0) through handles at 1.3 × sag.
        const u = 1 - t;
        const bx = 3 * u * u * t * 130 + 3 * u * t * t * 260 + t * t * t * 390;
        const by = 3 * u * u * t * sag * 1.3 + 3 * u * t * t * sag * 1.3;
        const el = shape('ellipse', round(bx - 5, 1), round(40 + by, 1), 10, 14, pick(ctx.rnd, ctx.colors), `Light ${i + 1}`);
        el.track = onScreen(ctx, between(ctx.rnd, -150, 150));
        el.loop = flicker(Math.round(between(ctx.rnd, 4, 8)));
        return el;
      });
      return [wire, ...bulbs];
    },
  },
  {
    id: 'doors', label: 'Opening doors', description: 'Two doors fill the screen, then swing open as you scroll.', pinned: true,
    build: (ctx) => ['left', 'right'].map((side) => {
      const left = side === 'left';
      const el = shape('rect', left ? 0 : W / 2, 0, W / 2, H, ctx.colors[0], left ? 'Left door' : 'Right door');
      el.shape!.stroke = ctx.colors[1] ?? ctx.text;
      el.shape!.strokeWidth = 2;
      el.origin = { x: left ? 0 : 1, y: 0.5 };
      el.pinned = true;
      el.track = { start: Math.max(0, Math.round(ctx.top)), end: Math.round(ctx.top + 700) };
      el.keyframes = [
        { t: 0.1, rotateY: 0, opacity: 1, easing: 'ease-in-out' },
        { t: 0.7, rotateY: left ? -80 : 80, opacity: 1 },
        { t: 0.8, opacity: 0 },
      ];
      return el;
    }),
  },
  {
    id: 'curtain', label: 'Rising curtain', description: 'A full-screen curtain lifts away to show what’s behind it.', pinned: true,
    build: (ctx) => {
      const el = shape('rect', 0, 0, W, H, ctx.colors[0], 'Curtain');
      el.pinned = true;
      el.track = { start: Math.max(0, Math.round(ctx.top)), end: Math.round(ctx.top + 600) };
      el.keyframes = [{ t: 0.05, y: 0, easing: 'ease-in' }, { t: 0.8, y: -H - 20 }];
      return [el];
    },
  },
  {
    id: 'envelope', label: 'Envelope', pinned: true,
    description: 'A sealed envelope that opens as you scroll — or when the seal is tapped — and the card rises out.',
    build: (ctx) => {
      const hold = 1100;
      const track = { start: Math.max(0, Math.round(ctx.top)), end: Math.round(ctx.top + hold) };
      const pin = (el: DesignElement): DesignElement => ({ ...el, pinned: true, track: { ...track } });
      const outline = (w: number, h: number, pts: [number, number][]): DesignPath => ({ width: w, height: h, contours: [{ closed: true, points: pts.map(([x, y]) => P(x, y)) }] });
      const leave = (y: number) => [{ t: 0.72, y, opacity: 1 }, { t: 0.9, y: y + 260, opacity: 0, easing: 'ease-in' }];
      const body = ctx.colors[0];
      const dark = ctx.colors[1] ?? ctx.text;

      const back = pin(shape('rect', 40, 250, 310, 220, body, 'Envelope back', { radius: 6 }));
      back.keyframes = leave(250);

      const card = pin(base('group', 60, 275, 270, 190, 'Card'));
      const paper = shape('rect', 0, 0, 270, 190, ctx.bg, 'Card paper', { radius: 6 });
      paper.shape!.stroke = dark;
      paper.shape!.strokeWidth = 1;
      const names = base('text', 10, 40, 250, 80, 'Names');
      names.text = { runs: [{ var: 'event.title' }], style: { font: null, size: 34, weight: 400, color: body, align: 'center', valign: 'middle', lineHeight: 1.1, letterSpacing: 0 } };
      const when = base('text', 15, 130, 240, 26, 'Date');
      when.text = { runs: [{ var: 'event.date' }], style: { font: null, size: 15, weight: 400, color: ctx.text, align: 'center', valign: 'middle', lineHeight: 1.3, letterSpacing: 0 } };
      card.children = [paper, names, when];
      card.keyframes = [
        { t: 0.34, y: 275, scale: 1, lift: 0 },
        { t: 0.56, y: 120, scale: 1, lift: 0, easing: 'ease-out' },
        { t: 0.6, lift: 20 },
        { t: 0.78, y: 250, scale: 1.22, lift: 20, easing: 'ease-in-out' },
      ];

      const pocket = pin(path(40, 250, 310, 220, outline(310, 220, [[0, 0], [155, 136], [310, 0], [310, 220], [0, 220]]), body, 'Envelope front'));
      pocket.keyframes = leave(250);

      const flap = pin(path(40, 250, 310, 150, outline(310, 150, [[0, 0], [310, 0], [155, 150]]), dark, 'Envelope flap'));
      flap.origin = { x: 0.5, y: 0 };
      flap.keyframes = [{ t: 0.08, rotateX: 0, lift: 10, easing: 'ease-in-out' }, { t: 0.3, rotateX: 180, lift: 10 }, { t: 0.31, lift: 0 }, ...leave(250)];

      const seal = pin(shape('ellipse', 165, 368, 60, 60, ctx.colors[2] ?? dark, 'Seal'));
      seal.tapScroll = Math.round(ctx.top + hold * 0.62);
      seal.keyframes = [{ t: 0, scale: 1 }, { t: 0.05, scale: 1.15, easing: 'ease-out' }, { t: 0.09, scale: 0.6, opacity: 0, easing: 'ease-in' }];
      return [back, card, pocket, flap, seal];
    },
  },
  {
    id: 'scroll-hint', label: 'Scroll hint', description: 'A bobbing arrow at the bottom that says there’s more below.',
    build: (ctx) => {
      const arrow = path(W / 2 - 16, H - 70, 32, 16, CHEVRON, null, 'Arrow', ctx.colors[0], 2);
      arrow.loop = loop('bob', [{ t: 0, easing: 'ease-out' }, { t: 0.5, dy: 8, easing: 'ease-in' }, { t: 1 }], 6);
      const label = base('text', W / 2 - 80, H - 100, 160, 24, 'Scroll');
      label.text = { runs: [{ text: 'Scroll' }], style: { font: null, size: 13, weight: 400, color: ctx.colors[0], align: 'center', valign: 'middle', lineHeight: 1.3, letterSpacing: 0.2, uppercase: true } };
      for (const el of [arrow, label]) {
        el.track = { start: Math.max(0, Math.round(ctx.top - 100)), end: Math.round(ctx.top + 300) };
        el.keyframes = [{ t: 0.3, opacity: 1 }, { t: 0.6, opacity: 0 }];
      }
      return [label, arrow];
    },
  },
];

/** A sticker as a group over the screen at `top`, laid out from `seed`. */
/** `top` times the motion (the scroll it plays at); `groupY` is where the group sits (0 on a stage: the screen's top). */
export function buildSticker(scene: DesignScene, recipeId: string, seed: number, top: number, groupY = top): DesignElement | null {
  const recipe = STICKERS.find((r) => r.id === recipeId);
  if (!recipe) return null;
  const theme = scene.theme.filter((t) => !t.key.includes('font') && /^#/.test(t.value));
  const colorKeys = theme.map((t) => t.key).filter((k) => k !== 'bg' && k !== 'text');
  const colors = [...colorKeys, 'accent'].filter((k, i, a) => a.indexOf(k) === i && theme.some((t) => t.key === k)).map((k) => `theme:${k}`);
  const ctx: RecipeContext = {
    rnd: seeded(seed),
    top,
    colors: colors.length ? colors : ['theme:accent'],
    text: theme.some((t) => t.key === 'text') ? 'theme:text' : colors[0] ?? 'theme:accent',
    bg: 'theme:bg',
  };
  const group = base('group', 0, Math.round(groupY), W, H, recipe.label);
  group.children = recipe.build(ctx);
  group.recipe = { id: recipe.id, seed };
  return group;
}
