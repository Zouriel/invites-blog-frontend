/** How tall a tile is for its width. Very long shots are cropped, so one panorama can't fill a screen. */
export function tileHeightRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.min(1.5, Math.max(0.66, height / width));
}

/**
 * Deals items out to columns, each going to the shortest so far, so the columns end level and reading
 * down keeps roughly the order they came in. Returns each column's indexes into the list.
 */
export function masonryColumns(ratios: readonly number[], columns: number): number[][] {
  const out: number[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  ratios.forEach((ratio, i) => {
    let shortest = 0;
    for (let c = 1; c < columns; c++) if (heights[c] < heights[shortest] - 0.001) shortest = c;
    out[shortest].push(i);
    heights[shortest] += ratio;
  });
  return out;
}

export const DEFAULT_COLUMNS = 2;
const MIN_COLUMNS = 1;
const MAX_COLUMNS = 5;

/** The next column count after a pinch: apart makes pictures bigger, together fits more on screen. */
export function pinchedColumns(columns: number, apart: boolean): number {
  return Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, columns + (apart ? -1 : 1)));
}

/** Everyone who added something, most first, then by name. Anyone unnamed isn't a person to choose. */
export function contributorsOf(uploaders: readonly (string | null | undefined)[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of uploaders) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
