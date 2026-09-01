#!/usr/bin/env node
/**
 * Exercise the REAL voice pipeline from a terminal — no phone, no APK, no build.
 *
 * ── WHY ───────────────────────────────────────────────────────────────────────────────────────
 * Voice is the one feature whose correctness mostly lives OUTSIDE this repo: the n8n brain decides
 * what a spoken sentence means and which screen to open. `npm test` pins our parser against
 * hand-written JSON, which proves we handle the shapes we IMAGINED — not the shapes the brain
 * actually sends. Those are different claims, and only this script settles the second one.
 *
 * ── HOW TO RUN IT (PowerShell) ────────────────────────────────────────────────────────────────
 *   cd f:\Shivam-Aaziko-Dev-MERN\CGPE-CURRENT-PROJECT\ANDROID
 *   $env:CGPE_EMAIL = "you@example.com"
 *   $env:CGPE_PASSWORD = "your-password"
 *   $env:CGPE_VOICE_SECRET = "vbk_..."      # OPTIONAL - see below
 *   node scripts/voice-probe.mjs
 *
 * It signs in, prints which voice legs the server has configured, then runs every clip in
 * `e2e/voice-probe/audio/` through the REAL `POST /api/voice/ask` chain (STT -> brain -> TTS) and
 * shows what was heard, which screen would open, and what it said back.
 *
 * 🔑 THE AUDIO PATH NEEDS ONLY A LOGIN. The backend holds the brain secret and makes that call
 * itself, so a tester who cannot see the droplet's `.env` can still exercise the entire feature.
 * `CGPE_VOICE_SECRET` only unlocks the EXTRA text-only battery that talks to the brain directly
 * (useful for checking intent mapping without spending STT/TTS), and is skipped when absent.
 *
 * Generate the clips first — locally and free, no vendor, no credits:
 *   powershell -ExecutionPolicy Bypass -File scripts\make-voice-clips.ps1
 *
 * ⚠️ CREDENTIALS COME FROM THE ENVIRONMENT ONLY. Nothing is hardcoded, nothing is written to a
 * commit, and the raw responses land in `e2e/voice-probe/`, which is gitignored AND easignored.
 * Close the shell (or `Remove-Item Env:CGPE_PASSWORD`) when you are done.
 */
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://cgpe.in/internal/api';
const BRAIN = process.env.CGPE_VOICE_BRAIN_URL || 'https://ai.cgpe.in/webhook/cgpe-voice-brain';
const OUT = path.join('e2e', 'voice-probe');

/**
 * The battery. Mixed English / Hindi / Hinglish, because that is what the staff actually speak, and
 * deliberately including the two cases the owner named on 2026-09-01: an ordinary read
 * ("mere aaj ke tasks"), and a MULTI-COMMAND sentence — see the NOTE printed at the end.
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
  { id: 'multi', text: 'mere aaj ke tasks dikhao aur ek naya task banao kal ke liye', expect: 'ONE action only — see NOTE' },
];

const args = process.argv.slice(2);
const audioArg = args.indexOf('--audio');
const audioPath = audioArg >= 0 ? args[audioArg + 1] : null;

function save(name, body) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), typeof body === 'string' ? body : JSON.stringify(body, null, 2));
}

async function login() {
  const email = process.env.CGPE_EMAIL;
  const password = process.env.CGPE_PASSWORD;
  if (!email || !password) {
    console.error('Set CGPE_EMAIL and CGPE_PASSWORD in this shell first. See the header of this file.');
    throw new Error('missing credentials');
  }
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // ⚠️ THE FIELD IS `email_or_phone`, NOT `email` — `routes/auth.js:820` validates it by that
    // name and answers 400 "Email or mobile number is required" for anything else. The first run of
    // this script sent `email` and failed exactly there. The APP has always been right
    // (`src/data/api.ts:980`); only this script was guessing. Read the producer, do not assume.
    body: JSON.stringify({ email_or_phone: email, password }),
  });
  const json = await res.json().catch(() => null);
  // Shape from `cgpe-backend-main/routes/auth.js:931` — `{success, data:{user, token}}`.
  const token = json?.data?.token || json?.token;
  if (!res.ok || !token) {
    console.error(`\nLOGIN FAILED: HTTP ${res.status}`);
    console.error(JSON.stringify(json)?.slice(0, 300));
    console.error('\n(the app shows these as friendly sentences; NO_ACCOUNT / BAD_PASSWORD are the machine codes)');
    // `process.exit()` here crashed Node on Windows with
    // "Assertion failed: !(handle->flags & UV_HANDLE_CLOSING) ... src\\win\\async.c" — libuv objects
    // to being torn down while a fetch handle is still open. Throw instead and let the runner set
    // exitCode, so a failed probe ends with a readable line rather than a native assertion.
    throw new Error('login failed');
  }
  console.log(`Signed in as ${json?.data?.user?.full_name || email} (HTTP ${res.status})\n`);
  return token;
}

/** Which legs the SERVER thinks are configured. Names and millisecond budgets only, never values. */
async function voiceStatus(token) {
  const res = await fetch(`${API}/voice/status`, { headers: { Authorization: `Bearer ${token}` } });
  const json = await res.json().catch(() => null);
  save('voice-status', json ?? {});
  const d = json?.data ?? json;
  console.log(`GET /voice/status -> HTTP ${res.status}`);
  console.log(JSON.stringify(d, null, 2));
  if (d && d.ready === false) {
    console.log(`\n🔴 VOICE IS NOT READY. Missing: ${JSON.stringify(d.missing)}`);
    console.log('   Until those are set in the droplet .env and :3001 restarted, /voice/ask answers 503.');
  } else if (d?.ready) {
    console.log('\n✅ The server reports voice READY.');
  }
  console.log('');
  return d;
}

function report(id, json, expect) {
  const ok = json?.success ?? json?.ok;
  const act = json?.action || {};
  const reply = String(json?.reply_text ?? '').replace(/\s+/g, ' ').slice(0, 58);
  console.log(
    `  ${id.padEnd(16)} ok=${String(ok).padEnd(5)} action=${String(act.type ?? '-').padEnd(13)} ` +
    `route=${String(act.route ?? '-').padEnd(16)} "${reply}"`,
  );
  console.log(`  ${''.padEnd(16)} expected: ${expect}`);
}

async function runBrain(authToken) {
  const secret = process.env.CGPE_VOICE_SECRET;
  if (!secret) {
    console.log('(brain battery SKIPPED — CGPE_VOICE_SECRET is not set in this shell.)');
    console.log('Without it the brain answers {"success":false,"reason":"bad_secret"} to everything.\n');
    return;
  }
  // ⚠️ SHAPES TAKEN FROM THE BACKEND'S OWN CALL, NOT GUESSED — `services/voiceService.js:206-213`:
  // the body is exactly `{transcript, authToken}` and the secret rides in `X-CGPE-Webhook-Secret`.
  // An earlier draft of this script invented `X-CGPE-Secret` plus a `secret` body field, which would
  // have reported `bad_secret` for all twelve commands and wasted the whole run.
  console.log(`BRAIN ${BRAIN}\n`);
  for (const c of BATTERY) {
    try {
      const res = await fetch(BRAIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CGPE-Webhook-Secret': secret },
        body: JSON.stringify({ transcript: c.text, authToken }),
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* keep the raw text as the fixture */ }
      save(`brain-${c.id}`, json ?? text);
      report(c.id, json, c.expect);
    } catch (e) {
      console.log(`  ${c.id.padEnd(16)} THREW: ${e.message}`);
    }
  }
  console.log('');
}

/**
 * The full chain (STT → brain → TTS) for EVERY clip in `e2e/voice-probe/audio/`, exactly as the app
 * calls it: multipart, bearer token, and NO Content-Type header so fetch sets the boundary itself.
 *
 * 🔑 THIS PATH NEEDS ONLY A LOGIN — not `CGPE_VOICE_SECRET`. The backend holds the brain secret and
 * makes that call for us, so a tester who cannot see the droplet's `.env` can still exercise the
 * whole feature. That is what makes this the useful mode.
 *
 * The clips are generated locally and free by `scripts/make-voice-clips.ps1` (Windows' built-in
 * speech engine), so no vendor, no credits and no upload are needed to produce test speech.
 */
async function askAllClips(token) {
  const dir = path.join(OUT, 'audio');
  if (!fs.existsSync(dir)) {
    console.log(`(no clips in ${dir} — run scripts/make-voice-clips.ps1 first, or pass --audio <file>)`);
    return;
  }
  const clips = fs.readdirSync(dir).filter((f) => /\.(wav|m4a|mp3|aac|ogg|webm)$/i.test(f)).sort();
  if (clips.length === 0) { console.log(`(no audio files in ${dir})`); return; }

  console.log(`FULL CHAIN — POST /voice/ask with ${clips.length} clips\n`);
  for (const file of clips) {
    const id = path.basename(file).replace(/\.[^.]+$/, '');
    const form = new FormData();
    form.append('audio', new Blob([fs.readFileSync(path.join(dir, file))]), file);
    form.append('lang', 'en-IN');
    form.append('session_id', 'probe-session');
    form.append('request_id', `probe-${id}-${Date.now()}`);
    form.append('screen', '/(tabs)/home');
    form.append('history', '[]');

    const t0 = Date.now();
    try {
      const res = await fetch(`${API}/voice/ask`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch { /* keep raw */ }
      save(`ask-${id}`, json ?? text);
      const ms = Date.now() - t0;
      const act = json?.action || {};
      const heard = String(json?.transcript ?? '').replace(/\s+/g, ' ').slice(0, 40);
      const reply = String(json?.reply_text ?? '').replace(/\s+/g, ' ').slice(0, 46);
      console.log(
        `  ${id.padEnd(13)} HTTP ${res.status} ${String(ms + 'ms').padEnd(8)} ` +
        `heard="${heard}" -> ${String(act.type ?? '-').padEnd(9)} ${String(act.route ?? '')}`,
      );
      if (reply) console.log(`  ${''.padEnd(13)} said: "${reply}"`);
    } catch (e) {
      console.log(`  ${id.padEnd(13)} THREW after ${Date.now() - t0}ms: ${e.message}`);
    }
  }
  console.log('');
}

/** The single-file variant, kept for a one-off clip passed with `--audio`. */
async function askWithAudio(token) {
  if (!audioPath) {
    console.log('(no --audio given, so STT/TTS were not exercised — pass a clip to run the full chain)');
    return;
  }
  if (!fs.existsSync(audioPath)) {
    console.error(`audio file not found: ${audioPath}`);
    return;
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
  console.log(JSON.stringify(json, null, 2).slice(0, 1400));
}

const NOTE = `
────────────────────────────────────────────────────────────────────────────────────────────
NOTE ON "MULTIPLE COMMANDS IN ONE QUERY" — a CONTRACT limit, not a bug to loop on.
A reply carries exactly ONE \`action\` (src/voice/response.ts), so a sentence with two instructions
can only ever produce one outcome. Supporting two needs the brain to return an action LIST and the
app to execute them in order — an n8n + contract change, not an app fix. Separately, WRITES ARE
DARK in v1 (VOICE_WRITES_ENABLED = false), so a "create a task" half would not execute anyway.
────────────────────────────────────────────────────────────────────────────────────────────`;

(async () => {
  const token = await login();
  await voiceStatus(token);
  await runBrain(token);
  await askAllClips(token);
  await askWithAudio(token);
})()
  .then(() => { console.log(NOTE); console.log(`\nRaw responses saved under ${OUT}/`); })
  .catch((e) => { console.error(`
probe stopped: ${e.message}`); process.exitCode = 1; });
