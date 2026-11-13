import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, Observable } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiActionSheetPanel, UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiChoiceGrid, UiFormField, UiInput, type UiChoice } from '@zouriel/ui/form';
import { UiReorderGrid, type UiReorderGridItem } from '@zouriel/ui/sortable';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';
import { ApiService } from '../../shared/api/api.service';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { PortfolioPhotoPickerComponent, type PortfolioPick } from '../../shared/portfolio/portfolio-photo-picker.component';
import { PortfolioUploaderComponent } from '../../shared/portfolio/portfolio-uploader.component';
import { collectionKind, Portfolio, PortfolioLayout } from '../../shared/portfolio/portfolio.types';

/** One collection: its name, how it is laid out, its photos in order (drag), the cover, adding and removing photos. */
@Component({
  selector: 'app-portfolio-collection',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BackLinkComponent,
    FormsModule,
    HugeiconsIconComponent,
    PortfolioPhotoPickerComponent,
    PortfolioUploaderComponent,
    UiActionSheetPanel,
    UiButton,
    UiChoiceGrid,
    UiConfirmDialog,
    UiFormField,
    UiInput,
    UiModal,
    UiReorderGrid,
    UiSpinner,
    UiText,
  ],
  template: `
    <section class="wrap">
      <div class="ib-container narrow">
        <app-back-link link="/portfolio" label="Portfolio" />
        @if (!portfolio()) {
          <div class="center"><ui-spinner /></div>
        } @else if (!collection()) {
          <ui-text>This collection isn't there any more.</ui-text>
        } @else {
          <div class="form">
            <ui-form-field label="Name">
              <ui-input [(ngModel)]="title" [ngModelOptions]="{ standalone: true }" (blur)="saveTitle()" />
            </ui-form-field>
            <ui-text variant="h4">Layout</ui-text>
            <ui-choice-grid label="Layout" [options]="layouts()" [value]="collection()!.layout" (valueChange)="setLayout($event)" minTile="96px">
              <ng-template #tile let-item>
                <span class="layout layout--{{ item.value }}"><i></i><i></i><i></i><i></i></span>
              </ng-template>
            </ui-choice-grid>

            <div class="head">
              <ui-text variant="h4">Photos</ui-text>
              @if (uploads()) {
                <span class="kind"><hugeicons-icon [icon]="icons.uploadPhotos" [size]="16" [strokeWidth]="1.8" /> Uploaded from your device</span>
              } @else {
                <ui-button variant="secondary" size="sm" (click)="adding.set(true)">
                  <hugeicons-icon [icon]="icons.add" [size]="18" [strokeWidth]="1.8" /> Add photos
                </ui-button>
              }
            </div>
            @if (uploads()) {
              <app-portfolio-uploader [collectionId]="collection()!.id" [portfolio]="portfolio()!" (changed)="portfolio.set($event)" />
            }
            @if (items().length) {
              <ui-text variant="caption" class="muted">Hold a photo and drag it to move it. Tap one for more.</ui-text>
              <ui-reorder-grid
                ariaLabel="Photos in this collection"
                [items]="items()"
                [coverId]="coverId()"
                [minTile]="100"
                [removable]="true"
                removeLabel="Remove photo"
                (reorder)="reorder($event)"
                (tileTap)="tapped.set($event)"
                (remove)="removing.set($event)"
              />
            } @else if (!uploads()) {
              <ui-text class="muted">No photos yet. Add some from one of your events.</ui-text>
            }

            <ui-button variant="ghost" class="danger" (click)="deleting.set(true)">
              <hugeicons-icon [icon]="icons.trash" [size]="18" [strokeWidth]="1.8" /> Delete this collection
            </ui-button>
          </div>
        }
      </div>
    </section>

    <ui-modal [(open)]="adding" title="Add photos" size="lg">
      @if (adding()) {
        <app-portfolio-photo-picker [error]="addError()" (chosen)="add($event)" />
      }
    </ui-modal>

    <ui-action-sheet
      [open]="!!tapped()"
      (openChange)="!$event && tapped.set(null)"
      title="Photo"
      [actions]="photoActions()"
      (select)="photoAction($event)"
    />

    <ui-confirm-dialog
      [open]="!!removing()"
      (openChange)="!$event && removing.set(null)"
      title="Remove this photo?"
      [message]="uploads() ? 'It leaves your portfolio and is deleted from invites.blog.' : 'It leaves your portfolio. The album keeps its own copy.'"
      confirmLabel="Remove"
      cancelLabel="Keep it"
      [destructive]="true"
      (confirm)="removePhoto()"
    />
    <ui-confirm-dialog
      [open]="deleting()"
      (openChange)="!$event && deleting.set(false)"
      title="Delete this collection?"
      [message]="uploads() ? 'Its photos leave your portfolio and are deleted from invites.blog.' : 'Its photos leave your portfolio. Your albums keep theirs.'"
      confirmLabel="Delete"
      cancelLabel="Keep it"
      [destructive]="true"
      (confirm)="deleteCollection()"
    />
  `,
  styles: `
    .wrap { padding: clamp(1rem, 3vw, 2.5rem) 0 8rem; }
    .narrow { max-width: 760px; }
    .center { display: grid; place-items: center; padding: var(--ui-space-12); }
    .form { display: flex; flex-direction: column; gap: var(--ui-space-4); margin-top: var(--ui-space-4); }
    .head { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .muted { color: var(--ui-color-text-muted); }
    .kind { display: inline-flex; align-items: center; gap: var(--ui-space-1); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .danger { align-self: flex-start; color: var(--ui-color-danger); }
    .layout { display: grid; gap: 3px; width: 56px; height: 42px; margin: 0 auto; }
    .layout i { display: block; background: var(--ui-color-text-muted); opacity: 0.45; border-radius: 2px; }
    .layout--grid { grid-template-columns: 1fr 1fr; }
    .layout--masonry { grid-template-columns: 1fr 1fr; grid-template-rows: 2fr 1fr 2fr; }
    .layout--masonry i:nth-child(1) { grid-row: span 2; }
    .layout--masonry i:nth-child(4) { grid-row: span 2; }
    .layout--slideshow { grid-template-columns: 1fr; }
    .layout--slideshow i:not(:first-child) { display: none; }
  `,
})
export class PortfolioCollectionComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly router = inject(Router);
  protected readonly icons = APP_ICONS;

  /** From the route (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly portfolio = signal<Portfolio | null>(null);
  protected readonly collection = computed(() => this.portfolio()?.collections.find((c) => c.id === this.id()) ?? null);
  /** An uploads collection (pictures from the device): an upload box instead of the event picker. Fixed when made. */
  protected readonly uploads = computed(() => {
    const c = this.collection();
    return !!c && collectionKind(c) === 'uploads';
  });
  protected readonly items = computed<UiReorderGridItem[]>(() =>
    (this.collection()?.photos ?? []).map((p, i) => ({ id: p.id, src: p.thumbUrl, alt: `Photo ${i + 1}` })),
  );
  protected readonly coverId = computed(() => this.collection()?.coverPhotoId ?? this.collection()?.photos[0]?.id ?? null);
  protected readonly layouts = computed<UiChoice[]>(() => [
    { value: 'grid', label: 'Grid' },
    { value: 'masonry', label: 'Mosaic' },
    { value: 'slideshow', label: 'Slideshow' },
  ]);
  protected readonly adding = signal(false);
  /** Why the last choice couldn't be added; shown in the picker so they can choose again. */
  protected readonly addError = signal<string | null>(null);
  protected readonly tapped = signal<string | null>(null);
  protected readonly removing = signal<string | null>(null);
  protected readonly deleting = signal(false);
  protected title = '';

  protected readonly photoActions = computed(() => [
    { value: 'cover', label: 'Use as the collection picture', icon: APP_ICONS.collection },
    { value: 'page-cover', label: 'Use as the big photo on your page', icon: APP_ICONS.cover },
    { value: 'remove', label: 'Remove from portfolio', icon: APP_ICONS.trash, danger: true },
  ]);

  constructor() {
    this.api.portfolio().subscribe({
      next: (p) => {
        this.portfolio.set(p);
        this.title = this.collection()?.title ?? '';
      },
      error: () => void this.router.navigate(['/portfolio']),
    });
  }

  protected saveTitle(): void {
    const c = this.collection();
    const t = this.title.trim();
    if (!c || !t || t === c.title) return;
    void this.run(this.api.updatePortfolioCollection(c.id, { title: t }));
  }

  protected setLayout(layout: string | null): void {
    const c = this.collection();
    if (c && layout && layout !== c.layout) void this.run(this.api.updatePortfolioCollection(c.id, { layout: layout as PortfolioLayout }));
  }

  protected reorder(ids: string[]): void {
    const c = this.collection();
    if (c) void this.run(this.api.orderPortfolioPhotos(c.id, ids));
  }

  protected photoAction(action: string): void {
    const id = this.tapped();
    const c = this.collection();
    this.tapped.set(null);
    if (!id || !c) return;
    if (action === 'cover') void this.run(this.api.updatePortfolioCollection(c.id, { coverPhotoId: id }), 'Collection picture changed.');
    else if (action === 'page-cover') void this.run(this.api.updatePortfolio({ coverPhotoId: id }), 'Big photo changed.');
    else if (action === 'remove') this.removing.set(id);
  }

  protected removePhoto(): void {
    const id = this.removing();
    this.removing.set(null);
    if (id) void this.run(this.api.removePortfolioPhoto(id));
  }

  protected async add(pick: PortfolioPick): Promise<void> {
    const c = this.collection();
    if (!c) return;
    this.addError.set(null);
    try {
      const r = await firstValueFrom(this.api.addPortfolioPhotos({ photoIds: pick.photoIds, collectionId: c.id }));
      this.portfolio.set(r.portfolio);
      if (r.added > 0) {
        this.toast.success(r.message);
        this.adding.set(false);
      } else {
        // Nothing new went in (they were all there already): say so where they are choosing.
        this.addError.set(r.message);
      }
    } catch (e) {
      this.addError.set((e as Error).message);
    }
  }

  protected async deleteCollection(): Promise<void> {
    const c = this.collection();
    this.deleting.set(false);
    if (c && (await this.run(this.api.removePortfolioCollection(c.id)))) void this.router.navigate(['/portfolio']);
  }

  private async run(call: Observable<Portfolio>, done?: string): Promise<Portfolio | null> {
    try {
      const p = await firstValueFrom(call);
      this.portfolio.set(p);
      if (done) this.toast.success(done);
      return p;
    } catch {
      return null;
    }
  }
}
