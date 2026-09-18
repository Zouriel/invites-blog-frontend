import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiButton } from '@zouriel/ui/button';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiText } from '@zouriel/ui/text';
import { SessionStore } from '../../shared/services/session.store';
import { MyDesignsComponent } from './my-designs.component';

/**
 * `/template-designer` — the designer's own page in the menu.
 *
 * <p>The designer is for designer accounts (and admins). Anyone else who reaches this page — from an
 * old link, or a guard sending them here — is told plainly who it's for and pointed at the gallery,
 * rather than being bounced somewhere else and left wondering what happened.</p>
 */
@Component({
  selector: 'app-designer-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiButton, UiEmptyState, UiText, MyDesignsComponent],
  template: `
    <div class="page">
      @switch (state()) {
        @case ('allowed') {
          <app-my-designs />
        }
        @default {
          <header class="head">
            <span class="eyebrow">Template designer</span>
            <ui-text variant="h2">Design animated invitations</ui-text>
            <ui-text variant="body" class="lead">
              Designers build templates on a phone-shaped canvas, animate them as guests scroll, and publish them to the gallery.
            </ui-text>
          </header>

          @if (state() === 'signed-out') {
            <ui-empty-state heading="For designer accounts"
              description="Sign in with your designer account to open the designer.">
              <div empty-actions>
                <a routerLink="/login" [queryParams]="{ next: '/template-designer' }"><ui-button variant="primary">Sign in</ui-button></a>
                <a routerLink="/templates"><ui-button variant="ghost">Browse templates</ui-button></a>
              </div>
            </ui-empty-state>
          } @else {
            <ui-empty-state heading="The designer is for designer accounts"
              [description]="'Your account (' + (session.account()?.email ?? 'this account') + ') isn’t a designer account. You can pick any template from the gallery, or have one made for you.'">
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
    .head { display: grid; gap: 10px; max-width: 680px; margin: 12px 0 28px; }
    .eyebrow { font: 600 12px var(--ui-font-default); letter-spacing: .08em; text-transform: uppercase; color: var(--ui-color-text-muted); }
    .lead { color: var(--ui-color-text-secondary); }
    [empty-actions] { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
    [empty-actions] a { text-decoration: none; }
  `,
})
export class DesignerHomeComponent {
  protected readonly session = inject(SessionStore);

  protected readonly state = computed<'signed-out' | 'denied' | 'allowed'>(() => {
    if (!this.session.isSignedIn()) return 'signed-out';
    return this.session.isDesigner() ? 'allowed' : 'denied';
  });
}
