import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiModal, UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiRadioGroup, UiTextarea } from '@zouriel/ui/form';
import { ApiService } from '../api/api.service';

/**
 * "Report this template". Gallery templates made in the designer go live without review, so anyone
 * browsing — signed in or not — can flag one for an admin to look at.
 */
@Component({
  selector: 'app-report-template',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, UiButton, UiModal, UiFormField, UiRadioGroup, UiTextarea],
  template: `
    <button type="button" class="link" (click)="open.set(true)">Report this template</button>
    <ui-modal [(open)]="open" title="Report this template" size="sm">
      <div class="body">
        @if (sent()) {
          <p>Thanks — an admin will take a look.</p>
          <div class="actions"><ui-button variant="primary" (click)="open.set(false)">Done</ui-button></div>
        } @else {
          <ui-form-field label="What's wrong?">
            <ui-radio-group [(ngModel)]="reason" name="reason" [options]="reasons" label="What's wrong?" />
          </ui-form-field>
          <ui-form-field label="Anything else? (optional)">
            <ui-textarea [(ngModel)]="details" [rows]="3" placeholder="Tell us what you noticed" />
          </ui-form-field>
          <div class="actions">
            <ui-button variant="ghost" (click)="open.set(false)">Cancel</ui-button>
            <ui-button variant="primary" [loading]="sending()" [disabled]="!reason" (click)="send()">Send report</ui-button>
          </div>
        }
      </div>
    </ui-modal>
  `,
  styles: `
    .link { padding: 0; border: 0; background: none; color: var(--ui-color-text-muted); font: inherit; font-size: var(--ui-font-size-sm); text-decoration: underline; cursor: pointer; }
    .link:hover { color: var(--ui-color-text); }
    .link:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); border-radius: 2px; }
    .body { display: grid; gap: 14px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; }
  `,
})
export class ReportTemplateComponent {
  private readonly api = inject(ApiService);
  private readonly toast = inject(UiToastService);

  templateId = input.required<string>();

  protected readonly open = signal(false);
  protected readonly sending = signal(false);
  protected readonly sent = signal(false);
  protected reason = '';
  protected details = '';
  protected readonly reasons = [
    { value: 'offensive', label: 'Offensive or inappropriate' },
    { value: 'copyright', label: 'Copies someone else’s work' },
    { value: 'spam', label: 'Spam or advertising' },
    { value: 'broken', label: 'Broken or doesn’t work' },
    { value: 'other', label: 'Something else' },
  ];

  protected async send(): Promise<void> {
    this.sending.set(true);
    try {
      await firstValueFrom(this.api.reportTemplate(this.templateId(), this.reason, this.details));
      this.sent.set(true);
    } catch {
      // The API toast explains it.
    } finally {
      this.sending.set(false);
    }
  }
}
