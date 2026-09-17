import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSequencer, type UiSequencerRow } from '@zouriel/ui/sequencer';
import { UiButton } from '@zouriel/ui/button';
import { UiSlider } from '@zouriel/ui/form';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UiToastService } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import { flatten, hasTrack, labelOf, reorderElement as reorder, spanOf, trackOf } from './model/scene-ops';

const KIND: Record<string, string> = {
  text: 'Text', shape: 'Shape', svg: 'SVG', image: 'Pic', slot: 'Photo', rsvp: 'RSVP', link: 'Link', dress: 'Dress', group: 'Group',
};

/**
 * The scroll track: a bar per element, front-most on top, laid along the scroll like clips in a video
 * editor. An element that moves or pins shows its track, with diamonds for its keyframes and edges to
 * trim; one that just sits on the page shows while it's on screen. No names beside the bars — a tap
 * shows whose it is.
 *
 * <p>Hold a bar to lift it: sideways moves it through the scroll (down the page, motion and all),
 * up or down puts it in front of or behind the others. The page ends where its last element does;
 * the shaded stretch after that is room to add the next thing. Pinch to zoom.</p>
 *
 * <p>Bars and diamonds drag live against a local override and commit once on release, so one gesture
 * is one undo step.</p>
 */
@Component({
  selector: 'app-editor-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiSequencer, UiButton, UiSlider, UiTooltip],
  template: `
    <div class="bar">
      <span class="where" aria-live="polite">{{ compact() ? whereShort() : where() }}</span>
      <span class="spacer"></span>
      @if (store.primary(); as el) {
        <ui-button size="sm" variant="ghost" (click)="store.addKeyframeAtPlayhead(el.id)"
          uiTooltip="Add a keyframe for the selected element here (K)">◆ Keyframe here</ui-button>
      }
      @if (!compact()) {
        <label class="zoom">
          <span>Zoom</span>
          <ui-slider [min]="1" [max]="16" [step]="0.5" [showValue]="false" label="Timeline zoom" [ngModel]="zoom()" (ngModelChange)="zoom.set($event)" />
        </label>
      }
    </div>
    <div class="seq">
      <ui-sequencer
        [rows]="rows()" [length]="length()" [markers]="markers()" [(zoom)]="zoom" [showLabels]="false" [end]="store.pageRange()"
        [playhead]="store.playhead()" (playheadChange)="store.playhead.set($event)"
        [selectedRowId]="store.primaryId()" (selectedRowIdChange)="onRowSelect($event)"
        [selectedKeyframeId]="selectedKeyframeId()" (selectedKeyframeIdChange)="onKeyframeSelect($event)"
        (rangeChange)="onRange($event)" (keyframeChange)="onKeyframe($event)" (keyframeDelete)="onKeyframeDelete($event)"
        (keyframeMenu)="onKeyframeSelect($event.keyframeId)" (rowReorder)="onReorder($event)"
        (muteToggle)="store.toggleHidden($event)" (lockToggle)="toggleLock($event)"
        title="Layers" emptyText="Add something to the page to see it here" [rowHeight]="compact() ? 30 : 24" [compact]="compact()" />
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 0; height: 100%; background: var(--ui-color-surface); }
    .bar { display: flex; align-items: center; gap: 10px; padding: 4px 10px; border-bottom: 1px solid var(--ui-color-border); min-height: 36px; }
    .where { font: 500 12px var(--ui-font-mono); color: var(--ui-color-text-secondary); white-space: nowrap; }
    .spacer { flex: 1; }
    .zoom { display: flex; align-items: center; gap: 8px; width: 190px; overflow: hidden; padding-right: 8px; font-size: 12px; color: var(--ui-color-text-muted); }
    .zoom ui-slider { flex: 1; }
    .seq { position: relative; flex: 1; min-height: 0; }
  `,
})
export class EditorTimelineComponent {
  protected readonly store = inject(DesignStore);
  private readonly toast = inject(UiToastService);

  /** Narrow labels and taller rows, for a phone. */
  compact = input(false);

  protected readonly zoom = signal(1);
  /** Live drag state, drawn instead of the scene until release. */
  private readonly override = signal<{ rowId: string; start?: number; end?: number; keyframeId?: string; at?: number } | null>(null);

  protected readonly length = computed(() => Math.max(1, this.store.range()));
  protected readonly markers = computed(() => [{ at: this.store.pageRange(), label: 'End' }]);

  protected readonly rows = computed<UiSequencerRow[]>(() => {
    const scene = this.store.scene();
    if (!scene) return [];
    const hidden = this.store.hidden();
    const o = this.override();
    // Front-most first, like every layers panel; children directly under their group.
    const ordered: ReturnType<typeof flatten> = [];
    const walk = (parentId: string | null) => {
      const siblings = flatten(scene).filter((f) => f.parentId === parentId).reverse();
      for (const f of siblings) {
        ordered.push(f);
        if (f.element.type === 'group') walk(f.element.id);
      }
    };
    walk(null);
    const length = this.length();
    const byId = new Map(flatten(scene).map((f) => [f.element.id, f]));
    const groupTop = (id: string | null): number => {
      let y = 0;
      for (let p = id ? byId.get(id) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) y += p.element.y;
      return y;
    };
    return ordered.map((f) => {
      const el = f.element;
      const track = spanOf(scene, el, groupTop(f.parentId));
      const live = o?.rowId === el.id ? o : null;
      return {
        id: el.id,
        label: labelOf(el),
        kind: KIND[el.type],
        depth: f.depth,
        // Motion running past the end of the timeline is drawn cut off there, like the page cuts it off.
        start: live?.start ?? Math.min(track.start, length),
        end: live?.end ?? Math.min(track.end, length),
        muted: hidden.has(el.id),
        locked: !!el.locked,
        fixed: !hasTrack(el),
        // Diamonds sit on the drawn bar, which may be cut off at the end: placed by scroll position, and those past the cut hidden.
        keyframes: el.keyframes.map((k, i) => ({
          id: `${el.id}:${i}`,
          at: live?.keyframeId === `${el.id}:${i}` && live.at !== undefined ? live.at : this.toBar(track, length, k.t),
          label: `${Math.round(k.t * 100)}%${k.easing ? ' · ' + k.easing : ''}`,
        })).filter((k) => k.at <= 1.0001),
      };
    });
  });

  /** A keyframe's place on a bar drawn from `track.start` to `min(track.end, length)`. */
  private toBar(track: { start: number; end: number }, length: number, t: number): number {
    const drawn = Math.min(track.end, length) - track.start;
    return drawn > 0 ? (t * (track.end - track.start)) / drawn : t;
  }

  protected readonly selectedKeyframeId = computed(() => {
    const id = this.store.primaryId();
    const index = this.store.selectedKeyframe();
    return id !== null && index !== null ? `${id}:${index}` : null;
  });

  protected readonly where = computed(() => {
    const y = Math.round(this.store.playhead());
    const end = Math.round(this.store.pageRange());
    return y > end ? `Past the end · ${y} of ${end}` : `Scrolled ${y} of ${end}`;
  });

  protected readonly whereShort = computed(() => {
    const y = this.store.playhead();
    const end = this.store.pageRange();
    return y > end + 0.5 ? 'Past the end' : `${Math.round((y / Math.max(1, end)) * 100)}%`;
  });

  protected onRowSelect(id: string | null): void {
    if (id !== this.store.primaryId()) this.store.select(id);
  }

  protected onKeyframeSelect(keyframeId: string | null): void {
    if (!keyframeId) {
      this.store.selectedKeyframe.set(null);
      return;
    }
    const [rowId, index] = keyframeId.split(':');
    if (rowId !== this.store.primaryId()) this.store.select(rowId);
    this.store.selectedKeyframe.set(Number(index));
    // Jump to it, so the canvas shows the element at that keyframe.
    const scene = this.store.scene();
    const el = scene ? flatten(scene).find((f) => f.element.id === rowId)?.element : null;
    if (scene && el) {
      const track = trackOf(scene, el);
      const k = el.keyframes[Number(index)];
      if (k) this.store.playhead.set(Math.round(track.start + k.t * (track.end - track.start)));
    }
  }

  protected onRange(e: { rowId: string; start: number; end: number; final: boolean }): void {
    if (!e.final) {
      this.override.set({ rowId: e.rowId, start: e.start, end: e.end });
      return;
    }
    this.override.set(null);
    const row = this.rows().find((r) => r.id === e.rowId);
    const scene = this.store.scene();
    const el = scene ? flatten(scene).find((f) => f.element.id === e.rowId)?.element : null;
    if (!row || !el) return;
    // A drag the browser took back (to scroll) reports its starting values: nothing to commit.
    if (Math.round(row.start) === Math.round(e.start) && Math.round(row.end) === Math.round(e.end)) return;
    const moved = Math.abs((e.end - e.start) - (row.end - row.start)) < 0.5;
    // Moving goes down the page. A bar that only shows where it sits is measured by its end: its start
    // stops at the top of the page, its end never does.
    if (moved) this.store.moveInTime(e.rowId, hasTrack(el) ? e.start - row.start : e.end - row.end);
    else {
      // An edge left where it was keeps its real value — a track cut off at the end of the timeline isn't shortened by trimming its start.
      const real = trackOf(scene!, el);
      this.store.setTrack(e.rowId, Math.abs(e.start - row.start) < 0.5 ? real.start : e.start, Math.abs(e.end - row.end) < 0.5 ? real.end : e.end);
    }
  }

  protected onKeyframe(e: { rowId: string; keyframeId: string; at: number; final: boolean }): void {
    if (!e.final) {
      this.override.set({ rowId: e.rowId, keyframeId: e.keyframeId, at: e.at });
      return;
    }
    this.override.set(null);
    const index = Number(e.keyframeId.split(':')[1]);
    const scene = this.store.scene();
    const el = scene ? flatten(scene).find((f) => f.element.id === e.rowId)?.element : null;
    if (!scene || !el) return;
    const track = trackOf(scene, el);
    const t = e.at / Math.max(1e-9, this.toBar(track, this.length(), 1));
    if (Math.abs((el.keyframes[index]?.t ?? -1) - t) < 0.0005) return;
    const next = this.store.moveKeyframe(e.rowId, index, t);
    this.store.selectedKeyframe.set(next);
  }

  protected onKeyframeDelete(e: { rowId: string; keyframeId: string }): void {
    this.store.removeKeyframe(e.rowId, Number(e.keyframeId.split(':')[1]));
  }

  /** Rows are front-first; a drop reorders within the element's own group only. */
  protected onReorder(e: { rowId: string; toIndex: number }): void {
    const rows = this.rows();
    const moving = rows.find((r) => r.id === e.rowId);
    const scene = this.store.scene();
    if (!moving || !scene) return;
    const flat = flatten(scene);
    const parentOf = (id: string) => flat.find((f) => f.element.id === id)?.parentId ?? null;
    const parent = parentOf(e.rowId);
    const remaining = rows.filter((r) => r.id !== e.rowId);
    const neighbour = remaining[Math.min(e.toIndex, remaining.length - 1)];
    if (neighbour && parentOf(neighbour.id) !== parent) {
      this.toast.info('Layers can be reordered within their own group. Ungroup to move one out.');
      return;
    }
    // Position among siblings, converted from front-first rows to back-first paint order.
    const siblingsFrontFirst = remaining.filter((r) => parentOf(r.id) === parent);
    const before = remaining.slice(0, e.toIndex).filter((r) => parentOf(r.id) === parent).length;
    const paintIndex = siblingsFrontFirst.length - before;
    const target = siblingsFrontFirst.length === 0 ? 0 : paintIndex;
    const current = flat.find((f) => f.element.id === e.rowId)!;
    if (current.index === target) return;
    this.store.mutate((s) => reorder(s, e.rowId, target));
  }

  protected toggleLock(id: string): void {
    this.store.update(id, (el) => ({ ...el, locked: !el.locked }));
  }
}

