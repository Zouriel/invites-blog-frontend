/**
 * The still that stands in for a clip in a grid.
 *
 * <p>Drawn here for the same reason the camera page draws its own: pulling a frame out of an encoded
 * video needs a decoder the API does not have, and the browser is the only place holding a decoded
 * frame at all. `EventPhotoService` refuses a video that arrives without one, so this is not a nicety
 * — it is half of what makes a picked clip uploadable.</p>
 *
 * <p>Deliberately the same shape as `camera.js`'s `posterFrame()`: longest edge 1280, JPEG at 0.82.
 * It is only ever shown as a tile, and the two paths should not produce visibly different stills for
 * the same clip.</p>
 */
const POSTER_EDGE = 1280;
const POSTER_QUALITY = 0.82;

/**
 * Where in the clip to draw from. Not frame zero: a video very often opens on a black or half-exposed
 * frame, which makes a grid of clips look broken. A moment in beats the first thing the encoder wrote.
 */
const SEEK_SECONDS = 0.5;

/**
 * Gives up rather than hanging. A file the browser cannot decode never fires `loadeddata`, and a
 * picker that spins forever is worse than one that says it could not read the clip.
 */
const DECODE_TIMEOUT_MS = 15_000;

/**
 * Draws a still from `file`, or resolves null when the browser cannot decode it.
 *
 * <p>Null is a real answer, not a failure to handle: an exotic container the picker allowed but this
 * browser has no decoder for is exactly the case, and the caller turns it into "we couldn't read that
 * clip" rather than a rejected upload with no explanation.</p>
 */
export function posterFrameFor(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');

    let settled = false;
    const finish = (poster: Blob | null): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Both matter: the object URL pins the whole file in memory until it is revoked, and a video
      // element left with a src keeps decoding against it.
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(poster);
    };

    const timer = setTimeout(() => finish(null), DECODE_TIMEOUT_MS);

    const draw = (): void => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return finish(null);

      const factor = Math.min(1, POSTER_EDGE / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * factor));
      canvas.height = Math.max(1, Math.round(h * factor));

      const ctx = canvas.getContext('2d');
      if (!ctx) return finish(null);

      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch {
        // A frame the canvas refuses to take (a tainted or undecodable source) is the same answer
        // as one we could never reach.
        return finish(null);
      }
      canvas.toBlob((blob) => finish(blob), 'image/jpeg', POSTER_QUALITY);
    };

    video.addEventListener('error', () => finish(null));
    video.addEventListener('seeked', draw, { once: true });
    video.addEventListener(
      'loadeddata',
      () => {
        // A clip shorter than the seek point still has to produce something, so clamp into it rather
        // than seeking past the end — where some browsers simply never fire `seeked`.
        const target = Math.min(SEEK_SECONDS, Math.max(0, (video.duration || 0) / 2));
        if (!Number.isFinite(target) || target <= 0) return draw();
        video.currentTime = target;
      },
      { once: true },
    );

    // Muted and inline: iOS refuses to load a video element that could make noise without a gesture,
    // and this one is never shown at all.
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
  });
}
