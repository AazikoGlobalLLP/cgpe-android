# File capture & MinIO storage — audit and requirements

**Date:** 2026-08-26 · **Phase 78** · Asked for by the owner: *"capture wali jo problem hai usse ab
audit kijiye and usse MinIO me save karna hai — muje yeh batao ki aapko kya kya chaiye woh sab images
and videos and files ko MinIO ke storage mein save karne ke liye."*

Everything below was read out of the real code in `cgpe-backend-main` and `ANDROID/src`, not from any
earlier document. File and line references are given so every claim can be checked.

---

## Part 1 — The capture problem, diagnosed

**Short version: uploads are not broken in the app. They are being saved to the server's own hard
disk and handed back with a web address that points at the phone itself, so the file can never be
opened again. No cloud storage has ever been switched on.**

### The evidence, in order

**1. Cloud storage is not configured, so every upload silently takes the fallback path.**
`services/cloudStorage.js:10` only builds a storage client if three environment variables exist:

```js
if (process.env.DO_SPACES_ENDPOINT && process.env.DO_SPACES_KEY && process.env.DO_SPACES_SECRET) {
```

The backend's `.env` contains **13 keys, and none of them is a storage key**:
`MONGODB_URI` · `JWT_SECRET` · `PORT` · `NODE_ENV` · `OPENAI_API_KEY` · `OPENAI_MODEL` ·
`CLAIM_INTAKE_TOKEN` · `AI_SERVICE_URL` · `AI_SERVICE_TOKEN` · `CA_DATA_COLLECTION` ·
`CGPE_REPORT_WEBHOOK_URL` · `CGPE_REPORT_RENDER_URL` · `CGPE_REPORT_SECRET`.
So `cloudStorage.isConfigured()` returns **false** and `routes/upload.js:107` falls through to
writing the file onto the server's own disk under `uploads/<bucket>/`.

> ⚠️ **One honesty caveat.** That is the `.env` in the local checkout of the backend. The live
> droplet could in principle have more keys set. It is worth one command to confirm — but the
> symptom the team reports matches this exactly, so it is very likely the same there.

**2. The URL handed back to the phone points at the phone.**
`routes/upload.js:122`:

```js
const fileUrl = `${process.env.BACKEND_URL || 'http://localhost:3001'}/uploads/${bucket}/${fileName}`;
```

`BACKEND_URL` is **not in the `.env` either**, so the fallback wins and every uploaded file comes
back as `http://localhost:3001/uploads/...`. On a phone, `localhost` means *the phone*, which is not
running anything on port 3001. The file uploaded fine; it is simply unreachable forever after.

**3. The app already knows this and says so honestly — it is not hiding a failure.**
`src/lib/fileUpload.ts:126` `isEphemeralUrl()` treats `localhost`, `127.0.0.1`, `0.0.0.0`, any
`.local` host **and any `/uploads/` path** as a URL that will not survive, so the app can warn rather
than pretend the attachment is safe. The client is behaving correctly against a server that has no
storage configured.

**4. A second, separate bug is waiting behind the first one.** When cloud storage *is* finally
switched on, a failed cloud upload will return **HTTP 500 instead of falling back to local disk**.
`cloudStorage.js:76-79` deletes the temporary file inside its own error handler:

```js
if (file.path && fs.existsSync(file.path)) { fs.unlinkSync(file.path); }
throw new Error(...)
```

and then `upload.js:118` tries to move that same, now-deleted file:
`fs.renameSync(req.file.path, filePath)` → `ENOENT` → the outer catch returns 500. The comment at
`upload.js:101` says "Fall back to local storage if cloud upload fails", but it cannot. **This must
be fixed in the same change as the MinIO switch-on**, or the first storage hiccup becomes a hard
failure with no fallback.

### What is NOT the problem

- **Not the route being missing.** `POST /upload` answers `401` without a token, which proves it is
  deployed and running.
- **Not the app's picker.** The photo / gallery / file source sheet and the pre-upload size and type
  checks all work and mirror the server's own limits deliberately (`fileUpload.ts:21-29`).
- **Not the 10 MB limit** — for photos and documents. It *is* a problem for video; see Part 3.

---

## Part 2 — What I need from you to put files into MinIO

**Good news first: the backend already speaks the right protocol.** It uses the AWS S3 SDK
(`@aws-sdk/client-s3`) and MinIO is S3-compatible, so this is mostly configuration, not a rewrite.

### 2a. The six values I need from you

Please send these six. They are the only things I cannot find or invent.

| # | What | Looks like | Where you get it |
|---|---|---|---|
| 1 | **MinIO endpoint URL** | `https://minio.cgpe.in` or `https://IP:9000` | The address your MinIO server is reachable at, **from the backend droplet**. Must be HTTPS if the app is to open files directly. |
| 2 | **Access key** | `cgpeAccessKey` | MinIO Console → Access Keys → Create. **This is a secret — send it privately, never in a chat log or a commit.** |
| 3 | **Secret key** | a long random string | Shown once when you create the access key. **Secret.** |
| 4 | **Bucket name** | `cgpe-files` | Create it in the MinIO Console first. |
| 5 | **Region string** | `us-east-1` is the safe default | MinIO ignores this, but the AWS SDK refuses to start without one. If you have no preference I will use `us-east-1`. |
| 6 | **`BACKEND_URL`** | `https://cgpe.in/internal` | **This one is needed regardless of MinIO** — it is what fixes the `localhost` bug in Part 1 for anything still served locally. |

### 2b. The one decision only you can make

**Should uploaded files be publicly readable by anyone who has the link, or private?**

- **Public (simplest).** Anyone with the URL can open the file — including someone who is not logged
  in. The app just stores the link. This is what the current code assumes
  (`cloudStorage.js:49` sets `ACL: 'public-read'`).
- **Private with signed links (safer, and what I recommend).** Files are not readable directly; the
  backend generates a temporary link (say, valid 15 minutes) each time someone opens one. **These are
  customer KYC documents, claim papers and policy scans**, so a leaked link is a real privacy problem
  under DPDP. It is roughly half a day of extra backend work.

I need your answer before writing the code, because the two paths store different things.

### 2c. What I will change in the code (so you know what you are approving)

These are backend changes — the phone app needs **no change at all** for MinIO, which is why this is
worth doing before the next APK rather than after.

1. **`forcePathStyle` must become `true`.** `cloudStorage.js:19` currently sets it to `false`, which
   is right for DigitalOcean Spaces and **wrong for MinIO** — MinIO serves buckets as
   `endpoint/bucket/file`, not `bucket.endpoint/file`. Left as-is, every upload fails to connect.
2. **The returned URL must include the bucket.** `cloudStorage.js:64` builds
   `` `${DO_SPACES_ENDPOINT}/${fileKey}` `` which omits the bucket name. That happens to work for
   Spaces (the bucket is in the hostname) and gives a **404 on MinIO**.
3. **`ACL: 'public-read'` may need to become a bucket policy.** Many MinIO installs reject per-object
   ACLs outright. If you choose "public" in 2b, I set the policy on the bucket once instead.
4. **Fix the failed-fallback 500** described in Part 1, item 4.
5. **Rename the environment variables** from `DO_SPACES_*` to something honest like `S3_*`, since
   they will no longer be pointing at DigitalOcean. Cosmetic, but the next person reading it will
   otherwise go looking for a DigitalOcean account that does not exist.

### 2d. What you need to do on the MinIO server itself

1. Create the bucket (name from 2a #4).
2. Create an access key + secret (2a #2, #3).
3. Make sure the backend droplet can reach the MinIO address — if MinIO is on a different machine,
   its port must be open **to the droplet**.
4. If the app is to open files directly, MinIO needs a **valid HTTPS certificate**. Android blocks
   plain `http://` by default, and a self-signed certificate will fail silently. If you would rather
   not deal with certificates, choose the **private/signed-links** option in 2b — then files are
   fetched through `cgpe.in`, which already has a working certificate.

---

## Part 3 — Videos: three separate blocks, and a decision for you

**Videos cannot be uploaded today, and MinIO alone will not change that.** It is blocked in three
independent places, all of which have to change together:

| Where | What it says today | File |
|---|---|---|
| The phone's camera | opens in **photo mode only** — there is no "record video" option | `src/ui/DocumentSource.tsx:50,58` |
| The app's pre-check | rejects anything that is not an image, PDF, Word or Excel | `src/lib/fileUpload.ts:37-47` |
| The server | same allowlist — a video gets `File type video/mp4 is not allowed` | `routes/upload.js:30-41` |

**And the size limit is the real obstacle.** Both sides cap uploads at **10 MB**
(`upload.js:53`, `fileUpload.ts:29`). A 30-second video from a modern phone is typically **30–60 MB**,
so simply allowing the file type would just move the failure from "type not allowed" to "too large".

**What I need from you if you want video:**
- **How long a video should staff be able to send?** (e.g. 30 seconds, 1 minute). I will set the size
  limit from that number rather than guessing one.
- **What are the videos actually for?** If it is damage evidence for a claim, low resolution is fine
  and I can compress on the phone before sending — that keeps a 1-minute clip under about 10 MB and
  saves a lot of mobile data for the field team. If they must be full quality, the limit has to go up
  a lot and uploads will be slow on mobile data.

**Note this is a NATIVE change** (the phone's camera has to be told to allow video), so it needs a
**new APK** — and EAS Android builds are refused until the free-plan quota resets on **1 Sep 2026**.
The MinIO/server half is not affected and can go live before that.

---

## Summary — what happens next

| Who | What |
|---|---|
| **You** | Send the six values in 2a · answer the public-vs-private question in 2b · answer the two video questions in Part 3 |
| **Me** | Fix the `forcePathStyle`, bucket-in-URL, ACL and failed-fallback bugs; wire and test MinIO |
| **You / OPS** | Set the values on the droplet and restart `:3001` — I cannot deploy from here |
| **Blocked until 1 Sep** | Video capture, because it needs a new APK |

**The single highest-value thing you can do right now, before any of the above:** set `BACKEND_URL`
on the droplet. That one line makes existing uploads openable again, and it is needed whether or not
MinIO ever happens.
