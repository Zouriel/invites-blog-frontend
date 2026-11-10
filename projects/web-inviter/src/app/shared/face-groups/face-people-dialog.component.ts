import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { FaceCropComponent } from '../face-crop/face-crop.component';
import { FaceGroups, FacePerson, FaceScope } from '../utils/types/api.types';
import { personLabel } from '../photo-box/gallery';

/**
 * Who the album has found, with the one thing every viewer can do about it ("That's me, ignore my
 * face") and what a host can add (give a group a name, remove a group).
 */
@Component({
  selector: 'app-face-people-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FaceCropComponent, UiButton, UiConfirmDialog, UiInput, UiModal, UiText],
  template: `
    <ui-modal [(open)]="open" title="People in this album" size="sm">
      <div class="body">
        <ui-text variant="caption" class="muted">
          Find yourself and tap "That's me" to stop your face being grouped here.
        </ui-text>
        @for (p of faces().people; track p.id) {
          <div class="row">
            <app-face-crop [person]="p" [size]="52" [label]="nameOf(p)" />
            <div class="row__main">
              @if (editing() === p.id) {
                <form class="rename" (submit)="$event.preventDefault(); saveName(p)">
                  <ui-input
                    [(ngModel)]="draft"
                    [ngModelOptions]="{ standalone: true }"
                    ariaLabel="Name for this person"
                    placeholder="Name"
                  />
                  <ui-button size="sm" variant="primary" [loading]="busy()" (click)="saveName(p)">Save</ui-button>
                  <ui-button size="sm" variant="ghost" (click)="editing.set(null)">Cancel</ui-button>
                </form>
              } @else {
                <span class="name">{{ nameOf(p) }}</span>
                <span class="count">{{ p.photoCount === 1 ? '1 photo' : p.photoCount + ' photos' }}</span>
                <div class="acts">
                  <ui-button size="sm" variant="outline" (click)="asking.set({ kind: 'me', person: p })">That's me</ui-button>
                  @if (faces().canName) {
                    <ui-button size="sm" variant="ghost" (click)="startRename(p)">Name</ui-button>
                    <ui-button size="sm" variant="ghost" (click)="asking.set({ kind: 'remove', person: p })">Remove this group</ui-button>
                  }
                </div>
              }
            </div>
          </div>
        } @empty {
          <ui-text variant="caption" class="muted">Nobody is grouped yet.</ui-text>
        }
      </div>
    </ui-modal>

    <ui-confirm-dialog
      [open]="!!asking()"
      (openChange)="!$event && asking.set(null)"
      [title]="asking()?.kind === 'remove' ? 'Remove this group?' : 'Ignore your face?'"
      [message]="
        asking()?.kind === 'remove'
          ? 'Its name and grouping are deleted. Photos stay in the album, and it won\\'t be grouped again.'
          : 'Your face will be removed from grouping in this album and new photos of you won\\'t be grouped.'
      "
      [confirmLabel]="asking()?.kind === 'remove' ? 'Remove group' : 'Ignore my face'"
      cancelLabel="Keep it"
      [destructive]="true"
      (confirm)="confirmAsk()"
    />
  `,
  styles: `
    .body { display: grid; gap: var(--ui-space-3); }
    .muted { color: var(--ui-color-text-muted); }
    .row { display: flex; gap: var(--ui-space-3); align-items: flex-start; }
    .row__main { display: flex; flex-direction: column; gap: var(--ui-space-1); min-width: 0; flex: 1; }
    .name { font-weight: 600; overflow-wrap: anywhere; }
    .count { font-size: 0.8rem; color: var(--ui-color-text-muted); }
    .acts, .rename { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); align-items: center; margin-top: var(--ui-space-1); }
    .rename ui-input { flex: 1 1 10rem; min-width: 0; }
  `,
})
export class FacePeopleDialogComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly open = model(false);
  readonly faces = input.required<FaceGroups>();
  readonly scope = input.required<FaceScope>();
  /** The box should be loaded again (a group went away, or a name changed). */
  readonly changed = output<void>();

  protected readonly editing = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected draft = '';
  protected readonly asking = signal<{ kind: 'me' | 'remove'; person: FacePerson } | null>(null);

  protected readonly people = computed(() => this.faces().people);
  protected nameOf(p: FacePerson): string {
    return p.name?.trim() || personLabel(this.people(), p.id);
  }

  protected startRename(p: FacePerson): void {
    this.draft = p.name ?? '';
    this.editing.set(p.id);
  }

  protected saveName(p: FacePerson): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.nameFacePerson(this.scope(), p.id, this.draft.trim() || null).subscribe({
      next: () => {
        this.busy.set(false);
        this.editing.set(null);
        this.changed.emit();
      },
      error: () => this.busy.set(false),
    });
  }

  protected confirmAsk(): void {
    // Read before the confirm dialog closes itself, which clears the target.
    const ask = this.asking();
    if (!ask) return;
    this.api.ignoreFacePerson(this.scope(), ask.person.id).subscribe({
      next: () => {
        this.toast.success(ask.kind === 'remove' ? 'Group removed.' : 'Your face is no longer grouped here.');
        this.changed.emit();
      },
      error: () => {},
    });
  }
}
