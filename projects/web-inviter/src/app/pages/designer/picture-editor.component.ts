import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton, UiIconButton, UiSegmented } from '@zouriel/ui/button';
import { UiImageEditor } from '@zouriel/ui/canvas';
import { UiModal } from '@zouriel/ui/dialog';
import { UiAlert } from '@zouriel/ui/alert';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UiFormField, UiSlider } from '@zouriel/ui/form';
import { DesignStore } from './design.store';
import { ICONS } from './designer-icons';
import { findElement } from './model/scene-ops';

type Mode = 'crop' | 'erase' | 'restore';

const ASPECTS = [
  { value: 'free', label: 'Free' }, { value: 'original', label: 'Original' }, { value: '1', label: 'Square' },
  { value: '0.8', label: '4:5' }, { value: '0.75', label: '3:4' }, { value: '1.7778', label: '16:9' },
];

/**
 * The picture editor: a window over the designer, as the shape editor is, for one picture element.
 * Crop it (free or to a shape), rub parts out with a soft or hard brush, and paint them back with
 * Restore. Pinch or Ctrl + scroll to zoom, two fingers or Space + drag to move around.
 *
 * <p>It works on a copy. Save uploads the result as a new file (so one Undo in the designer brings the
 * original back) and shrinks the element to a crop, keeping the part that's left where it was.</p>
 */
@Component({
  selector: 'app-picture-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, HugeiconsIconComponent, UiButton, UiIconButton, UiSegmented, UiImageEditor, UiModal, UiFormField, UiSlider, UiAlert, UiTooltip],
  template: `
    <ui-modal [open]="open()" (openChange)="!$event && cancel()" size="full" [closeOnBackdrop]="false">
      @if (src(); as source) {
        <div class="shell">
          <header class="bar">
            <ui-button size="sm" variant="ghost" (click)="cancel()">Cancel</ui-button>
            <div class="title">
              <strong>Edit picture</strong>
              <span class="hint">{{ hint() }}</span>
            </div>
            <ui-icon-button size="sm" label="Undo" [disabled]="!editor()?.canUndo()" (click)="editor()?.undo()"><hugeicons-icon [icon]="icons.undo" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-icon-button size="sm" label="Redo" [disabled]="!editor()?.canRedo()" (click)="editor()?.redo()"><hugeicons-icon [icon]="icons.redo" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
            <ui-button size="sm" variant="primary" [loading]="saving()" [disabled]="saving() || !editor()?.dirty()" (click)="save()">Save</ui-button>
          </header>

          <div class="work">
            <ui-image-editor #imageEditor class="surface" label="Picture" [src]="source" [(mode)]="mode" [(brushSize)]="brushSize"
              [(brushSoftness)]="softness" [straightLine]="straight()" [aspect]="aspectValue()" [(crop)]="crop" (loadError)="failed.set(true)" />
            @if (failed()) {
              <div class="failed"><ui-alert tone="warning" heading="This picture couldn't be opened for editing">Close and try again, or upload it again.</ui-alert></div>
            }
            <div class="zoom">
              <ui-icon-button size="sm" label="Zoom in" (click)="editor()?.zoomBy(1.4)"><hugeicons-icon [icon]="icons.zoomIn" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
              <ui-icon-button size="sm" label="Zoom out" (click)="editor()?.zoomBy(1 / 1.4)"><hugeicons-icon [icon]="icons.zoomOut" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
              <ui-icon-button size="sm" label="Fit" (click)="editor()?.fit()"><hugeicons-icon [icon]="icons.fit" [size]="18" [strokeWidth]="1.8" /></ui-icon-button>
            </div>
          </div>

          <footer class="dockbar">
            <div class="modes">
              <ui-segmented size="sm" label="Edit" [options]="modes" [value]="mode()" (valueChange)="$event && mode.set($any($event))" />
            </div>
            @if (mode() === 'crop') {
              <div class="row">
                <ui-form-field label="Shape"><ui-segmented size="sm" label="Crop shape" [options]="aspects" [value]="aspect()" (valueChange)="$event && aspect.set($event)" /></ui-form-field>
                <ui-button size="sm" variant="ghost" (click)="editor()?.resetCrop()">Reset crop</ui-button>
              </div>
            } @else {
              <div class="row sliders">
                <span class="nib" aria-hidden="true"><span class="dot" [class.restore]="mode() === 'restore'" [style.width.px]="nibPx()" [style.height.px]="nibPx()" [style.filter]="'blur(' + softness() * 3 + 'px)'"></span></span>
                <ui-form-field label="Brush size"><ui-slider [min]="4" [max]="300" [step]="1" label="Brush size" [ngModel]="brushSize()" (ngModelChange)="brushSize.set($event)" /></ui-form-field>
                <ui-form-field label="Softness"><ui-slider [min]="0" [max]="100" [step]="1" label="Softness" [ngModel]="round(softness() * 100)" (ngModelChange)="softness.set($event / 100)" /></ui-form-field>
              </div>
            }
            <div class="row end">
              @if (mode() !== 'crop') {
                <ui-button size="sm" [variant]="straight() ? 'secondary' : 'ghost'" [attr.aria-pressed]="straight()" (click)="straight.set(!straight())"
                  uiTooltip="Each tap joins the last point with a straight line (Shift-click does the same)">Straight line</ui-button>
              }
              <ui-button size="sm" variant="ghost" [disabled]="!editor()?.dirty()" (click)="editor()?.reset()">Start again</ui-button>
            </div>
          </footer>
        </div>
      }
    </ui-modal>
  `,
  styles: `
    .shell { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; grid-template-columns: minmax(0, 1fr); width: 100%; height: 100%;
      min-height: 0; min-width: 0; overflow: hidden; background: var(--ui-color-surface); }
    .bar, .dockbar { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
    .bar { display: flex; align-items: center; gap: 6px; min-width: 0; padding: 8px 10px; padding-top: calc(8px + env(safe-area-inset-top, 0px));
      border-bottom: 1px solid var(--ui-color-border); touch-action: manipulation; }
    .title { flex: 1; min-width: 0; display: grid; text-align: center; line-height: 1.25; }
    .title strong { font-size: 15px; }
    .hint { font-size: 12px; color: var(--ui-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .work { position: relative; min-height: 0; }
    .surface { position: absolute; inset: 0; }
    .failed { position: absolute; left: 16px; right: 16px; top: 16px; max-width: 480px; margin: 0 auto; }
    .zoom { position: absolute; right: 10px; top: 10px; display: grid; gap: 4px; padding: 4px; border-radius: var(--ui-radius);
      background: var(--ui-color-surface); box-shadow: var(--ui-shadow-2); }
    .dockbar { display: grid; gap: 6px; min-width: 0; padding: 8px 12px; padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
      border-top: 1px solid var(--ui-color-border); background: var(--ui-color-surface); }
    .modes { display: flex; justify-content: center; touch-action: manipulation; }
    .row { display: flex; flex-wrap: wrap; align-items: end; justify-content: center; gap: 8px 16px; max-width: 640px; width: 100%; margin: 0 auto; }
    .row.end { justify-content: flex-end; }
    .sliders ui-form-field { flex: 1 1 160px; min-width: 0; }
    .nib { flex: none; display: grid; place-items: center; width: 32px; height: 32px; align-self: center; }
    .dot { display: block; min-width: 3px; min-height: 3px; max-width: 30px; max-height: 30px; border-radius: 50%;
      border: 1.5px dashed var(--ui-color-danger); }
    .dot.restore { border-color: var(--ui-color-primary); border-style: solid; }
  `,
})
export class PictureEditorComponent {
  protected readonly icons = ICONS;
  protected readonly store = inject(DesignStore);
  protected readonly editor = viewChild<UiImageEditor>('imageEditor');

  protected readonly modes = [{ value: 'crop', label: 'Crop' }, { value: 'erase', label: 'Erase' }, { value: 'restore', label: 'Restore' }];
  protected readonly aspects = ASPECTS;

  protected readonly element = computed(() => {
    const id = this.store.pictureEditorId();
    const scene = this.store.scene();
    return id && scene ? findElement(scene, id) : null;
  });
  protected readonly open = computed(() => !!this.element());
  /** The picture as it was when the editor opened (a later change to the design doesn't swap it under the brush). */
  protected readonly src = signal<string | null>(null);

  protected readonly mode = signal<Mode>('erase');
  protected readonly brushSize = signal(40);
  protected readonly softness = signal(0.3);
  protected readonly aspect = signal('free');
  protected readonly crop = signal<{ x: number; y: number; width: number; height: number } | null>(null);
  protected readonly saving = signal(false);
  protected readonly failed = signal(false);
  /** Every tap joins the last point with a straight stroke, as Shift-click does (for phones, which have no Shift). */
  protected readonly straight = signal(false);
  private sized = false;

  protected readonly aspectValue = computed(() => {
    const a = this.aspect();
    if (a === 'free') return null;
    if (a === 'original') {
      const e = this.editor();
      return e && e.naturalHeight() ? e.naturalWidth() / e.naturalHeight() : null;
    }
    return +a;
  });

  protected readonly nibPx = computed(() => Math.max(4, Math.min(30, this.brushSize() / 6)));

  protected readonly hint = computed(() => this.mode() === 'crop'
    ? 'Drag the corners to crop · drag inside to move it'
    : this.mode() === 'erase' ? 'Rub out what you don\u2019t want · Shift-click for a straight line · pinch to zoom' : 'Paint the picture back where you rubbed too much · Shift-click for a straight line');

  constructor() {
    // A new picture opens fresh: its own file, erasing first, the whole picture.
    effect(() => {
      const el = this.element();
      untracked(() => {
        if (!el?.image) {
          this.src.set(null);
          return;
        }
        const scene = this.store.scene();
        this.src.set(scene?.assets[el.image.asset]?.data ?? null);
        this.mode.set('erase');
        this.aspect.set('free');
        this.crop.set(null);
        this.failed.set(false);
        this.sized = false;
      });
    });
    // Once the picture is in, a brush that suits it: about a 25th of its short side.
    effect(() => {
      const ed = this.editor();
      if (!ed?.loaded() || this.sized) return;
      this.sized = true;
      const short = Math.min(ed.naturalWidth(), ed.naturalHeight());
      untracked(() => this.brushSize.set(Math.max(8, Math.min(300, Math.round(short / 25)))));
    });
  }

  protected round(n: number): number {
    return Math.round(n);
  }

  protected cancel(): void {
    if (this.saving()) return;
    this.store.pictureEditorId.set(null);
  }

  protected async save(): Promise<void> {
    const ed = this.editor();
    const el = this.element();
    if (!ed || !el || this.saving()) return;
    this.saving.set(true);
    try {
      const blob = await ed.toBlob('image/png');
      const natural = { width: ed.naturalWidth(), height: ed.naturalHeight() };
      const c = this.crop();
      const cropped = c && (c.x > 0.5 || c.y > 0.5 || Math.abs(c.width - natural.width) > 0.5 || Math.abs(c.height - natural.height) > 0.5) ? c : null;
      if (await this.store.applyPictureEdit(el.id, blob, cropped, natural)) this.store.pictureEditorId.set(null);
    } finally {
      this.saving.set(false);
    }
  }
}
