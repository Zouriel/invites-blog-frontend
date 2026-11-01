import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { COMPANY } from '../../shared/utils/constants/company';

/** Public, for anyone: how to delete an invites.blog account and what happens. Google Play links here. */
@Component({
  selector: 'app-delete-account-info',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink],
  templateUrl: './delete-account-info.component.html',
  styleUrl: '../terms/terms.component.scss',
})
export class DeleteAccountInfoComponent {
  protected readonly company = COMPANY;
}
