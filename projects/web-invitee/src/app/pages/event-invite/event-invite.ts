import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { UiButton, UiFab } from 'ui/button';
import { UiResult } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { TokenStore } from '../../shared/services/token-store.service';
import { InviteViewState } from '../../shared/utils/enums/view-state.enum';
import { MyInvite } from '../../shared/utils/types/api.types';
import { ApiError } from '../../shared/utils/types/api-error';

/**
 * Shared campaign link (`/e/:campaignId`). The eventGuard has already ensured the visitor is
 * email-OTP-verified; here we fetch THEIR personalized invite (matched to their verified email) and
 * render it in the native-scrolling sandbox. Emails not on the guest list are refused.
 */
@Component({
  selector: 'app-event-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiFab, UiResult, UiSpinner, UiText],
  templateUrl: './event-invite.html',
  styleUrl: './event-invite.scss',
})
export class EventInviteComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);
  private tokens = inject(TokenStore);

  private readonly frameRef = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly ViewState = InviteViewState;
  protected readonly state = signal<InviteViewState>(InviteViewState.Loading);
  protected readonly message = signal('');
  protected readonly iframeSrc = signal<SafeResourceUrl | null>(null);

  private campaignId = '';
  private inviteId = '';
  private inviteData: unknown = null;

  // The invite iframe scrolls its own content natively; the template runtime drives the reveal/curtain
  // from the iframe's own scroll. We only need the ready→data handshake here.
  private readonly onMessage = (event: MessageEvent): void => {
    const payload = event.data as { __inviteReady?: boolean } | null;
    if (payload?.__inviteReady === true) this.postData();
  };

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    this.campaignId = this.route.snapshot.paramMap.get('campaignId') ?? '';
    this.load();
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
  }

  private load(): void {
    this.state.set(InviteViewState.Loading);
    this.api.getMyInvite(this.campaignId).subscribe({
      next: (res: MyInvite) => {
        if (res.cancelled) {
          this.message.set(res.message ?? '');
          this.state.set(InviteViewState.Cancelled);
          return;
        }
        if (res.packageUrl) {
          this.inviteData = res.data ?? {};
          this.inviteId = res.inviteId;
          const url = res.packageUrl.endsWith('/')
            ? res.packageUrl + 'index.html'
            : res.packageUrl + '/index.html';
          this.iframeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          this.state.set(InviteViewState.Ready);
          return;
        }
        this.state.set(InviteViewState.Error);
      },
      error: (err: ApiError) => {
        // 401/403 → the stored session is missing/expired/invalid: clear it and re-verify (an invalid
        // bearer token comes back as 403, not 401). 404 → the verified email really isn't on the list.
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
      },
    });
  }

  onFrameLoad(): void {
    this.postData();
  }

  private postData(): void {
    const win = this.frameRef()?.nativeElement?.contentWindow;
    if (win && this.inviteData !== null) {
      win.postMessage({ __inviteData: this.inviteData }, '*');
    }
  }

  goRsvp(): void {
    // No token — the inbox/authenticated RSVP path (JWT + server-side ownership check).
    this.router.navigate(['/invites', this.inviteId, 'rsvp']);
  }

  saveToInbox(): void {
    this.router.navigate(['/inbox']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
