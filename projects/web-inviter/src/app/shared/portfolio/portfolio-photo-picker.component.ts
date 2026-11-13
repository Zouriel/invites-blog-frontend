import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiCheckbox } from '@zouriel/ui/form';
import { UiImagePicker, UiSelectable, type UiImagePickerItem } from '@zouriel/ui/media';
import { UiGrid } from '@zouriel/ui/layout';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiAlert } from '@zouriel/ui/alert';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { APP_ICONS } from '../icons/app-icons';
import { MyCampaign } from '../utils/types/api.types';
import { PortfolioEventPhotos } from './portfolio.types';

/** What the studio chose: photos of one event (its own uploads), consent already recorded. */
export type PortfolioPick = { campaignId: string; eventTitle: string; photoIds: string[] };

/** The consent sentence, word for word everywhere it is asked (docs/PORTFOLIO.md §3). */
export const PORTFOLIO_CONSENT_TEXT = 'The people this event is for agreed to its photos being shown in my portfolio';

/**
 * Choose photos for the portfolio in three plain steps: which event, the one-time consent for it, then
 * which photos. Only photos the studio added itself are offered; guests' photos are never shown here.
 */
@Component({
  selector: 'app-portfolio-photo-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, HugeiconsIconComponent, UiAlert, UiButton, UiCheckbox, UiGrid, UiImagePicker, UiSelectable, UiSpinner, UiText],
  template: `
    @if (!event()) {
      <ui-text variant="caption" class="muted">Pick the event the photos are from.</ui-text>
      @if (events() === null) {
        <div class="center"><ui-spinner /></div>
      } @else if (!eventItems().length) {
        <ui-text class="muted">None of your events has photos yet. Add your photos to an event's album first.</ui-text>
      } @else {
        <ui-image-picker [items]="eventItems()" [captions]="true" minThumb="120px" (pick)="chooseEvent($event.id)" />
      }
    } @else if (!consented()) {
      <div class="step">
        <ui-text variant="h4">{{ event()!.title }}</ui-text>
        <ui-checkbox [(ngModel)]="agreed" [ngModelOptions]="{ standalone: true }">{{ consentText }}</ui-checkbox>
        <ui-text variant="caption" class="muted">You only confirm this once for each event. Nobody else is told.</ui-text>
        <div class="actions">
          <ui-button variant="ghost" (click)="back()">
            <hugeicons-icon [icon]="icons.back" [size]="18" [strokeWidth]="1.8" /> Other event
          </ui-button>
          <ui-button variant="primary" [disabled]="!agreed" [loading]="busy()" (click)="consent()">Continue</ui-button>
        </div>
      </div>
    } @else {
      <div class="step">
        <div class="row">
          <ui-text variant="h4">{{ event()!.title }}</ui-text>
          @if (own().length) {
            <ui-button variant="ghost" size="sm" (click)="toggleAll()">{{ allPicked() ? 'Clear' : 'Select all' }}</ui-button>
          }
        </div>
        @if (photos() === null) {
          <div class="center"><ui-spinner /></div>
        } @else if (!own().length) {
          <ui-text class="muted">
            None of the photos in this event can be added: {{ notOwnSentence() }} Only photos you uploaded yourself can go in your portfolio.
          </ui-text>
        } @else {
          @if (notOwn()) {
            <ui-text variant="caption" class="muted">Showing your own photos. {{ notOwnSentence() }}</ui-text>
          }
          <ui-grid min="96px" [gap]="2">
            @for (p of own(); track p.id) {
              <ui-selectable [selecting]="true" [selected]="picked().has(p.id)" (tap)="toggle(p.id)" [label]="p.inPortfolio ? 'Photo, already in your portfolio' : 'Photo'" borderRadius="8px">
                <img class="thumb" [class.thumb--in]="p.inPortfolio" [src]="p.thumbUrl" alt="" loading="lazy" />
              </ui-selectable>
            }
          </ui-grid>
        }
        @if (error()) {
          <ui-alert tone="danger">{{ error() }}</ui-alert>
        }
        <div class="actions sticky">
          <ui-button variant="ghost" (click)="back()">
            <hugeicons-icon [icon]="icons.back" [size]="18" [strokeWidth]="1.8" /> Other event
          </ui-button>
          <ui-button variant="primary" [disabled]="!picked().size" (click)="done()">
            {{ picked().size ? 'Use ' + picked().size + (picked().size === 1 ? ' photo' : ' photos') : 'Pick photos' }}
          </ui-button>
        </div>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .center { display: grid; place-items: center; padding: var(--ui-space-6); }
    .muted { color: var(--ui-color-text-muted); }
    .step { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-2); }
    .actions { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--ui-space-2); }
    .sticky { position: sticky; bottom: 0; padding: var(--ui-space-2) 0; background: var(--ui-color-surface); }
    .thumb { display: block; width: 100%; aspect-ratio: 1; object-fit: cover; }
    .thumb--in { opacity: 0.55; }
  `,
})
export class PortfolioPhotoPickerComponent {
  private readonly api = inject(ApiService);
  protected readonly icons = APP_ICONS;
  protected readonly consentText = PORTFOLIO_CONSENT_TEXT;

  readonly chosen = output<PortfolioPick>();
  /** Why the last choice couldn't be added (set by the page that adds them); shown under the photos. */
  readonly error = input<string | null>(null);

  protected readonly events = signal<MyCampaign[] | null>(null);
  protected readonly event = signal<MyCampaign | null>(null);
  protected readonly consented = signal(false);
  protected readonly album = signal<PortfolioEventPhotos | null>(null);
  protected readonly photos = computed(() => this.album()?.photos ?? null);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly busy = signal(false);
  protected agreed = false;

  protected readonly eventItems = computed<UiImagePickerItem[]>(() =>
    (this.events() ?? [])
      .filter((e) => e.relation !== 'celebrant' && e.photoCount > 0)
      .map((e) => ({ id: e.id, src: e.previewImageUrl ?? '', label: e.title })),
  );

  /** The photos the server says can go in: the studio's own pictures (never a guest's, never a video). */
  protected readonly own = computed(() => (this.photos() ?? []).filter((p) => p.eligible));
  protected readonly notOwn = computed(() => (this.photos() ?? []).filter((p) => !p.eligible).length);
  /** "8 were added by guests and 2 are videos." */
  protected readonly notOwnSentence = computed(() => {
    const list = (this.photos() ?? []).filter((p) => !p.eligible);
    const count = (r: string) => list.filter((p) => p.reason === r).length;
    const parts: string[] = [];
    const guest = count('guest');
    const other = count('other_account');
    const video = count('video');
    if (guest) parts.push(guest === 1 ? '1 was added by a guest' : `${guest} were added by guests`);
    if (other) parts.push(other === 1 ? '1 was added by someone else' : `${other} were added by someone else`);
    if (video) parts.push(video === 1 ? '1 is a video' : `${video} are videos`);
    return parts.length ? `${parts.join(' and ')}.` : '';
  });
  protected readonly allPicked = computed(() => this.own().length > 0 && this.picked().size === this.own().length);

  constructor() {
    this.api.myCampaigns().subscribe({ next: (list) => this.events.set(list), error: () => this.events.set([]) });
  }

  protected async chooseEvent(id: string): Promise<void> {
    const ev = (this.events() ?? []).find((e) => e.id === id) ?? null;
    this.event.set(ev);
    this.agreed = false;
    this.picked.set(new Set());
    this.album.set(null);
    if (!ev) return;
    try {
      const state = await firstValueFrom(this.api.portfolioConsent(ev.id));
      this.consented.set(state.consented);
    } catch {
      this.consented.set(false);
    }
    if (this.consented()) this.loadPhotos(ev.id);
  }

  protected async consent(): Promise<void> {
    const ev = this.event();
    if (!ev) return;
    this.busy.set(true);
    try {
      const state = await firstValueFrom(this.api.setPortfolioConsent(ev.id, true));
      this.consented.set(state.consented);
      if (state.consented) this.loadPhotos(ev.id);
    } catch {
      /* the toast said why */
    } finally {
      this.busy.set(false);
    }
  }

  private loadPhotos(id: string): void {
    this.api.portfolioEventPhotos(id).subscribe({
      next: (album) => this.album.set(album),
      error: () => this.album.set({ consented: true, eligibleCount: 0, guestCount: 0, videoCount: 0, photos: [] }),
    });
  }

  protected toggle(id: string): void {
    const next = new Set(this.picked());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.picked.set(next);
  }

  protected toggleAll(): void {
    this.picked.set(this.allPicked() ? new Set() : new Set(this.own().map((p) => p.id)));
  }

  protected back(): void {
    this.event.set(null);
    this.consented.set(false);
    this.album.set(null);
  }

  protected done(): void {
    const ev = this.event();
    if (!ev || !this.picked().size) return;
    this.chosen.emit({ campaignId: ev.id, eventTitle: ev.title, photoIds: [...this.picked()] });
  }
}
