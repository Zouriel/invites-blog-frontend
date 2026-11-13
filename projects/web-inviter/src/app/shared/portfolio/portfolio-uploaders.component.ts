import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiButton } from '@zouriel/ui/button';
import { UiConfirmDialog, UiToastService } from '@zouriel/ui/dialog';
import { UiList, UiListItem } from '@zouriel/ui/list';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { APP_ICONS } from '../icons/app-icons';
import { PortfolioUploaderGroup, PortfolioUploaders } from './portfolio.types';

/**
 * "These are mine" (handoff "Fix 2026-11-13 night"): photos a studio took through a QR code or a guest link carry only
 * the name typed there, so the server can't know they're the studio's. This lists the names in the event; the studio
 * taps the one(s) that are them, and those photos become its own (and can go in the portfolio). "Not me" undoes it.
 * Studio organisers with consent on only; the API refuses everyone else, and then nothing is shown.
 */
@Component({
  selector: 'app-portfolio-uploaders',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiButton, UiConfirmDialog, UiList, UiListItem, UiText],
  template: `
    @if (groups().length) {
      <section class="mine" [class.mine--prominent]="prominent()" aria-labelledby="mine-title">
        <div class="head">
          <hugeicons-icon [icon]="icons.itsMe" [size]="22" [strokeWidth]="1.8" />
          <div>
            <ui-text variant="h4" id="mine-title">Which of these are you?</ui-text>
            <ui-text variant="caption" class="muted">
              Photos taken with the event's QR code or a guest link only have the name typed there. Tap your name to make those photos yours.
            </ui-text>
          </div>
        </div>
        <ui-list [bordered]="true">
          @for (g of groups(); track g.key) {
            <ui-list-item>
              <span item-leading class="thumbs" aria-hidden="true">
                @for (src of g.thumbUrls.slice(0, 4); track $index) {
                  <img [src]="src" alt="" loading="lazy" />
                }
              </span>
              <span class="who">
                <span class="name">{{ g.name }}</span>
                <ui-text variant="caption" class="muted">{{ countText(g) }}{{ g.claimed ? ' · yours' : '' }}</ui-text>
              </span>
              <span item-trailing>
                @if (g.claimed) {
                  <ui-button variant="ghost" size="sm" [loading]="busyKey() === g.key" [disabled]="!!busyKey()" (click)="askUndo(g)">
                    <hugeicons-icon [icon]="icons.undo" [size]="18" [strokeWidth]="1.8" /> Not me
                  </ui-button>
                } @else {
                  <ui-button variant="secondary" size="sm" [loading]="busyKey() === g.key" [disabled]="!!busyKey()" (click)="claim(g)">
                    <hugeicons-icon [icon]="icons.itsMe" [size]="18" [strokeWidth]="1.8" /> This is me
                  </ui-button>
                }
              </span>
            </ui-list-item>
          }
        </ui-list>
      </section>
      <ui-confirm-dialog
        [open]="!!undoing()"
        (openChange)="!$event && undoing.set(null)"
        [title]="'Not ' + (undoing()?.name ?? '') + '?'"
        message="These photos will be someone else's again. Any of them in your portfolio will be taken out."
        confirmLabel="Not me"
        cancelLabel="Keep them"
        [destructive]="true"
        (confirm)="unclaim()"
      />
    }
  `,
  styles: `
    .mine { display: flex; flex-direction: column; gap: var(--ui-space-3); padding: var(--ui-space-3) 0; }
    .mine--prominent { padding: var(--ui-space-4); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg); background: var(--ui-color-surface-subtle); }
    .head { display: flex; align-items: flex-start; gap: var(--ui-space-3); }
    .head hugeicons-icon { flex: none; margin-top: 2px; color: var(--ui-color-primary); }
    .muted { color: var(--ui-color-text-muted); display: block; }
    .thumbs { display: grid; grid-template-columns: repeat(2, 24px); grid-auto-rows: 24px; gap: 2px; flex: none; }
    .thumbs img { width: 24px; height: 24px; object-fit: cover; border-radius: 4px; display: block; }
    .who { display: flex; flex-direction: column; min-width: 0; }
    .name { font-weight: 600; overflow-wrap: anywhere; }
  `,
})
export class PortfolioUploadersComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);
  protected readonly icons = APP_ICONS;

  readonly campaignId = input.required<string>();
  /** Framed and set apart: used when none of the event's photos can be added yet. */
  readonly prominent = input(false);
  /** After a claim or an undo: the caller reloads what can be picked. */
  readonly changed = output<void>();

  protected readonly state = signal<PortfolioUploaders | null>(null);
  protected readonly groups = computed(() => (this.state()?.consented ? this.state()!.groups : []));
  protected readonly busyKey = signal<string | null>(null);
  protected readonly undoing = signal<PortfolioUploaderGroup | null>(null);

  constructor() {
    effect(() => {
      const id = this.campaignId();
      if (!id) return;
      this.api.portfolioUploaders(id).subscribe({ next: (s) => this.state.set(s), error: () => this.state.set(null) });
    });
  }

  protected countText(g: PortfolioUploaderGroup): string {
    const photos = g.photoCount === 1 ? '1 photo' : `${g.photoCount} photos`;
    if (!g.videoCount) return photos;
    return `${photos}, ${g.videoCount === 1 ? '1 video' : `${g.videoCount} videos`}`;
  }

  async claim(g: PortfolioUploaderGroup): Promise<void> {
    this.busyKey.set(g.key);
    try {
      const r = await firstValueFrom(this.api.claimPortfolioUploader(this.campaignId(), g.key));
      this.state.set(r.uploaders);
      this.toast.success(r.message);
      this.changed.emit();
    } catch {
      /* the toast said why */
    } finally {
      this.busyKey.set(null);
    }
  }

  protected askUndo(g: PortfolioUploaderGroup): void {
    this.undoing.set(g);
  }

  async unclaim(): Promise<void> {
    const g = this.undoing();
    this.undoing.set(null);
    if (!g) return;
    this.busyKey.set(g.key);
    try {
      const r = await firstValueFrom(this.api.unclaimPortfolioUploader(this.campaignId(), g.key));
      this.state.set(r.uploaders);
      this.toast.success(r.message);
      this.changed.emit();
    } catch {
      /* the toast said why */
    } finally {
      this.busyKey.set(null);
    }
  }
}
