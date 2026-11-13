import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { UiChoiceGrid, type UiChoice } from '@zouriel/ui/form';
import { UiThemeSwatch } from '@zouriel/ui/theme';
import { UiText } from '@zouriel/ui/text';
import { PortfolioOptions } from './portfolio.types';

/**
 * The page's look as three named choices with pictures (plain-defaults rule: no colour codes): a theme drawn as
 * a small page, a colour for buttons, and a pair of fonts.
 */
@Component({
  selector: 'app-portfolio-look',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [UiChoiceGrid, UiThemeSwatch, UiText],
  template: `
    @if (options(); as o) {
      <ui-text variant="h4">Theme</ui-text>
      <ui-choice-grid label="Theme" [options]="themeChoices()" [(value)]="theme" minTile="104px">
        <ng-template #tile let-item>
          <ui-theme-swatch [colors]="swatch(item.value)" [accent]="accentColour()" />
        </ng-template>
      </ui-choice-grid>

      <ui-text variant="h4">Button colour</ui-text>
      <ui-choice-grid label="Button colour" [options]="accentChoices()" [(value)]="accent" minTile="96px">
        <ng-template #tile let-item>
          <span class="dot" [style.background]="dotColour(item.value)"></span>
        </ng-template>
      </ui-choice-grid>

      <ui-text variant="h4">Fonts</ui-text>
      <ui-choice-grid label="Fonts" [options]="fontChoices()" [(value)]="font" minTile="104px">
        <ng-template #tile let-item>
          <span class="sample" [style.font-family]="fontFamily(item.value)">Aa</span>
        </ng-template>
      </ui-choice-grid>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: var(--ui-space-3); }
    .dot { display: block; width: 40px; height: 40px; margin: 0 auto; border-radius: 50%; border: 2px solid var(--ui-color-border); }
    .sample { display: block; font-size: 1.8rem; line-height: 1.2; text-align: center; }
  `,
})
export class PortfolioLookComponent {
  readonly options = input<PortfolioOptions | null>(null);
  readonly theme = model<string | null>('oxblood');
  readonly accent = model<string | null>('theme');
  readonly font = model<string | null>('classic');

  protected readonly themeChoices = computed<UiChoice[]>(() =>
    (this.options()?.themes ?? []).map((t) => ({ value: t.key, label: t.label })),
  );
  protected readonly accentChoices = computed<UiChoice[]>(() =>
    (this.options()?.accents ?? []).map((a) => ({ value: a.key, label: a.label })),
  );
  protected readonly fontChoices = computed<UiChoice[]>(() =>
    (this.options()?.fonts ?? []).map((f) => ({ value: f.key, label: f.label })),
  );
  /** The chosen button colour, drawn into every theme picture (null: each theme's own). */
  protected readonly accentColour = computed(() => this.options()?.accents.find((a) => a.key === this.accent())?.color ?? null);

  protected swatch(key: string) {
    const t = this.options()?.themes.find((x) => x.key === key);
    return t ? { bg: t.bg, surface: t.surface, text: t.text, muted: t.muted, accent: t.accent } : { bg: '#fff', surface: '#eee', text: '#111', muted: '#666', accent: '#111' };
  }

  protected dotColour(key: string): string {
    return this.options()?.accents.find((a) => a.key === key)?.color ?? this.swatch(this.theme() ?? 'oxblood').accent;
  }

  /** The heading font of the pair, with a sensible fallback while it isn't loaded in the app. */
  protected fontFamily(key: string): string {
    const f = this.options()?.fonts.find((x) => x.key === key);
    if (!f || f.heading === 'system-ui') return 'system-ui, sans-serif';
    return `'${f.heading}', ${f.heading === f.body ? 'sans-serif' : 'Georgia, serif'}`;
  }
}
