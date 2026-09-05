import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiBottomNav, UiBottomNavItem } from '@zouriel/ui/navigation';
import { HugeiconsIconComponent } from '@hugeicons/angular';
// One module per icon, not the package barrel: that barrel re-exports 12,061 modules and the
// compiler walks all of them, which is what ran the build box out of memory.
import Album02Icon from '@hugeicons/core-free-icons/Album02Icon';
import Logout03Icon from '@hugeicons/core-free-icons/Logout03Icon';
import Mail01Icon from '@hugeicons/core-free-icons/Mail01Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Sun03Icon from '@hugeicons/core-free-icons/Sun03Icon';
import UserIcon from '@hugeicons/core-free-icons/UserIcon';
import { ThemeStore } from '../../shared/services/theme.store';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { SessionStore } from '../../shared/services/session.store';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, RouterLink, RouterLinkActive, UiBottomNav, UiButton, BrandMarkComponent],
  template: `
    <header class="hdr">
      <div class="hdr__inner">
        <a routerLink="/" class="brand" (click)="open.set(false)">
          <app-brand-mark [size]="24" />
          <span class="brand__name">invites<span class="brand__dot">.</span>blog</span>
        </a>

        <nav class="nav" [class.nav--open]="open()" [hidden]="!hasMenu()" (click)="open.set(false)">
          <!-- The nav is built from ROLES, not from which login was used: one person can be an
               admin, a designer and a customer at once and sees all three sets. -->
          @if (isAdmin()) {
            <a routerLink="/admin/templates" routerLinkActive="active">Gallery</a>
            <a routerLink="/my-templates" routerLinkActive="active">System templates</a>
            <a routerLink="/admin/template-submissions" routerLinkActive="active">Review</a>
            <a routerLink="/admin/designers" routerLinkActive="active">Designers</a>
            <a routerLink="/admin/inquiries" routerLinkActive="active">Inquiries</a>
            <a routerLink="/admin/settings" routerLinkActive="active">Settings</a>
          } @else {
            <!-- Signed-in customers land on their invitations after login and otherwise have no menu item back
                 to the template gallery except the logo — easy to miss for a first-time visitor.
                 Points at the gallery itself, not the landing page: the landing row is a teaser you
                 cannot filter or scan, and this is the label people click when they want to look. -->
            <a routerLink="/templates" routerLinkActive="active">Templates</a>
            <a routerLink="/guide" routerLinkActive="active">Guide</a>
            <!-- "My templates" is NOT here for signed-in people: it is a tab in the bottom bar, and
                 the same destination in two navigations is one of them being wrong. -->
            @if (isDesigner()) {
              <a routerLink="/designer/requests" routerLinkActive="active">Requests</a>
            }
          }

          @if (!isSignedIn()) {
            <a routerLink="/login" routerLinkActive="active">Sign in</a>
            <a routerLink="/inquire" class="nav__cta">
              <ui-button variant="primary" size="sm">Start an inquiry</ui-button>
            </a>
          }

          <!-- Stops the click bubbling to the nav's own close handler: changing the lights is a
               setting you may want to try both ways, and a menu that shuts on the first tap makes
               you reopen it to undo. -->
          <button
            class="theme"
            type="button"
            (click)="theme.toggle(); $event.stopPropagation()"
            [attr.aria-pressed]="theme.isDark()"
          >
            <hugeicons-icon [icon]="theme.isDark() ? sunIcon : moonIcon" [size]="18" [strokeWidth]="1.8" />
            {{ theme.isDark() ? 'Light theme' : 'Night mode' }}
          </button>
        </nav>

        <!-- Last in the row, so it lands in the corner where a thumb reaches for it. -->
        @if (hasMenu()) {
          <button
            class="burger"
            type="button"
            (click)="open.set(!open())"
            [attr.aria-expanded]="open()"
            aria-label="Toggle menu"
          >
            <span></span><span></span><span></span>
          </button>
        }
      </div>
    </header>

    <!-- Signed in, the destinations move down here and the top nav keeps only the lights. A person
         with an account is navigating a handful of fixed places, over and over, usually on a phone —
         which is a bottom bar, not a menu you have to open first. -->
    @if (isSignedIn()) {
      <ui-bottom-nav
        class="tabs"
        [items]="tabs()"
        [active]="activeTab()"
        (activeChange)="go($event)"
      />
    }
  `,
  styles: [
    `
      /* Sticky must live on the host (which spans the page); on the inner .hdr it has no room to
         travel because its parent is only header-height tall, so it would scroll away. */
      :host {
        position: sticky;
        top: 0;
        /* Above page-level docked bars (e.g. the editor topbar, also --ui-z-docked) so the
           open mobile burger menu is never overlapped by page content. */
        z-index: calc(var(--ui-z-docked) + 10);
        display: block;
      }
      .hdr {
        background: color-mix(in srgb, var(--ui-color-bg) 85%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--ui-color-border);
      }
      /* Inside the menu now, so it reads as one of its items rather than a stray control — same
         size and weight as the links it sits with, with the icon carrying the difference. */
      .theme {
        display: inline-flex;
        align-items: center;
        gap: 0.45rem;
        padding: 0;
        font: inherit;
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--ui-color-text);
        background: none;
        border: 0;
        cursor: pointer;
      }
      .theme:hover {
        color: var(--ui-color-primary);
      }

      /* Fixed to the bottom of the viewport, and OUTSIDE the sticky host above — a bar that scrolled
         with the header would be a bar you have to go looking for. The safe-area inset keeps it clear
         of the home indicator on a phone. */
      .tabs {
        position: fixed;
        inset: auto 0 0 0;
        z-index: calc(var(--ui-z-docked) + 10);
        padding-bottom: env(safe-area-inset-bottom);
        background: var(--ui-color-bg);
        border-top: 1px solid var(--ui-color-border);
      }

      .hdr__inner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 68px;
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
        padding: 0 clamp(1.1rem, 4vw, 3rem);
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-family: var(--ui-font-display);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--ui-color-text);
      }
      /* The seal wears the accent; the wordmark stays ink. */
      .brand app-brand-mark {
        color: var(--ui-color-primary);
      }
      .brand__dot {
        color: var(--ui-color-primary);
      }
      .nav {
        display: flex;
        align-items: center;
        gap: 1.75rem;
      }
      .nav a:not(.nav__cta) {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--ui-color-text);
        text-decoration: none;
      }
      .nav a.active:not(.nav__cta),
      .nav a:not(.nav__cta):hover {
        color: var(--ui-color-primary);
      }
      .burger {
        display: none;
        flex-direction: column;
        gap: 5px;
        background: none;
        border: 0;
        cursor: pointer;
        padding: 6px;
      }
      .burger span {
        width: 24px;
        height: 2px;
        background: var(--ui-color-text);
        border-radius: 2px;
      }
      /* The burger has to appear while the row still FITS, and the row grows with the account: a
         signed-in designer carries eight links and needs ~990px before the brand and padding. 760px
         was sized for the signed-out nav, so everyone else got a header wider than the page. */
      @media (max-width: 1080px) {
        .burger {
          display: flex;
        }
        .nav {
          position: absolute;
          top: 68px;
          left: 0;
          right: 0;
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.2rem clamp(1.1rem, 4vw, 3rem);
          background: var(--ui-color-surface-raised);
          border-bottom: 1px solid var(--ui-color-border);
          transform: translateY(-8px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .nav--open {
          opacity: 1;
          transform: none;
          pointer-events: auto;
        }
        .nav__cta {
          width: 100%;
        }
      }
    `,
  ],
})
export class HeaderComponent {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly open = signal(false);

  /**
   * Anywhere else closes it.
   *
   * <p>The menu already closed on a nav item, the brand and the burger — every part of ITSELF — but
   * tapping the page behind it did nothing, so the only way out was to find the burger again. On a
   * phone the menu covers most of what you were trying to reach, which makes "tap away" the first
   * thing anyone tries.</p>
   *
   * <p>pointerdown rather than click, so it goes at the moment of the press; and the burger is
   * excluded, or its own toggle would reopen what this had just closed.</p>
   */
  @HostListener('document:pointerdown', ['$event'])
  protected closeOnOutsidePress(event: Event): void {
    if (!this.open()) return;
    if ((event.target as HTMLElement | null)?.closest('.nav, .burger')) return;
    this.open.set(false);
  }

  /** The other way out people reach for, and free with the same state. */
  @HostListener('document:keydown.escape')
  protected closeOnEscape(): void {
    if (this.open()) this.open.set(false);
  }
  protected readonly isSignedIn = this.session.isSignedIn;
  protected readonly isAdmin = this.session.isAdmin;
  /** Admins manage the platform's own templates, so they get the templates screen too. */
  protected readonly isDesigner = this.session.isDesigner;

  protected readonly theme = inject(ThemeStore);
  protected readonly sunIcon = Sun03Icon;
  protected readonly moonIcon = Moon02Icon;

  /**
   * Whether the top menu still has anything in it. Signing in moves a customer's destinations to the
   * bottom bar, which leaves them with an empty menu behind a hamburger — so the hamburger goes too.
   * Admins and designers keep theirs: their work queues are not in the bar and would be stranded.
   */
  protected readonly hasMenu = computed(
    () => !this.isSignedIn() || this.isAdmin() || this.isDesigner(),
  );

  /**
   * The bar's own routes. "Sign out" sits among them because on a phone it is the one thing people
   * hunt for and cannot find — and it is honest about being an action rather than a place, since
   * tapping it never leaves the bar highlighted.
   */
  protected readonly tabs = computed<UiBottomNavItem[]>(() => {
    const items: UiBottomNavItem[] = [
      { label: 'Events', value: '/inbox', icon: Mail01Icon },
      // Everyone signed in has somewhere to keep templates: a designer's own, an admin's platform set.
      { label: 'Templates', value: '/my-templates', icon: Album02Icon },
      { label: 'Account', value: '/me', icon: UserIcon },
      { label: 'Sign out', value: 'logout', icon: Logout03Icon },
    ];
    return items;
  });

  /**
   * Which tab reads as current, derived from the URL rather than from the last tap — otherwise a
   * link followed from inside a page (or the browser's Back button) leaves the bar pointing at
   * somewhere the reader no longer is.
   */
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly activeTab = computed(() => {
    const url = this.url();
    const match = this.tabs().find((t) => t.value !== 'logout' && url.startsWith(t.value));
    return match?.value ?? '';
  });

  protected go(value: string): void {
    if (value === 'logout') {
      this.logout();
      return;
    }
    void this.router.navigate([value]);
  }

  protected logout(): void {
    this.session.clear();
    this.open.set(false);
    this.router.navigate(['/']);
  }
}
