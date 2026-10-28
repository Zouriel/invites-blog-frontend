import {
  CARD_DEFAULT, CARD_PRESETS, PRESETS, cardPalette, contrast, mix, onAccent, readabilityWarnings, sameColours,
} from './guest-colours';

describe('guest colours', () => {
  it('every preset reads: words at 4.5:1 and a button that shows', () => {
    for (const p of [...PRESETS, ...CARD_PRESETS]) {
      expect(contrast(p.colours.text, p.colours.background), `${p.name} words`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.colours.accent, p.colours.background), `${p.name} button`).toBeGreaterThanOrEqual(1.6);
      expect(readabilityWarnings(p.colours), p.name).toEqual([]);
    }
  });

  it('every preset is a whole hex colour, since it goes straight into the printed CSS', () => {
    for (const p of [...PRESETS, ...CARD_PRESETS])
      for (const c of Object.values(p.colours)) expect(c, p.name).toMatch(/^#[0-9a-f]{6}$/);
  });

  /** Nothing chosen must print exactly the card every event printed before. */
  it('the default card is the original cream and gold, colour for colour', () => {
    expect(cardPalette(null)).toEqual({
      paper: '#fbf8f3', line: '#b89b6a', leaf: '#d9c7a3', ink: '#2b2622', muted: '#6f655a',
      kicker: '#9a8558', frame: '#e4d8c1', venue: '#8a7f70', made: '#b3a995',
    });
    expect(cardPalette(undefined)).toEqual(cardPalette(null));
  });

  it('a chosen card is drawn from its three colours', () => {
    const p = cardPalette({ accent: '#d4627f', background: '#fdf1f4', text: '#4a2a33' });
    expect(p.paper).toBe('#fdf1f4');
    expect(p.line).toBe('#d4627f');
    expect(p.ink).toBe('#4a2a33');
    expect(Object.values(p).every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
  });

  /** Same rule as the server's GuestPalette.Contrast, or the preview would show a label guests don't get. */
  it('picks the button label the server will', () => {
    expect(onAccent('#7a1f3d')).toBe('#ffffff');
    expect(onAccent('#f6c6d4')).toBe('#1a1408');
    expect(onAccent('#c9a227')).toBe('#1a1408');
  });

  it('warns when words or the button would be hard to see', () => {
    expect(readabilityWarnings({ accent: '#fdf1f4', background: '#fdf1f4', text: '#f0e0e4' })).toHaveLength(2);
  });

  it('mixes and compares colours', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(sameColours(CARD_DEFAULT, { ...CARD_DEFAULT, accent: CARD_DEFAULT.accent.toUpperCase() })).toBe(true);
    expect(sameColours(CARD_DEFAULT, null)).toBe(false);
  });
});
