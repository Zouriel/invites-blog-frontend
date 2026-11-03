import { UiPoster } from '@zouriel/ui/media';

/**
 * A stored poster URL can be a template's own page (index.html), not a picture: that counts as none,
 * so the tile shows the design's colours instead.
 */
export function posterSrc(url: string | null | undefined): string | null {
  return !url || url.endsWith('.html') ? null : url;
}

/** One event as a picture-only tile. The name is only its accessible label; `mark` is the one dot. */
export function eventPoster(title: string, url: string | null | undefined, colours: string[] | null | undefined, mark: UiPoster['mark'] = null): UiPoster {
  return { src: posterSrc(url), label: title, colors: colours ?? undefined, mark };
}
