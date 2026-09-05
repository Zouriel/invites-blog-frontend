import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiText } from '@zouriel/ui/text';
import { UiBadge } from '@zouriel/ui/badge';
import { UiCard, UiStatCard } from '@zouriel/ui/card';
import { UiColumn, UiRowAction, UiTable } from '@zouriel/ui/table';
import { UiModal, UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiEditableText } from '@zouriel/ui/form';
import { UiEmptyState, UiResult } from '@zouriel/ui/feedback';
import { UiFormField, UiInput, UiSelect, UiSwitch } from '@zouriel/ui/form';
import { ApiService } from '../../shared/api/api.service';
import { BucketCodeComponent } from '../../shared/bucket-code/bucket-code.component';
import { BucketSizeComponent } from '../../shared/bucket-size/bucket-size.component';
import { MediaBucket } from '../../shared/utils/types/api.types';
import { DashboardGuest, DashboardReport, GuestPayload } from '../../shared/utils/types/api.types';
import { SelectOption } from '../../shared/utils/constants/app.constants';
import { PhotoBoxComponent } from '../../shared/photo-box/photo-box.component';
import { CoverPickerComponent } from '../../shared/cover-picker/cover-picker.component';

@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    BucketCodeComponent,
    BucketSizeComponent,
    UiCard,
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
    PhotoBoxComponent,
    CoverPickerComponent,
    UiTab,
    UiTabs,
    UiEditableText,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(UiToastService);

  readonly campaignId = input.required<string>();

  /**
   * Which tab is open lives in the URL, so a reload — or a link the host sends themselves — comes
   * back to where they were. Photos is the default: before the night this page is set-up, but
   * afterwards it is what everyone returns for, and that is most of a campaign's life.
   */
  protected readonly tab = signal<'media' | 'dashboard'>(
    this.route.snapshot.queryParamMap.get('tab') === 'dashboard' ? 'dashboard' : 'media',
  );

  /**
   * The campaign's own name, edited in place. Its own control rather than part of the add-guest form
   * because it is not a form — it saves when the host finishes editing, not on a submit button.
   */
  protected readonly titleControl = this.fb.control('');
  protected readonly renaming = signal(false);

  /** The campaign's cover, and what it would fall back to without one. */
  protected readonly coverUrl = signal<string | null>(null);
  protected readonly templatePreviewUrl = signal<string | null>(null);

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

  /** The guest being corrected, and null when the dialog is closed. */
  protected readonly editing = signal<DashboardGuest | null>(null);
  protected readonly saving = signal(false);

  /**
   * A second form rather than the add form reused. They differ in what they mean: adding decides
   * whether to send an invitation, correcting one never does — a host fixing a typo has not asked
   * for anything to go out, and a stray sendNow on this dialog would send it.
   */
  protected readonly editForm = this.fb.group({
    name: this.fb.control('', Validators.required),
    email: this.fb.control(''),
    phone: this.fb.control(''),
    role: this.fb.control(''),
  });
  private readonly editValue = toSignal(this.editForm.valueChanges, {
    initialValue: this.editForm.getRawValue(),
  });
  protected readonly canSaveGuest = computed(() => {
    const v = this.editValue();
    return !!v.name?.trim() && (!!v.email?.trim() || !!v.phone?.trim());
  });

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
    // Shown because it is editable and because it is the field most likely to be wrong: a
    // role-aware template personalises on it, and a blank one is invisible until the invitation
    // comes out addressed to nobody in particular.
    { key: 'role', header: 'Role', format: (v) => (v ? String(v) : '—') },
    { key: 'status', header: 'Status', format: (v) => this.statusLabel(v ? String(v) : '') },
    { key: 'channel', header: 'Delivery', format: (_v, row) => this.channelLabel(row.deliveryChannel) },
    { key: 'rsvp', header: 'RSVP', format: (v) => (v ? String(v) : '—') },
    ...(this.report()?.rsvpQuestions ?? []).map((q) => ({
      key: `answer:${q.key}`,
      header: q.label,
      format: (_v: unknown, row: DashboardGuest) => row.rsvpAnswers?.[q.key] || '—',
    })),
  ]);

  /**
   * What can be done to a row. Empty without the owner link, which is what hides the column
   * altogether rather than offering a button the server would refuse.
   */
  protected readonly rowActions = computed<UiRowAction<DashboardGuest>[]>(() =>
    this.canManage()
      ? [
          {
            label: 'Edit',
            run: (row: DashboardGuest) => this.openEdit(row),
            ariaLabel: (row: DashboardGuest) => `Edit ${row.name}`,
          },
        ]
      : [],
  );

  protected openEdit(guest: DashboardGuest): void {
    this.editing.set(guest);
    this.editForm.reset({
      name: guest.name ?? '',
      email: guest.email ?? '',
      phone: guest.phone ?? '',
      role: guest.role ?? '',
    });
  }

  protected saveGuest(): void {
    const guest = this.editing();
    if (!guest || !this.canSaveGuest() || this.saving()) return;

    this.saving.set(true);
    const v = this.editForm.getRawValue();
    // Every field, every time. The server merges on "not null", so anything omitted keeps its old
    // value — which would make clearing an email impossible. Sending '' is how a host empties one.
    const payload: GuestPayload = {
      name: v.name.trim(),
      email: v.email.trim(),
      phone: v.phone.trim(),
      role: v.role.trim(),
    };

    this.api.updateGuest(this.campaignId(), guest.id, payload, this.token() ?? undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        // Re-fetched rather than patched in place: the server normalises the phone number and may
        // have changed more than was sent, and the row should show what was actually stored.
        this.load();
        this.toast.success('Guest updated.');
      },
      // ApiService has already said what went wrong; leaving the dialog open keeps their edits.
      error: () => this.saving.set(false),
    });
  }

  private statusLabel(status: string): string {
    return status === 'NotSent' ? 'Not sent — no phone or email' : status || '—';
  }

  private channelLabel(channel?: string | null): string {
    if (!channel) return '—';
    if (channel === 'viber') return 'via Viber';
    if (channel === 'email') return 'via email';
    return `via ${channel}`;
  }

  /**
   * This event's media bucket. Fetched here rather than linked blindly because an event that
   * predates buckets has no row until something asks for one — and asking is what creates it.
   */
  protected readonly bucket = signal<MediaBucket | null>(null);

  /** True once we know whether this event has a bucket, so the panel is not offered mid-flight. */
  protected readonly bucketKnown = signal(false);
  protected readonly addingBucket = signal(false);

  /** Gives this event a bucket. Reading the page deliberately does not — this is the host saying yes. */
  protected addBucket(): void {
    if (this.addingBucket()) return;
    this.addingBucket.set(true);
    this.api.createCampaignBucket(this.campaignId()).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.addingBucket.set(false);
      },
      error: () => this.addingBucket.set(false),
    });
  }

  ngOnInit(): void {
    this.watchRename();
    this.api.campaignBucket(this.campaignId()).subscribe({
      next: (bucket) => {
        this.bucket.set(bucket);
        this.bucketKnown.set(true);
      },
      // A host reaching a dashboard by the emailed possession link holds no account, so this 403s.
      // Nothing is offered in that case; the rest of the page does not depend on it.
      error: () => this.bucketKnown.set(false),
    });
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

  /**
   * Records the tab without a history entry — Back should leave the dashboard, not step through
   * tabs. Query params are MERGED, never replaced: the emailed dashboard link carries ?token= and
   * dropping it would lock a token-authed host out of their own campaign on the next reload.
   */
  /**
   * Saves the new name. Bound to the control's value stream rather than a button because
   * ui-editable-text commits when the host leaves the field — there is no submit to hang this on.
   */
  private watchRename(): void {
    this.titleControl.valueChanges
      .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => {
        const title = (value ?? '').trim();
        // Empty is a half-finished edit, not an instruction to erase the name.
        if (!title || title === this.report()?.title) return;

        this.renaming.set(true);
        this.api.renameCampaign(this.campaignId(), title).subscribe({
          next: () => {
            // Keep the heading in step without re-fetching the whole dashboard.
            this.report.update((r) => (r ? { ...r, title } : r));
            this.renaming.set(false);
          },
          error: () => this.renaming.set(false),
        });
      });
  }

  protected selectTab(tab: 'media' | 'dashboard'): void {
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab === 'dashboard' ? 'dashboard' : null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
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
        this.coverUrl.set(r.coverImageUrl ?? null);
        // emitEvent: false — seeding the field is not the host renaming it, and without this every
        // load would post the name straight back to the server.
        this.titleControl.setValue(r.title ?? '', { emitEvent: false });
        this.templatePreviewUrl.set(r.templatePreviewImageUrl ?? null);
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
          this.toast.info('That guest already exists — didn’t add a duplicate.');
        } else if (v.sendNow && !r.sent) {
          // sent=false otherwise covers two different reasons: the send was attempted and the
          // provider rejected it, or nothing was attempted at all (over paid capacity).
          const reason = r.needsTopUp
            ? 'you’re over your paid guest capacity — top up to send it.'
            : 'the invite failed to send — select them and resend once fixed.';
          this.toast.danger(`Guest added, but ${reason}`);
        } else if (v.sendNow && r.sent) {
          this.toast.success('Guest added and sent their invite.');
        } else if (!v.sendNow) {
          this.toast.success('Guest added. Select them and “Send to selected” when you’re ready to send.');
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
