import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSearchInput, UiSelect } from '@zouriel/ui/form';
import { UiDatePicker } from '@zouriel/ui/datepicker';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiSwitch } from '@zouriel/ui/form';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { PLAN_CATALOG, planLabel } from '../../shared/utils/plans';
import { AdminDesignersComponent } from '../admin-designers/admin-designers.component';
import {
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserEvent,
  AuditEntry,
  EventPassKind,
  SubscriptionTier,
  SuppressionEntry,
} from '../../shared/utils/types/api.types';

/** The tabs, in the order they read. First is spelled as the absence of the parameter. */
export const SETTINGS_TABS = ['users', 'designers', 'roles', 'permissions', 'audit', 'suppression'] as const;

/**
 * The platform's own settings: who has an account, who designs for it, what each role can do, what the system has been
 * doing, and who has opted out.
 *
 * Every tab loads on first open rather than up front — an admin usually comes here for one of them,
 * and the audit log is the expensive one.
 */
/** "30 Jun 2027", for dates an admin reads at a glance. */
function day(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

@Component({
  selector: 'app-admin-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, UiBadge, UiButton, UiCard, UiDatePicker, UiEmptyState, UiSearchInput, UiSelect,
    UiSpinner, UiSwitch, UiTab, UiTabs, UiText, AdminDesignersComponent,
  ],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
})
export class AdminSettingsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  /**
   * The roles an admin hands out here, in the order they read.
   *
   * <p>Deliberately not every role the platform has. Inviter, Invitee and Public say how a caller
   * ARRIVED rather than something an account holds, and the server refuses them — offering a switch
   * that always fails is worse than not offering one. Kept in step with `Roles.Grantable`.</p>
   */
  protected readonly grantable = ['Designer', 'Admin'] as const;

  protected readonly users = signal<AdminUser[]>([]);
  protected readonly roles = signal<AdminRole[]>([]);
  protected readonly permissions = signal<AdminPermission[]>([]);
  protected readonly audit = signal<AuditEntry[]>([]);
  protected readonly suppression = signal<SuppressionEntry[]>([]);

  protected readonly loading = signal<Record<string, boolean>>({});
  private readonly loaded = new Set<string>();

  protected userSearch = '';
  protected readonly userPage = signal(1);
  protected readonly userTotal = signal(0);
  protected readonly auditPage = signal(1);
  protected readonly auditTotal = signal(0);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly params = toSignal(this.route.queryParamMap, { initialValue: this.route.snapshot.queryParamMap });

  /** Which tab is open, read from `?tab=` like Administrative, so links and refreshes land on it. */
  protected readonly tab = computed(() => {
    const named = this.params().get('tab') as (typeof SETTINGS_TABS)[number] | null;
    const at = named ? SETTINGS_TABS.indexOf(named) : 0;
    return at < 0 ? 0 : at;
  });

  constructor() {
    // Whichever tab the URL opens on loads its data, whether it's the first or a linked one.
    effect(() => {
      const key = SETTINGS_TABS[this.tab()];
      untracked(() => this.open(key));
    });
  }

  protected onTabChange(index: number): void {
    const key = SETTINGS_TABS[index] ?? SETTINGS_TABS[0];
    void this.router.navigate([], {
      relativeTo: this.route,
      // The first tab is the absence of the parameter, so the plain URL is never a redirect.
      queryParams: { tab: index === 0 ? null : key },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** From the Designers tab: the Users tab, narrowed to that one account. */
  protected showUser(search: string): void {
    this.userSearch = search;
    this.userPlan.set('');
    this.loaded.add('users');
    this.loadUsers(1);
    this.onTabChange(0);
  }

  /** Loads a tab's data the first time it is opened, and never again unless asked. */
  protected open(tab: (typeof SETTINGS_TABS)[number]): void {
    if (this.loaded.has(tab)) return;
    this.loaded.add(tab);
    switch (tab) {
      case 'users':
        this.loadUsers();
        break;
      case 'roles':
        this.run('roles', this.api.adminRoles(), (list) => this.roles.set(list));
        break;
      case 'permissions':
        this.run('permissions', this.api.adminPermissions(), (list) => this.permissions.set(list));
        break;
      case 'audit':
        this.loadAudit();
        break;
      case 'designers':
        // Its panel loads its own data.
        break;
      case 'suppression':
        this.run('suppression', this.api.adminSuppression(1), (page) =>
          this.suppression.set(page.items),
        );
        break;
    }
  }

  protected loadUsers(page = 1): void {
    this.userPage.set(page);
    this.run('users', this.api.adminUsers(page, this.userSearch.trim(), 20, this.userPlan()), (result) => {
      this.users.set(result.items);
      this.syncRoleState(result.items);
      this.syncTierDrafts(result.items);
      this.userTotal.set(result.totalPages);
    });
  }

  protected loadAudit(page = 1): void {
    this.auditPage.set(page);
    this.run('audit', this.api.adminAudit(page), (result) => {
      this.audit.set(result.items);
      this.auditTotal.set(result.totalPages);
    });
  }

  protected isLoading(key: string): boolean {
    return !!this.loading()[key];
  }

  // ---------- roles ----------

  /** Which single switch is mid-flight, so one request cannot leave the whole list disabled. */
  protected readonly busyRole = signal<string | null>(null);

  /**
   * What each switch is showing, keyed `userId:role`.
   *
   * <p><b>Why the component owns this instead of reading the account.</b> A switch is a value
   * accessor with its own idea of whether it is on, and clicking flips that immediately. Bound
   * straight to `roles.includes(role)`, a refusal leaves nothing for Angular to push back — the
   * value was true before the click and is still true, so no change is detected and the switch sits
   * there showing a state the database never reached. Holding it here means the click writes it
   * false and the refusal writes it true again, which IS a change, and the switch follows.</p>
   */
  protected readonly roleState = signal<Record<string, boolean>>({});

  protected roleOn(userId: string, role: string): boolean {
    return !!this.roleState()[`${userId}:${role}`];
  }

  /** Re-reads every switch from the accounts as they now stand. */
  private syncRoleState(list: AdminUser[]): void {
    const next: Record<string, boolean> = {};
    for (const u of list)
      for (const r of this.grantable) next[`${u.id}:${r}`] = u.roles.includes(r);
    this.roleState.set(next);
  }

  protected roleBusy(userId: string, role: string): boolean {
    return this.busyRole() === `${userId}:${role}`;
  }

  /**
   * Grants or revokes one role, and takes the account the SERVER reports back rather than
   * assuming the toggle got its way.
   *
   * <p>That matters because several of these are refused: an admin cannot demote themselves or the
   * last remaining admin. On a refusal the row is rewritten from what we already hold, which snaps
   * the switch back to the truth instead of leaving it showing a change that never happened.</p>
   */
  protected setRole(user: AdminUser, role: string, granted: boolean): void {
    const key = `${user.id}:${role}`;
    if (this.busyRole()) return;

    const was = this.roleOn(user.id, role);
    // Follow the switch while the request is in flight, so the two never disagree on screen.
    this.roleState.update((m) => ({ ...m, [key]: granted }));
    this.busyRole.set(key);

    this.api.adminSetUserRole(user.id, role, granted).subscribe({
      next: (updated) => {
        this.users.update((list) => {
          const next = list.map((u) => (u.id === updated.id ? updated : u));
          this.syncRoleState(next);
          return next;
        });
        this.busyRole.set(null);
        this.toast.success(
          granted
            ? `${updated.displayName} is now ${this.article(role)} ${role}.`
            : `${updated.displayName} is no longer ${this.article(role)} ${role}.`,
        );
      },
      error: () => {
        // Back to what it was. This is a real change to the bound value, which is the whole reason
        // the state lives here — the interceptor has already said why it was refused.
        this.roleState.update((m) => ({ ...m, [key]: was }));
        this.busyRole.set(null);
      },
    });
  }

  private article(role: string): string {
    return /^[AEIOU]/i.test(role) ? 'an' : 'a';
  }

  // ---------- professional plans ----------

  protected readonly tierOptions = [
    { label: 'None (hosts pay per event)', value: 'None' },
    { label: 'Studio', value: 'Studio' },
    { label: 'Venue', value: 'Venue' },
  ];

  /** Today in Malé, so an end date can't be set in the past. */
  protected readonly today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

  /** What each account's plan controls show before they are saved. */
  protected readonly tierDrafts = signal<Record<string, { tier: SubscriptionTier; endsAt: string }>>({});
  protected readonly savingTier = signal<string | null>(null);

  private syncTierDrafts(list: AdminUser[]): void {
    this.tierDrafts.update((drafts) => {
      const next = { ...drafts };
      for (const u of list) next[u.id] = this.stored(u);
      return next;
    });
  }

  /** The plan as saved: an ended one shows as none. */
  private stored(u: AdminUser): { tier: SubscriptionTier; endsAt: string } {
    const active = u.subscriptionActive && u.subscriptionTier !== 'None';
    return {
      tier: active ? u.subscriptionTier : 'None',
      endsAt: active && u.subscriptionEndsAt ? u.subscriptionEndsAt.slice(0, 10) : '',
    };
  }

  protected draft(u: AdminUser): { tier: SubscriptionTier; endsAt: string } {
    return this.tierDrafts()[u.id] ?? this.stored(u);
  }

  protected setDraft(u: AdminUser, change: Partial<{ tier: SubscriptionTier; endsAt: string }>): void {
    this.tierDrafts.update((d) => ({ ...d, [u.id]: { ...this.draft(u), ...change } }));
  }

  protected tierChanged(u: AdminUser): boolean {
    const d = this.draft(u);
    const s = this.stored(u);
    return d.tier !== s.tier || (d.tier !== 'None' && (d.endsAt ?? '') !== s.endsAt);
  }

  protected tierStatus(u: AdminUser): string {
    if (u.subscriptionActive && u.subscriptionTier !== 'None') {
      return u.subscriptionEndsAt ? `Active until ${day(u.subscriptionEndsAt)}` : 'Active, no end date';
    }
    return u.subscriptionEndsAt ? `Ended ${day(u.subscriptionEndsAt)}` : 'No professional plan';
  }

  /** Which accounts the list shows: everyone, or only those on a professional plan or holding passes. */
  protected readonly userPlan = signal('');
  protected readonly planFilters = [
    { label: 'Everyone', value: '' },
    { label: 'Studio', value: 'Studio' },
    { label: 'Venue', value: 'Venue' },
    { label: 'Holding passes', value: 'Passes' },
  ];

  protected setUserPlan(plan: string): void {
    this.userPlan.set(plan ?? '');
    this.loadUsers(1);
  }

  /** "2 Party · 1 Wedding": the passes a Studio still holds, by kind. */
  protected creditLine(u: AdminUser): string {
    return [
      u.partyCredits ? `${u.partyCredits} Party` : null,
      u.weddingCredits ? `${u.weddingCredits} Wedding` : null,
    ].filter(Boolean).join(' · ');
  }

  /** How many of the chosen kind this account holds, so "Take one back" knows when there's none. */
  protected heldOf(u: AdminUser): number {
    return this.creditKind() === 'Party' ? u.partyCredits : u.weddingCredits;
  }

  protected saveTier(u: AdminUser): void {
    if (this.savingTier()) return;
    const d = this.draft(u);
    this.savingTier.set(u.id);
    // End of that day in Malé, so "until 30 June" includes the 30th.
    const endsAt = d.tier !== 'None' && d.endsAt ? `${d.endsAt}T23:59:59+05:00` : null;
    this.api.adminSetSubscription(u.id, d.tier, endsAt).subscribe({
      next: (updated) => {
        this.replaceUser(updated);
        this.syncTierDrafts([updated]);
        this.savingTier.set(null);
        this.toast.success(
          d.tier === 'None'
            ? `${updated.displayName} has no professional plan.`
            : `${updated.displayName} is on ${d.tier}.`,
        );
      },
      error: () => this.savingTier.set(null),
    });
  }

  private replaceUser(updated: AdminUser): void {
    this.users.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
  }

  // ---------- Studio passes ----------

  protected readonly creditKinds = [
    { label: 'Wedding pass', value: 'Wedding' },
    { label: 'Party pass', value: 'Party' },
  ];
  protected readonly creditKind = signal<'Party' | 'Wedding'>('Wedding');
  protected readonly busyCredits = signal<string | null>(null);

  protected adjustCredits(u: AdminUser, count: number): void {
    if (this.busyCredits()) return;
    const kind = this.creditKind();
    this.busyCredits.set(u.id);
    this.api.adminAdjustPassCredits(u.id, kind, count).subscribe({
      next: (updated) => {
        this.replaceUser(updated);
        this.busyCredits.set(null);
        this.toast.success(count > 0 ? `Gave ${updated.displayName} a ${kind} pass.` : `Took back a ${kind} pass.`);
      },
      error: () => this.busyCredits.set(null),
    });
  }

  // ---------- event passes and "Keep your photos" ----------

  protected readonly passKinds = [
    { label: 'No pass', value: 'None' },
    { label: 'Party pass', value: 'Party' },
    { label: 'Wedding pass', value: 'Wedding' },
  ];

  protected readonly eventsOpen = signal<string | null>(null);
  protected readonly events = signal<Record<string, AdminUserEvent[] | null>>({});
  protected readonly busyPass = signal<string | null>(null);

  protected toggleEvents(u: AdminUser): void {
    if (this.eventsOpen() === u.id) {
      this.eventsOpen.set(null);
      return;
    }
    this.eventsOpen.set(u.id);
    this.events.update((e) => ({ ...e, [u.id]: null }));
    this.api.adminUserEvents(u.id).subscribe({
      next: (list) => this.events.update((e) => ({ ...e, [u.id]: list })),
      error: () => this.events.update((e) => ({ ...e, [u.id]: [] })),
    });
  }

  private replaceEvent(userId: string, updated: AdminUserEvent): void {
    this.events.update((e) => ({ ...e, [userId]: (e[userId] ?? []).map((x) => (x.id === updated.id ? updated : x)) }));
  }

  /** Gives the event a pass, or takes it away. The same pass again adds a year. */
  protected setPass(userId: string, event: AdminUserEvent, kind: EventPassKind): void {
    if (this.busyPass()) return;
    this.busyPass.set(event.id);
    this.api.adminSetEventPass(event.id, kind).subscribe({
      next: (updated) => {
        this.replaceEvent(userId, updated);
        this.busyPass.set(null);
        this.toast.success(
          kind === 'None'
            ? `The pass on ${updated.title} was removed.`
            : `${updated.title} has a ${updated.pass} pass until ${updated.eventPassUntil?.slice(0, 10)}.`,
        );
      },
      error: () => {
        // Put the picker back from what we already hold.
        this.events.update((e) => ({ ...e, [userId]: [...(e[userId] ?? [])] }));
        this.busyPass.set(null);
      },
    });
  }

  /** "Keep your photos" for another year, or 0 to stop. */
  protected keepPhotos(userId: string, event: AdminUserEvent, years: number): void {
    if (this.busyPass()) return;
    this.busyPass.set(event.id);
    this.api.adminKeepPhotos(event.id, years).subscribe({
      next: (updated) => {
        this.replaceEvent(userId, updated);
        this.busyPass.set(null);
        this.toast.success(
          updated.keepPhotosUntil
            ? `${updated.title}'s photos are kept until ${updated.keepPhotosUntil.slice(0, 10)}.`
            : `${updated.title}'s photos are no longer kept past their plan.`,
        );
      },
      error: () => this.busyPass.set(null),
    });
  }

  /** Adds a block of emailed invitations to the event, on top of what its plan includes. */
  protected addSending(userId: string, event: AdminUserEvent): void {
    if (this.busyPass()) return;
    this.busyPass.set(event.id);
    const block = PLAN_CATALOG.sending.blockSize;
    this.api.adminAddSending(event.id, block).subscribe({
      next: (updated) => {
        this.replaceEvent(userId, updated);
        this.busyPass.set(null);
        this.toast.success(`${updated.title} can email ${block} more guests.`);
      },
      error: () => this.busyPass.set(null),
    });
  }

  protected readonly planLabel = planLabel;
  protected readonly sendingBlock = PLAN_CATALOG.sending.blockSize;
  protected readonly phaseLabels: Record<string, string> = {
    UploadsClosed: 'uploads closed',
    OrganiserOnly: 'organiser only',
    Deleted: 'photos removed',
  };

  /** Permissions read better grouped the way they are named. */
  protected groupsOf(list: AdminPermission[]): { name: string; items: AdminPermission[] }[] {
    const by = new Map<string, AdminPermission[]>();
    for (const p of list) {
      const group = p.group || 'other';
      by.set(group, [...(by.get(group) ?? []), p]);
    }
    return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, items]) => ({ name, items }));
  }

  /** The audit payload is stored as JSON; show it readably rather than as one long line. */
  protected pretty(json: string): string {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  }

  /** One place to flip the per-tab spinner, whichever way the request ends. */
  private run<T>(key: string, source: Observable<T>, apply: (value: T) => void): void {
    this.loading.update((state) => ({ ...state, [key]: true }));
    source.subscribe({
      next: (value) => {
        apply(value);
        this.loading.update((state) => ({ ...state, [key]: false }));
      },
      error: () => this.loading.update((state) => ({ ...state, [key]: false })),
    });
  }
}
