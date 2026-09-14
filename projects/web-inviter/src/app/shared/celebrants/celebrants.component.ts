import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiCheckbox, UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { Celebrant, DashboardViewer } from '../utils/types/api.types';

/**
 * The people an event is for: the couple at a wedding, the child at a birthday.
 *
 * <p>Used in two places. While starting an event (<code>mode="wizard"</code>) it only adds and
 * removes, and everyone added can only look. On the event dashboard the organiser can also give
 * someone full access, which is never offered while starting: it is a decision about a running
 * event, not part of setting one up.</p>
 */
@Component({
  selector: 'app-celebrants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiBadge, UiButton, UiCheckbox, UiConfirmDialog, UiFormField, UiInput, UiSpinner, UiSwitch, UiText],
  templateUrl: './celebrants.component.html',
  styleUrl: './celebrants.component.scss',
})
export class CelebrantsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();
  readonly mode = input<'wizard' | 'dashboard'>('dashboard');
  /** Only the organiser may hand out full access; a celebrant who has it can't pass it on. */
  readonly viewer = input<DashboardViewer>('organiser');

  readonly changed = output<Celebrant[]>();

  protected readonly list = signal<Celebrant[] | null>(null);

  protected readonly name = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly notify = signal(false);
  protected readonly adding = signal(false);
  protected readonly busyId = signal<string | null>(null);
  protected readonly removing = signal<Celebrant | null>(null);

  protected readonly canAdd = computed(
    () => !!this.name().trim() && (!!this.email().trim() || !!this.phone().trim()),
  );
  protected readonly canGrant = computed(() => this.mode() === 'dashboard' && this.viewer() === 'organiser');

  ngOnInit(): void {
    this.api.celebrants(this.campaignId()).subscribe({
      next: (list) => this.set(list),
      error: () => this.list.set([]),
    });
  }

  protected add(): void {
    if (!this.canAdd() || this.adding()) return;
    this.adding.set(true);
    const before = this.list()?.length ?? 0;
    this.api
      .addCelebrant(this.campaignId(), {
        name: this.name().trim(),
        email: this.email().trim() || null,
        phone: this.phone().trim() || null,
        notify: this.notify() && !!this.email().trim(),
      })
      .subscribe({
        next: (list) => {
          this.adding.set(false);
          // The server ignores somebody adding themselves; say so rather than looking broken.
          if (list.length === before) {
            this.toast.info("That's you. You already have this event.");
          } else if (this.notify() && !this.email().trim()) {
            this.toast.info('Added. We can only let them know by email, so nothing was sent.');
          }
          this.name.set('');
          this.email.set('');
          this.phone.set('');
          this.notify.set(false);
          this.set(list);
        },
        error: () => this.adding.set(false),
      });
  }

  protected setAccess(c: Celebrant, canManage: boolean): void {
    if (this.busyId()) return;
    this.busyId.set(c.id);
    this.api.setCelebrantAccess(this.campaignId(), c.id, canManage).subscribe({
      next: (list) => {
        this.busyId.set(null);
        this.set(list);
      },
      error: () => {
        this.busyId.set(null);
        // Put the switch back from the truth.
        this.list.update((l) => (l ? [...l] : l));
      },
    });
  }

  protected notifyNow(c: Celebrant): void {
    if (this.busyId()) return;
    this.busyId.set(c.id);
    this.api.notifyCelebrant(this.campaignId(), c.id).subscribe({
      next: (list) => {
        this.busyId.set(null);
        this.set(list);
        this.toast.success(`Sent ${c.name} a heads-up.`);
      },
      error: () => this.busyId.set(null),
    });
  }

  protected remove(): void {
    const c = this.removing();
    if (!c) return;
    this.busyId.set(c.id);
    this.api.removeCelebrant(this.campaignId(), c.id).subscribe({
      next: (list) => {
        this.busyId.set(null);
        this.set(list);
      },
      error: () => this.busyId.set(null),
    });
  }

  private set(list: Celebrant[]): void {
    this.list.set(list);
    this.changed.emit(list);
  }
}
