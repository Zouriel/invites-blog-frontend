import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { environment } from '../../../environments/environment';
import {
  REFERENCE_VIEWPORT,
  type DesignCatalog, type DesignDetail, type DesignElement, type DesignKeyframe, type DesignPath, type DesignPreview, type DesignScene,
  type ElementType, type MotionPreset,
} from './model/scene';
import {
  applyPreset, cloneElement, createElement, findElement, flatten, groupElements, insertElement, pageHeight, parentOf,
  groupOffsetAt, moveWhole, placeAt, removeElement, reorderElement, scrollRange, trackOf, ungroupElement, updateElement,
  type ElementState,
} from './model/scene-ops';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'offline' | 'conflict';
export type SampleMode = 'filled' | 'empty' | 'roles';

const HISTORY_LIMIT = 150;
const SAVE_DELAY = 1200;
const PREVIEW_DELAY = 260;

/**
 * Everything the editor knows, as signals, scoped to one open design.
 *
 * <p><b>Edits.</b> Every change goes through {@link commit}, which pushes the previous scene onto the
 * undo stack. Drags don't commit while they move — the canvas draws them as an overlay and commits
 * once on release — so one gesture is one undo step and the preview isn't recompiled per pixel.</p>
 *
 * <p><b>Saving.</b> Autosave waits for a pause, sends the revision it started from, and treats a 409
 * as "changed elsewhere" rather than overwriting. A copy goes to IndexedDB first, so a crash, a closed
 * tab or a dropped connection costs nothing.</p>
 *
 * <p><b>Preview.</b> The server compiles; this asks it to, a moment after the last edit, and drops any
 * answer that arrives after a newer one.</p>
 */
@Injectable()
export class DesignStore {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalog = signal<DesignCatalog | null>(null);
  readonly design = signal<DesignDetail | null>(null);
  readonly scene = signal<DesignScene | null>(null);
  readonly name = signal('');
  readonly loadError = signal<string | null>(null);

  // Editing state
  readonly selection = signal<string[]>([]);
  readonly selectedKeyframe = signal<number | null>(null);
  readonly playhead = signal(0);
  readonly hidden = signal<ReadonlySet<string>>(new Set());
  readonly editingTextId = signal<string | null>(null);
  /** The shape open in the shape editor, if any. */
  readonly shapeEditorId = signal<string | null>(null);
  /** A field chip was tapped while a text field had focus: whichever token input has focus inserts it. */
  readonly tokenRequest = signal<{ path: string; seq: number } | null>(null);

  // Preview state
  readonly sample = signal<SampleMode>('filled');
  readonly blocks = signal<string[] | null>(null);
  readonly preview = signal<DesignPreview | null>(null);
  readonly previewLoading = signal(false);
  readonly previewFailed = signal(false);

  // Persistence state
  readonly saveState = signal<SaveState>('saved');
  readonly revision = signal(0);
  readonly recovered = signal<{ scene: DesignScene; name: string; savedAt: string } | null>(null);

  private readonly past = signal<DesignScene[]>([]);
  private readonly future = signal<DesignScene[]>([]);
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  readonly primaryId = computed(() => this.selection().at(-1) ?? null);
  readonly primary = computed(() => {
    const scene = this.scene();
    return scene ? findElement(scene, this.primaryId()) : null;
  });
  readonly flat = computed(() => (this.scene() ? flatten(this.scene()!) : []));
  readonly range = computed(() => (this.scene() ? scrollRange(this.scene()!) : 0));
  readonly pageHeight = computed(() => (this.scene() ? pageHeight(this.scene()!) : 0));
  readonly issues = computed(() => this.preview()?.issues ?? []);
  readonly errorCount = computed(() => this.issues().filter((i) => i.severity === 'error').length);
  readonly unpublished = computed(() => {
    const d = this.design();
    return !d?.publishedRevision || d.publishedRevision < this.revision() || this.saveState() !== 'saved';
  });

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private backupTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSeq = 0;
  private saving = false;
  private saveAgain = false;

  constructor() {
    // Recompile whenever what the preview shows changes. The playhead is read untracked: scrolling
    // is sent to the frame directly, and recompiling on every scroll would thrash.
    effect(() => {
      const scene = this.scene();
      const sample = this.sample();
      const blocks = this.blocks();
      const hidden = this.hidden();
      if (!scene) return;
      untracked(() => this.schedulePreview(scene, sample, blocks, hidden));
    });

    this.destroyRef.onDestroy(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      if (this.previewTimer) clearTimeout(this.previewTimer);
      if (this.backupTimer) clearTimeout(this.backupTimer);
      // Leaving with unsaved edits: one last attempt, fire-and-forget. The IndexedDB copy covers a miss.
      if (this.saveState() === 'dirty') void this.save();
    });
  }

  // ----- Loading -----------------------------------------------------------------------------------

  async load(id: string): Promise<void> {
    this.loadError.set(null);
    try {
      const [catalog, design] = await Promise.all([
        this.catalog() ? Promise.resolve(this.catalog()!) : firstValueFrom(this.api.designCatalog()),
        firstValueFrom(this.api.getDesign(id)),
      ]);
      this.catalog.set(catalog);
      this.adopt(design);
      await this.loadFontsForEditor(catalog);

      const backup = await readBackup(id);
      if (backup && backup.revision === design.revision && JSON.stringify(backup.scene) !== JSON.stringify(design.scene))
        this.recovered.set({ scene: backup.scene, name: backup.name, savedAt: backup.savedAt });
    } catch (e) {
      this.loadError.set((e as Error).message || 'This design could not be opened.');
    }
  }

  private adopt(design: DesignDetail): void {
    this.design.set(design);
    this.scene.set(design.scene);
    this.name.set(design.name);
    this.revision.set(design.revision);
    this.saveState.set('saved');
    this.past.set([]);
    this.future.set([]);
  }

  /** Makes the catalog fonts available to the editor page itself — for the font menu and the poster. */
  private async loadFontsForEditor(catalog: DesignCatalog): Promise<void> {
    if (typeof FontFace === 'undefined') return;
    const base = assetUrl(catalog.fontBaseUrl);
    const loads = catalog.fonts.flatMap((font) =>
      font.weights.map(async (weight) => {
        try {
          const face = new FontFace(font.name, `url("${base}${font.id}-${weight}.woff2") format("woff2")`, { weight: String(weight) });
          document.fonts.add(await face.load());
        } catch {
          // A missing font only makes the menu less pretty; the preview loads its own.
        }
      }));
    await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 1500))]);
  }

  restoreRecovered(): void {
    const r = this.recovered();
    if (!r) return;
    this.commit(r.scene);
    this.name.set(r.name);
    this.recovered.set(null);
  }

  discardRecovered(): void {
    this.recovered.set(null);
    const d = this.design();
    if (d) void clearBackup(d.id);
  }

  // ----- History -----------------------------------------------------------------------------------

  private coalesce: { key: string; at: number } | null = null;

  /**
   * Replaces the scene as one undoable step. Commits sharing a `coalesceKey` in quick succession —
   * typing a number, dragging a slider — fold into the first one's step.
   */
  commit(next: DesignScene, coalesceKey?: string): void {
    const current = this.scene();
    if (!current || next === current) return;
    const now = Date.now();
    const folds = !!coalesceKey && this.coalesce?.key === coalesceKey && now - this.coalesce.at < 900 && this.past().length > 0;
    this.coalesce = coalesceKey ? { key: coalesceKey, at: now } : null;
    if (folds) {
      this.future.set([]);
      this.scene.set(next);
      this.markDirty();
      return;
    }
    this.past.update((p) => [...p.slice(-(HISTORY_LIMIT - 1)), current]);
    this.future.set([]);
    this.scene.set(next);
    this.pruneSelection(next);
    this.markDirty();
  }

  mutate(fn: (scene: DesignScene) => DesignScene, coalesceKey?: string): void {
    const current = this.scene();
    if (current) this.commit(fn(current), coalesceKey);
  }

  undo(): void {
    const past = this.past();
    const current = this.scene();
    if (!past.length || !current) return;
    this.past.set(past.slice(0, -1));
    this.future.update((f) => [current, ...f]);
    this.scene.set(past[past.length - 1]);
    this.pruneSelection(past[past.length - 1]);
    this.markDirty();
  }

  redo(): void {
    const future = this.future();
    const current = this.scene();
    if (!future.length || !current) return;
    this.future.set(future.slice(1));
    this.past.update((p) => [...p, current]);
    this.scene.set(future[0]);
    this.pruneSelection(future[0]);
    this.markDirty();
  }

  rename(name: string): void {
    const trimmed = name.trim();
    if (!trimmed || trimmed === this.name()) return;
    this.name.set(trimmed.slice(0, 80));
    this.markDirty();
  }

  private pruneSelection(scene: DesignScene): void {
    const ids = new Set(flatten(scene).map((f) => f.element.id));
    const kept = this.selection().filter((id) => ids.has(id));
    if (kept.length !== this.selection().length) this.selection.set(kept);
  }

  // ----- Saving ------------------------------------------------------------------------------------

  private markDirty(): void {
    if (this.saveState() === 'conflict') return;
    this.saveState.set('dirty');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), SAVE_DELAY);
    if (this.backupTimer) clearTimeout(this.backupTimer);
    this.backupTimer = setTimeout(() => {
      const d = this.design();
      const scene = this.scene();
      if (d && scene) void writeBackup(d.id, { scene, name: this.name(), revision: this.revision(), savedAt: new Date().toISOString() });
    }, 400);
  }

  /** Saves now. Resolves true once the server has the latest scene. */
  async save(): Promise<boolean> {
    const design = this.design();
    const scene = this.scene();
    if (!design || !scene) return false;
    if (this.saveState() === 'saved') return true;
    if (this.saveState() === 'conflict') return false;
    if (this.saving) {
      this.saveAgain = true;
      return false;
    }
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saving = true;
    this.saveState.set('saving');
    try {
      const result = await firstValueFrom(this.api.saveDesign(design.id, scene, this.name(), this.revision()));
      this.revision.set(result.revision);
      const changedMeanwhile = this.scene() !== scene || this.saveAgain;
      this.saveAgain = false;
      if (changedMeanwhile) {
        this.saving = false;
        this.saveState.set('dirty');
        return this.save();
      }
      this.saveState.set('saved');
      void writeBackup(design.id, { scene, name: this.name(), revision: result.revision, savedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status === 409) {
        this.saveState.set('conflict');
      } else {
        this.saveState.set('offline');
        // Try again shortly; the local copy is already safe.
        this.saveTimer = setTimeout(() => {
          if (this.saveState() === 'offline') {
            this.saveState.set('dirty');
            void this.save();
          }
        }, 5000);
      }
      return false;
    } finally {
      this.saving = false;
    }
  }

  /** After a conflict: take the server's version. The local edits stay in IndexedDB until the next save. */
  async reloadFromServer(): Promise<void> {
    const d = this.design();
    if (!d) return;
    const fresh = await firstValueFrom(this.api.getDesign(d.id));
    this.adopt(fresh);
  }

  /** Called by publish/visibility flows that return the updated design. */
  replaceDesign(design: DesignDetail): void {
    this.design.set(design);
    this.revision.set(design.revision);
  }

  // ----- Preview -----------------------------------------------------------------------------------

  private schedulePreview(scene: DesignScene, sample: SampleMode, blocks: string[] | null, hidden: ReadonlySet<string>): void {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.refreshPreview(scene, sample, blocks, hidden), PREVIEW_DELAY);
  }

  private async refreshPreview(scene: DesignScene, sample: SampleMode, blocks: string[] | null, hidden: ReadonlySet<string>): Promise<void> {
    const seq = ++this.previewSeq;
    this.previewLoading.set(true);
    try {
      const result = await firstValueFrom(this.api.previewDesign({
        scene, sample, blocks, hidden: [...hidden], scroll: this.playhead(), editor: true,
      }));
      if (seq !== this.previewSeq) return;
      this.preview.set({ ...result, html: absolutizeAssets(result.html) });
      this.previewFailed.set(false);
    } catch {
      if (seq === this.previewSeq) this.previewFailed.set(true);
    } finally {
      if (seq === this.previewSeq) this.previewLoading.set(false);
    }
  }

  // ----- Selection ---------------------------------------------------------------------------------

  select(id: string | null, additive = false): void {
    this.selectedKeyframe.set(null);
    if (!id) {
      this.selection.set([]);
      return;
    }
    if (additive) {
      this.selection.update((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    } else {
      this.selection.set([id]);
    }
  }

  // ----- Elements ----------------------------------------------------------------------------------

  /** Adds an element of a type at the middle of the current screen, and selects it. */
  add(type: ElementType, extra: Partial<DesignElement> = {}, at?: { x: number; y: number }): DesignElement | null {
    const scene = this.scene();
    if (!scene) return null;
    const centerY = at?.y ?? this.playhead() + REFERENCE_VIEWPORT / 2;
    let el = createElement(scene, type, centerY, extra);
    if (at) el = { ...el, x: Math.round(at.x - el.w / 2) };
    this.commit(insertElement(scene, el));
    this.select(el.id);
    return el;
  }

  update(id: string, fn: (el: DesignElement) => DesignElement, coalesceKey?: string): void {
    this.mutate((s) => updateElement(s, id, fn), coalesceKey);
  }

  remove(ids: string[] = this.selection()): void {
    if (!ids.length) return;
    this.mutate((s) => ids.reduce((acc, id) => removeElement(acc, id), s));
    this.selection.set([]);
  }

  duplicate(ids: string[] = this.selection()): void {
    const scene = this.scene();
    if (!scene || !ids.length) return;
    let next = scene;
    const created: string[] = [];
    for (const id of ids) {
      const flat = flatten(next).find((f) => f.element.id === id);
      if (!flat) continue;
      const copy = cloneElement(flat.element);
      next = insertElement(next, copy, flat.parentId, flat.index + 1);
      created.push(copy.id);
    }
    this.commit(next);
    this.selection.set(created);
  }

  group(): void {
    const scene = this.scene();
    if (!scene) return;
    const result = groupElements(scene, this.selection());
    if (!result.groupId) {
      this.toast.info('Select two or more elements side by side in the same group to group them.');
      return;
    }
    this.commit(result.scene);
    this.selection.set([result.groupId]);
  }

  ungroup(): void {
    const id = this.primaryId();
    const scene = this.scene();
    if (!id || !scene) return;
    const el = findElement(scene, id);
    if (el?.type !== 'group') return;
    const childIds = (el.children ?? []).map((c) => c.id);
    this.commit(ungroupElement(scene, id));
    this.selection.set(childIds);
  }

  /** Moves an element forward (+1) or back (-1) in paint order among its siblings. */
  arrange(id: string, delta: number | 'front' | 'back'): void {
    const scene = this.scene();
    if (!scene) return;
    const flat = flatten(scene).find((f) => f.element.id === id);
    if (!flat) return;
    const siblings = flat.parentId ? findElement(scene, flat.parentId)?.children ?? [] : scene.elements;
    const to = delta === 'front' ? siblings.length - 1 : delta === 'back' ? 0 : flat.index + delta;
    this.commit(reorderElement(scene, id, Math.max(0, Math.min(siblings.length - 1, to))));
  }

  toggleHidden(id: string): void {
    this.hidden.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * A move/rotate/scale from the canvas, applied at the playhead: edits the keyframe there, or makes
   * one. Returns true when a keyframe was created, so the canvas can offer Undo.
   */
  place(id: string, change: Partial<ElementState>, size?: { w: number; h: number }, coalesceKey?: string): boolean {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return false;
    // A group's children are placed relative to it; the canvas works in page units.
    const parent = parentOf(scene, id);
    let local = change;
    if (parent) {
      const offset = groupOffsetAt(scene, id, this.playhead());
      local = {
        ...change,
        ...(change.x !== undefined ? { x: change.x - offset.x } : {}),
        ...(change.y !== undefined ? { y: change.y - offset.y } : {}),
      };
    }
    // Undo the pin offset: the canvas shows a pinned element where it is on screen, the scene stores where it starts.
    if (el.pinned && local.y !== undefined) {
      const track = trackOf(scene, el);
      local = { ...local, y: local.y - Math.min(track.end - track.start, Math.max(0, this.playhead() - track.start)) };
    }
    const result = placeAt(scene, el, this.playhead(), round2(local));
    const next = size ? { ...result.element, w: Math.round(size.w * 10) / 10, h: Math.round(size.h * 10) / 10 } : result.element;
    this.commit(updateElement(scene, id, () => next), coalesceKey);
    return result.created;
  }

  // ----- Drawn shapes -------------------------------------------------------------------------------

  openShapeEditor(id: string): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (el?.type !== 'shape') return;
    this.editingTextId.set(null);
    this.select(id);
    this.shapeEditorId.set(id);
  }

  /**
   * Replaces a shape with what was drawn for it. `box` is where the drawing's bounds sit in the old
   * shape's own units: the element is resized to it and moved so the drawing stays where it was drawn,
   * rotation and keyframes included.
   */
  applyDrawnShape(id: string, path: DesignPath, box: { x: number; y: number; w: number; h: number }): void {
    this.update(id, (el) => {
      const rad = (el.rotate * Math.PI) / 180;
      const dx = (box.x + box.w / 2 - el.w / 2) * el.scale;
      const dy = (box.y + box.h / 2 - el.h / 2) * el.scale;
      const cx = el.x + el.w / 2 + dx * Math.cos(rad) - dy * Math.sin(rad);
      const cy = el.y + el.h / 2 + dx * Math.sin(rad) + dy * Math.cos(rad);
      const moved = moveWhole(el, cx - box.w / 2 - el.x, cy - box.h / 2 - el.y);
      const shape = el.shape ?? { kind: 'rect' as const, sides: 6, strokeWidth: 0, radius: 0, fill: null, stroke: null };
      return { ...moved, w: Math.round(box.w * 10) / 10, h: Math.round(box.h * 10) / 10, shape: { ...shape, kind: 'path', path } };
    });
  }

  // ----- Motion ------------------------------------------------------------------------------------

  /** Sets how far in front an animated element is at the playhead, on the keyframe there (made if needed). */
  setLiftAtPlayhead(id: string, lift: number): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el || !el.keyframes.length) return;
    const value = Math.max(0, Math.min(99, Math.round(lift)));
    const result = placeAt(scene, el, this.playhead(), { lift: value });
    this.commit(updateElement(scene, id, () => result.element), `${id}:lift:${Math.round(this.playhead())}`);
  }

  setTrack(id: string, start: number, end: number): void {
    const range = this.range();
    const s = Math.max(0, Math.min(range, Math.round(start)));
    const e = Math.max(s + 1, Math.min(range, Math.round(end)));
    this.update(id, (el) => ({ ...el, track: { start: s, end: e } }));
  }

  addKeyframeAtPlayhead(id: string): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    const next = placeAt(scene, el.keyframes.length ? el : { ...el, keyframes: [{ t: 0 }, { t: 1 }] }, this.playhead(), {});
    const withTrack = next.element.track ? next.element : { ...next.element, track: { start: 0, end: Math.max(1, scrollRange(scene)) } };
    this.update(id, () => withTrack);
  }

  updateKeyframe(id: string, index: number, patch: Partial<DesignKeyframe>): void {
    this.update(id, (el) => {
      const keyframes = el.keyframes.map((k, i) => (i === index ? { ...k, ...patch, preset: patch.t !== undefined ? null : k.preset } : k));
      return { ...el, keyframes };
    });
  }

  /** Retimes a keyframe; returns its index after re-sorting. */
  moveKeyframe(id: string, index: number, t: number): number {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!el) return index;
    const moved = { ...el.keyframes[index], t: Math.min(1, Math.max(0, Math.round(t * 1000) / 1000)), preset: null };
    const keyframes = el.keyframes.map((k, i) => (i === index ? moved : k)).sort((a, b) => a.t - b.t);
    this.update(id, (e) => ({ ...e, keyframes }));
    return keyframes.indexOf(moved);
  }

  removeKeyframe(id: string, index: number): void {
    this.update(id, (el) => ({ ...el, keyframes: el.keyframes.filter((_, i) => i !== index) }));
    this.selectedKeyframe.set(null);
  }

  setPreset(id: string, slot: 'enter' | 'exit', presetId: string | null): void {
    const catalog = this.catalog();
    const scene = this.scene();
    if (!catalog || !scene) return;
    const list: MotionPreset[] = slot === 'enter' ? catalog.enterPresets : catalog.exitPresets;
    const preset = presetId ? list.find((p) => p.id === presetId) ?? null : null;
    this.update(id, (el) => {
      let next = applyPreset(el, preset, slot);
      // A preset needs a track to play over: start it as the element comes up the screen.
      if (preset && !el.track) {
        const start = Math.max(0, Math.min(scrollRange(scene), el.y - REFERENCE_VIEWPORT * 0.9));
        next = { ...next, track: { start, end: Math.min(scrollRange(scene), start + 1200) || start + 1 } };
      }
      return next;
    });
  }

  // ----- Assets ------------------------------------------------------------------------------------

  async importAsset(file: File, at?: { x: number; y: number }): Promise<void> {
    try {
      const asset = await firstValueFrom(this.api.uploadDesignAsset(file));
      const scene = this.scene();
      if (!scene) return;
      const maxW = 280;
      const ratio = asset.width > 0 && asset.height > 0 ? asset.height / asset.width : 1;
      const w = Math.min(maxW, asset.width || maxW);
      const h = Math.round(w * ratio);
      const withAsset: DesignScene = {
        ...scene,
        assets: { ...scene.assets, [asset.id]: { kind: asset.kind, data: asset.data, width: asset.width, height: asset.height, colors: asset.colors ?? null, name: asset.name } },
      };
      const centerY = at?.y ?? this.playhead() + REFERENCE_VIEWPORT / 2;
      let el = createElement(withAsset, asset.kind, centerY, { w, h, name: asset.name });
      el = { ...el, y: Math.round(centerY - h / 2), x: Math.round((at?.x ?? 195) - w / 2) };
      if (asset.kind === 'svg') el.svg = { asset: asset.id, fills: {} };
      else el.image = { asset: asset.id, fit: 'contain', radius: 0 };
      this.commit(insertElement(withAsset, el));
      this.select(el.id);
    } catch {
      // The API already said why.
    }
  }
}

// ----- Helpers -----------------------------------------------------------------------------------

function round2(change: Partial<ElementState>): Partial<ElementState> {
  const out: Partial<ElementState> = {};
  for (const [k, v] of Object.entries(change) as [keyof ElementState, number][])
    out[k] = k === 'opacity' || k === 'scale' ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10;
  return out;
}

/** The preview references fonts at the API's `/assets`; in development that isn't this origin. */
export function assetUrl(path: string): string {
  if (/^https?:/.test(path)) return path;
  const base = environment.assetsBase.replace(/\/assets\/?$/, '');
  return path.startsWith('/') && base.startsWith('http') ? base + path : path;
}

function absolutizeAssets(html: string): string {
  const base = environment.assetsBase.replace(/\/$/, '');
  if (!base.startsWith('http')) return html;
  return html.replaceAll('url("/assets/', `url("${base}/`);
}

// ----- IndexedDB crash copy ----------------------------------------------------------------------

interface Backup {
  scene: DesignScene;
  name: string;
  revision: number;
  savedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ib-designer', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('backups');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function writeBackup(id: string, backup: Backup): Promise<void> {
  try {
    const db = await openDb();
    db.transaction('backups', 'readwrite').objectStore('backups').put(backup, id);
  } catch {
    // Private windows and full disks: the server copy still exists.
  }
}

async function readBackup(id: string): Promise<Backup | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const req = db.transaction('backups', 'readonly').objectStore('backups').get(id);
      req.onsuccess = () => resolve((req.result as Backup) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function clearBackup(id: string): Promise<void> {
  try {
    const db = await openDb();
    db.transaction('backups', 'readwrite').objectStore('backups').delete(id);
  } catch {
    // Nothing to clear.
  }
}
