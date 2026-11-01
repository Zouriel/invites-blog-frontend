import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiToastService } from '@zouriel/ui/dialog';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { TokenStore } from '../../shared/services/token.store';
import { AccountDeletionSummary, CodeSent } from '../../shared/utils/types/api.types';

/**
 * The end of Sign-in & security. What will go and what will stay, then a code to the account's own
 * email or phone, then the button. Works for an account with no password, since a code is the proof.
 */
@Component({
  selector: 'app-delete-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, UiAlert, UiButton, UiCard, UiFormField, UiInput, UiText],
  template: `
    <ui-card padding="lg" class="del">
      <ui-text variant="h3">Delete account</ui-text>
      <ui-text variant="body" class="del__lead">
        This is final. It can't be undone, and anything you've paid for is lost.
      </ui-text>

      @if (loadError()) {
        <ui-alert tone="danger" heading="That didn't load">{{ loadError() }}</ui-alert>
        <div class="del__actions"><ui-button variant="secondary" (click)="load()">Try again</ui-button></div>
      } @else if (!summary()) {
        <ui-text variant="caption">Checking what's on your account…</ui-text>
      } @else {
        <ul class="del__list">
          <li>{{ deletedLine() }}</li>
          @if (summary()!.eventsPassedOn > 0) {
            <li>{{ passedLine() }}</li>
          }
          <li>Photos and videos you added to other people's events stay there, with your name on them.</li>
          <li>Your profile, comments and likes are deleted.</li>
          @if (summary()!.autoRenews) {
            <li>Automatic renewal stops, so your card isn't charged again.</li>
          }
        </ul>
        @if (summary()!.paid.length) {
          <ui-text variant="body">You'd lose what's still running:</ui-text>
          <ul class="del__list">
            @for (item of summary()!.paid; track item) {
              <li>{{ item }}</li>
            }
          </ul>
        }

        @if (error()) {
          <ui-alert tone="danger" heading="That didn't work">{{ error() }}</ui-alert>
        }

        @if (summary()!.blocked) {
          <ui-alert tone="warning">{{ summary()!.blocked }}</ui-alert>
        } @else if (!sent()) {
          <div class="del__actions">
            <ui-button variant="secondary" [loading]="busy()" (click)="sendCode()">
              Send a code to {{ summary()!.codeSentTo }}
            </ui-button>
          </div>
        } @else {
          <ui-text variant="body">We sent a code to {{ sent()!.sentTo }}. Enter it to delete your account.</ui-text>
          <ui-form-field label="Code">
            <ui-input
              [ngModel]="code()"
              (ngModelChange)="setCode($event)"
              [ngModelOptions]="{ standalone: true }"
              inputmode="numeric"
              autocomplete="one-time-code"
              name="delete-account-code"
              placeholder="123456"
              size="lg"
            />
          </ui-form-field>
          <div class="del__actions">
            <ui-button variant="destructive" [loading]="busy()" [disabled]="code().length < 6" (click)="confirm()">
              Delete my account
            </ui-button>
            <ui-button variant="ghost" (click)="cancel()">Keep my account</ui-button>
          </div>
        }
      }
      <a class="del__more" routerLink="/delete-account">What's deleted and what's kept</a>
    </ui-card>
  `,
  styles: [
    `
      .del { display: block; margin-top: var(--ui-space-3); }
      .del__lead { display: block; margin-top: var(--ui-space-1); }
      .del__list { margin: var(--ui-space-2) 0; padding-left: 1.25rem; line-height: 1.6; }
      .del__actions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); margin-top: var(--ui-space-3); }
      .del__more { display: inline-block; margin-top: var(--ui-space-3); }
    `,
  ],
})
export class DeleteAccountComponent {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly tokens = inject(TokenStore);
  private readonly toast = inject(UiToastService);
  private readonly router = inject(Router);

  protected readonly summary = signal<AccountDeletionSummary | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly sent = signal<CodeSent | null>(null);
  protected readonly code = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly deletedLine = computed(() => {
    const s = this.summary();
    if (!s) return '';
    if (s.eventsDeleted === 0) return 'None of your events will be deleted.';
    const media = [count(s.photos, 'photo'), count(s.videos, 'video')].filter(Boolean).join(' and ');
    return `${count(s.eventsDeleted, 'event')} with nobody else on ${s.eventsDeleted === 1 ? 'it' : 'them'} will be deleted, `
      + `with ${s.albums ? count(s.albums, 'album') + ', ' : ''}guest lists and replies${media ? `, and ${media}` : ''}.`;
  });

  protected readonly passedLine = computed(() => {
    const n = this.summary()?.eventsPassedOn ?? 0;
    return n === 1
      ? "1 event is also for other people, so it carries on with everything in it and passes to one of them."
      : `${n} events are also for other people, so they carry on with everything in them and each passes to one of those people.`;
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.loadError.set(null);
    this.api.accountDeletionSummary().subscribe({
      next: (s) => this.summary.set(s),
      error: (e: Error) => this.loadError.set(e.message || 'Please try again.'),
    });
  }

  /** Codes get pasted with their sentence around them: keep the digits, cap at six. */
  protected setCode(raw: string): void {
    this.code.set((raw ?? '').replace(/\D/g, '').slice(0, 6));
  }

  protected sendCode(): void {
    this.error.set(null);
    this.busy.set(true);
    this.api.requestAccountDeletionCode().subscribe({
      next: (sent) => {
        this.sent.set(sent);
        this.busy.set(false);
      },
      error: (e: Error) => {
        this.busy.set(false);
        this.error.set(e.message);
      },
    });
  }

  protected confirm(): void {
    const sent = this.sent();
    if (!sent || this.code().length < 6 || this.busy()) return;
    this.error.set(null);
    this.busy.set(true);
    this.api.confirmAccountDeletion(sent.challengeId, this.code()).subscribe({
      next: () => {
        this.session.clear();
        this.tokens.clearAll();
        this.toast.success('Your account has been deleted.');
        void this.router.navigate(['/']);
      },
      error: (e: Error) => {
        this.busy.set(false);
        this.error.set(e.message);
      },
    });
  }

  protected cancel(): void {
    this.sent.set(null);
    this.code.set('');
    this.error.set(null);
  }
}

function count(n: number, word: string): string {
  if (!n) return '';
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
