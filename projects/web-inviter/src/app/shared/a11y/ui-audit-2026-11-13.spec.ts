import { describe, expect, it } from 'vitest';
import { FooterComponent } from '../../layout/footer/footer.component';
import { FeedPostComponent } from '../../pages/feed/feed-post.component';
import { BackLinkComponent } from '../back-link/back-link.component';
import { CoverPickerComponent } from '../cover-picker/cover-picker.component';
import { PortfolioCoverComponent } from '../portfolio/portfolio-cover.component';
import { PortfolioLogoComponent } from '../portfolio/portfolio-logo.component';

/**
 * The UI audit of 2026-11-13, asserted from each component's own rules (jsdom doesn't lay out; the real-browser check
 * measured them). The encapsulation attribute is taken out so the selectors read as written.
 */
const css = (c: unknown) =>
  ((c as { ɵcmp: { styles: string[] } }).ɵcmp.styles ?? [])
    .join('\n')
    .replace(/\[_ngcontent-%COMP%\]|\[_nghost-%COMP%\]/g, '')
    .replace(/\s+/g, ' ');
/** The body of the first `@media (pointer: coarse)` block. */
const coarse = (c: unknown) => css(c).match(/@media \(pointer: coarse\) \{(.*?\})\s*\}/)?.[1] ?? '';

describe('UI audit 2026-11-13', () => {
  it('gives the small text links a 44px tap height on touch screens, without moving them', () => {
    // "‹ Settings" was 21px, Reply and Delete 19px, the footer's policy links 20px.
    for (const [c, sel] of [
      [BackLinkComponent, '.back'],
      [FeedPostComponent, '.link'],
      [FooterComponent, '.ftr__links a'],
    ] as const) {
      const body = coarse(c);
      const rule = body.match(new RegExp(`${sel.replace(/\./g, '\\.')} \\{([^}]*)\\}`))?.[1] ?? '';
      expect(rule, `${sel} on touch`).toMatch(/min-height: 44px/);
      // The extra height is given back, so the line around it doesn't move.
      expect(rule, `${sel} keeps its place`).toMatch(/margin-block: -/);
    }
  });

  it('draws the "Template preview" badge at 12px or more and the feed counter on a darker scrim', () => {
    expect(css(CoverPickerComponent)).toMatch(/\.cover__badge \{[^}]*font-size: 0\.75rem/);
    // White on 65% black stays above 4.5:1 even over a white photo; 50% was 4.31:1.
    expect(css(FeedPostComponent)).toMatch(/\.flag \{[^}]*var\(--ui-media-scrim\) 65%/);
  });

  it('makes the portfolio setup\'s logo and cover upload boxes the same width', () => {
    const width = (c: unknown) => css(c).match(/\.box \{ max-width: (\d+px); \}/)?.[1];
    expect(width(PortfolioLogoComponent)).toBeDefined();
    expect(width(PortfolioLogoComponent)).toBe(width(PortfolioCoverComponent));
  });
});
