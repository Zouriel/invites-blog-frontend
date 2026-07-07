import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiBadge } from 'ui/badge';
import { UiSpinner } from 'ui/spinner';
import { UiEmptyState } from 'ui/feedback';
import { UiContainer, UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { TokenStore } from '../../shared/services/token-store.service';
import { InboxCard } from '../../shared/utils/types/api.types';
import { rsvpLabel, rsvpTone } from '../../shared/utils/rsvp.util';

@Component({
  selector: 'app-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    UiButton,
    UiCard,
    UiBadge,
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

  constructor() {
    this.load();
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
