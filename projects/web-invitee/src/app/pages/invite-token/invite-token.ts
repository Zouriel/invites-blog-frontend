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
  private readonly stageRef = viewChild<ElementRef<HTMLElement>>('stage');

  protected readonly ViewState = InviteViewState;
  protected readonly state = signal<InviteViewState>(InviteViewState.Loading);
  protected readonly message = signal('');
  protected readonly iframeSrc = signal<SafeResourceUrl | null>(null);
  protected readonly token = signal('');
  /** The invite's own scrollable content height; used to size a page-scroll spacer so the PAGE
   *  scrolls (works on iOS Safari, which never scrolls iframes internally). The iframe itself stays
   *  a fixed 100vh sticky box; we drive its internal scroll programmatically from page progress. */
  protected readonly stageHeight = signal<number | null>(null);

  /** The inner `data` payload posted to the sandboxed invite iframe. */
  private inviteData: unknown = null;
  private scrollScheduled = false;

  // Messages from the sandboxed invite: ready → push data; scroll-height → size the spacer + kick off.
  private readonly onMessage = (event: MessageEvent): void => {
    const payload = event.data as { __inviteReady?: boolean; __inviteScrollHeight?: number } | null;
    if (!payload) return;
    if (payload.__inviteReady === true) this.postData();
    if (typeof payload.__inviteScrollHeight === 'number' && payload.__inviteScrollHeight > 0) {
      this.stageHeight.set(payload.__inviteScrollHeight);
      this.postProgress();
    }
  };

  // Map the page's scroll position to a 0..1 progress and forward it so the invite scrubs itself.
  private readonly onScroll = (): void => {
    if (this.scrollScheduled) return;
    this.scrollScheduled = true;
    requestAnimationFrame(() => {
      this.scrollScheduled = false;
      this.postProgress();
    });
  };

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    window.addEventListener('scroll', this.onScroll, { passive: true });
    window.addEventListener('resize', this.onScroll, { passive: true });
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);
    this.load(token);
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
  }

  private postProgress(): void {
    const stage = this.stageRef()?.nativeElement;
    const win = this.frameRef()?.nativeElement?.contentWindow;
    if (!stage || !win) return;
    const scrollable = stage.offsetHeight - window.innerHeight;
    const progress = scrollable > 0 ? Math.min(1, Math.max(0, -stage.getBoundingClientRect().top / scrollable)) : 0;
    win.postMessage({ __inviteProgress: progress }, '*');
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

  // Fired when the iframe document finishes loading. We push data immediately as
  // a fallback, and again whenever the template announces {__inviteReady:true}.
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

  goRemove(): void {
    this.router.navigate(['/privacy/remove', this.token()]);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
