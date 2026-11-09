import { DestroyRef, Injectable, computed, effect, inject, isDevMode, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { environment } from '../../../environments/environment';
import { canonicalHtml, firstDifference, renderPreview } from './render';
import { placeArt } from './model/art-place';
import { shownSize } from './model/asset-size';
import { layoutIssues } from './model/layout-check';
import { clearScreen, copyScreen } from './model/screens';
import { renderScreen } from './model/poster';
import { followPath, staggerChildren, type StaggerOrder } from './model/motion-tools';
import { buildSticker } from './model/stickers';
import { repeatElement, type RepeatSpec } from './model/repeat';
import { generate, newSeed, regenerate, generatedOf, type GeneratorOptions } from './model/generators';
import { combineShapes, type CombineOp } from './model/combine';
import { applyMove, PACES, type EffectMove, type Pace } from './model/effect-moves';
import { keyframeNotes, retimeTrack, tOn, withPreset, type KeyframeNote } from './model/keyframe-timing';
import {
  CANVAS_WIDTH, REFERENCE_VIEWPORT,
  type AiPictureShape, type ArtImport, type ArtItem, type DesignCatalog, type DesignTrack, type DesignDetail, type DesignElement, type DesignKeyframe, type DesignPath, type DesignPreview, type DesignScene,
  type ElementType, type MotionPreset,
} from './model/scene';
import {
  applyLoop, applyPreset, cloneElement, createElement, findElement, resizeGroup, withoutUnusedAssets, flatten, groupElements, insertElement, parentOf,
  contentRange, groupOffsetAt, MAX_PAGE_HEIGHT, moveWhole, pinOffsetAt, placeAt, removeElement, reorderElement, sameScene, scrollRange, timelineLength, trackOf,
  labelOf, round, ungroupElement, updateElement, upgradeScene,
  type ElementState,
} from './model/scene-ops';

export type SaveState = 'saved' | 'dirty' | 'saving' | 'offline' | 'conflict' | 'refused';
export type SampleMode = 'filled' | 'empty' | 'roles';

const HISTORY_LIMIT = 150;
const SAVE_DELAY = 1200;
/** A pause long enough to skip the keystrokes in between, short enough to feel instant. */
const PREVIEW_DELAY = 40;
/** Check (issues, size, what the inviter fills in) comes from the server; it can take its time. */
const CHECK_DELAY = 900;

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
 * <p><b>Preview.</b> Rendered here, in the browser, by a port of the server's compiler (`./render`) —
 * so an edit shows at once. The server still compiles everything that is published, and Check (issues,
 * structure, whether it can publish) comes from it a moment later; late answers are dropped. If the
 * browser render ever fails, the server's preview is used instead.</p>
 */
@Injectable()
export class DesignStore {
  private readonly api = inject(ApiService);
  private readonly snackbar = inject(UiSnackbarService);
  private readonly destroyRef = inject(DestroyRef);

  readonly catalog = signal<DesignCatalog | null>(null);
  readonly design = signal<DesignDetail | null>(null);
  readonly scene = signal<DesignScene | null>(null);
  readonly name = signal('');
  readonly loadError = signal<string | null>(null);
  /** The asset being shrunk, while the server works on it. */
  readonly shrinking = signal<string | null>(null);
  /** The picture whose background is being removed, while the server works on it. */
  readonly removingBackground = signal<string | null>(null);

  // Editing state
  readonly selection = signal<string[]>([]);
  readonly selectedKeyframe = signal<number | null>(null);
  readonly playhead = signal(0);
  readonly hidden = signal<ReadonlySet<string>>(new Set());
  readonly editingTextId = signal<string | null>(null);
  /** The shape open in the shape editor, if any. */
  readonly shapeEditorId = signal<string | null>(null);
  /**
   * The tool picked on the desktop rail, waiting to be drawn on the page (null: the pointer selects).
   * Its options bar sets how it will look; a drag on the canvas draws it there, a click drops it at
   * its usual size.
   */
  readonly drawTool = signal<DrawTool | null>(null);
  /** How drawn shapes and text look, kept between uses (the options bar edits it). */
  readonly drawStyle = signal<DrawStyle>(DEFAULT_DRAW_STYLE);
  /** A field chip was tapped while a text field had focus: whichever token input has focus inserts it. */
  readonly tokenRequest = signal<{ path: string; seq: number } | null>(null);

  // Preview state
  readonly sample = signal<SampleMode>('filled');
  readonly blocks = signal<string[] | null>(null);
  readonly preview = signal<DesignPreview | null>(null);
  readonly previewFailed = signal(false);

  // Persistence state
  readonly saveState = signal<SaveState>('saved');
  /** Why the server refused the last save (too big, invalid), for the editor to show; null otherwise. */
  readonly saveProblem = signal<string | null>(null);
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
  /** The timeline's length: the page, one screen past its end, and any motion running further. */
  readonly range = computed(() => (this.scene() ? timelineLength(this.scene()!) : 0));
  /** How far a guest can scroll: the page ends where its lowest element does. */
  readonly pageRange = computed(() => (this.scene() ? scrollRange(this.scene()!) : 0));
  /** Check: the server's findings, and how things sit on the phone (see layoutIssues). */
  readonly issues = computed(() => {
    const scene = this.scene();
    const server = this.preview()?.issues ?? [];
    // The server already says when something is off the page; don't say it twice.
    const offPage = new Set(server.filter((i) => i.code === 'off_page').map((i) => i.elementId));
    return [...server, ...(scene ? layoutIssues(scene).filter((i) => !(i.code === 'off_screen' && offPage.has(i.elementId))) : [])];
  });
  readonly errorCount = computed(() => this.issues().filter((i) => i.severity === 'error').length);
  readonly unpublished = computed(() => {
    const d = this.design();
    return !d?.publishedRevision || d.publishedRevision < this.revision() || this.saveState() !== 'saved';
  });

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private backupTimer: ReturnType<typeof setTimeout> | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private checkTimer: ReturnType<typeof setTimeout> | null = null;
  private previewSeq = 0;
  private checkSeq = 0;
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
      if (this.checkTimer) clearTimeout(this.checkTimer);
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
      const kept = backup ? upgradeScene(backup.scene) : null;
      if (backup && kept && backup.revision === design.revision && !sameScene(kept, this.scene()!))
        this.recovered.set({ scene: kept, name: backup.name, savedAt: backup.savedAt });
    } catch (e) {
      this.loadError.set((e as Error).message || 'This design could not be opened.');
    }
  }

  private adopt(design: DesignDetail): void {
    this.design.set(design);
    this.scene.set(upgradeScene(design.scene));
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
    if (this.batch) {
      // Inside a transaction: the step it opened is the only one; everything since folds into it.
      this.future.set([]);
      this.scene.set(next);
      this.pruneSelection(next);
      this.markDirty();
      return;
    }
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

  private batch: { before: DesignScene } | null = null;

  /** A note for the person, with or without Undo. Quiet while the assistant works: it reports in the chat. */
  private note(...args: Parameters<UiSnackbarService['show']>): void {
    if (!this.batch) this.snackbar.show(...args);
  }

  /** True while a transaction is open (the assistant is working). */
  readonly inTransaction = signal(false);

  /**
   * Opens one undo step that every edit until {@link endTransaction} folds into, however far apart
   * they come: the design assistant's tool calls arrive seconds apart, and one message from the person
   * should undo in one go. Returns false when one is already open.
   */
  beginTransaction(): boolean {
    const scene = this.scene();
    if (!scene || this.batch) return false;
    this.batch = { before: scene };
    this.coalesce = null;
    this.inTransaction.set(true);
    return true;
  }

  /** Closes the step. Returns true when the scene changed (so there is something to undo). */
  endTransaction(): boolean {
    const batch = this.batch;
    this.batch = null;
    this.inTransaction.set(false);
    const current = this.scene();
    if (!batch || !current || current === batch.before) return false;
    this.past.update((p) => [...p.slice(-(HISTORY_LIMIT - 1)), batch.before]);
    this.future.set([]);
    return true;
  }

  mutate(fn: (scene: DesignScene) => DesignScene, coalesceKey?: string): void {
    const current = this.scene();
    if (current) this.commit(fn(current), coalesceKey);
  }

  undo(): void {
    if (this.batch) this.endTransaction();
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
      // Files nothing shows any more (art deleted or replaced) are left out of what's saved: they'd
      // only weigh against the size limit. They stay here until reload, so Undo can still bring that
      // art back, and it's saved again with it.
      const sending = withoutUnusedAssets(scene).scene;
      const result = await firstValueFrom(this.api.saveDesign(design.id, sending, this.name(), this.revision()));
      this.saveProblem.set(null);
      this.revision.set(result.revision);
      const changedMeanwhile = this.scene() !== scene || this.saveAgain;
      this.saveAgain = false;
      if (changedMeanwhile) {
        this.saving = false;
        this.saveState.set('dirty');
        return this.save();
      }
      this.saveState.set('saved');
      void writeBackup(design.id, { scene: sending, name: this.name(), revision: result.revision, savedAt: new Date().toISOString() });
      return true;
    } catch (e) {
      const status = (e as { status?: number }).status ?? 0;
      if (status === 409) {
        this.saveState.set('conflict');
      } else if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        // Refused, not offline: trying again can't help until the design changes. Say why.
        const message = (e as { error?: { message?: string } }).error?.message ?? 'The server would not save this design.';
        this.saveProblem.set(message);
        this.saveState.set('refused');
        this.note({ title: 'Not saved', message: `${message} Your changes are kept on this device.` });
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
    this.previewTimer = setTimeout(() => this.renderLocally(scene, sample, blocks, hidden), PREVIEW_DELAY);
    if (this.checkTimer) clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => void this.check(scene), CHECK_DELAY);
  }

  /** The preview, rendered in the browser. Issues and structure carry over until Check answers. */
  private renderLocally(scene: DesignScene, sample: SampleMode, blocks: string[] | null, hidden: ReadonlySet<string>): void {
    const catalog = this.catalog();
    if (!catalog) return void this.refreshPreview(scene, sample, blocks, hidden);
    let rendered;
    try {
      rendered = renderPreview(scene, catalog, {
        fontBaseUrl: catalog.fontBaseUrl, sample, blocks, hidden, scroll: this.playhead(), editor: true,
      });
    } catch (e) {
      if (isDevMode()) console.error('Designer: the browser preview failed; asking the server instead.', e);
      return void this.refreshPreview(scene, sample, blocks, hidden);
    }
    ++this.previewSeq;
    const previous = this.preview();
    this.preview.set({
      html: absolutizeAssets(rendered.html),
      bytes: rendered.bytes,
      issues: previous?.issues ?? [],
      structure: previous?.structure ?? { fields: [], imageSlots: [], roles: [], themeKeys: [] },
      canPublish: previous?.canPublish ?? true,
    });
    this.previewFailed.set(false);
  }

  /** Check, from the server: issues, what the inviter will fill in, and whether it can be published. */
  private async check(scene: DesignScene): Promise<void> {
    const seq = ++this.checkSeq;
    try {
      const result = await firstValueFrom(this.api.previewDesign({ scene, sample: 'filled', editor: false }));
      if (seq !== this.checkSeq) return;
      const current = this.preview();
      if (current) this.preview.set({ ...current, issues: result.issues, structure: result.structure, canPublish: result.canPublish, bytes: result.bytes });
      if (isDevMode()) this.reportDrift(scene, result.html);
    } catch {
      // Check is advisory while editing; publishing checks again on the server.
    }
  }

  /**
   * Development only: the server's page against the browser's, for the scene just checked. They should
   * be the same document; if they aren't, the TypeScript renderer has drifted from the C# compiler.
   */
  private reportDrift(scene: DesignScene, serverHtml: string): void {
    const catalog = this.catalog();
    if (!catalog) return;
    try {
      const ours = renderPreview(scene, catalog, { fontBaseUrl: catalog.fontBaseUrl, sample: 'filled', editor: false }).html;
      const diff = firstDifference(canonicalHtml(ours), canonicalHtml(serverHtml));
      if (diff) console.warn('Designer: the browser preview differs from the server’s — the renderers have drifted.', diff);
    } catch (e) {
      console.warn('Designer: could not compare the browser preview with the server’s.', e);
    }
  }

  /** The server's preview — used when the browser render isn't possible. */
  private async refreshPreview(scene: DesignScene, sample: SampleMode, blocks: string[] | null, hidden: ReadonlySet<string>): Promise<void> {
    const seq = ++this.previewSeq;
    try {
      const result = await firstValueFrom(this.api.previewDesign({
        scene, sample, blocks, hidden: [...hidden], scroll: this.playhead(), editor: true,
      }));
      if (seq !== this.previewSeq) return;
      this.preview.set({ ...result, html: absolutizeAssets(result.html) });
      this.previewFailed.set(false);
    } catch {
      if (seq === this.previewSeq) this.previewFailed.set(true);
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
    const centerY = this.onScreen(at?.y ?? this.playhead() + REFERENCE_VIEWPORT / 2);
    let el = createElement(scene, type, centerY, extra);
    if (at) el = { ...el, x: Math.round(at.x - el.w / 2) };
    this.commit(insertElement(scene, el));
    this.select(el.id);
    return el;
  }

  /**
   * Adds an element in a box drawn on the canvas (screen units: the phone at the playhead), and
   * selects it. A line is drawn from one end to the other: `line` gives its two ends instead.
   */
  addDrawn(type: DrawableType, box: { x: number; y: number; w: number; h: number }, line?: { x1: number; y1: number; x2: number; y2: number }): DesignElement | null {
    const scene = this.scene();
    if (!scene) return null;
    const style = this.drawStyle();
    let extra: Partial<DesignElement> = {};
    if (type === 'shape') {
      const base = createElement(scene, 'shape', 0).shape!;
      const kind = (style.shapeKind ?? 'rect') as NonNullable<DesignElement['shape']>['kind'];
      // A theme colour the theme doesn't have (another design's) falls back to this design's accent.
      const known = (ref: string | null) => !ref || !ref.startsWith('theme:') || scene.theme.some((t) => `theme:${t.key}` === ref);
      const fill = known(style.fill) ? style.fill : base.fill ?? null;
      const stroke = known(style.stroke) ? style.stroke : base.fill ?? null;
      extra = {
        name: SHAPE_NAMES[kind] ?? 'Shape',
        shape: {
          ...base, kind, sides: style.shapeSides ?? base.sides, amount: style.shapeAmount ?? null,
          fill: kind === 'line' ? null : fill, stroke: kind === 'line' ? (stroke ?? fill ?? base.fill ?? null) : stroke,
          strokeWidth: kind === 'line' ? Math.max(1, style.strokeWidth || 2) : stroke ? style.strokeWidth : 0,
          dash: style.dash === 'solid' ? null : style.dash,
        },
      };
    } else if (type === 'text') {
      const base = createElement(scene, 'text', 0).text!;
      const known = !style.textColor || !style.textColor.startsWith('theme:') || scene.theme.some((t) => `theme:${t.key}` === style.textColor);
      extra = { text: { ...base, style: { ...base.style, size: style.textSize, ...(style.textColor && known ? { color: style.textColor } : {}) } } };
    }
    let w = Math.max(4, Math.round(box.w));
    let h = Math.max(4, Math.round(box.h));
    let x = Math.round(box.x);
    let y = box.y;
    let rotate = 0;
    if (line) {
      const dx = line.x2 - line.x1;
      const dy = line.y2 - line.y1;
      w = Math.max(4, Math.round(Math.hypot(dx, dy)));
      h = Math.max(4, Math.ceil((extra.shape?.strokeWidth ?? 2) + 6));
      x = Math.round((line.x1 + line.x2) / 2 - w / 2);
      y = (line.y1 + line.y2) / 2 - h / 2;
      rotate = Math.round((Math.atan2(dy, dx) * 180) / Math.PI * 10) / 10;
    }
    // The canvas works on the phone at the playhead; a stage keeps screen positions, a page scrolls.
    const pageY = this.onScreen(y + this.playhead());
    const el = { ...createElement(scene, type, 0, extra), x, y: Math.round(pageY), w, h, rotate };
    this.commit(insertElement(scene, el));
    this.select(el.id);
    return el;
  }

  /**
   * Puts a field on the page as the element that shows it: text for words, a photo slot for a picture,
   * a button for a link (the RSVP link is the reply button). `at` is a page point to centre it on;
   * otherwise the middle of the screen. Selects it; null when the field isn't known.
   */
  placeField(path: string, at?: { x: number; y: number }): DesignElement | null {
    const scene = this.scene();
    const catalog = this.catalog();
    if (!scene) return null;
    const known = catalog?.variables.find((v) => v.path === path);
    const custom = scene.fields.find((f) => f.path === path);
    if (!known && !custom) return null;
    const label = known?.label ?? custom!.label;
    const kind = known?.kind ?? (custom!.type === 'url' ? 'link' : 'text');
    const type = known?.type ?? custom!.type;
    const centerY = at?.y ?? this.playhead() + REFERENCE_VIEWPORT / 2;
    let el: DesignElement;
    if (path === 'rsvp.link') {
      el = createElement(scene, 'rsvp', centerY);
    } else if (kind === 'link') {
      el = createElement(scene, 'link', centerY);
      el = { ...el, name: label, button: { ...el.button!, path, label: path === 'camera.link' ? 'Share your photos' : path === 'photos.link' ? 'See the photos' : label } };
    } else if (kind === 'image') {
      el = createElement(scene, 'slot', centerY);
      const gallery = path === 'event.gallery';
      el = { ...el, name: label, slot: { ...el.slot!, path, label, multiple: gallery }, ...(gallery ? { h: 320 } : {}) };
    } else {
      el = createElement(scene, 'text', centerY);
      const size = type === 'textarea' ? 16 : path === 'event.title' ? 40 : 20;
      el = {
        ...el,
        name: label,
        h: type === 'textarea' ? 110 : path === 'event.title' ? 90 : 48,
        text: {
          runs: [{ var: path }],
          style: { ...el.text!.style, size, ...(path === 'event.title' ? { font: scene.theme.some((t) => t.key === 'heading-font') ? 'theme:heading-font' : el.text!.style.font } : {}) },
        },
      };
    }
    if (at) el = { ...el, x: Math.round(at.x - el.w / 2), y: Math.round(at.y - el.h / 2) };
    this.commit(insertElement(scene, el));
    this.select(el.id);
    return el;
  }

  update(id: string, fn: (el: DesignElement) => DesignElement, coalesceKey?: string): void {
    this.mutate((s) => updateElement(s, id, fn), coalesceKey);
  }

  /** Deletes elements and says so, with Undo. `quiet` is for removals that are part of another edit. */
  remove(ids: string[] = this.selection(), { quiet = false } = {}): void {
    if (!ids.length) return;
    const scene = this.scene();
    const first = scene ? findElement(scene, ids[0]) : null;
    this.mutate((s) => ids.reduce((acc, id) => removeElement(acc, id), s));
    this.selection.set([]);
    if (quiet) return;
    const message = ids.length > 1 ? `Deleted ${ids.length} things` : first ? `Deleted “${labelOf(first)}”` : 'Deleted';
    this.note({ message, action: { label: 'Undo', run: () => this.undo() } });
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
      this.note('Select two or more elements side by side in the same group to group them.');
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
    // Undo the pin offset: the canvas shows a pinned element (or anything on a stage) where it is on
    // screen, the scene stores where it starts.
    const pin = pinOffsetAt(scene, el, this.playhead());
    if (pin && local.y !== undefined) local = { ...local, y: local.y - pin };
    const result = placeAt(scene, el, this.playhead(), round2(local));
    const next = !size ? result.element
      : result.element.type === 'group' ? resizeGroup(result.element, size.w, size.h)
      : { ...result.element, w: Math.round(size.w * 10) / 10, h: Math.round(size.h * 10) / 10 };
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

  /** A preset's name, for saying what its keyframes are. */
  presetName(slot: 'enter' | 'exit', id: string): string | null {
    const list = slot === 'enter' ? this.catalog()?.enterPresets : this.catalog()?.exitPresets;
    return list?.find((p) => p.id === id)?.label ?? null;
  }

  /** What each of an element's keyframes marks, and where it is in the scroll. */
  keyframeNotes(el: DesignElement): KeyframeNote[] {
    const scene = this.scene();
    return scene ? keyframeNotes(scene, el, (slot, id) => this.presetName(slot, id)) : [];
  }

  /** Moves a bar whole: its motion comes along unchanged, only later or earlier in the scroll. */
  setTrack(id: string, start: number, end: number): void {
    const s = Math.max(0, Math.min(MAX_PAGE_HEIGHT, Math.round(start)));
    const e = Math.max(s + 1, Math.min(MAX_PAGE_HEIGHT, Math.round(end)));
    this.update(id, (el) => ({ ...el, track: { start: s, end: e } }));
  }

  /**
   * Trims a bar: keyframes stay where they are in the scroll, a way in keeps to the start and a way
   * out to the end (`retimeTrack`). It stops at a keyframe it would cut off, and says so.
   */
  trimTrack(id: string, start: number, end: number): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    const s = Math.max(0, Math.min(MAX_PAGE_HEIGHT, start));
    const e = Math.max(s + 1, Math.min(MAX_PAGE_HEIGHT, end));
    const result = retimeTrack(scene, el, { start: s, end: e });
    this.commit(updateElement(scene, id, () => result.element));
    if (result.blockedAt !== null)
      this.note({ title: 'Stopped at a keyframe', message: 'A keyframe is in the way, so the bar stops at it. Move or delete that keyframe to trim further.' });
  }

  /**
   * Moves an element along the timeline: later is further down the page. Its motion comes along —
   * track, keyframes and all — so it plays exactly as before, just further into the scroll. Placing
   * it past the end makes the page longer.
   */
  moveInTime(id: string, delta: number): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    const track = el.track || el.pinned || el.keyframes.length ? trackOf(scene, el) : null;
    let dy = Math.round(delta);
    if (track) dy = Math.max(dy, -Math.round(track.start));
    if (!dy) return;
    this.update(id, (e) => {
      const moved = moveWhole(e, 0, dy);
      return track ? { ...moved, track: { start: Math.max(0, track.start + dy), end: track.end + dy } } : moved;
    });
  }

  /**
   * One keyframe at the playhead holding how the element looks there. The first one on an element is
   * the only one made — no filler at the ends of its bar — so every diamond marks a real moment.
   */
  addKeyframeAtPlayhead(id: string): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    if (el.keyframes.length) {
      this.update(id, () => placeAt(scene, el, this.playhead(), {}).element);
      return;
    }
    const track = el.track ?? { start: 0, end: Math.max(Math.round(this.playhead()) + 1, Math.round(scrollRange(scene))) };
    const now = { ...el, track };
    this.update(id, () => ({ ...now, keyframes: [{ t: tOn(track, this.playhead()), x: el.x, y: el.y, rotate: el.rotate, scale: el.scale, opacity: el.opacity }] }));
  }

  updateKeyframe(id: string, index: number, patch: Partial<DesignKeyframe>): void {
    this.update(id, (el) => {
      const keyframes = el.keyframes.map((k, i) => (i === index ? { ...k, ...patch } : k));
      return { ...el, keyframes };
    });
  }

  /** Retimes a keyframe to a whole scroll unit on its bar; returns its index after re-sorting. */
  moveKeyframe(id: string, index: number, scroll: number): number {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return index;
    const moved = { ...el.keyframes[index], t: tOn(trackOf(scene, el), Math.round(scroll)) };
    const keyframes = el.keyframes.map((k, i) => (i === index ? moved : k)).sort((a, b) => a.t - b.t);
    this.update(id, (e) => ({ ...e, keyframes }));
    return keyframes.indexOf(moved);
  }

  removeKeyframe(id: string, index: number): void {
    this.update(id, (el) => ({ ...el, keyframes: el.keyframes.filter((_, i) => i !== index) }));
    this.selectedKeyframe.set(null);
    this.note({ message: 'Deleted a keyframe', action: { label: 'Undo', run: () => this.undo() } });
  }

  setPreset(id: string, slot: 'enter' | 'exit', presetId: string | null): void {
    const catalog = this.catalog();
    const scene = this.scene();
    if (!catalog || !scene) return;
    const list: MotionPreset[] = slot === 'enter' ? catalog.enterPresets : catalog.exitPresets;
    const preset = presetId ? list.find((p) => p.id === presetId) ?? null : null;
    this.update(id, (el) => withPreset(scene, el, preset, slot, list, this.playhead()));
  }

  // ----- Loops, pivots and effects -----------------------------------------------------------------

  /**
   * Puts a loop preset on an element (null takes it off), at a strength and repeat count. A loop plays
   * while the element crosses the screen unless it already has a track.
   */
  setLoop(id: string, presetId: string | null, options: { strength?: number; repeat?: number } = {}): void {
    const catalog = this.catalog();
    const preset = presetId ? catalog?.loopPresets?.find((p) => p.id === presetId) ?? null : null;
    this.update(id, (el) => {
      const next = applyLoop(el, preset, options.strength ?? el.loop?.strength ?? 1, options.repeat ?? (el.loop?.preset === presetId ? el.loop?.repeat : undefined));
      if (preset && !el.track) return { ...next, track: this.scene()?.stage ? this.wholePage() : { start: Math.max(0, Math.round(el.y - REFERENCE_VIEWPORT)), end: Math.round(el.y + el.h) } };
      return next;
    });
  }

  /** Changes how a loop plays, re-applying its preset when the strength changes. */
  tuneLoop(id: string, patch: { strength?: number; repeat?: number; alternate?: boolean }): void {
    const el = this.primaryOf(id);
    if (!el?.loop) return;
    if (patch.strength !== undefined && el.loop.preset) {
      this.setLoop(id, el.loop.preset, { strength: patch.strength, repeat: patch.repeat ?? el.loop.repeat });
      return;
    }
    this.update(id, (e) => ({
      ...e,
      loop: {
        ...e.loop!,
        ...(patch.repeat !== undefined ? { repeat: Math.min(50, Math.max(1, Math.round(patch.repeat))) } : {}),
        ...(patch.alternate !== undefined ? { alternate: patch.alternate } : {}),
      },
    }), `${id}:loop`);
  }

  /** Where it turns and scales about; null is its centre. */
  setOrigin(id: string, origin: { x: number; y: number } | null): void {
    this.update(id, (el) => ({ ...el, origin: origin && (Math.abs(origin.x - 0.5) > 1e-3 || Math.abs(origin.y - 0.5) > 1e-3) ? origin : null }));
  }

  /**
   * Sets a 3D turn, skew, blur, clip, draw or tracking value at the playhead: on the keyframe there, or
   * a new one. An element with no keyframes gets one, which holds that value along its whole track.
   */
  setEffect(id: string, prop: 'rotateX' | 'rotateY' | 'skewX' | 'skewY' | 'blur' | 'draw' | 'tracking' | 'clip', value: number | number[] | null): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    const change = { [prop]: value } as Partial<DesignKeyframe>;
    if (!el.keyframes.length) {
      const track = trackOf(scene, el);
      const t = Math.min(1, Math.max(0, (this.playhead() - track.start) / Math.max(1, track.end - track.start)));
      this.update(id, (e) => ({ ...e, keyframes: [{ t: Math.round(t * 10000) / 10000, ...change }] }), `${id}:${prop}`);
      return;
    }
    const result = placeAt(scene, el, this.playhead(), change as Partial<ElementState>);
    this.commit(updateElement(scene, id, () => result.element), `${id}:${prop}:${Math.round(this.playhead())}`);
  }

  /**
   * Plays a ready-made effect (a door opening, coming into focus) from the playhead, over as much
   * scrolling as the pace says. Its keyframes land on the timeline like any others.
   */
  applyMove(id: string, move: EffectMove, pace: Pace = 'steady'): void {
    const scene = this.scene();
    if (!scene || !findElement(scene, id)) return;
    const units = PACES.find((p) => p.value === pace)?.units ?? 360;
    this.commit(applyMove(scene, id, move, this.playhead(), units));
    this.note({ title: move.label, message: 'Scroll past the playhead to see it. Drag its keyframes on the timeline to change when it happens.' });
  }

  setClipShape(id: string, kind: 'inset' | 'circle' | null): void {
    this.update(id, (el) => ({
      ...el,
      clipShape: kind,
      // Values for the other shape mean nothing now.
      keyframes: el.clipShape !== kind ? el.keyframes.map((k) => ({ ...k, clip: null })) : el.keyframes,
    }));
  }

  setSplit(id: string, split: { by: 'word' | 'letter'; stagger: number } | null): void {
    this.update(id, (el) => (el.text ? { ...el, text: { ...el.text, split } } : el), `${id}:split`);
  }

  setTapScroll(id: string, target: number | null): void {
    this.update(id, (el) => ({ ...el, tapScroll: target === null ? null : Math.max(0, Math.round(target)) }), `${id}:tap`);
  }

  /**
   * Motion across the element's whole bar: a slow Ken Burns push on a photo, or parallax — drifting
   * slower or faster than the page so layers seem to sit at different depths.
   */
  acrossBar(id: string, kind: 'ken-burns' | 'slower' | 'faster' | 'none'): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    const track = el.track ?? (scene.stage ? this.wholePage() : { start: Math.max(0, Math.round(el.y - REFERENCE_VIEWPORT)), end: Math.round(el.y + el.h) });
    const span = track.end - track.start;
    // Everything but the old motion across the bar stays: keyframes placed by hand and the ways in and out.
    const kept = el.keyframes.filter((k) => k.preset !== 'bar');
    const made: DesignKeyframe[] =
      kind === 'ken-burns' ? [{ t: 0, scale: el.scale, x: el.x, easing: 'ease-in-out' }, { t: 1, scale: round(el.scale * 1.18, 3), x: round(el.x - 12, 1) }]
      // On a stage the screen is still, so "slower than the page" drifts up a little and "faster" a lot.
      : kind === 'slower' ? [{ t: 0, y: el.y }, { t: 1, y: round(scene.stage ? el.y - span * 0.35 : el.y + span * 0.35, 1) }]
      : kind === 'faster' ? [{ t: 0, y: el.y }, { t: 1, y: round(scene.stage ? el.y - span * 1.3 : el.y - span * 0.3, 1) }]
      : [];
    for (const m of made) m.preset = 'bar';
    // Kept keyframes win where they share a moment with the new ones.
    this.update(id, (e) => ({ ...e, track, keyframes: [...made.filter((m) => !kept.some((k) => Math.abs(k.t - m.t) < 1e-4)), ...kept].sort((a, b) => a.t - b.t) }));
  }

  // ----- Groups and paths --------------------------------------------------------------------------

  staggerGroup(id: string, step: number, order: StaggerOrder): void {
    const scene = this.scene();
    if (!scene) return;
    this.commit(staggerChildren(scene, id, step, order, Math.floor(Math.random() * 1e6)));
  }

  followPath(id: string, pathId: string, turn: boolean): void {
    let scene = this.scene();
    if (!scene) return;
    const el = findElement(scene, id);
    if (scene.stage && el && !el.track) scene = updateElement(scene, id, (e) => ({ ...e, track: this.wholePage() }));
    this.commit(followPath(scene, id, pathId, turn));
    this.note('It now follows the path over its track. The path shape itself stays — hide or delete it if you only wanted it as a guide.');
  }

  /** Drops a sticker group onto the screen at the playhead. */
  addSticker(recipeId: string): DesignElement | null {
    const scene = this.scene();
    if (!scene) return null;
    const group = buildSticker(scene, recipeId, Math.floor(Math.random() * 1e6), this.playhead(), this.onScreen(this.playhead()));
    if (!group) return null;
    this.commit(insertElement(scene, group));
    this.select(group.id);
    return group;
  }

  /** Lays a sticker group out again from a new seed, where it is. */
  shuffleSticker(id: string): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el?.recipe) return;
    if (generatedOf(el)) return this.regenerate(id, { seed: newSeed() });
    const fresh = buildSticker(scene, el.recipe.id, Math.floor(Math.random() * 1e6), scene.stage ? this.playhead() : el.y, el.y);
    if (!fresh) return;
    this.update(id, (e) => ({ ...e, children: fresh.children, recipe: fresh.recipe }));
  }

  /**
   * How far the page scrolls: dragged on the timeline's End or typed in. It can't end before its
   * content does — then it just follows the content again.
   */
  setPageLength(units: number | null): void {
    const scene = this.scene();
    if (!scene) return;
    const content = contentRange(scene);
    const wanted = units === null ? null : Math.min(MAX_PAGE_HEIGHT, Math.round(units));
    const length = wanted === null || wanted <= content + 1 ? null : wanted;
    if (wanted !== null && wanted < content - 1)
      this.note({ title: 'Ends where its content does', message: 'The page can’t end before its last bar does — shorten or move that first.' });
    if ((scene.length ?? null) === length) return;
    this.commit({ ...scene, length });
  }

  // ----- Stage -------------------------------------------------------------------------------------

  /**
   * Switches the page between scrolling and a stage. Going to a stage, what sits below the first screen
   * is set to scroll with the page, so nothing drops out of reach; switch that off per element.
   */
  setStage(on: boolean): void {
    const scene = this.scene();
    if (!scene || !!scene.stage === on) return;
    let moved = 0;
    const elements = on
      ? scene.elements.map((el) => {
        if (el.y + el.h / 2 <= REFERENCE_VIEWPORT) return el;
        moved++;
        return { ...el, scrolls: true };
      })
      : scene.elements;
    this.commit({ ...scene, stage: on, elements });
    if (on && moved)
      this.note({ title: 'Things now stay on screen', message: `${moved} thing${moved === 1 ? '' : 's'} further down the page still scroll up, so ${moved === 1 ? 'it stays' : 'they stay'} reachable. Switch off “Scrolls up with the page” on any you want to stay put.` });
  }

  /** A page y where something is placed: on a stage, the same point on the screen. */
  private onScreen(pageY: number): number {
    return this.scene()?.stage ? pageY - this.playhead() : pageY;
  }

  /** On a stage, a new bar: from about here to the end of the page. */
  /**
   * On a stage, the bar of something that's there the whole time: the whole page. Motion added to it
   * (a loop, a slow zoom, a path) mustn't make it vanish before the playhead.
   */
  private wholePage(): DesignTrack {
    const scene = this.scene();
    return { start: 0, end: Math.max(1, Math.round(scene ? scrollRange(scene) : 0)) };
  }

  private stageBar(length = 900): DesignTrack {
    const scene = this.scene();
    const start = Math.max(0, Math.round(this.playhead() - 60));
    return { start, end: Math.max(Math.round(scene ? scrollRange(scene) : 0), start + length) };
  }

  private primaryOf(id: string): DesignElement | null {
    const scene = this.scene();
    return scene ? findElement(scene, id) : null;
  }

  // ----- Creation tools: repeat, generators, combine ----------------------------------------------

  /**
   * Repeats an element around a circle, in a grid or along a line; the original and its copies become one
   * new group, selected, in one undo step. On a repeat group it lays the original out again. Returns the
   * group's id, or null (and says why).
   */
  repeat(id: string, spec: RepeatSpec): string | null {
    const scene = this.scene();
    if (!scene) return null;
    const result = repeatElement(scene, id, spec, this.catalog()?.limits?.maxElements ?? Infinity);
    if ('error' in result) {
      this.note(result.error);
      return null;
    }
    this.commit(result.scene);
    this.select(result.groupId);
    return result.groupId;
  }

  /** Adds a generated scatter, blob or vine on the screen at the playhead, selected. */
  addGenerated(options: GeneratorOptions, seed = newSeed()): DesignElement | null {
    const scene = this.scene();
    if (!scene) return null;
    const made = generate(scene, options, seed);
    // Made in screen units: onto the screen at the playhead (on a stage, the screen itself).
    const top = this.onScreen(this.playhead());
    const el = { ...made, y: round(made.y + top, 1) };
    this.commit(insertElement(scene, el));
    this.select(el.id);
    return el;
  }

  /** Makes a generated element again where it is: a new seed (Shuffle) or changed options. */
  regenerate(id: string, change: { seed?: number; options?: GeneratorOptions }, coalesceKey?: string): void {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    if (!scene || !el) return;
    const next = regenerate(scene, el, change);
    if (next) this.commit(updateElement(scene, id, () => next), coalesceKey);
  }

  /** Combines the selected shapes into one drawn shape (add, cut out, overlap or exclude). Returns its id. */
  combine(ids: string[], op: CombineOp): string | null {
    const scene = this.scene();
    if (!scene) return null;
    const result = combineShapes(scene, ids, op);
    if ('error' in result) {
      this.note(result.error);
      return null;
    }
    this.commit(result.scene);
    this.select(result.id);
    this.note({ message: `Combined ${ids.length} shapes into one`, action: { label: 'Undo', run: () => this.undo() } });
    return result.id;
  }

  // ----- Assets ------------------------------------------------------------------------------------

  /**
   * An uploaded SVG or picture. It goes through the same conversion as library art, so an animated
   * SVG or GIF arrives as scroll motion rather than playing on a clock the page can't control.
   */
  /**
   * Files dropped from the computer (or picked): every SVG or picture is added, each a little below and
   * to the right of the one before, at `at` (page units) or the middle of the screen. Anything else is
   * named in one message rather than failing silently.
   */
  async importFiles(files: readonly File[], at?: { x: number; y: number }): Promise<number> {
    const usable = files.filter(isArtFile);
    const skipped = files.filter((f) => !isArtFile(f));
    if (skipped.length)
      this.note({ title: skipped.length === 1 ? `“${skipped[0].name}” can't be added` : `${skipped.length} files can't be added`,
        message: 'Drop SVG, PNG, JPEG, WebP or GIF files.' });
    if (usable.length > 1) this.note(`Adding ${usable.length} files…`);
    let added = 0;
    for (const [i, file] of usable.entries()) {
      const offset = i * 24;
      const where = at ? { x: at.x + offset, y: at.y + offset } : { x: CANVAS_WIDTH / 2 + offset, y: this.playhead() + REFERENCE_VIEWPORT / 2 + offset };
      if (await this.importAsset(file, where)) added++;
    }
    return added;
  }

  async importAsset(file: File, at?: { x: number; y: number }): Promise<boolean> {
    try {
      this.placeArt(await firstValueFrom(this.api.uploadArt(file)), at);
      return true;
    } catch {
      // The API already said why.
      return false;
    }
  }

  /**
   * "Shrink to fit": the asset made as small as it can be while it still looks the same at the biggest size
   * the design shows it (a picture at twice that, for 2x screens; an illustration's coordinates to what that
   * size can show). Every element using it follows, as one step Undo takes back.
   */
  async shrinkAsset(assetId: string): Promise<void> {
    await this.shrinkAssets([assetId], assetId);
  }

  /** Copies what's only on one screen onto another (one step); returns the copies' ids and what was left. */
  copyScreen(from: number, to: number, stripMotion = false): { ids: string[]; skipped: string[] } {
    const scene = this.scene();
    if (!scene || from === to) return { ids: [], skipped: [] };
    const r = copyScreen(scene, from, to, { stripMotion });
    if (!r.ids.length) {
      this.note(`Screen ${from} has nothing of its own to copy.`);
      return { ids: [], skipped: r.skipped.map((e) => e.id) };
    }
    this.commit(r.scene);
    this.selection.set(r.ids);
    this.note({ message: `Copied ${r.ids.length} ${r.ids.length === 1 ? 'thing' : 'things'} from screen ${from} to screen ${to}`, action: { label: 'Undo', run: () => this.undo() } });
    return { ids: r.ids, skipped: r.skipped.map((e) => e.id) };
  }

  /** Removes what's only on one screen (one step); what runs across other screens too is kept. */
  clearScreen(n: number): { removed: string[]; kept: string[] } {
    const scene = this.scene();
    if (!scene) return { removed: [], kept: [] };
    const r = clearScreen(scene, n);
    if (!r.removed.length) {
      this.note(`Screen ${n} has nothing of its own to clear.`);
      return { removed: [], kept: r.kept.map((e) => e.id) };
    }
    this.commit(r.scene);
    this.selection.set([]);
    this.note({ message: `Cleared screen ${n}: ${r.removed.length} ${r.removed.length === 1 ? 'thing' : 'things'} removed`, action: { label: 'Undo', run: () => this.undo() } });
    return { removed: r.removed, kept: r.kept.map((e) => e.id) };
  }

  /** One phone screen of the design as a picture (JPEG data: URI), drawn as the poster is. */
  screenPicture(scroll: number): Promise<string> {
    const scene = this.scene()!;
    const catalog = this.catalog()!;
    return renderScreen(scene, scroll, { fonts: catalog.fonts, variables: catalog.variables });
  }

  /** Drops files nothing in the design shows any more, as one step Undo takes back. */
  removeUnusedAssets(): { files: number; bytes: number } {
    const scene = this.scene();
    if (!scene) return { files: 0, bytes: 0 };
    const r = withoutUnusedAssets(scene);
    if (!r.files) {
      this.note('Every file in the design is in use.');
      return { files: 0, bytes: 0 };
    }
    this.commit(r.scene);
    const size = r.bytes >= 1024 * 1024 ? `${(r.bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(r.bytes / 1024)} KB`;
    this.note({ title: `Removed ${r.files} unused ${r.files === 1 ? 'file' : 'files'}`, message: `${size} lighter to save. They weren't on the page, so nothing you see changes.`, action: { label: 'Undo', run: () => this.undo() } });
    return { files: r.files, bytes: r.bytes };
  }

  /** Shrink to fit for several files at once (everything in a group), as one step with one notice. */
  /**
   * Cuts a picture element's subject out of its background (on the server, about ten seconds). The cut-out
   * is a new file, so the original stays in the design and Undo brings it straight back. False when
   * nothing changed (not a picture, already working, the API refused, or it was changed meanwhile).
   */
  async removeBackground(id: string): Promise<boolean> {
    const scene = this.scene();
    const el = scene ? findElement(scene, id) : null;
    const assetId = el?.image?.asset;
    const asset = assetId ? scene!.assets[assetId] : null;
    if (!el || !assetId || !asset || asset.kind !== 'image' || this.removingBackground()) return false;
    this.removingBackground.set(id);
    try {
      const cut = await firstValueFrom(this.api.removeDesignBackground({ data: asset.data, name: asset.name ?? null }));
      const now = this.scene();
      if (!now || findElement(now, id)?.image?.asset !== assetId) return false;
      this.mutate((s) => updateElement({
        ...s,
        assets: { ...s.assets, [cut.id]: { kind: 'image', data: cut.data, width: cut.width, height: cut.height, name: cut.name, alpha: true } },
      }, id, (e) => (e.image ? { ...e, image: { ...e.image, asset: cut.id } } : e)));
      this.note({ message: 'Background removed', action: { label: 'Undo', run: () => this.undo() } });
      return true;
    } catch {
      return false; // The API already said why.
    } finally {
      this.removingBackground.set(null);
    }
  }

  async shrinkAssets(assetIds: string[], busyKey: string): Promise<{ files: number; saved: number; failed: number }> {
    const none = { files: 0, saved: 0, failed: 0 };
    const scene = this.scene();
    if (!scene || this.shrinking()) return none;
    const ids = [...new Set(assetIds)].filter((id) => scene.assets[id] && shownSize(scene, id));
    if (!ids.length) return none;
    this.shrinking.set(busyKey);
    try {
      const done: { id: string; before: DesignScene['assets'][string]; after: DesignScene['assets'][string] }[] = [];
      let failed = 0;
      let lastSize = { width: 0, height: 0 };
      for (const id of ids) {
        const asset = scene.assets[id];
        const size = shownSize(scene, id)!;
        lastSize = size;
        let r;
        try {
          r = await firstValueFrom(this.api.shrinkDesignAsset({ id, kind: asset.kind, data: asset.data, width: size.width, height: size.height, name: asset.name ?? null }));
        } catch {
          failed++;
          continue; // The API already said why; the others still shrink.
        }
        if (r.data === asset.data || asset.data.length - r.data.length < 1024) continue;
        // A brightness mask is for the old file: work out the new one in the same step.
        const mask = asset.mask ? await firstValueFrom(this.api.analyseDesignImage(r.data)).then((x) => x.mask, () => null) : null;
        done.push({
          id, before: asset,
          after: {
            ...asset, data: r.data,
            ...(r.alpha != null ? { alpha: r.alpha } : {}),
            ...(asset.mask ? { mask: mask ?? undefined } : {}),
            width: r.width > 0 ? r.width : asset.width,
            height: r.height > 0 ? r.height : asset.height,
            ...(asset.kind === 'svg' ? { colors: r.colors ?? asset.colors } : {}),
          },
        });
      }
      // Changed while the server worked (replaced, undone): leave the newer versions alone.
      const current = this.scene();
      const kept = done.filter((d) => current?.assets[d.id]?.data === d.before.data);
      if (!kept.length) {
        if (failed === ids.length) return { files: 0, saved: 0, failed };
        this.note(ids.length === 1
          ? { title: 'Already as small as it can be', message: `It's sized for the biggest it's shown here (${lastSize.width}×${lastSize.height}).` }
          : { title: 'Already as small as they can be', message: 'Each is sized for the biggest it\'s shown here.' });
        return { files: 0, saved: 0, failed };
      }
      this.mutate((s) => ({ ...s, assets: { ...s.assets, ...Object.fromEntries(kept.map((d) => [d.id, d.after])) } }));
      const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
      const savedKept = kept.reduce((t, d) => t + d.before.data.length - d.after.data.length, 0);
      this.note({
        title: `Saved ${kb(savedKept)}`,
        message: kept.length === 1
          ? `Now ${kb(kept[0].after.data.length)}, still sharp at the biggest it's shown. Make it much bigger later and it may look soft, so shrink once its size is settled.`
          : `${kept.length} files, each still sharp at the biggest it's shown. Make them much bigger later and they may look soft, so shrink once sizes are settled.`,
        action: { label: 'Undo', run: () => this.undo() },
      });
      return { files: kept.length, saved: savedKept, failed };
    } finally {
      this.shrinking.set(null);
    }
  }

  /**
   * One tint for every picture and illustration in a group (null shows them as they were), as one step.
   * Pictures tinted for the first time are analysed first (see tintInfo).
   */
  async tintGroup(groupId: string, tint: string | null): Promise<void> {
    const scene = this.scene();
    const group = scene ? findElement(scene, groupId) : null;
    if (!scene || !group) return;
    const inside = flatten({ ...scene, elements: group.children ?? [] }).map((f) => f.element);
    const pictures = [...new Set(inside.filter((e) => e.image).map((e) => e.image!.asset))];
    const infos = tint ? await Promise.all(pictures.map(async (a) => [a, await this.tintInfo(a)] as const)) : [];
    const ids = new Set(inside.filter((e) => e.image || e.svg).map((e) => e.id));
    this.mutate((s) => {
      let next = infos.reduce((acc, [a, info]) => this.withTintInfo(acc, a, info), s);
      for (const id of ids) {
        next = updateElement(next, id, (e) => {
          if (e.svg) {
            const { tint: _t, ...rest } = e.svg;
            return { ...e, svg: tint ? { ...rest, tint } : rest };
          }
          if (e.image) {
            const { tint: _t, tintMode: _m, ...rest } = e.image;
            return { ...e, image: tint ? { ...rest, tint, ...(e.image.tintMode ? { tintMode: e.image.tintMode } : {}) } : rest };
          }
          return e;
        });
      }
      return next;
    });
  }

  /**
   * What tinting this picture needs, worked out once: whether it has see-through pixels, and for an
   * opaque one the brightness mask a silhouette paints through. Null when it's known already (or the
   * server couldn't say: the page then shows an opaque photo with the colour multiplied over it).
   */
  private async tintInfo(assetId: string): Promise<{ alpha: boolean; mask: string | null } | null> {
    const asset = this.scene()?.assets[assetId];
    if (!asset || asset.kind !== 'image' || asset.alpha === true || (asset.alpha === false && asset.mask)) return null;
    try {
      return await firstValueFrom(this.api.analyseDesignImage(asset.data));
    } catch {
      return null;
    }
  }

  private withTintInfo(scene: DesignScene, assetId: string, info: { alpha: boolean; mask: string | null } | null): DesignScene {
    const asset = scene.assets[assetId];
    if (!info || !asset) return scene;
    return { ...scene, assets: { ...scene.assets, [assetId]: { ...asset, alpha: info.alpha, ...(info.mask ? { mask: info.mask } : {}) } } };
  }

  /**
   * Paints a picture in one colour (null shows it as it is again), as one step. The first time a
   * picture is tinted the server works out what that needs (see tintInfo).
   */
  async tintPicture(id: string, tint: string | null, mode?: 'silhouette' | 'overlay' | null): Promise<void> {
    const el = this.scene() ? findElement(this.scene()!, id) : null;
    if (!el?.image) return;
    const info = tint ? await this.tintInfo(el.image.asset) : null;
    this.mutate((s) => updateElement(this.withTintInfo(s, el.image!.asset, info), id, (e) => {
      if (!e.image) return e;
      const { tint: _t, tintMode: _m, ...rest } = e.image;
      const nextMode = mode === undefined ? e.image.tintMode : mode;
      return { ...e, image: { ...rest, ...(tint ? { tint } : {}), ...(tint && nextMode ? { tintMode: nextMode } : {}) } };
    }));
  }

  /** For tools that set a picture's tint themselves: makes sure its asset has what the tint needs. */
  async prepareTint(assetId: string): Promise<void> {
    const info = await this.tintInfo(assetId);
    if (info) this.mutate((s) => this.withTintInfo(s, assetId, info));
  }

  /** Art picked from a library: downloaded, cleaned and converted on the server, then placed. */
  async importLibraryArt(item: ArtItem, at?: { x: number; y: number }): Promise<boolean> {
    try {
      this.placeArt(await firstValueFrom(this.api.importArt({ source: item.source, id: item.id, title: item.title })), at);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * A picture made with AI from a description, placed like library art. Throws the server's message
   * (not allowed, this month's pictures used, a safety refusal) for the caller to show.
   */
  async createAiPicture(prompt: string, shape: AiPictureShape, at?: { x: number; y: number }): Promise<ArtImport> {
    const art = await firstValueFrom(this.api.createAiPicture(prompt, shape));
    this.placeArt(art, at);
    return art;
  }

  private placeArt(art: ArtImport, at?: { x: number; y: number }): void {
    const scene = this.scene();
    if (!scene) return;
    const center = { x: at?.x ?? CANVAS_WIDTH / 2, y: this.onScreen(at?.y ?? this.playhead() + REFERENCE_VIEWPORT / 2) };
    const { scene: next, element } = placeArt(scene, art, center, undefined, scene.stage ? this.stageBar() : undefined);
    this.commit(insertElement(next, element));
    this.select(element.id);
    if (art.asPicture)
      this.note({ title: `“${art.name}” added`, message: 'It was too detailed to keep as a vector in an invitation, so it came in as a picture — it looks the same, but its colours can’t be changed.' });
    if (art.animated) {
      const loops = art.loops > 1 ? `, ${art.loops} times over` : '';
      this.note({ title: `“${art.name}” moves`, message: `It plays as the page scrolls past it${loops}. Stretch its bar on the timeline to slow it down.` });
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

/** What can be drawn on the page from the desktop rail. */
export type DrawableType = 'text' | 'shape' | 'slot' | 'rsvp' | 'link' | 'dress';

export interface DrawTool {
  type: DrawableType;
}

export interface DrawStyle {
  shapeKind: string;
  shapeSides: number | null;
  shapeAmount: number | null;
  /** Fill colour reference (theme:key or hex), or null for none. */
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  dash: 'solid' | 'dashed' | 'dotted';
  textSize: number;
  textColor: string | null;
}

export const DEFAULT_DRAW_STYLE: DrawStyle = {
  shapeKind: 'rect', shapeSides: null, shapeAmount: null, fill: 'theme:accent', stroke: null, strokeWidth: 2, dash: 'solid', textSize: 22, textColor: null,
};

const SHAPE_NAMES: Record<string, string> = {
  rect: 'Box', ellipse: 'Oval', line: 'Line', polygon: 'Polygon', star: 'Star', heart: 'Heart', arch: 'Arch', ribbon: 'Banner',
  bubble: 'Speech bubble', arrow: 'Arrow', scallop: 'Badge', wave: 'Wave edge', zigzag: 'Zigzag edge', frame: 'Frame', ticket: 'Ticket',
};

/** What the designer takes as art: SVG and the picture types the server accepts (by type, or by name when the OS gives none). */
export function isArtFile(file: File): boolean {
  return /^image\/(svg\+xml|png|jpeg|webp|gif)$/.test(file.type) || (!file.type && /\.(svg|png|jpe?g|webp|gif)$/i.test(file.name));
}
