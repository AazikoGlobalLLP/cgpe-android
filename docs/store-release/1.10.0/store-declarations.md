# Store declarations — CGPE Connect 1.10.0

Ready-to-adapt text for the Play Console and App Store Connect. **Do not submit any of this until it has been
verified against the exact binary submitted** (spec §45/§46). It is written to be honest about the 24/7 behaviour —
never weaken the wording while the runtime stays 24/7.

---

## 1. Google Play — Background Location declaration (§19)

**One primary feature requiring background access:** continuous workforce field-location for CGPE's field team.

> CGPE Connect is a business application used by CGPE employees and authorized field-team members. Background
> location is required for its core workforce-location feature: recording an employee's field route during a shift
> and, under recorded consent, an approximate off-duty (ambient) location, so the company Master can manage and
> support the field team. Before any tracking begins, the user is shown a dedicated disclosure explaining that
> precise location and movement can be collected 24 hours a day, including outside working hours, and records
> consent. On Android an ongoing foreground-service notification remains visible while location is collected.
> Location sampling is approximately hourly on a best-effort basis. Access to employee location is restricted to
> authorized company roles.

**Evidence packet to attach:** disclosure screenshots, the review video (below), the privacy-policy URL, and proof
of the persistent Android notification.

## 2. Google Play — Foreground Service declaration (§20)

- **Foreground service type:** `location`.
- **User-facing purpose:** record the employee's field route / consented ambient location for workforce management.
- **Why continued execution is required:** the phone is in a pocket all day; a foreground watch would capture only
  the minutes the app is open, so a foreground-service-backed background task is used.
- **If interrupted:** a 15-min watchdog re-arms the recorder (survives OEM kills and reboot via WorkManager).
- **How the employee is informed:** the mandatory consent screen + an always-visible foreground-service
  notification while location is active.
- The final merged manifest FGS type must match this declaration (confirm from `android/merged-manifest.txt`).

## 3. Demo / review video script (§19) — record on a handset (⏳)

1. Launch → login (demo employee).
2. The 24/7 location **disclosure screen** (read the "outside working hours" + retention lines on camera).
3. Tap **Agree** (consent recorded).
4. Android location permission sequence → **Allow all the time** (background path).
5. Notification permission.
6. Show the visible **foreground-service notification**.
7. Move the app to the background; show the notification still present.
8. (If safe) show the Master's map with demo data only.

Use demo data only. Keep it short.

## 4. Apple — App Review notes (§22/§35/§46)

> CGPE Connect is an employee/business application for CGPE field-team operations. Users sign in with an existing
> CGPE account (first-party OTP/password; no social login). The app has a disclosed 24/7 location workflow: before
> it is enabled, users see a dedicated notice explaining that location can be collected in the background and
> outside working hours, its purpose, who can view it (the company Master only), and the retention period
> (hidden after 90 days, deleted after 180), and consent is recorded server-side. iOS uses background location and
> enables the system background-location indicator. Sampling is approximately hourly, best-effort. Shift and
> off-duty data are stored separately. A reviewer account and step-by-step test instructions are provided.
> Reviewer credentials: [OWNER TO SUPPLY]. Account creation is admin-provisioned (no public self-registration);
> account deletion is available in-app.

Do **not** hide the off-duty behaviour from App Review.

## 5. Account model note (§24/§25)

- First-party auth only (no third-party social **primary** login) → Apple Guideline 4.8 additional-login
  requirement does not apply. Do not add a social sign-in button before submission without re-auditing 4.8.
- Employee accounts are **admin-provisioned** (no public self-registration). In-app account deletion +
  data-request channel exist (`cgpe.in/delete-account`).

## 6. OTP channel (for support copy / metadata) (§26)

OTP is delivered by **email** (for `@` identifiers) or **WhatsApp** (for phone identifiers) — **not SMS**. Support
material and any store copy must say email/WhatsApp. WhatsApp delivery depends on the backend `waService`/n8n
webhook being configured in the environment.

---

### Distribution route reminder

If shipping via **Managed Google Play private app** + **Apple Business Manager Custom App** (recommended), the
public background-location review + video scrutiny are largely avoided, but the privacy policy, consent, Data
Safety, and this transparency posture still apply. Keep these declarations ready either way.
