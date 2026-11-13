import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UiConfirmDialog } from '@zouriel/ui/dialog';
import { UiSwitch } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../api/api.service';
import { SessionStore } from '../services/session.store';
import { PORTFOLIO_CONSENT_TEXT } from './portfolio-photo-picker.component';
import { PortfolioUploadersComponent } from './portfolio-uploaders.component';

/**
 * The studio's one-time declaration for an event, in the album's settings: once on, "Add to portfolio" shows when
 * photos are selected in this event's album. Off takes the event's photos out of the portfolio (asked first).
 * Shown only to Studio accounts; nobody else sees anything.
 */
@Component({
  selector: 'app-portfolio-consent',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, UiConfirmDialog, UiSwitch, UiText, PortfolioUploadersComponent],
  template: `
    @if (session.isStudio() && state(); as s) {
      <section class="consent">
        <div class="head">
          <div>
            <ui-text variant="h4">Show in my portfolio</ui-text>
            <ui-text variant="caption" class="muted">{{ text }}.</ui-text>
            @if (s.consented) {
              <ui-text variant="caption" class="muted">
                Select photos in this album and choose Add to portfolio.
                @if (s.photosInPortfolio) { {{ s.photosInPortfolio }} in <a routerLink="/portfolio">your portfolio</a>. }
              </ui-text>
            }
          </div>
          <ui-switch [ngModel]="s.consented" [ngModelOptions]="{ standalone: true }" [disabled]="busy()" [ariaLabel]="text" (ngModelChange)="flip($event)" />
        </div>
        @if (s.consented) {
          <app-portfolio-uploaders [campaignId]="campaignId()" (changed)="refresh()" />
        }
      </section>
      <ui-confirm-dialog
        [open]="askingOff()"
        (openChange)="!$event && askingOff.set(false)"
        title="Take this event out of your portfolio?"
        [message]="offMessage()"
        confirmLabel="Take them out"
        cancelLabel="Keep them"
        [destructive]="true"
        (confirm)="save(false)"
      />
    }
  `,
  styles: `
    .consent { padding: var(--ui-space-4) 0; border-top: 1px solid var(--ui-color-border); }
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--ui-space-4); }
    .muted { color: var(--ui-color-text-muted); display: block; margin-top: var(--ui-space-1); }
  `,
})
export class PortfolioConsentComponent {
  protected readonly session = inject(SessionStore);
  private readonly api = inject(ApiService);
  protected readonly text = PORTFOLIO_CONSENT_TEXT;

  readonly campaignId = input.required<string>();

  protected readonly state = signal<{ consented: boolean; photosInPortfolio: number } | null>(null);
  protected readonly busy = signal(false);
  protected readonly askingOff = signal(false);
  protected readonly offMessage = computed(() => {
    const n = this.state()?.photosInPortfolio ?? 0;
    return n ? `${n} ${n === 1 ? 'photo' : 'photos'} from this event will leave your portfolio.` : 'You can turn it on again later.';
  });

  constructor() {
    effect(() => {
      const id = this.campaignId();
      if (!id || !this.session.isStudio()) return;
      this.api.portfolioConsent(id).subscribe({ next: (s) => this.state.set(s), error: () => this.state.set(null) });
    });
  }

  /** After "Not me" photos may have left the portfolio: the count above changes. */
  protected refresh(): void {
    this.api.portfolioConsent(this.campaignId()).subscribe({ next: (s) => this.state.set(s) });
  }

  protected flip(on: boolean): void {
    if (on) void this.save(true);
    else {
      // Put the switch back until they confirm.
      this.state.set({ ...this.state()! });
      this.askingOff.set(true);
    }
  }

  protected async save(on: boolean): Promise<void> {
    this.busy.set(true);
    this.askingOff.set(false);
    try {
      this.state.set(await firstValueFrom(this.api.setPortfolioConsent(this.campaignId(), on)));
    } catch {
      this.state.set({ ...this.state()! });
    } finally {
      this.busy.set(false);
    }
  }
}
