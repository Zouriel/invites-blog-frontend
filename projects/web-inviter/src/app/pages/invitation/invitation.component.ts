import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { UiButton } from 'ui/button';
import { UiModal, UiToastService } from 'ui/dialog';
import { UiResult } from 'ui/feedback';
import { UiFormField, UiInput, UiNumberInput, UiTextarea } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { MyInvitation, RsvpBody } from '../../shared/utils/types/api.types';

type ViewState = 'loading' | 'ready' | 'cancelled' | 'error';

/**
 * An invitation you RECEIVED, opened while signed in.
 *
 * The invitation itself is a self-contained template package rendered in a sandboxed frame — the same
 * thing a guest sees from an emailed link. What differs is the key: no invitation token here, the
 * account's verified email or phone is what puts you on the guest list, so this works from the inbox
 * even for invitations that arrived before the account existed.
 */
@Component({
  selector: 'app-invitation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink, UiButton, UiFormField, UiInput, UiModal, UiNumberInput,
    UiResult, UiSpinner, UiText, UiTextarea,
  ],
  templateUrl: './invitation.component.html',
  styleUrl: './invitation.component.scss',
})
export class InvitationComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly toast = inject(UiToastService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly campaignId = input.required<string>();

  private readonly frameRef = viewChild<ElementRef<HTMLIFrameElement>>('frame');

  protected readonly state = signal<ViewState>('loading');
  protected readonly message = signal('');
  protected readonly iframeSrc = signal<SafeResourceUrl | null>(null);
  protected readonly rsvpStatus = signal<string>('NoResponse');

  protected readonly showRsvp = signal(false);
  protected readonly sending = signal(false);
  protected readonly choice = signal<RsvpBody['status']>('Going');
  protected readonly guestCount = signal(1);
  protected readonly meal = signal('');
  protected readonly arrival = signal('');
  protected readonly note = signal('');

  protected readonly choices: { value: RsvpBody['status']; label: string }[] = [
    { value: 'Going', label: "I'll be there" },
    { value: 'Maybe', label: 'Maybe' },
    { value: 'NotGoing', label: "Can't make it" },
  ];

  private inviteId = '';
  private inviteData: unknown = null;

  // The template runtime inside the frame announces itself when it's ready for its data. The frame is
  // sandboxed without allow-same-origin, so postMessage is the only way in.
  private readonly onMessage = (event: MessageEvent): void => {
    const payload = event.data as { __inviteReady?: boolean } | null;
    if (payload?.__inviteReady === true) this.postData();
  };

  ngOnInit(): void {
    window.addEventListener('message', this.onMessage);
    this.load();
  }

  ngOnDestroy(): void {
    window.removeEventListener('message', this.onMessage);
  }

  private load(): void {
    this.state.set('loading');
    this.api.myInvitation(this.campaignId()).subscribe({
      next: (res: MyInvitation) => {
        if (res.cancelled) {
          this.message.set(res.message ?? '');
          this.state.set('cancelled');
          return;
        }
        if (!res.packageUrl) {
          this.state.set('error');
          return;
        }
        this.inviteId = res.inviteId;
        this.rsvpStatus.set(res.rsvpStatus ?? 'NoResponse');
        this.inviteData = res.data ?? {};
        const base = res.packageUrl.endsWith('/') ? res.packageUrl : `${res.packageUrl}/`;
        this.iframeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(`${base}index.html`));
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  protected onFrameLoad(): void {
    this.postData();
  }

  private postData(): void {
    const win = this.frameRef()?.nativeElement?.contentWindow;
    if (win && this.inviteData !== null) {
      win.postMessage({ __inviteData: this.inviteData }, '*');
    }
  }

  protected openRsvp(): void {
    this.showRsvp.set(true);
  }

  protected send(): void {
    if (this.sending() || !this.inviteId) return;
    this.sending.set(true);
    const body: RsvpBody = {
      status: this.choice(),
      guestCount: this.choice() === 'NotGoing' ? undefined : this.guestCount(),
      mealPreference: this.meal().trim() || undefined,
      arrivalTime: this.arrival().trim() || undefined,
      comment: this.note().trim() || undefined,
    };
    this.api.rsvp(this.inviteId, body).subscribe({
      next: () => {
        this.sending.set(false);
        this.showRsvp.set(false);
        this.rsvpStatus.set(this.choice());
        this.toast.success('Your reply is in — the host has been told.');
      },
      // The API service already surfaces the reason; keep the form open so it can be retried.
      error: () => this.sending.set(false),
    });
  }

  protected readonly rsvpLabel = (status: string): string => {
    switch (status) {
      case 'Going':
        return "You're going";
      case 'NotGoing':
        return "You said you can't make it";
      case 'Maybe':
        return 'You said maybe';
      default:
        return '';
    }
  };

  protected back(): void {
    void this.router.navigate(['/inbox']);
  }
}
