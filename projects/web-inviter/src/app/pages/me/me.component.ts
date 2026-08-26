import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ThemeStore } from '../../shared/services/theme.store';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { UiAlert } from '@zouriel/ui/alert';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiFormField, UiInput, UiSwitch } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiTab, UiTabs } from '@zouriel/ui/tabs';
import { UiText } from '@zouriel/ui/text';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { CodeSent, MyRequest } from '../../shared/utils/types/api.types';

/**
 * The signed-in person's own corner, in four parts: who the account is, how it's signed into, what
 * it publishes, and what it has asked for. Invitations live in the [inbox]{@link ../inbox}.
 *
 * The split matters: becoming a creator and adding a phone number were both filed under "sign-in
 * details", where neither belongs — one changes what the account can DO, the other changes how it's
 * REACHED. Payout details will hang off the creator side for the same reason.
 */
/** Tab order, mirrored in the template. Named in the URL so a link can point at one. */
const TAB_NAMES = ['profile', 'sign-in', 'creator', 'inquiries'];

@Component({
  selector: 'app-me',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe, TitleCasePipe, FormsModule, RouterLink, UiAlert, UiBadge, UiButton, UiCard, UiEmptyState,
    UiFormField, UiInput, UiSpinner, UiSwitch, UiTab, UiTabs, UiText,
  ],
  templateUrl: './me.component.html',
  styleUrl: './me.component.scss',
})
export class MeComponent {
  /** Exposed to the template: the appearance card writes through it. */
  protected readonly theme = inject(ThemeStore);

  private readonly api = inject(ApiService);
  private readonly session = inject(SessionStore);
  private readonly toast = inject(UiToastService);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly account = this.session.account;
  protected readonly loading = signal(true);
  protected readonly requests = signal<MyRequest[]>([]);

  /** Which section is open, in the URL so a refresh doesn't drop them back on Profile. */
  protected readonly tab = signal(
    Math.max(0, TAB_NAMES.indexOf(this.route.snapshot.queryParamMap.get('tab') ?? '')),
  );

  // Linking a second identifier.
  protected identifier = '';
  protected code = '';

  /** Codes get pasted with their sentence around them — keep the digits, cap at six. */
  protected setCode(raw: string): void {
    this.code = (raw ?? '').replace(/\D/g, '').slice(0, 6);
  }
  protected readonly linking = signal(false);
  protected readonly linkSent = signal<CodeSent | null>(null);
  protected readonly linkError = signal<string | null>(null);

  /** Written with replaceUrl so Back leaves the page rather than stepping through tabs. */
  protected onTabChange(index: number): void {
    this.tab.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: index === 0 ? null : TAB_NAMES[index] },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Used by Profile to send someone to the section that can actually add their number. */
  protected goToTab(index: number): void {
    this.onTabChange(index);
  }

  /** The stored role names are not what a person calls themselves. */
  protected roleLabel(role: string): string {
    switch (role) {
      case 'Designer':
        return 'Creator';
      case 'Customer':
        return 'Host';
      default:
        return role;
    }
  }

  protected roleBlurb(role: string): string {
    switch (role) {
      case 'Designer':
        return 'Publish templates for other people to send.';
      case 'Customer':
        return 'Send invitations and receive them.';
      case 'Admin':
        return 'Run the platform — review submissions, manage people.';
      default:
        return '';
    }
  }

  /** Already a creator — the invitation to become one is the only thing that hides. */
  protected readonly isDesigner = this.session.isDesigner;
  protected readonly becoming = signal(false);

  /**
   * Adds publishing to the account they already have. There was no way to do this before: the
   * sign-up form refuses an address that's taken, and signing in with Google returns whatever you
   * already were — so an existing customer had no route to becoming a creator at all.
   */
  protected becomeCreator(): void {
    if (this.becoming()) return;
    this.becoming.set(true);
    this.api.becomeDesigner().subscribe({
      next: (res) => {
        // The new role rides in the token, so the session has to be replaced, not just refreshed.
        this.session.set(res.token, res.account);
        this.becoming.set(false);
        this.toast.success('You can publish templates now — start from My templates.');
      },
      error: () => this.becoming.set(false),
    });
  }

  /** What's still missing from the account — the thing worth inviting them to add. */
  protected readonly missing = computed(() => {
    const a = this.account();
    if (!a) return null;
    if (!a.phoneE164) return 'phone';
    if (!a.email) return 'email';
    return null;
  });

  constructor() {
    this.load();
  }

  protected startLink(): void {
    if (!this.identifier.trim()) {
      this.linkError.set('Enter the number or email you want to add.');
      return;
    }
    this.linkError.set(null);
    this.linking.set(true);
    this.api.requestLinkCode(this.identifier.trim()).subscribe({
      next: (sent) => {
        this.linkSent.set(sent);
        this.linking.set(false);
      },
      error: (e: Error) => {
        this.linking.set(false);
        this.linkError.set(e.message);
      },
    });
  }

  protected confirmLink(): void {
    const sent = this.linkSent();
    if (!sent || this.code.trim().length < 6) {
      this.linkError.set('Enter the 6-digit code.');
      return;
    }
    this.linkError.set(null);
    this.linking.set(true);
    this.api.verifyLinkCode(sent.challengeId, this.code.trim()).subscribe({
      next: (result) => {
        // Take the refreshed token as well: a merge can add roles, and the old token predates them —
        // keeping it would 401 on the very screens they just gained.
        this.session.set(result.token, result.account);
        this.linking.set(false);
        this.linkSent.set(null);
        this.identifier = '';
        this.code = '';
        this.toast.success(
          result.merged
            ? `Accounts joined — ${result.mergeSummary}. Everything is in one place now.`
            : 'Added to your account.',
        );
        this.load();
      },
      error: (e: Error) => {
        this.linking.set(false);
        this.linkError.set(e.message);
      },
    });
  }

  protected cancelLink(): void {
    this.linkSent.set(null);
    this.code = '';
    this.linkError.set(null);
  }

  private load(): void {
    this.loading.set(true);
    this.api.myRequests().subscribe({
      next: (list) => {
        this.requests.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
