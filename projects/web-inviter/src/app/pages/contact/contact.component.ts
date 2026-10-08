import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';
import { SettingsBackComponent } from '../../shared/settings-trail/settings-back.component';
import { COMPANY } from '../../shared/utils/constants/company';

/** Who runs invites.blog and how to reach them: the business details the bank's card rules require. */
@Component({
  selector: 'app-contact',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SettingsBackComponent, UiText, RouterLink],
  templateUrl: './contact.component.html',
  styleUrl: '../terms/terms.component.scss',
  styles: [
    `
      address {
        font-style: normal;
        line-height: 1.6;
        margin: 0 0 1rem;
      }
      dl {
        display: grid;
        grid-template-columns: max-content 1fr;
        gap: 0.4rem 1.25rem;
        margin: 0 0 1rem;
      }
      dt {
        color: var(--ui-color-text-muted);
      }
      dd {
        margin: 0;
      }
    `,
  ],
})
export class ContactComponent {
  protected readonly company = COMPANY;
}
