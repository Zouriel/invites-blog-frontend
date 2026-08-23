import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { UiAlert } from 'ui/alert';
import { UiButton } from 'ui/button';
import { UiResult } from 'ui/feedback';
import { UiOtpInput, UiFormField } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { TokenStore } from '../../shared/services/token-store.service';
import { InviteViewState } from '../../shared/utils/enums/view-state.enum';
import { InviteByToken, RsvpQuestion } from '../../shared/utils/types/api.types';
import { ApiError } from '../../shared/utils/types/api-error';

/**
 * Per-guest tokenized link (`/i/:token`) — the link emailed to each guest. The raw token is the key,
 * but the link is also bound to (up to 3) IP addresses/devices it already trusts: the very first open
 * ever auto-trusts its device, and later opens from anywhere else need a reauth code first (see the
 * Otp state below). That code goes to whatever contact the guest row has on file — never something the
 * visitor types in, since the link already says who they are; this is NOT the same flow as the shared
 * `/e/:campaignId` link's "enter your email" gate.
 */
@Component({
  selector: 'app-invite-token',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, UiAlert, UiButton, UiResult, UiOtpInput, UiFormField, UiSpinner, UiText],
  templateUrl: './invite-token.html',
  styleUrl: './invite-token.scss',
})
export class InviteTokenComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(ApiService);
  private tokens = inject(TokenStore);
  private sanitizer = inject(DomSanitizer);
  private fb = inject(NonNullableFormBuilder);

  private readonly frameRef = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly ViewState = InviteViewState;
  protected readonly state = signal<InviteViewState>(InviteViewState.Loading);
  protected readonly message = signal('');
  protected readonly iframeSrc = signal<SafeResourceUrl | null>(null);
  /** True once this invitation is tied to the viewer's verified contact, so it stays in their inbox. */
  protected readonly claimed = signal(false);
  protected readonly claiming = signal(false);

  // --- Reauth (this device/location isn't among the invite's trusted ones yet) ---
  /** Undefined until a code has been requested; then "email" or "sms" says where to look. */
  protected readonly reauthChannel = signal<'email' | 'sms' | undefined>(undefined);
  protected readonly reauthRequesting = signal(false);
  protected readonly reauthVerifying = signal(false);
  protected readonly reauthError = signal('');
  private reauthChallengeId = '';

  protected readonly reauthForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.minLength(6)]),
  });
  private readonly reauthCode = toSignal(this.reauthForm.controls.code.valueChanges, { initialValue: '' });
  protected readonly canVerifyReauth = computed(() => this.reauthCode().length === 6);

  private token = '';
  private inviteData: unknown = null;
  private questions: RsvpQuestion[] = [];

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
      next: (res: InviteByToken) => this.handleResponse(res),
      error: (err: ApiError) => this.handleError(err),
    });
  }

  /** Shared by the initial load and a successful reauth — both return the same shape. */
  private handleResponse(res: InviteByToken): void {
    if (res.cancelled) {
      this.message.set(res.message ?? '');
      this.state.set(InviteViewState.Cancelled);
      return;
    }
    // Not among the (up to 3) devices/locations this invite already trusts — reauth in place, no
    // navigation away: the link is user-bound, so there's nothing to ask the visitor to type.
    if (res.requiresOtp) {
      this.state.set(InviteViewState.Otp);
      return;
    }
    if (res.packageUrl) {
      this.questions = res.rsvpQuestions ?? [];
      this.inviteData = res.data ?? {};
      const url = res.packageUrl.endsWith('/')
        ? res.packageUrl + 'index.html'
        : res.packageUrl + '/index.html';
      this.iframeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      this.state.set(InviteViewState.Ready);
      this.claimIfSignedIn();
      return;
    }
    this.state.set(InviteViewState.Error);
  }

  private handleError(err: ApiError): void {
    // 404 → the token is invalid or expired (e.g. the campaign was re-finalized with fresh tokens).
    if (err.status === 404) {
      this.state.set(InviteViewState.Error);
      return;
    }
    this.message.set(err.message);
    this.state.set(InviteViewState.Error);
  }

  /** First step of reauth: ask the server to send a code — no contact entry, it already knows. */
  requestReauth(): void {
    if (this.reauthRequesting()) return;
    this.reauthError.set('');
    this.reauthRequesting.set(true);
    this.api.requestInviteReauth(this.token).subscribe({
      next: (res) => {
        this.reauthRequesting.set(false);
        this.reauthChallengeId = res.challengeId;
        this.reauthChannel.set(res.channel);
      },
      error: (err: ApiError) => {
        this.reauthRequesting.set(false);
        this.reauthError.set(err.message);
      },
    });
  }

  /** Second step: verify the code. Success renders the invite exactly like a trusted open would. */
  verifyReauth(): void {
    if (!this.canVerifyReauth() || this.reauthVerifying()) return;
    this.reauthError.set('');
    this.reauthVerifying.set(true);
    this.api.verifyInviteReauth(this.token, {
      challengeId: this.reauthChallengeId,
      code: this.reauthForm.controls.code.value,
    }).subscribe({
      next: (res) => {
        this.reauthVerifying.set(false);
        this.handleResponse(res);
      },
      error: (err: ApiError) => {
        this.reauthVerifying.set(false);
        this.reauthError.set(err.message);
      },
    });
  }

  /** Back to "we don't recognize this device" — e.g. the code expired or they want a fresh one. */
  resendReauth(): void {
    this.reauthChannel.set(undefined);
    this.reauthForm.reset({ code: '' });
    this.requestReauth();
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

  /**
   * A tokenized link is the whole key, so it works for anyone holding it — which means the
   * invitation is not attached to anybody until someone proves a contact. Once the viewer HAS
   * proved one, tie it to them so it keeps showing up in their inbox without the original link.
   */
  private claimIfSignedIn(): void {
    if (!this.tokens.isAuthenticated || this.claimed()) return;
    this.claiming.set(true);
    this.api.claimInvite(this.token).subscribe({
      next: () => {
        this.claiming.set(false);
        this.claimed.set(true);
      },
      // Best-effort: failing to file it away must never spoil opening the invitation.
      error: () => this.claiming.set(false),
    });
  }

  /** Not signed in yet — verify a contact first, then come back here and claim automatically. */
  saveToInbox(): void {
    void this.router.navigate(['/login'], {
      queryParams: { returnTo: `/i/${this.token}` },
    });
  }

  protected get signedIn(): boolean {
    return this.tokens.isAuthenticated;
  }

  goRsvp(): void {
    // Anonymous by-token RSVP — the token authorizes the response (no login). The host's questions
    // ride along so the form doesn't have to fetch the whole invitation again to learn what to ask.
    this.router.navigate(['/i', this.token, 'rsvp'], { state: { questions: this.questions } });
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
