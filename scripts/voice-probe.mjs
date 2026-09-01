#!/usr/bin/env node
/**
 * Exercise the REAL voice pipeline from this machine, with no phone and no APK.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────
 * Voice is the one feature whose correctness lives mostly OUTSIDE this repo: the n8n brain decides
 * what a spoken sentence means and which screen to open. `npm test` pins our parser against
 * hand-written JSON, which proves we handle the shapes we IMAGINED — not the shapes the brain
 * actually sends. Those are different claims, and only this script can settle the second one.
 *
 * It sends a battery of real transcripts and prints, per command, what came back and whether the app
 * would act on it. Raw responses are saved so they can be pinned as fixtures (see
 * `src/voice/__tests__/brainShapes.test.ts`) — capture reality once, then test against it forever.
 *
 * ── IT NEEDS A CREDENTIAL, AND IT TAKES IT FROM THE ENVIRONMENT ONLY ──────────────────────────
 * Nothing here is hardcoded and nothing is written to disk except responses. Two modes:
 *
 *   BRAIN  — talks to the n8n brain directly (text in, text out; no audio, no STT/TTS cost):
 *     CGPE_VOICE_SECRET=... node scripts/voice-probe.mjs --brain
 *
 *   PROXY  — signs in as a real user and calls the deployed backend the way the app does:
 *     CGPE_EMAIL=... CGPE_PASSWORD=... node scripts/voice-probe.mjs --proxy --audio path/to/clip.m4a
 *     (omit --audio to check `GET /api/voice/status` only — which legs are configured, names only)
 *
 * ⚠️ Never paste a secret into this file, a commit, or a chat. Pass it in the environment, and
 * prefer a throwaway/test account for PROXY mode.
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://cgpe.in/internal/api';
const BRAIN = process.env.CGPE_VOICE_BRAIN_URL || 'https://ai.cgpe.in/webhook/cgpe-voice-brain';
const OUT = path.join('e2e', 'voice-probe');

/**
 * The battery. Mixed English / Hindi / Hinglish, because that is what the staff actually speak, and
 * deliberately including the two cases the owner asked about by name: an ordinary read
 * ("mere aaj ke tasks"), and a MULTI-COMMAND sentence — see the note printed at the end about why
 * the contract can only answer one of the two halves.
 */
const BATTERY = [
  { id: 'tasks-today-hi', text: 'mere aaj ke tasks kya hai', expect: '/(tabs)/tasks' },
  { id: 'tasks-today-en', text: 'show me my tasks for today', expect: '/(tabs)/tasks' },
  { id: 'attendance', text: 'meri attendance dikhao', expect: '/attendance' },
  { id: 'claims', text: 'open my claims', expect: '/(tabs)/claims' },
  { id: 'leads', text: 'leads dikhao', expect: '/(tabs)/leads' },
  { id: 'earnings', text: 'meri earnings kitni hai is mahine', expect: '/earnings' },
  { id: 'calendar', text: 'calendar kholo', expect: '/calendar' },
  { id: 'notifications', text: 'koi nayi notification hai kya', expect: '/notifications' },
  { id: 'clients', text: 'client list dikhao', expect: '/(tabs)/clients' },
  { id: 'reminders', text: 'aaj ke reminders batao', expect: '/reminders' },
  { id: 'nonsense', text: 'asdf qwerty zxcv', expect: 'none — must NOT navigate on a guess' },
  { id: 'multi', text: 'mere aaj ke tasks dikhao aur ek naya task banao kal ke liye', expect: 'ONE action only — see note' },
];

const args = process.argv.slice(2);
const mode = args.includes('--proxy') ? 'proxy' : 'brain';
const audioArg = args.indexOf('--audio');
const audioPath = audioArg >= 0 ? args[audioArg + 1] : null;

function save(name, body) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

/** One row of the report — kept short so a full battery fits on a screen. */
function report(id, text, json, expect) {
  const ok = json?.success ?? json?.ok;
  const act = json?.action || {};
  const reply = String(json?.reply_text ?? '').replace(/\s+/g, ' ').slice(0, 60);
  console.log(
    `  ${id.padEnd(16)} ok=${String(ok).padEnd(5)} action=${String(act.type ?? '-').padEnd(13)} ` +
    `route=${String(act.route ?? '-').padEnd(16)} "${reply}"`,
  );
  if (expect) console.log(`  ${''.padEnd(16)} expected: ${expect}`);
}

async function login() {
  const email = process.env.CGPE_EMAIL;
  const password = process.env.CGPE_PASSWORD;
  if (!email || !password) {
    console.error('PROXY mode needs CGPE_EMAIL and CGPE_PASSWORD in the environment.');
    process.exit(2);
  }
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json().catch(() => null);
  const token = json?.token || json?.data?.token;
  if (!res.ok || !token) {
    console.error(`login failed: HTTP ${res.status} —`, JSON.stringify(json)?.slice(0, 200));
    process.exit(3);
  }
  console.log(`signed in (HTTP ${res.status}), token acquired\n`);
  return token;
}

async function runBrain() {
  const secret = process.env.CGPE_VOICE_SECRET;
  if (!secret) {
    console.error('BRAIN mode needs CGPE_VOICE_SECRET in the environment.');
    console.error('Without it the brain answers {"success":false,"reason":"bad_secret"} to everything.');
    process.exit(2);
  }
  console.log(`BRAIN ${BRAIN}\n`);
  for (const c of BATTERY) {
    try {
      const res = await fetch(BRAIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CGPE-Secret': secret },
        body: JSON.stringify({ transcript: c.text, secret, lang: 'hi-IN', session_id: `probe-${c.id}` }),
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* keep the raw text for the fixture */ }
      save(`brain-${c.id}`, json ?? text);
      report(c.id, c.text, json, c.expect);
    } catch (e) {
      console.log(`  ${c.id.padEnd(16)} THREW: ${e.message}`);
    }
  }
}

async function runProxy() {
  const token = await login();

  const st = await fetch(`${API}/voice/status`, { headers: { Authorization: `Bearer ${token}` } });
  const stJson = await st.json().catch(() => null);
  save('voice-status', stJson ?? {});
  console.log(`GET /voice/status -> HTTP ${st.status}`);
  console.log(JSON.stringify(stJson?.data ?? stJson, null, 2), '\n');

  if (!audioPath) {
    console.log('No --audio given, so the ask leg was not exercised. Pass a clip to run it.');
    return;
  }
  if (!fs.existsSync(audioPath)) {
    console.error(`audio file not found: ${audioPath}`);
    process.exit(4);
  }
  const form = new FormData();
  form.append('audio', new Blob([fs.readFileSync(audioPath)]), path.basename(audioPath));
  form.append('lang', 'hi-IN');
  form.append('session_id', 'probe-session');
  form.append('request_id', `probe-${Date.now()}`);
  form.append('screen', '/(tabs)/home');
  form.append('history', '[]');

  const t0 = Date.now();
  const res = await fetch(`${API}/voice/ask`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  save('proxy-ask', json ?? text);
  console.log(`POST /voice/ask -> HTTP ${res.status} in ${Date.now() - t0} ms`);
  console.log(JSON.stringify(json, null, 2).slice(0, 1200));
}

const NOTE = `
────────────────────────────────────────────────────────────────────────────────────────────
NOTE ON "MULTIPLE COMMANDS IN ONE QUERY" — this is a CONTRACT limit, not a bug to fix in a loop.
The reply carries exactly ONE \`action\` (\`src/voice/response.ts\`), so a sentence containing two
instructions can only ever produce one outcome. Supporting two would need the brain to return an
action LIST and the app to execute them in order — an n8n + contract change, not an app fix.
Separately, WRITES ARE DARK in v1 (\`VOICE_WRITES_ENABLED = false\`), so any "create/update" half of
such a sentence would not execute even if it were returned.
────────────────────────────────────────────────────────────────────────────────────────────`;

const main = mode === 'proxy' ? runProxy : runBrain;
main()
  .then(() => { console.log(NOTE); console.log(`raw responses saved under ${OUT}/`); })
  .catch((e) => { console.error('probe failed:', e); process.exit(1); });
