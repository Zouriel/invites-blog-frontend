import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiConfirmDialog, UiDrawer, UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import type { MyTemplateRow } from '../../shared/utils/types/api.types';
import type { DesignEvent, DesignSummary } from './model/scene';

/**
 * The Designer tab of My templates: the templates this person is building in the designer, what's
 * published and where, and — for designers and admins — the existing templates they can open in it.
 */
@Component({
  selector: 'app-my-designs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, RouterLink, UiBadge, UiButton, UiCard, UiConfirmDialog, UiDrawer, UiEmptyState, UiSpinner, UiText],
  template: `
    <div class="head">
      <div>
        <ui-text variant="h3">Designer</ui-text>
        <ui-text variant="body" class="lead">Build animated templates visually. Publish them for your own events, or to the gallery for everyone.</ui-text>
      </div>
      <a routerLink="/design/new"><ui-button variant="primary">New design</ui-button></a>
    </div>

    @if (loading()) {
      <div class="centered"><ui-spinner /></div>
    } @else if (!designs().length) {
      <ui-empty-state heading="No designs yet" description="Start from a layout and make it yours — or open one of your templates below.">
        <div empty-actions><a routerLink="/design/new"><ui-button variant="primary">Design your first template</ui-button></a></div>
      </ui-empty-state>
    } @else {
      <div class="grid">
        @for (d of designs(); track d.id) {
          <ui-card padding="sm">
           <div class="design">
            <a class="thumb" [routerLink]="['/design', d.id]" [attr.aria-label]="'Open ' + d.name">
              @if (d.template?.previewImageUrl) { <img [src]="d.template!.previewImageUrl" alt="" /> }
              @else { <span class="placeholder" aria-hidden="true">✦</span> }
            </a>
            <div class="info">
              <strong class="name">{{ d.name }}</strong>
              <div class="badges">
                @if (d.template; as t) {
                  <ui-badge [tone]="t.visibility === 'Public' ? 'success' : 'neutral'">{{ t.visibility === 'Public' ? 'In the gallery' : t.visibility }}</ui-badge>
                  <ui-badge>v{{ t.version }}</ui-badge>
                  @if (t.unlistedByAdmin) { <ui-badge tone="danger">Taken out of the gallery</ui-badge> }
                } @else {
                  <ui-badge tone="neutral">Not published</ui-badge>
                }
                @if (d.template && (d.publishedRevision ?? 0) < d.revision) { <ui-badge tone="warning">Unpublished changes</ui-badge> }
              </div>
              <span class="sub">Edited {{ d.updatedAt | date: 'd MMM y, HH:mm' }}
                @if (d.template?.eventsUsing) { · used by {{ d.template!.eventsUsing }} event{{ d.template!.eventsUsing === 1 ? '' : 's' }} }
              </span>
            </div>
            <div class="actions">
              <a [routerLink]="['/design', d.id]"><ui-button size="sm" variant="primary">Open</ui-button></a>
              <a [routerLink]="['/design', d.id, 'preview']"><ui-button size="sm" variant="ghost">Preview</ui-button></a>
              @if (d.template && !d.template.unlistedByAdmin && d.template.visibility !== 'Dedicated') {
                <ui-button size="sm" variant="ghost" [loading]="busy() === d.id" (click)="toggleGallery(d)">
                  {{ d.template.visibility === 'Public' ? 'Unlist' : 'Add to gallery' }}
                </ui-button>
              }
              @if (d.template) {
                <ui-button size="sm" variant="ghost" (click)="openEvents(d)">
                  Events
                  @if (d.template.eventsOnOlderVersions) { <ui-badge tone="warning">{{ d.template.eventsOnOlderVersions }} older</ui-badge> }
                </ui-button>
              }
              <ui-button size="sm" variant="ghost" (click)="duplicate(d)">Duplicate</ui-button>
              <ui-button size="sm" variant="ghost" (click)="pendingDelete.set(d)">Delete</ui-button>
            </div>
           </div>
          </ui-card>
        }
      </div>
    }

    @if (session.isDesigner() && editable().length) {
      <section class="existing">
        <ui-text variant="h4">Open an existing template</ui-text>
        <ui-text variant="body" class="lead">
          Templates made in the designer open exactly. Hand-written ones are converted from how they render — close, but worth a look before you publish.
        </ui-text>
        <div class="existing-list">
          @for (t of editable(); track t.id) {
            <div class="existing-row">
              <span class="ename">{{ t.name }}</span>
              <span class="sub">v{{ t.version }} · {{ t.category }}</span>
              <a [routerLink]="['/design/import', t.id]"><ui-button size="sm" variant="outline">Open in designer</ui-button></a>
            </div>
          }
        </div>
      </section>
    }

    <ui-drawer [(open)]="eventsOpen" [title]="'Events using ' + (eventsFor()?.name ?? '')" side="right">
      @if (eventsLoading()) {
        <div class="centered"><ui-spinner /></div>
      } @else if (!events().length) {
        <p class="sub">None of your events use this template yet.</p>
      } @else {
        <p class="sub">An event keeps the version it was made with. Move one to the latest version when you want its invitations to change.</p>
        <ul class="events">
          @for (e of events(); track e.campaignId) {
            <li>
              <div>
                <strong>{{ e.title }}</strong>
                <span class="sub">v{{ e.version }} · {{ e.status }}</span>
              </div>
              @if (e.isLatest) { <ui-badge tone="success">Latest</ui-badge> }
              @else { <ui-button size="sm" variant="outline" [loading]="busy() === e.campaignId" (click)="upgrade(e)">Use v{{ eventsFor()?.template?.version }}</ui-button> }
            </li>
          }
        </ul>
      }
    </ui-drawer>

    <ui-confirm-dialog [open]="!!pendingDelete()" (openChange)="!$event && pendingDelete.set(null)" title="Delete this design?"
      [message]="pendingDelete()?.template
        ? 'The design is deleted, but the published template stays — events using it keep working. You can manage the template from My designs.'
        : 'The design will be deleted. This can’t be undone.'"
      confirmLabel="Delete" [destructive]="true" (confirm)="remove()" />
  `,
  styles: `
    :host { display: grid; gap: 20px; padding: 8px 0 24px; }
    .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    .head a, .actions a, .existing-row a { text-decoration: none; }
    .lead { color: var(--ui-color-text-muted); }
    .centered { display: grid; place-items: center; min-height: 140px; }
    .grid { display: grid; gap: 12px; }
    .design { display: grid; grid-template-columns: 72px minmax(0, 1fr) auto; gap: 14px; align-items: center; }
    .thumb { display: grid; place-items: center; width: 72px; aspect-ratio: 9 / 16; border-radius: var(--ui-radius-sm); overflow: hidden;
      background: var(--ui-gradient-frost); color: var(--ui-color-text-muted); text-decoration: none; }
    .thumb img { width: 100%; height: 100%; object-fit: cover; }
    .info { display: grid; gap: 6px; min-width: 0; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .badges { display: flex; flex-wrap: wrap; gap: 6px; }
    .badges ui-badge { white-space: nowrap; }
    .sub { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .actions { display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-end; max-width: 520px; }
    .existing { display: grid; gap: 8px; margin-top: 12px; }
    .existing-list { display: grid; gap: 6px; }
    .existing-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 12px; align-items: center; padding: 8px 12px;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .ename { font-weight: 500; }
    .events { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 8px; }
    .events li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); }
    .events li div { display: grid; gap: 2px; }
    @media (max-width: 760px) { .design { grid-template-columns: 56px minmax(0, 1fr); } .actions { grid-column: 1 / -1; justify-content: flex-start; max-width: none; } .thumb { width: 56px; } }
  `,
})
export class MyDesignsComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly session = inject(SessionStore);

  protected readonly loading = signal(true);
  protected readonly designs = signal<DesignSummary[]>([]);
  protected readonly templates = signal<MyTemplateRow[]>([]);
  protected readonly busy = signal<string | null>(null);
  protected readonly pendingDelete = signal<DesignSummary | null>(null);

  protected readonly eventsOpen = signal(false);
  protected readonly eventsFor = signal<DesignSummary | null>(null);
  protected readonly events = signal<DesignEvent[]>([]);
  protected readonly eventsLoading = signal(false);

  /** Existing templates that don't have a design yet — those that do are listed above already. */
  protected readonly editable = computed(() => {
    const linked = new Set(this.designs().map((d) => d.template?.id).filter(Boolean));
    return this.templates().filter((t) => !linked.has(t.id) && t.visibility !== 'Imported' && t.isActive);
  });

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.designs.set(await firstValueFrom(this.api.myDesigns()));
      if (this.session.isDesigner()) {
        const page = await firstValueFrom(this.api.myTemplates()).catch(() => null);
        this.templates.set(page?.templates ?? []);
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected async duplicate(d: DesignSummary): Promise<void> {
    const copy = await firstValueFrom(this.api.duplicateDesign(d.id));
    this.toast.success(`“${copy.name}” was created.`);
    await this.load();
  }

  protected async remove(): Promise<void> {
    const d = this.pendingDelete();
    this.pendingDelete.set(null);
    if (!d) return;
    await firstValueFrom(this.api.deleteDesign(d.id));
    this.designs.update((list) => list.filter((x) => x.id !== d.id));
  }

  protected async toggleGallery(d: DesignSummary): Promise<void> {
    const to = d.template?.visibility === 'Public' ? 'Private' : 'Public';
    this.busy.set(d.id);
    try {
      await firstValueFrom(this.api.setDesignVisibility(d.id, to));
      this.toast.success(to === 'Public' ? 'It’s in the gallery now.' : 'Taken out of the gallery. Your events keep using it.');
      await this.load();
    } finally {
      this.busy.set(null);
    }
  }

  protected async openEvents(d: DesignSummary): Promise<void> {
    this.eventsFor.set(d);
    this.eventsOpen.set(true);
    this.eventsLoading.set(true);
    try {
      this.events.set(await firstValueFrom(this.api.designEvents(d.id)));
    } finally {
      this.eventsLoading.set(false);
    }
  }

  protected async upgrade(e: DesignEvent): Promise<void> {
    const d = this.eventsFor();
    if (!d) return;
    this.busy.set(e.campaignId);
    try {
      const updated = await firstValueFrom(this.api.upgradeDesignEvent(d.id, e.campaignId));
      this.events.update((list) => list.map((x) => (x.campaignId === updated.campaignId ? updated : x)));
      this.toast.success(`“${e.title}” now uses the latest version.`);
      // The card's "older" count comes from the list; refresh it quietly behind the drawer.
      this.designs.set(await firstValueFrom(this.api.myDesigns()).catch(() => this.designs()));
    } finally {
      this.busy.set(null);
    }
  }
}
