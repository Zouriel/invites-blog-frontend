import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { STICKERS, buildSticker } from './stickers';
import type { DesignScene } from './scene';

// Writes a scene holding every sticker to STICKERS_OUT, for checking against the server's Check.
describe('sticker export', () => {
  it('writes every sticker when asked', () => {
    const out = process.env['STICKERS_OUT'];
    if (!out) return;
    const scene: DesignScene = {
      schema: 3, canvas: {}, fonts: [], roles: [], fields: [], assets: {},
      theme: [
        { key: 'accent', label: 'Accent', value: '#8c2f39' }, { key: 'bg', label: 'Bg', value: '#f4ece2' }, { key: 'text', label: 'Text', value: '#3b2a2a' },
        { key: 'gold', label: 'Gold', value: '#c9a45c' }, { key: 'heading-font', label: 'Heading', value: 'cormorant-garamond' }, { key: 'body-font', label: 'Body', value: 'lora' },
      ],
      elements: [],
    };
    STICKERS.forEach((s, i) => scene.elements.push(buildSticker(scene, s.id, 11, i * 1200)!));
    scene.elements.push({ id: 'rsvp', type: 'rsvp', x: 80, y: 12500, w: 230, h: 56, rotate: 0, scale: 1, opacity: 1, keyframes: [] });
    writeFileSync(out, JSON.stringify(scene));
  });
});
