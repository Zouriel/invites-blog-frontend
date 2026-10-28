/**
 * Colours for what invites.blog adds around an uploaded design (the reply button and the guest
 * pages) and for the printed QR table card. One place, so the Colours page's previews and the card
 * that is actually printed are worked out the same way.
 */

/** Three colours, each `#rrggbb`: buttons and borders, the ground, and the words. */
export type ColourSet = { accent: string; background: string; text: string };

export type NamedColours = { id: string; name: string; colours: ColourSet };

/** What an uploaded design's reply bar looks like with nothing chosen (its page's own :root). */
export const REPLY_DEFAULT: ColourSet = { accent: '#c9a227', background: '#101014', text: '#f4eef6' };

/** The cream-and-gold card every event printed before it could be coloured. */
export const CARD_DEFAULT: ColourSet = { accent: '#b89b6a', background: '#fbf8f3', text: '#2b2622' };

/** One-tap palettes. Each reads at small sizes: text against background is at least 4.5:1. */
export const PRESETS: readonly NamedColours[] = [
  { id: 'gold', name: 'Classic gold', colours: REPLY_DEFAULT },
  { id: 'blush', name: 'Blush', colours: { accent: '#d4627f', background: '#fdf1f4', text: '#4a2a33' } },
  { id: 'rose-gold', name: 'Rose gold', colours: { accent: '#b76e79', background: '#fbf3ef', text: '#3d2b2e' } },
  { id: 'midnight-rose', name: 'Midnight rose', colours: { accent: '#e58fa8', background: '#1d1418', text: '#f7e9ee' } },
  { id: 'sage', name: 'Ivory and sage', colours: { accent: '#6f8a66', background: '#f7f5ee', text: '#2f3a2c' } },
  { id: 'ocean', name: 'Ocean', colours: { accent: '#1f7a8c', background: '#eef7f8', text: '#12343b' } },
  { id: 'lavender', name: 'Lavender', colours: { accent: '#8a6fbf', background: '#f5f1fb', text: '#33284a' } },
  { id: 'navy', name: 'Navy and silver', colours: { accent: '#c0c7d1', background: '#14213d', text: '#f2f4f8' } },
];

/** The card's own one-tap palettes start with the original card, then the same set. */
export const CARD_PRESETS: readonly NamedColours[] = [
  { id: 'cream', name: 'Cream and gold', colours: CARD_DEFAULT },
  ...PRESETS.filter((p) => p.id !== 'gold'),
];

export const sameColours = (a: ColourSet | null | undefined, b: ColourSet | null | undefined): boolean =>
  !!a && !!b &&
  a.accent.toLowerCase() === b.accent.toLowerCase() &&
  a.background.toLowerCase() === b.background.toLowerCase() &&
  a.text.toLowerCase() === b.text.toLowerCase();

type Rgb = [number, number, number];

function rgb(hex: string): Rgb {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function hex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** Moves `a` a fraction `t` of the way toward `b`. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

function luminance(c: string): number {
  const ch = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = rgb(c);
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * The words on a filled button. The same rule as the server's GuestPalette.Contrast (perceived
 * brightness, BT.601), so the preview shows the label guests will get.
 */
export function onAccent(accent: string): string {
  const [r, g, b] = rgb(accent);
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 > 0.55 ? '#1a1408' : '#ffffff';
}

/** What is hard to read, in plain words, or nothing. */
export function readabilityWarnings(c: ColourSet): string[] {
  const out: string[] = [];
  if (contrast(c.text, c.background) < 4.5) out.push('The words may be hard to read on this background.');
  if (contrast(c.accent, c.background) < 1.6) out.push('The button blends into the background.');
  return out;
}

/** Every colour the printed card uses, worked out from three. */
export type CardPalette = {
  paper: string; line: string; leaf: string; ink: string; muted: string; kicker: string;
  frame: string; venue: string; made: string;
};

export function cardPalette(set: ColourSet | null | undefined): CardPalette {
  // Nothing chosen: exactly the card as it was printed before it could be coloured.
  if (!set) {
    return {
      paper: '#fbf8f3', line: '#b89b6a', leaf: '#d9c7a3', ink: '#2b2622', muted: '#6f655a',
      kicker: '#9a8558', frame: '#e4d8c1', venue: '#8a7f70', made: '#b3a995',
    };
  }
  const { accent, background: paper, text: ink } = set;
  return {
    paper,
    line: accent,
    leaf: mix(accent, paper, 0.45),
    ink,
    muted: mix(ink, paper, 0.3),
    kicker: mix(accent, ink, 0.25),
    frame: mix(accent, paper, 0.6),
    venue: mix(ink, paper, 0.4),
    made: mix(ink, paper, 0.55),
  };
}
