import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiBadge } from '@zouriel/ui/badge';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiSpinner } from '@zouriel/ui/spinner';
import { UiText } from '@zouriel/ui/text';
import { FEATURE_TEMPLATE_DESIGNER, FeatureStore } from '../../shared/services/feature.store';
import { SessionStore } from '../../shared/services/session.store';
import { MyDesignsComponent } from './my-designs.component';

/**
 * `/template-designer` — the designer's own page in the menu.
 *
 * <p>It's listed for everyone while it's in testing, so people know it's coming. Only accounts on
 * the testers list (and admins) get the designer here; anyone else is told plainly that it isn't open
 * to them yet, rather than being bounced somewhere else and left wondering what happened.</p>
 */
@Component({
  selector: 'app-designer-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiBadge, UiButton, UiEmptyState, UiSpinner, UiText, MyDesignsComponent],
  template: `
    <div class="page">
      @switch (state()) {
        @case ('loading') {
          <div class="centered"><ui-spinner /></div>
        }
        @case ('allowed') {
          <app-my-designs />
        }
        @default {
          <header class="head">
            <span class="eyebrow">Template designer <ui-badge tone="warning">In testing</ui-badge></span>
            <ui-text variant="h2">Design your own animated invitations</ui-text>
            <ui-text variant="body" class="lead">
              Build a template on a phone-shaped canvas, animate it as guests scroll, and publish it for your own events or the gallery.
            </ui-text>
          </header>

          @if (state() === 'signed-out') {
            <ui-empty-state heading="The designer is open to testers only"
              description="It's being tested by a small group before it opens to everyone. If you were invited to test it, sign in with that email.">
              <div empty-actions>
                <a routerLink="/login" [queryParams]="{ next: '/template-designer' }"><ui-button variant="primary">Sign in</ui-button></a>
                <a routerLink="/templates"><ui-button variant="ghost">Browse templates</ui-button></a>
              </div>
            </ui-empty-state>
          } @else {
            <ui-empty-state heading="You don't have access yet"
              [description]="'The designer is being tested by a small group before it opens to everyone. Your account (' + (session.account()?.email ?? 'this account') + ') isn’t on the testers list.'">
              <div empty-actions>
                <a routerLink="/templates"><ui-button variant="primary">Browse templates</ui-button></a>
                <a routerLink="/inquire"><ui-button variant="ghost">Get a design made for you</ui-button></a>
              </div>
            </ui-empty-state>
          }
        }
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .page { width: 100%; max-width: 1080px; margin: 0 auto; padding: 24px clamp(16px, 4vw, 40px) 120px; box-sizing: border-box; }
    .centered { display: grid; place-items: center; min-height: 40vh; }
    .head { display: grid; gap: 10px; max-width: 680px; margin: 12px 0 28px; }
    .eyebrow { display: inline-flex; align-items: center; gap: 8px; font: 600 12px var(--ui-font-default); letter-spacing: .08em;
      text-transform: uppercase; color: var(--ui-color-text-muted); }
    .lead { color: var(--ui-color-text-secondary); }
    [empty-actions] { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    [empty-actions] a { text-decoration: none; }
  `,
})
export class DesignerHomeComponent {
  protected readonly session = inject(SessionStore);
  private readonly features = inject(FeatureStore);
  private readonly checked = signal(false);

  protected readonly state = computed<'loading' | 'signed-out' | 'denied' | 'allowed'>(() => {
    if (!this.session.isSignedIn()) return 'signed-out';
    if (!this.checked()) return 'loading';
    return this.features.has(FEATURE_TEMPLATE_DESIGNER) ? 'allowed' : 'denied';
  });

  constructor() {
    // Asked fresh on every visit: being added to the testers list shouldn't need a sign-out.
    effect(() => {
      if (!this.session.isSignedIn()) return;
      untracked(() => {
        this.checked.set(false);
        void this.features.refresh().finally(() => this.checked.set(true));
      });
    });
  }
}
