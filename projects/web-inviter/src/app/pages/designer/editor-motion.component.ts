import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton, UiSegmented } from '@zouriel/ui/button';
import { UiAnchorPicker, UiChoiceGrid, UiNumberInput, UiSelect, UiSlider, UiSwitch, type UiChoice, type UiSelectOption } from '@zouriel/ui/form';
import { UiPanelSection } from '@zouriel/ui/layout';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiTooltip } from '@zouriel/ui/overlay';
import { DesignStore } from './design.store';
import { MotionThumbComponent } from './motion-thumb.component';
import type { DesignElement, LoopPreset, MotionPreset } from './model/scene';
import { effectAt, flatten, labelOf, type EffectProp } from './model/scene-ops';
import { REFERENCE_VIEWPORT } from './model/scene';
import { asPreview, movesFor, PACES, type Pace } from './model/effect-moves';

const GROUPS: Record<string, string> = { basic: 'Simple', bounce: 'Bounce', zoom: 'Zoom', turn: 'Turn and flip', reveal: 'Reveal', text: 'Text' };

/**
 * The Motion part of the inspector beyond the keyframe list: preset pickers with moving previews
 * (in, out, and loops that play on top), the pivot, the effects a keyframe can carry (3D, skew, blur,
 * clip, draw-on, letter spacing), text split into pieces, tap to scroll, and following a path.
 *
 * <p>Everything here writes ordinary scene data — keyframes, a loop, a pivot — so what it makes can be
 * edited by hand afterwards like anything else.</p>
 */
@Component({
  selector: 'app-editor-motion',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiButton, UiSegmented, UiAnchorPicker, UiChoiceGrid, UiNumberInput, UiSelect, UiSlider, UiSwitch, UiPanelSection,
    UiTab, UiTabs, UiTooltip, MotionThumbComponent,
  ],
  template: `
    @if (el(); as el) {
      <ui-tabs label="Motion presets" [selectedIndex]="tab()" (selectedIndexChange)="tab.set($event)">
        <ui-tab [label]="'In' + (el.enter ? ' · ' + presetLabel('enter', el.enter) : '')">
          <ui-choice-grid label="Comes in" [options]="enterChoices()" [value]="el.enter ?? ''" minTile="76px"
            (picked)="store.setPreset(el.id, 'enter', $event.value || null)">
            <ng-template #tile let-item let-selected="selected">
              <app-motion-thumb [preset]="enterById().get(item.value) ?? null" slot="enter" [active]="selected" />
            </ng-template>
          </ui-choice-grid>
        </ui-tab>
        <ui-tab [label]="'Out' + (el.exit ? ' · ' + presetLabel('exit', el.exit) : '')">
          <ui-choice-grid label="Goes out" [options]="exitChoices()" [value]="el.exit ?? ''" minTile="76px"
            (picked)="store.setPreset(el.id, 'exit', $event.value || null)">
            <ng-template #tile let-item let-selected="selected">
              <app-motion-thumb [preset]="exitById().get(item.value) ?? null" slot="exit" [active]="selected" />
            </ng-template>
          </ui-choice-grid>
        </ui-tab>
        <ui-tab [label]="'Loop' + (el.loop?.preset ? ' · ' + loopLabel(el.loop!.preset!) : '')">
          <p class="hint">Plays over and over while it's on screen, on top of how it comes in and goes out.</p>
          <ui-choice-grid label="Loop" [options]="loopChoices()" [value]="el.loop?.preset ?? ''" minTile="76px"
            (picked)="store.setLoop(el.id, $event.value || null)">
            <ng-template #tile let-item let-selected="selected">
              <app-motion-thumb [preset]="loopById().get(item.value) ?? null" slot="loop" [active]="selected" />
            </ng-template>
          </ui-choice-grid>
          @if (el.loop; as loop) {
            <div class="grid2">
              <ui-number-input size="sm" label="Times" [min]="1" [max]="50" [ngModel]="loop.repeat" (ngModelChange)="store.tuneLoop(el.id, { repeat: $event ?? 1 })" ariaLabel="Times it plays over the track" />
              <label class="switch"><ui-switch [ngModel]="!!loop.alternate" (ngModelChange)="store.tuneLoop(el.id, { alternate: $event })" /> There and back</label>
            </div>
            @if (loop.preset) {
              <div class="stack"><span class="label">Strength</span>
                <ui-slider [min]="0.25" [max]="2" [step]="0.25" label="Strength" [ngModel]="loop.strength ?? 1" (ngModelChange)="store.tuneLoop(el.id, { strength: $event })" />
              </div>
            }
            <p class="hint">Stretch its bar on the timeline to slow every cycle down.</p>
          }
        </ui-tab>
      </ui-tabs>

      <div class="row">
        <div class="stack"><span class="label">Turns about</span>
          <ui-anchor-picker label="Pivot point" [ngModel]="el.origin ?? { x: 0.5, y: 0.5 }" (ngModelChange)="store.setOrigin(el.id, $event)" />
        </div>
        <p class="hint">The point it rotates, flips and scales around — the top for anything that hangs or swings.</p>
      </div>

      <ui-panel-section title="Effects" [open]="true">
        <p class="hint">Tap one to add it. It plays from the playhead as the guest scrolls — watch it by scrolling the preview.</p>
        <div class="stack"><span class="label">How long it takes</span>
          <ui-segmented size="sm" label="How long it takes" [options]="paceOptions" [value]="pace()" (valueChange)="pace.set($any($event))" />
        </div>
        <ui-choice-grid label="Effects" [options]="moveChoices()" [value]="''" minTile="76px" (picked)="addMove($event.value)">
          <ng-template #tile let-item let-selected="selected">
            <app-motion-thumb [preset]="movePreviews().get(item.value) ?? null" slot="move" [active]="false" />
          </ng-template>
        </ui-choice-grid>
      </ui-panel-section>

      <ui-panel-section title="Fine-tune (exact values)" [open]="false">
        <p class="hint">For exact numbers: these edit the keyframe at the playhead ({{ progress() }}% of its track), or add one.</p>
        <div class="grid2">
          <ui-number-input size="sm" label="Tip over" suffix="°" [steppers]="false" [min]="-360" [max]="360" [ngModel]="value('rotateX')" (ngModelChange)="set('rotateX', $event)" ariaLabel="Turn about the horizontal axis" />
          <ui-number-input size="sm" label="Turn over" suffix="°" [steppers]="false" [min]="-360" [max]="360" [ngModel]="value('rotateY')" (ngModelChange)="set('rotateY', $event)" ariaLabel="Turn about the vertical axis" />
          <ui-number-input size="sm" label="Slant" suffix="°" [steppers]="false" [min]="-80" [max]="80" [ngModel]="value('skewX')" (ngModelChange)="set('skewX', $event)" ariaLabel="Horizontal skew" />
          <ui-number-input size="sm" label="Slant up" suffix="°" [steppers]="false" [min]="-80" [max]="80" [ngModel]="value('skewY')" (ngModelChange)="set('skewY', $event)" ariaLabel="Vertical skew" />
          <ui-number-input size="sm" label="Blur" [steppers]="false" [min]="0" [max]="40" [ngModel]="value('blur')" (ngModelChange)="set('blur', $event)" ariaLabel="Blur" />
          @if (el.type === 'shape') {
            <ui-number-input size="sm" label="Drawn" suffix="%" [steppers]="false" [min]="0" [max]="100" [ngModel]="round(value('draw') * 100)" (ngModelChange)="set('draw', $event === null ? null : $event / 100)" ariaLabel="How much of the outline is drawn" />
          }
          @if (el.type === 'text') {
            <ui-number-input size="sm" label="Spacing +" suffix="em" [steppers]="false" [min]="-0.2" [max]="2" [step]="0.01" [precision]="2" [ngModel]="value('tracking')" (ngModelChange)="set('tracking', $event)" ariaLabel="Extra letter spacing" />
          }
        </div>
        @if ((value('rotateX') || value('rotateY')) || el.backfaceHidden) {
          <label class="switch" uiTooltip="For cards that flip over: the back doesn't show">
            <ui-switch [ngModel]="!!el.backfaceHidden" (ngModelChange)="store.update(el.id, patchBackface($event))" /> Hide the back when turned away
          </label>
        }
        <div class="stack"><span class="label">Cut to</span>
          <ui-segmented size="sm" label="Clip shape" [options]="clipOptions" [value]="el.clipShape ?? ''" (valueChange)="store.setClipShape(el.id, $any($event) || null)" />
        </div>
        @if (el.clipShape === 'inset') {
          <div class="grid2">
            @for (side of insetSides; track side.i) {
              <ui-number-input size="sm" [label]="side.label" suffix="%" [steppers]="false" [min]="0" [max]="100" [ngModel]="clipAt()[side.i] ?? 0" (ngModelChange)="setClip(side.i, $event)" [ariaLabel]="'Cut from the ' + side.label.toLowerCase()" />
            }
          </div>
        } @else if (el.clipShape === 'circle') {
          <ui-number-input size="sm" label="Radius" suffix="%" [steppers]="false" [min]="0" [max]="150" [ngModel]="clipAt()[0] ?? 71" (ngModelChange)="setClip(0, $event)" ariaLabel="Circle radius" />
        }
      </ui-panel-section>

      @if (el.type === 'text') {
        <ui-panel-section title="Word by word" [open]="!!el.text?.split">
          <ui-segmented size="sm" label="Animate the text" [options]="splitOptions" [value]="el.text?.split?.by ?? ''"
            (valueChange)="store.setSplit(el.id, $event ? { by: $any($event), stagger: el.text?.split?.stagger ?? 0.4 } : null)" />
          @if (el.text?.split; as split) {
            <div class="stack"><span class="label">Spread</span>
              <ui-slider [min]="0" [max]="0.9" [step]="0.05" label="How spread out the pieces start" [ngModel]="split.stagger" (ngModelChange)="store.setSplit(el.id, { by: split.by, stagger: $event })" />
            </div>
            <p class="hint">Each {{ split.by }} plays its keyframes in turn. Fields like the guest's name move as one piece.</p>
            @if (!el.keyframes.length) { <p class="hint warn">Give it a way in (the In tab) — split text only shows when it moves.</p> }
          }
        </ui-panel-section>
      }

      <ui-panel-section title="Across its bar" [open]="false">
        <p class="hint">Motion over the whole time it's on screen.</p>
        <div class="bar-actions">
          <ui-button size="sm" variant="outline" (click)="store.acrossBar(el.id, 'ken-burns')" uiTooltip="A slow push in, for photos">Slow zoom</ui-button>
          <ui-button size="sm" variant="outline" (click)="store.acrossBar(el.id, 'slower')" uiTooltip="Scrolls by slower than the page — feels further away">Far layer</ui-button>
          <ui-button size="sm" variant="outline" (click)="store.acrossBar(el.id, 'faster')" uiTooltip="Scrolls by faster than the page — feels closer">Near layer</ui-button>
          <ui-button size="sm" variant="ghost" (click)="store.acrossBar(el.id, 'none')">Clear</ui-button>
        </div>
      </ui-panel-section>

      <ui-panel-section title="Tap to scroll" [open]="el.tapScroll != null">
        <label class="switch"><ui-switch [ngModel]="el.tapScroll != null" (ngModelChange)="store.setTapScroll(el.id, $event ? tapTarget('next') : null)" /> Tapping it scrolls the page</label>
        @if (el.tapScroll != null) {
          <div class="stack"><span class="label">Takes the guest</span>
            <ui-segmented size="sm" label="Where tapping takes the guest" [options]="tapOptions" [value]="tapKind(el.tapScroll)" (valueChange)="store.setTapScroll(el.id, tapTarget($any($event)))" />
          </div>
          <p class="hint">For "tap the seal to open": the guest can tap instead of scrolling, and it plays the same way. "Here" is where the playhead is now.</p>
          <ui-panel-section title="Exact position" [open]="false">
            <ui-number-input size="sm" label="Scrolls to" [steppers]="false" [min]="0" [max]="store.range()" [ngModel]="el.tapScroll" (ngModelChange)="store.setTapScroll(el.id, $event)" ariaLabel="Scroll position it goes to" />
          </ui-panel-section>
        }
      </ui-panel-section>

      <ui-panel-section title="Follow a path" [open]="false">
        @if (pathOptions().length) {
          <ui-select size="sm" label="Path to follow" [options]="pathOptions()" [ngModel]="pathId()" (ngModelChange)="pathId.set($event)" />
          <label class="switch"><ui-switch [ngModel]="turn()" (ngModelChange)="turn.set($event)" /> Face the way it's going</label>
          <ui-button size="sm" variant="outline" [disabled]="!pathId()" (click)="store.followPath(el.id, pathId()!, turn())">Follow it</ui-button>
          <p class="hint">Draw a line or shape to be the path. Its keyframes will trace it over its track.</p>
        } @else {
          <p class="hint">Draw a shape or a line first — then this element can travel along it.</p>
        }
      </ui-panel-section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; }
    .row { display: flex; gap: 12px; align-items: flex-start; }
    .stack { display: flex; flex-direction: column; gap: 4px; }
    .label { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .hint { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .hint.warn { color: var(--ui-color-warning); }
    .switch { display: flex; align-items: center; gap: 8px; font-size: var(--ui-font-size-sm); }
    .bar-actions { display: flex; flex-wrap: wrap; gap: 6px; }
  `,
})
export class EditorMotionComponent {
  protected readonly store = inject(DesignStore);
  el = input<DesignElement | null>(null);

  protected readonly tab = signal(0);
  protected readonly pathId = signal<string | null>(null);
  protected readonly turn = signal(false);
  protected readonly round = Math.round;

  protected readonly clipOptions = [{ value: '', label: 'None' }, { value: 'inset', label: 'Box' }, { value: 'circle', label: 'Circle' }];
  protected readonly splitOptions = [{ value: '', label: 'Whole' }, { value: 'word', label: 'Words' }, { value: 'letter', label: 'Letters' }];
  protected readonly paceOptions = PACES.map((p) => ({ value: p.value, label: p.label }));
  protected readonly pace = signal<Pace>('steady');
  protected readonly tapOptions = [{ value: 'next', label: 'One screen on' }, { value: 'end', label: 'The end' }, { value: 'here', label: 'Here' }];

  private readonly moves = computed(() => movesFor(this.el()));
  protected readonly moveById = computed(() => new Map(this.moves().map((m) => [m.id, m])));
  protected readonly movePreviews = computed(() => new Map(this.moves().map((m) => [m.id, asPreview(m)])));
  protected readonly moveChoices = computed<UiChoice[]>(() => this.moves().map((m) => ({ value: m.id, label: m.label, group: m.group })));

  protected addMove(id: string): void {
    const el = this.el();
    const move = this.moveById().get(id);
    if (el && move) this.store.applyMove(el.id, move, this.pace());
  }

  /** Where "one screen on", "the end" and "here" take the guest. */
  protected tapTarget(kind: 'next' | 'end' | 'here'): number {
    const end = this.store.pageRange();
    const here = Math.round(this.store.playhead());
    if (kind === 'end') return end;
    if (kind === 'here') return here;
    return Math.min(end, here + REFERENCE_VIEWPORT);
  }

  protected tapKind(target: number): string {
    if (target >= this.store.pageRange()) return 'end';
    if (target === Math.round(this.store.playhead())) return 'here';
    if (target === this.tapTarget('next')) return 'next';
    return '';
  }

  protected readonly insetSides = [{ i: 0, label: 'Top' }, { i: 1, label: 'Right' }, { i: 2, label: 'Bottom' }, { i: 3, label: 'Left' }];

  protected readonly enterById = computed(() => new Map((this.store.catalog()?.enterPresets ?? []).map((p) => [p.id, p])));
  protected readonly exitById = computed(() => new Map((this.store.catalog()?.exitPresets ?? []).map((p) => [p.id, p])));
  protected readonly loopById = computed(() => new Map((this.store.catalog()?.loopPresets ?? []).map((p) => [p.id, p])));

  private choices(list: MotionPreset[]): UiChoice[] {
    const type = this.el()?.type;
    return [
      { value: '', label: 'None', group: GROUPS['basic'] },
      ...list
        .filter((p) => !p.only || p.only === type)
        .map((p) => ({ value: p.id, label: p.label, group: GROUPS[p.group ?? 'basic'] ?? 'More' })),
    ];
  }

  protected readonly enterChoices = computed(() => this.choices(this.store.catalog()?.enterPresets ?? []));
  protected readonly exitChoices = computed(() => this.choices(this.store.catalog()?.exitPresets ?? []));
  protected readonly loopChoices = computed<UiChoice[]>(() => [
    { value: '', label: 'None' },
    ...(this.store.catalog()?.loopPresets ?? []).map((p: LoopPreset) => ({ value: p.id, label: p.label, description: p.use ?? undefined })),
  ]);

  protected presetLabel(slot: 'enter' | 'exit', id: string): string {
    return (slot === 'enter' ? this.enterById() : this.exitById()).get(id)?.label ?? id;
  }

  protected loopLabel(id: string): string {
    return this.loopById().get(id)?.label ?? id;
  }

  protected readonly progress = computed(() => {
    const scene = this.store.scene();
    const el = this.el();
    if (!scene || !el) return 0;
    const t = el.track ?? null;
    if (!t) return 0;
    return Math.round(Math.min(1, Math.max(0, (this.store.playhead() - t.start) / Math.max(1, t.end - t.start))) * 100);
  });

  protected value(prop: EffectProp): number {
    const scene = this.store.scene();
    const el = this.el();
    return scene && el ? Math.round(effectAt(scene, el, prop, this.store.playhead()) * 100) / 100 : prop === 'draw' ? 1 : 0;
  }

  protected set(prop: EffectProp, value: number | null): void {
    const el = this.el();
    if (el) this.store.setEffect(el.id, prop, value ?? (prop === 'draw' ? 1 : 0));
  }

  /** The clip values in force at the playhead: the last keyframe at or before it that sets any. */
  protected readonly clipAt = computed(() => {
    const scene = this.store.scene();
    const el = this.el();
    if (!scene || !el?.clipShape) return [];
    const full = el.clipShape === 'circle' ? [71] : [0, 0, 0, 0];
    const t = this.progress() / 100;
    const set = el.keyframes.filter((k) => k.clip?.length && k.t <= t + 1e-4).sort((a, b) => a.t - b.t);
    return set.length ? set[set.length - 1].clip! : full;
  });

  protected setClip(index: number, value: number | null): void {
    const el = this.el();
    if (!el?.clipShape) return;
    const next = [...this.clipAt()];
    while (next.length < (el.clipShape === 'circle' ? 1 : 4)) next.push(0);
    next[index] = Math.max(0, value ?? 0);
    this.store.setEffect(el.id, 'clip', next);
  }

  protected patchBackface(hidden: boolean): (el: DesignElement) => DesignElement {
    return (el) => ({ ...el, backfaceHidden: hidden });
  }

  /** Shapes this element can follow: anything with an outline except itself. */
  protected readonly pathOptions = computed<UiSelectOption[]>(() => {
    const scene = this.store.scene();
    const self = this.el();
    if (!scene || !self) return [];
    return flatten(scene)
      .map((f) => f.element)
      .filter((e) => e.type === 'shape' && e.id !== self.id)
      .map((e) => ({ value: e.id, label: labelOf(e) }));
  });
}
