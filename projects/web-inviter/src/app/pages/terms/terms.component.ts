import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';

@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {}
