import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiSequencer, type UiSequencerRow } from '@zouriel/ui/sequencer';
import { UiButton } from '@zouriel/ui/button';
import { UiSlider } from '@zouriel/ui/form';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UiToastService } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import { flatten, labelOf, reorderElement as reorder, sectionMarkers, trackOf } from './model/scene-ops';

const KIND: Record<string, string> = {
  text: 'Text', shape: 'Shape', svg: 'SVG', image: 'Pic', slot: 'Photo', rsvp: 'RSVP', link: 'Link', dress: 'Dress', group: 'Group',
};

/**
 * The scroll track: a row per element (front-most first, groups indented), its bar the part of the
 * scroll it animates over, diamonds for its keyframes, the playhead shared with the canvas.
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
      <span class="where" aria-live="polite">{{ where() }}</span>
      <span class="spacer"></span>
      @if (store.primary(); as el) {
        <ui-button size="sm" variant="ghost" (click)="store.addKeyframeAtPlayhead(el.id)"
          uiTooltip="Add a keyframe for the selected element here (K)">◆ Keyframe here</ui-button>
      }
      <label class="zoom">
        <span>Zoom</span>
        <ui-slider [min]="1" [max]="6" [step]="0.5" [showValue]="false" label="Timeline zoom" [(ngModel)]="zoom" />
      </label>
    </div>
    <div class="seq">
      <ui-sequencer
        [rows]="rows()" [length]="length()" [markers]="markers()" [zoom]="zoom"
        [playhead]="store.playhead()" (playheadChange)="store.playhead.set($event)"
        [selectedRowId]="store.primaryId()" (selectedRowIdChange)="onRowSelect($event)"
        [selectedKeyframeId]="selectedKeyframeId()" (selectedKeyframeIdChange)="onKeyframeSelect($event)"
        (rangeChange)="onRange($event)" (keyframeChange)="onKeyframe($event)" (keyframeDelete)="onKeyframeDelete($event)"
        (keyframeMenu)="onKeyframeSelect($event.keyframeId)" (rowReorder)="onReorder($event)"
        (muteToggle)="store.toggleHidden($event)" (lockToggle)="toggleLock($event)"
        title="Layers" emptyText="Add something to the page to see it here" [labelWidth]="220" [rowHeight]="30" />
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

  protected zoom = 1;
  /** Live drag state, drawn instead of the scene until release. */
  private readonly override = signal<{ rowId: string; start?: number; end?: number; keyframeId?: string; at?: number } | null>(null);

  protected readonly length = computed(() => Math.max(1, this.store.range()));
  protected readonly markers = computed(() => (this.store.scene() ? sectionMarkers(this.store.scene()!) : []));

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
    return ordered.map((f) => {
      const el = f.element;
      const track = trackOf(scene, el);
      const live = o?.rowId === el.id ? o : null;
      return {
        id: el.id,
        label: labelOf(el),
        kind: KIND[el.type],
        depth: f.depth,
        start: live?.start ?? track.start,
        end: live?.end ?? track.end,
        muted: hidden.has(el.id),
        locked: !!el.locked,
        keyframes: el.keyframes.map((k, i) => ({
          id: `${el.id}:${i}`,
          at: live?.keyframeId === `${el.id}:${i}` && live.at !== undefined ? live.at : k.t,
          label: `${Math.round(k.t * 100)}%${k.easing ? ' · ' + k.easing : ''}`,
        })),
      };
    });
  });

  protected readonly selectedKeyframeId = computed(() => {
    const id = this.store.primaryId();
    const index = this.store.selectedKeyframe();
    return id !== null && index !== null ? `${id}:${index}` : null;
  });

  protected readonly where = computed(() => {
    const scene = this.store.scene();
    if (!scene) return '';
    const markers = sectionMarkers(scene);
    const y = this.store.playhead();
    const current = [...markers].reverse().find((m) => m.at <= y + 0.5) ?? markers[0];
    const pct = Math.round((y / this.length()) * 100);
    return `${current?.label ?? ''} · scrolled ${Math.round(y)} (${pct}%)`;
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
    this.store.setTrack(e.rowId, e.start, e.end);
  }

  protected onKeyframe(e: { rowId: string; keyframeId: string; at: number; final: boolean }): void {
    if (!e.final) {
      this.override.set({ rowId: e.rowId, keyframeId: e.keyframeId, at: e.at });
      return;
    }
    this.override.set(null);
    const index = Number(e.keyframeId.split(':')[1]);
    const next = this.store.moveKeyframe(e.rowId, index, e.at);
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

