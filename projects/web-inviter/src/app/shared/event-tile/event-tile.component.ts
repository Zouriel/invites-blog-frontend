import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { APP_ICONS } from '../icons/app-icons';

/**
 * One event on a shelf: its poster, its name and a line under it. Inbox shows the invitations that
 * arrived with it, Me the events being hosted; the badges under the title are projected in.
 *
 * <p><b>A poster, not a row.</b> An invitation is a designed object; a row of titles throws away the
 * only thing that distinguishes one from another. The tile is the whole target.</p>
 */
@Component({
  selector: 'app-event-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, RouterLink],
  template: `
    <a class="tile" [routerLink]="link()">
      <div class="tile__media">
        @if (src(); as s) {
          <img class="tile__img" [src]="s" [alt]="title()" loading="lazy" decoding="async" (error)="broken.set(true)" />
        } @else {
          <span class="tile__initial" aria-hidden="true">{{ initial() }}</span>
        }
        @if (flag()) {
          <span class="tile__flag" [class.tile__flag--dim]="flagDim()">{{ flag() }}</span>
        }
        @if (photoCount()) {
          <span class="tile__photos" title="Photos and videos in this event's box">
            {{ photoCount() }} <hugeicons-icon [icon]="appIcons.photo" [size]="13" [strokeWidth]="1.8" />
          </span>
        }
      </div>
      <div class="tile__meta">
        <span class="tile__title">{{ title() }}</span>
        <span class="tile__sub">{{ sub() }}</span>
        <span class="tags"><ng-content /></span>
      </div>
    </a>
  `,
  styles: `
    :host {
      display: block;
    }
    .tile {
      display: block;
      text-decoration: none;
      color: inherit;
    }
    /* Portrait, because that is the shape of the thing: an invitation is read on a phone held
       upright, and a landscape crop throws away most of the design. */
    .tile__media {
      position: relative;
      aspect-ratio: 3 / 4;
      overflow: hidden;
      border-radius: var(--ui-radius);
      background: var(--ui-color-surface-raised);
      display: grid;
      place-items: center;
    }
    /* Posters are captured from the top of a section, so anchor there: a centre crop cuts the heading. */
    .tile__img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: 50% 0;
      display: block;
    }
    .tile__initial {
      font-size: clamp(2rem, 8vw, 3rem);
      font-weight: 600;
      color: var(--ui-color-text-muted);
    }
    .tile__flag {
      position: absolute;
      top: 0.5rem;
      left: 0.5rem;
      padding: 0.15rem 0.5rem;
      font-size: 0.68rem;
      font-weight: 600;
      border-radius: 999px;
      color: var(--ui-color-primary-contrast, #fff);
      background: var(--ui-color-primary);
    }
    .tile__flag--dim {
      color: #fff;
      background: rgb(0 0 0 / 55%);
    }
    .tile__photos {
      position: absolute;
      right: 0.5rem;
      bottom: 0.5rem;
      display: inline-flex;
      align-items: center;
      gap: 0.2rem;
      padding: 0.15rem 0.5rem;
      font-size: 0.7rem;
      font-weight: 600;
      color: #fff;
      background: rgb(0 0 0 / 55%);
      border-radius: 999px;
    }
    .tile__meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
      padding: 0.55rem 0.15rem 0;
    }
    /* Two lines, then ellipsis: titles are people's names and run long. */
    .tile__title {
      font-weight: 600;
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .tile__sub {
      font-size: 0.82rem;
      color: var(--ui-color-text-muted);
    }
    .tags {
      display: flex;
      gap: 0.35rem;
      flex-wrap: wrap;
      margin-top: 0.35rem;
    }
    .tags:empty {
      display: none;
    }
  `,
})
export class EventTileComponent {
  protected readonly appIcons = APP_ICONS;

  readonly link = input.required<string | unknown[]>();
  readonly title = input.required<string>();
  readonly sub = input('');
  readonly poster = input<string | null>(null);
  readonly photoCount = input(0);
  /** A word over the poster's corner: "New", "Past". */
  readonly flag = input<string | null>(null);
  readonly flagDim = input(false);

  /**
   * A stored URL can outlive the object behind it, and a broken-image icon is a worse answer than
   * the initial, so a failure demotes the tile for good. `previewImageUrl` historically pointed at a
   * template's index.html (a page, not an image), which counts as no poster.
   */
  protected readonly broken = signal(false);
  protected readonly src = computed(() => {
    const url = this.poster();
    if (!url || url.endsWith('index.html') || this.broken()) return null;
    return url;
  });

  protected readonly initial = computed(() => (this.title()?.trim()[0] ?? '?').toUpperCase());
}
