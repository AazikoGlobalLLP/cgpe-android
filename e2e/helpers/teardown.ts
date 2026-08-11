import fs from 'node:fs';
import path from 'node:path';

/**
 * Runs once after the whole suite (playwright.config `globalTeardown`). It makes the artifact
 * folder self-explanatory so the user can open ONE folder and find everything (spec §6): it drops
 * an index that points at the video, the trace, the HTML report and the per-screen stills, and
 * copies the "what web cannot reach" note in beside them.
 */
export default function globalTeardown(): void {
  const artifacts = path.resolve(__dirname, '..', 'artifacts');
  try {
    fs.mkdirSync(artifacts, { recursive: true });

    const webLimits = path.resolve(__dirname, '..', 'WEB-LIMITS.md');
    if (fs.existsSync(webLimits)) {
      fs.copyFileSync(webLimits, path.join(artifacts, 'WHAT-WEB-CANNOT-REACH.md'));
    }

    const index = `# CGPE Connect — E2E run artifacts

Open these:

- **report/index.html** — the pass/fail report (per screen, per worst-case state). Or run
  \`npm run e2e:report\`.
- **screens/** — one screenshot per screen per checked state:
    - \`normal/*\`  — the A-to-Z normal-state walk (healthy backend)
    - \`worst/*\`   — each screen under an injected fault (500 / 503 / malformed / empty / timeout / oversized)
    - \`forms/*\`   — login bad-input + hostile-input on search / task-new / claim-new
    - \`languages/<code>/*\` — every screen in each of the 5 languages (en, gu, hi, hi-en, gu-en),
      for the Phase 19 naturalness (Hinglish/Gujlish read right?) + layout review. Compare the same
      screen across folders side by side. \`languages/_toggle/*\` are the before/after-reload stills
      that prove the toggle applied and persisted.
- **test-results/**/video.webm** — the full film of each spec (watch the walk back).
- **test-results/**/trace.zip** — Playwright trace; open with \`npx playwright show-trace <file>\`.
- **WHAT-WEB-CANNOT-REACH.md** — the native-only surfaces this web run does NOT verify. A green
  run is not "the whole app is verified"; those rows still need a handset.

Nothing here touched a real backend: every response was synthetic (Playwright network mocking),
so no production data was read or written.
`;
    fs.writeFileSync(path.join(artifacts, 'OPEN-ME.md'), index, 'utf8');
  } catch {
    // Teardown must never fail the run.
  }
}
