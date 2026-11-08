import { CANVAS_WIDTH, REFERENCE_VIEWPORT, type DesignElement, type DesignIssue, type DesignScene } from './scene';
import { ancestors, flatten, labelOf, pageBoxAt, trackOf, visibleAt } from './scene-ops';
import { describeSpan, screensOf } from './screens';

/**
 * What Check can't see from the server: how things sit on the phone. Each element is looked at halfway
 * through its bar (past its way in, before its way out), where it rests.
 *
 * - something wholly or largely off the sides of the screen (or, on a stage, above or below it);
 * - two pieces of text (or buttons) on top of each other while both are showing.
 *
 * Warnings only: a design may mean it (a flourish bleeding off the edge), but usually it's a slip.
 */
export function layoutIssues(scene: DesignScene): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const leaves = flatten(scene).map((f) => f.element).filter((e) => e.type !== 'group');
  const top = (el: DesignElement) => ancestors(scene, el.id)[0] ?? el;
  const where = (el: DesignElement) => describeSpan(screensOf(scene, top(el)));

  for (const el of leaves) {
    const scroll = rest(scene, el);
    const b = box(scene, el, scroll);
    if (!b) continue;
    const name = `“${labelOf(el)}”`;
    const outside = Math.max(0, -b.left) + Math.max(0, b.right - CANVAS_WIDTH);
    if (b.right <= 0 || b.left >= CANVAS_WIDTH) {
      issues.push({ severity: 'warning', code: 'off_screen', message: `${name} is off the side of the screen (${where(el)}).`, elementId: el.id });
    } else if (b.right - b.left < CANVAS_WIDTH * 0.95 && outside > 0.25 * (b.right - b.left)) {
      issues.push({ severity: 'warning', code: 'partly_off_screen', message: `${name} runs off the side of the screen (${where(el)}).`, elementId: el.id });
    }
    if (scene.stage) {
      const topY = b.top - scroll, bottomY = b.bottom - scroll;
      if (bottomY <= 0 || topY >= REFERENCE_VIEWPORT)
        issues.push({ severity: 'warning', code: 'off_screen', message: `${name} is above or below the screen while it shows (${where(el)}).`, elementId: el.id });
      else if (b.bottom - b.top < REFERENCE_VIEWPORT * 0.95 && Math.max(0, -topY) + Math.max(0, bottomY - REFERENCE_VIEWPORT) > 0.25 * (b.bottom - b.top))
        issues.push({ severity: 'warning', code: 'partly_off_screen', message: `${name} runs off the top or bottom of the screen (${where(el)}).`, elementId: el.id });
    }
  }

  // Words on top of words: unreadable, and rarely meant.
  const words = leaves.filter((e) => e.type === 'text' || e.type === 'rsvp' || e.type === 'link');
  for (let i = 0; i < words.length; i++)
    for (let j = i + 1; j < words.length; j++) {
      const a = words[i], c = words[j];
      const scroll = together(scene, a, c);
      if (scroll === null) continue;
      const ba = box(scene, a, scroll), bc = box(scene, c, scroll);
      if (!ba || !bc) continue;
      const w = Math.min(ba.right, bc.right) - Math.max(ba.left, bc.left);
      const h = Math.min(ba.bottom, bc.bottom) - Math.max(ba.top, bc.top);
      if (w <= 0 || h <= 0) continue;
      const smaller = Math.min((ba.right - ba.left) * (ba.bottom - ba.top), (bc.right - bc.left) * (bc.bottom - bc.top));
      if (w * h > 0.2 * smaller)
        issues.push({ severity: 'warning', code: 'text_overlap', message: `“${labelOf(a)}” and “${labelOf(c)}” overlap (${where(a)}).`, elementId: c.id });
    }
  return issues;
}

/** Where an element rests: halfway through the bar that limits it (its own or a group's). */
function rest(scene: DesignScene, el: DesignElement): number {
  const barred = [el, ...ancestors(scene, el.id).reverse()].find((e) => e.track);
  if (barred) {
    const t = trackOf(scene, barred);
    return (t.start + t.end) / 2;
  }
  return scene.stage ? 0 : Math.max(0, el.y - REFERENCE_VIEWPORT / 2);
}

/** A scroll at which both show, if there is one: the middle of where their bars overlap. */
function together(scene: DesignScene, a: DesignElement, c: DesignElement): number | null {
  const range = (el: DesignElement) => {
    const barred = [el, ...ancestors(scene, el.id)].filter((e) => e.track).map((e) => trackOf(scene, e));
    return barred.reduce((r, t) => ({ start: Math.max(r.start, t.start), end: Math.min(r.end, t.end) }), { start: 0, end: Number.MAX_SAFE_INTEGER });
  };
  const ra = range(a), rc = range(c);
  const start = Math.max(ra.start, rc.start), end = Math.min(ra.end, rc.end);
  if (end <= start) return null;
  const mid = end === Number.MAX_SAFE_INTEGER ? (scene.stage ? start : rest(scene, a)) : (start + end) / 2;
  return visibleAt(scene, a, mid) && visibleAt(scene, c, mid) ? mid : null;
}

/** Its box on the page at a scroll, scale included; null when it isn't showing. */
function box(scene: DesignScene, el: DesignElement, scroll: number): { left: number; right: number; top: number; bottom: number } | null {
  const b = pageBoxAt(scene, el.id, scroll);
  if (!b || b.opacity < 0.02 || !visibleAt(scene, el, scroll)) return null;
  const w = b.w * b.scale, h = b.h * b.scale;
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  return { left: cx - w / 2, right: cx + w / 2, top: cy - h / 2, bottom: cy + h / 2 };
}
