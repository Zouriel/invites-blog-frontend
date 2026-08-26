import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiText } from '@zouriel/ui/text';

@Component({
  selector: 'app-privacy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiText],
  templateUrl: './privacy.component.html',
  styleUrl: './privacy.component.scss',
})
export class PrivacyComponent {}
