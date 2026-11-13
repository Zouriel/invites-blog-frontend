import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAvatar } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiChoiceGrid, UiFileUpload, type UiChoice } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { APP_ICONS } from '../icons/app-icons';
import {
  DEFAULT_LOGO_POSITION,
  DEFAULT_LOGO_SIZE,
  LOGO_POSITIONS,
  LOGO_SIZES,
  Portfolio,
  PortfolioLogoPosition,
  PortfolioLogoSize,
  PortfolioOptions,
} from './portfolio.types';

/**
 * The studio's logo (handoff "Fix 2026-11-13 night" 4 and 6): ONE upload box that shows the logo once there is one
 * (tapping it uploads a replacement), under it the logo as it looks in small round places with Remove beside it,
 * then where it sits on the cover and how big. Every change is saved at once, like the upload itself.
 */
@Component({
  selector: 'app-portfolio-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, UiAvatar, UiButton, UiChoiceGrid, UiFileUpload, UiText],
  template: `
    <div class="box">
      <ui-file-upload
        accept="image/*"
        acceptLabel="PNG with a see-through background works best"
        label="Upload your logo"
        replaceLabel="Tap to change"
        hint=""
        [preview]="portfolio().logoUrl"
        previewAlt="Your logo"
        previewFit="contain"
        previewAspect="3 / 2"
        [disabled]="busy()"
        (filesSelected)="upload($event)"
      />
    </div>
    @if (portfolio().logoUrl; as logo) {
      <div class="small">
        <ui-avatar [src]="logo" [name]="portfolio().displayName" size="lg" />
        <ui-text variant="caption" class="muted">How it looks in small, round places</ui-text>
        <ui-button variant="ghost" size="sm" [loading]="busy()" (click)="remove()">
          <hugeicons-icon [icon]="icons.trash" [size]="16" [strokeWidth]="1.8" /> Remove
        </ui-button>
      </div>

      <ui-text variant="h4">Where on the cover</ui-text>
      <ui-choice-grid class="places" label="Where the logo sits on the cover" [options]="positionChoices()" [(value)]="position"
                      (picked)="savePosition($event)" minTile="96px">
        <ng-template #tile let-item>
          <span class="mini" aria-hidden="true"><span class="mini__logo" [attr.data-at]="item.value"></span></span>
        </ng-template>
      </ui-choice-grid>

      <ui-text variant="h4">Logo size</ui-text>
      <ui-choice-grid class="sizes" label="Logo size" [options]="sizeChoices()" [(value)]="size" (picked)="saveSize($event)" minTile="96px">
        <ng-template #tile let-item>
          <span class="mini" aria-hidden="true"><span class="mini__logo" data-at="center" [attr.data-size]="item.value"></span></span>
        </ng-template>
      </ui-choice-grid>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    /* As wide as the cover's box above it, so the setup's two upload boxes line up (UI audit 2026-11-13). */
    .box { max-width: 480px; }
    .small { display: flex; align-items: center; flex-wrap: wrap; gap: var(--ui-space-3); }
    .small ui-text { flex: 1 1 140px; min-width: 0; }
    .muted { color: var(--ui-color-text-muted); }
    /* A tiny cover with the logo where it would go: the picture says more than the word. */
    .mini { position: relative; display: block; width: 64px; aspect-ratio: 16 / 9; margin: 0 auto; border-radius: 4px;
      background: linear-gradient(135deg, var(--ui-color-surface-hover), var(--ui-color-border)); }
    .mini__logo { position: absolute; width: 12px; height: 12px; border-radius: 3px; background: var(--ui-color-primary); }
    .mini__logo[data-at='top-left'] { top: 4px; left: 4px; }
    .mini__logo[data-at='top-center'] { top: 4px; left: calc(50% - 6px); }
    .mini__logo[data-at='center'] { top: calc(50% - 6px); left: calc(50% - 6px); }
    .mini__logo[data-at='bottom-left'] { bottom: 4px; left: 4px; }
    .mini__logo[data-at='bottom-center'] { bottom: 4px; left: calc(50% - 6px); }
    .mini__logo[data-size='small'] { width: 8px; height: 8px; top: calc(50% - 4px); left: calc(50% - 4px); }
    .mini__logo[data-size='large'] { width: 20px; height: 20px; top: calc(50% - 10px); left: calc(50% - 10px); }
  `,
})
export class PortfolioLogoComponent {
  private readonly api = inject(ApiService);
  protected readonly icons = APP_ICONS;

  readonly portfolio = input.required<Portfolio>();
  readonly options = input<PortfolioOptions | null>(null);
  readonly changed = output<Portfolio>();

  protected readonly busy = signal(false);
  protected readonly position = linkedSignal<string | null>(() => this.portfolio().logoPosition ?? DEFAULT_LOGO_POSITION);
  protected readonly size = linkedSignal<string | null>(() => this.portfolio().logoSize ?? DEFAULT_LOGO_SIZE);

  protected readonly positionChoices = computed<UiChoice[]>(() =>
    (this.options()?.logoPositions?.length ? this.options()!.logoPositions! : LOGO_POSITIONS).map((x) => ({ value: x.key, label: x.label })),
  );
  protected readonly sizeChoices = computed<UiChoice[]>(() =>
    (this.options()?.logoSizes?.length ? this.options()!.logoSizes! : LOGO_SIZES).map((x) => ({ value: x.key, label: x.label })),
  );

  protected upload(files: File[]): void {
    if (files[0]) void this.run(this.api.setPortfolioLogo(files[0]));
  }

  protected remove(): void {
    void this.run(this.api.removePortfolioLogo());
  }

  protected savePosition(c: UiChoice): void {
    if (c.value !== (this.portfolio().logoPosition ?? DEFAULT_LOGO_POSITION))
      void this.run(this.api.updatePortfolio({ logoPosition: c.value as PortfolioLogoPosition }));
  }

  protected saveSize(c: UiChoice): void {
    if (c.value !== (this.portfolio().logoSize ?? DEFAULT_LOGO_SIZE))
      void this.run(this.api.updatePortfolio({ logoSize: c.value as PortfolioLogoSize }));
  }

  private async run(call: Observable<Portfolio>): Promise<void> {
    this.busy.set(true);
    try {
      this.changed.emit(await firstValueFrom(call));
    } catch {
      // The toast said why; put the pickers back to what is saved.
      this.position.set(this.portfolio().logoPosition ?? DEFAULT_LOGO_POSITION);
      this.size.set(this.portfolio().logoSize ?? DEFAULT_LOGO_SIZE);
    } finally {
      this.busy.set(false);
    }
  }
}
