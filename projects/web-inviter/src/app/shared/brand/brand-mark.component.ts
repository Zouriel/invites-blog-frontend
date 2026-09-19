import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * The invites.blog mark: "ib" drawn as one line, with an envelope in the b and a camera shutter for
 * the dot of the i.
 *
 * The i runs down, turns along the baseline and becomes the b, so the invitation and the blog are a
 * single stroke. The b's bowl is an envelope, which is what gets sent. The dot of the i is a camera
 * shutter, for the photos that come back.
 *
 * Two colours: the letters take the brand blue and the shutter the strongest ink on the ground —
 * white on the dark theme, Black Pine on the light one. Set `--ib-mark-ink` or `--ib-mark-accent`
 * to recolour either half on a ground the theme doesn't cover.
 */
@Component({
  selector: 'app-brand-mark',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      [attr.aria-label]="label() || null"
      [attr.aria-hidden]="label() ? null : true"
    >
      <g class="accent" stroke-linecap="round">
      <circle cx="5.5" cy="6.4" r="3.05" stroke-width="1.1"/>
      <path d="M7.14 6.84L4.65 9.33M5.94 8.04L2.54 7.13M4.30 7.60L3.39 4.20M3.86 5.96L6.35 3.47M5.06 4.76L8.46 5.67M6.70 5.20L7.61 8.60" stroke-width="0.75"/>
      </g>
      <path class="ink" d="M5.5 13v11.75a3.25 3.25 0 0 0 3.25 3.25H20a7.5 7.5 0 0 0 0-15h-8M12 4.5V28" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="ink" d="M14.4 16.1 19 19.9 23.4 16.1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    .ink {
      stroke: var(--ib-mark-ink, var(--ui-color-primary));
    }
    .accent {
      stroke: var(--ib-mark-accent, currentColor);
    }
  `,
})
export class BrandMarkComponent {
  /** Rendered size in px. Legible down to 16. */
  readonly size = input(22);
  /** Set only where the mark carries meaning on its own; otherwise it's decorative. */
  readonly label = input<string>('');
}
