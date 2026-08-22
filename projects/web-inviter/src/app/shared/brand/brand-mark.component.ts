import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The invites.blog mark: an embossed seal — a hand-pressed rim, a fine inner ring, and a boss.
 *
 * It replaces the ✦ that stood in everywhere. A four-pointed sparkle says nothing about invitations
 * — it's the glyph every product reaches for — whereas a seal is the one object the whole business
 * is about: something closed by hand, addressed to one person, opened once.
 *
 * Three earlier attempts are worth not repeating: filled with even lobes it reads as a "verified"
 * badge; a lowercase "i" inside a round outline reads as the information symbol; and an envelope
 * flap crease over a rule reads as a download arrow.
 *
 * Drawn rather than set in type so it holds up at 18px in the nav and at 84px on the success page.
 * Every lobe of the rim still has its own radius — wax pressed by hand spreads unevenly — but the
 * variation is slight now: enough that no two bumps match, not so much that it turns spiky.
 */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 32 32"
      role="img"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : true"
    >
      <path class="wax" d="M29.5 16.0C29.5 17.2 28.3 18.0 27.9 19.2C27.5 20.4 28.0 21.6 27.4 22.6C26.7 23.5 25.3 23.5 24.5 24.5C23.7 25.5 23.8 27.2 22.9 27.9C21.9 28.6 20.5 27.9 19.3 28.2C18.0 28.4 17.2 29.4 16.0 29.3C14.8 29.2 14.1 28.1 12.8 27.8C11.6 27.6 10.2 28.5 9.1 28.0C8.0 27.5 7.8 26.0 7.0 25.0C6.2 24.0 5.2 23.6 4.7 22.5C4.2 21.4 4.9 20.3 4.4 19.1C4.0 17.9 2.5 17.2 2.4 16.0C2.3 14.8 3.6 14.0 4.0 12.8C4.3 11.5 3.9 10.4 4.5 9.4C5.2 8.4 6.6 8.4 7.4 7.4C8.2 6.4 8.1 4.7 9.1 4.1C10.1 3.4 11.4 4.0 12.7 3.8C14.0 3.5 14.8 2.7 16.0 2.8C17.2 2.9 17.9 4.1 19.1 4.3C20.4 4.6 21.8 3.7 22.8 4.2C23.9 4.7 24.0 6.2 24.9 7.1C25.7 8.1 27.0 8.3 27.6 9.3C28.1 10.4 27.5 11.6 27.9 12.8C28.2 14.1 29.4 14.8 29.5 16.0Z" />
      <!-- The impression: a fine inner rim and a struck boss. Every pictorial impression tried
           here collapsed into a UI icon at nav size — an envelope became a stock glyph, a lowercase
           "i" became the information symbol, a flap crease became a download arrow. A boss inside a
           double rim is what a real seal actually looks like, and it resembles no icon at all. -->
      <circle class="press" cx="16" cy="16" r="8.1" />
      <circle class="boss" cx="16" cy="16" r="2.5" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    /* currentColor throughout, so it inherits whatever it sits on. Stroked, not filled: a solid
       disc at nav size reads as a notification badge no matter how its edge is shaped, while an
       outline reads as something pressed into paper. */
    .wax {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.7;
    }
    .press {
      fill: none;
      stroke: currentColor;
      stroke-width: 1.2;
      opacity: 0.55;
    }
    /* Filled, so there is one solid note in an otherwise drawn mark — the wordmark's coloured dot,
       pressed into the seal. */
    .boss {
      fill: currentColor;
    }
  `,
})
export class BrandMarkComponent {
  /** Rendered size in px. The impression stays legible down to about 16. */
  readonly size = input(22);
  /** Set only where the mark carries meaning on its own; otherwise it's decorative. */
  readonly label = input<string>('');
}
