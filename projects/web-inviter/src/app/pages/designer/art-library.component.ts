import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiButton, UiSegmented, type UiSegmentedOption } from '@zouriel/ui/button';
import { UiSearchInput } from '@zouriel/ui/form';
import { UiAlert } from '@zouriel/ui/alert';
import { UiImagePicker, type UiImagePickerItem } from '@zouriel/ui/media';
import { ApiService } from '../../shared/api/api.service';
import { DesignStore } from './design.store';
import type { ArtItem, ArtKind, ArtSource } from './model/scene';

/** The drag type a library tile carries onto the canvas; the data is the tile's key. */
export const ART_DRAG_TYPE = 'application/x-ib-art';

const SUGGESTIONS = ['Flowers', 'Leaves', 'Hearts', 'Rings', 'Frames', 'Balloons', 'Confetti', 'Stars', 'Birds', 'Cake'];

const KIND_LABEL: Record<ArtKind, string> = { vector: 'Vectors', animated: 'Animated', picture: 'Pictures' };

/** The sources, fetched once per visit: they only change when the server's accounts do. */
let sourcesCache: ArtSource[] | null = null;

/**
 * The designer's art library: search free, public-domain illustration libraries and put what you pick
 * on the page. Picks are downloaded and cleaned on the server; an animated SVG or GIF arrives as scroll
 * motion (see `SvgArtConverter` on the server). Tiles can also be dragged onto the canvas.
 */
@Component({
  selector: 'app-art-library',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiSegmented, UiSearchInput, UiAlert, UiImagePicker],
  template: `
    <div class="lib">
      <ui-search-input size="sm" placeholder="Search free art" [ngModel]="query()" (ngModelChange)="typed($event)" />
      <div class="filters">
        <ui-segmented size="sm" label="Library" [options]="sourceOptions()" [value]="source()" (valueChange)="setSource($event)" />
        @if (kindOptions().length > 1) {
          <ui-segmented size="sm" label="Kind" [options]="kindOptions()" [value]="kind()" (valueChange)="setKind($event)" />
        }
      </div>
      <div class="suggestions" role="group" aria-label="Suggestions">
        @for (s of suggestions; track s) {
          <ui-button size="sm" [variant]="query().toLowerCase() === s.toLowerCase() ? 'secondary' : 'ghost'" (click)="suggest(s)">{{ s }}</ui-button>
        }
      </div>
      @if (slow()) {
        <p class="slow" role="status">Still waiting on {{ sourceName() }} — free libraries can take up to a minute.</p>
      }
      @if (error(); as message) {
        <ui-alert tone="warning" [heading]="message">
          <ui-button size="sm" variant="outline" (click)="retry()">Try again</ui-button>
        </ui-alert>
      }
      <ui-image-picker [items]="tiles()" [busyId]="busy()" [loading]="loading()" [hasMore]="hasMore()" [emptyText]="emptyText()"
        minThumb="84px" [dragType]="dragType" (pick)="pick($event)" (more)="loadMore()" />
      <p class="note">Only public-domain art is shown (CC0), so nothing needs a credit. Animated art plays as the page scrolls.</p>
    </div>
  `,
  styles: `
    :host { display: block; }
    .lib { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .filters { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    .suggestions { display: flex; gap: var(--ui-space-1); overflow-x: auto; scrollbar-width: none; margin-inline: calc(-1 * var(--ui-space-1)); }
    .suggestions::-webkit-scrollbar { display: none; }
    .slow { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .note { margin: 0; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
  `,
})
export class ArtLibraryComponent {
  private readonly api = inject(ApiService);
  private readonly store = inject(DesignStore);

  /** A pick was put on the page (the phone layout closes its panel on this). */
  readonly added = output<void>();

  protected readonly suggestions = SUGGESTIONS;
  protected readonly dragType = ART_DRAG_TYPE;

  protected readonly sources = signal<ArtSource[]>(sourcesCache ?? []);
  protected readonly source = signal('openverse');
  protected readonly kind = signal<ArtKind>('vector');
  protected readonly query = signal('Flowers');
  protected readonly items = signal<ArtItem[]>([]);
  protected readonly page = signal(1);
  protected readonly hasMore = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal<string | null>(null);
  /** A search or pick has taken long enough to say so. */
  protected readonly slow = signal(false);
  private request = 0;
  private debounce: ReturnType<typeof setTimeout> | undefined;

  protected readonly sourceOptions = computed<UiSegmentedOption[]>(() =>
    (this.sources().length ? this.sources() : [{ id: 'openverse', name: 'Openverse', available: true, kinds: ['vector'], note: '' } as ArtSource])
      .map((s) => ({ value: s.id, label: s.name, disabled: !s.available })));

  protected readonly sourceName = computed(() => this.sources().find((s) => s.id === this.source())?.name ?? 'the library');

  protected readonly kindOptions = computed<UiSegmentedOption[]>(() => {
    const s = this.sources().find((x) => x.id === this.source());
    return (s?.kinds ?? ['vector']).map((k) => ({ value: k, label: KIND_LABEL[k] }));
  });

  protected readonly tiles = computed<UiImagePickerItem[]>(() => this.items().map((i) => ({
    id: key(i),
    src: i.thumb,
    label: i.title,
    badge: i.kind === 'gif' ? 'Moves' : undefined,
    disabled: i.tooLarge,
    hint: i.tooLarge ? `${i.title} — too large to use` : [i.title, i.license, i.creator].filter(Boolean).join(' · '),
  })));

  protected readonly emptyText = computed(() =>
    this.error() ? '' : this.query().trim() ? `Nothing for “${this.query().trim()}” here — try another word or library.` : 'Search, or pick a suggestion.');

  constructor() {
    if (!sourcesCache)
      firstValueFrom(this.api.artSources()).then((s) => { sourcesCache = s; this.sources.set(s); }).catch(() => {});

    // Waiting a while is normal for these libraries; waiting in silence isn't.
    let slowTimer: ReturnType<typeof setTimeout> | undefined;
    effect(() => {
      const waiting = this.loading() || this.busy() !== null;
      clearTimeout(slowTimer);
      this.slow.set(false);
      if (waiting) slowTimer = setTimeout(() => this.slow.set(true), 6000);
    });

    // A new search whenever what's asked changes; typing is debounced in typed().
    effect(() => {
      this.source();
      this.kind();
      untracked(() => this.search());
    });

    // Tiles dragged onto the canvas land here, with where they were dropped.
    const onDrop = (e: Event) => {
      const { key: k, at } = (e as CustomEvent<{ key: string; at: { x: number; y: number } }>).detail;
      const item = this.items().find((i) => key(i) === k);
      if (item) void this.add(item, at);
    };
    window.addEventListener('ib-designer:add-art', onDrop);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('ib-designer:add-art', onDrop);
      clearTimeout(this.debounce);
      clearTimeout(slowTimer);
    });
  }

  protected typed(value: string): void {
    this.query.set(value);
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => this.search(), 450);
  }

  protected suggest(word: string): void {
    this.query.set(word);
    clearTimeout(this.debounce);
    this.search();
  }

  protected setSource(value: string | null): void {
    if (!value) return;
    const s = this.sources().find((x) => x.id === value);
    if (s && !s.kinds.includes(this.kind())) this.kind.set(s.kinds[0] ?? 'vector');
    this.source.set(value);
  }

  protected setKind(value: string | null): void {
    if (value) this.kind.set(value as ArtKind);
  }

  protected retry(): void {
    if (this.items().length) this.loadMore();
    else this.search();
  }

  private search(): void {
    this.items.set([]);
    this.page.set(1);
    this.hasMore.set(false);
    void this.fetch(1);
  }

  protected loadMore(): void {
    if (this.loading() || !this.hasMore()) return;
    void this.fetch(this.page() + 1);
  }

  private async fetch(page: number): Promise<void> {
    const q = this.query().trim();
    const id = ++this.request;
    this.error.set(null);
    this.loading.set(true);
    try {
      const result = await firstValueFrom(this.api.searchArt(this.source(), q, this.kind(), page));
      if (id !== this.request) return; // a newer search has started
      const seen = new Set(this.items().map(key));
      this.items.update((list) => [...list, ...result.items.filter((i) => !seen.has(key(i)))]);
      this.page.set(page);
      this.hasMore.set(result.hasMore);
    } catch (e) {
      if (id === this.request) this.error.set(e instanceof Error ? e.message : 'The library didn’t answer.');
    } finally {
      if (id === this.request) this.loading.set(false);
    }
  }

  protected pick(tile: UiImagePickerItem): void {
    const item = this.items().find((i) => key(i) === tile.id);
    if (item) void this.add(item);
  }

  private async add(item: ArtItem, at?: { x: number; y: number }): Promise<void> {
    if (this.busy()) return;
    this.busy.set(key(item));
    try {
      if (await this.store.importLibraryArt(item, at)) this.added.emit();
    } finally {
      this.busy.set(null);
    }
  }
}

function key(item: ArtItem): string {
  return `${item.source}:${item.id}`;
}
