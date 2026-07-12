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
import { UiCard } from 'ui/card';
import { UiResult } from 'ui/feedback';
import { UiSpinner } from 'ui/spinner';
import { UiStack } from 'ui/layout';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { InviteViewState } from '../../shared/utils/enums/view-state.enum';
import { InviteByToken } from '../../shared/utils/types/api.types';
import { ApiError } from '../../shared/utils/types/api-error';

@Component({
  selector: 'app-invite-token',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiButton, UiFab, UiCard, UiResult, UiSpinner, UiStack, UiText],
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
  protected readonly token = signal('');

  /** The inner `data` payload posted to the sandboxed invite iframe. */
  private inviteData: unknown = null;

  // The invite iframe scrolls its own content natively; the template's runtime drives the reveal /
  // curtain animation from the iframe's own scroll. We only need the ready→data handshake here.
  private readonly onMessage = (event: MessageEvent): void => {
    const payload = event.data as { __inviteReady?: boolean } | null;
    if (payload?.__inviteReady === true) this.postData();
  };

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);
    this.load(token);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
  }

  private load(token: string): void {
    this.state.set(InviteViewState.Loading);
    this.api.getInviteByToken(token).subscribe({
      next: (res: InviteByToken) => {
        if (res.cancelled) {
          this.message.set(res.message ?? '');
          this.state.set(InviteViewState.Cancelled);
          return;
        }
        if (res.requiresOtp) {
          this.state.set(InviteViewState.Otp);
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
        this.message.set(res.error ?? '');
        this.state.set(InviteViewState.Error);
      },
      error: (err: ApiError) => {
        this.message.set(err.message);
        this.state.set(InviteViewState.Error);
      },
    });
  }

  // Fired when the iframe document finishes loading. We push data immediately as a fallback, and
  // again whenever the template announces {__inviteReady:true}.
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
    this.router.navigate(['/invites', this.token(), 'rsvp'], {
      queryParams: { token: this.token() },
    });
  }

  goVerify(): void {
    this.router.navigate(['/login'], {
      queryParams: { returnTo: `/i/${this.token()}`, note: 'private-invite' },
    });
  }

  saveToInbox(): void {
    this.router.navigate(['/login'], { queryParams: { returnTo: '/inbox' } });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
