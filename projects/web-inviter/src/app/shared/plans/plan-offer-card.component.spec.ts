import { PlanOfferCardComponent } from './plan-offer-card.component';

/**
 * The subscription cards on Plans (Premium, Photographer, Studio) sit side by side in one ui-plan-grid row. The grid
 * stretches each cell to the tallest card; the card only fills it when the height reaches it through every wrapper,
 * which here is this component's host AND the ui-plan-card inside it. Without the second, the three cards ended at
 * three different heights with their buttons out of line (owner, 2026-11-13). jsdom can't measure, so this checks the
 * rules themselves; the real-browser measurement is in the PR.
 */
describe('PlanOfferCardComponent: equal height in a plan row', () => {
  const css = (PlanOfferCardComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('').replace(/\s+/g, ' ');

  it('fills its stretched grid cell with its host', () => {
    expect(css).toMatch(/(:host|\[_nghost-[^\]]+\])\s*\{[^}]*height:\s*100%/);
  });

  it('makes the ui-plan-card inside fill the host, so the card and its button reach the bottom', () => {
    expect(css).toMatch(/ui-plan-card(\[[^\]]+\])?\s*\{[^}]*height:\s*100%/);
  });
});
