import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UiButton } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';
import { UiAlert } from '@zouriel/ui/alert';
import { UiColumn, UiTable } from '@zouriel/ui/table';

type ColumnRow = Record<'column' | 'required' | 'purpose', string>;
type ExampleRow = Record<'email' | 'phone' | 'name' | 'role' | 'gender', string>;

/**
 * The guest list guide. Documents exactly what GuestUploadParser in the backend accepts — keep the
 * two in step: header names, the role separators, and which rows are skipped or rejected.
 */
@Component({
  selector: 'app-guest-list-guide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiBadge, UiAlert, UiTable],
  templateUrl: './guest-list-guide.component.html',
  styleUrls: ['../guide-prose.scss', './guest-list-guide.component.scss'],
})
export class GuestListGuideComponent {
  protected readonly columnDefs: UiColumn<ColumnRow>[] = [
    { key: 'column', header: 'Column' },
    { key: 'required', header: 'Required?' },
    { key: 'purpose', header: 'What it’s for' },
  ];

  protected readonly columnRows: ColumnRow[] = [
    { column: 'email', required: 'Email or phone', purpose: 'Where the invitation is emailed.' },
    {
      column: 'phone',
      required: 'Email or phone',
      purpose: 'For sending by phone. Start with + and the country code, or pick a default country when you upload.',
    },
    { column: 'name', required: 'Recommended', purpose: 'The greeting on the invitation. Left blank, the guest is called “Guest”.' },
    {
      column: 'role',
      required: 'Yes, if your invitation has roles',
      purpose: 'Which sections, fields and dress colours this guest gets. One role or several.',
    },
    { column: 'gender', required: 'Optional', purpose: 'For wording or sections that depend on gender.' },
  ];

  protected readonly exampleDefs: UiColumn<ExampleRow>[] = [
    { key: 'email', header: 'email' },
    { key: 'phone', header: 'phone' },
    { key: 'name', header: 'name' },
    { key: 'role', header: 'role' },
    { key: 'gender', header: 'gender' },
  ];

  /** Role names here stand in for whatever the host typed on their own Roles step. */
  protected readonly exampleRows: ExampleRow[] = [
    { email: 'amira@example.com', phone: '+9607771234', name: 'Amira Saleem', role: 'Bridesmaids', gender: 'female' },
    { email: 'yusuf@example.com', phone: '+9607775678', name: 'Yusuf Ali', role: 'Groomsmen', gender: 'male' },
    {
      email: '',
      phone: '+9607779012',
      name: 'Ali and family',
      role: 'Groom family men; Groom family women',
      gender: '',
    },
    { email: 'vip@example.com', phone: '', name: 'Hon. Ibrahim', role: 'VIP; Groom family men', gender: 'male' },
  ];

  protected readonly separators = [';', ',', '|'];
  protected readonly genderChips = ['male', 'female', 'neutral', 'unspecified'];

  /**
   * A plain `<a href download>` styled as a button would nest an anchor around a native
   * `<button>` (ui-button always renders one) — invalid markup and a double focus stop. Trigger
   * the download from the button's click instead, via a throwaway anchor never added to the DOM.
   */
  protected downloadTemplate(): void {
    const a = document.createElement('a');
    a.href = 'guest-list-template.xlsx';
    a.download = 'guest-list-template.xlsx';
    a.click();
  }
}
