/**
 * Contain a JS failure inside ONE feature so the rest of the app survives it.
 *
 * The app already exports `ErrorBoundary` from `_layout.tsx`, and that is the app's only error
 * containment — but it is deliberately whole-app: it unmounts the React root, so a throw anywhere
 * costs the user their screen AND their whole back stack (`Try.retry()` clears the boundary, and
 * `useNavigationBuilder`'s unmount cleanup has already erased the navigation state, so it lands back
 * on Home). That is the right behaviour for a route that broke. It is the WRONG behaviour for an
 * optional overlay that nobody asked for right now.
 *
 * So an optional feature gets one of these instead: if it throws, it simply STOPS EXISTING — the
 * button disappears, the app carries on, and the user loses a feature rather than their work. That
 * is the trade this app should always take: the app is the product, voice is a feature of it.
 *
 * ⚠️ WHAT IT CANNOT DO, because the difference matters and cost us a build: this catches JS only.
 * A native module that aborts the process (Skia, a blur backend, any `.so`) kills the app before any
 * JavaScript runs, and no boundary anywhere can intercept that — which is exactly why the decorative
 * native renderers are switched off in `lib/voiceGraphics.ts` rather than merely wrapped. Wrapping is
 * for OUR bugs; the switch is for theirs.
 *
 * `onFail` is a reporting hook, not a recovery one — there is no retry, on purpose. A feature that
 * threw once during render will almost always throw again on the next render, and a boundary that
 * re-mounts it produces a flicker loop instead of a working app.
 */
import React from 'react';

type Props = {
  children: React.ReactNode;
  /** Optional: what to show instead. Defaults to nothing at all, which is usually right. */
  fallback?: React.ReactNode;
  /** Called once, with the thrown value, so a caller can log or report it. Must not throw. */
  onFail?: (error: unknown) => void;
};

export class FeatureBoundary extends React.Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    try {
      this.props.onFail?.(error);
    } catch {
      /* a reporter that throws must not take down the boundary that called it */
    }
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null;
    return this.props.children;
  }
}
