import { ChangeDetectionStrategy, Component, ElementRef, afterRenderEffect, computed, inject, input, signal, viewChild } from '@angular/core';
import { PremiumOfferComponent } from '../../../shared/plans/premium-offer.component';
import { SessionStore } from '../../../shared/services/session.store';
import { catalog, designerAddOn, mvr } from '../../../shared/utils/plans';
import { FormsModule } from '@angular/forms';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import { UiAlert } from '@zouriel/ui/alert';
import { UiButton, UiIconButton } from '@zouriel/ui/button';
import { UiChatBubble } from '@zouriel/ui/chat-bubble';
import { UiEmptyState } from '@zouriel/ui/feedback';
import { UiTextarea } from '@zouriel/ui/form';
import { UiSpinner } from '@zouriel/ui/spinner';
import { ICONS } from '../designer-icons';
import { DesignAssistant } from './design-assistant';

/** One-tap starts, so nobody faces an empty box. */
const SUGGESTIONS = [
  'Design a wedding invitation from scratch',
  'Change the colours to soft blush and gold',
  'Give everything a gentle way in',
  'Check the design for problems',
];

/**
 * The design assistant's chat: the side panel's Assistant tab on a computer, the sidebar on a phone.
 * The work itself happens in {@link DesignAssistant}, which outlives this view.
 */
@Component({
  selector: 'app-assistant-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PremiumOfferComponent, FormsModule, HugeiconsIconComponent, UiAlert, UiButton, UiIconButton, UiChatBubble, UiEmptyState, UiTextarea, UiSpinner],
  template: `
    @if (assistant.loadError(); as error) {
      <ui-alert tone="danger" heading="The assistant couldn't be loaded">{{ error }}</ui-alert>
    } @else if (!assistant.loaded()) {
      <div class="centre"><ui-spinner /></div>
    } @else if (assistant.status()?.reason === 'premium') {
      <!-- Not on for this account: Premium without it adds it; anyone else gets Premium with it (docs/PRICING-2026-11.md §3). -->
      <ui-empty-state heading="Design with the AI designer" [description]="offerLine()">
        <div empty-actions>
          <ui-button tier="premium" (click)="offerOpen.set(true)">{{ onPremium() ? 'Add the AI designer' : 'Get Premium with the AI designer' }}</ui-button>
        </div>
      </ui-empty-state>
      <app-premium-offer [(open)]="offerOpen" reason="ai" />
    } @else if (assistant.status()?.reason === 'unavailable') {
      <ui-alert tone="info" heading="The assistant is resting">It isn't available right now. Please try again later.</ui-alert>
    } @else {
      <div class="chat">
        <div class="log" #log role="log" aria-live="polite" aria-label="Chat with the design assistant">
          @for (m of assistant.messages(); track m.id + $index) {
            @if (m.role === 'results') {
              <ul class="lines" aria-label="What the assistant did">
                @for (l of m.lines; track $index) { <li>{{ l }}</li> }
              </ul>
            } @else {
              <ui-chat-bubble [mine]="m.role === 'user'" [ariaLabel]="m.role === 'user' ? 'You' : 'Assistant'">{{ m.text }}</ui-chat-bubble>
            }
          } @empty {
            <div class="intro">
              <p>Tell me what to make or change: a whole invitation, the colours, the wording, how things move. I'll do it in the design, and you can undo it in one tap.</p>
              <div class="suggestions">
                @for (s of suggestions; track s) {
                  <ui-button size="sm" variant="outline" [disabled]="!assistant.allowed()" (click)="assistant.send(s)">{{ s }}</ui-button>
                }
              </div>
            </div>
          }
          @if (assistant.working()) {
            <div class="working" role="status">
              <ui-spinner size="sm" />
              <span>{{ assistant.activity() }}</span>
              <ui-button size="sm" variant="ghost" (click)="assistant.stop()">Stop</ui-button>
            </div>
          }
        </div>

        @if (assistant.error(); as error) {
          <ui-alert tone="danger" class="note">{{ error }}</ui-alert>
        }
        @if (assistant.status()?.reason === 'allowance') {
          <ui-alert tone="warning" class="note">You've used this month's AI allowance. It resets on {{ resetDate() }}.</ui-alert>
        } @else if (assistant.usedPercent() >= 50) {
          <p class="usage">{{ assistant.usedPercent() }}% of this month's AI allowance used</p>
        }

        <div class="actions">
          @if (assistant.canUndoLast()) {
            <ui-button size="sm" variant="outline" (click)="assistant.undoLast()">Undo the last changes</ui-button>
          }
          <span class="spacer"></span>
          @if (assistant.messages().length) {
            <ui-button size="sm" variant="ghost" [disabled]="assistant.working()" (click)="assistant.clear()">New chat</ui-button>
          }
        </div>

        <form class="composer" (submit)="$event.preventDefault(); submit()">
          <ui-textarea [(ngModel)]="draft" name="message" [autosize]="true" [maxRows]="6" [rows]="1" [maxlength]="2000"
            placeholder="Ask for a change…" ariaLabel="Message to the design assistant" (keydown)="onKey($event)">
            <ui-icon-button textarea-trailing type="submit" size="sm" variant="primary" label="Send"
              [disabled]="!draft().trim() || assistant.working() || !assistant.allowed()">
              <hugeicons-icon [icon]="icons.send" [size]="18" [strokeWidth]="2" />
            </ui-icon-button>
          </ui-textarea>
        </form>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; min-height: 0; height: 100%; }
    .centre { display: grid; place-items: center; padding: var(--ui-space-8); }
    .chat { display: flex; flex-direction: column; min-height: 0; flex: 1; gap: var(--ui-space-2); }
    .log { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: var(--ui-space-2); padding: var(--ui-space-1) 0; }
    .lines {
      margin: 0; padding: 0 0 0 var(--ui-space-4); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm);
      display: flex; flex-direction: column; gap: 2px;
    }
    .intro { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .intro p { margin: 0 0 var(--ui-space-3); }
    .suggestions { display: flex; flex-wrap: wrap; gap: var(--ui-space-2); }
    .working { display: flex; align-items: center; gap: var(--ui-space-2); color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .usage { margin: 0; color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); }
    .actions { display: flex; align-items: center; gap: var(--ui-space-2); min-height: 0; }
    .actions:empty { display: none; }
    .spacer { flex: 1; }
    .composer { display: block; }
  `,
})
export class AssistantPanelComponent {
  protected readonly assistant = inject(DesignAssistant);
  protected readonly icons = ICONS;
  protected readonly suggestions = SUGGESTIONS;
  protected readonly draft = signal('');

  private readonly session = inject(SessionStore);
  protected readonly offerOpen = signal(false);
  protected readonly onPremium = computed(() => this.session.isPremium());
  protected readonly offerLine = computed(() => {
    const price = mvr(designerAddOn(catalog()).price);
    return this.onPremium()
      ? `Tell it what you want and it builds and changes your template for you, using the same tools you do. Add it to your Premium for ${price} a month.`
      : `Tell it what you want and it builds and changes your template for you, using the same tools you do. It is an add-on to Premium, ${price} a month.`;
  });
  /** On a computer Enter sends and Shift+Enter starts a new line; on a phone Enter is a new line. */
  readonly enterSends = input(true);

  private readonly log = viewChild<ElementRef<HTMLElement>>('log');

  constructor() {
    void this.assistant.load();
    // Keep the newest message in view.
    afterRenderEffect(() => {
      this.assistant.messages();
      this.assistant.working();
      const el = this.log()?.nativeElement;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
      // The phone's sidebar is still sliding in on first render, so its height settles a moment later.
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
      setTimeout(() => (el.scrollTop = el.scrollHeight), 400);
    });
  }

  protected submit(): void {
    const text = this.draft().trim();
    if (!text || this.assistant.working() || !this.assistant.allowed()) return;
    this.draft.set('');
    void this.assistant.send(text);
  }

  protected onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey && this.enterSends() && !e.isComposing) {
      e.preventDefault();
      this.submit();
    }
  }

  protected resetDate(): string {
    const at = this.assistant.status()?.resetsAt;
    return at ? new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : 'the 1st';
  }
}
