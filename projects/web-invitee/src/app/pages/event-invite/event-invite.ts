import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiResult } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { TokenStore } from '../../shared/services/token-store.service';
import { InviteViewState } from '../../shared/utils/enums/view-state.enum';
import { ApiError } from '../../shared/utils/types/api-error';

/**
 * Shared campaign link (`/e/:campaignId`). The eventGuard has already ensured the visitor is
 * OTP-verified; this page no longer draws the invitation itself.
 *
 * It used to build a sandboxed iframe and post the data in. The invitation is now rendered on the
 * server as one top-level document, which removes two whole classes of bug: data applied twice (the
 * binder ran on load AND on every host message, and a gallery that cloned each pass went six photos
 * to thirty-six to two hundred and sixteen), and `vh` units inside a frame the phone's URL bar
 * resizes mid-scroll. So all this does is ask where to go, and go there.
 */
@Component({
  selector: 'app-event-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiResult, UiSpinner, UiText],
  templateUrl: './event-invite.html',
  styleUrl: './event-invite.scss',
})
export class EventInviteComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private tokens = inject(TokenStore);

  protected readonly ViewState = InviteViewState;
  protected readonly state = signal<InviteViewState>(InviteViewState.Loading);
  protected readonly message = signal('');

  private campaignId = '';

  ngOnInit(): void {
    this.campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';
    this.api.invitationRenderLink(this.campaignId).subscribe({
      // A full navigation, not a router hop: the invitation lives on its own host, under a content
      // security policy this app must not be inside of.
      next: ({ url }) => window.location.replace(url),
      error: (err: ApiError) => this.handleError(err),
    });
  }

  private handleError(err: ApiError): void {
    // 401/403 → the stored session is missing, expired or invalid (an invalid bearer comes back 403,
    // not 401). Clear it and re-verify. 404 → the verified email really isn't on the guest list.
    if (err.status === 401 || err.status === 403) {
      this.tokens.clearToken();
      void this.router.navigate(['/login'], {
        queryParams: { returnTo: `/e/${this.campaignId}`, note: 'private-invite' },
      });
      return;
    }
    if (err.status === 404) {
      this.state.set(InviteViewState.NotOnList);
      return;
    }
    this.message.set(err.message);
    this.state.set(InviteViewState.Error);
  }

  goInbox(): void {
    this.router.navigate(['/inbox']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
