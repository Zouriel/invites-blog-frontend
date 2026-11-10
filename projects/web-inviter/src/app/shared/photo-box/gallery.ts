import { type UiFilterSection, type UiFilterValue, uiActiveFilters, uiFilterPrune } from '@zouriel/ui/filter';

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

/** Filter section ids in the album. */
export const ALBUM_WHO = 'who';
export const ALBUM_KIND = 'kind';
/** Favourites only: which event or album each item came from. */
export const ALBUM_WHERE = 'where';
/** Faces: the people found in the album's photos. */
export const ALBUM_PEOPLE = 'people';

type Filterable = { uploaderName?: string | null; contentType?: string | null; albumTitle?: string | null; people?: readonly string[] | null };

/** What the filter needs to know of a face group. */
export type FaceChoice = { id: string; name: string | null };

/** "Mia", or "Person 3" by the group's place in the list when nobody has named it. */
export function personLabel(people: readonly FaceChoice[], id: string): string {
  const at = people.findIndex((p) => p.id === id);
  return people[at]?.name?.trim() || `Person ${at + 1}`;
}

export function isVideoType(contentType: string | null | undefined): boolean {
  return !!contentType && contentType.startsWith('video/');
}

/**
 * The album's filter sections: "Uploaded by" once there's a choice of people (two, or one person and
 * photos with no name), "Photos or videos" once the album holds both. New filters are new sections:
 * the toolbar keeps its one Filter button.
 */
export function albumFilterSections(photos: readonly Filterable[], faces: readonly FaceChoice[] = []): UiFilterSection[] {
  const sections: UiFilterSection[] = [];
  // Favourites come from many albums: which one is the first thing to narrow by.
  const albums = contributorsOf(photos.map((p) => p.albumTitle));
  if (albums.length > 1) {
    sections.push({
      id: ALBUM_WHERE,
      title: 'Event or album',
      multiple: true,
      allLabel: 'All of them',
      allCount: photos.length,
      options: albums.map((c) => ({ id: c.name, label: c.name, count: c.count })),
    });
  }
  const people = contributorsOf(photos.map((p) => p.uploaderName));
  const named = people.reduce((n, c) => n + c.count, 0);
  if (people.length > 1 || (people.length === 1 && named < photos.length)) {
    sections.push({
      id: ALBUM_WHO,
      title: 'Uploaded by',
      multiple: true,
      allLabel: 'Everyone',
      allCount: photos.length,
      options: people.map((c) => ({ id: c.name, label: c.name, count: c.count })),
    });
  }
  if (faces.length) {
    const counts = new Map<string, number>();
    for (const p of photos) for (const id of new Set(p.people ?? [])) counts.set(id, (counts.get(id) ?? 0) + 1);
    // A group whose photos are all gone offers nothing to pick.
    const options = faces
      .filter((f) => counts.has(f.id))
      .map((f) => ({ id: f.id, label: personLabel(faces, f.id), count: counts.get(f.id)! }));
    if (options.length) {
      sections.push({ id: ALBUM_PEOPLE, title: 'People', multiple: true, allLabel: 'Everyone', allCount: photos.length, options });
    }
  }
  const videos = photos.filter((p) => isVideoType(p.contentType)).length;
  if (videos > 0 && videos < photos.length) {
    sections.push({
      id: ALBUM_KIND,
      title: 'Photos or videos',
      allLabel: 'Both',
      allCount: photos.length,
      options: [
        { id: 'photo', label: 'Photos', count: photos.length - videos },
        { id: 'video', label: 'Videos', count: videos },
      ],
    });
  }
  return sections;
}

/** The photos that pass `value` (choices the sections no longer offer are ignored). */
export function applyAlbumFilter<T extends Filterable>(photos: readonly T[], sections: readonly UiFilterSection[], value: UiFilterValue): T[] {
  const v = uiFilterPrune(sections, value);
  const who = v[ALBUM_WHO];
  const kind = v[ALBUM_KIND];
  const where = v[ALBUM_WHERE];
  const people = v[ALBUM_PEOPLE];
  if (!who && !kind && !where && !people) return [...photos];
  return photos.filter(
    (p) =>
      (!where || (!!p.albumTitle && where.includes(p.albumTitle))) &&
      (!who || (!!p.uploaderName && who.includes(p.uploaderName))) &&
      (!people || (p.people ?? []).some((id) => people.includes(id))) &&
      (!kind || kind.includes(isVideoType(p.contentType) ? 'video' : 'photo')),
  );
}

/** What's filtered, in words: "Aisha, Ali and Videos". */
export function describeAlbumFilter(sections: readonly UiFilterSection[], value: UiFilterValue): string {
  const labels = uiActiveFilters(sections, value).map((a) => a.label);
  return labels.length < 2 ? (labels[0] ?? '') : `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}
