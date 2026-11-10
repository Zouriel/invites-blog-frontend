import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { FaceGroups, FacePerson, FaceScope } from '../utils/types/api.types';

/**
 * The host's People tab: every face found in the album as a grid. Tapping one opens its sheet, where
 * the host names it, says it is the same person as one already named (which merges them), looks at
 * that person's photos, or removes the group.
 */
@Component({
  selector: 'app-face-people-tab',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiAvatar, UiButton, UiConfirmDialog, UiInput, UiModal, UiText],
  template: `
    @if (faces().waiting > 0) {
      <ui-text variant="caption" class="muted wait">
        Grouping {{ faces().waiting === 1 ? '1 photo' : faces().waiting + ' photos' }}…
      </ui-text>
    }
    @if (!faces().people.length) {
      <ui-text variant="caption" class="muted">No faces found yet.</ui-text>
    } @else {
      <ui-text variant="caption" class="muted">Tap a face to name it.</ui-text>
      <div class="grid">
        @for (p of faces().people; track p.id) {
          <button type="button" class="face" (click)="pick(p)">
            <ui-avatar [src]="p.coverUrl" [alt]="nameOf(p)" [dimension]="72" [crop]="cropOf(p)" />
            <span class="face__name" [class.face__name--none]="!p.name">{{ nameOf(p) }}</span>
            <span class="face__count">{{ p.photoCount === 1 ? '1 photo' : p.photoCount + ' photos' }}</span>
          </button>
        }
      </div>
    }

    <ui-modal [open]="!!chosen()" (openChange)="!$event && chosen.set(null)" [title]="chosen() ? nameOf(chosen()!) : ''" size="sm">
      @if (chosen(); as p) {
        <div class="sheet">
          <div class="sheet__head">
            <ui-avatar [src]="p.coverUrl" [alt]="nameOf(p)" [dimension]="72" [crop]="cropOf(p)" />
            <span class="face__count">{{ p.photoCount === 1 ? '1 photo' : p.photoCount + ' photos' }}</span>
          </div>
          <form class="name" (submit)="$event.preventDefault(); saveName(p)">
            <ui-input [(ngModel)]="draft" [ngModelOptions]="{ standalone: true }" ariaLabel="Name for this person" placeholder="Name" />
            <ui-button variant="primary" size="sm" [loading]="busy()" [disabled]="!draft.trim()" (click)="saveName(p)">Save name</ui-button>
          </form>

          @if (others().length) {
            <div class="same">
              <ui-text variant="h4">Same person as…</ui-text>
              <ui-text variant="caption" class="muted">Pick someone already named to join their photos.</ui-text>
              <div class="same__list">
                @for (o of others(); track o.id) {
                  <button type="button" class="same__row" [disabled]="busy()" (click)="merging.set({ from: p, into: o })">
                    <ui-avatar [src]="o.coverUrl" [alt]="nameOf(o)" [dimension]="40" [crop]="cropOf(o)" />
                    <span>{{ nameOf(o) }}</span>
                  </button>
                }
              </div>
            </div>
          }

          <div class="acts">
            <ui-button variant="outline" size="sm" (click)="seePhotos(p)">See photos</ui-button>
            <ui-button variant="ghost" size="sm" (click)="removing.set(p)">Remove this group</ui-button>
          </div>
        </div>
      }
    </ui-modal>

    <ui-confirm-dialog
      [open]="!!merging()"
      (openChange)="!$event && merging.set(null)"
      title="Same person?"
      [message]="merging() ? 'These photos join ' + nameOf(merging()!.into) + '. This can\\'t be undone.' : ''"
      confirmLabel="Yes, same person"
      cancelLabel="Not now"
      (confirm)="confirmMerge()"
    />
    <ui-confirm-dialog
      [open]="!!removing()"
      (openChange)="!$event && removing.set(null)"
      title="Remove this group?"
      message="Its name and grouping are deleted. Photos stay in the album, and it won't be grouped again."
      confirmLabel="Remove group"
      cancelLabel="Keep it"
      [destructive]="true"
      (confirm)="confirmRemove()"
    />
  `,
  styles: `
    :host { display: block; }
    .muted { display: block; color: var(--ui-color-text-muted); }
    .wait { margin-bottom: var(--ui-space-2); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.5rem, 1fr)); gap: var(--ui-space-4); margin-top: var(--ui-space-3); }
    .face { display: flex; flex-direction: column; align-items: center; gap: var(--ui-space-1); min-width: 0; padding: var(--ui-space-2); border: 0; background: none; color: inherit; font: inherit; cursor: pointer; border-radius: var(--ui-radius, 8px); }
    .face:hover { background: var(--ui-color-surface-raised); }
    .face__name { font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .face__name--none { font-weight: 400; color: var(--ui-color-text-muted); }
    .face__count { font-size: 0.75rem; color: var(--ui-color-text-muted); }
    .sheet { display: grid; gap: var(--ui-space-4); }
    .sheet__head { display: flex; align-items: center; gap: var(--ui-space-3); }
    .name { display: flex; gap: var(--ui-space-2); align-items: center; }
    .name ui-input { flex: 1; min-width: 0; }
    .same { display: grid; gap: var(--ui-space-2); }
    .same__list { display: flex; flex-direction: column; max-height: 14rem; overflow-y: auto; }
    .same__row { display: flex; align-items: center; gap: var(--ui-space-3); padding: var(--ui-space-2); border: 0; background: none; color: inherit; font: inherit; text-align: start; cursor: pointer; border-radius: var(--ui-radius, 8px); }
    .same__row:hover { background: var(--ui-color-surface-raised); }
    .acts { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
  `,
})
export class FacePeopleTabComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly faces = input.required<FaceGroups>();
  readonly scope = input.required<FaceScope>();
  /** The box should be loaded again, so the grid, the filter and the notice agree. */
  readonly changed = output<void>();
  /** Show the album narrowed to this person. */
  readonly see = output<FacePerson>();

  protected readonly chosen = signal<FacePerson | null>(null);
  protected readonly busy = signal(false);
  protected readonly merging = signal<{ from: FacePerson; into: FacePerson } | null>(null);
  protected readonly removing = signal<FacePerson | null>(null);
  protected draft = '';

  /** Already-named people the open one could be. */
  protected readonly others = computed(() => {
    const open = this.chosen();
    return this.faces().people.filter((p) => p.id !== open?.id && !!p.name?.trim());
  });

  protected nameOf(p: FacePerson): string {
    return p.name?.trim() || 'Unnamed';
  }
  protected cropOf(p: FacePerson) {
    return { x: p.coverX, y: p.coverY, w: p.coverW, h: p.coverH };
  }

  protected pick(p: FacePerson): void {
    this.draft = p.name ?? '';
    this.chosen.set(p);
  }

  protected saveName(p: FacePerson): void {
    const name = this.draft.trim();
    if (this.busy() || !name) return;
    this.busy.set(true);
    this.api.nameFacePerson(this.scope(), p.id, name).subscribe({
      next: () => this.done(),
      error: () => this.busy.set(false),
    });
  }

  protected confirmMerge(): void {
    // Read before the confirm dialog closes itself, which clears the target.
    const m = this.merging();
    if (!m || this.busy()) return;
    this.busy.set(true);
    this.api.mergeFacePerson(this.scope(), m.from.id, m.into.id).subscribe({
      next: () => {
        this.toast.success(`Joined ${this.nameOf(m.into)}.`);
        this.done();
      },
      error: () => this.busy.set(false),
    });
  }

  protected confirmRemove(): void {
    const p = this.removing();
    if (!p || this.busy()) return;
    this.busy.set(true);
    this.api.ignoreFacePerson(this.scope(), p.id).subscribe({
      next: () => this.done(),
      error: () => this.busy.set(false),
    });
  }

  protected seePhotos(p: FacePerson): void {
    this.chosen.set(null);
    this.see.emit(p);
  }

  private done(): void {
    this.busy.set(false);
    this.chosen.set(null);
    this.merging.set(null);
    this.removing.set(null);
    this.changed.emit();
  }
}
