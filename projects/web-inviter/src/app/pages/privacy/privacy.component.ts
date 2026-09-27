import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';

@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {}
