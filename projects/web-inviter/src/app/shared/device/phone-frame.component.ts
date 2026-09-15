import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * A modern phone, drawn: a metal rim, a black bezel around the screen, the camera island and the side
 * buttons, with a faint glass sheen. Whatever is projected into it (a video, an image) fills the
 * screen and is clipped to its rounded corners.
 *
 * <p>The screen is 386 × 848 units in a 430 × 880 drawing, the proportions of a current phone, so a
 * recording made at that shape fills it without letterboxing. Drawn here rather than taken from a
 * manufacturer's artwork, which is trademarked, and coloured from the design tokens so it sits
 * right in both themes.</p>
 */
@Component({
  selector: 'app-phone-frame',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="device">
      <div class="device__screen"><ng-content /></div>
      <svg class="device__frame" viewBox="0 0 430 880" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="ib-phone-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" class="stop-light" />
            <stop offset="0.45" class="stop-mid" />
            <stop offset="0.55" class="stop-dark" />
            <stop offset="1" class="stop-light" />
          </linearGradient>
          <linearGradient id="ib-phone-sheen" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" class="sheen-a" />
            <stop offset="0.35" class="sheen-b" />
          </linearGradient>
        </defs>

        <!-- Side buttons: action and volume on the left, power on the right. -->
        <rect class="btn" x="1" y="178" width="7" height="34" rx="2.5" />
        <rect class="btn" x="1" y="238" width="7" height="62" rx="2.5" />
        <rect class="btn" x="1" y="312" width="7" height="62" rx="2.5" />
        <rect class="btn" x="422" y="266" width="7" height="98" rx="2.5" />

        <!-- The metal rim: the outer shape with the bezel cut out of it. -->
        <path
          class="rim"
          fill-rule="evenodd"
          d="M72 0H358A66 66 0 0 1 424 66V814A66 66 0 0 1 358 880H72A66 66 0 0 1 6 814V66A66 66 0 0 1 72 0Z
             M75 7H355A59 59 0 0 1 414 66V814A59 59 0 0 1 355 873H75A59 59 0 0 1 16 814V66A59 59 0 0 1 75 7Z"
        />
        <!-- The black bezel: the inside of the rim with the screen cut out of it. -->
        <path
          class="bezel"
          fill-rule="evenodd"
          d="M75 7H355A59 59 0 0 1 414 66V814A59 59 0 0 1 355 873H75A59 59 0 0 1 16 814V66A59 59 0 0 1 75 7Z
             M74 16H356A52 52 0 0 1 408 68V812A52 52 0 0 1 356 864H74A52 52 0 0 1 22 812V68A52 52 0 0 1 74 16Z"
        />
        <!-- A hairline where the rim meets the bezel catches the light. -->
        <path
          class="edge"
          d="M75 7H355A59 59 0 0 1 414 66V814A59 59 0 0 1 355 873H75A59 59 0 0 1 16 814V66A59 59 0 0 1 75 7Z"
        />
        <!-- Camera island. -->
        <rect class="island" x="167" y="36" width="96" height="28" rx="14" />
        <circle class="lens" cx="247" cy="50" r="5" />
        <!-- Glass: a faint diagonal sheen across the top of the screen. -->
        <path class="sheen" d="M74 16H356A52 52 0 0 1 408 68V260L22 520V68A52 52 0 0 1 74 16Z" />
      </svg>
    </div>
  `,
  styles: `
    :host { display: block; }
    .device { position: relative; width: 100%; aspect-ratio: 430 / 880; }
    /* The screen area of the drawing, in percentages of the drawing, clipped to its corner radius. */
    .device__screen {
      position: absolute;
      left: calc(22 / 430 * 100%);
      top: calc(16 / 880 * 100%);
      width: calc(386 / 430 * 100%);
      height: calc(848 / 880 * 100%);
      border-radius: calc(52 / 386 * 100%) / calc(52 / 848 * 100%);
      overflow: hidden;
      background: var(--ui-media-bg);
      isolation: isolate;
    }
    .device__frame { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .rim { fill: url(#ib-phone-rim); }
    .stop-light { stop-color: color-mix(in srgb, var(--ui-color-text-muted) 45%, var(--ui-winter-white)); }
    .stop-mid { stop-color: color-mix(in srgb, var(--ui-color-text-muted) 80%, var(--ui-winter-white)); }
    .stop-dark { stop-color: color-mix(in srgb, var(--ui-color-text) 70%, var(--ui-color-text-muted)); }
    .btn { fill: color-mix(in srgb, var(--ui-color-text-muted) 70%, var(--ui-color-text)); }
    .bezel { fill: var(--ui-media-scrim); }
    .edge { fill: none; stroke: color-mix(in srgb, var(--ui-winter-white) 35%, transparent); stroke-width: 1; }
    .island { fill: var(--ui-media-scrim); }
    .lens { fill: color-mix(in srgb, var(--ui-color-primary) 35%, var(--ui-media-scrim)); }
    .sheen { fill: url(#ib-phone-sheen); }
    .sheen-a { stop-color: var(--ui-winter-white); stop-opacity: 0.1; }
    .sheen-b { stop-color: var(--ui-winter-white); stop-opacity: 0; }
  `,
})
export class PhoneFrameComponent {}
