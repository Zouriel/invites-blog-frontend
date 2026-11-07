import type { DesignElement, DesignScene } from './scene';
import { ancestors, flatten } from './scene-ops';

/**
 * The largest size an asset is shown at anywhere in the design, in CSS pixels: the picture's own box
 * (after Fit and Fill), at the biggest it gets once its scale, its keyframes' scale, a loop's swell
 * and its groups' scale are counted. "Shrink to fit" sizes the asset for this, so nothing that uses it
 * gets blurrier. Null when nothing shows it.
 */
export function shownSize(scene: DesignScene, assetId: string): { width: number; height: number } | null {
  const asset = scene.assets[assetId];
  if (!asset) return null;
  let width = 0;
  let height = 0;
  for (const { element: el } of flatten(scene)) {
    const uses = el.image?.asset === assetId || el.svg?.asset === assetId;
    if (!uses || el.w <= 0 || el.h <= 0) continue;
    const zoom = [el, ...ancestors(scene, el.id)].reduce((z, e) => z * largestScale(e), 1);
    if (el.image && asset.width > 0 && asset.height > 0) {
      // Fill covers the box (the picture overflows it and is cropped); Fit sits inside it.
      const s = el.image.fit === 'contain'
        ? Math.min(el.w / asset.width, el.h / asset.height)
        : Math.max(el.w / asset.width, el.h / asset.height);
      width = Math.max(width, asset.width * s * zoom);
      height = Math.max(height, asset.height * s * zoom);
    } else {
      width = Math.max(width, el.w * zoom);
      height = Math.max(height, el.h * zoom);
    }
  }
  return width > 0 && height > 0 ? { width: Math.ceil(width), height: Math.ceil(height) } : null;
}

/** The biggest an element is drawn at: its scale or a keyframe's, times the largest swell of its loop. */
function largestScale(el: DesignElement): number {
  let scale = Math.abs(el.scale || 1);
  for (const k of el.keyframes ?? []) if (k.scale != null) scale = Math.max(scale, Math.abs(k.scale));
  const loop = (el.loop?.frames ?? []).reduce((m, f) => Math.max(m, Math.abs(f.scale ?? 1)), 1);
  return scale * loop;
}
