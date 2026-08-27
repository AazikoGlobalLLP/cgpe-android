/* ------------------------------------------------------------------ *
 * crashReport — turning a thrown Error into something a field advisor can act on.
 *
 * WHY THIS EXISTS. Until now this app had NO React error boundary anywhere. Verified against
 * the installed expo-router build (2026-08-27): `useScreens.js:141` `fromImport` wraps a route
 * in `Try` ONLY when that route file exports `ErrorBoundary`, and no file in `src/` did. So a
 * render-time throw anywhere below the root layout unmounted the whole React root — and in a
 * release build there is no LogBox to show what happened. The user gets a dead app with nothing
 * on it, and we get a bug report that says "it went blank", which is unactionable. That is
 * exactly the shape of the long-running "More → Today blank screen" report, and whether or not
 * it turns out to be the cause, being unable to TELL is its own defect.
 *
 * This module is the pure half: given whatever was thrown, decide what to put on screen. It is
 * separate from the component so it can be tested — a boundary that is only exercised by a real
 * crash is a boundary nobody has ever seen work.
 *
 * TWO RULES SHAPE THE COPY.
 *   1. Never claim to know the cause. We know a screen failed to draw. We do not know why, and
 *      guessing ("check your connection") sends the user somewhere useless.
 *   2. Always carry the technical detail, and never ONLY the technical detail. The advisor
 *      needs a next step; whoever fixes it needs the error text. Both, in that order.
 * ------------------------------------------------------------------ */

/** What the boundary renders. `detail` is there to be screenshotted and reported, not to reassure. */
export type CrashReport = {
  /** Plain heading. Says what happened, not why. */
  title: string;
  /** What to do next, in the order a person should try it. */
  message: string;
  /**
   * The button label. It is NOT "try this screen again", and the difference is the whole reason
   * this field exists rather than a literal in the component.
   *
   * `Try.retry()` only does `setState({ error: undefined })`
   * (`expo-router/build/views/Try.js:54-60`), and the boundary is armed on the ROOT layout — so what
   * re-mounts is the entire app, not the screen that failed. Worse, when the boundary caught, the
   * root `Stack` unmounted and `useNavigationBuilder`'s cleanup erased the stored navigation state
   * (`react-navigation/core/useNavigationBuilder.js:496-502`), so the fresh Stack falls back to its
   * initial route: `app/index.tsx`, which redirects to Home or to the login screen. The crashed
   * screen and the whole back stack are gone.
   *
   * The first draft of this file labelled the button "Try this screen again", which promised
   * something the code does not do — an adversarial review caught it before it shipped. Do not
   * reword this back into a promise about the failed screen.
   */
  retryLabel: string;
  /**
   * The error's own words, trimmed for the screen. Empty string when nothing was thrown that
   * carries a message — in which case the UI must show no detail block at all rather than an
   * empty box, because an empty box reads like a bug in the error screen itself.
   */
  detail: string;
};

/** Longest detail we will draw. Past this a phone screen just shows a wall of grey. */
export const MAX_CRASH_DETAIL = 300;

/**
 * Pull a readable one-liner out of anything a `throw` can produce.
 *
 * `Try`'s prop is typed `Error`, but React hands the boundary whatever was thrown, and code
 * throws strings, objects and `undefined` in the wild — so this must not assume `.message`
 * exists. Returns '' when there is genuinely nothing to say.
 */
export function crashDetail(error: unknown): string {
  const raw =
    typeof error === 'string' ? error
      : error instanceof Error ? `${error.name}: ${error.message}`
        : typeof (error as any)?.message === 'string' ? String((error as any).message)
          : '';
  // Collapse newlines: a stack fragment pasted into the message turns the card into a page.
  const flat = raw.replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  return flat.length > MAX_CRASH_DETAIL ? `${flat.slice(0, MAX_CRASH_DETAIL - 1)}…` : flat;
}

/**
 * The full screen contents for a crash.
 *
 * The copy says what the button DOES and what it COSTS, in that order, and makes no claim about
 * anything being safe. The earlier draft opened with "Nothing you entered has been lost from the
 * server" — technically defensible, because unsaved work was never on the server, but a field
 * advisor reads it as "nothing was lost" and it is immediately followed by an instruction that
 * throws unsaved work away. In this project a comforting non-answer is a defect, so it is gone.
 */
export function describeCrash(error: unknown): CrashReport {
  return {
    title: 'This screen stopped working',
    message:
      'Reloading starts the app again from the beginning, so anything you had typed on this '
      + 'screen and not yet saved will be lost. Work already saved is not affected. If this keeps '
      + 'happening, tell your branch admin what you were doing when it went wrong.',
    retryLabel: 'Reload the app',
    detail: crashDetail(error),
  };
}
