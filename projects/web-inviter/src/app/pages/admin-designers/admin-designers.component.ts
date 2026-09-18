import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { AdminDesigner } from '../../shared/utils/types/api.types';

/** Designer accounts: who they are, what they've published, and suspending or reinstating them. */
@Component({
  selector: 'app-admin-designers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, UiBadge, UiButton, UiCard, UiConfirmDialog, UiEmptyState,
    UiFormField, UiSearchInput, UiSpinner, UiText,
  ],
  templateUrl: './admin-designers.component.html',
  styleUrl: './admin-designers.component.scss',
})
export class AdminDesignersComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  protected readonly loading = signal(true);
  protected readonly designers = signal<AdminDesigner[]>([]);
  protected search = '';

  protected readonly busy = signal<string | null>(null);
  /** The designer awaiting a yes/no before being suspended. */
  protected readonly pendingSuspend = signal<AdminDesigner | null>(null);
  protected readonly suspendMessage = computed(() => {
    const d = this.pendingSuspend();
    if (!d) return '';
    return `“${d.displayName}” won’t be able to sign in. Their already-published templates stay live.`;
  });

  constructor() {
    this.load();
  }

  protected onSearch(): void {
    this.load();
  }

  /** Suspending blocks sign-in, so it asks first; reinstating doesn't need to. */
  protected toggleSuspended(designer: AdminDesigner): void {
    if (designer.isActive) {
      this.pendingSuspend.set(designer);
    } else {
      this.applySuspend(designer);
    }
  }

  protected confirmSuspend(): void {
    const designer = this.pendingSuspend();
    this.pendingSuspend.set(null);
    if (designer) this.applySuspend(designer);
  }

  private applySuspend(designer: AdminDesigner): void {
    this.busy.set(designer.userId);
    this.api.setDesignerSuspended(designer.userId, designer.isActive).subscribe({
      next: (updated) => {
        this.designers.update((list) =>
          list.map((d) => (d.userId === updated.userId ? updated : d)),
        );
        this.busy.set(null);
        this.toast.success(
          updated.isActive
            ? `${updated.displayName} can sign in again.`
            : `${updated.displayName} is suspended. Their published templates stay live.`,
        );
      },
      error: () => this.busy.set(null),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.api.listDesigners(1, this.search).subscribe({
      next: (page) => {
        this.designers.set(page.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
