/**
 * i18n free-wins scan — finds copy the owner ALREADY supplied that no screen reads.
 *
 *   node scripts/i18n-freewins-scan.mjs            # near-miss + exact, multi-word only
 *   node scripts/i18n-freewins-scan.mjs --all      # include single-word near-misses (noisy)
 *
 * WHY THIS EXISTS. Nothing else in the toolchain can see this class of gap:
 *   - the i18n parity test only proves a key EXISTS in all five languages;
 *   - `tsc` sees a perfectly well-typed string literal;
 *   - `npm test` covers pure logic, not which string a screen renders.
 * Phase 80 found 117 such places this way and wired 73 at zero copy cost. Phase 81's
 * near-miss pass then found three more keys with ZERO consumers — hidden from the exact
 * scan only by curly-vs-straight apostrophes.
 *
 * RUN IT AFTER EVERY COPY DROP.
 *
 * Three traps, all learned the hard way — do not "simplify" past them:
 *  1. Parse the dictionary with the TOKENIZER below, not a line-anchored regex. Entries are
 *     several per line and mix ' and " quoting; a naive regex read 124 of 226 keys and
 *     silently under-reported.
 *  2. Keep the 2-character floor. An earlier `< 4` filter hid `priority.low` = "Low".
 *  3. Single-word case-insensitive matching is ~500 hits of identifier noise. Multi-word is
 *     the default for that reason; --all is there when you want to grind through the rest.
 *
 * A hit is NOT automatically a fix. Six categories must never be swapped — see
 * docs/PHASES.md (Phase 80) — and a hit whose on-screen PEERS have no key would leave a
 * visibly half-translated group, which reads worse than all-English.
 *
 * ⚠️ KNOWN BLIND SPOT — TEMPLATE LITERALS. This scans quoted strings and JSX text only, so a
 * composed string never appears in the output. `(tabs)/leads.tsx:251` was exactly that:
 * `` toast(`${lead.name} saved on this device — …`) `` matching the supplied placeholder key
 * `sync.savedLocalNamed`. It was found by grepping the dictionary's English, NOT by this
 * script. So after running this, ALSO grep the English of any `…Named`/`{placeholder}` key
 * for a hand-built template literal. Do not assume a clean run means no free wins are left.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDE = process.argv.includes('--all');

const dictSrc = fs.readFileSync(path.join(ROOT, 'src/i18n/index.tsx'), 'utf8');
const lines = dictSrc.split(/\r?\n/);
const start = lines.findIndex((l) => /^const en = \{/.test(l));
const end = lines.findIndex((l, i) => i > start && /^\};/.test(l));
if (start < 0 || end < 0) {
  console.error('Could not locate the `const en = {` block in src/i18n/index.tsx.');
  process.exit(1);
}
const body = lines.slice(start + 1, end).join('\n');

const BS = String.fromCharCode(92);

/** Reads a single- or double-quoted JS string starting at st.i. Returns null if not on a quote. */
function readStringAt(s, st) {
  const q = s[st.i];
  if (q !== "'" && q !== '"') return null;
  st.i++;
  let v = '';
  while (st.i < s.length && s[st.i] !== q) {
    if (s[st.i] === BS) {
      const nxt = s[st.i + 1];
      v += nxt === 'n' ? '\n' : nxt;
      st.i += 2;
      continue;
    }
    v += s[st.i++];
  }
  st.i++;
  return v;
}

/** Trap 1: a real tokenizer over the dictionary body, quoted AND bare identifier keys. */
function tokenizeEntries(s) {
  const out = [];
  const st = { i: 0 };
  while (st.i < s.length) {
    const ch = s[st.i];
    if (ch === '/' && s[st.i + 1] === '*') { const e = s.indexOf('*/', st.i); st.i = e < 0 ? s.length : e + 2; continue; }
    if (ch === '/' && s[st.i + 1] === '/') { const e = s.indexOf('\n', st.i); st.i = e < 0 ? s.length : e + 1; continue; }
    if (ch === "'" || ch === '"') {
      const save = st.i;
      const key = readStringAt(s, st);
      let j = st.i;
      while (/\s/.test(s[j])) j++;
      if (s[j] === ':') {
        st.i = j + 1;
        while (/\s/.test(s[st.i])) st.i++;
        const val = readStringAt(s, st);
        if (val !== null) { out.push([key, val]); continue; }
      }
      st.i = save + 1;
      continue;
    }
    const m = /^[A-Za-z_$][\w$]*/.exec(s.slice(st.i));
    if (m) {
      const key = m[0];
      let j = st.i + key.length;
      while (/\s/.test(s[j])) j++;
      if (s[j] === ':') {
        st.i = j + 1;
        while (/\s/.test(s[st.i])) st.i++;
        const val = readStringAt(s, st);
        if (val !== null) { out.push([key, val]); continue; }
      }
      st.i += key.length;
      continue;
    }
    st.i++;
  }
  return out;
}

/**
 * What makes two strings "the same sentence". The apostrophe and ellipsis rules are the
 * whole point of the near-miss pass: source files are typed with a straight ' while the
 * supplied copy uses a curly ’, which made three keys invisible to an exact-match scan.
 */
const norm = (v) => v
  .replace(/…/g, '...')
  .replace(/[‘’]/g, "'")
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[.:!…]+$/g, '')
  .replace(/\.\.\.$/, '')
  .trim()
  .toLowerCase();

const entries = tokenizeEntries(body);
const byNorm = new Map();
for (const [k, v] of entries) {
  const n = norm(v);
  if (n.length < 2) continue;                       // trap 2: 2-char floor, not 4
  if (!byNorm.has(n)) byNorm.set(n, []);
  byNorm.get(n).push({ key: k, en: v });
}

function walk(dir, acc) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) {
      if (f.name === '__tests__' || f.name === 'node_modules') continue;
      walk(p, acc);
    } else if (/\.(ts|tsx)$/.test(f.name)) acc.push(p);
  }
  return acc;
}

const files = walk(path.join(ROOT, 'src'), []).filter((p) => !p.includes(path.join('src', 'i18n')));

const hits = [];
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  src.split(/\r?\n/).forEach((line, idx) => {
    const trimmed = line.trim();
    // Comment prose matches the dictionary all the time and is never a render site.
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) return;
    if (/^import\b/.test(trimmed)) return;

    const candidates = [];
    const re = /(['"])((?:(?!\1)[^\\])*)\1/g;
    let m;
    while ((m = re.exec(line))) {
      const before = line.slice(Math.max(0, m.index - 12), m.index);
      if (/\bt\($|\btr\($|\bt\(\s*$/.test(before)) continue;   // already a t() KEY, not copy
      candidates.push(m[2]);
    }
    const jsx = />([^<>{}]{2,})</g;
    while ((m = jsx.exec(line))) candidates.push(m[1]);

    for (const text of candidates) {
      const n = norm(text);
      if (n.length < 2 || !/[a-z]/.test(n)) continue;
      const found = byNorm.get(n);
      if (!found) continue;
      hits.push({
        file: path.relative(ROOT, file).replace(/\\/g, '/'),
        line: idx + 1,
        text,
        keys: found.map((f) => `${f.key} = ${JSON.stringify(f.en)}`),
        exact: found.some((f) => f.en === text),
        multiword: /\s/.test(text.trim()),
        context: trimmed.slice(0, 150),
      });
    }
  });
}

const show = (h) => {
  console.log(`${h.file}:${h.line}  ${JSON.stringify(h.text)}`);
  console.log(`      -> ${h.keys.join(' | ')}`);
  console.log(`      ctx: ${h.context}`);
};

const near = hits.filter((h) => !h.exact && (WIDE || h.multiword));   // trap 3
const exact = hits.filter((h) => h.exact);

console.log(`dictionary keys parsed : ${entries.length}`);
console.log(`files scanned          : ${files.length}`);
console.log(`NEAR-MISS hits         : ${near.length}${WIDE ? '' : '  (multi-word only; --all for the rest)'}`);
console.log(`EXACT hits             : ${exact.length}`);
console.log('');
console.log('=========== NEAR-MISS (same sentence, different case/punctuation) ===========');
near.forEach(show);
console.log('');
console.log('=========== EXACT (verbatim match, still hand-written) ===========');
exact.forEach(show);
console.log('');
console.log('Remember: a hit is a CANDIDATE. Check the six excluded categories in docs/PHASES.md,');
console.log('and check whether the on-screen PEERS of the string have keys before wiring it.');
