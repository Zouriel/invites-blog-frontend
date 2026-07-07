import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiText } from 'ui/text';
import { UiBadge } from 'ui/badge';
import { UiStatCard } from 'ui/card';
import { UiColumn, UiTable } from 'ui/table';
import { UiModal, UiConfirmDialog } from 'ui/dialog';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState, UiResult } from 'ui/feedback';
import { UiFormField, UiInput } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DashboardGuest, DashboardReport, GuestPayload } from '../../shared/utils/types/api.types';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    UiButton,
    UiText,
    UiBadge,
    UiStatCard,
    UiTable,
    UiModal,
    UiConfirmDialog,
    UiSpinner,
    UiEmptyState,
    UiResult,
    UiFormField,
    UiInput,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly campaignId = input.required<string>();

  protected readonly token = signal<string | null>(null);
  protected readonly report = signal<DashboardReport | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly canManage = signal(false);
  protected readonly resending = signal(false);
  protected readonly selected = signal<DashboardGuest[]>([]);

  protected readonly showAdd = signal(false);
  protected readonly showCancel = signal(false);
  protected readonly adding = signal(false);

  protected readonly form = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control(''),
    phone: this.fb.control(''),
    role: this.fb.control(''),
  });
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly canAddGuest = computed(() => {
    const v = this.formValue();
    return !!v.name?.trim() && (!!v.email?.trim() || !!v.phone?.trim());
  });

  protected readonly columns: UiColumn<DashboardGuest>[] = [
    { key: 'name', header: 'Guest' },
    { key: 'contact', header: 'Contact', format: (_v, row) => row.email || row.phone || '—' },
    { key: 'status', header: 'Status', format: (v) => (v ? String(v) : '—') },
    { key: 'rsvp', header: 'RSVP', format: (v) => (v ? String(v) : '—') },
  ];

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    this.token.set(token);
    if (token) {
      this.api.storeToken(this.campaignId(), token);
    }
    this.canManage.set(this.api.hasToken(this.campaignId()));
    this.load();
  }

  protected rate(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  private load(): void {
    const token = this.token();
    if (!token) {
      this.loading.set(false);
      this.error.set('This dashboard link is missing its access token.');
      return;
    }
    this.loading.set(true);
    this.api.dashboard(this.campaignId(), token).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('We could not load this dashboard. The link may have expired.');
      },
    });
  }

  protected onSelectionChange(rows: DashboardGuest[]): void {
    this.selected.set(rows);
  }

  protected resendSelected(): void {
    const rows = this.selected();
    if (!this.canManage() || rows.length === 0 || this.resending()) {
      return;
    }
    this.resending.set(true);
    let pending = rows.length;
    for (const g of rows) {
      this.api.resendGuest(this.campaignId(), g.id).subscribe({
        next: () => {
          if (--pending === 0) {
            this.resending.set(false);
          }
        },
        error: () => {
          if (--pending === 0) {
            this.resending.set(false);
          }
        },
      });
    }
  }

  protected addGuest(): void {
    if (!this.canAddGuest() || this.adding()) {
      return;
    }
    this.adding.set(true);
    const v = this.form.getRawValue();
    const payload: GuestPayload = {
      name: v.name.trim(),
      email: v.email.trim() || undefined,
      phone: v.phone.trim() || undefined,
      role: v.role.trim() || undefined,
    };
    this.api.addGuest(this.campaignId(), payload).subscribe({
      next: () => {
        this.adding.set(false);
        this.showAdd.set(false);
        this.form.reset({ name: '', email: '', phone: '', role: '' });
        this.load();
      },
      error: () => this.adding.set(false),
    });
  }

  protected cancelCampaign(): void {
    this.api.cancelCampaign(this.campaignId()).subscribe({
      next: () => this.load(),
      error: () => {
        /* toast already shown by ApiService */
      },
    });
  }
}
