import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { CHARGE, COMPANY } from '../../shared/utils/constants/company';

/**
 * Refunds, cancellation and delivery in one place, written to be read before paying: the checkout
 * links here, and the bank's card rules require a limited-refund policy to be clear before purchase.
 */
@Component({
  selector: 'app-refunds',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink],
  templateUrl: './refunds.component.html',
  styleUrl: '../terms/terms.component.scss',
})
export class RefundsComponent {
  protected readonly company = COMPANY;
  protected readonly charge = CHARGE;
}
