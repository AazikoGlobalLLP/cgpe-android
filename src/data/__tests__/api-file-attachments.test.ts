/**
 * The `POST /api/file-attachments` request body, pinned — specifically the claim↔file LINK.
 *
 * WHY THIS FILE EXISTS. Until 2026-08-26 that endpoint had no `entity_id` in its field
 * whitelist, so a file could be recorded but never tied to a claim, and the claim id had to
 * travel as human prose inside `description`. `cgpe-api` closed that in their Phase 94
 * (`fda199c`): `routes/fileAttachments.js` now persists `entity_id` + `entity_type`, echoes
 * both from `toAttachment`, and filters on `?entity_id=`.
 *
 * Every expectation below was read from that file, not from a summary:
 *   POST /api/file-attachments  (protect)
 *     whitelist: filename / file_url / file_size / file_type / category /
 *                entity_id / entity_type / uploaded_by / description
 *     201:  { success:true, data: { id, ... } }
 *
 * 🔴 IT IS NOT DEPLOYED. `fda199c` is on `origin/Shivam`; prod deploys `origin/main`, which was
 * `990c660` when this was written. An unknown key is simply ignored by the old build, so sending
 * the two fields is safe today and correct the moment the owner merges and deploys — that
 * asymmetry is the whole argument for wiring it now, and this test is what proves the app half
 * is ready. It does NOT prove linking works end-to-end; only a deployed backend can.
 *
 * FETCH IS STUBBED at the one boundary `api.ts` owns, so the real `req` path runs.
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

type Api = typeof import('@/data/api');
let api: Api;
let fetchSpy: ReturnType<typeof vi.fn>;

const reply = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const created = (id = 'fa_1') => reply(201, { success: true, data: { id } });

/** The request the app actually sent: [url, init]. */
const sent = (i = 0) => {
  const [url, init] = fetchSpy.mock.calls[i] as [string, RequestInit];
  return { url, init, body: init?.body ? JSON.parse(String(init.body)) : undefined };
};

beforeEach(async () => {
  vi.resetModules();
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  api = await import('@/data/api');
  api.setAuthToken('test-token');
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recordFileAttachment — the claim↔file link on the wire', () => {
  it('sends the claim id in the real entity_id field, with entity_type beside it', async () => {
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({
      filename: 'damage.jpg',
      fileUrl: 'https://cgpe.in/uploads/general/1-damage.jpg',
      fileType: 'image/jpeg',
      category: 'claim',
      entityId: 'CLM-20260813-1177',
      entityType: 'claim',
    });

    expect(sent().body.entity_id).toBe('CLM-20260813-1177');
    expect(sent().body.entity_type).toBe('claim');
  });

  it('no longer smuggles the claim id into `description`', async () => {
    // The old code sent `description: \`Claim ${id}\`` because there was nowhere else to put it.
    // A record that merely MENTIONS a claim is not queryable as belonging to one, and overloading
    // a prose field is the kind of fake link this project refuses to ship.
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({
      filename: 'damage.jpg',
      fileUrl: 'https://cgpe.in/uploads/general/1-damage.jpg',
      category: 'claim',
      entityId: 'CLM-20260813-1177',
      entityType: 'claim',
      description: 'Attached from the claim screen',
    });

    expect(sent().body.description).not.toContain('CLM-20260813-1177');
  });

  it('sends an EMPTY entity_id — never a placeholder — when there is no record to point at', async () => {
    // The new-claim screen attaches files before the claim exists. An empty `entity_id` honestly
    // means "not linked"; a made-up one would mean "linked to the wrong claim". `entity_type` is
    // still true and is still sent.
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({
      filename: 'form.pdf',
      fileUrl: 'https://cgpe.in/uploads/general/1-form.pdf',
      category: 'claim',
      entityType: 'claim',
    });

    expect(sent().body.entity_id).toBe('');
    expect(sent().body.entity_type).toBe('claim');
  });

  it('sends exactly the whitelisted keys and nothing else', async () => {
    // Anything outside `routes/fileAttachments.js`'s whitelist is silently dropped, so an extra
    // key is dead weight that reads like a feature. Keeping this exact is how the two stay in step.
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({
      filename: 'a.jpg', fileUrl: 'https://cgpe.in/uploads/general/a.jpg', category: 'claim',
    });

    expect(Object.keys(sent().body).sort()).toEqual([
      'category', 'description', 'entity_id', 'entity_type',
      'file_size', 'file_type', 'file_url', 'filename', 'storage_key',
    ]);
  });

  it('does NOT send uploaded_by — the server stamps it from the token (backend Phase 104)', async () => {
    // Trusting the body let any caller attribute a file to anyone, so `routes/fileAttachments.js`
    // now ignores it outright. On the build deployed today it reads `b.uploaded_by || ''`, and the
    // app could only ever have sent `''` (no call site set it), so omitting the key stores exactly
    // what sending it stored. Pinned separately from the whitelist above because re-adding it is
    // the tempting "fix" for a file that shows no uploader — and it would change nothing at all.
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({
      filename: 'a.jpg', fileUrl: 'https://cgpe.in/uploads/general/a.jpg', category: 'claim',
    });

    expect('uploaded_by' in sent().body).toBe(false);
  });

  /* ---- the presigned flow (Phase 86 / backend Phase 95, D-122) ---- */

  it('sends the storage_key and an EMPTY file_url — the two are alternatives, never both', async () => {
    // The contract is explicit: record the KEY, leave `file_url` empty. Storing a signed URL
    // beside the key ships a link that is dead 300 seconds later — the "captures vanish" bug
    // in a new costume. This pins that a caller cannot accidentally send both.
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({
      filename: 'a.jpg',
      fileUrl: 'https://minio.example/bucket/u123/general/a.jpg',   // must be discarded
      storageKey: 'u123/general/1724-abc.jpg',
      category: 'claim',
      entityId: 'CLM-1',
      entityType: 'claim',
    });

    expect(sent().body.storage_key).toBe('u123/general/1724-abc.jpg');
    expect(sent().body.file_url).toBe('');
  });

  it('sends an empty storage_key on the legacy path, so the backend confirm step is not triggered', async () => {
    // `routes/fileAttachments.js` runs HeadObject + an ownership check only for a NON-EMPTY
    // `storage_key`. An empty string keeps every legacy caller on exactly the old code path.
    fetchSpy.mockResolvedValue(created());

    await api.recordFileAttachment({ filename: 'a.jpg', fileUrl: 'https://cgpe.in/uploads/general/a.jpg' });

    expect(sent().body.storage_key).toBe('');
    expect(sent().body.file_url).toBe('https://cgpe.in/uploads/general/a.jpg');
  });

  it('is a single attempt — a create must never double-fire on a retry', async () => {
    // `req()` retries idempotent READS only; this passes an explicit method, so one attempt.
    fetchSpy.mockResolvedValue(reply(500, { success: false, error: 'Server Error' }));

    const out = await api.recordFileAttachment({
      filename: 'a.jpg', fileUrl: 'https://cgpe.in/uploads/general/a.jpg',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(out).toBeNull();
  });

  it('fails quietly: the binary is already stored, so a failed RECORD must not read as a failed upload', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'));

    await expect(
      api.recordFileAttachment({ filename: 'a.jpg', fileUrl: 'https://cgpe.in/uploads/general/a.jpg' }),
    ).resolves.toBeNull();
  });

  it('sends nothing at all when there is no real session on this handset', async () => {
    api.setAuthToken('demo-token');
    fetchSpy.mockClear();

    const out = await api.recordFileAttachment({
      filename: 'a.jpg', fileUrl: 'https://cgpe.in/uploads/general/a.jpg',
    });

    expect(out).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
