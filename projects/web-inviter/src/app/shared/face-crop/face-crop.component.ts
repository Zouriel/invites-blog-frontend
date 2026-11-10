import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { FacePerson } from '../utils/types/api.types';

/**
 * A round crop of one face. The API stores no face picture: it sends a thumbnail and the face's box as
 * 0-1 fractions of it, and this draws the box filling the circle. The thumbnail's own shape is read
 * when it loads, so a tall photo isn't squashed.
 *
 * <p>The UI library has no cropped-avatar component yet, so this is the one small piece drawn here.</p>
 */
@Component({
  selector: 'app-face-crop',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="crop" [style.width.px]="size()" [style.height.px]="size()" role="img" [attr.aria-label]="label()">
      <img
        [src]="person().coverUrl"
        alt=""
        draggable="false"
        loading="lazy"
        [style.width.px]="imgWidth()"
        [style.left.px]="left()"
        [style.top.px]="top()"
        (load)="loaded($event)"
      />
    </span>
  `,
  styles: `
    :host { display: inline-block; flex: none; line-height: 0; }
    .crop { position: relative; display: block; overflow: hidden; border-radius: 50%; background: var(--ui-color-surface-raised); }
    img { position: absolute; max-width: none; height: auto; user-select: none; -webkit-user-drag: none; }
  `,
})
export class FaceCropComponent {
  readonly person = input.required<FacePerson>();
  readonly size = input(56);
  readonly label = input('Face');

  /** Height over width of the thumbnail, once known. */
  private readonly shape = signal(1);

  /** The whole thumbnail is drawn so the face's width fills the circle. */
  protected readonly imgWidth = computed(() => this.size() / Math.max(0.05, this.person().coverW));
  protected readonly left = computed(() => this.size() / 2 - (this.person().coverX + this.person().coverW / 2) * this.imgWidth());
  protected readonly top = computed(() => this.size() / 2 - (this.person().coverY + this.person().coverH / 2) * this.imgWidth() * this.shape());

  protected loaded(e: Event): void {
    const img = e.target as HTMLImageElement;
    if (img.naturalWidth > 0) this.shape.set(img.naturalHeight / img.naturalWidth);
  }
}
