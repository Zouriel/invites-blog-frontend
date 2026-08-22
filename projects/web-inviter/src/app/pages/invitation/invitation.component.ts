import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
import { UiFormField, UiInput, UiNumberInput, UiSelect, UiTextarea } from 'ui/form';
import { UiSpinner } from 'ui/spinner';
import { UiText } from 'ui/text';
import { ApiService } from '../../shared/api/api.service';
import { MyInvitation, RsvpBody, RsvpQuestion } from '../../shared/utils/types/api.types';

type ViewState = 'loading' | 'ready' | 'cancelled' | 'error';

/** Questions that predate the configurable form and still have their own columns server-side. */
const RESERVED_KEYS = new Set(['guestCount', 'mealPreference', 'arrivalTime', 'comment']);

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
    FormsModule, RouterLink, UiButton, UiFormField, UiInput, UiModal, UiNumberInput, UiResult,
    UiSelect, UiSpinner, UiText, UiTextarea,
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

  /** What this host chose to ask, and the answers so far, keyed by question. */
  protected readonly questions = signal<RsvpQuestion[]>([]);
  protected readonly answers = signal<Record<string, string>>({});

  /**
   * Most questions are pointless for someone who isn't coming — a head count especially — so they're
   * hidden unless the host marked them as worth asking anyway.
   */
  protected readonly visibleQuestions = computed(() =>
    this.choice() === 'NotGoing'
      ? this.questions().filter((q) => q.askIfNotGoing)
      : this.questions(),
  );

  protected readonly unanswered = computed(() =>
    this.visibleQuestions().filter((q) => q.required && !this.answers()[q.key]?.trim()),
  );

  protected readonly choices: { value: RsvpBody['status']; label: string }[] = [
    { value: 'Going', label: "I'll be there" },
    { value: 'Maybe', label: 'Maybe' },
    { value: 'NotGoing', label: "Can't make it" },
  ];

  private inviteId = '';
  private inviteData: unknown = null;
  /** The invitation's own URL, kept raw so the frame can be put back after it navigates away. */
  private frameUrl = '';
  private readySinceLoad = false;
  private seenInvitation = false;
  private restoring = false;

  // The template runtime inside the frame announces itself when it's ready for its data. The frame is
  // sandboxed without allow-same-origin, so postMessage is the only way in.
  private readonly onMessage = (event: MessageEvent): void => {
    const payload = event.data as { __inviteReady?: boolean } | null;
    if (payload?.__inviteReady !== true) return;
    // Only the invitation announces itself, and it does so while its document is still parsing —
    // i.e. always BEFORE that document's load event. Pairing the two is what tells the invitation
    // apart from anything else the frame might end up showing. See onFrameLoad.
    this.readySinceLoad = true;
    this.seenInvitation = true;
    this.postData();
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
        this.questions.set(res.rsvpQuestions ?? []);
        this.rsvpStatus.set(res.rsvpStatus ?? 'NoResponse');
        this.inviteData = res.data ?? {};
        const base = res.packageUrl.endsWith('/') ? res.packageUrl : `${res.packageUrl}/`;
        this.frameUrl = `${base}index.html`;
        this.iframeSrc.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.frameUrl));
        this.state.set('ready');
      },
      error: () => this.state.set('error'),
    });
  }

  /**
   * Also where the invitation's OWN "Respond now" button is caught.
   *
   * That button is an ordinary link inside the package, so clicking it navigates the frame away from
   * the invitation — and where it points is the invitee site, which knows nothing about the session
   * held here. The result was a stray page inside the frame where the invitation had been. There's no
   * way to intercept a click inside a cross-origin frame, but a second load means they clicked
   * something: put the invitation back and answer it with the form this page already has.
   */
  protected onFrameLoad(): void {
    const announcedItself = this.readySinceLoad;
    this.readySinceLoad = false;
    this.restoring = false;

    // A document that finished loading without announcing itself is not the invitation — the frame
    // has been navigated away, and the only thing in there that navigates is the invitation's own
    // "Respond now" link. Wherever it points knows nothing about the session held here, so it would
    // leave a stray page where the invitation was. Put the invitation back and answer it here.
    // (Guarded on having seen the invitation at least once: an empty frame fires a load of its own
    // before the real document arrives.)
    if (!announcedItself && this.seenInvitation) {
      const frame = this.frameRef()?.nativeElement;
      if (frame && this.frameUrl) {
        this.restoring = true;
        frame.src = this.frameUrl;
      }
      this.showRsvp.set(true);
      return;
    }

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

  protected readonly yesNo = [
    { label: 'Yes', value: 'Yes' },
    { label: 'No', value: 'No' },
  ];

  protected choicesOf(question: RsvpQuestion): { label: string; value: string }[] {
    return (question.options ?? []).map((o) => ({ label: o, value: o }));
  }

  protected answerOf(question: RsvpQuestion): string {
    return this.answers()[question.key] ?? '';
  }

  protected answer(question: RsvpQuestion, value: string): void {
    this.answers.update((all) => ({ ...all, [question.key]: value }));
  }

  protected send(): void {
    if (this.sending() || !this.inviteId || this.unanswered().length) return;
    this.sending.set(true);

    // The four original questions keep their own fields on the way up — the dashboard and every
    // export read them by name — and anything the host added rides along as an answer.
    const asked = new Set(this.visibleQuestions().map((q) => q.key));
    const given = this.answers();
    const value = (key: string) => (asked.has(key) ? given[key]?.trim() || undefined : undefined);
    const extra: Record<string, string> = {};
    for (const q of this.visibleQuestions()) {
      if (RESERVED_KEYS.has(q.key)) continue;
      const v = given[q.key]?.trim();
      if (v) extra[q.key] = v;
    }

    const count = value('guestCount');
    const body: RsvpBody = {
      status: this.choice(),
      guestCount: count ? Number(count) : undefined,
      mealPreference: value('mealPreference'),
      arrivalTime: value('arrivalTime'),
      comment: value('comment'),
      answers: Object.keys(extra).length ? extra : undefined,
    };
    this.api.rsvp(this.inviteId, body).subscribe({
      next: () => {
        this.sending.set(false);
        this.showRsvp.set(false);
        this.rsvpStatus.set(this.choice());
        this.answers.set({});
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
