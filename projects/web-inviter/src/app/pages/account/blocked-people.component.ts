import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiList, UiListItem } from '@zouriel/ui/list';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ApiService } from '../../shared/api/api.service';
import { ModerationStore } from '../../shared/moderation/moderation.store';
import { BlockedPerson } from '../../shared/utils/types/api.types';

/**
 * Settings › Blocked people: everyone this account has blocked, each with Unblock. Blocking happens
 * where the person's things are (a post's, comment's or photo's menu); this is the way back.
 */
@Component({
  selector: 'app-blocked-people',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, UiAvatar, UiButton, UiEmptyState, UiList, UiListItem, UiSpinner],
  template: `
    @if (loading()) {
      <div class="centered"><ui-spinner /></div>
    } @else if (failed()) {
      <ui-empty-state heading="That didn't load" description="Check your connection and try again.">
        <ui-button empty-actions variant="outline" (click)="load()">Try again</ui-button>
      </ui-empty-state>
    } @else if (!people().length) {
      <ui-empty-state
        heading="You haven't blocked anyone"
        description="Block someone from the menu on their post, comment or photo, and you won't see anything they share. They aren't told."
      />
    } @else {
      <ui-list [bordered]="true">
          @for (person of people(); track person.userId) {
            <ui-list-item>
              <ui-avatar item-leading [src]="person.avatarUrl || undefined" [name]="person.displayName" size="sm" />
              <span class="name">{{ person.displayName }}</span>
              <span class="when">Blocked {{ person.blockedAt | date: 'd MMM y' }}</span>
              <ui-button
                item-trailing
                size="sm"
                variant="outline"
                [loading]="busy() === person.userId"
                [disabled]="!!busy()"
                (click)="unblock(person)"
                >Unblock</ui-button
              >
            </ui-list-item>
          }
      </ui-list>
      <p class="note">They won't be told either way. Unblocking shows their posts, comments and photos again.</p>
    }
  `,
  styles: `
    :host { display: block; }
    .centered { display: grid; place-items: center; min-height: 160px; }
    .name { display: block; font-weight: 600; overflow-wrap: anywhere; }
    .when { display: block; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .note { margin: 12px 0 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
  `,
})
export class BlockedPeopleComponent {
  private readonly api = inject(ApiService);
  private readonly mod = inject(ModerationStore);
  private readonly toast = inject(UiToastService);

  protected readonly people = signal<BlockedPerson[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly busy = signal<string | null>(null);

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.people.set((await firstValueFrom(this.api.blockedPeople())) ?? []);
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async unblock(person: BlockedPerson): Promise<void> {
    this.busy.set(person.userId);
    try {
      await this.mod.unblock(person.userId);
      this.people.update((list) => list.filter((p) => p.userId !== person.userId));
      this.toast.success(`${person.displayName} is unblocked.`);
    } catch {
      // The API toast says why.
    } finally {
      this.busy.set(null);
    }
  }
}
