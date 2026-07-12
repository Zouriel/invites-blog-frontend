import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { UiButton } from 'ui/button';
import { AdminStore } from '../../shared/services/admin.store';

@Component({
  selector: 'app-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, UiButton],
  template: `
    <header class="hdr">
      <div class="hdr__inner">
        <a routerLink="/" class="brand" (click)="open.set(false)">
          <span class="brand__mark">✦</span>
          <span class="brand__name">invites<span class="brand__dot">.</span>blog</span>
        </a>

        <button
          class="burger"
          type="button"
          (click)="open.set(!open())"
          [attr.aria-expanded]="open()"
          aria-label="Toggle menu"
        >
          <span></span><span></span><span></span>
        </button>

        <nav class="nav" [class.nav--open]="open()" (click)="open.set(false)">
          @if (isAdmin()) {
            <a routerLink="/admin/templates" routerLinkActive="active">Templates</a>
            <a routerLink="/admin/upload" routerLinkActive="active">Upload</a>
            <a routerLink="/admin/template-types" routerLinkActive="active">Types</a>
            <a routerLink="/admin/inquiries" routerLinkActive="active">Inquiries</a>
            <ui-button class="nav__cta" variant="ghost" size="sm" (click)="logout()">Logout</ui-button>
          } @else {
            <a routerLink="/templates" routerLinkActive="active">Templates</a>
            <a routerLink="/pricing" routerLinkActive="active">Pricing</a>
            <a routerLink="/guide" routerLinkActive="active">Guide</a>
            <a routerLink="/inquire" class="nav__cta">
              <ui-button variant="primary" size="sm">Start an inquiry</ui-button>
            </a>
          }
        </nav>
      </div>
    </header>
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
      .brand__mark {
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
      @media (max-width: 760px) {
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
  private readonly admin = inject(AdminStore);
  private readonly router = inject(Router);

  protected readonly open = signal(false);
  /** Staff session — when logged in the nav switches to the admin sections + Logout. */
  protected readonly isAdmin = this.admin.isLoggedIn;

  protected logout(): void {
    this.admin.clear();
    this.open.set(false);
    this.router.navigate(['/admin/login']);
  }
}
