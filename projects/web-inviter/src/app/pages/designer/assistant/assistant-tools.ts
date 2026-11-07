import { firstValueFrom } from 'rxjs';
import type { ApiService } from '../../../shared/api/api.service';
import type { DesignStore } from '../design.store';
import { EFFECT_MOVES, type Pace } from '../model/effect-moves';
import { STICKERS } from '../model/stickers';
import { CANVAS_WIDTH, type ArtItem, type DesignElement, type DesignRun, type DesignScene, type Typography } from '../model/scene';
import { createElement, findElement, insertElement, isFontKey, moveWhole, round } from '../model/scene-ops';
import { line, outline } from './outline';

/**
 * The design assistant's tools, run here on the live editor. Claude asks for them by name (the list
 * and fields are defined on the server in `AssistantPrompt.cs`; the two must match); each one checks
 * its input, makes the change through the same `DesignStore` methods the panels use, and answers with
 * one short line the model reads back. Nothing here accepts markup or asset data: only ids, names,
 * numbers and colours.
 */

export interface ToolContext {
  store: DesignStore;
  api: ApiService;
  /** Waits for the server's Check to answer for the current scene. */
  checked: () => Promise<void>;
}

export interface ToolOutcome {
  ok: boolean;
  text: string;
}

/** Thrown for input the model should correct; becomes an error result. */
class ToolError extends Error {}

export const TOOL_NAMES = [
  'get_elements', 'get_outline', 'add_text', 'add_shape', 'add_picture', 'add_photo_slot', 'add_button', 'update_element',
  'delete_elements', 'duplicate_elements', 'arrange', 'group_elements', 'ungroup', 'set_motion', 'apply_effect_move',
  'add_sticker', 'set_theme', 'set_page', 'search_art', 'add_art', 'check_design', 'show',
] as const;

type Input = Record<string, unknown>;

/** The names only the editor knows, for the server's system prompt. Sorted, so the prompt stays the same. */
export function vocabulary() {
  const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return {
    moves: EFFECT_MOVES.map((m) => ({ id: m.id, label: m.label })).sort(byId),
    stickers: STICKERS.map((s) => ({ id: s.id, label: s.label })).sort(byId),
  };
}

export async function runTool(ctx: ToolContext, name: string, input: Input): Promise<ToolOutcome> {
  try {
    if (!ctx.store.scene()) throw new ToolError('No design is open.');
    const text = await run(ctx, name, input ?? {});
    return { ok: true, text };
  } catch (e) {
    return { ok: false, text: e instanceof ToolError ? e.message : `Failed: ${(e as Error)?.message ?? 'unknown error'}` };
  }
}

async function run(ctx: ToolContext, name: string, i: Input): Promise<string> {
  const { store } = ctx;
  switch (name) {
    case 'get_elements': {
      const scene = store.scene()!;
      const els = ids(i['ids']).map((id) => element(scene, id));
      const json = JSON.stringify(els, (k, v) => (k === 'recipe' ? undefined : v));
      return json.length > 8000 ? json.slice(0, 8000) + '… (cut; ask for fewer)' : json;
    }
    case 'get_outline':
      return outline(store.scene()!, store.selection(), store.playhead());

    case 'add_text': {
      const scene = store.scene()!;
      const base = createElement(scene, 'text', 0);
      const text = str(i['text'], 'text', 2000);
      const size = num(i['size'], 'size', 6, 200) ?? 22;
      const lineHeight = num(i['line_height'], 'line_height', 0.6, 3) ?? base.text!.style.lineHeight;
      const lines = text.split('\n').length;
      let el: DesignElement = { ...base, text: { runs: runs(text, scene, ctx), style: { ...base.text!.style, size, lineHeight } } };
      el = box(el, i, { w: CANVAS_WIDTH - 48, h: Math.ceil(lines * size * lineHeight + 8) });
      el = { ...el, text: { ...el.text!, style: typography(el.text!.style, i, ctx) } };
      return insert(ctx, el, i['parent'], 'text');
    }
    case 'add_shape': {
      const scene = store.scene()!;
      const base = createElement(scene, 'shape', 0);
      const kind = oneOf(i['kind'], 'kind', ['rect', 'ellipse', 'line', 'polygon'] as const) ?? 'rect';
      let el: DesignElement = { ...base, name: kind === 'rect' ? 'Rectangle' : kind[0].toUpperCase() + kind.slice(1), shape: { ...base.shape!, kind } };
      el = box(el, i, { w: 160, h: 160 });
      el = { ...el, shape: shapeStyle(el.shape!, i, ctx) };
      const sides = int(i['sides'], 'sides', 3, 12);
      if (sides !== undefined) el = { ...el, shape: { ...el.shape!, sides } };
      return insert(ctx, el, i['parent'], kind);
    }
    case 'add_picture': {
      const scene = store.scene()!;
      const assetId = str(i['asset'], 'asset', 80);
      const asset = scene.assets[assetId];
      if (!asset) throw new ToolError(`No asset "${assetId}". The outline's assets line lists the ones in this design.`);
      const type = asset.kind === 'image' ? 'image' : 'svg';
      const w = Math.min(asset.width, CANVAS_WIDTH - 48);
      const h = Math.round(w * (asset.height / Math.max(1, asset.width)));
      let el = createElement(scene, type, 0);
      el = type === 'image'
        ? { ...el, name: asset.name ?? 'Picture', image: { asset: assetId, fit: oneOf(i['fit'], 'fit', ['cover', 'contain'] as const) ?? 'cover', radius: num(i['radius'], 'radius', 0, 999) ?? 0 } }
        : { ...el, name: asset.name ?? 'Illustration', svg: { asset: assetId, fills: {} } };
      el = box(el, i, { w, h });
      return insert(ctx, el, i['parent'], type === 'image' ? 'picture' : 'illustration');
    }
    case 'add_photo_slot': {
      const scene = store.scene()!;
      const base = createElement(scene, 'slot', 0);
      const path = i['path'] === undefined ? base.slot!.path : str(i['path'], 'path', 80);
      if (!imagePaths(ctx).includes(path)) throw new ToolError(`"${path}" isn't a photo field. Use one of: ${imagePaths(ctx).join(', ')}.`);
      const gallery = bool(i['gallery'], 'gallery') ?? false;
      let el: DesignElement = {
        ...base,
        slot: {
          ...base.slot!, path, multiple: gallery,
          label: i['label'] === undefined ? base.slot!.label : str(i['label'], 'label', 60),
          columns: int(i['columns'], 'columns', 1, 4) ?? base.slot!.columns,
          fit: oneOf(i['fit'], 'fit', ['cover', 'contain'] as const) ?? 'cover',
          radius: num(i['radius'], 'radius', 0, 999) ?? base.slot!.radius,
        },
      };
      el = box(el, i, { w: 300, h: 220 });
      return insert(ctx, el, i['parent'], 'photo slot');
    }
    case 'add_button': {
      const scene = store.scene()!;
      const kind = oneOf(i['kind'], 'kind', ['rsvp', 'link'] as const) ?? 'rsvp';
      const base = createElement(scene, kind, 0);
      let button = { ...base.button! };
      if (i['label'] !== undefined) button.label = str(i['label'], 'label', 60);
      if (kind === 'link' && i['link'] !== undefined) button.path = link(i['link'], ctx);
      button = { ...button, ...buttonShape(button, i, ctx), style: typography(button.style, i, ctx) };
      let el: DesignElement = { ...base, button };
      el = box(el, i, { w: base.w, h: base.h });
      return insert(ctx, el, i['parent'], kind === 'rsvp' ? 'RSVP button' : 'link button');
    }
    case 'update_element': {
      const id = str(i['id'], 'id', 40);
      const scene = store.scene()!;
      const el = element(scene, id);
      const next = update(el, i, scene, ctx);
      store.update(id, () => next);
      return `Updated ${line(next)}`;
    }
    case 'delete_elements': {
      const list = ids(i['ids']);
      list.forEach((id) => element(store.scene()!, id));
      store.remove(list, { quiet: true });
      return `Deleted ${list.join(', ')}.`;
    }
    case 'duplicate_elements': {
      const list = ids(i['ids']);
      list.forEach((id) => element(store.scene()!, id));
      store.duplicate(list);
      return `Copies: ${store.selection().join(', ')}.`;
    }
    case 'arrange': {
      const id = str(i['id'], 'id', 40);
      element(store.scene()!, id);
      const to = oneOf(i['to'], 'to', ['front', 'back', 'forward', 'backward'] as const);
      store.arrange(id, to === 'forward' ? 1 : to === 'backward' ? -1 : to ?? 'front');
      return `Moved ${id} ${to}.`;
    }
    case 'group_elements': {
      const list = ids(i['ids']);
      list.forEach((id) => element(store.scene()!, id));
      store.selection.set(list);
      const before = store.scene();
      store.group();
      if (store.scene() === before) throw new ToolError('Those can only be grouped when they sit side by side in the same group.');
      const groupId = store.primaryId()!;
      if (i['name'] !== undefined) store.update(groupId, (e) => ({ ...e, name: str(i['name'], 'name', 40) }));
      return `Grouped as ${groupId}.`;
    }
    case 'ungroup': {
      const id = str(i['id'], 'id', 40);
      if (element(store.scene()!, id).type !== 'group') throw new ToolError(`${id} isn't a group.`);
      store.select(id);
      store.ungroup();
      return `Ungrouped ${id}: ${store.selection().join(', ')}.`;
    }
    case 'set_motion': {
      const id = str(i['id'], 'id', 40);
      element(store.scene()!, id);
      const catalog = store.catalog()!;
      at(ctx, i['at']);
      const done: string[] = [];
      for (const slot of ['enter', 'exit'] as const) {
        if (i[slot] === undefined) continue;
        const preset = str(i[slot], slot, 40);
        const list = slot === 'enter' ? catalog.enterPresets : catalog.exitPresets;
        if (preset !== 'none' && !list.some((p) => p.id === preset)) throw new ToolError(`No ${slot} "${preset}". Use one from the catalog or "none".`);
        store.setPreset(id, slot, preset === 'none' ? null : preset);
        done.push(`${slot} ${preset}`);
      }
      if (i['loop'] !== undefined) {
        const loop = str(i['loop'], 'loop', 40);
        if (loop !== 'none' && !catalog.loopPresets.some((p) => p.id === loop)) throw new ToolError(`No loop "${loop}".`);
        store.setLoop(id, loop === 'none' ? null : loop, { strength: num(i['loop_strength'], 'loop_strength', 0.2, 3) });
        done.push(`loop ${loop}`);
      } else if (i['loop_strength'] !== undefined) {
        store.tuneLoop(id, { strength: num(i['loop_strength'], 'loop_strength', 0.2, 3) });
        done.push('loop strength');
      }
      if (i['across'] !== undefined) {
        const across = oneOf(i['across'], 'across', ['ken-burns', 'slower', 'faster', 'none'] as const)!;
        store.acrossBar(id, across);
        done.push(`across ${across}`);
      }
      if (!done.length) throw new ToolError('Give enter, exit, loop, loop_strength or across.');
      return `${id}: ${done.join(', ')}. Now ${line(element(store.scene()!, id))}`;
    }
    case 'apply_effect_move': {
      const id = str(i['id'], 'id', 40);
      element(store.scene()!, id);
      const moveId = str(i['move'], 'move', 40);
      const move = EFFECT_MOVES.find((m) => m.id === moveId);
      if (!move) throw new ToolError(`No effect move "${moveId}".`);
      at(ctx, i['at']);
      store.applyMove(id, move, (oneOf(i['pace'], 'pace', ['quick', 'steady', 'slow'] as const) ?? 'steady') as Pace);
      return `${move.label} on ${id} from scroll ${Math.round(store.playhead())}.`;
    }
    case 'add_sticker': {
      const sticker = str(i['sticker'], 'sticker', 40);
      if (!STICKERS.some((s) => s.id === sticker)) throw new ToolError(`No sticker "${sticker}".`);
      at(ctx, i['at']);
      const group = store.addSticker(sticker);
      if (!group) throw new ToolError('The sticker could not be added.');
      return `Added ${line(group)}`;
    }
    case 'set_theme': {
      const entries = i['entries'];
      if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new ToolError('entries must be an object of key: value.');
      const fonts = store.catalog()!.fonts;
      const changes = Object.entries(entries as Record<string, unknown>).map(([key, value]) => {
        if (!/^[a-z][a-z0-9-]{0,30}$/.test(key)) throw new ToolError(`"${key}" isn't a theme key (lowercase letters, digits and dashes).`);
        const v = str(value, key, 40);
        if (isFontKey(key) ? !fonts.some((f) => f.id === v) : !HEX.test(v)) throw new ToolError(isFontKey(key) ? `"${v}" isn't a font id.` : `"${v}" isn't a hex colour.`);
        return { key, value: v };
      });
      store.mutate((s) => {
        const theme = [...s.theme];
        for (const c of changes) {
          const at = theme.findIndex((t) => t.key === c.key);
          if (at >= 0) theme[at] = { ...theme[at], value: c.value };
          else theme.push({ key: c.key, label: c.key.replace(/-/g, ' ').replace(/^./, (m) => m.toUpperCase()), value: c.value });
        }
        const used = changes.filter((c) => isFontKey(c.key)).map((c) => c.value).filter((f) => !s.fonts.includes(f));
        return { ...s, theme, fonts: [...s.fonts, ...used] };
      });
      return 'Theme: ' + changes.map((c) => `${c.key} ${c.value}`).join(', ') + '.';
    }
    case 'set_page': {
      const done: string[] = [];
      if (i['stage'] !== undefined) {
        store.setStage(bool(i['stage'], 'stage')!);
        done.push(`stage ${i['stage'] ? 'on' : 'off'}`);
      }
      if (i['length'] !== undefined) {
        store.setPageLength(i['length'] === null ? null : num(i['length'], 'length', 0, 100000)!);
        done.push(`scrolls 0-${Math.round(store.pageRange())}`);
      }
      if (!done.length) throw new ToolError('Give stage or length.');
      return 'Page: ' + done.join(', ') + '.';
    }
    case 'search_art': {
      const query = str(i['query'], 'query', 80);
      const kind = oneOf(i['kind'], 'kind', ['vector', 'animated', 'picture'] as const) ?? 'vector';
      const sources = (await firstValueFrom(ctx.api.artSources())).filter((s) => s.available && s.kinds.includes(kind));
      const found: ArtItem[] = [];
      for (const source of sources) {
        if (found.length >= 8) break;
        try {
          const result = await firstValueFrom(ctx.api.searchArt(source.id, query, kind, 1));
          found.push(...result.items.filter((a) => !a.tooLarge).slice(0, 8 - found.length));
        } catch {
          // One library down doesn't stop the others.
        }
      }
      if (!found.length) return `Nothing found for "${query}". Try a simpler word.`;
      return found.map((a) => `${a.source} ${a.id} "${a.title.replace(/"/g, "'").slice(0, 50)}" ${a.kind}`).join('\n');
    }
    case 'add_art': {
      const item = { source: str(i['source'], 'source', 40), id: str(i['id'], 'id', 200), title: i['title'] === undefined ? '' : str(i['title'], 'title', 120) } as ArtItem;
      const x = num(i['x'], 'x', -400, 800);
      const y = num(i['y'], 'y', -1000, 100000);
      const where = x !== undefined || y !== undefined ? { x: x ?? CANVAS_WIDTH / 2, y: y ?? store.playhead() + 422 } : undefined;
      const ok = await store.importLibraryArt(item, where);
      if (!ok) throw new ToolError('That art could not be added. Try another result.');
      const id = store.primaryId()!;
      const w = num(i['w'], 'w', 8, 2000);
      if (w !== undefined) store.update(id, (e) => ({ ...e, w: round(w, 1), h: round(e.h * (w / Math.max(1, e.w)), 1) }));
      return `Added ${line(element(store.scene()!, id))}`;
    }
    case 'check_design': {
      await ctx.checked();
      const issues = store.issues();
      if (!issues.length) return 'All clear.';
      return issues.slice(0, 12).map((x) => `${x.severity}: ${x.message}${x.elementId ? ` (${x.elementId})` : ''}`).join('\n');
    }
    case 'show': {
      const list = i['ids'] === undefined ? [] : ids(i['ids']);
      list.forEach((id) => element(store.scene()!, id));
      if (list.length) store.selection.set(list);
      at(ctx, i['scroll']);
      return 'Shown.';
    }
    default:
      throw new ToolError(`There's no tool "${name}".`);
  }
}

// ----- Changing an element -------------------------------------------------------------------------

function update(el: DesignElement, i: Input, scene: DesignScene, ctx: ToolContext): DesignElement {
  let next = el;
  // Moving keeps its motion with it, as dragging on the timeline does.
  const x = num(i['x'], 'x', -2000, 2000);
  const y = num(i['y'], 'y', -2000, 100000);
  if (x !== undefined || y !== undefined) next = moveWhole(next, x === undefined ? 0 : x - el.x, y === undefined ? 0 : y - el.y);
  const w = num(i['w'], 'w', 1, 4000);
  const h = num(i['h'], 'h', 1, 100000);
  next = {
    ...next,
    ...(w !== undefined ? { w: round(w, 1) } : {}),
    ...(h !== undefined ? { h: round(h, 1) } : {}),
    ...(i['rotate'] !== undefined ? { rotate: num(i['rotate'], 'rotate', -360, 360)! } : {}),
    ...(i['scale'] !== undefined ? { scale: num(i['scale'], 'scale', 0.05, 10)! } : {}),
    ...(i['opacity'] !== undefined ? { opacity: num(i['opacity'], 'opacity', 0, 1)! } : {}),
    ...(i['name'] !== undefined ? { name: str(i['name'], 'name', 40) } : {}),
    ...(i['locked'] !== undefined ? { locked: bool(i['locked'], 'locked') } : {}),
  };

  if (next.text) {
    const runsNext = i['text'] !== undefined ? runs(str(i['text'], 'text', 2000), scene, ctx) : next.text.runs;
    next = { ...next, text: { ...next.text, runs: runsNext, style: typography(next.text.style, i, ctx) } };
  } else if (i['text'] !== undefined) throw new ToolError(`${el.id} isn't text${next.button ? '; use label for a button' : ''}.`);

  if (next.shape) {
    next = { ...next, shape: shapeStyle(next.shape, i, ctx) };
    const kind = oneOf(i['kind'], 'kind', ['rect', 'ellipse', 'line', 'polygon'] as const);
    if (kind) next = { ...next, shape: { ...next.shape!, kind, path: null } };
    const sides = int(i['sides'], 'sides', 3, 12);
    if (sides !== undefined) next = { ...next, shape: { ...next.shape!, sides } };
  }
  if (next.button) {
    next = {
      ...next,
      button: {
        ...next.button, ...buttonShape(next.button, i, ctx), style: typography(next.button.style, i, ctx),
        ...(i['label'] !== undefined ? { label: str(i['label'], 'label', 60) } : {}),
        ...(i['link'] !== undefined && next.type === 'link' ? { path: link(i['link'], ctx) } : {}),
      },
    };
  }
  if (next.dress) next = { ...next, dress: { ...next.dress, style: typography(next.dress.style, i, ctx) } };
  if (next.slot) {
    next = {
      ...next,
      slot: {
        ...next.slot,
        ...(i['label'] !== undefined ? { label: str(i['label'], 'label', 60) } : {}),
        ...(i['fit'] !== undefined ? { fit: oneOf(i['fit'], 'fit', ['cover', 'contain'] as const)! } : {}),
        ...(i['radius'] !== undefined ? { radius: num(i['radius'], 'radius', 0, 999)! } : {}),
      },
    };
  }
  if (next.image) {
    const asset = i['asset'] !== undefined ? str(i['asset'], 'asset', 80) : next.image.asset;
    if (scene.assets[asset]?.kind !== 'image') throw new ToolError(`"${asset}" isn't a photo in this design.`);
    next = {
      ...next,
      image: {
        ...next.image, asset,
        ...(i['fit'] !== undefined ? { fit: oneOf(i['fit'], 'fit', ['cover', 'contain'] as const)! } : {}),
        ...(i['radius'] !== undefined ? { radius: num(i['radius'], 'radius', 0, 999)! } : {}),
      },
    };
  }
  if (next.svg && i['asset'] !== undefined) {
    const asset = str(i['asset'], 'asset', 80);
    if (scene.assets[asset]?.kind !== 'svg') throw new ToolError(`"${asset}" isn't an illustration in this design.`);
    next = { ...next, svg: { asset, fills: {} } };
  }
  if (next === el) throw new ToolError('Nothing to change: give the fields to set.');
  return next;
}

function typography(style: Typography, i: Input, ctx: ToolContext): Typography {
  const next = { ...style };
  if (i['font'] !== undefined) next.font = font(i['font'], ctx);
  if (i['size'] !== undefined) next.size = num(i['size'], 'size', 6, 200)!;
  if (i['weight'] !== undefined) next.weight = int(i['weight'], 'weight', 100, 900)!;
  if (i['italic'] !== undefined) next.italic = bool(i['italic'], 'italic');
  if (i['uppercase'] !== undefined) next.uppercase = bool(i['uppercase'], 'uppercase');
  if (i['color'] !== undefined) next.color = color(i['color'], ctx, 'color', false);
  if (i['align'] !== undefined) next.align = oneOf(i['align'], 'align', ['left', 'center', 'right'] as const)!;
  if (i['valign'] !== undefined) next.valign = oneOf(i['valign'], 'valign', ['top', 'middle', 'bottom'] as const)!;
  if (i['line_height'] !== undefined) next.lineHeight = num(i['line_height'], 'line_height', 0.6, 3)!;
  if (i['letter_spacing'] !== undefined) next.letterSpacing = num(i['letter_spacing'], 'letter_spacing', -0.2, 1)!;
  return next;
}

function shapeStyle<T extends { fill?: string | null; stroke?: string | null; strokeWidth: number; radius: number }>(shape: T, i: Input, ctx: ToolContext): T {
  return {
    ...shape,
    ...(i['fill'] !== undefined ? { fill: color(i['fill'], ctx, 'fill', true) } : {}),
    ...(i['stroke'] !== undefined ? { stroke: color(i['stroke'], ctx, 'stroke', true) } : {}),
    ...(i['stroke_width'] !== undefined ? { strokeWidth: num(i['stroke_width'], 'stroke_width', 0, 40)! } : {}),
    ...(i['radius'] !== undefined ? { radius: num(i['radius'], 'radius', 0, 999)! } : {}),
  };
}

function buttonShape(button: { fill?: string | null; stroke?: string | null; strokeWidth: number; radius: number }, i: Input, ctx: ToolContext) {
  return shapeStyle(button, i, ctx);
}

// ----- Placing -------------------------------------------------------------------------------------

function box(el: DesignElement, i: Input, size: { w: number; h: number }): DesignElement {
  const w = num(i['w'], 'w', 1, 4000) ?? size.w;
  const h = num(i['h'], 'h', 1, 100000) ?? size.h;
  const x = num(i['x'], 'x', -2000, 2000) ?? (CANVAS_WIDTH - w) / 2;
  const y = num(i['y'], 'y', -2000, 100000) ?? el.y;
  return {
    ...el, x: round(x, 1), y: round(y, 1), w: round(w, 1), h: round(h, 1),
    ...(i['name'] !== undefined ? { name: str(i['name'], 'name', 40) } : {}),
  };
}

function insert(ctx: ToolContext, el: DesignElement, parent: unknown, what: string): string {
  const { store } = ctx;
  let parentId: string | null = null;
  if (parent !== undefined && parent !== null) {
    parentId = str(parent, 'parent', 40);
    if (element(store.scene()!, parentId).type !== 'group') throw new ToolError(`${parentId} isn't a group.`);
  }
  store.mutate((s) => insertElement(s, el, parentId));
  store.select(el.id);
  return `Added ${what}: ${line(el)}`;
}

/** Moves the editor to a scroll position, for tools that act "from here". */
function at(ctx: ToolContext, value: unknown): void {
  const scroll = num(value, 'at', 0, 100000);
  if (scroll !== undefined) ctx.store.playhead.set(Math.round(scroll));
}

// ----- Reading input -------------------------------------------------------------------------------

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function element(scene: DesignScene, id: string): DesignElement {
  const el = findElement(scene, id);
  if (!el) throw new ToolError(`No element "${id}". Check the outline (get_outline) for ids.`);
  return el;
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 100) throw new ToolError('ids must be a list of element ids.');
  return value.map((v) => str(v, 'id', 40));
}

function str(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new ToolError(`${field} must be text.`);
  if (value.length > max) throw new ToolError(`${field} is too long (at most ${max} characters).`);
  return value;
}

function num(value: unknown, field: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new ToolError(`${field} must be a number.`);
  return Math.min(max, Math.max(min, value));
}

function int(value: unknown, field: string, min: number, max: number): number | undefined {
  const n = num(value, field, min, max);
  return n === undefined ? undefined : Math.round(n);
}

function bool(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new ToolError(`${field} must be true or false.`);
  return value;
}

function oneOf<T extends string>(value: unknown, field: string, options: readonly T[]): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !options.includes(value as T)) throw new ToolError(`${field} must be one of: ${options.join(', ')}.`);
  return value as T;
}

function color(value: unknown, ctx: ToolContext, field: string, nullable: boolean): string | null {
  if (value === null && nullable) return null;
  const v = str(value, field, 40);
  if (HEX.test(v)) return v.toLowerCase();
  if (v.startsWith('theme:') && ctx.store.scene()!.theme.some((t) => `theme:${t.key}` === v && !isFontKey(t.key))) return v;
  throw new ToolError(`${field} must be a hex colour or a theme colour (theme:key) that the theme has.`);
}

function font(value: unknown, ctx: ToolContext): string {
  const v = str(value, 'font', 60);
  if (v.startsWith('theme:') && ctx.store.scene()!.theme.some((t) => `theme:${t.key}` === v && isFontKey(t.key))) return v;
  if (ctx.store.catalog()!.fonts.some((f) => f.id === v)) return v;
  throw new ToolError(`"${v}" isn't a font: use a font id from the catalog or a theme font.`);
}

function link(value: unknown, ctx: ToolContext): string {
  const v = str(value, 'link', 60);
  if (!ctx.store.catalog()!.linkPaths.includes(v)) throw new ToolError(`link must be one of: ${ctx.store.catalog()!.linkPaths.join(', ')}.`);
  return v;
}

function imagePaths(ctx: ToolContext): string[] {
  return ctx.store.catalog()!.variables.filter((v) => v.kind === 'image').map((v) => v.path);
}

/** Text with {{path}} fields into runs; a path the catalog or the design doesn't know is an error. */
export function runs(text: string, scene: DesignScene, ctx: Pick<ToolContext, 'store'>): DesignRun[] {
  const known = new Set([...ctx.store.catalog()!.variables.map((v) => v.path), ...scene.fields.map((f) => f.path)]);
  const out: DesignRun[] = [];
  const re = /\{\{\s*([a-zA-Z][\w.]*)\s*\}\}/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (!known.has(m[1])) throw new ToolError(`{{${m[1]}}} isn't a field. Use one from the catalog.`);
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ var: m[1] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out.length ? out : [{ text: '' }];
}

