import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiText } from 'ui/text';

@Component({
  selector: 'app-terms',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiText],
  templateUrl: './terms.component.html',
  styleUrl: './terms.component.scss',
})
export class TermsComponent {}
