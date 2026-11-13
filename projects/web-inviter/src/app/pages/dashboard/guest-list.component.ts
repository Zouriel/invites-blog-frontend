import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { localDate, viewerLocale } from '../../shared/utils/event-time';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';
import { UiCard } from '@zouriel/ui/card';
import { UiCheckbox } from '@zouriel/ui/form';
import { UiCell, UiColumn, UiRowAction, UiTable } from '@zouriel/ui/table';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiContactChannels, UiEmailStatus, UiMessengerChannel, UiMessengerSwitch } from '@zouriel/ui/messenger';
import { ApiService } from '../../shared/api/api.service';
import { DashboardGuest, DashboardReport } from '../../shared/utils/types/api.types';
import {
  MESSENGER_NAMES,
  MessengerApp,
  emailDone,
  lastMessenger,
  messengerUrl,
  nextUnsent,
  rememberMessenger,
} from '../../shared/utils/messenger-links';
import { formatPhone } from '../../shared/utils/phone';

/** Below this width (the list's own, not the window's) every guest is a card instead of a table row. */
export const CARD_BREAKPOINT = 700;

/** From this many reply questions the table's Send column goes compact. */
export const CROWDED_QUESTIONS = 3;

type Sends = Partial<Record<MessengerApp, string>>;

/**
 * The event's guest list, and how each guest is reached.
 *
 * <p>Invitations go automatically by EMAIL only. A guest with a number is sent their invitation by the
 * host, by hand, from the host's own WhatsApp, Viber or Telegram: each button opens that app with the
 * host's message and the guest's own link typed in, and records that it was opened ("Opened in
 * WhatsApp · 3:14 pm") so every device shows the tick. We can't know whether the host then pressed
 * send in the app, so the tick says "opened", and each button stays usable.</p>
 *
 * <p>Desktop: a table with one "Send" column (ui-contact-channels in a uiCell). Narrow (the list
 * under 700px wide): a card per guest with the same block, so three app buttons fit a 360px phone.</p>
 */
@Component({
  selector: 'app-guest-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiBadge, UiCard, UiCheckbox, UiTable, UiCell, UiContactChannels, UiMessengerSwitch],
  templateUrl: './guest-list.component.html',
  styleUrl: './guest-list.component.scss',
})
export class GuestListComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly report = input.required<DashboardReport>();
  readonly campaignId = input.required<string>();
  /** The emailed dashboard link's token, when the host came that way. */
  readonly token = input<string | null>(null);
  readonly canManage = input(false);
  readonly isCelebrant = input(false);
  /** The event's photo window has ended: no links are sent or handed out any more (409 window_closed). */
  readonly linksClosed = input(false);

  readonly edit = output<DashboardGuest>();
  readonly remove = output<DashboardGuest>();
  readonly selectionChange = output<DashboardGuest[]>();
  /** Something changed on the server (an email went out): the dashboard re-reads itself. */
  readonly changed = output<void>();

  protected readonly guests = computed(() => this.report().guests);
  protected readonly saveTheDate = computed(() => this.report().kind === 'saveTheDate');
  /** A photos-only event has nothing to send. */
  protected readonly canSend = computed(
    () =>
      this.canManage() && !this.isCelebrant() && this.report().hasInvitation !== false && !this.report().isDraft
      && !this.linksClosed(),
  );

  /** The list's width decides cards or table; measured, so it follows the column, not the window. */
  protected readonly narrow = signal(false);

  /** What this page recorded since it loaded, over each guest's manualSends. */
  private readonly sentHere = signal<Record<string, Sends>>({});
  /** Links and messages made by manual-send for guests who had no invite when the page loaded. */
  private readonly sharesHere = signal<Record<string, { link: string; text: string }>>({});
  /** Guests whose email is being sent right now. */
  protected readonly emailing = signal<ReadonlySet<string>>(new Set());
  /** Guests whose manual-send is waiting for its link (no invite yet). */
  private readonly preparing = signal<ReadonlySet<string>>(new Set());

  /**
   * The channel the "Send next" switch is on: the host's last-used app, remembered on this browser.
   * Swiping the switch (or its arrows and dots) changes it; so does using an app's button on a guest.
   */
  protected readonly nextApp = signal<MessengerApp>(lastMessenger());
  protected readonly nextAppName = computed(() => MESSENGER_NAMES[this.nextApp()]);

  /**
   * One "Send next" control rather than one button per app: a host works down the list in ONE app,
   * and three buttons that each skip different people would make "who's left" a different answer per
   * button. It is a channel switch (ui-messenger-switch): swipe it to WhatsApp, Viber or Telegram, and
   * pressing it opens the next guest not yet sent on THAT channel.
   */
  protected readonly nextGuest = computed(() =>
    this.canSend() ? nextUnsent(this.guests(), this.nextApp(), this.sentHere()) : null,
  );
  protected readonly anyPhone = computed(() => this.guests().some((g) => !!g.phone));

  /** What the switch says under its label. */
  protected readonly nextSublabel = computed(() => {
    const n = this.nextGuest();
    return n ? `Next: ${n.name}` : `Everyone with a number has been sent on ${this.nextAppName()}`;
  });

  /** The switch moved to another channel: remembered for next time. */
  protected setNextApp(app: MessengerApp): void {
    this.nextApp.set(app);
    rememberMessenger(app);
  }

  /** The switch was pressed: the next guest not yet sent on its channel. */
  protected sendNext(app: MessengerApp): void {
    const g = nextUnsent(this.guests(), app, this.sentHere());
    if (g) this.send(g, app);
  }

  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const measure = (w: number) => this.narrow.set(w > 0 && w < CARD_BREAKPOINT);
      measure(el.getBoundingClientRect().width);
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver((entries) => measure(entries[0]?.contentRect.width ?? 0));
      ro.observe(el);
      destroyRef.onDestroy(() => ro.disconnect());
    });
  }

  // ---------- the table ----------

  /**
   * Guest, Send (the contact block), Roles, Status, RSVP and one column per RSVP question. A read-only
   * celebrant is never sent contacts, so they get no Send column.
   */
  protected readonly columns = computed<UiColumn<DashboardGuest>[]>(() => [
    // A name keeps at least 9rem and the short labels stay on one line, so a list with several reply
    // questions squeezes the answer columns rather than breaking names one word per line (UI audit 2026-11-13).
    { key: 'name', header: 'Guest', format: (_v, row) => this.nameLabel(row), minWidth: '9rem' },
    ...(this.isCelebrant() ? [] : [{ key: 'send', header: 'Send' } as UiColumn<DashboardGuest>]),
    // Shown because it is editable and because it is the field most likely to be wrong: a
    // role-aware template personalises on it.
    { key: 'roles', header: 'Roles', format: (_v, row) => (row.roles?.length ? row.roles.join(', ') : '—') },
    { key: 'status', header: 'Status', format: (_v, row) => this.statusLabel(row), nowrap: true },
    // A save the date asks nothing, so it has no replies to show.
    ...(this.saveTheDate() ? [] : [{ key: 'rsvp', header: 'RSVP', format: (v: unknown) => this.rsvpLabel(v as string), nowrap: true }]),
    ...(this.saveTheDate() ? [] : this.report().rsvpQuestions ?? []).map((q) => ({
      key: `answer:${q.key}`,
      header: q.label,
      format: (_v: unknown, row: DashboardGuest) => row.rsvpAnswers?.[q.key] || '—',
    })),
  ]);

  /**
   * Several reply questions leave the Send column less room: it takes the phone card's one-line-per-contact layout
   * (icon, value, buttons), narrower than the labelled columns, so the table fits a 1440 screen without scrolling
   * sideways (UI audit 2026-11-13: four questions ran ~50px past it).
   */
  protected readonly crowded = computed(() => !this.saveTheDate() && (this.report().rsvpQuestions?.length ?? 0) >= CROWDED_QUESTIONS);

  protected readonly rowActions = computed<UiRowAction<DashboardGuest>[]>(() =>
    this.canManage()
      ? [
          { label: 'Edit', run: (row) => this.edit.emit(row), ariaLabel: (row) => `Edit ${row.name}` },
          ...(this.anySelfAdded()
            ? [{
                label: 'Remove',
                run: (row: DashboardGuest) => this.remove.emit(row),
                disabled: (row: DashboardGuest) => !row.selfAdded,
                ariaLabel: (row: DashboardGuest) => `Remove ${row.name}`,
              }]
            : []),
        ]
      : [],
  );

  protected readonly anySelfAdded = computed(() => this.guests().some((g) => g.selfAdded));

  protected onTableSelection(rows: DashboardGuest[]): void {
    this.selectedIds.set(new Set(rows.map((r) => r.id)));
    this.selectionChange.emit(rows);
  }

  // ---------- the cards ----------

  protected isSelected(g: DashboardGuest): boolean {
    return this.selectedIds().has(g.id);
  }

  protected toggle(g: DashboardGuest, on: boolean): void {
    const next = new Set(this.selectedIds());
    if (on) next.add(g.id);
    else next.delete(g.id);
    this.selectedIds.set(next);
    this.selectionChange.emit(this.guests().filter((x) => next.has(x.id)));
  }

  // ---------- what each guest shows ----------

  /**
   * The name as the list shows it. Someone who added themselves is marked, and so is a second person
   * with a name already on the list: the same person replying twice is the likeliest mistake an open
   * list collects.
   */
  protected nameLabel(row: DashboardGuest): string {
    if (!row.selfAdded) return row.name;
    const key = row.name.trim().toLowerCase();
    const twin = this.guests().some((g) => g !== row && g.name.trim().toLowerCase() === key);
    return `${row.name} · replied from link${twin ? ' · same name as another guest' : ''}`;
  }

  protected statusLabel(row: DashboardGuest): string {
    const s = row.status ?? '';
    const label =
      s === 'Viewed' ? 'Opened'
      : s === 'Sent' ? 'Sent'
      : s === 'Failed' ? 'Not delivered'
      : s === 'Cancelled' ? 'Cancelled'
      : s === 'NotSent' && !row.email && !row.phone ? 'No email or number'
      : 'Not sent yet';
    // The automatic Viber sender is gone; old events keep their rows, named for what they were.
    return row.deliveryChannel === 'viber' ? `${label} · Viber (old)` : label;
  }

  protected statusTone(row: DashboardGuest): 'success' | 'danger' | 'neutral' | 'warning' | 'primary' {
    const s = row.status ?? '';
    if (s === 'Viewed') return 'success';
    if (s === 'Sent') return 'primary';
    if (s === 'Failed') return 'danger';
    if (s === 'NotSent' && !row.email && !row.phone) return 'warning';
    return 'neutral';
  }

  protected rsvpLabel(v: string | null | undefined): string {
    switch (v) {
      case 'Going': return 'Going';
      case 'Maybe': return 'Maybe';
      case 'NotGoing': return 'Not going';
      case 'ViewedOnly': return 'Seen, no reply';
      case 'NoResponse': case '': case null: case undefined: return 'No reply yet';
      default: return v;
    }
  }

  protected rsvpTone(v: string | null | undefined): 'success' | 'danger' | 'neutral' | 'warning' {
    return v === 'Going' ? 'success' : v === 'NotGoing' ? 'danger' : v === 'Maybe' ? 'warning' : 'neutral';
  }

  protected answers(g: DashboardGuest): { label: string; value: string }[] {
    if (this.saveTheDate()) return [];
    return (this.report().rsvpQuestions ?? [])
      .map((q) => ({ label: q.label, value: g.rsvpAnswers?.[q.key] ?? '' }))
      .filter((a) => !!a.value);
  }

  protected phoneText(g: DashboardGuest): string {
    return formatPhone(g.phone);
  }

  protected emailStatus(g: DashboardGuest): UiEmailStatus {
    switch ((g.emailStatus ?? '').toLowerCase()) {
      case 'sent': return 'sent';
      case 'delivered': return 'delivered';
      case 'failed': return 'failed';
      case 'bounced': return 'bounced';
      case 'skipped': return 'skipped';
      default: return 'none';
    }
  }

  /** Spinning while we send it, and while the provider still has it queued (Pending). */
  protected emailBusy(g: DashboardGuest): boolean {
    return this.emailing().has(g.id) || (g.emailStatus ?? '').toLowerCase() === 'pending';
  }

  protected emailTick(g: DashboardGuest): string | undefined {
    return emailDone(g.emailStatus) && g.emailAt ? `Emailed ${whenText(g.emailAt)}` : undefined;
  }

  protected sends(g: DashboardGuest): Sends {
    return { ...(g.manualSends ?? {}), ...(this.sentHere()[g.id] ?? {}) };
  }

  protected messengers(g: DashboardGuest): UiMessengerChannel[] {
    if (!this.canSend()) return [];
    const sends = this.sends(g);
    return (['whatsapp', 'viber', 'telegram'] as const).map((app) => ({
      app,
      ticked: !!sends[app],
      tickLabel: sends[app] ? `Opened in ${MESSENGER_NAMES[app]} · ${whenText(sends[app]!)}` : undefined,
      ariaLabel: `Send to ${g.name} on ${MESSENGER_NAMES[app]}`,
    }));
  }

  // ---------- sending ----------

  /**
   * Opens the host's app with the message, then records it. The app is opened inside the tap itself
   * (window.open / location in the click handler, with the link the dashboard already has), because
   * a browser blocks a window opened after waiting for a server reply. A guest with no invite yet has
   * no link: a blank window is opened in the tap and pointed at the app once manual-send has made one.
   */
  protected send(g: DashboardGuest, app: MessengerApp): void {
    const phone = g.phone;
    if (!phone || !this.canSend() || this.preparing().has(g.id)) return;
    this.setNextApp(app);

    // Viber and Telegram can't open a chat by number with the text in it, so the number goes on the
    // clipboard to paste into the app's search. Started inside the tap: clipboard access needs it.
    if (app !== 'whatsapp') this.copyNumber(g, app);

    const share = g.shareText && g.shareLink ? { text: g.shareText, link: g.shareLink } : this.sharesHere()[g.id];
    if (share) {
      this.open(app, messengerUrl(app, phone, share.text, share.link));
      this.record(g, app);
      return;
    }

    const win = app === 'viber' ? null : window.open('', '_blank');
    this.setPreparing(g.id, true);
    this.api.manualSend(this.campaignId(), g.id, app, this.token() ?? undefined).subscribe({
      next: (r) => {
        this.setPreparing(g.id, false);
        this.sharesHere.update((all) => ({ ...all, [g.id]: { link: r.link, text: r.text } }));
        const url = messengerUrl(app, phone, r.text, r.link);
        if (win) {
          win.opener = null;
          win.location.href = url;
        } else {
          this.open(app, url);
        }
        this.markSent(g.id, app, r.sentAt);
      },
      error: () => {
        this.setPreparing(g.id, false);
        win?.close();
      },
    });
  }

  private open(app: MessengerApp, url: string): void {
    if (app === 'viber') {
      // A custom scheme: the phone hands it to the Viber app. A new tab would stay blank behind it.
      window.location.href = url;
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  private record(g: DashboardGuest, app: MessengerApp): void {
    // Ticked now, with the server's time once it answers; a failure takes the tick back off.
    const optimistic = new Date().toISOString();
    this.markSent(g.id, app, optimistic);
    this.api.manualSend(this.campaignId(), g.id, app, this.token() ?? undefined).subscribe({
      next: (r) => this.markSent(g.id, app, r.sentAt),
      error: () =>
        this.sentHere.update((all) => {
          const mine = { ...(all[g.id] ?? {}) };
          if (mine[app] === optimistic) delete mine[app];
          return { ...all, [g.id]: mine };
        }),
    });
  }

  private markSent(id: string, app: MessengerApp, at: string): void {
    this.sentHere.update((all) => ({ ...all, [id]: { ...(all[id] ?? {}), [app]: at } }));
  }

  private setPreparing(id: string, on: boolean): void {
    const next = new Set(this.preparing());
    if (on) next.add(id);
    else next.delete(id);
    this.preparing.set(next);
  }

  private copyNumber(g: DashboardGuest, app: MessengerApp): void {
    const note = `Number copied. Pick ${g.name} in ${MESSENGER_NAMES[app]}.`;
    const clip = typeof navigator === 'undefined' ? undefined : navigator.clipboard;
    if (!clip?.writeText) {
      this.toast.info(`Pick ${g.name} (${formatPhone(g.phone)}) in ${MESSENGER_NAMES[app]}.`);
      return;
    }
    void clip.writeText(g.phone!).then(
      () => this.toast.success(note),
      () => this.toast.info(`Pick ${g.name} (${formatPhone(g.phone)}) in ${MESSENGER_NAMES[app]}.`),
    );
  }

  /** Send or Retry on the Email row: the same per-guest resend the "Send to selected" button uses. */
  protected sendEmail(g: DashboardGuest): void {
    if (!this.canSend() || this.emailing().has(g.id)) return;
    this.emailing.set(new Set(this.emailing()).add(g.id));
    const done = () => {
      const next = new Set(this.emailing());
      next.delete(g.id);
      this.emailing.set(next);
      this.changed.emit();
    };
    this.api.resendGuest(this.campaignId(), g.id, this.token() ?? undefined).subscribe({
      next: (r) => {
        if (r.sent) this.toast.success(`Emailed ${g.name} their invitation.`);
        else this.toast.danger(`The email to ${g.name} didn't send. Check the address.`);
        done();
      },
      error: done,
    });
  }
}

/** "3:14 pm" today, "4 Nov, 3:14 pm" another day, on the viewer's clock and in their locale. */
export function whenText(iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  const time = localDate(at, 'time');
  if (at.toDateString() === now.toDateString()) return time;
  const day = new Intl.DateTimeFormat(viewerLocale(), {
    day: 'numeric',
    month: 'short',
    ...(at.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(at);
  return `${day}, ${time}`;
}
