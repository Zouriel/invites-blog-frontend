import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { CHARGE, COMPANY, COMPANY_ADDRESS_LINE } from '../../shared/utils/constants/company';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';

@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {
  protected readonly company = COMPANY;
  protected readonly addressLine = COMPANY_ADDRESS_LINE;
  protected readonly charge = CHARGE;
}
