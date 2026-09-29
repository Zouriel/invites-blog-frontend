import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { CardBrandsComponent } from '../../shared/brand/card-brands.component';
import { COMPANY } from '../../shared/utils/constants/company';

/** How card details and account data are kept safe: the bank's card rules ask for this policy to be published. */
@Component({
  selector: 'app-security',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink, CardBrandsComponent],
  templateUrl: './security.component.html',
  styleUrl: '../terms/terms.component.scss',
})
export class SecurityComponent {
  protected readonly company = COMPANY;
}
