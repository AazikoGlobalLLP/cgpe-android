import { Platform } from 'react-native';

/**
 * PUT a local file's raw bytes at a URL — the transport half of the presigned upload flow
 * (`cgpe-api` Phase 95 / D-122; adopted app-side in Phase 86).
 *
 * WHY THIS IS ITS OWN MODULE AND NOT FOUR LINES INSIDE `data/api.ts`. Two reasons, both
 * documented traps:
 *
 *  1. **The native trap.** `fetch` cannot stream a `file://` URI as a raw request body on React
 *     Native — that shape is FormData-only — so the binary PUT has to go through
 *     `expo-file-system`'s BINARY_CONTENT upload task. That module is native, and `data/api.ts`
 *     is reached by every route AND by the Vitest graph, so it must never import it at module
 *     scope (CLAUDE.md, "Native modules: TWO different traps"). It is `require`d lazily below,
 *     inside the try, so an absent module fails into the catch instead of throwing while a
 *     module is being evaluated.
 *  2. **The testability trap, which cost a detour.** A lazy `require()` resolves through NODE,
 *     not through Vite — so neither a `vitest.config.mts` alias nor a `vi.mock()` factory can
 *     intercept it, and the whole presigned path was reachable in tests only as a caught throw.
 *     Behind this seam the callers import ONE ordinary module, which `vi.mock('@/lib/binaryUpload')`
 *     replaces cleanly. That is what lets the contract's sharpest trap — the `Content-Type` is
 *     SIGNED, so any other value 403s at MinIO, silently, in the field — be pinned by a test.
 *
 * This module deliberately does NO classification. It reports what happened; the meaning of a
 * status lives with the rest of the upload reasoning in `lib/fileUpload.ts`.
 */

/** What a binary PUT did. `response` means the server answered — whatever the status. */
export type BinaryPutOutcome =
  | { kind: 'response'; status: number }
  | { kind: 'timeout' }
  | { kind: 'network' };

export type BinaryPutInput = {
  /** The signed URL. Carries its own credentials in the query string. */
  url: string;
  /** A local `file://` (native) or blob/http (web) URI. */
  fileUri: string;
  /**
   * Sent as the `Content-Type` header VERBATIM. On a presigned PUT this string is part of what
   * was signed, so the caller must pass the server's own value — never a re-derived MIME.
   */
  contentType: string;
  timeoutMs: number;
};

/**
 * No Authorization header is sent, on either platform, and that is deliberate: the signature in
 * the URL is the authorisation. Sending a Bearer token as well is at best noise and at worst a
 * credential handed to a storage host that has no business seeing it.
 */
export async function putBinary(input: BinaryPutInput): Promise<BinaryPutOutcome> {
  const { url, fileUri, contentType, timeoutMs } = input;

  if (Platform.OS === 'web') {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
    try {
      const blob = await (await fetch(fileUri)).blob();
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: blob,
        signal: controller.signal,
      });
      return { kind: 'response', status: res.status };
    } catch {
      return timedOut ? { kind: 'timeout' } : { kind: 'network' };
    } finally { clearTimeout(timer); }
  }

  try {
    // `createUploadTask`, not the simpler `uploadAsync`, because only the task can be CANCELLED
    // — which is what gives this path the same ceiling the multipart upload gets from its
    // AbortController. Without it a stalled PUT would hang the screen with no way out.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy so an absent module fails into the catch
    const FS = require('expo-file-system/legacy') as {
      FileSystemUploadType: { BINARY_CONTENT: number };
      createUploadTask: (url: string, fileUri: string, opts: Record<string, unknown>) => {
        uploadAsync: () => Promise<{ status: number } | undefined | null>;
        cancelAsync: () => Promise<void>;
      };
    };
    const task = FS.createUploadTask(url, fileUri, {
      httpMethod: 'PUT',
      uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': contentType },
    });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; void task.cancelAsync().catch(() => {}); }, timeoutMs);
    try {
      const res = await task.uploadAsync();
      // A cancelled task RESOLVES undefined/null rather than throwing.
      if (!res) return timedOut ? { kind: 'timeout' } : { kind: 'network' };
      return { kind: 'response', status: res.status };
    } finally { clearTimeout(timer); }
  } catch {
    // A throw out of the native task carries no status, so the honest coarse answer is that the
    // bytes did not demonstrably arrive.
    return { kind: 'network' };
  }
}
