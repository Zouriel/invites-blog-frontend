import { CANVAS_WIDTH, REFERENCE_VIEWPORT, type DesignElement, type DesignScene } from '../model/scene';
import { scrollRange } from '../model/scene-ops';

/**
 * The design as the assistant reads it: one short line per element, the theme, the assets and what
 * is selected. A design that is 600 KB as JSON (pictures are stored inline) is a few KB here, which is
 * most of what keeps a message cheap. Full details come from the `get_elements` tool when needed.
 */
export function outline(scene: DesignScene, selection: readonly string[], playhead: number): string {
  const lines: string[] = [];
  const range = Math.round(scrollRange(scene));
  lines.push(`page: ${scene.stage ? 'stage: on' : 'stage: off (scrolling page)'}, ${CANVAS_WIDTH} wide, screen ${REFERENCE_VIEWPORT} tall, scrolls 0-${range}`
    + (scene.length ? `, length set to ${scene.length}` : '') + (scene.kind === 'saveTheDate' ? ', kind: save the date' : ''));
  lines.push('theme: ' + (scene.theme.map((t) => `${t.key} ${t.value}`).join(', ') || 'none'));
  const assets = Object.entries(scene.assets ?? {});
  if (assets.length)
    lines.push('assets: ' + assets.map(([id, a]) => `${id} ${a.kind === 'image' ? 'photo' : 'illustration'} ${a.width}x${a.height}${a.name ? ` "${clip(a.name, 30)}"` : ''}`).join('; '));
  lines.push(`selected: ${selection.length ? selection.join(', ') : 'nothing'}; editor at scroll ${Math.round(playhead)}`);
  lines.push(`elements (${countAll(scene.elements)}, back to front):`);
  write(scene.elements, 0, lines);
  return lines.join('\n');
}

function write(elements: readonly DesignElement[], depth: number, lines: string[]): void {
  for (const el of elements) {
    lines.push('  '.repeat(depth) + line(el));
    if (el.children?.length) write(el.children, depth + 1, lines);
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
  if (el.shape) parts.push(`fill ${el.shape.fill ?? 'none'}${el.shape.stroke ? ` stroke ${el.shape.stroke} ${el.shape.strokeWidth}` : ''}${el.shape.radius ? ` radius ${el.shape.radius}` : ''}`);
  if (el.image) parts.push(`asset ${el.image.asset} ${el.image.fit}`);
  if (el.svg) parts.push(`asset ${el.svg.asset}${el.svg.tint ? ` tint ${el.svg.tint}` : ''}`);
  if (el.slot) parts.push(`${el.slot.multiple ? 'gallery' : 'photo'} ${el.slot.path} "${clip(el.slot.label, 24)}"`);
  if (el.button) parts.push(`"${clip(el.button.label, 30)}"${el.button.path ? ' -> ' + el.button.path : ''} fill ${el.button.fill ?? 'none'} text ${el.button.style.color ?? ''}`);
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
