import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { UiThemeService } from '@zouriel/ui/theme';
import { EMPTY_ART_VERSION, EmptyArtKey } from './tips';

/** Whether a library theme is a dark one (oxblood-dark, navy-dark, darkOrange, goldBlack, …). */
export function isDarkTheme(theme: string | null | undefined): boolean {
  return !!theme && /dark|black/i.test(theme);
}

/**
 * The picture at the top of an empty page (docs/GUIDANCE.md section 8): a blank version of what will
 * fill the page, in the light or dark drawing to match the theme. Goes in ui-empty-state's
 * `[empty-art]` slot. Decorative: the heading says it.
 */
@Component({
  selector: 'app-empty-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<img [src]="src()" alt="" width="320" height="200" decoding="async" />`,
  styles: `
    :host { display: block; }
    img { display: block; width: 100%; height: auto; max-height: 200px; margin-inline: auto; object-fit: contain; }
  `,
  host: { 'aria-hidden': 'true' },
})
export class EmptyArtComponent {
  private readonly theme = inject(UiThemeService);
  readonly key = input.required<EmptyArtKey>();
  protected readonly src = computed(
    () => `/empty-art/empty-${this.key()}-${isDarkTheme(this.theme.theme()) ? 'dark' : 'light'}.svg?v=${EMPTY_ART_VERSION}`,
  );
}
