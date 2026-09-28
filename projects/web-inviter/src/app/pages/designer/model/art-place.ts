import { REFERENCE_VIEWPORT, type ArtImport, type DesignElement, type DesignScene } from './scene';
import { createElement, round } from './scene-ops';

/** The longer side of newly placed art, in canvas units: big enough to see, small enough to move. */
export const ART_SIZE = 240;

/**
 * Puts imported art on the page, centred on `center` (page units), with its assets added to the scene.
 *
 * <p>One layer becomes one element. Several become a group whose children all cover the group's box,
 * back to front — the importer cut the art that way so its moving parts stack exactly.</p>
 *
 * <p>Motion plays while the art crosses the screen: its track runs from when its top comes up past the
 * bottom edge to when its bottom leaves past the top, so at the scroll where it's placed (mid-screen)
 * the animation is halfway through. The layers' keyframes are offsets in the art's own units, scaled
 * here to the element.</p>
 */
export function placeArt(scene: DesignScene, art: ArtImport, center: { x: number; y: number }, size = ART_SIZE, bar?: { start: number; end: number }): {
  scene: DesignScene;
  element: DesignElement;
} {
  const longest = Math.max(art.width, art.height) || 1;
  const k = size / longest;
  const w = round(Math.max(1, art.width) * k, 1);
  const h = round(Math.max(1, art.height) * k, 1);
  const assets = { ...scene.assets };
  for (const a of art.assets)
    assets[a.id] = { kind: a.kind, data: a.data, width: a.width, height: a.height, colors: a.colors ?? null, name: a.name };
  const next: DesignScene = { ...scene, assets };

  const x = Math.round(center.x - w / 2);
  const y = Math.round(center.y - h / 2);
  const track = bar ?? { start: Math.max(0, Math.round(y - REFERENCE_VIEWPORT)), end: Math.round(y + h) };

  const layer = (l: ArtImport['layers'][number], ox: number, oy: number): DesignElement => {
    const asset = art.assets.find((a) => a.id === l.asset)!;
    const el = createElement(next, asset.kind, 0, { w, h, name: l.name ? `${art.name} · ${l.name}` : art.name });
    el.x = ox;
    el.y = oy;
    if (asset.kind === 'svg') el.svg = { asset: asset.id, fills: {} };
    else el.image = { asset: asset.id, fit: 'contain', radius: 0 };
    if (l.frames.length) {
      el.track = track;
      el.keyframes = l.frames.map((f) => ({
        t: round(f.t, 5), x: round(ox + f.dx * k, 1), y: round(oy + f.dy * k, 1),
        rotate: round(f.rotate, 2), scale: round(f.scale, 4), opacity: round(f.opacity, 3),
      }));
    }
    return el;
  };

  if (art.layers.length === 1) return { scene: next, element: layer(art.layers[0], x, y) };
  const group = createElement(next, 'group', 0, { w, h, name: art.name });
  group.x = x;
  group.y = y;
  group.children = art.layers.map((l) => layer(l, 0, 0));
  return { scene: next, element: group };
}
