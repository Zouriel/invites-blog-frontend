import { ChangeDetectionStrategy, Component, computed, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiChoiceGrid, UiFormField, UiInput, type UiChoice } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { Portfolio } from './portfolio.types';

const NEW = '__new__';

/**
 * "Add to portfolio" from an album's selection bar: pick one of the studio's collections, or name a new one.
 * The server keeps only the studio's own photos and says how many it skipped; that sentence is the toast.
 */
@Component({
  selector: 'app-add-to-portfolio',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiChoiceGrid, UiFormField, UiInput, UiModal, UiSpinner, UiText],
  template: `
    <ui-modal [(open)]="open" title="Add to portfolio" size="md">
      @if (portfolio() === null) {
        <div class="center"><ui-spinner /></div>
      } @else {
        <div class="body">
          <ui-text variant="caption" class="muted">
            {{ photoIds().length }} {{ photoIds().length === 1 ? 'photo' : 'photos' }} chosen. Only photos you added yourself are used.
          </ui-text>
          <ui-choice-grid label="Collection" [options]="choices()" [(value)]="target" minTile="140px">
            <ng-template #tile let-item>
              @if (coverFor(item.value); as src) {
                <img class="art" [src]="src" alt="" />
              } @else {
                <span class="art art--empty">{{ item.value === NEW ? '+' : '' }}</span>
              }
            </ng-template>
          </ui-choice-grid>
          @if (target() === NEW) {
            <ui-form-field label="Name of the new collection">
              <ui-input [(ngModel)]="newTitle" [ngModelOptions]="{ standalone: true }" placeholder="Weddings" />
            </ui-form-field>
          }
          <div class="actions">
            <ui-button variant="ghost" (click)="open.set(false)">Cancel</ui-button>
            <ui-button variant="primary" [loading]="busy()" [disabled]="!canAdd()" (click)="add()">Add</ui-button>
          </div>
        </div>
      }
    </ui-modal>
  `,
  styles: `
    .center { display: grid; place-items: center; padding: var(--ui-space-6); }
    .body { display: flex; flex-direction: column; gap: var(--ui-space-4); }
    .muted { color: var(--ui-color-text-muted); }
    .art { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: var(--ui-radius-sm, 6px); }
    .art--empty { display: grid; place-items: center; background: var(--ui-color-surface-hover); color: var(--ui-color-text-muted); font-size: 1.6rem; }
    .actions { display: flex; justify-content: flex-end; gap: var(--ui-space-2); }
  `,
})
export class AddToPortfolioComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly NEW = NEW;

  readonly open = model(false);
  readonly photoIds = input<string[]>([]);
  /** Fired after photos were added (the album can leave select mode). */
  readonly added = output<void>();

  protected readonly portfolio = signal<Portfolio | null>(null);
  protected readonly target = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected newTitle = '';

  protected readonly choices = computed<UiChoice[]>(() => [
    ...(this.portfolio()?.collections ?? []).map((c) => ({
      value: c.id,
      label: c.title,
      description: `${c.photos.length} ${c.photos.length === 1 ? 'photo' : 'photos'}`,
    })),
    { value: NEW, label: 'New collection' },
  ]);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.portfolio.set(null);
      this.api.portfolio().subscribe({
        next: (p) => {
          this.portfolio.set(p);
          this.target.set(p.collections[0]?.id ?? NEW);
        },
        error: () => this.open.set(false),
      });
    });
  }

  protected coverFor(id: string): string | null {
    return this.portfolio()?.collections.find((c) => c.id === id)?.coverUrl ?? null;
  }

  protected canAdd(): boolean {
    return !!this.target() && (this.target() !== NEW || this.newTitle.trim().length > 0) && this.photoIds().length > 0;
  }

  protected async add(): Promise<void> {
    if (!this.canAdd()) return;
    this.busy.set(true);
    try {
      const t = this.target()!;
      const result = await firstValueFrom(
        this.api.addPortfolioPhotos(
          t === NEW ? { photoIds: this.photoIds(), newCollectionTitle: this.newTitle.trim() } : { photoIds: this.photoIds(), collectionId: t },
        ),
      );
      if (result.added > 0) this.toast.success(result.message);
      else this.toast.info(result.message);
      this.open.set(false);
      this.newTitle = '';
      this.added.emit();
    } catch {
      /* the toast said why */
    } finally {
      this.busy.set(false);
    }
  }
}
