import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output } from '@angular/core';
import { DesignStore } from './design.store';
import type { CatalogVariable } from './model/scene';
import { createElement, insertElement } from './model/scene-ops';

interface Chip {
  path: string;
  label: string;
  kind: CatalogVariable['kind'];
  sample: string;
  type: string;
}

/**
 * Every field a template can use, as chips. Tap one to put it on the page (or into the text being
 * edited); drag one onto the canvas to put it exactly there. Each shows the example it'll be
 * previewed with, so layout decisions are made on realistic text.
 */
@Component({
  selector: 'app-editor-variables',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip" [class.wrap]="wrap()" role="toolbar" aria-label="Fields">
      @for (group of groups(); track group.name) {
        <span class="group">{{ group.name }}</span>
        @for (c of group.chips; track c.path) {
          <button type="button" class="chip" [attr.data-kind]="c.kind" draggable="true"
            [title]="c.sample ? c.label + ' — e.g. ' + c.sample : c.label"
            (dragstart)="onDragStart($event, c)" (mousedown)="$event.preventDefault()" (click)="add(c)">
            <span class="dot" aria-hidden="true"></span>{{ c.label }}
          </button>
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .strip { display: flex; align-items: center; gap: 6px; padding: 6px 10px; overflow-x: auto; scrollbar-width: thin; }
    .group { flex: none; margin-left: 8px; font: 600 10.5px var(--ui-font-default); letter-spacing: .06em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .group:first-child { margin-left: 0; }
    .strip.wrap { flex-wrap: wrap; overflow: visible; padding: 8px 14px 16px; gap: 8px; }
    .strip.wrap .group { flex-basis: 100%; margin: 8px 0 0; }
    .strip.wrap .chip { height: 36px; padding: 0 14px; font-size: 14px; }
    .chip { flex: none; display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px; border-radius: var(--ui-radius-pill);
      border: 1px solid var(--ui-color-border); background: var(--ui-color-surface); color: var(--ui-color-text); font-size: 12.5px; cursor: grab; }
    .chip:hover { border-color: var(--ui-color-primary); }
    .chip:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--ui-color-primary); }
    .chip[data-kind="link"] .dot { background: var(--ui-color-accent); border-radius: 2px; }
    .chip[data-kind="image"] .dot { background: var(--ui-color-success); border-radius: 2px; }
  `,
})
export class EditorVariablesComponent {
  private readonly store = inject(DesignStore);

  /** Chips wrap onto rows instead of scrolling sideways — for a phone panel. */
  wrap = input(false);
  /** A chip put a new element on the page (not into text being edited). */
  readonly added = output<void>();

  protected readonly groups = computed(() => {
    const catalog = this.store.catalog();
    const scene = this.store.scene();
    if (!catalog || !scene) return [];
    const chips: (Chip & { group: string })[] = catalog.variables
      .map((v) => ({ path: v.path, label: v.label, kind: v.kind, sample: v.sample, type: v.type, group: v.group }));
    for (const f of scene.fields)
      chips.push({ path: f.path, label: f.label, kind: f.type === 'url' ? 'link' : 'text', sample: f.sample ?? '', type: f.type, group: 'Custom' });
    const order = ['Guest', 'Event', 'Venue', 'Inviter', 'Platform', 'Images', 'Custom'];
    return order
      .map((name) => ({ name, chips: chips.filter((c) => c.group === name) }))
      .filter((g) => g.chips.length > 0);
  });

  constructor() {
    // The canvas raises this when a chip is dropped on it, with the page position it landed at.
    const onDrop = (e: Event) => {
      const { path, at } = (e as CustomEvent<{ path: string; at: { x: number; y: number } }>).detail;
      const chip = this.groups().flatMap((g) => g.chips).find((c) => c.path === path);
      if (chip) this.add(chip, at);
    };
    window.addEventListener('ib-designer:add-variable', onDrop);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('ib-designer:add-variable', onDrop));
  }

  protected onDragStart(e: DragEvent, chip: Chip): void {
    e.dataTransfer?.setData('application/x-ib-variable', chip.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
  }

  /** Into the text being edited when there is one; otherwise a new element of the right kind. */
  protected add(chip: Chip, at?: { x: number; y: number }): void {
    const editing = document.activeElement?.closest('ui-token-input');
    if (editing && chip.kind === 'text') {
      this.store.tokenRequest.set({ path: chip.path, seq: (this.store.tokenRequest()?.seq ?? 0) + 1 });
      return;
    }
    const scene = this.store.scene();
    if (!scene) return;
    const centerY = at?.y ?? this.store.playhead() + 422;

    let el;
    if (chip.path === 'rsvp.link') {
      el = createElement(scene, 'rsvp', centerY);
    } else if (chip.kind === 'link') {
      el = createElement(scene, 'link', centerY);
      el = { ...el, name: chip.label, button: { ...el.button!, path: chip.path, label: chip.path === 'camera.link' ? 'Share your photos' : chip.path === 'photos.link' ? 'See the photos' : chip.label } };
    } else if (chip.kind === 'image') {
      el = createElement(scene, 'slot', centerY);
      const gallery = chip.path === 'event.gallery';
      el = { ...el, name: chip.label, slot: { ...el.slot!, path: chip.path, label: chip.label, multiple: gallery }, ...(gallery ? { h: 320 } : {}) };
    } else {
      el = createElement(scene, 'text', centerY);
      const size = chip.type === 'textarea' ? 16 : chip.path === 'event.title' ? 40 : 20;
      el = {
        ...el,
        name: chip.label,
        h: chip.type === 'textarea' ? 110 : chip.path === 'event.title' ? 90 : 48,
        text: {
          runs: [{ var: chip.path }],
          style: { ...el.text!.style, size, ...(chip.path === 'event.title' ? { font: scene.theme.some((t) => t.key === 'heading-font') ? 'theme:heading-font' : el.text!.style.font } : {}) },
        },
      };
    }
    if (at) el = { ...el, x: Math.round(at.x - el.w / 2), y: Math.round(at.y - el.h / 2) };
    this.store.commit(insertElement(scene, el));
    this.store.select(el.id);
    this.added.emit();
  }
}
