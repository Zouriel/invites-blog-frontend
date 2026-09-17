import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import { UiBottomSheet, UiDrawer } from '@zouriel/ui/dialog';
import { UiEditableText } from '@zouriel/ui/form';
import { UiResizeHandle } from '@zouriel/ui/layout';
import { UiMeter } from '@zouriel/ui/progress';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiScrubber, type UiScrubberTick } from '@zouriel/ui/sequencer';
import { DesignStore, type SampleMode } from './design.store';
import type { ElementType } from './model/scene';
import { labelOf, sectionMarkers, trackOf } from './model/scene-ops';
import { EditorCanvasComponent } from './editor-canvas.component';
import { EditorPropertiesComponent, type PropertiesFocus } from './editor-properties.component';
import { EditorTimelineComponent } from './editor-timeline.component';
import { EditorVariablesComponent } from './editor-variables.component';
import { PageSettingsComponent } from './page-settings.component';
import { ShapeEditorComponent } from './shape-editor.component';
import { PublishDialogComponent } from './publish-dialog.component';

interface Tool {
  type: ElementType | 'upload';
  label: string;
  key: string;
  glyph: string;
}

/** A panel of the phone layout. The element panels show one part of the inspector each. */
type Panel = 'fields' | 'layers' | 'page' | 'more' | Exclude<PropertiesFocus, 'all'>;

interface DockTool {
  id: string;
  label: string;
  glyph: string;
  run: () => void;
  panel?: Panel;
  danger?: boolean;
  disabled?: boolean;
  badge?: boolean;
  badgeTone?: 'danger' | 'warning';
}

const CONTENT_LABEL: Record<ElementType, string> = {
  text: 'Text', shape: 'Shape', svg: 'Colours', image: 'Picture', slot: 'Photo', rsvp: 'Button', link: 'Link', dress: 'Colours', group: 'Group',
};

const PANEL_TITLE: Record<Panel, string> = {
  fields: 'Fields', layers: 'Layers & timing', page: 'Page', more: 'More', content: '', layout: 'Position & size', motion: 'Motion',
  visibility: 'Who sees it',
};

/** Units of scroll a Play moves per second — about a relaxed scroll through an invitation. */
const PLAY_SPEED = 520;

/**
 * The template designer: a phone to design on, the scroll track underneath, the inspector beside.
 * Route: `/design/:id`. Everything state-like lives in {@link DesignStore}, provided here so each open
 * design gets its own.
 *
 * <p><b>On a phone</b> it follows mobile video editors (YouCut, CapCut) and Lightroom rather than
 * shrinking the desktop: the preview stays on screen and shrinks when a panel opens instead of being
 * covered; a strip under a fixed centre playhead scrubs the scroll; the toolbar at the bottom holds
 * add-tools until something is selected, then that element's tools; each tool opens one focused
 * panel above the toolbar, which can be dragged taller or away.</p>
 */
@Component({
  selector: 'app-design-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [DesignStore],
  imports: [
    FormsModule, RouterLink, UiButton, UiIconButton, UiSegmented, UiBottomSheet, UiDrawer, UiEditableText, UiResizeHandle, UiMeter,
    UiTooltip, UiAlert, UiBadge, UiSpinner, UiEmptyState, UiScrubber,
    EditorCanvasComponent, EditorPropertiesComponent, EditorTimelineComponent, EditorVariablesComponent, PageSettingsComponent,
    PublishDialogComponent, ShapeEditorComponent,
  ],
  templateUrl: './design-editor.component.html',
  styleUrl: './design-editor.component.scss',
  host: { '(window:keydown)': 'onKey($event)', '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class DesignEditorComponent {
  protected readonly store = inject(DesignStore);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('file');
  private readonly topbar = viewChild<ElementRef<HTMLElement>>('topbar');
  private readonly dock = viewChild<ElementRef<HTMLElement>>('dock');

  protected readonly timelineHeight = signal(readNumber('ib-designer-timeline', 260));
  protected readonly interact = signal(false);
  protected readonly checkOpen = signal(false);
  protected readonly publishOpen = signal(false);
  protected readonly inspectorOpen = signal(false);
  protected readonly imported = signal(this.route.snapshot.queryParamMap.get('imported') === '1');

  // ----- Phone layout ------------------------------------------------------------------------------

  protected readonly mobile = signal(false);
  protected readonly panel = signal<Panel | null>(null);
  protected readonly sheetSnap = signal(0);
  protected readonly sheetSnaps = [0, 0.46, 1];
  /** Px of the screen, from the bottom, the open panel takes — with the toolbar or keyboard under it. */
  protected readonly sheetCover = signal(0);
  protected readonly dockHeight = signal(64);
  protected readonly topbarHeight = signal(52);
  protected readonly playing = signal(false);
  /** The on-screen keyboard is up (a field has focus and the page shrank for it). */
  protected readonly keyboardOpen = signal(false);
  protected scrubZoom = 0.3;

  /**
   * How much of the stage the panel takes, so the preview shrinks above it rather than being covered.
   * A panel dragged taller than that covers the preview, which is what dragging it up asks for.
   */
  private readonly viewportHeight = signal(typeof window === 'undefined' ? 800 : window.innerHeight);

  protected readonly stageInset = computed(() => {
    if (!this.mobile() || !this.panel()) return 0;
    const dock = this.keyboardOpen() ? 0 : this.dockHeight();
    const stage = this.viewportHeight() - dock - this.topbarHeight();
    const covered = this.sheetCover() - dock;
    // Up to 60% of the stage (a keyboard makes the panel sit higher), always leaving a preview to look at.
    return Math.max(0, Math.min(covered, stage * 0.6, stage - 160));
  });

  protected readonly tools: Tool[] = [
    { type: 'text', label: 'Text', key: 'T', glyph: 'T' },
    { type: 'shape', label: 'Shape', key: 'R', glyph: '▢' },
    { type: 'slot', label: 'Photo slot', key: 'P', glyph: '▣' },
    { type: 'upload', label: 'Illustration or picture', key: 'I', glyph: '✿' },
    { type: 'rsvp', label: 'RSVP button', key: 'B', glyph: '✉' },
    { type: 'link', label: 'Camera, photos or map link', key: 'L', glyph: '↗' },
    { type: 'dress', label: 'Dress colours', key: 'D', glyph: '◐' },
  ];

  protected readonly sampleOptions = [
    { value: 'filled', label: 'Filled' }, { value: 'empty', label: 'Empty fields' }, { value: 'roles', label: 'Two roles' },
  ];
  protected readonly modeOptions = [{ value: 'edit', label: 'Edit' }, { value: 'live', label: 'Interact' }];

  protected readonly saveLabel = computed(() => ({
    saved: 'All changes saved', dirty: 'Unsaved changes', saving: 'Saving…', offline: 'Offline — saved on this device', conflict: 'Changed elsewhere',
  })[this.store.saveState()]);

  protected readonly sizeText = computed(() => `${Math.round((this.store.preview()?.bytes ?? 0) / 1024)} KB`);
  protected readonly hardBytes = computed(() => this.store.catalog()?.limits?.hardBytes ?? 819200);
  protected readonly softBytes = computed(() => this.store.catalog()?.limits?.softBytes ?? 307200);
  protected readonly issueCount = computed(() => this.store.issues().length);

  protected readonly publishLabel = computed(() => {
    const t = this.store.design()?.template;
    if (!t) return 'Publish';
    return this.store.unpublished() ? `Publish v${bump(t.version)}` : `v${t.version} live`;
  });

  protected readonly moreLabel = computed(() =>
    this.store.errorCount() ? `More — Check found ${this.store.errorCount()} to fix` : 'More: check, preview options, size');

  protected readonly selectedLabel = computed(() => {
    const el = this.store.primary();
    return el ? labelOf(el) : '';
  });

  protected readonly markers = computed(() => (this.store.scene() ? sectionMarkers(this.store.scene()!) : []));

  /** The selected element's keyframes, as points on the scrubber. */
  protected readonly ticks = computed<UiScrubberTick[]>(() => {
    const scene = this.store.scene();
    const el = this.store.primary();
    if (!scene || !el || !el.keyframes.length) return [];
    const track = trackOf(scene, el);
    const at = this.store.playhead();
    return el.keyframes.map((k) => {
      const units = track.start + k.t * (track.end - track.start);
      return { at: units, active: Math.abs(units - at) < 2 };
    });
  });

  protected readonly where = computed(() => {
    const markers = this.markers();
    const y = this.store.playhead();
    const current = [...markers].reverse().find((m) => m.at <= y + 0.5) ?? markers[0];
    const pct = Math.round((y / Math.max(1, this.store.range())) * 100);
    return `${current?.label ?? ''} · ${pct}%`;
  });

  protected readonly propertiesFocus = computed<PropertiesFocus>(() => {
    const p = this.panel();
    return p === 'content' || p === 'layout' || p === 'motion' || p === 'visibility' ? p : 'all';
  });

  protected readonly panelTitle = computed(() => {
    const p = this.panel();
    if (!p) return '';
    const el = this.store.primary();
    if (p === 'content') {
      if (!el) return '';
      const label = labelOf(el);
      return label === CONTENT_LABEL[el.type] ? label : `${CONTENT_LABEL[el.type]} · ${label}`;
    }
    return PANEL_TITLE[p];
  });

  /** The bottom toolbar: add-tools with nothing selected, the selection's tools otherwise. */
  protected readonly dockTools = computed<DockTool[]>(() => {
    const selection = this.store.selection();
    const el = this.store.primary();
    const done: DockTool = { id: 'done', label: 'Done', glyph: '✓', run: () => this.deselect() };

    if (selection.length > 1) {
      return [
        done,
        { id: 'group', label: 'Group', glyph: '⊞', run: () => this.store.group() },
        { id: 'duplicate', label: 'Duplicate', glyph: '⧉', run: () => this.store.duplicate() },
        { id: 'delete', label: 'Delete', glyph: '🗑', danger: true, run: () => this.store.remove() },
      ];
    }

    if (el) {
      const tools: DockTool[] = [
        done,
        { id: 'content', label: CONTENT_LABEL[el.type], glyph: el.type === 'text' ? 'Aa' : '✎', panel: 'content', run: () => this.togglePanel('content') },
        ...(el.type === 'shape' ? [{ id: 'drawShape', label: 'Edit shape', glyph: '✐', run: () => { this.closePanel(); this.store.openShapeEditor(el.id); } }] : []),
        { id: 'layout', label: 'Position', glyph: '✥', panel: 'layout', run: () => this.togglePanel('layout') },
        { id: 'motion', label: 'Motion', glyph: '≋', panel: 'motion', run: () => this.togglePanel('motion') },
        { id: 'keyframe', label: 'Keyframe', glyph: '◆', run: () => this.store.addKeyframeAtPlayhead(el.id) },
        { id: 'visibility', label: 'Who sees', glyph: '◉', panel: 'visibility', run: () => this.togglePanel('visibility') },
        { id: 'front', label: 'Forward', glyph: '⤒', run: () => this.store.arrange(el.id, 'front') },
        { id: 'back', label: 'Back', glyph: '⤓', run: () => this.store.arrange(el.id, 'back') },
        { id: 'duplicate', label: 'Duplicate', glyph: '⧉', run: () => this.store.duplicate() },
        { id: 'lock', label: el.locked ? 'Unlock' : 'Lock', glyph: el.locked ? '🔓' : '🔒', run: () => this.store.update(el.id, (e) => ({ ...e, locked: !e.locked })) },
      ];
      if (el.type === 'group') tools.splice(1, 1, { id: 'ungroup', label: 'Ungroup', glyph: '⊟', run: () => this.store.ungroup() });
      tools.push({ id: 'delete', label: 'Delete', glyph: '🗑', danger: true, run: () => this.store.remove() });
      return tools;
    }

    const add: DockTool[] = this.tools.map((t) => ({
      id: t.type, label: t.type === 'upload' ? 'Picture' : t.type === 'slot' ? 'Photo' : t.type === 'rsvp' ? 'RSVP' : t.type === 'link' ? 'Link' : t.type === 'dress' ? 'Dress' : t.label,
      glyph: t.glyph, run: () => this.useTool(t),
    }));
    return [
      ...add,
      { id: 'fields', label: 'Fields', glyph: '{ }', panel: 'fields', run: () => this.togglePanel('fields') },
      { id: 'layers', label: 'Layers', glyph: '☰', panel: 'layers', run: () => this.togglePanel('layers') },
      { id: 'page', label: 'Page', glyph: '▤', panel: 'page', run: () => this.togglePanel('page') },
      {
        id: 'check', label: 'Check', glyph: '✓', run: () => this.openCheck(),
        badge: this.issueCount() > 0, badgeTone: this.store.errorCount() ? 'danger' : 'warning',
      },
    ];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    void this.store.load(id);

    effect(() => {
      const name = this.store.name();
      if (name) document.title = `${name} · Designer · invites.blog`;
    });
    effect(() => {
      try { localStorage.setItem('ib-designer-timeline', String(this.timelineHeight())); } catch { /* private mode */ }
    });
    // Keep the playhead inside the page when sections shrink.
    effect(() => {
      const range = this.store.range();
      if (this.store.playhead() > range) this.store.playhead.set(range);
    });

    // The panel follows the sheet: dragged away is closed.
    effect(() => {
      if (this.sheetSnap() === 0 && untracked(() => this.panel())) this.panel.set(null);
    });
    // Element panels close when there's no longer an element to show.
    effect(() => {
      const p = this.panel();
      const hasElement = this.store.selection().length === 1;
      if (!hasElement && (p === 'content' || p === 'layout' || p === 'motion' || p === 'visibility')) untracked(() => this.closePanel());
    });
    effect(() => {
      if (!this.mobile()) untracked(() => this.closePanel());
    });
    // A different set of tools starts from its first one, not wherever the last set was scrolled to.
    const toolSet = computed(() => (this.store.selection().length > 1 ? 'several' : this.store.selection().length ? 'one' : 'none'));
    effect(() => {
      toolSet();
      const dock = untracked(() => this.dock()?.nativeElement);
      if (dock) dock.scrollLeft = 0;
    });

    if (typeof window !== 'undefined') {
      const query = window.matchMedia('(max-width: 760px), (max-height: 520px) and (pointer: coarse)');
      const sync = () => this.mobile.set(query.matches);
      sync();
      query.addEventListener('change', sync);
      this.destroyRef.onDestroy(() => query.removeEventListener('change', sync));

      // While editing, the keyboard shrinks the page (interactive-widget=resizes-content) instead of
      // Chrome panning it up out of view — found on a real Android keyboard: the pan hid the top bar and
      // the preview. The site's own setting is restored on the way out.
      const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
      const original = meta?.content ?? null;
      effect(() => {
        if (!meta || original === null) return;
        meta.content = this.mobile() && !/interactive-widget/.test(original) ? `${original}, interactive-widget=resizes-content` : original;
      });
      this.destroyRef.onDestroy(() => { if (meta && original !== null) meta.content = original; });

      let tallest = window.innerHeight;
      const onViewport = () => {
        const h = window.innerHeight;
        const typing = !!document.activeElement?.matches('input:not([type=range]):not([type=checkbox]), textarea, [contenteditable="true"]');
        if (!typing) tallest = Math.max(h, window.visualViewport?.height ?? h);
        this.viewportHeight.set(h);
        const vv = window.visualViewport?.height ?? h;
        this.keyboardOpen.set(typing && (tallest - Math.min(h, vv) > 150));
      };
      window.addEventListener('resize', onViewport);
      window.visualViewport?.addEventListener('resize', onViewport);
      document.addEventListener('focusin', onViewport);
      document.addEventListener('focusout', () => setTimeout(onViewport, 50));
      this.destroyRef.onDestroy(() => {
        window.removeEventListener('resize', onViewport);
        window.visualViewport?.removeEventListener('resize', onViewport);
        document.removeEventListener('focusin', onViewport);
      });

      const observer = new ResizeObserver(() => {
        const top = this.topbar()?.nativeElement.getBoundingClientRect().height;
        const dock = this.dock()?.nativeElement.getBoundingClientRect().height;
        if (top) this.topbarHeight.set(Math.round(top));
        if (dock) this.dockHeight.set(Math.round(dock));
      });
      effect(() => {
        const els = [this.topbar()?.nativeElement, this.dock()?.nativeElement].filter((e): e is HTMLElement => !!e);
        observer.disconnect();
        els.forEach((e) => observer.observe(e));
      });
      this.destroyRef.onDestroy(() => observer.disconnect());
    }

    this.destroyRef.onDestroy(() => {
      document.title = 'invites.blog';
      this.stopPlay();
    });
  }

  protected rename(name: string): void {
    this.store.rename(name);
  }

  protected round(n: number): number {
    return Math.round(n);
  }

  protected useTool(tool: Tool): void {
    if (tool.type === 'upload') {
      this.fileInput()?.nativeElement.click();
      return;
    }
    this.store.add(tool.type);
    if (!this.mobile()) {
      this.inspectorOpen.set(true);
      return;
    }
    // A new text is for typing into straight away, as it is in any phone editor.
    if (tool.type === 'text') this.editText();
  }

  protected onUpload(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.store.importAsset(file);
  }

  protected setSample(value: string | null): void {
    if (value) this.store.sample.set(value as SampleMode);
  }

  protected setInteract(live: boolean): void {
    this.interact.set(live);
    if (live) this.closePanel();
  }

  protected selectIssue(elementId: string | null | undefined): void {
    if (!elementId) return;
    this.store.select(elementId);
    this.checkOpen.set(false);
  }

  // ----- Panels ------------------------------------------------------------------------------------

  protected openPanel(panel: Panel): void {
    this.stopPlay();
    this.panel.set(panel);
    if (this.sheetSnap() === 0) this.sheetSnap.set(1);
  }

  protected togglePanel(panel: Panel): void {
    if (this.panel() === panel) this.closePanel();
    else this.openPanel(panel);
  }

  protected closePanel(): void {
    this.sheetSnap.set(0);
    this.panel.set(null);
  }

  protected openCheck(): void {
    this.closePanel();
    this.checkOpen.set(true);
  }

  protected editText(): void {
    this.openPanel('content');
    // After the panel renders: the text box is the first thing in it.
    setTimeout(() => {
      const box = document.querySelector<HTMLElement>('ui-bottom-sheet app-editor-properties ui-token-input [contenteditable="true"]');
      if (!box) return;
      box.focus();
      // Select what's there, so typing replaces a placeholder rather than prefixing it.
      const range = document.createRange();
      range.selectNodeContents(box);
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }, 60);
  }

  /** Pressed on the stage around the phone, not on the page, the controls or the selection. */
  protected stagePressed = false;

  protected isBackdrop(e: Event): boolean {
    const target = e.target as Element | null;
    return !!target && !target.closest('.screen, .transport, ui-scrubber, button, a, input, ui-transform-box');
  }

  /** A tap or click on the empty stage around the phone lets go of the selection, as in any editor. */
  protected onStageClick(e: MouseEvent): void {
    const pressed = this.stagePressed;
    this.stagePressed = false;
    if (!pressed || !this.isBackdrop(e) || this.interact() || !this.store.selection().length) return;
    this.deselect();
  }

  private deselect(): void {
    this.closePanel();
    this.store.editingTextId.set(null);
    this.store.select(null);
  }

  // ----- Play --------------------------------------------------------------------------------------

  private playFrame = 0;

  protected togglePlay(): void {
    if (this.playing()) {
      this.stopPlay();
      return;
    }
    if (this.store.playhead() >= this.store.range() - 1) this.store.playhead.set(0);
    this.playing.set(true);
    let last = performance.now();
    const step = (now: number) => {
      const next = Math.min(this.store.range(), this.store.playhead() + ((now - last) / 1000) * PLAY_SPEED);
      last = now;
      this.store.playhead.set(Math.round(next));
      if (next >= this.store.range()) {
        this.stopPlay();
        return;
      }
      this.playFrame = requestAnimationFrame(step);
    };
    this.playFrame = requestAnimationFrame(step);
  }

  private stopPlay(): void {
    cancelAnimationFrame(this.playFrame);
    this.playing.set(false);
  }

  // ----- Keyboard ----------------------------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    const typing = !!target?.closest('input, textarea, select, [contenteditable="true"], ui-token-input, [role="textbox"]');
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    if (mod && key === 's') {
      e.preventDefault();
      void this.store.save();
      return;
    }
    if (typing) return;
    if (mod && key === 'z') {
      e.preventDefault();
      if (e.shiftKey) this.store.redo();
      else this.store.undo();
      return;
    }
    if (mod && key === 'y') {
      e.preventDefault();
      this.store.redo();
      return;
    }
    if (mod && key === 'd') {
      e.preventDefault();
      this.store.duplicate();
      return;
    }
    if (mod && key === 'g') {
      e.preventDefault();
      if (e.shiftKey) this.store.ungroup();
      else this.store.group();
      return;
    }
    if (mod) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.store.selection().length) {
        e.preventDefault();
        this.store.remove();
      }
      return;
    }
    if (e.key === 'Escape') {
      this.store.editingTextId.set(null);
      this.store.select(null);
      return;
    }
    if (key === 'k' && this.store.primaryId()) {
      this.store.addKeyframeAtPlayhead(this.store.primaryId()!);
      return;
    }
    const tool = this.tools.find((t) => t.key.toLowerCase() === key);
    if (tool && tool.type !== 'upload') this.store.add(tool.type);
  }

  protected onBeforeUnload(e: BeforeUnloadEvent): void {
    if (this.store.saveState() === 'dirty' || this.store.saveState() === 'saving') {
      void this.store.save();
      e.preventDefault();
    }
  }
}

function bump(v: string): string {
  const parts = v.split('.');
  return parts.length === 3 && /^\d+$/.test(parts[2]) ? `${parts[0]}.${parts[1]}.${+parts[2] + 1}` : '1.0.1';
}

function readNumber(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}
