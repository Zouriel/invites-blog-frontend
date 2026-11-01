import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { COMPANY } from '../../shared/utils/constants/company';

/** Public, for anyone: our standards against child sexual abuse and exploitation. Google Play links here. */
@Component({
  selector: 'app-child-safety',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink],
  templateUrl: './child-safety.component.html',
  styleUrl: '../terms/terms.component.scss',
})
export class ChildSafetyComponent {
  protected readonly company = COMPANY;
}
