import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiText } from 'ui/text';
import { UiBadge } from 'ui/badge';
import { UiStatCard } from 'ui/card';
import { UiColumn, UiTable } from 'ui/table';
import { UiModal, UiConfirmDialog, UiToastService } from 'ui/dialog';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState, UiResult } from 'ui/feedback';
import { UiFormField, UiInput, UiSelect, UiSwitch } from 'ui/form';
import { ApiService } from '../../shared/api/api.service';
import { DashboardGuest, DashboardReport, GuestPayload } from '../../shared/utils/types/api.types';
import { SelectOption } from '../../shared/utils/constants/app.constants';

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
    UiSelect,
    UiSwitch,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(UiToastService);

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
    // Defaults to on: matches the send-immediately behavior this dialog always had before the
    // toggle existed. Off is the explicit "add now, I'll send it later" choice.
    sendNow: this.fb.control(true),
  });
  private readonly formValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly canAddGuest = computed(() => {
    const v = this.formValue();
    return !!v.name?.trim() && (!!v.email?.trim() || !!v.phone?.trim());
  });

  /** This campaign's configured roles, for the Add-guest role picker — free text let hosts typo
   * their way past whatever a role-aware template actually expects. */
  protected readonly roleOptions = computed<SelectOption[]>(() => [
    { label: '—', value: '' },
    ...(this.report()?.roles ?? []).map((n) => ({ label: n, value: n })),
  ]);

  /**
   * One column per RSVP question, appended to the fixed ones.
   *
   * Replies used to be written and never read back — a host could ask for a meal choice and have
   * nowhere to see the answers. What was asked comes back with the dashboard, so the headings match
   * this campaign's own questions rather than a hardcoded set.
   */
  protected readonly columns = computed<UiColumn<DashboardGuest>[]>(() => [
    { key: 'name', header: 'Guest' },
    { key: 'contact', header: 'Contact', format: (_v, row) => row.email || row.phone || '—' },
    { key: 'status', header: 'Status', format: (v) => this.statusLabel(v ? String(v) : '') },
    { key: 'channel', header: 'Delivery', format: (_v, row) => this.channelLabel(row.deliveryChannel) },
    { key: 'rsvp', header: 'RSVP', format: (v) => (v ? String(v) : '—') },
    ...(this.report()?.rsvpQuestions ?? []).map((q) => ({
      key: `answer:${q.key}`,
      header: q.label,
      format: (_v: unknown, row: DashboardGuest) => row.rsvpAnswers?.[q.key] || '—',
    })),
  ]);

  private statusLabel(status: string): string {
    return status === 'NotSent' ? 'Not sent — no phone or email' : status || '—';
  }

  private channelLabel(channel?: string | null): string {
    if (!channel) return '—';
    if (channel === 'viber') return 'via Viber';
    if (channel === 'email') return 'via email';
    return `via ${channel}`;
  }

  ngOnInit(): void {
    // The dashboard token is a magic-link secret (Campaign.DashboardTokenHash) — cryptographically
    // unrelated to the builder possession token TokenStore caches under the same campaign id
    // (Campaign.AccessTokenHash, see api.getToken()). Never fall back to or overwrite that cache
    // here: a browser that previously built or resumed this campaign would have a stale access
    // token sitting in that slot, and sending it as a dashboard token gets rejected by the API even
    // though the signed-in account genuinely owns the campaign — which is exactly what made "Sent"
    // items fail to open for some users while working for others (device/cache dependent).
    this.token.set(this.route.snapshot.queryParamMap.get('token'));
    this.load();
  }

  protected rate(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
  }

  private load(): void {
    // Two ways to be here: holding the emailed link's token, or signed in as the account that booked
    // it (opened from Sent). The second has no token and doesn't need one — the account is the proof.
    const token = this.token();
    this.loading.set(true);
    const request = token
      ? this.api.dashboard(this.campaignId(), token)
      : this.api.myDashboard(this.campaignId());
    request.subscribe({
      next: (r) => {
        this.report.set(r);
        // Whichever door it came through, the server only answers to someone who may manage it.
        this.canManage.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(
          token
            ? 'We could not load this dashboard. The link may have expired.'
            : "This campaign isn't on your account. Open it with the dashboard link emailed to you.",
        );
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
    let sent = 0;
    let failed = 0; // reached the server but the provider didn't accept it — not an HTTP error
    const finish = () => {
      if (--pending > 0) return;
      this.resending.set(false);
      this.load();
      if (failed > 0) {
        this.toast.danger(
          sent > 0
            ? `Sent to ${sent} of ${sent + failed} selected guest${sent + failed === 1 ? '' : 's'}. ${failed} failed to send — check they have a valid email or phone.`
            : `Could not send to ${failed} guest${failed === 1 ? '' : 's'} — check they have a valid email or phone.`,
        );
      } else if (sent > 0) {
        this.toast.success(`Sent to ${sent} guest${sent === 1 ? '' : 's'}.`);
      }
    };
    for (const g of rows) {
      this.api.resendGuest(this.campaignId(), g.id, this.token() ?? undefined).subscribe({
        next: (r) => {
          if (r.sent) sent++; else failed++;
          finish();
        },
        // A thrown HTTP error (rate limit, ownership, etc.) already toasts via ApiService —
        // nothing else to add here beyond letting the batch finish and the table refresh.
        error: finish,
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
      sendNow: v.sendNow,
    };
    this.api.addGuest(this.campaignId(), payload, this.token() ?? undefined).subscribe({
      next: (r) => {
        this.adding.set(false);
        this.showAdd.set(false);
        this.form.reset({ name: '', email: '', phone: '', role: '', sendNow: true });
        this.load();
        if (r.added === 0) {
          // A no-op — same email/phone as an existing guest, deduped server-side. Nothing was added
          // or sent, so neither "failed to send" nor "sent" is true here.
          this.toast.info("That guest already exists — didn't add a duplicate.");
        } else if (v.sendNow && !r.sent) {
          // sent=false otherwise covers two different reasons: the send was attempted and the
          // provider rejected it, or nothing was attempted at all (over paid capacity).
          const reason = r.needsTopUp
            ? "you're over your paid guest capacity — top up to send it."
            : 'the invite failed to send — select them and resend once fixed.';
          this.toast.danger(`Guest added, but ${reason}`);
        } else if (v.sendNow && r.sent) {
          this.toast.success('Guest added and sent their invite.');
        } else if (!v.sendNow) {
          this.toast.success('Guest added. Select them and "Send to selected" when you\'re ready to send.');
        }
      },
      error: () => this.adding.set(false),
    });
  }

  protected cancelCampaign(): void {
    this.api.cancelCampaign(this.campaignId(), this.token() ?? undefined).subscribe({
      next: () => this.load(),
      error: () => {
        /* toast already shown by ApiService */
      },
    });
  }
}
