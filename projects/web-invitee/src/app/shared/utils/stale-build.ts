import { NavigationError } from '@angular/router';

/**
 * Recovers a tab that's still running a build we've since replaced.
 *
 * Route components are lazy-loaded from content-hashed chunks. A deploy changes those hashes and
 * deletes the old files, so a tab opened beforehand asks for a chunk that now 404s. Angular rejects
 * the dynamic import, the router aborts the navigation, and — because nothing throws visibly — the
 * click looks like it simply did nothing. Reloading picks up the new shell, and since index.html is
 * served no-cache the very next request is already the current build.
 *
 * The reload is guarded by a session flag so a genuinely broken chunk can't put the tab in a loop:
 * we retry once, and after that let the navigation fail normally.
 */
const RELOAD_MARKER = 'ib_stale_build_reloaded';

/** A failed dynamic import, across the wordings different browsers use. */
function isChunkLoadFailure(error: unknown): boolean {
  const message =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? '');

  return (
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [^\s]+ failed/i.test(message) ||
    // Chrome / Safari / Firefox phrasings for a module that couldn't be fetched.
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  );
}

export function handleStaleBuildNavigationError(event: NavigationError): void {
  if (!isChunkLoadFailure(event.error)) {
    return;
  }

  try {
    if (sessionStorage.getItem(RELOAD_MARKER)) {
      return; // already tried; don't loop
    }
    sessionStorage.setItem(RELOAD_MARKER, '1');
  } catch {
    // Storage unavailable (private mode): reloading once is still better than a dead click, and
    // without the marker the worst case is one extra reload.
  }

  // Reload straight into where the user was trying to go.
  location.assign(event.url);
}

/** Clears the guard once a navigation succeeds, so a later deploy can recover the same tab again. */
export function clearStaleBuildMarker(): void {
  try {
    sessionStorage.removeItem(RELOAD_MARKER);
  } catch {
    /* ignore */
  }
}
