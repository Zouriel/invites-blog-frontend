import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiTree, UiTreeNodeEnd, type UiTreeNode } from '@zouriel/ui/data';
import { UiSnackbarService } from '@zouriel/ui/dialog';
import { DesignStore } from './design.store';
import { ICONS } from './designer-icons';
import type { DesignElement, ElementType } from './model/scene';
import { findElement, flatten, labelOf } from './model/scene-ops';

const TYPE_ICON: Record<ElementType, keyof typeof ICONS> = {
  text: 'text', shape: 'shape', svg: 'library', image: 'picture', slot: 'photo', rsvp: 'rsvp', link: 'link', dress: 'dress', group: 'group',
};

/**
 * The desktop Layers panel: every element as a tree, front-most at the top, groups opening to show
 * what's in them. Click selects (Shift for a range, Ctrl/Cmd to add one); the eye hides a layer while
 * you work and the lock stops it moving; dragging a layer (or Alt+↑/↓) changes what's in front; double-clicking a name (or F2) renames it.
 */
@Component({
  selector: 'app-layers-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiTree, UiTreeNodeEnd],
  template: `
    @if (nodes().length) {
      <ui-tree label="Layers" [nodes]="nodes()" [multiple]="true" [reorderable]="true" [renamable]="true" (nodeRename)="rename($event)"
        [selectedValues]="store.selection()" (selectedValuesChange)="select($event)"
        [expanded]="expanded()" (expandedChange)="opened.set($event)" (nodeMove)="move($event)">
        <ng-template uiTreeNodeEnd let-node>
          <span class="actions">
            <button type="button" class="act" [class.on]="isHidden(node.value)" [attr.aria-pressed]="isHidden(node.value)"
              [attr.aria-label]="(isHidden(node.value) ? 'Show ' : 'Hide ') + node.label" [title]="isHidden(node.value) ? 'Hidden while you work — show' : 'Hide while you work'"
              (click)="store.toggleHidden(node.value)">
              <hugeicons-icon [icon]="isHidden(node.value) ? icons.hidden : icons.shown" [size]="15" [strokeWidth]="1.8" />
            </button>
            <button type="button" class="act" [class.on]="isLocked(node.value)" [attr.aria-pressed]="isLocked(node.value)"
              [attr.aria-label]="(isLocked(node.value) ? 'Unlock ' : 'Lock ') + node.label" [title]="isLocked(node.value) ? 'Locked — unlock' : 'Lock in place'"
              (click)="toggleLock(node.value)">
              <hugeicons-icon [icon]="isLocked(node.value) ? icons.lock : icons.unlock" [size]="15" [strokeWidth]="1.8" />
            </button>
          </span>
        </ng-template>
      </ui-tree>
      <p class="hint">Drag a layer up or down to put it in front of or behind the others. Double-click a name (or press F2) to rename it.</p>
    } @else {
      <p class="empty">Nothing on the page yet. Pick a tool on the left and draw it on the phone.</p>
    }
  `,
  styles: `
    :host { display: block; padding: var(--ui-space-2); }
    .actions { display: inline-flex; gap: 2px; }
    .act { display: grid; place-items: center; width: 24px; height: 24px; padding: 0; border: 0; border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text-muted); cursor: pointer; opacity: 0.55; }
    .act:hover, .act:focus-visible, .act.on { opacity: 1; }
    .act:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .act:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .hint, .empty { margin: var(--ui-space-3) var(--ui-space-2) 0; font-size: 12px; color: var(--ui-color-text-muted); }
  `,
})
export class LayersPanelComponent {
  protected readonly store = inject(DesignStore);
  private readonly snackbar = inject(UiSnackbarService);
  protected readonly icons = ICONS;

  /** Groups the person opened; groups holding the selection open by themselves. */
  protected readonly opened = signal<string[]>([]);

  protected readonly nodes = computed<UiTreeNode[]>(() => {
    const scene = this.store.scene();
    if (!scene) return [];
    const hidden = this.store.hidden();
    // Front-most first, as layers panels list them; the scene stores back-to-front paint order.
    const toNodes = (els: readonly DesignElement[]): UiTreeNode[] => [...els].reverse().map((el) => ({
      value: el.id,
      label: labelOf(el),
      icon: ICONS[TYPE_ICON[el.type]],
      muted: hidden.has(el.id),
      container: el.type === 'group',
      ...(el.type === 'group' ? { children: toNodes(el.children ?? []) } : {}),
    }));
    return toNodes(scene.elements);
  });

  protected readonly expanded = computed(() => {
    const scene = this.store.scene();
    const open = new Set(this.opened());
    if (scene) {
      const flat = flatten(scene);
      for (const id of this.store.selection()) {
        let parent = flat.find((f) => f.element.id === id)?.parentId ?? null;
        while (parent) {
          open.add(parent);
          parent = flat.find((f) => f.element.id === parent)?.parentId ?? null;
        }
      }
    }
    return [...open];
  });

  protected isHidden(id: string): boolean {
    return this.store.hidden().has(id);
  }

  protected isLocked(id: string): boolean {
    const scene = this.store.scene();
    return !!(scene && findElement(scene, id)?.locked);
  }

  protected toggleLock(id: string): void {
    this.store.update(id, (el) => ({ ...el, locked: !el.locked }));
  }

  protected select(ids: string[]): void {
    this.store.editingTextId.set(null);
    this.store.selectedKeyframe.set(null);
    this.store.selection.set(ids);
  }

  /** A layer renamed in the list: its name everywhere (canvas label, timeline, Check). */
  protected rename(e: { value: string; label: string }): void {
    const name = e.label.trim().slice(0, 80);
    if (name) this.store.update(e.value, (el) => ({ ...el, name }));
  }

  /** A layer dragged to a new place: front-first tree order turned into paint order among its siblings. */
  protected move(e: { value: string; parent: string | null; index: number }): void {
    const scene = this.store.scene();
    if (!scene) return;
    const flat = flatten(scene).find((f) => f.element.id === e.value);
    if (!flat) return;
    if ((flat.parentId ?? null) !== e.parent) {
      this.snackbar.show('Layers can be reordered within their own group. Ungroup to move one out.');
      return;
    }
    const siblings = flat.parentId ? findElement(scene, flat.parentId)?.children ?? [] : scene.elements;
    // After taking it out there are n others; tree index i (from the front) is paint index n - i.
    const paint = siblings.length - 1 - e.index;
    if (paint !== flat.index) this.store.arrange(e.value, paint - flat.index);
  }
}
