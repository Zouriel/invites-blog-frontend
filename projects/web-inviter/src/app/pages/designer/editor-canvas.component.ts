import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, untracked, viewChild,
  viewChildren,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSnapGuides, UiTransformBox, uiRotatedBounds, uiSnap, type UiBox, type UiGuide } from '@zouriel/ui/canvas';
import { UiButton } from '@zouriel/ui/button';
import { UiDeviceFrame } from '@zouriel/ui/media';
import { UiTokenInput, type UiTokenRun } from '@zouriel/ui/form';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiSpinner } from '@zouriel/ui/spinner';
import { DesignStore } from './design.store';
import { CANVAS_WIDTH, REFERENCE_VIEWPORT, type DesignElement } from './model/scene';
import {
  findElement, flatten, groupOffsetAt, labelOf, pageBoxAt, pinOffsetAt, resolveFrames, resolveColor, runsToTokens, tokensToRuns, trackOf,
  type ScreenBox,
} from './model/scene-ops';

interface Ghost {
  x: number;
  y: number;
  w: number;
  h: number;
  rotate: number;
  label: string;
}

/**
 * The phone the designer works on. Underneath: the real compiled template in a sandboxed frame,
 * rendered by the server. On top: an overlay that draws selection, handles, snapping guides and the
 * ghosts of an animation's keyframes, and turns pointer gestures into edits.
 *
 * <p><b>Two frames.</b> A new compile loads into the hidden frame and is swapped in once it says it's
 * ready, already scrolled to the playhead — so an edit never flashes a blank page.</p>
 *
 * <p><b>Scroll is the playhead.</b> The frame never scrolls itself while editing; the wheel moves the
 * playhead and the playhead scrolls the frame. In Interact mode the frame is live and its own scroll
 * drives the playhead instead.</p>
 */
@Component({
  selector: 'app-editor-canvas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiDeviceFrame, UiTransformBox, UiSnapGuides, UiTokenInput, UiSpinner],
  template: `
    <ui-device-frame #frame [width]="width" [height]="viewport" [bezel]="!touchUi()" [island]="!touchUi()" [maxScale]="1.2">
      <div class="screen">
        @for (slot of [0, 1]; track slot) {
          <iframe #preview class="preview" [class.active]="activeFrame() === slot" [class.live]="interact()"
            sandbox="allow-scripts" title="Invitation preview" [attr.aria-hidden]="activeFrame() !== slot"
            [attr.tabindex]="interact() && activeFrame() === slot ? 0 : -1"></iframe>
        }

        @if (!interact()) {
          <div class="overlay" #overlay
            (wheel)="onWheel($event)"
            (pointerdown)="onOverlayDown($event)"
            (pointermove)="onHover($event)"
            (pointerleave)="hoverId.set(null)"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onTouchEnd($event)"
            (touchcancel)="onTouchCancel()"
            (dblclick)="onDoubleClick($event)"
            (dragover)="onDragOver($event)"
            (drop)="onDrop($event)">

            @for (g of ghosts(); track $index) {
              <div class="ghost" [style.left.px]="g.x" [style.top.px]="g.y" [style.width.px]="g.w" [style.height.px]="g.h"
                [style.transform]="'rotate(' + g.rotate + 'deg)'"><span>{{ g.label }}</span></div>
            }

            @if (hoverBox(); as h) {
              <div class="hover" [style.left.px]="h.x" [style.top.px]="h.y" [style.width.px]="h.w" [style.height.px]="h.h"
                [style.transform]="'rotate(' + h.rotate + 'deg)'"></div>
            }

            @for (b of multiBoxes(); track b.id) {
              <div class="multi" [style.left.px]="b.box.x" [style.top.px]="b.box.y" [style.width.px]="b.box.w" [style.height.px]="b.box.h"
                [style.transform]="'rotate(' + b.box.rotate + 'deg)'"></div>
            }

            @if (selectedBox(); as box) {
              @if (editingText()) {
                <div class="text-edit" [style.left.px]="box.x - 6" [style.top.px]="box.y - 6" [style.width.px]="box.w + 12">
                  <ui-token-input #textEditor [ngModel]="editingRuns()" (ngModelChange)="draftRuns = $event"
                    [tokenLabel]="tokenLabel" label="Text" (focusChange)="!$event && finishText()" />
                </div>
              } @else {
                <ui-transform-box [box]="box" [scale]="1" [pointerScale]="frame.scale()" [label]="selectedLabel()"
                  [disabled]="!!selected()?.locked" [showSize]="resizing()" [minSize]="4"
                  (transformStart)="onTransformStart($event)" (transform)="onTransform($event)"
                  (transformEnd)="onTransformEnd($event)" (activate)="activateSelected()" (tap)="onBoxTap($event)" />
              }
            }
            <ui-snap-guides [guides]="guides()" />

            @if (pressMenu(); as m) {
              <!-- A long press on a shape: edit its outline, or carry on picking several things. -->
              <div class="press-menu" role="menu" [style.left.px]="m.x" [style.top.px]="m.y">
                <ui-button size="sm" variant="primary" role="menuitem" (click)="editShape(m.id)">✎ Edit shape</ui-button>
                <ui-button size="sm" variant="ghost" role="menuitem" (click)="selectMore(m.id)">Select more</ui-button>
              </div>
            }

            @if (store.previewFailed()) {
              <div class="status error" role="status">The preview couldn't be updated — your changes are still saved.</div>
            }
          </div>
        }

        @if (!store.preview()) {
          <div class="loading"><ui-spinner /></div>
        }
      </div>
    </ui-device-frame>
  `,
  styleUrl: './editor-canvas.component.scss',
})
export class EditorCanvasComponent {
  protected readonly store = inject(DesignStore);
  private readonly toast = inject(UiToastService);
  private readonly destroyRef = inject(DestroyRef);

  /** Live mode: the frame takes pointer and scroll, the overlay steps aside. */
  interact = input(false);
  /** Phone layout: no bezel, and finger gestures (drag the page to scroll it, long-press to add to the selection). */
  touchUi = input(false);

  protected readonly width = CANVAS_WIDTH;
  protected readonly viewport = REFERENCE_VIEWPORT;

  private readonly frames = viewChild.required(UiDeviceFrame);
  private readonly iframeEls = viewChildren<ElementRef<HTMLIFrameElement>>('preview');
  private readonly iframeRefs = computed(() => this.iframeEls().map((r) => r.nativeElement));
  private readonly overlay = viewChild<ElementRef<HTMLElement>>('overlay');
  private readonly textEditor = viewChild<UiTokenInput>('textEditor');

  protected readonly activeFrame = signal(0);
  private loadedHtml = ['', ''];

  protected readonly hoverId = signal<string | null>(null);
  protected readonly guides = signal<readonly UiGuide[]>([]);
  protected readonly resizing = signal(false);
  /** The box being dragged, drawn instead of the scene's until release. */
  private readonly draft = signal<UiBox | null>(null);
  private transformMode: 'move' | 'resize' | 'rotate' = 'move';
  protected draftRuns: UiTokenRun[] | null = null;

  protected readonly selected = computed(() => this.store.primary());
  protected readonly selectedLabel = computed(() => (this.selected() ? labelOf(this.selected()!) : ''));
  protected readonly editingText = computed(() => this.store.editingTextId() !== null && this.store.editingTextId() === this.selected()?.id);
  protected readonly editingRuns = computed(() => runsToTokens(this.selected()?.text?.runs ?? []));
  protected readonly tokenLabel = (token: string) =>
    this.store.catalog()?.variables.find((v) => v.path === token)?.label
    ?? this.store.scene()?.fields.find((f) => f.path === token)?.label
    ?? token;

  /** Screen box (relative to the visible phone) of an element at the playhead. */
  private screenBox(id: string): ScreenBox | null {
    const scene = this.store.scene();
    if (!scene) return null;
    const box = pageBoxAt(scene, id, this.store.playhead());
    return box ? { ...box, y: box.y - this.store.playhead() } : null;
  }

  protected readonly selectedBox = computed<UiBox | null>(() => {
    if (this.store.selection().length !== 1) return null;
    const draft = this.draft();
    if (draft) return draft;
    const id = this.store.primaryId();
    const box = id ? this.screenBox(id) : null;
    if (!box) return null;
    // Scale is drawn as a larger box, so the handles sit on what you see.
    const w = box.w * box.scale;
    const h = box.h * box.scale;
    return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h, rotate: box.rotate };
  });

  protected readonly multiBoxes = computed(() => {
    const ids = this.store.selection();
    if (ids.length < 2) return [];
    return ids.map((id) => ({ id, box: this.screenBox(id) })).filter((b): b is { id: string; box: ScreenBox } => !!b.box);
  });

  protected readonly hoverBox = computed(() => {
    const id = this.hoverId();
    if (!id || this.store.selection().includes(id)) return null;
    return this.screenBox(id);
  });

  /** Faint outlines where the selected element will be at each of its keyframes. */
  protected readonly ghosts = computed<Ghost[]>(() => {
    const scene = this.store.scene();
    const el = this.selected();
    if (!scene || !el || el.keyframes.length === 0 || this.store.selection().length !== 1) return [];
    const track = trackOf(scene, el);
    const playhead = this.store.playhead();
    const parentOffset = this.parentOffset(el.id);
    return resolveFrames(el)
      .filter((f, i, all) => i === 0 || i === all.length - 1 || el.keyframes.some((k) => Math.abs(k.t - f.t) < 1e-4))
      .map((f) => {
        const at = track.start + f.t * (track.end - track.start);
        const w = el.w * f.scale;
        const h = el.h * f.scale;
        return {
          x: parentOffset.x + f.x + (el.w - w) / 2,
          y: parentOffset.y + f.y + pinOffsetAt(scene, el, at) - playhead + (el.h - h) / 2,
          w, h, rotate: f.rotate, label: `${Math.round(f.t * 100)}%`,
        };
      })
      .filter((g) => Math.abs(g.y - this.selectedBox()!.y) > 2 || Math.abs(g.x - this.selectedBox()!.x) > 2);
  });

  constructor() {
    // Load a new compile into the standby frame; swap on its ready message.
    effect(() => {
      const preview = this.store.preview();
      const frames = this.iframeRefs();
      if (!preview || frames.length < 2) return;
      untracked(() => {
        const standby = 1 - this.activeFrame();
        if (this.loadedHtml[this.activeFrame()] === preview.html) return;
        const html = preview.html.replace(/window\.scrollTo\(0,[\d.]+\*u\(\)\)/, `window.scrollTo(0,${this.store.playhead()}*u())`);
        this.loadedHtml[standby] = preview.html;
        frames[standby].srcdoc = html;
      });
    });

    // Keep the visible frame scrolled to the playhead.
    let raf = 0;
    effect(() => {
      const y = this.store.playhead();
      if (this.interact()) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => this.postScroll(this.iframeRefs()[this.activeFrame()], y));
    });

    effect(() => {
      const request = this.store.tokenRequest();
      if (!request || !this.editingText()) return;
      untracked(() => this.textEditor()?.insertToken(request.path));
    });

    const onMessage = (e: MessageEvent) => {
      const frames = this.iframeRefs();
      const index = frames.findIndex((f) => f.contentWindow === e.source);
      if (index < 0) return;
      const data = e.data as { type?: string; y?: number };
      if (data?.type === 'ib:ready' && index !== this.activeFrame()) {
        this.postScroll(frames[index], this.store.playhead());
        this.activeFrame.set(index);
      } else if (data?.type === 'ib:scrolled' && index === this.activeFrame() && this.interact() && typeof data.y === 'number') {
        this.store.playhead.set(Math.max(0, Math.min(this.store.range(), data.y)));
      }
    };
    window.addEventListener('message', onMessage);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('message', onMessage);
      cancelAnimationFrame(raf);
      cancelAnimationFrame(this.glide);
      this.clearLongPress();
    });
  }

  private postScroll(frame: HTMLIFrameElement | undefined, y: number): void {
    frame?.contentWindow?.postMessage({ type: 'ib:scroll', y }, '*');
  }

  // ----- Pointer -----------------------------------------------------------------------------------

  /** Pointer position in screen units (the unscaled 390-wide phone). */
  private toScreen(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const rect = this.overlay()!.nativeElement.getBoundingClientRect();
    const scale = this.frames().scale();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  }

  /** The topmost element under a screen point, optionally only among a group's children. */
  private hitTest(point: { x: number; y: number }, within: string | null = null): string | null {
    const scene = this.store.scene();
    if (!scene) return null;
    const hidden = this.store.hidden();
    const flat = flatten(scene);
    const candidates = flat.filter((f) => (within ? f.parentId === within : f.depth === 0));
    for (let i = candidates.length - 1; i >= 0; i--) {
      const el = candidates[i].element;
      if (hidden.has(el.id)) continue;
      const box = this.screenBox(el.id);
      if (!box || box.opacity < 0.02) continue;
      if (!pointInBox(point, box)) continue;
      // A hollow shape (a ring, a frame) is its outline, not its box: clicking inside it reaches what
      // it's drawn around — the text inside a ring used to be unselectable.
      if (el.type === 'shape' && !el.shape?.fill && el.shape?.kind !== 'line' && el.shape?.kind !== 'path' && !nearOutline(point, box, el.shape?.kind ?? 'rect', (el.shape?.strokeWidth ?? 1) / 2 + 8)) continue;
      return el.id;
    }
    return null;
  }

  // ----- Touch -------------------------------------------------------------------------------------
  //
  // A finger on the page itself (not on the selection box, which drags with pointer events) is read
  // when it lifts: a tap selects, a drag scrolls the invitation like a page (with a glide on a
  // flick), and a long press adds to the selection. Pointer events from touches are ignored here so
  // one finger isn't handled twice.

  private touch: {
    id: number; x: number; y: number; playhead: number; at: number;
    lastY: number; lastAt: number; velocity: number; mode: 'pending' | 'scroll' | 'done'; onBox: boolean;
  } | null = null;
  private longPress: ReturnType<typeof setTimeout> | null = null;
  private glide = 0;

  /** The menu a long press on a shape opens, in screen units. */
  protected readonly pressMenu = signal<{ id: string; x: number; y: number } | null>(null);

  protected editShape(id: string): void {
    this.pressMenu.set(null);
    this.store.openShapeEditor(id);
  }

  protected selectMore(id: string): void {
    this.pressMenu.set(null);
    this.store.select(id, true);
  }

  /** The shape under a point, looking inside a group if that's what is on top. */
  private shapeAt(point: { x: number; y: number }): string | null {
    const scene = this.store.scene();
    let id = this.hitTest(point);
    for (let depth = 0; id && depth < 4; depth++) {
      const el = scene ? findElement(scene, id) : null;
      if (el?.type === 'shape') return id;
      if (el?.type !== 'group') return null;
      id = this.hitTest(point, id);
    }
    return null;
  }

  protected onTouchStart(e: TouchEvent): void {
    cancelAnimationFrame(this.glide);
    if (!(e.target as Element | null)?.closest('.press-menu')) this.pressMenu.set(null);
    const target = e.target as Element | null;
    // On the page itself, or on the selection's body — which moves the element when dragged, but
    // taps and long-presses still mean what's under the finger.
    const onBox = !!target?.closest('ui-transform-box') && !!target?.classList.contains('body');
    if (e.touches.length > 1 || (target !== this.overlay()?.nativeElement && !onBox)) {
      this.onTouchCancel();
      return;
    }
    const t = e.changedTouches[0];
    this.touch = {
      id: t.identifier, x: t.clientX, y: t.clientY, playhead: this.store.playhead(), at: e.timeStamp,
      lastY: t.clientY, lastAt: e.timeStamp, velocity: 0, mode: 'pending', onBox,
    };
    const point = this.toScreen(t);
    this.longPress = setTimeout(() => {
      if (this.touch?.mode !== 'pending') return;
      this.touch.mode = 'done';
      const id = this.hitTest(point);
      if (!id) return;
      this.store.editingTextId.set(null);
      navigator.vibrate?.(12);
      // On a shape, ask: edit its outline, or add it to the selection as a long press always has.
      const shape = this.shapeAt(point);
      if (shape) {
        this.store.select(shape);
        this.pressMenu.set({ id: shape, x: Math.max(8, Math.min(point.x - 70, 390 - 190)), y: Math.max(8, point.y - 64) });
        return;
      }
      this.store.select(id, true);
    }, 480);
  }

  protected onTouchMove(e: TouchEvent): void {
    const d = this.touch;
    if (!d) return;
    const t = Array.from(e.changedTouches).find((x) => x.identifier === d.id);
    if (!t) return;
    if (d.mode === 'pending' && Math.hypot(t.clientX - d.x, t.clientY - d.y) > 8) {
      // Dragging the selection moves it (the box does that); dragging the page scrolls it.
      d.mode = d.onBox ? 'done' : 'scroll';
      this.clearLongPress();
    }
    if (d.mode !== 'scroll') return;
    const dt = e.timeStamp - d.lastAt;
    if (dt > 0) d.velocity = 0.7 * ((t.clientY - d.lastY) / dt) + 0.3 * d.velocity;
    d.lastY = t.clientY;
    d.lastAt = e.timeStamp;
    // Like scrolling a page: drag up to move on.
    this.setPlayhead(d.playhead - (t.clientY - d.y) / this.frames().scale());
  }

  protected onTouchEnd(e: TouchEvent): void {
    const d = this.touch;
    if (!d || !Array.from(e.changedTouches).some((x) => x.identifier === d.id)) return;
    this.touch = null;
    this.clearLongPress();
    if (d.mode === 'pending') {
      const t = Array.from(e.changedTouches).find((x) => x.identifier === d.id)!;
      this.tapAt(this.toScreen(t));
    } else if (d.mode === 'scroll' && e.timeStamp - d.lastAt < 80) {
      this.glideFrom(d.velocity);
    }
  }

  protected onTouchCancel(): void {
    this.touch = null;
    this.clearLongPress();
  }

  private clearLongPress(): void {
    if (this.longPress) clearTimeout(this.longPress);
    this.longPress = null;
  }

  private setPlayhead(y: number): void {
    this.store.playhead.set(Math.round(Math.max(0, Math.min(this.store.range(), y))));
  }

  private glideFrom(velocity: number): void {
    let v = velocity;
    if (Math.abs(v) < 0.1) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;
      this.setPlayhead(this.store.playhead() - (v * dt) / this.frames().scale());
      v *= Math.pow(0.94, dt / 16);
      const p = this.store.playhead();
      if (Math.abs(v) < 0.05 || p <= 0 || p >= this.store.range()) return;
      this.glide = requestAnimationFrame(step);
    };
    this.glide = requestAnimationFrame(step);
  }

  /** A mouse click on the selection that didn't move it: select what's under the pointer, as anywhere else. */
  protected onBoxTap(e: { clientX: number; clientY: number; shiftKey: boolean; pointerType: string }): void {
    if (e.pointerType === 'touch') return;
    const point = this.toScreen(e);
    const id = this.hitTest(point);
    if (id && id !== this.store.primaryId()) this.selectAt(point, e.shiftKey);
  }

  /** A tap: selects what's under it; tapping a selected group again goes inside it. */
  private tapAt(point: { x: number; y: number }): void {
    const current = this.selected();
    if (current?.type === 'group' && this.hitTest(point) === current.id) {
      const child = this.hitTest(point, current.id);
      if (child) {
        this.store.select(child);
        return;
      }
    }
    this.selectAt(point, false);
  }

  /** Clicking selects the outermost element, or — inside a selected group — its child. */
  protected onOverlayDown(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    if (e.button !== 0 || e.target !== this.overlay()?.nativeElement) return;
    this.selectAt(this.toScreen(e), e.shiftKey);
  }

  private selectAt(point: { x: number; y: number }, additive: boolean): void {
    const current = this.selected();
    const scene = this.store.scene();
    let id: string | null = null;
    if (current && scene) {
      const flat = flatten(scene).find((f) => f.element.id === current.id);
      // Inside a group already: keep picking among the same siblings.
      if (flat?.parentId) id = this.hitTest(point, flat.parentId);
    }
    id ??= this.hitTest(point);
    this.store.editingTextId.set(null);
    this.store.select(id, additive);
  }

  protected onHover(e: PointerEvent): void {
    if (e.pointerType === 'touch' || e.target !== this.overlay()?.nativeElement) return;
    this.hoverId.set(this.hitTest(this.toScreen(e)));
  }

  protected onDoubleClick(e: MouseEvent): void {
    const point = this.toScreen(e);
    const shape = this.shapeAt(point);
    if (shape && this.store.primaryId() === shape) {
      this.store.openShapeEditor(shape);
      return;
    }
    const group = this.selected();
    if (group?.type === 'group') {
      const child = this.hitTest(point, group.id);
      if (child) this.store.select(child);
    }
  }

  protected activateSelected(): void {
    const el = this.selected();
    if (!el) return;
    if (el.type === 'text') {
      this.draftRuns = null;
      this.store.editingTextId.set(el.id);
      setTimeout(() => this.textEditor()?.focus());
    } else if (el.type === 'shape') {
      this.store.openShapeEditor(el.id);
    } else if (el.type === 'group') {
      const first = el.children?.at(-1);
      if (first) this.store.select(first.id);
    }
  }

  protected finishText(): void {
    const el = this.selected();
    const runs = this.draftRuns;
    this.store.editingTextId.set(null);
    if (!el || !runs) return;
    const next = tokensToRuns(runs);
    if (JSON.stringify(next) !== JSON.stringify(el.text?.runs ?? [])) this.store.update(el.id, (e) => ({ ...e, text: { ...e.text!, runs: next } }));
  }

  protected onWheel(e: WheelEvent): void {
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    const next = Math.max(0, Math.min(this.store.range(), this.store.playhead() + delta / this.frames().scale()));
    this.store.playhead.set(Math.round(next));
  }

  // ----- Transform ---------------------------------------------------------------------------------

  protected onTransformStart(mode: 'move' | 'resize' | 'rotate'): void {
    this.transformMode = mode;
    this.resizing.set(mode === 'resize');
  }

  protected onTransform(box: UiBox): void {
    if (this.transformMode !== 'move') {
      this.draft.set(box);
      this.guides.set([]);
      return;
    }
    const others = this.snapTargets();
    const snap = uiSnap(uiRotatedBounds(box), others, 5 / Math.max(0.3, this.frames().scale()), {
      vertical: [CANVAS_WIDTH / 2, 24, CANVAS_WIDTH - 24],
      horizontal: [REFERENCE_VIEWPORT / 2],
    });
    this.guides.set(snap.guides);
    this.draft.set({ ...box, x: box.x + snap.dx, y: box.y + snap.dy });
  }

  protected onTransformEnd(box: UiBox): void {
    const el = this.selected();
    const final = this.transformMode === 'move' && this.draft() ? this.draft()! : box;
    const mode = this.transformMode;
    // The next transform may arrive without a start — arrow-key nudges do — and is a move.
    this.transformMode = 'move';
    this.draft.set(null);
    this.guides.set([]);
    this.resizing.set(false);
    if (!el) return;

    const playhead = this.store.playhead();
    const scene = this.store.scene()!;
    const current = pageBoxAt(scene, el.id, playhead)!;
    // Undo the drawn scale: the box on screen is the element scaled about its centre.
    const scale = current.scale || 1;
    const w = final.w / scale;
    const h = final.h / scale;
    const cx = final.x + final.w / 2;
    const cy = final.y + final.h / 2 + playhead;
    const change = { x: cx - w / 2, y: cy - h / 2, rotate: final.rotate };
    const sized = Math.abs(w - el.w) > 0.05 || Math.abs(h - el.h) > 0.05;

    let created: boolean;
    if (mode === 'rotate') created = this.store.place(el.id, { rotate: final.rotate });
    else created = this.store.place(el.id, { x: change.x, y: change.y }, sized ? { w, h } : undefined);

    if (created) {
      this.toast.show({
        message: `Keyframe added at ${Math.round(((playhead - trackOf(scene, el).start) / Math.max(1, trackOf(scene, el).end - trackOf(scene, el).start)) * 100)}% of “${labelOf(el)}”.`,
        tone: 'info',
        duration: 5000,
        action: { label: 'Undo', run: () => this.store.undo() },
      });
    }
  }

  private snapTargets(): { x: number; y: number; w: number; h: number }[] {
    const scene = this.store.scene();
    const selected = this.store.selection();
    if (!scene) return [];
    const hidden = this.store.hidden();
    return flatten(scene)
      .filter((f) => f.depth === 0 && !selected.includes(f.element.id) && !hidden.has(f.element.id))
      .map((f) => this.screenBox(f.element.id))
      .filter((b): b is ScreenBox => !!b && b.opacity > 0.02 && b.y + b.h > -50 && b.y < REFERENCE_VIEWPORT + 50)
      .map((b) => uiRotatedBounds(b));
  }

  private parentOffset(id: string): { x: number; y: number } {
    return groupOffsetAt(this.store.scene()!, id, this.store.playhead());
  }

  // ----- Drop --------------------------------------------------------------------------------------

  protected onDragOver(e: DragEvent): void {
    const types = e.dataTransfer?.types ?? [];
    if (types.includes('application/x-ib-variable') || types.includes('Files')) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    }
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    const point = this.toScreen(e);
    const at = { x: point.x, y: point.y + this.store.playhead() };
    const variable = e.dataTransfer?.getData('application/x-ib-variable');
    if (variable) {
      window.dispatchEvent(new CustomEvent('ib-designer:add-variable', { detail: { path: variable, at } }));
      return;
    }
    const file = e.dataTransfer?.files?.[0];
    if (file) void this.store.importAsset(file, at);
  }

  /** For the poster and colour-aware bits of the overlay. */
  protected colorOf(el: DesignElement): string {
    return resolveColor(this.store.scene()!, el.shape?.fill);
  }
}

/** Whether a point lies within `slack` of a box's (or ellipse's) outline, in the box's rotated frame. */
function nearOutline(p: { x: number; y: number }, box: ScreenBox, kind: string, slack: number): boolean {
  const w = (box.w * box.scale) / 2;
  const h = (box.h * box.scale) / 2;
  const rad = (-box.rotate * Math.PI) / 180;
  const dx = p.x - (box.x + box.w / 2);
  const dy = p.y - (box.y + box.h / 2);
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  if (kind === 'ellipse') {
    // Distance from the ellipse edge, approximated along the ray from the centre.
    const r = Math.hypot(lx / Math.max(1, w), ly / Math.max(1, h));
    return Math.abs(r - 1) * Math.min(w, h) <= slack;
  }
  return Math.min(w - Math.abs(lx), h - Math.abs(ly)) <= slack;
}

function pointInBox(p: { x: number; y: number }, box: ScreenBox): boolean {
  const w = box.w * box.scale;
  const h = box.h * box.scale;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const rad = (-box.rotate * Math.PI) / 180;
  const dx = p.x - cx;
  const dy = p.y - cy;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  // Thin elements (lines) get a little slack so they can be clicked at all.
  return Math.abs(lx) <= Math.max(w / 2, 6) && Math.abs(ly) <= Math.max(h / 2, 6);
}
