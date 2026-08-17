import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { UiAlert } from 'ui/alert';
import { UiBadge } from 'ui/badge';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiEmptyState } from 'ui/feedback';
import { UiFormField, UiInput, UiOtpInput } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiTab, UiTabs } from 'ui/tabs';
import { UiText } from 'ui/text';
import { UiToastService } from 'ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { CodeSent, MyRequest } from '../../shared/utils/types/api.types';

/**
 * The signed-in person's own corner: the bespoke designs they've asked for and the identifiers their
 * account answers to. Invitations themselves live in the [inbox]{@link ../inbox}.
 *
 * Linking the second identifier is the interesting part — it's what joins the phone someone booked
 * an invitation with to the email they design under, so both histories appear in one place.
 */
@Component({
  selector: 'app-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, FormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState,
    UiFormField, UiInput, UiOtpInput, UiSpinner, UiTab, UiTabs, UiText,
  ],
  templateUrl: './me.component.html',
  styleUrl: './me.component.scss',
})
export class MeComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(UiToastService);

  protected readonly account = this.session.account;
  protected readonly loading = signal(true);
  protected readonly requests = signal<MyRequest[]>([]);

  // Linking a second identifier.
  protected identifier = '';
  protected code = '';
  protected readonly linking = signal(false);
  protected readonly linkSent = signal<CodeSent | null>(null);
  protected readonly linkError = signal<string | null>(null);

  /** What's still missing from the account — the thing worth inviting them to add. */
  protected readonly missing = computed(() => {
    const a = this.account();
    if (!a) return null;
    if (!a.phoneE164) return 'phone';
    if (!a.email) return 'email';
    return null;
  });

  constructor() {
    this.load();
  }

  protected startLink(): void {
    if (!this.identifier.trim()) {
      this.linkError.set('Enter the number or email you want to add.');
      return;
    }
    this.linkError.set(null);
    this.linking.set(true);
    this.api.requestLinkCode(this.identifier.trim()).subscribe({
      next: (sent) => {
        this.linkSent.set(sent);
        this.linking.set(false);
      },
      error: (e: Error) => {
        this.linking.set(false);
        this.linkError.set(e.message);
      },
    });
  }

  protected confirmLink(): void {
    const sent = this.linkSent();
    if (!sent || this.code.trim().length < 6) {
      this.linkError.set('Enter the 6-digit code.');
      return;
    }
    this.linkError.set(null);
    this.linking.set(true);
    this.api.verifyLinkCode(sent.challengeId, this.code.trim()).subscribe({
      next: (result) => {
        // Take the refreshed token as well: a merge can add roles, and the old token predates them —
        // keeping it would 401 on the very screens they just gained.
        this.session.set(result.token, result.account);
        this.linking.set(false);
        this.linkSent.set(null);
        this.identifier = '';
        this.code = '';
        this.toast.success(
          result.merged
            ? `Accounts joined — ${result.mergeSummary}. Everything is in one place now.`
            : 'Added to your account.',
        );
        this.load();
      },
      error: (e: Error) => {
        this.linking.set(false);
        this.linkError.set(e.message);
      },
    });
  }

  protected cancelLink(): void {
    this.linkSent.set(null);
    this.code = '';
    this.linkError.set(null);
  }

  private load(): void {
    this.loading.set(true);
    this.api.myRequests().subscribe({
      next: (list) => {
        this.requests.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
