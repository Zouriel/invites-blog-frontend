import { ChangeDetectionStrategy, Component, inject, input, model, output, signal } from '@angular/core';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { FaceGroups, FacePerson, FaceScope } from '../utils/types/api.types';

/**
 * Who the album has found, with the one thing every viewer can do about it ("That's me, ignore my
 * face") and what a host can add (give a group a name, remove a group).
 */
@Component({
  selector: 'app-face-people-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiAvatar, UiButton, UiConfirmDialog, UiModal, UiText],
  template: `
    <ui-modal [(open)]="open" title="People in this album" size="sm">
      <div class="body">
        <ui-text variant="caption" class="muted">
          Find yourself and tap "That's me" to stop your face being grouped here.
        </ui-text>
        @for (p of faces().people; track p.id) {
          <div class="row">
            <ui-avatar [src]="p.coverUrl" [alt]="nameOf(p)" [dimension]="52" [crop]="cropOf(p)" />
            <div class="row__main">
              <span class="name">{{ nameOf(p) }}</span>
              <span class="count">{{ p.photoCount === 1 ? '1 photo' : p.photoCount + ' photos' }}</span>
              <div class="acts">
                <ui-button size="sm" variant="outline" (click)="asking.set(p)">That's me</ui-button>
              </div>
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
      title="Ignore your face?"
      message="Your face will be removed from grouping in this album and new photos of you won't be grouped."
      confirmLabel="Ignore my face"
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
  `,
})
export class FacePeopleDialogComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly open = model(false);
  readonly faces = input.required<FaceGroups>();
  readonly scope = input.required<FaceScope>();
  /** The box should be loaded again (a group went away). */
  readonly changed = output<void>();

  protected readonly asking = signal<FacePerson | null>(null);

  protected nameOf(p: FacePerson): string {
    return p.name?.trim() || 'Unnamed';
  }

  protected cropOf(p: FacePerson) {
    return { x: p.coverX, y: p.coverY, w: p.coverW, h: p.coverH };
  }

  protected confirmAsk(): void {
    // Read before the confirm dialog closes itself, which clears the target.
    const person = this.asking();
    if (!person) return;
    this.api.ignoreFacePerson(this.scope(), person.id).subscribe({
      next: () => {
        this.toast.success('Your face is no longer grouped here.');
        this.changed.emit();
      },
      error: () => {},
    });
  }
}
