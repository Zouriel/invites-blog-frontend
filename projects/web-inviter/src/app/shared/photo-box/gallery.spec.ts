import { describe, expect, it } from 'vitest';
import { albumFilterSections, applyAlbumFilter, contributorsOf, describeAlbumFilter, tileHeightRatio } from './gallery';

describe('photo gallery', () => {
  it('keeps each shape, crops only the extremes, and copes with an unknown size', () => {
    expect(tileHeightRatio(300, 400)).toBeCloseTo(4 / 3);
    expect(tileHeightRatio(1000, 100)).toBe(0.66);
    expect(tileHeightRatio(100, 1000)).toBe(1.5);
    expect(tileHeightRatio(0, 0)).toBe(1);
  });

  it('lists contributors, most photos first, leaving out the unnamed', () => {
    expect(contributorsOf(['A', 'B', null, 'B', undefined, ''])).toEqual([
      { name: 'B', count: 2 },
      { name: 'A', count: 1 },
    ]);
  });

  const photo = (who: string | null, video = false) => ({ uploaderName: who, contentType: video ? 'video/mp4' : 'image/jpeg' });
  const album = [photo('Aisha'), photo('Aisha', true), photo('Ali'), photo(null), photo('Ali', true), photo('Aisha')];

  it('offers Uploaded by and Photos or videos only when there is a choice', () => {
    const sections = albumFilterSections(album);
    expect(sections.map((s) => s.id)).toEqual(['who', 'kind']);
    expect(sections[0].options).toEqual([{ id: 'Aisha', label: 'Aisha', count: 3 }, { id: 'Ali', label: 'Ali', count: 2 }]);
    expect(sections[0].multiple).toBe(true);
    expect(sections[1].options.map((o) => o.count)).toEqual([4, 2]);
    // One person, all photos: nothing to choose.
    expect(albumFilterSections([photo('Aisha'), photo('Aisha')])).toEqual([]);
    // One person and some with no name: worth offering.
    expect(albumFilterSections([photo('Aisha'), photo(null)]).map((s) => s.id)).toEqual(['who']);
  });

  it('filters by several people and by kind together, and ignores stale choices', () => {
    const sections = albumFilterSections(album);
    expect(applyAlbumFilter(album, sections, { who: ['Ali'] })).toHaveLength(2);
    expect(applyAlbumFilter(album, sections, { who: ['Ali', 'Aisha'] })).toHaveLength(5);
    expect(applyAlbumFilter(album, sections, { who: ['Aisha'], kind: ['video'] })).toEqual([album[1]]);
    expect(applyAlbumFilter(album, sections, { who: ['Gone'] })).toHaveLength(album.length);
    expect(describeAlbumFilter(sections, { who: ['Aisha', 'Ali'], kind: ['video'] })).toBe('Aisha, Ali and Videos');
  });

  describe('people (faces)', () => {
    const shot = (people: string[] | null) => ({ uploaderName: 'A', contentType: 'image/jpeg', people });
    const faces = [{ id: 'f1', name: 'Mia' }, { id: 'f2', name: null }, { id: 'f3', name: '  ' }];
    const shots = [shot(['f1']), shot(['f1', 'f2']), shot(['f2']), shot([]), shot(null)];

    it('adds a People section with names, "Person N" for unnamed ones, and counts', () => {
      const people = albumFilterSections(shots, faces).find((s) => s.id === 'people')!;
      expect(people.title).toBe('People');
      expect(people.multiple).toBe(true);
      // f3 has no photos, so it isn't offered; f2 is the second group, so it is "Person 2".
      expect(people.options).toEqual([{ id: 'f1', label: 'Mia', count: 2 }, { id: 'f2', label: 'Person 2', count: 2 }]);
    });

    it('has no People section without faces', () => {
      expect(albumFilterSections(shots).some((s) => s.id === 'people')).toBe(false);
      expect(albumFilterSections(shots, []).some((s) => s.id === 'people')).toBe(false);
    });

    it('keeps photos with any chosen person, and combines with other filters', () => {
      const sections = albumFilterSections(shots, faces);
      expect(applyAlbumFilter(shots, sections, { people: ['f1'] })).toEqual([shots[0], shots[1]]);
      expect(applyAlbumFilter(shots, sections, { people: ['f1', 'f2'] })).toEqual([shots[0], shots[1], shots[2]]);
      expect(applyAlbumFilter(shots, sections, { people: ['f1'], who: ['Nobody'] })).toHaveLength(2);
      expect(applyAlbumFilter(shots, sections, { people: ['gone'] })).toHaveLength(shots.length);
    });

    it('says which people are chosen', () => {
      const sections = albumFilterSections(shots, faces);
      expect(describeAlbumFilter(sections, { people: ['f1', 'f2'] })).toBe('Mia and Person 2');
    });
  });
});
