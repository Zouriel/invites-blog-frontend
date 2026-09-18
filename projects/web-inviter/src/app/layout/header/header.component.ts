import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { UiButton } from '@zouriel/ui/button';
import { UiBottomNav, UiBottomNavItem } from '@zouriel/ui/navigation';
import { HugeiconsIconComponent } from '@hugeicons/angular';
// One module per icon, not the package barrel: that barrel re-exports 12,061 modules and the
// compiler walks all of them, which is what ran the build box out of memory.
import Album02Icon from '@hugeicons/core-free-icons/Album02Icon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';
import Logout03Icon from '@hugeicons/core-free-icons/Logout03Icon';
import Home01Icon from '@hugeicons/core-free-icons/Home01Icon';
import Moon02Icon from '@hugeicons/core-free-icons/Moon02Icon';
import Sun03Icon from '@hugeicons/core-free-icons/Sun03Icon';
import UserCircleIcon from '@hugeicons/core-free-icons/UserCircleIcon';
import { ThemeStore } from '../../shared/services/theme.store';
import { BrandMarkComponent } from '../../shared/brand/brand-mark.component';
import { SessionStore } from '../../shared/services/session.store';

/** How far the page has to move before the bar reacts, so a trembling thumb doesn't flicker it. */
const SCROLL_SLACK = 6;

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HugeiconsIconComponent, RouterLink, RouterLinkActive, UiBottomNav, UiButton, BrandMarkComponent],
  host: {
    '[class.app]': 'isSignedIn()',
    '[class.tucked]': 'tucked()',
  },
  template: `
    @if (isSignedIn()) {
      <!-- Signed in, the bottom bar carries the destinations, so the top is only the name. The menu
           lives on Account, where people go looking for settings and signing out. -->
      <header class="hdr hdr--app">
        <div class="hdr__inner hdr__inner--app">
          <!-- The designer is a tool for designer accounts; for anyone else the left column stays empty. -->
          @if (isDesigner()) {
            <a routerLink="/template-designer" routerLinkActive="active" class="hdr__link" (click)="open.set(false)">Designer</a>
          } @else {
            <span aria-hidden="true"></span>
          }
          <a routerLink="/inbox" class="brand brand--app" (click)="open.set(false)">
            <app-brand-mark [size]="20" />
            <span class="brand__name">invites<span class="brand__dot">.</span>blog</span>
          </a>
          @if (onAccount()) {
            <button
              class="burger burger--app"
              type="button"
              (click)="open.set(!open())"
              [attr.aria-expanded]="open()"
              aria-label="Menu"
            >
              <span></span><span></span><span></span>
            </button>
          } @else {
            <span aria-hidden="true"></span>
          }
        </div>

        @if (onAccount()) {
          <nav class="menu" [class.menu--open]="open()" (click)="open.set(false)">
            @if (isAdmin()) {
              <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Administrative</a>
              <a routerLink="/admin/inquiries" routerLinkActive="active">Inquiries</a>
              <a routerLink="/admin/settings" routerLinkActive="active">Settings</a>
            }
            <a routerLink="/templates" routerLinkActive="active">Template gallery</a>
            <a routerLink="/pricing" routerLinkActive="active">Pricing</a>
            <a routerLink="/guide" routerLinkActive="active">Guide</a>
            <button
              class="theme"
              type="button"
              (click)="theme.toggle(); $event.stopPropagation()"
              [attr.aria-pressed]="theme.isDark()"
            >
              <hugeicons-icon [icon]="theme.isDark() ? sunIcon : moonIcon" [size]="18" [strokeWidth]="1.8" />
              {{ theme.isDark() ? 'Light theme' : 'Night mode' }}
            </button>
            <button class="theme menu__out" type="button" (click)="logout()">
              <hugeicons-icon [icon]="logoutIcon" [size]="18" [strokeWidth]="1.8" />
              Sign out
            </button>
          </nav>
        }
      </header>

      <ui-bottom-nav
        class="tabs"
        [glass]="true"
        [items]="tabs"
        [active]="activeTab()"
        (activeChange)="go($event)"
      />
    } @else {
      <header class="hdr">
        <div class="hdr__inner">
          <a routerLink="/" class="brand" (click)="open.set(false)">
            <app-brand-mark [size]="24" />
            <span class="brand__name">invites<span class="brand__dot">.</span>blog</span>
          </a>

          <nav class="nav" [class.nav--open]="open()" (click)="open.set(false)">
            <!-- Points at the gallery itself, not the landing page: the landing row is a teaser you
                 cannot filter or scan, and this is the label people click when they want to look. -->
            <a routerLink="/templates" routerLinkActive="active">Templates</a>
            <a routerLink="/pricing" routerLinkActive="active">Pricing</a>
            <a routerLink="/guide" routerLinkActive="active">Guide</a>
            <a routerLink="/login" routerLinkActive="active">Sign in</a>
            <a routerLink="/events/new" class="nav__cta">
              <ui-button variant="primary" size="sm">Start your event</ui-button>
            </a>

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
          <button
            class="burger"
            type="button"
            (click)="open.set(!open())"
            [attr.aria-expanded]="open()"
            aria-label="Toggle menu"
          >
            <span></span><span></span><span></span>
          </button>
        </div>
      </header>
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
      /* Tucked away while reading down the page. The bar slides, not the host: a transform on the
         host would pin the fixed bottom bar inside it. */
      :host(.tucked) {
        pointer-events: none;
      }
      :host(.tucked) .hdr {
        transform: translateY(-100%);
      }
      .hdr {
        position: relative;
        background: color-mix(in srgb, var(--ui-color-bg) 85%, transparent);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--ui-color-border);
        transition: transform 0.22s ease;
      }
      @media (prefers-reduced-motion: reduce) {
        .hdr {
          transition: none;
        }
      }
      /* Inside the menu, so it reads as one of its items rather than a stray control — same size
         and weight as the links it sits with, with the icon carrying the difference. */
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

      /* Fixed to the bottom of the viewport, and OUTSIDE the sticky header above — a bar that
         scrolled with the header would be a bar you have to go looking for. The safe-area inset keeps
         it clear of the home indicator on a phone. */
      .tabs {
        position: fixed;
        left: 50%;
        bottom: calc(12px + env(safe-area-inset-bottom));
        transform: translateX(-50%);
        width: min(380px, calc(100% - 24px));
        z-index: calc(var(--ui-z-docked) + 10);
        pointer-events: auto;
        /* A pill floating over the page, the same size on a phone and a wide screen. The radius is
           the bar's own token, so the library draws the shape and this only picks it. */
        --ui-radius: 999px;
        border-radius: 999px;
        /* The same see-through surface as the top bar, so the two read as one set. */
        --ui-glass-bg: color-mix(in srgb, var(--ui-color-bg) 85%, transparent);
        --ui-glass-blur: 10px;
        --ui-glass-border: var(--ui-color-border);
        box-shadow: 0 8px 28px color-mix(in srgb, #000 18%, transparent);
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
      /* The name in the middle, with equal columns either side so it stays centred whether or not
         the menu button is there. */
      .hdr__inner--app {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        height: 52px;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        font-family: var(--ui-font-display);
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--ui-color-text);
        text-decoration: none;
      }
      .hdr__link {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        min-height: 2.5rem;
        font-size: 0.9rem;
        font-weight: 500;
        color: var(--ui-color-text);
        text-decoration: none;
      }
      .hdr__link:hover,
      .hdr__link.active {
        color: var(--ui-color-primary);
      }
      .hdr__link:focus-visible {
        outline: none;
        box-shadow: var(--ui-focus-ring);
        border-radius: var(--ui-radius);
      }
      .brand--app {
        gap: 0.4rem;
        font-size: 1.2rem;
      }
      /* The seal wears the accent; the wordmark stays ink. */
      /* The letters in ink, the shutter in the accent (set inside the mark). */
      .brand app-brand-mark {
        color: var(--ui-color-text);
      }
      .brand__dot {
        color: var(--ui-color-primary);
      }
      .nav {
        display: flex;
        align-items: center;
        gap: 1.75rem;
      }
      .nav a:not(.nav__cta),
      .menu a {
        font-size: 0.95rem;
        font-weight: 500;
        color: var(--ui-color-text);
        text-decoration: none;
      }
      .nav a.active:not(.nav__cta),
      .nav a:not(.nav__cta):hover,
      .menu a.active,
      .menu a:hover {
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
      .burger--app {
        display: flex;
        justify-self: end;
      }
      .burger--app span {
        width: 20px;
      }

      /* Signed in, the menu is always a drop-down: it holds a handful of settings, not a row of
         destinations. */
      .menu {
        position: absolute;
        top: 100%;
        /* Under the burger. The bar's contents sit in a centred column at most 1180px wide, so on a
           wide screen the burger is well in from the window's edge; measuring from the edge put the
           menu out in the corner, far from the button that opened it. This lines its right edge up
           with the burger's: the column's margin plus its padding. */
        right: calc(max(0px, (100% - 1180px) / 2) + clamp(1.1rem, 4vw, 3rem));
        display: flex;
        flex-direction: column;
        align-items: stretch;
        gap: 0.1rem;
        min-width: 14rem;
        padding: 0.45rem;
        margin-top: 0.4rem;
        background: var(--ui-color-surface-raised);
        border: 1px solid var(--ui-color-border);
        border-radius: var(--ui-radius-lg);
        box-shadow: 0 12px 32px color-mix(in srgb, #000 16%, transparent);
        transform: translateY(-8px);
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .menu--open {
        opacity: 1;
        transform: none;
        pointer-events: auto;
      }
      /* Every item is a full-width row, so a tap anywhere on it counts, not only on the words. */
      .menu a,
      .menu .theme {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        min-height: 2.75rem;
        padding: 0 0.8rem;
        border-radius: var(--ui-radius);
      }
      .menu a:hover,
      .menu .theme:hover {
        background: color-mix(in srgb, var(--ui-color-primary) 8%, transparent);
      }
      .menu__out {
        margin-top: 0.35rem;
        border-top: 1px solid var(--ui-color-border);
        border-radius: 0 0 var(--ui-radius) var(--ui-radius);
      }

      /* The burger has to appear while the row still FITS. */
      @media (max-width: 1080px) {
        .burger {
          display: flex;
        }
        .nav {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          flex-direction: column;
          align-items: stretch;
          gap: 0.1rem;
          padding: 0.6rem clamp(0.6rem, 3vw, 2.4rem) 1rem;
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
        /* Full-width rows, the same as the signed-in menu: the whole row is the target. */
        .nav a:not(.nav__cta),
        .nav .theme {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          min-height: 2.9rem;
          padding: 0 0.6rem;
          border-radius: var(--ui-radius);
        }
        .nav a:not(.nav__cta):hover,
        .nav .theme:hover {
          background: color-mix(in srgb, var(--ui-color-primary) 8%, transparent);
        }
        .nav__cta {
          width: 100%;
          margin-block: 0.4rem;
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
   * <p>pointerdown rather than click, so it goes at the moment of the press; and the burger is
   * excluded, or its own toggle would reopen what this had just closed.</p>
   */
  @HostListener('document:pointerdown', ['$event'])
  protected closeOnOutsidePress(event: Event): void {
    if (!this.open()) return;
    if ((event.target as HTMLElement | null)?.closest('.nav, .menu, .burger')) return;
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
  protected readonly logoutIcon = Logout03Icon;

  /** The bar's own routes. Signing out is in the Account menu, not among the places. */
  protected readonly tabs: UiBottomNavItem[] = [
    // Home, not Events: this is where a signed-in person lands, and it opens on their feed.
    { label: 'Home', value: '/inbox', icon: Home01Icon },
    // Everyone signed in has somewhere to keep templates: a designer's own, an admin's platform set.
    { label: 'Templates', value: '/my-templates', icon: Album02Icon },
    // The one thing this bar is FOR, in the middle where a thumb reaches.
    { label: 'New', value: '/events/new', icon: PlusSignIcon },
    { label: 'Account', value: '/me', icon: UserCircleIcon },
  ];

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
    return this.tabs.find((t) => url.startsWith(t.value))?.value ?? '';
  });

  /** The Account screen: the one place the menu is, and the one place the bar never hides. */
  protected readonly onAccount = computed(() => /^\/me(\/|\?|$)/.test(this.url()));

  /**
   * Signed in, the bar gets out of the way while reading down a page and comes back at the first
   * move up, the way a phone browser's own bar does.
   */
  protected readonly tucked = signal(false);
  private lastY = 0;

  constructor() {
    // A new page starts with the bar showing, and a closed menu.
    effect(() => {
      this.url();
      this.tucked.set(false);
      this.open.set(false);
    });

    // Bars that stick under the header (the editor's) read its live height from here.
    effect(() => {
      if (typeof document === 'undefined') return;
      const h = !this.isSignedIn() ? 68 : this.tucked() ? 0 : 52;
      document.documentElement.style.setProperty('--ib-header-h', `${h}px`);
    });
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    const y = window.scrollY;
    if (!this.isSignedIn() || this.onAccount() || this.open() || y < 52) {
      this.tucked.set(false);
      this.lastY = y;
      return;
    }
    const moved = y - this.lastY;
    if (Math.abs(moved) < SCROLL_SLACK) return;
    this.tucked.set(moved > 0);
    this.lastY = y;
  }

  protected go(value: string): void {
    void this.router.navigate([value]);
  }

  protected logout(): void {
    this.session.clear();
    this.open.set(false);
    this.router.navigate(['/']);
  }
}
