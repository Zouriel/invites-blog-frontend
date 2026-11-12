import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiSwitch } from '@zouriel/ui/form';
import { injectUiGuidance } from '@zouriel/ui/guidance';
import { UiText } from '@zouriel/ui/text';
import { GuidanceService } from '../../shared/guidance/guidance.service';

/**
 * Settings › Tips (docs/GUIDANCE.md section 9): the switch for every tip, tour and offer, and "Show
 * tips again", which forgets what was seen. Both are the account's, so they apply on the phone too.
 */
@Component({
  selector: 'app-tips-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiCard, UiSwitch, UiText],
  template: `
    <ui-card padding="lg">
      <div class="row">
        <ui-switch
          [ngModel]="guidance.tipsOn()"
          (ngModelChange)="setOn($event)"
          [ngModelOptions]="{ standalone: true }"
        >Show tips</ui-switch>
      </div>
      <ui-text variant="caption" class="note">Short pointers and tours the first time you open a page.</ui-text>
    </ui-card>
    <ui-card padding="lg" class="again">
      <ui-text variant="h4">Show tips again</ui-text>
      <ui-text variant="caption" class="note">Every tip and tour you've seen or closed comes back, once.</ui-text>
      <div class="actions">
        <ui-button variant="outline" [loading]="resetting()" (click)="again()">Show tips again</ui-button>
      </div>
    </ui-card>
  `,
  styles: `
    :host { display: grid; gap: 1rem; max-width: 40rem; }
    .row { display: flex; align-items: center; }
    .note { display: block; margin-top: 0.4rem; color: var(--ui-color-text-muted); }
    .actions { margin-top: 0.75rem; }
  `,
})
export class TipsSettingsComponent {
  protected readonly guidance = inject(GuidanceService);
  private readonly controller = injectUiGuidance();
  private readonly toast = inject(UiToastService);
  protected readonly resetting = signal(false);

  protected async setOn(on: boolean): Promise<void> {
    // Through the library's controller, so a tip on screen this session follows too.
    if (this.controller) await this.controller.setTipsOn(on);
    else await this.guidance.setTipsOn(on);
  }

  protected async again(): Promise<void> {
    if (this.resetting()) return;
    this.resetting.set(true);
    try {
      if (this.controller) await this.controller.reset();
      else await this.guidance.reset();
      this.toast.success('Tips are on, and the ones you saw will show again.');
    } finally {
      this.resetting.set(false);
    }
  }
}
