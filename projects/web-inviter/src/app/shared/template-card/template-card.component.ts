import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiCard } from '@zouriel/ui/card';
import { UiText } from '@zouriel/ui/text';
import { UiChip } from '@zouriel/ui/badge';
import { Template } from '../utils/types/api.types';
import { SafeUrlPipe } from '../pipes/safe-url.pipe';

/**
 * One template in the gallery.
 *
 * A card shows a still, and only becomes the real thing when someone asks for it. The gallery used
 * to render every card as a live iframe of the entire invitation — each one a separate browsing
 * context with its own document, images and animations, running whether or not anyone looked at it.
 * That is the facade pattern the platform vendors all recommend for heavy embeds, and it matters
 * more here than for a video embed: these templates animate continuously.
 *
 * Motion still matters — these are scroll-driven invitations and a still undersells them — so the
 * live template loads on INTENT: a pointer that can hover, hovering. It unloads on leave, so at most
 * one invitation is ever running. Touch devices never load one at all; a tap goes to the detail
 * page, where a live preview is the whole point and is the only thing on screen.
 *
 * Falls back to the old behaviour when a template has no poster, so nothing regresses while the
 * back catalogue is filled in.
 */
@Component({
  selector: 'app-template-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiCard, UiText, UiChip, SafeUrlPipe],
  templateUrl: './template-card.component.html',
  styleUrl: './template-card.component.scss',
})
export class TemplateCardComponent {
  readonly template = input.required<Template>();
  /** Eager cards (the first row) skip lazy loading so the gallery paints its top immediately. */
  readonly priority = input(false);

  /**
   * The card image. `previewImageUrl` historically pointed at the template's own index.html — a
   * page, not an image — so anything still pointing there is treated as "no poster" rather than
   * rendered into an <img> that would silently break.
   */
  protected readonly poster = computed(() => {
    const url = this.template().previewImageUrl;
    if (!url || url.endsWith('index.html')) return null;
    return url;
  });

  protected readonly liveUrl = computed(() => this.template().packageUrl + 'index.html');

  /** True once the real template has been asked for. Without a poster there is nothing else to show. */
  protected readonly live = signal(false);

  protected activate(): void {
    // Only where hovering is a real, deliberate act. On touch, `hover: hover` is false and a stray
    // pointer event must never start loading an entire invitation the reader did not ask for.
    if (typeof window === 'undefined') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    this.live.set(true);
  }

  protected release(): void {
    // Dropping the iframe frees the document, its images and its animation loops. Cheap to restart,
    // and it keeps the gallery to one running invitation at a time.
    this.live.set(false);
  }
}
