import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { UiText } from '@zouriel/ui/text';

/**
 * The notice every viewer of a face-grouped album sees. Compact on the page (the first sentence and
 * "More"); `full` shows all of it, for the opt-out sheet.
 */
@Component({
  selector: 'app-face-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, UiText],
  template: `
    <ui-text variant="caption" class="notice">
      Photos here are grouped by face.
      @if (full() || more()) {
        The host turned this on. We make a numeric template of each face, only to put photos of the same person
        together in this album. Templates stay on our own server, are never shared or sold, and are deleted with
        the photo or album, or when the host turns this off. Anyone can tap That’s me to opt out.
        <a routerLink="/privacy" fragment="faces">Privacy</a>
      } @else {
        <button type="button" class="more" (click)="more.set(true)">More</button>
      }
    </ui-text>
  `,
  styles: `
    .notice { display: block; }
    .more { border: 0; padding: 0; background: none; font: inherit; color: var(--ui-color-primary); text-decoration: underline; cursor: pointer; }
  `,
})
export class FaceNoticeComponent {
  readonly full = input(false);
  protected readonly more = signal(false);
}
