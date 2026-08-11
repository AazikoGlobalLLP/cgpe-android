// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // src/ui/vendor/* is generated, verbatim third-party source (see scripts/vendor-leaflet.mjs).
    // e2e/** is the Phase 18 Playwright harness — Node/browser test code that lives outside the
    // app and is intentionally invisible to the app's gates (already excluded from tsconfig and
    // never bundled by EAS); linting it against this RN/React-Compiler config would only produce
    // spurious errors. It has its own tsconfig; Playwright type-checks it.
    ignores: ["dist/*", "src/ui/vendor/*", "e2e/**"],
  },
  {
    // React Compiler lint rules (eslint-plugin-react-hooks v7), which eslint-config-expo
    // promotes to ERRORS now that app.json sets experiments.reactCompiler:true. These three
    // fire 44 times across the working, shipped app on patterns that are correct for this
    // codebase, not bugs. Phase 15 (docs/PHASES.md, docs/HANDOFF.md) explicitly chose to
    // disable-with-a-reason rather than rewrite working animations and the app's data-fetch
    // convention — the compiler bails out of optimising a flagged component rather than
    // miscompiling it, so the code is safe as written and only the lint gate is affected.
    //
    //   • react-hooks/immutability (9)      — Reanimated shared-value writes (`sv.value = …`)
    //     inside gesture worklets / press handlers in ui/{motion,sheet,swipe}.tsx. This is
    //     Reanimated's documented API; the writes run in worklets/handlers, never during
    //     render, but the rule cannot prove that.
    //   • react-hooks/refs (11)             — the RN Animated idiom
    //     `useRef(new Animated.Value()).current` (ui/Splash.tsx) and the "latest value" ref
    //     pattern (ui/controls.tsx), both standard.
    //   • react-hooks/set-state-in-effect (24) — the app's single data-loading convention
    //     (CLAUDE.md §Conventions 3): an effect calls a memoised loader that setStates the
    //     result. Reworking 20+ screens (incl. the 1915-line home.tsx), which have zero test
    //     coverage, is out of scope for a lint-only phase.
    //
    // react-hooks/purity is deliberately NOT disabled — its one hit (a Date.now() call during
    // render, home.tsx) was a genuine minor impurity and is fixed at its source instead.
    rules: {
      "react-hooks/immutability": "off",
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);
