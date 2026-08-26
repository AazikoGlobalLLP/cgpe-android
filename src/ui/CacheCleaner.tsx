import React, { useCallback, useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { Image } from 'expo-image';
import { Directory, Paths } from 'expo-file-system';
import { WebView } from 'react-native-webview';
import type { CacheClearResult } from '@/lib/appCache';

/**
 * The two directories the pickers copy into. `expo-document-picker` writes to
 * `<cache>/DocumentPicker` (`DocumentPickerModule.copyDocumentToCacheDirectory` →
 * `generateOutputPath(context.cacheDir, "DocumentPicker", …)`) and `expo-image-picker` to
 * `<cache>/ImagePicker` (`ImagePickerConstants.CACHE_DIR_NAME`). Nothing else in this app writes
 * to the cache directory, so these two names are the whole of the picked-file leak.
 */
const PICKER_CACHE_DIRS = ['DocumentPicker', 'ImagePicker'];

/**
 * CacheCleaner — the two native calls that actually free disk, and the one awkward fact that
 * shapes this whole file.
 *
 * PHASE 77. `react-native-webview` exposes `clearCache(includeDiskFiles)` as an INSTANCE method
 * on a WebView ref (`useImperativeHandle` in `WebView.android.js`; typed in the package's
 * `index.d.ts`). There is no static or module-level equivalent — `NativeRNCWebViewModule` carries
 * only `isFileUploadSupported`. So clearing the map-tile cache requires a live WebView, and the
 * Settings screen does not have one.
 *
 * The saving grace is in the library's own doc comment: "the cache is per-application, so this
 * will clear the cache for all WebViews used." ANY instance clears everything. So this component
 * mounts a throwaway one, uses it, and gets out of the way.
 *
 * IT IS MOUNTED ONLY WHILE CLEARING, deliberately. Rendering a permanent hidden WebView on
 * Settings would spin up Android's WebView engine — tens of megabytes of RAM — every time anyone
 * opened the screen, to serve a button most people press once. Render this component when the
 * user asks to clear and unmount it when `onDone` fires.
 *
 * ON WEB there is no WebView to clear and nothing on disk to reclaim, so the tile leg is skipped
 * and reported honestly as not-cleared rather than silently counted as success. (The E2E harness
 * walks this screen in a browser, so this path is exercised.)
 */
export function CacheCleaner({ onDone }: { onDone: (r: CacheClearResult) => void }) {
  const webRef = useRef<WebView>(null);
  /** The clear must happen exactly once per mount, whatever the WebView's load events do. */
  const fired = useRef(false);

  const run = useCallback(async () => {
    if (fired.current) return;
    fired.current = true;

    let tiles = false;
    try {
      if (Platform.OS !== 'web' && webRef.current) {
        // `true` = include the on-disk files, which is the whole point: the in-memory half is
        // gone when the process dies anyway, and the tiles are what grow.
        webRef.current.clearCache(true);
        tiles = true;
      }
    } catch {
      // A WebView that never attached cannot clear; reported as a failure, never as a success.
    }

    let images = false;
    try {
      images = await Image.clearDiskCache();
    } catch {
      // expo-image resolves false rather than throwing on a miss, but a missing native module
      // on an unexpected platform would throw — treat it the same as a refusal.
    }

    /*
     * The picked-file copies, and the reason this control is worth shipping to everyone rather
     * than just to the handful of people who can open a map. `Directory.delete()` removes the
     * directory and everything in it, and THROWS when the directory is not there — which is the
     * normal case for someone who has never attached a document, so an absent directory counts as
     * nothing-to-do rather than as a failure. Only a real delete that failed marks the leg false.
     *
     * Safe to do here: no file upload is ever persisted to the offline write queue (`QueueKind` is
     * `'note' | 'task' | 'lead'`), so there is no queued job holding a URI into these directories.
     */
    let temp = true;
    if (Platform.OS !== 'web') {
      for (const name of PICKER_CACHE_DIRS) {
        try {
          const dir = new Directory(Paths.cache, name);
          if (dir.exists) dir.delete();
        } catch {
          temp = false;
        }
      }
    } else {
      temp = false; // nothing of the kind exists in a browser
    }

    onDone({ tiles, images, temp });
  }, [onDone]);

  useEffect(() => {
    // Web has no WebView leg to wait for, so there is no load event coming — go straight to the
    // image cache. Native waits for `onLoadEnd` below so the ref is attached before it is used.
    if (Platform.OS === 'web') void run();
  }, [run]);

  if (Platform.OS === 'web') return null;

  return (
    // Off-screen rather than zero-sized: a 0×0 WebView is not reliably attached on Android, and
    // an attached view is the entire reason this exists. It is 1×1, transparent and untouchable.
    <View
      style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -1, top: -1 }}
      pointerEvents="none"
    >
      <WebView
        ref={webRef}
        source={{ html: '<html><body></body></html>' }}
        style={{ width: 1, height: 1, backgroundColor: 'transparent' }}
        javaScriptEnabled={false}
        onLoadEnd={() => { void run(); }}
        // A blank page cannot fail in a way worth reporting, but it must not hang the caller:
        // clear what we can and let the honest partial result come back.
        onError={() => { void run(); }}
      />
    </View>
  );
}

export default CacheCleaner;
