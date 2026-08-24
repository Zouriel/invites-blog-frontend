import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiBadge } from '@zouriel/ui/badge';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiContainer, UiStack } from '@zouriel/ui/layout';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { TokenStore } from '../../shared/services/token-store.service';
import { UiAlert } from '@zouriel/ui/alert';
import { UiFormField, UiOtpInput } from '@zouriel/ui/form';
import { InboxCard, LinkableContact } from '../../shared/utils/types/api.types';
import { rsvpLabel, rsvpTone } from '../../shared/utils/rsvp.util';

@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    UiAlert,
    UiButton,
    UiCard,
    UiBadge,
    UiFormField,
    UiOtpInput,
    UiSpinner,
    UiEmptyState,
    UiContainer,
    UiStack,
    UiText,
  ],
  templateUrl: './inbox.html',
  styleUrl: './inbox.scss',
})
export class InboxComponent {
  private api = inject(ApiService);
  private tokens = inject(TokenStore);
  private router = inject(Router);

  protected readonly cards = signal<InboxCard[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly rsvpLabel = rsvpLabel;
  protected readonly rsvpTone = rsvpTone;

  // --- adding a second contact -------------------------------------------------------------
  /** Offers discovered from guest rows; empty unless a host paired another contact with this one. */
  protected readonly linkable = signal<LinkableContact[]>([]);
  protected readonly linkTarget = signal<LinkableContact | null>(null);
  protected readonly linkChallengeId = signal('');
  protected readonly linkCode = signal('');
  protected readonly linkBusy = signal(false);
  protected readonly linkError = signal('');
  protected readonly linkDone = signal('');

  constructor() {
    this.load();
    this.loadLinkable();
  }

  private loadLinkable(): void {
    this.api.getLinkableContacts().subscribe({
      next: (list) => this.linkable.set(list ?? []),
      error: () => this.linkable.set([]),   // never block the inbox on an optional offer
    });
  }

  /** Sends a code to the offered contact and switches the card into code-entry mode. */
  protected startLink(target: LinkableContact): void {
    if (this.linkBusy()) return;
    this.linkBusy.set(true);
    this.linkError.set('');
    this.api.requestContactLinkCode(target.masked).subscribe({
      next: (res) => {
        this.linkChallengeId.set(res.challengeId);
        this.linkTarget.set(target);
        this.linkBusy.set(false);
      },
      error: (e: Error) => {
        this.linkError.set(e.message || "We couldn't send that code.");
        this.linkBusy.set(false);
      },
    });
  }

  protected confirmLink(): void {
    if (this.linkBusy() || this.linkCode().length !== 6) return;
    this.linkBusy.set(true);
    this.linkError.set('');
    this.api.verifyContactLink(this.linkChallengeId(), this.linkCode()).subscribe({
      next: (res) => {
        this.linkBusy.set(false);
        this.cancelLink();
        this.linkDone.set(`${res.masked} added to your inbox.`);
        this.linkable.set([]);
        this.load();          // the inbox is wider now
        this.loadLinkable();
      },
      error: (e: Error) => {
        this.linkError.set(e.message || 'That code did not work.');
        this.linkBusy.set(false);
      },
    });
  }

  protected cancelLink(): void {
    this.linkTarget.set(null);
    this.linkChallengeId.set('');
    this.linkCode.set('');
    this.linkError.set('');
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.api.getMyInvites().subscribe({
      next: (cards) => {
        this.cards.set(cards ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }

  open(card: InboxCard): void {
    this.router.navigate(['/invites', card.inviteId], { state: { card } });
  }

  signOut(): void {
    this.tokens.clearToken();
    this.router.navigate(['/']);
  }
}
