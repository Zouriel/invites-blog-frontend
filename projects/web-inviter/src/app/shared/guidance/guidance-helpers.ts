import { DestroyRef, inject, signal } from '@angular/core';
import { UiGuidanceCheck, UiTourOutcome, UiTourService, UiTourSpec, injectUiGuidance } from '@zouriel/ui/guidance';

/**
 * An offer card on a page (ui-offer-card), shown through the app's UiGuidance so it follows the
 * rules: tips on, not seen, nothing else on screen, one offer a session. `ask` puts it on screen
 * (`visible`) and resolves with how it ended; the card's buttons call `end`. Leaving the page closes
 * it, which counts as seen (it was shown).
 */
export function offerGate() {
  const guidance = injectUiGuidance();
  const visible = signal(false);
  let resolve: ((o: UiTourOutcome) => void) | null = null;
  const end = (outcome: UiTourOutcome) => {
    visible.set(false);
    const r = resolve;
    resolve = null;
    r?.(outcome);
  };
  inject(DestroyRef).onDestroy(() => end('closed'));
  return {
    visible: visible.asReadonly(),
    /** `event`: an offer something happened to trigger (a role, a first event), so it doesn't use up the
     *  session's one welcome-style offer. */
    ask(id: string, check: Omit<UiGuidanceCheck, 'kind'> & { event?: boolean } = {}): Promise<UiTourOutcome | null> {
      if (!guidance) return Promise.resolve(null);
      return guidance.requestTip(
        id,
        () =>
          new Promise<UiTourOutcome>((r) => {
            resolve = r;
            visible.set(true);
          }),
        { skipWhen: check.skipWhen, kind: check.event ? 'tour' : 'offer' },
      );
    },
    end,
  };
}

/** Runs a tour (or a one-step tab tip) through UiGuidance: `kind` decides which cap it counts toward. */
export function tourRunner() {
  const guidance = injectUiGuidance();
  const tours = inject(UiTourService);
  inject(DestroyRef).onDestroy(() => tours.stop());
  return (spec: UiTourSpec, check: UiGuidanceCheck = {}): Promise<UiTourOutcome | null> =>
    guidance ? guidance.requestTip(spec.id, () => tours.start(spec), { kind: 'tour', ...check }) : Promise.resolve(null);
}

/** Waits for the page to have drawn (two frames), so a tour finds its anchors on screen. */
export function afterPaint(): Promise<void> {
  return new Promise((r) => {
    if (typeof requestAnimationFrame === 'undefined') return r();
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  });
}
