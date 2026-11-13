import { ChangeDetectionStrategy, Component, inject, input, OnDestroy, output, signal, viewChild } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiImageEditor, type UiImageCrop } from '@zouriel/ui/canvas';
import { UiModal } from '@zouriel/ui/dialog';
import { UiFileUpload } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { APP_ICONS } from '../icons/app-icons';
import { Portfolio } from './portfolio.types';

/** Wide, like the top of the page on a laptop; a phone shows the middle of it. */
export const PORTFOLIO_COVER_ASPECT = 16 / 9;

/**
 * The page's big cover picture, uploaded on its own (not one of the portfolio's photos): pick one from the
 * device, move the frame to the part that should show, save. "Remove" goes back to a chosen or the first photo.
 */
@Component({
  selector: 'app-portfolio-cover',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiAlert, UiButton, UiFileUpload, UiImageEditor, UiModal, UiText],
  template: `
    <div class="current">
      @if (portfolio().coverUrl; as src) {
        <img class="preview" [src]="src" alt="Your cover picture" />
      } @else {
        <div class="preview preview--empty">
          <hugeicons-icon [icon]="icons.cover" [size]="28" [strokeWidth]="1.6" />
        </div>
      }
      <ui-text variant="caption" class="muted">{{ sourceText() }}</ui-text>
    </div>
    <div class="row">
      <ui-file-upload
        accept="image/*"
        acceptLabel="JPEG, PNG or WebP"
        label="Upload a cover picture"
        hint="A wide photo works best"
        [disabled]="busy()"
        (filesSelected)="choose($event)"
      />
      @if (portfolio().coverImageUrl) {
        <ui-button variant="ghost" size="sm" [loading]="busy()" (click)="remove()">
          <hugeicons-icon [icon]="icons.trash" [size]="16" [strokeWidth]="1.8" /> Remove uploaded picture
        </ui-button>
      }
    </div>

    <ui-modal [open]="!!source()" (openChange)="!$event && cancel()" title="Cover picture" size="lg">
      @if (source(); as src) {
        <div class="crop">
          <ui-text variant="caption" class="muted">Move the frame to the part you want at the top of your page. Pinch or scroll to zoom.</ui-text>
          <ui-image-editor #coverEditor class="editor" label="Cover picture" [src]="src" mode="crop" [aspect]="aspect" [(crop)]="crop" (loadError)="failed.set(true)" />
          @if (failed()) {
            <ui-alert tone="warning" heading="This picture couldn't be opened">Try another one.</ui-alert>
          }
          <div class="actions">
            <ui-button variant="ghost" (click)="cancel()">Cancel</ui-button>
            <ui-button variant="primary" [loading]="busy()" [disabled]="failed() || !editor()?.loaded()" (click)="save()">
              <hugeicons-icon [icon]="icons.done" [size]="18" [strokeWidth]="1.8" /> Use this picture
            </ui-button>
          </div>
        </div>
      }
    </ui-modal>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .current { display: flex; flex-direction: column; gap: var(--ui-space-2); }
    .preview { display: block; width: 100%; max-width: 480px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: var(--ui-radius-md, 8px);
      border: 1px solid var(--ui-color-border); }
    .preview--empty { display: grid; place-items: center; background: var(--ui-color-surface-hover); color: var(--ui-color-text-muted); }
    .muted { color: var(--ui-color-text-muted); }
    .row { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-2); }
    .row ui-file-upload { align-self: stretch; }
    .crop { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .editor { display: block; width: 100%; height: min(60vh, 520px); }
    .actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: var(--ui-space-2); }
  `,
})
export class PortfolioCoverComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  protected readonly icons = APP_ICONS;
  protected readonly aspect = PORTFOLIO_COVER_ASPECT;

  readonly portfolio = input.required<Portfolio>();
  readonly changed = output<Portfolio>();

  protected readonly editor = viewChild<UiImageEditor>('coverEditor');
  /** A blob: URL of the picked file while it is being framed. */
  protected readonly source = signal<string | null>(null);
  protected readonly crop = signal<UiImageCrop | null>(null);
  protected readonly failed = signal(false);
  protected readonly busy = signal(false);

  protected sourceText(): string {
    switch (this.portfolio().coverSource) {
      case 'upload':
        return 'Your uploaded cover picture.';
      case 'photo':
        return 'One of your portfolio photos. Upload a picture to use something else.';
      case 'auto':
        return 'For now, the first photo of your first collection. Upload a picture to choose your own.';
      default:
        return 'No cover yet. Upload a picture for the top of your page.';
    }
  }

  protected choose(files: File[]): void {
    const file = files[0];
    if (!file) return;
    this.release();
    this.failed.set(false);
    this.crop.set(null);
    this.source.set(URL.createObjectURL(file));
  }

  protected async save(): Promise<void> {
    const ed = this.editor();
    if (!ed) return;
    this.busy.set(true);
    try {
      const blob = await ed.toBlob('image/jpeg', 0.9);
      const p = await firstValueFrom(this.api.setPortfolioCover(blob, 'cover.jpg'));
      this.changed.emit(p);
      this.cancel();
    } catch {
      /* the toast said why */
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    this.busy.set(true);
    try {
      this.changed.emit(await firstValueFrom(this.api.removePortfolioCover()));
    } catch {
      /* toast */
    } finally {
      this.busy.set(false);
    }
  }

  protected cancel(): void {
    this.release();
    this.source.set(null);
  }

  private release(): void {
    const s = this.source();
    if (s) URL.revokeObjectURL(s);
  }

  ngOnDestroy(): void {
    this.release();
  }
}
