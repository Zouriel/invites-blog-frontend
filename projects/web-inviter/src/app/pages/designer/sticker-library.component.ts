import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { UiChoiceGrid, type UiChoice } from '@zouriel/ui/form';
import { DesignStore } from './design.store';
import type { DesignElement, DesignScene } from './model/scene';
import { resolveColor, stateAt } from './model/scene-ops';
import { STICKERS, buildSticker } from './model/stickers';

interface Mark { kind: 'rect' | 'ellipse' | 'path'; x: number; y: number; w: number; h: number; rotate: number; fill: string; stroke: string; d?: string; vb?: string; opacity: number }

/**
 * Animated sticker groups — petals, confetti, sparkles, balloons, fairy lights, doors — dropped onto the
 * screen at the playhead, in the design's own colours. Each tile is a still of that sticker, drawn from
 * the same recipe it will be built from.
 */
@Component({
  selector: 'app-sticker-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiChoiceGrid],
  template: `
    <p class="lead">Moving decorations, made of ordinary shapes in your colours. Drop one in, then ungroup it to change anything — or Shuffle for a new layout.</p>
    <ui-choice-grid label="Stickers" [options]="choices()" [value]="null" minTile="110px" (picked)="add($event.value)">
      <ng-template #tile let-item>
        <svg class="art" [attr.viewBox]="previews().get(item.value)?.box" preserveAspectRatio="xMidYMid meet" aria-hidden="true" [style.background]="bg()">
          @for (m of previews().get(item.value)?.marks ?? []; track $index) {
            <g [attr.transform]="'rotate(' + m.rotate + ' ' + (m.x + m.w / 2) + ' ' + (m.y + m.h / 2) + ')'" [attr.opacity]="m.opacity">
              @switch (m.kind) {
                @case ('ellipse') { <ellipse [attr.cx]="m.x + m.w / 2" [attr.cy]="m.y + m.h / 2" [attr.rx]="m.w / 2" [attr.ry]="m.h / 2" [attr.fill]="m.fill" [attr.stroke]="m.stroke" stroke-width="2" /> }
                @case ('path') {
                  <svg [attr.x]="m.x" [attr.y]="m.y" [attr.width]="m.w" [attr.height]="m.h" [attr.viewBox]="m.vb" preserveAspectRatio="none" overflow="visible">
                    <path [attr.d]="m.d" [attr.fill]="m.fill" [attr.stroke]="m.stroke" stroke-width="2" vector-effect="non-scaling-stroke" />
                  </svg>
                }
                @default { <rect [attr.x]="m.x" [attr.y]="m.y" [attr.width]="m.w" [attr.height]="m.h" [attr.fill]="m.fill" [attr.stroke]="m.stroke" stroke-width="2" /> }
              }
            </g>
          }
        </svg>
      </ng-template>
    </ui-choice-grid>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .lead { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .art { width: 100%; height: 100%; display: block; }
  `,
})
export class StickerLibraryComponent {
  private readonly store = inject(DesignStore);
  /** A sticker was placed (the phone layout closes its panel on this). */
  readonly added = output<void>();

  protected readonly choices = computed<UiChoice[]>(() => STICKERS.map((s) => ({ value: s.id, label: s.label, description: s.description })));

  protected readonly bg = computed(() => {
    const scene = this.store.scene();
    return scene ? resolveColor(scene, 'theme:bg', '#ffffff') : '#ffffff';
  });

  /** Each sticker built once from a fixed seed, flattened to marks for its still. */
  protected readonly previews = computed(() => {
    const scene = this.store.scene();
    const out = new Map<string, { box: string; marks: Mark[] }>();
    if (!scene) return out;
    for (const recipe of STICKERS) {
      const group = buildSticker(scene, recipe.id, 7, 0);
      // Drawn partway through its motion, where it shows what it does: petals mid-fall, confetti burst.
      if (!group) continue;
      const list = marks({ ...scene, elements: [group] }, group.children ?? [], 0, 0);
      // Framed on what it covers (with a margin), so a row of lights at the top isn't cropped away.
      const x0 = Math.max(0, Math.min(...list.map((m) => m.x)) - 20);
      const y0 = Math.max(-100, Math.min(...list.map((m) => m.y)) - 20);
      const x1 = Math.min(390, Math.max(...list.map((m) => m.x + m.w)) + 20);
      const y1 = Math.min(944, Math.max(...list.map((m) => m.y + m.h)) + 20);
      out.set(recipe.id, { box: list.length ? `${x0} ${y0} ${Math.max(40, x1 - x0)} ${Math.max(40, y1 - y0)}` : '0 0 390 844', marks: list });
    }
    return out;
  });

  protected add(id: string): void {
    if (this.store.addSticker(id)) this.added.emit();
  }
}

function marks(scene: DesignScene, els: DesignElement[], ox: number, oy: number): Mark[] {
  const out: Mark[] = [];
  for (const el of els) {
    const now = el.track ? stateAt(scene, el, el.track.start + (el.track.end - el.track.start) * 0.35) : el;
    if (el.type === 'group') {
      out.push(...marks(scene, el.children ?? [], ox + now.x, oy + now.y));
      continue;
    }
    if (el.type !== 'shape' || !el.shape) continue;
    const fill = resolveColor(scene, el.shape.fill, 'none');
    const stroke = el.shape.strokeWidth > 0 ? resolveColor(scene, el.shape.stroke, 'none') : 'none';
    const base = { x: ox + now.x, y: oy + now.y, w: el.w * now.scale, h: el.h * now.scale, rotate: now.rotate, fill, stroke, opacity: Math.max(0.35, now.opacity) };
    if (el.shape.kind === 'path' && el.shape.path) {
      const p = el.shape.path;
      out.push({ ...base, kind: 'path', vb: `0 0 ${p.width} ${p.height}`, d: pathData(p) });
    } else out.push({ ...base, kind: el.shape.kind === 'ellipse' ? 'ellipse' : 'rect' });
  }
  return out;
}

function pathData(p: NonNullable<NonNullable<DesignElement['shape']>['path']>): string {
  let d = '';
  for (const c of p.contours) {
    if (c.points.length < 2) continue;
    d += `M${c.points[0].x} ${c.points[0].y}`;
    const n = c.closed ? c.points.length : c.points.length - 1;
    for (let i = 0; i < n; i++) {
      const a = c.points[i];
      const b = c.points[(i + 1) % c.points.length];
      const c1 = a.out ?? a;
      const c2 = b.in ?? b;
      d += `C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${b.x} ${b.y}`;
    }
    if (c.closed) d += 'Z';
  }
  return d;
}
