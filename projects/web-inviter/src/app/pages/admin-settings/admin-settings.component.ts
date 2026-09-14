import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
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
import {
  AdminPermission,
  AdminRole,
  AdminUser,
  AdminUserEvent,
  AuditEntry,
  SubscriptionTier,
  SuppressionEntry,
} from '../../shared/utils/types/api.types';

/**
 * The platform's own settings: who has an account, what each role can do, what the system has been
 * doing, and who has opted out.
 *
 * Every tab loads on first open rather than up front — an admin usually comes here for one of them,
 * and the audit log is the expensive one.
 */
@Component({
  selector: 'app-admin-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, UiBadge, UiButton, UiCard, UiDatePicker, UiEmptyState, UiSearchInput, UiSelect,
    UiSpinner, UiSwitch, UiTab, UiTabs, UiText,
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

  constructor() {
    this.loaded.add('users');
    this.loadUsers();
  }

  /** Tab order, so a tab change can say which data to fetch. */
  private static readonly Tabs = ['users', 'roles', 'permissions', 'audit', 'suppression'] as const;

  protected openIndex(index: number): void {
    const tab = AdminSettingsComponent.Tabs[index];
    if (tab) this.open(tab);
  }

  /** Loads a tab's data the first time it is opened, and never again unless asked. */
  protected open(tab: (typeof AdminSettingsComponent.Tabs)[number]): void {
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
      case 'suppression':
        this.run('suppression', this.api.adminSuppression(1), (page) =>
          this.suppression.set(page.items),
        );
        break;
    }
  }

  protected loadUsers(page = 1): void {
    this.userPage.set(page);
    this.run('users', this.api.adminUsers(page, this.userSearch.trim()), (result) => {
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

  // ---------- subscriptions ----------

  protected readonly tierOptions = [
    { label: 'Free (no subscription)', value: 'None' },
    { label: 'Basic', value: 'Basic' },
    { label: 'Premium', value: 'Premium' },
  ];

  /** Today in Malé, so an end date can't be set in the past. */
  protected readonly today = new Date(Date.now() + 5 * 3600_000).toISOString().slice(0, 10);

  /** What each account's subscription controls show before they are saved. */
  protected readonly tierDrafts = signal<Record<string, { tier: SubscriptionTier; endsAt: string }>>({});
  protected readonly savingTier = signal<string | null>(null);

  private syncTierDrafts(list: AdminUser[]): void {
    this.tierDrafts.update((drafts) => {
      const next = { ...drafts };
      for (const u of list) next[u.id] = this.stored(u);
      return next;
    });
  }

  /** The subscription as saved: an ended one shows as free. */
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
      return u.subscriptionEndsAt ? `Active until ${u.subscriptionEndsAt.slice(0, 10)}` : 'Active, no end date';
    }
    return u.subscriptionEndsAt ? `Ended ${u.subscriptionEndsAt.slice(0, 10)}` : 'No subscription';
  }

  protected saveTier(u: AdminUser): void {
    if (this.savingTier()) return;
    const d = this.draft(u);
    this.savingTier.set(u.id);
    // End of that day in Malé, so "until 30 June" includes the 30th.
    const endsAt = d.tier !== 'None' && d.endsAt ? `${d.endsAt}T23:59:59+05:00` : null;
    this.api.adminSetSubscription(u.id, d.tier, endsAt).subscribe({
      next: (updated) => {
        this.users.update((list) => list.map((x) => (x.id === updated.id ? updated : x)));
        this.syncTierDrafts([updated]);
        this.savingTier.set(null);
        this.toast.success(
          d.tier === 'None'
            ? `${updated.displayName} is on the free plan.`
            : `${updated.displayName} is on ${d.tier}.`,
        );
      },
      error: () => this.savingTier.set(null),
    });
  }

  // ---------- event passes ----------

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

  protected setPass(userId: string, event: AdminUserEvent, granted: boolean): void {
    if (this.busyPass()) return;
    this.busyPass.set(event.id);
    this.api.adminSetEventPass(event.id, granted).subscribe({
      next: (updated) => {
        this.events.update((e) => ({
          ...e,
          [userId]: (e[userId] ?? []).map((x) => (x.id === updated.id ? updated : x)),
        }));
        this.busyPass.set(null);
        this.toast.success(
          granted
            ? `${updated.title} has an event pass until ${updated.eventPassUntil?.slice(0, 10)}.`
            : `The event pass on ${updated.title} was removed.`,
        );
      },
      error: () => {
        // Put the switch back from what we already hold.
        this.events.update((e) => ({ ...e, [userId]: [...(e[userId] ?? [])] }));
        this.busyPass.set(null);
      },
    });
  }

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
