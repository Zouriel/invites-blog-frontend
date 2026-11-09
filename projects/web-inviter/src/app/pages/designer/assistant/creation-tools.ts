import { COMBINE_OPS, combinable, combineShapes, type CombineOp } from '../model/combine';
import {
  BLOB_STYLES, DEFAULTS, SCATTER_SIZES, VINE_CURLS, newSeed, type GeneratorOptions,
} from '../model/generators';
import { DIRECTIONS, GAPS, MAX_REPEAT, repeatElement, repeatOf, ringRadius, type RepeatSpec, type RingSpacing } from '../model/repeat';
import { findElement, labelOf, moveWhole, round } from '../model/scene-ops';
import { ToolError, at, bool, color, element, ids, int, num, oneOf, str, type ToolContext } from './assistant-tools';
import { line } from './outline';

/**
 * The design assistant's creation tools: repeat_element, generate and combine_shapes. They make the
 * same ordinary elements the panels do (copies in a group, generated shapes, one drawn shape), through the
 * same store methods, so the person can undo or change them the same way.
 */
type Input = Record<string, unknown>;

export function creationTool(ctx: ToolContext, name: string, i: Input): string {
  switch (name) {
    case 'repeat_element': return repeat(ctx, i);
    case 'generate': return generateTool(ctx, i);
    case 'combine_shapes': return combine(ctx, i);
    default: throw new ToolError(`There's no tool "${name}".`);
  }
}

function repeat(ctx: ToolContext, i: Input): string {
  const { store } = ctx;
  const id = str(i['id'], 'id', 40);
  const target = element(store.scene()!, id);
  const layout = oneOf(i['layout'], 'layout', ['around', 'grid', 'line'] as const);
  if (!layout) throw new ToolError('layout must be one of: around, grid, line.');
  // Sizes come from the piece repeated: on a repeat group, its first piece.
  const piece = repeatOf(target) ? moveWhole(target.children![0], target.x, target.y) : target;
  let spec: RepeatSpec;
  if (layout === 'around') {
    const count = int(i['count'], 'count', 2, 60) ?? 8;
    const ring = oneOf(i['ring'], 'ring', ['petals', 'ring', 'wide'] as const) ?? 'petals';
    spec = {
      kind: 'circle', count,
      radius: num(i['radius'], 'radius', 0, 2000) ?? ringRadius(piece, count, ring as RingSpacing),
      faceOut: bool(i['face_out'], 'face_out') ?? true,
      startAngle: num(i['start_angle'], 'start_angle', -360, 360) ?? 0,
    };
  } else if (layout === 'grid') {
    const gap = num(i['gap'], 'gap', -500, 500) ?? GAPS.small;
    spec = {
      kind: 'grid', columns: int(i['columns'], 'columns', 1, 30) ?? 3, rows: int(i['rows'], 'rows', 1, 30) ?? 3,
      gapX: num(i['gap_x'], 'gap_x', -500, 500) ?? gap, gapY: num(i['gap_y'], 'gap_y', -500, 500) ?? gap,
    };
    if (spec.columns * spec.rows > MAX_REPEAT) throw new ToolError(`At most ${MAX_REPEAT} in one repeat.`);
  } else {
    const direction = oneOf(i['direction'], 'direction', ['across', 'down', 'diagonal'] as const) ?? 'across';
    spec = {
      kind: 'line', count: int(i['count'], 'count', 2, 60) ?? 5,
      spacing: num(i['gap'], 'gap', -500, 1000) ?? GAPS.small,
      angle: num(i['angle'], 'angle', -360, 360) ?? DIRECTIONS[direction],
    };
  }
  const trial = repeatElement(store.scene()!, id, spec, store.catalog()?.limits?.maxElements ?? Infinity);
  if ('error' in trial) throw new ToolError(trial.error);
  const groupId = store.repeat(id, spec);
  if (!groupId) throw new ToolError('It could not be repeated.');
  if (i['name'] !== undefined) store.update(groupId, (e) => ({ ...e, name: str(i['name'], 'name', 40) }));
  const group = findElement(store.scene()!, groupId)!;
  return `Repeated ${id} as group ${line(group)} Its pieces: ${(group.children ?? []).map((c) => c.id).join(', ')}.`;
}

function generateTool(ctx: ToolContext, i: Input): string {
  const { store } = ctx;
  // Scatter became particles on a shape: dust, stars, glitter and confetti that move.
  if (i['kind'] === 'scatter') throw new ToolError('Scatter is gone: give a shape particles instead (add_shape or update_element with particles {kind: dust, stars, glitter, snow, confetti, hearts, bokeh or fireflies}).');
  const kind = oneOf(i['kind'], 'kind', ['scatter', 'blob', 'vine'] as const);
  if (!kind) throw new ToolError('kind must be one of: blob, vine.');
  let options: GeneratorOptions;
  if (kind === 'scatter') {
    const d = DEFAULTS.scatter;
    const named = oneOf(i['sizes'], 'sizes', ['small', 'medium', 'large'] as const);
    const [lo, hi] = named ? SCATTER_SIZES[named] : [d.minSize, d.maxSize];
    const colors = i['colors'] === undefined ? null : Array.isArray(i['colors']) && i['colors'].length && i['colors'].length <= 8
      ? i['colors'].map((c, k) => color(c, ctx, `colors[${k}]`, false)!)
      : (() => { throw new ToolError('colors must be a list of up to 8 colours.'); })();
    options = {
      kind, shape: oneOf(i['shape'], 'shape', ['dots', 'stars', 'hearts', 'confetti'] as const) ?? d.shape,
      count: int(i['count'], 'count', 1, 120) ?? d.count,
      minSize: num(i['min_size'], 'min_size', 2, 120) ?? lo, maxSize: num(i['max_size'], 'max_size', 2, 160) ?? hi,
      area: oneOf(i['area'], 'area', ['screen', 'top', 'bottom', 'edges'] as const) ?? d.area,
      ...(colors ? { colors } : {}),
    };
  } else if (kind === 'blob') {
    const d = DEFAULTS.blob;
    const style = BLOB_STYLES[oneOf(i['style'], 'style', ['smooth', 'wavy', 'wild'] as const) ?? 'wavy'];
    const fill = i['color'] === undefined ? null : color(i['color'], ctx, 'color', false);
    options = {
      kind, points: int(i['points'], 'points', 4, 14) ?? style.points, wobble: num(i['wobble'], 'wobble', 0, 0.6) ?? style.wobble,
      size: num(i['w'], 'w', 20, 800) ?? d.size, ...(fill ? { color: fill } : {}),
    };
  } else {
    const d = DEFAULTS.vine;
    const stem = i['color'] === undefined ? null : color(i['color'], ctx, 'color', false);
    const leaf = i['leaf_color'] === undefined ? null : color(i['leaf_color'], ctx, 'leaf_color', false);
    const curl = i['curl'];
    options = {
      kind,
      leaves: int(i['leaves'], 'leaves', 0, 40) ?? d.leaves,
      curl: typeof curl === 'string' ? VINE_CURLS[oneOf(curl, 'curl', ['straight', 'gentle', 'curly'] as const)!] : num(curl, 'curl', 0, 1) ?? d.curl,
      length: num(i['length'], 'length', 80, 1600) ?? d.length,
      direction: oneOf(i['direction'], 'direction', ['up', 'down', 'across'] as const) ?? d.direction,
      leafSize: num(i['leaf_size'], 'leaf_size', 8, 120) ?? d.leafSize,
      ...(stem ? { color: stem } : {}), ...(leaf ? { leafColor: leaf } : {}),
    };
  }
  at(ctx, i['at']);
  const seed = int(i['seed'], 'seed', 0, 999_999) ?? newSeed();
  const el = store.addGenerated(options, seed);
  if (!el) throw new ToolError('It could not be added.');
  // An exact place, if asked: the top left of what was made.
  const x = num(i['x'], 'x', -2000, 2000);
  const y = num(i['y'], 'y', -2000, 100000);
  if (x !== undefined || y !== undefined)
    store.update(el.id, (e) => moveWhole(e, x === undefined ? 0 : round(x - e.x, 1), y === undefined ? 0 : round(y - e.y, 1)));
  if (i['name'] !== undefined) store.update(el.id, (e) => ({ ...e, name: str(i['name'], 'name', 40) }));
  const made = findElement(store.scene()!, el.id)!;
  return `Made a ${kind} (seed ${seed}): ${line(made)}`;
}

function combine(ctx: ToolContext, i: Input): string {
  const { store } = ctx;
  const list = ids(i['ids']);
  list.forEach((id) => element(store.scene()!, id));
  const op = (oneOf(i['op'], 'op', COMBINE_OPS.map((o) => o.op)) ?? 'add') as CombineOp;
  // Ask the model first, so the assistant hears exactly why (the store only tells the person).
  const check = combinable(store.scene()!, list);
  if ('error' in check) throw new ToolError(check.error);
  const trial = combineShapes(store.scene()!, list, op);
  if ('error' in trial) throw new ToolError(trial.error);
  const id = store.combine(list, op);
  if (!id) throw new ToolError('Those shapes could not be combined.');
  return `Combined ${list.join(', ')} (${op}) into ${line(findElement(store.scene()!, id)!)}`;
}

export function creationSummary(ctx: ToolContext, name: string, i: Input): string | undefined {
  const scene = ctx.store.scene()!;
  const label = (id: unknown) => {
    const el = typeof id === 'string' ? findElement(scene, id) : null;
    return el ? `“${labelOf(el)}”` : 'it';
  };
  switch (name) {
    case 'repeat_element': return `Repeated ${label(i['id'])} ${i['layout'] === 'grid' ? 'in a grid' : i['layout'] === 'line' ? 'in a line' : 'around a circle'}`;
    case 'generate': return i['kind'] === 'blob' ? 'Made a blob' : i['kind'] === 'vine' ? 'Grew a vine' : 'Scattered some shapes';
    case 'combine_shapes': return `Combined ${Array.isArray(i['ids']) ? i['ids'].length : 0} shapes into one`;
    default: return undefined;
  }
}
