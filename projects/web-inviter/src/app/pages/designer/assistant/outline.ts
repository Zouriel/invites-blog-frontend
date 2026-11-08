import { CANVAS_WIDTH, REFERENCE_VIEWPORT, type DesignElement, type DesignScene } from '../model/scene';
import { scrollRange, usedAssetIds } from '../model/scene-ops';
import { describeSpan, screenCount, screensOf } from '../model/screens';

/**
 * The design as the assistant reads it: one short line per element, the theme, the assets and what
 * is selected. A design that is 600 KB as JSON (pictures are stored inline) is a few KB here, which is
 * most of what keeps a message cheap. Full details come from the `get_elements` tool when needed.
 */
export function outline(scene: DesignScene, selection: readonly string[], playhead: number, pageBytes?: number): string {
  const lines: string[] = [];
  const range = Math.round(scrollRange(scene));
  lines.push(`page: ${scene.stage ? 'stage: on' : 'stage: off (scrolling page)'}, ${CANVAS_WIDTH} wide, screen ${REFERENCE_VIEWPORT} tall, scrolls 0-${range}`
    + (scene.length ? `, length set to ${scene.length}` : '') + (scene.kind === 'saveTheDate' ? ', kind: save the date' : ''));
  lines.push(`screens: ${screenCount(scene)} (each 844 of scroll: screen n is scroll ${'(n-1)'}*844 to n*844); ${scene.stage ? 'on a stage a thing is on the screens its bar covers' : 'on a scrolling page a thing is on the screens its box sits on'}`);
  lines.push('theme: ' + (scene.theme.map((t) => `${t.key} ${t.value}`).join(', ') || 'none'));
  if (pageBytes) lines.push(`published page: ${Math.round(pageBytes / 1024)}KB (only files something shows are in it)`);
  const assets = Object.entries(scene.assets ?? {});
  const used = usedAssetIds(scene);
  if (assets.length)
    lines.push('assets: ' + assets.map(([id, a]) => `${id} ${a.kind === 'image' ? 'photo' : 'illustration'} ${a.width}x${a.height} ${Math.max(1, Math.round(a.data.length / 1024))}KB${used.has(id) ? '' : ' UNUSED'}${a.name ? ` "${clip(a.name, 30)}"` : ''}`).join('; '));
  lines.push(`selected: ${selection.length ? selection.join(', ') : 'nothing'}; editor at scroll ${Math.round(playhead)}`);
  lines.push(`elements (${countAll(scene.elements)}, back to front):`);
  write(scene, scene.elements, 0, lines);
  return lines.join('\n');
}

function write(scene: DesignScene, elements: readonly DesignElement[], depth: number, lines: string[]): void {
  for (const el of elements) {
    // Top-level things say which screens they're on; pieces of a group go with their group.
    lines.push('  '.repeat(depth) + line(el) + (depth === 0 ? ` [${describeSpan(screensOf(scene, el))}]` : ''));
    if (el.children?.length) write(scene, el.children, depth + 1, lines);
  }
}

/** One element: id, kind, name, box, what it shows, and how it moves. */
export function line(el: DesignElement): string {
  const parts: string[] = [el.id, kind(el)];
  if (el.name) parts.push(`"${clip(el.name, 24)}"`);
  parts.push(`x${r(el.x)} y${r(el.y)} w${r(el.w)} h${r(el.h)}`);
  if (el.rotate) parts.push(`rot${r(el.rotate)}`);
  if (el.scale !== 1) parts.push(`scale${el.scale}`);
  if (el.opacity !== 1) parts.push(`opacity${el.opacity}`);

  if (el.text) {
    const s = el.text.style;
    parts.push(`"${clip(textOf(el), 60)}"`, `${s.font ?? 'default'} ${s.size}${s.weight !== 400 ? ' w' + s.weight : ''}${s.italic ? ' italic' : ''}${s.uppercase ? ' caps' : ''} ${s.color ?? ''} ${s.align}`.trim());
  }
  if (el.text?.curve) parts.push(`curve ${el.text.curve}`);
  if (el.text?.image) parts.push(`letters filled with ${el.text.image}`);
  if (el.text?.style.stroke && el.text.style.strokeWidth) parts.push(`outline ${el.text.style.stroke} ${el.text.style.strokeWidth}`);
  if (el.shape) parts.push(`${['rect', 'ellipse', 'line', 'polygon', 'path'].includes(el.shape.kind) ? '' : el.shape.kind + (el.shape.amount != null ? ` amount ${el.shape.amount}` : '') + ' '}fill ${el.shape.fill ?? 'none'}${el.shape.stroke ? ` stroke ${el.shape.stroke} ${el.shape.strokeWidth}` : ''}${el.shape.dash ? ' ' + el.shape.dash : ''}${el.shape.radius ? ` radius ${el.shape.radius}` : ''}`);
  if (el.image) parts.push(`asset ${el.image.asset} ${el.image.fit}${el.image.tint ? ` tint ${el.image.tint}${el.image.tintMode ? ' ' + el.image.tintMode : ''}` : ''}`);
  if (el.svg) parts.push(`asset ${el.svg.asset}${el.svg.tint ? ` tint ${el.svg.tint}` : ''}${el.svg.stretch ? ' stretched' : ''}`);
  if (el.slot) parts.push(`${el.slot.multiple ? 'gallery' : 'photo'} ${el.slot.path} "${clip(el.slot.label, 24)}"`);
  if (el.button) parts.push(`"${clip(el.button.label, 30)}"${el.button.path ? ' -> ' + el.button.path : ''} fill ${el.button.fill ?? 'none'} text ${el.button.style.color ?? ''}`);
  if (el.pattern) parts.push(`pattern ${el.pattern.kind} ${el.pattern.mode ?? 'shade'}${el.pattern.mode === 'colour' && el.pattern.color ? ' ' + el.pattern.color : ''} size ${el.pattern.size ?? 1} strength ${el.pattern.strength ?? 0.5}`);
  if (el.bevel) parts.push(`bevel ${el.bevel.style ?? 'raised'} size ${el.bevel.size ?? 4} strength ${el.bevel.strength ?? 0.7}`);
  if (el.innerGlow) parts.push(`inner_glow ${el.innerGlow.color ?? '#ffffff'} size ${el.innerGlow.size ?? 10} strength ${el.innerGlow.strength ?? 0.75} blend ${el.innerGlow.blend ?? 'screen'}`);
  if (el.outerGlow) parts.push(`outer_glow ${el.outerGlow.color ?? '#ffffff'} size ${el.outerGlow.size ?? 10} strength ${el.outerGlow.strength ?? 0.75}`);
  if (el.blend && el.blend !== 'normal') parts.push(`blend ${el.blend}`);
  if (el.gradient) parts.push(`gradient ${el.gradient.type ?? 'linear'}${(el.gradient.type ?? 'linear') === 'linear' ? ' ' + (el.gradient.angle ?? 180) + 'deg' : ''} ${el.gradient.stops.map((t) => t.color).join(' > ')}`);
  if (el.shadow) parts.push(`shadow ${el.shadow.color ?? '#000000'} ${el.shadow.x ?? 0},${el.shadow.y ?? 4} blur ${el.shadow.blur ?? 8}`);
  if (el.light) parts.push(`light ${el.light.angle ?? 135}deg ${el.light.color ?? '#ffffff'}`);
  if (el.mask) parts.push(`clipped to ${el.mask.kind}`);
  const adjust = el.image?.adjust ?? el.slot?.adjust;
  if (adjust) parts.push(`adjust ${Object.entries(adjust).filter(([, v]) => v != null).map(([k, v]) => k === 'duotone' && v && typeof v === 'object' ? `duotone ${(v as { dark: string }).dark}/${(v as { light: string }).light}` : `${k} ${v}`).join(' ')}`);
  if (el.locked) parts.push('locked');
  if (el.pinned) parts.push('pinned');
  if (el.scrolls) parts.push('scrolls');

  const motion: string[] = [];
  if (el.track) motion.push(`bar ${r(el.track.start)}-${r(el.track.end)}`);
  if (el.enter) motion.push(`enter ${el.enter}`);
  if (el.exit) motion.push(`exit ${el.exit}`);
  if (el.loop) motion.push(`loop ${el.loop.preset ?? 'custom'}`);
  const own = el.keyframes.filter((k) => !k.preset || k.preset === 'bar').length;
  if (el.keyframes.some((k) => k.preset === 'bar')) motion.push('across bar');
  if (own) motion.push(`${own} keyframes`);
  if (el.recipe) motion.push(`sticker ${el.recipe.id}`);
  if (motion.length) parts.push('| ' + motion.join(', '));
  return parts.join(' ');
}

function kind(el: DesignElement): string {
  if (el.type === 'shape') return el.shape?.kind ?? 'shape';
  if (el.type === 'svg') return 'illustration';
  if (el.type === 'image') return 'picture';
  if (el.type === 'slot') return 'photo-slot';
  if (el.type === 'rsvp') return 'rsvp-button';
  if (el.type === 'link') return 'link-button';
  return el.type;
}

/** The text with fields written as {{path}}, the way the assistant writes them. */
export function textOf(el: DesignElement): string {
  return (el.text?.runs ?? []).map((run) => (run.var ? `{{${run.var}}}` : run.text ?? '')).join('').replace(/\n/g, '\\n');
}

function countAll(elements: readonly DesignElement[]): number {
  return elements.reduce((n, el) => n + 1 + countAll(el.children ?? []), 0);
}

function r(v: number): number {
  return Math.round(v);
}

function clip(s: string, max: number): string {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max - 1) + '…' : one;
}
