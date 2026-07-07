import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from 'ui/text';

@Component({
  selector: 'app-footer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiText],
  template: `
    <footer class="ftr">
      <div class="ftr__inner">
        <div class="ftr__brand">
          <div class="brand">
            <span class="brand__mark">✦</span>
            <span>invites<span class="brand__dot">.</span>blog</span>
          </div>
          <ui-text variant="body" class="ftr__tag">
            Invitations with a story — animated, personal, unforgettable.
          </ui-text>
        </div>
        <nav class="ftr__links">
          <a routerLink="/guide">Guide</a>
          <a routerLink="/pricing">Pricing</a>
          <a routerLink="/privacy">Privacy</a>
          <a routerLink="/terms">Terms</a>
        </nav>
      </div>
      <div class="ftr__base">
        <span>© {{ year }} invites.blog</span>
        <span>Made with care.</span>
      </div>
    </footer>
  `,
  styles: [
    `
      .ftr {
        margin-top: 5rem;
        border-top: 1px solid var(--ui-color-border);
        background: var(--ui-color-surface-raised);
        padding: 3rem clamp(1.1rem, 4vw, 3rem) 1.5rem;
      }
      .ftr__inner,
      .ftr__base {
        width: 100%;
        max-width: 1180px;
        margin: 0 auto;
      }
      .ftr__inner {
        display: flex;
        justify-content: space-between;
        gap: 2rem;
        flex-wrap: wrap;
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
        color: var(--ui-color-ember);
      }
      .brand__dot {
        color: var(--ui-color-primary);
      }
      .ftr__tag {
        margin-top: 0.75rem;
        color: var(--ui-color-text-muted);
        max-width: 42ch;
      }
      .ftr__links {
        display: flex;
        gap: 1.5rem;
        flex-wrap: wrap;
        align-items: flex-start;
      }
      .ftr__links a {
        color: var(--ui-color-text-muted);
        font-weight: 500;
        text-decoration: none;
      }
      .ftr__links a:hover {
        color: var(--ui-color-primary);
      }
      .ftr__base {
        display: flex;
        justify-content: space-between;
        margin-top: 2.5rem;
        padding-top: 1.25rem;
        border-top: 1px solid var(--ui-color-border);
        font-size: 0.85rem;
        color: var(--ui-color-text-muted);
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
