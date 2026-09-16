import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiCheckbox, UiFormField, UiInput, UiSearchInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { AdminFeature, ApiService, FeatureTester } from '../../shared/api/api.service';
import { FeatureStore } from '../../shared/services/feature.store';

/**
 * Who can try features before they're released. Add a person by email — they don't need an account
 * yet; it applies when they sign in with that address — and switch on the features they should see.
 * Releasing a feature opens it to everyone and makes the list irrelevant for it.
 */
@Component({
  selector: 'app-admin-testers',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, UiBadge, UiButton, UiIconButton, UiCard, UiConfirmDialog, UiEmptyState, UiCheckbox,
    UiFormField, UiInput, UiSearchInput, UiSwitch, UiSpinner, UiText,
  ],
  template: `
    <section class="features">
      <ui-text variant="h3">Features in testing</ui-text>
      <div class="feature-list">
        @for (f of features(); track f.key) {
          <ui-card padding="md">
           <div class="feature">
            <div class="feature-head">
              <strong>{{ f.name }}</strong>
              @if (f.released) { <ui-badge tone="success">Released to everyone</ui-badge> }
              @else { <ui-badge tone="warning">Testers only</ui-badge> }
              <ui-badge>{{ f.testers }} tester{{ f.testers === 1 ? '' : 's' }}</ui-badge>
            </div>
            <p class="muted">{{ f.description }}</p>
            <label class="release">
              <ui-switch [ngModel]="f.released" (ngModelChange)="askRelease(f, $event)" />
              Release to everyone
            </label>
           </div>
          </ui-card>
        }
      </div>
    </section>

    <section class="add">
      <ui-text variant="h3">Add a tester</ui-text>
      <form class="add-form" (ngSubmit)="add()">
        <ui-form-field label="Email" hint="Applies when they sign in with this address — they don't need an account yet.">
          <ui-input type="email" name="email" [(ngModel)]="email" placeholder="person@example.com" autocomplete="off" />
        </ui-form-field>
        <ui-form-field label="Note" hint="Optional — who they are, why they're testing.">
          <ui-input name="note" [(ngModel)]="note" placeholder="e.g. Wedding planner, early feedback" />
        </ui-form-field>
        <div class="checks" role="group" aria-label="Features to turn on">
          @for (f of features(); track f.key) {
            <label><ui-checkbox [ngModel]="newFeatures().has(f.key)" [ngModelOptions]="{ standalone: true }" (ngModelChange)="toggleNew(f.key)" /> {{ f.name }}</label>
          }
        </div>
        <ui-button type="submit" variant="primary" [loading]="adding()" [disabled]="!email.trim() || newFeatures().size === 0">Add tester</ui-button>
      </form>
    </section>

    <section class="list">
      <div class="list-head">
        <ui-text variant="h3">Testers</ui-text>
        <ui-form-field class="search"><ui-search-input [(ngModel)]="search" placeholder="Search by email or note" /></ui-form-field>
      </div>
      @if (loading()) {
        <div class="centered"><ui-spinner /></div>
      } @else if (!filtered().length) {
        <ui-empty-state [heading]="search ? 'No testers match' : 'No testers yet'" description="Add someone above to let them try a feature before it's released." />
      } @else {
        <ui-card padding="sm">
          <div class="scroll">
            <table class="tbl">
              <thead>
                <tr><th>Email</th><th>Features</th><th>Note</th><th>Added</th><th></th></tr>
              </thead>
              <tbody>
                @for (t of filtered(); track t.id) {
                  <tr>
                    <td>
                      <span class="email">{{ t.email }}</span>
                      @if (!t.hasAccount) { <ui-badge tone="neutral">No account yet</ui-badge> }
                    </td>
                    <td>
                      <div class="checks">
                        @for (f of features(); track f.key) {
                          <label><ui-checkbox [ngModel]="t.features.includes(f.key)" (ngModelChange)="toggleFeature(t, f.key)" /> {{ f.name }}</label>
                        }
                      </div>
                    </td>
                    <td class="muted">{{ t.note }}</td>
                    <td class="muted nowrap">{{ t.createdAt | date: 'mediumDate' }}</td>
                    <td class="actions"><ui-icon-button size="sm" label="Remove tester" (click)="pendingRemove.set(t)">×</ui-icon-button></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </ui-card>
      }
    </section>

    <ui-confirm-dialog [open]="!!pendingRemove()" (openChange)="!$event && pendingRemove.set(null)" title="Remove this tester?"
      [message]="(pendingRemove()?.email ?? '') + ' will lose access to every feature still in testing. Anything they already made keeps working.'"
      confirmLabel="Remove" [destructive]="true" (confirm)="remove()" />

    <ui-confirm-dialog [open]="!!pendingRelease()" (openChange)="!$event && pendingRelease.set(null)"
      [title]="pendingRelease()?.released ? 'Release to everyone?' : 'Back to testers only?'"
      [message]="pendingRelease()?.released
        ? (pendingRelease()?.name + ' becomes available to every signed-in account right away.')
        : (pendingRelease()?.name + ' will be limited to the testers list again. People who used it keep what they made.')"
      [confirmLabel]="pendingRelease()?.released ? 'Release' : 'Limit to testers'" (confirm)="release()" />
  `,
  styles: `
    :host { display: grid; grid-template-columns: minmax(0, 1fr); gap: 28px; padding: 16px 0 40px; }
    :host > * { min-width: 0; }
    .muted { color: var(--ui-color-text-muted); }
    .nowrap { white-space: nowrap; }
    .feature-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 12px; margin-top: 10px; }
    .feature { display: grid; gap: 8px; }
    .feature-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .feature p { margin: 0; font-size: var(--ui-font-size-sm); }
    .release { display: flex; align-items: center; gap: 8px; font-size: var(--ui-font-size-sm); }
    .add-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(240px, 100%), 1fr)); gap: 12px; align-items: end; margin-top: 10px; }
    .checks { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: var(--ui-font-size-sm); }
    .checks label { display: flex; align-items: center; gap: 6px; }
    .list-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 10px; }
    .search { flex: 1 1 220px; max-width: 320px; min-width: 0; }
    .centered { display: grid; place-items: center; min-height: 120px; }
    .scroll { overflow-x: auto; }
    .tbl { width: 100%; border-collapse: collapse; font-size: var(--ui-font-size-sm); }
    .tbl th { text-align: left; font-weight: 600; color: var(--ui-color-text-muted); padding: 8px 10px; border-bottom: 1px solid var(--ui-color-border); }
    .tbl td { padding: 10px; border-bottom: 1px solid var(--ui-color-border-subtle); vertical-align: middle; }
    .email { font-weight: 500; margin-right: 6px; }
    .actions { text-align: right; }
  `,
})
export class AdminTestersComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  private readonly featureStore = inject(FeatureStore);

  protected readonly features = signal<AdminFeature[]>([]);
  protected readonly testers = signal<FeatureTester[]>([]);
  protected readonly loading = signal(true);
  protected readonly adding = signal(false);
  protected readonly pendingRemove = signal<FeatureTester | null>(null);
  protected readonly pendingRelease = signal<(AdminFeature & { released: boolean }) | null>(null);
  protected readonly newFeatures = signal<ReadonlySet<string>>(new Set(['template-designer']));

  protected email = '';
  protected note = '';
  protected search = '';

  protected readonly filtered = computed(() => {
    const q = this.search.trim().toLowerCase();
    const list = this.testers();
    return q ? list.filter((t) => t.email.includes(q) || (t.note ?? '').toLowerCase().includes(q)) : list;
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [features, testers] = await Promise.all([firstValueFrom(this.api.adminFeatures()), firstValueFrom(this.api.testers())]);
      this.features.set(features);
      this.testers.set(testers);
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleNew(key: string): void {
    this.newFeatures.update((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected async add(): Promise<void> {
    if (!this.email.trim() || this.newFeatures().size === 0) return;
    this.adding.set(true);
    try {
      const tester = await firstValueFrom(this.api.addTester({ email: this.email.trim(), features: [...this.newFeatures()], note: this.note || null }));
      this.testers.update((list) => [tester, ...list.filter((t) => t.id !== tester.id)]);
      this.toast.success(`${tester.email} can now test ${tester.features.length === 1 ? 'that feature' : 'those features'}.`);
      this.email = '';
      this.note = '';
      await this.refreshFeatures();
    } finally {
      this.adding.set(false);
    }
  }

  protected async toggleFeature(tester: FeatureTester, key: string): Promise<void> {
    const features = tester.features.includes(key) ? tester.features.filter((f) => f !== key) : [...tester.features, key];
    if (features.length === 0) {
      this.pendingRemove.set(tester);
      return;
    }
    const updated = await firstValueFrom(this.api.updateTester(tester.id, { email: tester.email, features, note: tester.note ?? null }));
    this.testers.update((list) => list.map((t) => (t.id === updated.id ? updated : t)));
    await this.refreshFeatures();
  }

  protected async remove(): Promise<void> {
    const tester = this.pendingRemove();
    this.pendingRemove.set(null);
    if (!tester) return;
    await firstValueFrom(this.api.removeTester(tester.id));
    this.testers.update((list) => list.filter((t) => t.id !== tester.id));
    this.toast.success(`${tester.email} was removed from testers.`);
    await this.refreshFeatures();
  }

  protected askRelease(feature: AdminFeature, released: boolean): void {
    // Snap the switch back until confirmed.
    this.features.update((list) => [...list]);
    this.pendingRelease.set({ ...feature, released });
  }

  protected async release(): Promise<void> {
    const pending = this.pendingRelease();
    this.pendingRelease.set(null);
    if (!pending) return;
    const updated = await firstValueFrom(this.api.releaseFeature(pending.key, pending.released));
    this.features.update((list) => list.map((f) => (f.key === updated.key ? updated : f)));
    await this.featureStore.refresh();
  }

  private async refreshFeatures(): Promise<void> {
    this.features.set(await firstValueFrom(this.api.adminFeatures()));
  }
}
