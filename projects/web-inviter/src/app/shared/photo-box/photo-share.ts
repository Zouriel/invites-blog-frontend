import { EventPhoto } from '../utils/types/api.types';
import { formatBytes } from '../utils/plans';

/**
 * Sharing album photos through the phone's own share sheet (Web Share with files), the website's
 * twin of the app's MediaJobs.share: the same caps and the same wording.
 */

/** The most a share sheet is handed at once (WhatsApp itself takes 30). Same as the app. */
export const SHARE_MAX_FILES = 100;
/** Every file is downloaded into the tab first, so the total is capped too. Same as the app. */
export const SHARE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
/** Originals fetched at once. */
const WORKERS = 3;

type ShareNavigator = Pick<Navigator, 'share' | 'canShare'> & { userActivation?: { isActive: boolean } };

/**
 * Whether this browser can hand FILES to a share sheet: Chrome on Android, Safari on iPhone and Mac,
 * Chrome and Edge on Windows and ChromeOS. Not Firefox, nor Chrome on Linux. Where it can't, Share is
 * not offered at all (Download is), rather than a button that does nothing.
 */
export function canShareFiles(nav: Partial<ShareNavigator> | undefined = globalThis.navigator): boolean {
  if (!nav || typeof nav.share !== 'function' || typeof nav.canShare !== 'function') return false;
  try {
    return nav.canShare({ files: [new File([new Uint8Array(1)], 'photo.jpg', { type: 'image/jpeg' })] });
  } catch {
    return false;
  }
}

/** Whether a click is still "fresh" enough for navigator.share. Unknown (older Safari) reads as no. */
export function stillActive(nav: Partial<ShareNavigator> | undefined = globalThis.navigator): boolean {
  return nav?.userActivation?.isActive === true;
}

/** Why these can't be shared in one go, or null when they can. */
export function shareRefusal(photos: readonly EventPhoto[]): string | null {
  if (photos.length > SHARE_MAX_FILES) {
    return `You can share up to ${SHARE_MAX_FILES} at a time, and ${photos.length} are selected. Download works for any number.`;
  }
  const bytes = photos.reduce((sum, p) => sum + (p.sizeBytes ?? 0), 0);
  if (bytes > SHARE_MAX_BYTES) {
    return `These come to ${formatBytes(bytes)}, more than the ${formatBytes(SHARE_MAX_BYTES)} a share can carry. Pick fewer, or download them.`;
  }
  return null;
}

/** The file's extension, from the stored URL (the album keeps whatever format was uploaded). */
export function extensionOf(photo: EventPhoto): string {
  let path = photo.originalUrl;
  try {
    path = new URL(photo.originalUrl, 'https://x').pathname;
  } catch {
    /* keep the raw string */
  }
  const dot = path.lastIndexOf('.');
  const ext = dot < 0 ? '' : path.slice(dot).toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(ext)) return ext;
  return (photo.contentType ?? '').startsWith('video/') ? '.mp4' : '.jpg';
}

/** What a shared or saved file is called: recognisable in a gallery, never two the same. Same as the app. */
export function fileNameFor(photo: EventPhoto, n?: number): string {
  const id = photo.id.replace(/-/g, '');
  const short = id.length > 8 ? id.slice(0, 8) : id;
  return n == null ? `invitesblog-${short}${extensionOf(photo)}` : `invitesblog-${n}-${short}${extensionOf(photo)}`;
}

function mimeOf(photo: EventPhoto, fromResponse: string | null): string {
  if (photo.contentType) return photo.contentType;
  if (fromResponse && !fromResponse.startsWith('application/')) return fromResponse.split(';')[0];
  return extensionOf(photo) === '.mp4' ? 'video/mp4' : 'image/jpeg';
}

/**
 * Downloads each original into the tab as a File, {@link WORKERS} at a time, in the album's order.
 * `onDone` hears each one finish. Throws an AbortError when `signal` aborts, and an Error with a
 * plain message when a file can't be fetched.
 */
export async function fetchOriginals(
  photos: readonly EventPhoto[],
  signal: AbortSignal,
  onDone: (done: number) => void,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<File[]> {
  const files: File[] = new Array(photos.length);
  const many = photos.length > 1;
  let next = 0;
  let done = 0;
  const worker = async (): Promise<void> => {
    while (next < photos.length) {
      signal.throwIfAborted();
      const at = next++;
      const photo = photos[at];
      let response: Response;
      try {
        response = await fetchImpl(photo.originalUrl, { signal, credentials: 'same-origin' });
      } catch (e) {
        if (signal.aborted) throw signal.reason ?? e;
        throw new Error('The connection dropped. Try again.');
      }
      if (!response.ok) throw new Error('One of these could not be fetched. Try again.');
      const blob = await response.blob();
      files[at] = new File([blob], fileNameFor(photo, many ? at + 1 : undefined), {
        type: mimeOf(photo, response.headers.get('content-type')),
      });
      onDone(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, photos.length) }, worker));
  signal.throwIfAborted();
  return files;
}

/** The outcome of handing files to the share sheet. */
export type ShareOutcome = 'shared' | 'dismissed' | 'needs-tap' | 'unsupported' | 'failed';

/**
 * Opens the share sheet with these files. Must run inside a click handler (or right after one):
 * 'needs-tap' means the browser no longer counted the page as clicked, so ask for one more tap.
 */
export async function shareFiles(
  files: File[],
  nav: Partial<ShareNavigator> | undefined = globalThis.navigator,
): Promise<ShareOutcome> {
  if (!nav?.share || !nav.canShare?.({ files })) return 'unsupported';
  try {
    await nav.share({ files });
    return 'shared';
  } catch (e) {
    const name = (e as { name?: string })?.name;
    if (name === 'AbortError') return 'dismissed';
    if (name === 'NotAllowedError') return 'needs-tap';
    return 'failed';
  }
}
