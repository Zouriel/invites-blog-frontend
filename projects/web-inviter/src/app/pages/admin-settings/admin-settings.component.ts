import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSearchInput } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import {
  AdminPermission,
  AdminRole,
  AdminUser,
  AuditEntry,
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
    DatePipe, FormsModule, UiBadge, UiButton, UiCard, UiEmptyState, UiSearchInput, UiSpinner,
    UiTab, UiTabs, UiText,
  ],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.scss',
})
export class AdminSettingsComponent {
  private readonly api = inject(ApiService);

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
