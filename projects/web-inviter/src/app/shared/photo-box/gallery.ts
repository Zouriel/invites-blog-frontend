/** How tall a tile is for its width. Very long shots are cropped, so one panorama can't fill a screen. */
export function tileHeightRatio(width: number, height: number): number {
  if (!(width > 0) || !(height > 0)) return 1;
  return Math.min(1.5, Math.max(0.66, height / width));
}

export const DEFAULT_COLUMNS = 2;

/** Everyone who added something, most first, then by name. Anyone unnamed isn't a person to choose. */
export function contributorsOf(uploaders: readonly (string | null | undefined)[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const name of uploaders) if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
