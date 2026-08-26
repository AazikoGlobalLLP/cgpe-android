/**
 * appCache — the honest wording for "Clear cached data".
 *
 * PHASE 77. The owner reported the app installing at 63 MB and reaching 125 MB after use, and
 * asked for a way to get the space back. The pure part of that lives here so it can be tested;
 * the native calls that actually free disk live in `ui/CacheCleaner.tsx`.
 *
 * THE THREE THINGS THAT GROW, AND WHO THEY AFFECT — this ordering matters, because the obvious
 * suspect is the one that helps fewest people:
 *
 *   · PICKED-FILE COPIES — every user. `ui/DocumentSource.tsx` passes `copyToCacheDirectory: true`,
 *     so expo-document-picker copies each chosen file into `<cache>/DocumentPicker` and
 *     expo-image-picker into `<cache>/ImagePicker`. Nothing in this app has ever deleted them, and
 *     `lib/fileUpload.ts` allows 10 MB per file. THIS is the fleet-wide leak.
 *   · MAP TILES — master/admin only. The Leaflet WebView caches CartoDB and Esri satellite tiles
 *     with no size bound, but both `LeafletMap` mounts (agent-map, agent-track) sit behind
 *     `canSeeLiveLocation`, so an ordinary advisor never downloads a single tile.
 *   · THE INSTALL ITSELF — everyone, and NOT recoverable. The APK, its extracted native libraries
 *     and the ART/dex profiles Android builds after install are not caches. No in-app button can
 *     remove them, so the figure in Android's Settings will fall but never back to install-day.
 *
 * WHY THERE IS NO MEGABYTE FIGURE ANYWHERE IN THIS FILE.
 *
 * We cannot measure what was freed, and convention 4 forbids inventing a number to fill the gap.
 * `Image.clearDiskCache()` resolves to a bare boolean, the WebView's `clearCache(true)` returns
 * nothing at all, and `Directory.delete()` reports no size. A toast claiming "48 MB freed" would be
 * exactly the fabrication the HealthBanner convention exists to prevent, so the copy below says
 * what happened and no more. The owner can get the real split in one screenshot from the phone:
 * Settings › Apps › CGPE Connect › Storage shows App size, User data and Cache separately.
 */

/** Which legs of the clear actually succeeded. None of them can report a size. */
export type CacheClearResult = {
  /** The WebView resource cache — the CartoDB and Esri map tiles. Master/admin only in practice. */
  tiles: boolean;
  /** expo-image's disk cache. Small today: only the bundled splash logo uses expo-image. */
  images: boolean;
  /** The picked-file copies in `<cache>/DocumentPicker` and `<cache>/ImagePicker`. Every user. */
  temp: boolean;
};

export type CacheClearMessage = {
  /**
   * An i18n key, NOT a sentence. The screen resolves it through `t()`, which is what keeps this
   * module free of English (and free of any import) while the copy stays translatable — all five
   * languages for these were supplied by the owner on 2026-08-26 and are not machine-translated.
   */
  messageKey: 'storage.doneBody' | 'storage.partialBody' | 'storage.failBody';
  tone: 'success' | 'warning';
};

/** The legs a full clear has to land. Kept as data so the message logic cannot drift from it. */
const LEGS: (keyof CacheClearResult)[] = ['tiles', 'images', 'temp'];

/**
 * Turn a clear attempt into the message the user sees. A partial clear is reported as partial,
 * never rounded up to "done" — the whole value of the control is that its answer can be trusted.
 *
 * Note there is deliberately no "nothing to clear" outcome, even though the supplied copy offered
 * one: `temp` is reported TRUE when the picker directories are simply absent, because having
 * nothing to delete is a success, not a failure. So an all-false result really does mean every leg
 * refused, and it must say so rather than reassuring the user that the phone was already clean.
 */
export function describeCacheClear(r: CacheClearResult): CacheClearMessage {
  const done = LEGS.filter((k) => r[k]).length;
  if (done === LEGS.length) return { tone: 'success', messageKey: 'storage.doneBody' };
  if (done > 0) return { tone: 'warning', messageKey: 'storage.partialBody' };
  return { tone: 'warning', messageKey: 'storage.failBody' };
}
