import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from 'ui/button';
import { UiCard } from 'ui/card';
import { UiBadge } from 'ui/badge';
import { UiEmptyState } from 'ui/feedback';
import { UiContainer, UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { InboxCard } from '../../shared/utils/types/api.types';
import { rsvpLabel, rsvpTone } from '../../shared/utils/rsvp.util';

@Component({
  selector: 'app-invite-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    UiButton,
    UiCard,
    UiBadge,
    UiEmptyState,
    UiContainer,
    UiStack,
    UiText,
  ],
  templateUrl: './invite-detail.html',
  styleUrl: './invite-detail.scss',
})
export class InviteDetailComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Prefer the card passed via router state from the inbox; falls back gracefully.
  protected readonly card = signal<InboxCard | null>(this.readCard());

  protected readonly rsvpLabel = rsvpLabel;
  protected readonly rsvpTone = rsvpTone;

  private readCard(): InboxCard | null {
    const state = (this.router.getCurrentNavigation()?.extras.state ?? history.state) as {
      card?: InboxCard;
    } | null;
    const card = state?.card ?? null;
    const id = this.route.snapshot.paramMap.get('inviteId');
    if (card && card.inviteId === id) {
      return card;
    }
    return null;
  }

  goInbox(): void {
    this.router.navigate(['/inbox']);
  }

  updateRsvp(inviteId: string): void {
    this.router.navigate(['/invites', inviteId, 'rsvp']);
  }
}
