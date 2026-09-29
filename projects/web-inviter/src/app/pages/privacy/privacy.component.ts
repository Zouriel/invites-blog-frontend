import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { COMPANY, COMPANY_ADDRESS_LINE } from '../../shared/utils/constants/company';

@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {
  protected readonly company = COMPANY;
  protected readonly addressLine = COMPANY_ADDRESS_LINE;
}
