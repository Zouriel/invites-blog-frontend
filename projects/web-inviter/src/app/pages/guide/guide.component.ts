import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiBadge } from 'ui/badge';
import { UiAlert } from 'ui/alert';
import { UiText } from 'ui/text';
import { UiColumn, UiTable } from 'ui/table';

type ColumnRow = Record<'column' | 'required' | 'purpose', string>;
type ExampleRow = Record<'email' | 'phone' | 'name' | 'role' | 'gender', string>;

@Component({
  selector: 'app-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiCard, UiBadge, UiAlert, UiText, UiTable],
  templateUrl: './guide.component.html',
  styleUrl: './guide.component.scss',
})
export class GuideComponent {
  protected readonly columnDefs: UiColumn<ColumnRow>[] = [
    { key: 'column', header: 'Column' },
    { key: 'required', header: 'Required?' },
    { key: 'purpose', header: "What it's for" },
  ];

  protected readonly columnRows: ColumnRow[] = [
    { column: 'email', required: 'One of email/phone', purpose: 'Where the invite is emailed.' },
    {
      column: 'phone',
      required: 'One of email/phone',
      purpose: 'For phone-based channels (include country code where possible).',
    },
    { column: 'name', required: 'Recommended', purpose: 'Personalizes the greeting for each guest.' },
    { column: 'role', required: 'Optional', purpose: 'Drives role-specific content.' },
    { column: 'gender', required: 'Optional', purpose: 'Selects gender-specific wording and dress code.' },
  ];

  protected readonly exampleDefs: UiColumn<ExampleRow>[] = [
    { key: 'email', header: 'email' },
    { key: 'phone', header: 'phone' },
    { key: 'name', header: 'name' },
    { key: 'role', header: 'role' },
    { key: 'gender', header: 'gender' },
  ];

  protected readonly exampleRows: ExampleRow[] = [
    { email: 'amira@example.com', phone: '+9607771234', name: 'Amira Saleem', role: 'bridesmaid', gender: 'female' },
    { email: 'yusuf@example.com', phone: '+9607775678', name: 'Yusuf Ali', role: 'groomsman', gender: 'male' },
    { email: '—', phone: '+9607779012', name: 'The Ahmed Family', role: 'family', gender: 'neutral' },
    { email: 'vip@example.com', phone: '—', name: 'Hon. Ibrahim', role: 'vip', gender: 'male' },
  ];

  protected readonly roleChips = ['bridesmaid', 'groomsman', 'family', 'vip', 'guest'];
  protected readonly genderChips = ['male', 'female', 'neutral'];
}
