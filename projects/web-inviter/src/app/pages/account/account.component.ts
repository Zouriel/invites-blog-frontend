import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { UiAlert } from '@zouriel/ui/alert';
import { UiAvatar, UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiCard } from '@zouriel/ui/card';
import { UiFormField, UiInput } from '@zouriel/ui/form';
import { UiText } from '@zouriel/ui/text';
import { UiToastService } from '@zouriel/ui/dialog';
import { ApiService } from '../../shared/api/api.service';
import { SessionStore } from '../../shared/services/session.store';
import { ThemeStore } from '../../shared/services/theme.store';
import { BackLinkComponent } from '../../shared/back-link/back-link.component';
import { APP_ICONS } from '../../shared/icons/app-icons';
import { SettingsTrail } from '../../shared/settings-trail/settings-trail';
import { UiList, UiListItem } from '@zouriel/ui/list';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Logout03Icon from '@hugeicons/core-free-icons/Logout03Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Sun03Icon from '@hugeicons/core-free-icons/Sun03Icon';
import { CodeSent, StorageSummary } from '../../shared/utils/types/api.types';
import { catalog, formatBytes, spaceLadder } from '../../shared/utils/plans';
import { UiProgressBar } from '@zouriel/ui/progress';

/**
 * Account settings, behind the gear on Me. The gear opens a menu, and the person picks where to go
 * from it: Profile (who the account is, its plan and roles), Sign-in & security, and what used to be
 * the top bar's menu (billing, the admin screens, night mode, signing out).
 */
/** Which page of settings this is: the gear's menu, or one of the two it opens. Set by the route. */
export type AccountSection = 'menu' | 'profile' | 'security';

@Component({
  selector: 'app-account',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    UiProgressBar, BackLinkComponent, HugeiconsIconComponent, UiList, UiListItem,
    TitleCasePipe, FormsModule, RouterLink, UiAlert, UiAvatar, UiBadge, UiButton, UiCard,
    UiFormField, UiInput, UiText,
  ],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
})
export class AccountComponent {

  private readonly api = inject(ApiService);

  /** A venue's shared space, for its owner and staff. Nothing to show for anyone else. */
  protected readonly storage = signal<StorageSummary | null>(null);
  protected readonly bytes = formatBytes;
  protected readonly ladder = spaceLadder();
  protected readonly studioDiscount = catalog().studioDiscountPercent;
  protected storagePercent(s: StorageSummary): number {
    return s.accountBytes ? Math.min(100, Math.round((s.usedBytes / s.accountBytes) * 100)) : 0;
  }

  constructor() {
    this.api.myStorage().subscribe({ next: (s) => this.storage.set(s), error: () => {} });
  }
  private readonly session = inject(SessionStore);
  private readonly toast = inject(UiToastService);

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly account = this.session.account;
  protected readonly isStudio = this.session.isStudio;
  protected readonly isAdmin = this.session.isAdmin;
  protected readonly theme = inject(ThemeStore);
  protected readonly sunIcon = Sun03Icon;
  protected readonly moonIcon = Moon02Icon;
  protected readonly logoutIcon = Logout03Icon;

  private readonly trail = inject(SettingsTrail);

  /** Pages outside the account's own get a "Settings" link back while they're read from here. */
  protected readonly avatarBusy = signal(false);

  /** Google's picture, until they upload their own. Only Google-linked accounts arrive with one. */
  protected readonly fromGoogle = computed(() => {
    const a = this.account();
    return !!a?.avatarUrl && a.linkedProviders.includes('google') && !this.avatarChanged();
  });
  /** Set once they change it here, so the "from Google" note doesn't linger over their own photo. */
  private readonly avatarChanged = signal(false);

  protected pickAvatar(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Cleared so picking the same file again still fires a change.
    input.value = '';
    if (!file || this.avatarBusy()) return;
    this.avatarBusy.set(true);
    this.api.setAvatar(file).subscribe({
      next: (account) => {
        this.session.setAccount(account);
        this.avatarChanged.set(true);
        this.avatarBusy.set(false);
      },
      error: (e: Error) => {
        this.avatarBusy.set(false);
        this.toast.danger(e.message || "That photo couldn't be used.");
      },
    });
  }

  protected removeAvatar(): void {
    this.avatarBusy.set(true);
    this.api.removeAvatar().subscribe({
      next: (account) => {
        this.session.setAccount(account);
        this.avatarChanged.set(true);
        this.avatarBusy.set(false);
      },
      error: () => this.avatarBusy.set(false),
    });
  }

  protected go(path: string): void {
    if (!path.startsWith('/me/')) this.trail.enter(path);
    void this.router.navigateByUrl(path);
  }

  protected logout(): void {
    this.session.clear();
    void this.router.navigate(['/']);
  }
  protected readonly atVenue = this.session.atVenue;
  /** A Studio or Venue plan whose end date has passed: the tier stays on the account until renewed. */
  protected readonly planEnded = computed(() => {
    const ends = this.account()?.subscriptionEndsAt;
    return !!ends && new Date(ends).getTime() < Date.now();
  });
  protected readonly planEnds = computed(() => {
    const ends = this.account()?.subscriptionEndsAt;
    return ends ? new Date(ends).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;
  });

  protected readonly section = signal<AccountSection>(this.route.snapshot.data['section'] ?? 'menu');
  protected readonly appIcons = APP_ICONS;

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
        return 'Run the platform: look after the gallery and manage people.';
      default:
        return '';
    }
  }

  /** What's still missing from the account — the thing worth inviting them to add. */
  protected readonly missing = computed(() => {
    const a = this.account();
    if (!a) return null;
    if (!a.phoneE164) return 'phone';
    if (!a.email) return 'email';
    return null;
  });

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
            ? `Accounts merged: ${result.mergeSummary}.`
            : 'Added to your account.',
        );
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

}
