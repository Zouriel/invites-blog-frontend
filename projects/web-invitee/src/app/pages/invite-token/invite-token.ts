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
import { UiButton } from 'ui/button';
import { UiResult } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { InviteViewState } from '../../shared/utils/enums/view-state.enum';
import { InviteByToken } from '../../shared/utils/types/api.types';
import { ApiError } from '../../shared/utils/types/api-error';

/**
 * Per-guest tokenized link (`/i/:token`) — the link emailed to each guest. The raw token IS the key:
 * we render the guest's invite directly, no email OTP (that gate is only on the shared `/e/:campaignId`
 * link). Sensitive campaigns still require OTP, so those are bounced to the email-verify flow.
 */
@Component({
  selector: 'app-invite-token',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiResult, UiSpinner, UiText],
  templateUrl: './invite-token.html',
  styleUrl: './invite-token.scss',
})
export class InviteTokenComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private sanitizer = inject(DomSanitizer);

  private readonly frameRef = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly ViewState = InviteViewState;
  protected readonly state = signal<InviteViewState>(InviteViewState.Loading);
  protected readonly message = signal('');
  protected readonly iframeSrc = signal<SafeResourceUrl | null>(null);

  private token = '';
  private inviteData: unknown = null;

  // The invite iframe scrolls its own content natively; the template runtime drives the reveal/curtain
  // from the iframe's own scroll. We only need the ready→data handshake here.
  private readonly onMessage = (event: MessageEvent): void => {
    const payload = event.data as { __inviteReady?: boolean } | null;
    if (payload?.__inviteReady === true) this.postData();
  };

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.load();
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
  }

  private load(): void {
    this.state.set(InviteViewState.Loading);
    this.api.getInviteByToken(this.token).subscribe({
      next: (res: InviteByToken) => {
        if (res.cancelled) {
          this.message.set(res.message ?? '');
          this.state.set(InviteViewState.Cancelled);
          return;
        }
        // Sensitive campaigns can't be opened by token alone — send the guest through email verify.
        if (res.requiresOtp) {
          void this.router.navigate(['/login'], {
            queryParams: { returnTo: '/inbox', note: 'private-invite' },
          });
          return;
        }
        if (res.packageUrl) {
          this.inviteData = res.data ?? {};
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
        // 404 → the token is invalid or expired (e.g. the campaign was re-finalized with fresh tokens).
        if (err.status === 404) {
          this.state.set(InviteViewState.Error);
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
    // Anonymous by-token RSVP — the token authorizes the response (no login).
    this.router.navigate(['/i', this.token, 'rsvp']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
