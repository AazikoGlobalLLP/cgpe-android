# CGPE Connect — App Store & Google Play Deployment / Compliance Engineering Specification

**Repository:** `https://github.com/AazikoGlobalLLP/cgpe-android.git`  
**Audited branch/current code basis:** `Shivam`  
**Document date:** 29 August 2026  
**Audience:** CGPE Connect mobile developer, backend developer, release engineer, QA engineer, and store-submission owner  
**Purpose:** Convert the current CGPE Connect application into a production-release package that can be submitted to Apple App Store and Google Play while preserving the current product behavior, including the 24/7 employee-location capability.

---

## 0. Document Authority and Non-Negotiable Product Constraints

This document is a **release, compliance, privacy, reliability, and store-submission engineering specification**.

The following constraints are owner-locked for this work:

1. **24/7 employee location tracking is a required product feature.**
2. The application must continue to support location collection outside working hours after the employee has been informed and the required consent has been recorded.
3. **The current location sampling cadence is approximately once per hour (60 minutes), not once per 60 seconds.**
4. The current permission set must be treated as the existing application baseline.
5. This document does **not** instruct the developer to remove any existing feature or permission.
6. Any change that would remove, disable, or materially narrow an existing business feature requires separate owner approval.
7. The developer's job under this document is to:
   - verify implementation;
   - align code, runtime behavior, user disclosure, privacy policy, and store declarations;
   - improve transparency and technical reliability;
   - prepare review evidence;
   - close security/privacy gaps;
   - make store submission technically defensible;
   - preserve the current functional requirements.
8. **No document can guarantee App Store or Google Play approval.** Final approval is controlled by Apple and Google review teams.

---

# 1. Current Application Snapshot

The current repository indicates the following production direction:

| Item | Current state |
|---|---|
| App name | CGPE Connect |
| App version in `app.json` | `1.10.0` |
| Framework | Expo / React Native |
| Expo SDK | `~57.0.7` |
| React Native | `0.86.0` |
| Android package | `com.cgpe.connect` |
| iOS bundle identifier | `com.cgpe.connect` |
| iPad support | `supportsTablet: true` |
| Android background location | Enabled |
| Android foreground location service | Enabled |
| iOS background location | Enabled |
| Secure storage | `expo-secure-store` |
| Background task | `expo-background-task` |
| Task manager | `expo-task-manager` |
| Notifications | `expo-notifications` |
| Calendar | `expo-calendar` |
| Camera / photos / microphone | Configured through `expo-image-picker` |
| Biometric / Face ID | `expo-local-authentication` |
| EAS production build profile | Present |
| EAS production submit profile | Present |

### Current Android permission baseline

The repository currently declares:

- `ACCESS_COARSE_LOCATION`
- `ACCESS_FINE_LOCATION`
- `ACCESS_BACKGROUND_LOCATION`
- `FOREGROUND_SERVICE`
- `FOREGROUND_SERVICE_LOCATION`
- `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`
- `RECEIVE_BOOT_COMPLETED`
- `POST_NOTIFICATIONS`
- `READ_CALENDAR`
- `WRITE_CALENDAR`

In addition, the app contains camera, photo/video, microphone, Face ID / biometric, notification, calendar, and document-related capabilities through Expo plugins.

**Developer instruction:** treat this list as the current baseline and audit it exactly as shipped by the generated native Android/iOS projects and final release binaries.

---

# 2. Current 24/7 Location Architecture — Preserve and Verify

The repository explicitly implements two location contexts:

## 2.1 Clocked-in / shift location

Current intended behavior:

- employee has a shift/session ID;
- route points belong to that attendance session;
- `High` location accuracy is used;
- `distanceInterval = 0` on Android;
- current time interval is owner-locked to **3,600,000 ms (60 minutes)**;
- points are uploaded to the backend against the shift session;
- the application uses a foreground-service-backed background task on Android;
- iOS is configured for background location updates.

## 2.2 24/7 off-duty / ambient location

Current intended behavior:

- ambient collection can continue when no active shift ID exists;
- ambient mode is armed only when the app's 24/7 consent state has been recorded and background permission is available;
- current ambient profile is intentionally less precise than shift tracking;
- `Balanced` accuracy is used for ambient mode;
- `distanceInterval = 30 m`;
- `timeInterval = 3,600,000 ms (60 minutes)`;
- ambient points are posted separately from shift route points;
- a neutral foreground-service notification is used on Android;
- consent state is persisted so background/headless execution can determine whether ambient collection is authorized.

### Owner-locked cadence

`src/lib/motion.ts` currently defines:

```ts
export const HOURLY_MS = 3600000;
```

The same hourly interval is applied to:

- moving shift profile;
- still shift profile;
- ambient/off-duty profile.

This replaced the previous approximately 60-second cadence.

---

# 3. Actual Real-World Cadence: Important Clarification

The developer must not describe the system as a hard guaranteed "one point exactly every 60 minutes."

Current code also includes a watchdog:

- watchdog target cadence: approximately every 15 minutes;
- stale-point threshold: approximately 45 minutes;
- when the newest point is considered stale, the watchdog may attempt a forced current-position fix;
- Android Doze / OEM power management may defer background execution.

Therefore the practical expectation is:

> **approximately one location point every 45–60 minutes in healthy conditions, on a best-effort basis, with operating-system delays possible.**

The application, privacy disclosure, internal SOP, management dashboard, and reviewer notes must not claim hard real-time accuracy that the OS cannot guarantee.

---

# 4. 24/7 Feature Preservation Strategy for Store Submission

Because 24/7 location is not removable, the strategy is **not to hide the behavior**. The strategy is to make the behavior technically and operationally transparent, narrowly controlled, secure, and fully consistent across:

- code;
- runtime UI;
- OS permission prompts;
- Android foreground notification;
- iOS location indicator;
- privacy policy;
- employee notice;
- App Store privacy disclosure;
- Google Play Data Safety;
- Google Play Background Location declaration;
- Google Play Foreground Service declaration;
- App Review / Play Review notes;
- review demonstration video.

## 4.1 Practical alternative to "high-frequency 24/7 GPS"

The current implementation already follows a materially safer architecture than the earlier 60-second model:

### During an active shift

- hourly sampling;
- high accuracy;
- route/session attribution.

### Outside an active shift

- hourly sampling;
- balanced/coarser accuracy;
- 30 m distance gating;
- separate ambient attribution.

This preserves the 24/7 capability while reducing:

- battery consumption;
- mobile-data usage;
- high-resolution off-duty location density.

The developer must preserve the distinction between **shift** and **ambient** data throughout the UI, backend model, audit logs, reports, exports, and privacy documentation.

## 4.2 Distribution alternative that preserves the same feature

If public-store review becomes difficult because of the employee-monitoring use case, the product feature can remain unchanged while distribution is evaluated through organization-restricted channels:

### Apple

- Apple Business Manager **Custom / Private App** distribution;
- Unlisted App Store distribution where appropriate;
- Apple Developer Enterprise Program only if CGPE meets Apple's eligibility requirements and the use case is not adequately served by the normal Apple Developer Program / Apple Business Manager routes.

### Android

- **Managed Google Play Private App** restricted to the CGPE organization.

These are distribution alternatives, not feature removals.

The runtime location permission model, employee transparency, security, and applicable privacy obligations still remain relevant.

---

# 5. Critical Data-Correctness Issue Introduced by the Hourly Cadence

The repository itself documents an attribution issue created by changing from ~60-second sampling to hourly sampling.

## Problem

The location buffer is attributed based on the shift session ID at flush time.

With an hourly cadence, a batch can straddle a clock-in or clock-out boundary.

Possible result:

- a point collected before clock-in may be recorded as part of the shift;
- a point collected before clock-out may later be treated as ambient;
- the possible attribution window is now much larger than the previous ~1-minute rounding error.

## Required engineering treatment

Preserve 24/7 collection and permissions, but make attribution precise.

Recommended data-correctness implementation:

1. Persist exact `clockInAt` and `clockOutAt` timestamps.
2. Every buffered point already has its own timestamp.
3. At a mode boundary, split points by timestamp instead of assigning the entire batch based only on current `sid`.
4. Points with timestamp inside the active shift window -> shift dataset/session.
5. Points outside the active shift window -> ambient dataset.
6. Handle timezone using absolute UTC timestamps internally.
7. Add automated tests for:
   - point 1 minute before clock-in;
   - point exactly at clock-in;
   - point 1 minute after clock-in;
   - point 1 minute before clock-out;
   - point exactly at clock-out;
   - point 1 minute after clock-out;
   - delayed OS delivery;
   - device clock change;
   - batch delivered after network reconnection.

This change improves correctness without removing the 24/7 feature.

---

# 6. Consent Implementation — Current State and Required Verification

The current consent screen is not generic. It explicitly states that the app shares:

> precise location and movement/activity, 24 hours a day, including outside working hours.

It also currently states:

- purpose: field-team management/support;
- visibility: only the company Master can see the location;
- retention: location history hidden after 90 days;
- permanent deletion after 180 days;
- status-bar notice remains visible whenever location sharing is active;
- 24/7 location is mandatory for using the CGPE Connect work application;
- user can turn location off later;
- app stops working until location is restored;
- Master is notified when the employee turns location off.

The app currently versions this notice as:

```text
v.01
```

## Developer audit

Verify all of the following:

- [ ] Consent is recorded on the server, not only locally.
- [ ] Consent record includes employee/user ID.
- [ ] Consent record includes notice version.
- [ ] Consent record includes timestamp.
- [ ] Consent record includes current language or copy variant where useful.
- [ ] Re-consent can be triggered if the material disclosure changes.
- [ ] A failed consent API call does not create a false local "consented" state.
- [ ] Ambient tracking cannot arm when required background permission is unavailable.
- [ ] Permission revocation is detected.
- [ ] Consent withdrawal / permission revocation produces a backend-visible state.
- [ ] Master notification of withdrawal is reliable and auditable.
- [ ] All supported languages communicate materially equivalent information.
- [ ] Store-review copy and privacy-policy copy describe the same behavior.

---

# 7. Prominent Background-Location Disclosure

Google Play evaluates background location as sensitive data.

Before the OS permission sequence, the application should have a prominent, understandable disclosure that clearly explains the current behavior.

The disclosure must accurately communicate:

- the app collects location;
- it operates in the background / when the app is not visible;
- it can operate 24 hours a day, including outside working hours;
- it is used for CGPE field-team/workforce management;
- who can access the data;
- current retention periods;
- the user-visible indicator/notification;
- the relationship between location permission and application access.

Do **not** weaken the wording in the store submission if the runtime behavior remains 24/7.

The Play review video should visibly show this disclosure before or during the permission flow.

---

# 8. Android Foreground-Service Notification

The current code uses a persistent Android foreground-service notification.

Current neutral ambient fallback:

- Title: `CGPE Connect`
- Body: `Location on for work`

Current shift notification:

- Title: `Recording your field route`
- Body: `Your shift is being tracked. Clock out to stop.`

## Developer verification

- [ ] Notification is present whenever Android foreground-service location collection is active.
- [ ] Notification is not silently removed while the service remains active.
- [ ] The correct notification channel exists.
- [ ] Notification channel is visible in Android settings.
- [ ] Localized text renders correctly.
- [ ] Notification survives backgrounding.
- [ ] Notification behavior is verified after app swipe-away.
- [ ] Notification behavior is verified after device reboot.
- [ ] Notification behavior is verified after process death and watchdog re-arm.
- [ ] Notification cannot falsely state tracking is active when the service has actually stopped.
- [ ] Notification cannot disappear while the service continues collecting.
- [ ] The notification text does not imply "shift only" when ambient 24/7 mode is active.

---

# 9. iOS Background-Location Indicator

The repository currently uses:

```ts
showsBackgroundLocationIndicator: true
pausesUpdatesAutomatically: false
```

The developer must verify on physical iPhones that:

- [ ] the iOS background-location indicator is shown as expected;
- [ ] permission status transitions are handled;
- [ ] "While Using" vs "Always" behavior is understood and tested;
- [ ] background delivery works after screen lock;
- [ ] delayed/batched location events do not corrupt attribution;
- [ ] permission downgrade/revocation is detected;
- [ ] the application never promises exact hourly delivery when iOS has deferred execution;
- [ ] low-power mode behavior is measured;
- [ ] app termination / relaunch behavior is documented.

---

# 10. Battery Optimization — Current Implementation Audit

The Android application currently declares:

```text
REQUEST_IGNORE_BATTERY_OPTIMIZATIONS
```

The tracker records whether the battery-optimization request has already been shown so it is not repeatedly presented.

This document does not change the permission baseline.

## Required audit

- [ ] Identify exactly when the battery-optimization flow appears.
- [ ] Confirm it does not loop on every launch or clock-in.
- [ ] Verify the UI explains why the setting is requested.
- [ ] Verify the app remains stable if the employee declines.
- [ ] Verify Samsung behavior.
- [ ] Verify Xiaomi / Redmi behavior.
- [ ] Verify Oppo / Realme behavior where applicable.
- [ ] Verify Vivo behavior where applicable.
- [ ] Verify OnePlus behavior.
- [ ] Verify Pixel / stock Android behavior.
- [ ] Measure actual battery drain over 8h, 12h, and 24h.
- [ ] Measure battery drain with the screen locked.
- [ ] Measure battery drain with network unavailable.
- [ ] Measure battery drain after reboot.
- [ ] Record whether the hourly profile materially reduces battery cost compared with the prior 60-second profile.

---

# 11. Background Reliability Watchdog

Current code uses a separate background watchdog task to re-arm recording if the OS kills the service or after reboot.

## Audit requirements

- [ ] Confirm watchdog task registration is idempotent.
- [ ] Confirm watchdog is not duplicated after app upgrades.
- [ ] Confirm watchdog survives reboot where supported.
- [ ] Confirm watchdog does not generate duplicate points.
- [ ] Confirm watchdog cannot re-arm tracking for a non-consented user.
- [ ] Confirm watchdog respects server-side consent withdrawal.
- [ ] Confirm watchdog behavior with expired authentication token.
- [ ] Confirm watchdog behavior after logout.
- [ ] Confirm watchdog does not incorrectly mix data between users on a shared device.
- [ ] Confirm forced-fix behavior is logged separately for diagnostics.
- [ ] Confirm WorkManager/OS deferral is handled as best-effort and not represented as a guaranteed SLA.

---

# 12. Offline Location Buffer

Current tracker uses:

```text
MAX_POINTS = 720
```

With the hourly cadence, this represents substantial offline headroom.

## Audit requirements

- [ ] Buffer is encrypted/protected by platform storage as appropriate.
- [ ] Buffer is associated with the correct authenticated user.
- [ ] A user switch cannot upload the previous user's buffered points to the new account.
- [ ] Corrupted JSON/state fails safely.
- [ ] Duplicate timestamps are handled correctly.
- [ ] Out-of-order OS delivery is handled.
- [ ] Very long offline periods do not crash serialization.
- [ ] Upload batching has payload-size limits.
- [ ] Backend idempotency prevents duplicate rows.
- [ ] Logout behavior is explicitly tested.
- [ ] Consent-withdrawal behavior is explicitly tested.
- [ ] Server rejection (`4xx`) and retryable failures are distinguished.
- [ ] `401` / expired token handling does not leave an uncontrolled recorder uploading indefinitely.
- [ ] Offline buffer retention matches privacy commitments.

---

# 13. Location Precision and Data Minimization Within the Existing Feature

Current implementation already separates precision:

### Shift

```text
High accuracy
distanceInterval = 0
~hourly time interval
```

### Ambient/off-duty

```text
Balanced accuracy
distanceInterval = 30 m
~hourly time interval
```

This distinction should be preserved and documented.

## Audit

- [ ] Backend stores the accuracy value supplied with each point.
- [ ] Manager UI can distinguish poor-quality fixes from reliable fixes.
- [ ] No dashboard presents a low-accuracy ambient point as exact.
- [ ] Reverse geocoding does not misleadingly imply exact street-level certainty when accuracy is coarse.
- [ ] Analytics do not silently transform approximate points into false precise claims.
- [ ] Shift and ambient datasets have separate purpose labels.

---

# 14. Mock / Fake GPS and Anti-Circumvention

The current tracker contains logic that drops OS-flagged mocked locations.

Verify:

- [ ] Mock-provider points are flagged/dropped consistently.
- [ ] The backend records a coverage gap rather than inventing a replacement location.
- [ ] Management UI distinguishes "no location" from "employee located at previous point."
- [ ] Anti-circumvention controls do not collect extra unrelated personal data.
- [ ] All related events are auditable.

---

# 15. Location Data Retention — Current Declared Policy

The current employee consent copy states:

- **hidden after 90 days**
- **permanently deleted after 180 days**

This is not merely UI copy; it is a production data-governance commitment.

## Backend retention audit

The developer/backend owner must verify:

- [ ] There is an actual automated retention job.
- [ ] The job runs on a documented schedule.
- [ ] "Hidden after 90 days" has a precise technical definition.
- [ ] Hidden data is no longer visible to ordinary Masters/managers after 90 days.
- [ ] Hidden data is not accidentally returned by older endpoints.
- [ ] Permanent purge runs at 180 days.
- [ ] Purge covers shift-route data.
- [ ] Purge covers ambient/off-duty data.
- [ ] Purge covers derived tables/materialized views.
- [ ] Purge covers caches.
- [ ] Purge covers search indexes.
- [ ] Purge covers analytics copies where applicable.
- [ ] Purge covers object-storage exports where applicable.
- [ ] Backup retention is separately documented.
- [ ] If backups retain data longer than the production database, the privacy policy explicitly describes the backup lifecycle as legally/operationally appropriate.
- [ ] Restore procedures do not permanently resurrect already-expired location records.
- [ ] Retention actions are logged.
- [ ] Deletion jobs are monitored and alert on failure.
- [ ] A periodic sample audit proves records older than the declared period are no longer available in active systems.

---

# 16. Location Access Control

The current consent copy says only the company **Master** can see employee location.

That statement must be technically true.

Audit:

- [ ] Backend authorization, not frontend hiding, controls access.
- [ ] Only approved roles can query individual employee location.
- [ ] Role checks exist on every location endpoint.
- [ ] Employee A cannot query Employee B's location unless explicitly authorized.
- [ ] Ordinary colleagues cannot enumerate location endpoints.
- [ ] Bulk export requires stronger authorization.
- [ ] Admin impersonation, if present, is audited.
- [ ] Every sensitive location view can be logged.
- [ ] Every sensitive location export can be logged.
- [ ] Access logs include actor, target employee, timestamp, endpoint/action, and reason/context where practical.
- [ ] Removed managers lose access immediately.
- [ ] Token claims cannot remain privileged beyond their intended expiry after role removal.

---

# 17. Privacy Policy Requirements

Create a dedicated, publicly accessible **CGPE Connect Privacy Policy** page.

It must match the application exactly.

At minimum include:

1. CGPE legal entity/contact details.
2. Application name: CGPE Connect.
3. Employee/business-app context.
4. What personal data is collected.
5. Precise and approximate location.
6. 24/7 / outside-working-hours location behavior.
7. Background collection behavior.
8. Shift route vs ambient/off-duty location.
9. Location frequency is approximate/best-effort, not a guaranteed fixed real-time interval.
10. Purpose of processing.
11. Who can access location.
12. Authentication/account information.
13. OTP delivery and provider categories.
14. Camera/photo/video/document uploads.
15. Microphone use for evidence video where applicable.
16. Calendar access where applicable.
17. Notification identifiers.
18. Device/diagnostic data if collected.
19. Data security controls.
20. Data retention.
21. Current 90-day hidden / 180-day deletion commitment if that remains the implemented policy.
22. Backup lifecycle.
23. User/employee rights and request channel.
24. Permission revocation consequences.
25. Consent withdrawal flow.
26. Third-party service providers.
27. International transfers, if any.
28. Policy version/effective date.
29. Contact for privacy questions.
30. Process for policy changes.

The policy URL must be live before store submission and remain accessible during review.

---

# 18. Google Play Data Safety

The Play Console Data Safety form must be completed from actual implementation, not guessed.

At minimum audit these data types:

- precise location;
- approximate location;
- user ID / employee ID;
- name;
- phone number;
- email;
- authentication information;
- photos;
- videos;
- uploaded documents;
- calendar information;
- app interactions;
- crash/diagnostic data;
- device identifiers;
- push-notification token;
- any analytics data;
- any support/ticket information.

For every category answer:

1. Is it collected from device?
2. Is it transmitted off-device?
3. Is it stored?
4. Is it shared with another company/service provider?
5. Is sharing only as a service provider/processor?
6. Is it required or optional?
7. What purpose applies?
8. Is data encrypted in transit?
9. Can the user request deletion?
10. Does the answer exactly match the privacy policy?

---

# 19. Google Play Background Location Declaration

For `ACCESS_BACKGROUND_LOCATION`, prepare a focused declaration.

Google currently asks developers to explain **one primary location-based feature** requiring background access.

For CGPE Connect, the submission must describe one coherent core capability, not a long list of unrelated reasons.

### Submission evidence packet

Prepare:

- clear description of CGPE Connect as an employee/business field-team application;
- description of why background location is necessary for the declared workforce-location capability;
- explanation that the employee is informed through a dedicated consent/disclosure screen;
- explanation that collection can occur outside working hours as part of the configured 24/7 business requirement;
- screenshots of the disclosure;
- privacy-policy link;
- short demonstration video;
- proof of persistent user-visible Android notification;
- explanation of the approximately hourly current sampling design.

### Video

Google recommends a short video demonstrating the feature and disclosure.

The video should show:

1. login;
2. 24/7 location disclosure;
3. consent action;
4. Android location permission sequence;
5. background/"Allow all the time" permission path;
6. visible foreground-service notification;
7. app moved to background;
8. location status still visible;
9. relevant manager/field-work outcome if safe demo data is available.

Use demo data only.

---

# 20. Google Play Foreground Service (FGS) Declaration

Because the Android application uses location foreground-service capabilities, prepare the relevant Play Console declaration.

Document:

- foreground service type: location;
- user-facing business purpose;
- why continued execution is required;
- what happens if the service is interrupted;
- how the employee is informed;
- demonstration video;
- exact notification screenshot;
- how permission and consent are obtained;
- how tracking state is represented.

The final Android manifest generated from the release build must match the declaration.

---

# 21. Android Target API and Release Compatibility

As of 31 August 2026, Google Play's annual target API requirement applies to new apps and updates.

The current Expo SDK 57 generation is aligned with Android API 36-era builds, but this must be verified from the actual release artifact.

Developer must record:

- [ ] `compileSdkVersion`
- [ ] `targetSdkVersion`
- [ ] `minSdkVersion`
- [ ] native permissions in merged manifest
- [ ] foreground service type(s)
- [ ] exported components
- [ ] signing configuration
- [ ] AAB versionCode/versionName
- [ ] 64-bit ABI support
- [ ] Play Integrity / Firebase configuration where used

Do not rely only on `app.json`; inspect the generated release bundle/manifest.

---

# 22. Apple Background Location / App Review

Apple permits background location for appropriate app functionality, but the feature must be directly relevant and transparent.

Prepare App Review notes explaining:

- CGPE Connect is an employee/business application;
- location is a core workforce-management capability;
- the application clearly discloses 24/7 behavior;
- the user gives consent;
- iOS permission is requested through the OS;
- background location is enabled;
- the app shows the iOS background location indicator where applicable;
- what the reviewer should do to test it;
- test account credentials;
- test employee data;
- expected result.

Do not hide the off-duty behavior from App Review.

---

# 23. Apple App Privacy Disclosure

In App Store Connect, complete App Privacy based on actual data handling.

Location will likely require specific declaration because it is transmitted to the CGPE backend and associated with an authenticated employee.

Audit the Apple disclosure for:

- precise location;
- coarse location if applicable;
- contact information;
- user ID;
- photos/videos;
- uploaded documents;
- diagnostics;
- device identifiers;
- any usage data;
- any third-party SDK collection.

Determine whether each data type is:

- collected;
- linked to the user;
- used for app functionality;
- used for analytics;
- used for any other declared purpose.

Do not mark advertising/tracking unless the implementation actually performs Apple's cross-app/site tracking definition.

---

# 24. Apple Sign In / Authentication

Current architecture uses CGPE's own employee authentication rather than a third-party social login as the primary account system.

Under Apple's current App Review Guideline 4.8, an additional equivalent login service is not required where:

- the app exclusively uses the company's own account setup/sign-in system; or
- the app is an enterprise/business app requiring an existing enterprise account.

Therefore the current CGPE-owned login/OTP architecture can remain the account model for submission.

## Developer audit

- [ ] No unexpected Google/Facebook/LinkedIn/social primary-login button is introduced before submission without re-auditing Guideline 4.8.
- [ ] Password verification occurs on backend.
- [ ] Passwords are not stored in plaintext.
- [ ] Mobile app does not contain database credentials.
- [ ] OTP has expiry.
- [ ] OTP has attempt limits.
- [ ] OTP request endpoint has rate limiting.
- [ ] OTP cannot be replayed.
- [ ] OTP is not logged in plaintext.
- [ ] Session/token expiry is enforced.
- [ ] Logout invalidates the correct session state.
- [ ] Shared-device user switching is tested.
- [ ] Reviewer demo account is isolated from production employee data.

---

# 25. Account Creation / Deletion Review

Determine the actual account lifecycle.

If employees cannot self-create an account and accounts are provisioned by CGPE, document that fact in App Review notes.

If the app exposes user account creation, Apple requires an in-app account-deletion mechanism.

Audit:

- [ ] Is public self-registration present?
- [ ] Is employee creation admin-only?
- [ ] Can the reviewer understand the model?
- [ ] Is there a privacy/data-request channel?
- [ ] Does account deletion conflict with legally required employment/business records?
- [ ] Are retained legal records distinguished from app-access termination?

---

# 26. OTP Channel Verification

Confirm the real production OTP channel:

- SMS;
- WhatsApp;
- email;
- or a combination.

The login screen, privacy policy, store metadata, and support material must match actual delivery.

Audit provider security:

- API credentials server-side only;
- provider webhooks authenticated;
- template content does not expose sensitive information;
- OTP logs sanitized;
- provider retention understood;
- rate limiting enforced.

---

# 27. Push Notifications

The app contains Expo Notifications / Firebase configuration.

Verify Android:

- FCM project/package match;
- notification channel;
- Android 13+ notification permission behavior;
- foreground/background/terminated delivery;
- token rotation;
- logout token cleanup;
- no cross-user push leakage on shared device.

Verify iOS:

- APNs key/certificate configuration;
- correct bundle identifier;
- push capability/provisioning;
- foreground/background behavior;
- token refresh;
- production APNs environment.

Push-notification consent must not be confused with the always-visible Android location foreground-service notification.

---

# 28. Camera, Photos, Video and Microphone

Current purpose text indicates:

- camera: claim/KYC documents and claim evidence;
- photos/videos: attaching claim documents/evidence;
- microphone: audio with claim evidence video.

Audit:

- [ ] Permission requested contextually.
- [ ] Feature works when permission is denied.
- [ ] Uploaded files have size limits.
- [ ] MIME/type validation occurs on server.
- [ ] Malware/content validation is considered for documents.
- [ ] EXIF/location metadata handling is understood.
- [ ] Sensitive claim/KYC media has authorization controls.
- [ ] Storage URLs are not permanently public.
- [ ] Signed URL expiry is used where appropriate.
- [ ] File deletion/retention is documented.
- [ ] Privacy policy includes these categories.

---

# 29. Calendar Permissions

Current app declares Android calendar read/write capability and an Expo calendar permission purpose.

Audit:

- [ ] Exact features requiring calendar access are documented.
- [ ] Read access and write access are mapped to real flows.
- [ ] Calendar permission denial does not crash unrelated app screens.
- [ ] No unnecessary full-calendar data is uploaded to the backend.
- [ ] User is told what event/task will be created.
- [ ] Duplicate calendar events are prevented.
- [ ] Event deletion/update behavior is tested.

---

# 30. Face ID / Biometrics

Current app uses local authentication for secure unlock.

Audit:

- [ ] Biometrics are only a local unlock/authentication convenience.
- [ ] No raw biometric data is collected.
- [ ] App falls back safely when Face ID/Touch ID is unavailable.
- [ ] Biometric enrollment changes are handled.
- [ ] Logout clears any locally persisted unlock state that should not survive user changes.
- [ ] Privacy policy does not falsely claim the app receives fingerprint/face templates.

---

# 31. Hosting / Production Infrastructure

The mobile frontend itself is distributed by Apple/Google.

Production infrastructure still required:

## Backend

- HTTPS API;
- authentication;
- employee/user service;
- attendance service;
- location ingestion;
- ambient-location ingestion;
- manager location read APIs;
- consent state API;
- push notification integration;
- OTP integration;
- claim/document APIs;
- task/calendar-related backend functionality as applicable.

## Data

- production database;
- encrypted backups;
- retention/purge automation;
- audit logs;
- access control.

## Media

- secure object/file storage;
- signed access URLs;
- lifecycle policies.

## Public web endpoints

- privacy policy;
- support/contact;
- optional account/data-request page.

## Observability

- backend logs;
- crash reporting;
- uptime monitoring;
- location-ingestion error monitoring;
- retention-job monitoring;
- notification-delivery monitoring.

---

# 32. Mobile Security Audit

Before store submission:

- [ ] No production database credentials in app bundle.
- [ ] No JWT signing secret in app.
- [ ] No OTP-provider secret in app.
- [ ] No cloud service-account private key in app.
- [ ] No privileged API key embedded in JS bundle.
- [ ] No `.env` production secrets committed.
- [ ] Repository secret scan completed.
- [ ] Release AAB/IPA strings scan completed.
- [ ] HTTPS only for production.
- [ ] TLS certificate is valid.
- [ ] Server-side authorization exists on every private endpoint.
- [ ] IDOR tests completed.
- [ ] Rate limiting exists on authentication/OTP.
- [ ] Upload validation exists.
- [ ] Location endpoints enforce user/session identity.
- [ ] Admin/Master endpoints enforce role authorization.
- [ ] Sensitive logs are redacted.
- [ ] Tokens are not written to analytics/crash reports.
- [ ] Secure local storage is used for tokens.
- [ ] Token refresh/expiry is tested.
- [ ] Rooted/jailbroken device behavior is understood where relevant.
- [ ] Dependency audit completed.
- [ ] Known critical/high vulnerabilities are reviewed before release.

---

# 33. Employee Location Security

Because 24/7 location is highly sensitive, additionally verify:

- encryption in transit;
- database encryption at rest where supported;
- least-privilege database accounts;
- no unauthenticated map endpoints;
- no public location URLs;
- manager access audit;
- admin access audit;
- export audit;
- bulk endpoint throttling;
- employee ID and location joins are access-controlled;
- retention rules are enforced at source, not only UI;
- test/staging location data is separated from production;
- support staff cannot casually query raw coordinates without authorization.

---

# 34. Store Reviewer Account / Demo Environment

Apple requires full review access for account-based applications.

Prepare a dedicated reviewer/demo employee.

Requirements:

- active account;
- no real employee data;
- test organization/team;
- test attendance session;
- demo location history if required;
- test claim/document content;
- test calendar/tasks;
- reviewer can reach all relevant screens;
- no OTP dependency that prevents reviewer access unless exact reviewer instructions are supplied;
- backend remains online for the entire review period.

Store notes must include step-by-step login and test instructions.

---

# 35. Review Notes — Required Transparency

Prepare a concise but explicit reviewer note.

It should explain:

1. CGPE Connect is a workforce/employee business app.
2. Employees authenticate using a CGPE account.
3. The app has a mandatory 24/7 location-sharing requirement for the configured workforce use case.
4. The dedicated disclosure screen explicitly says location can be collected outside working hours.
5. The employee gives consent before the feature is armed.
6. Android uses an ongoing foreground-service notification.
7. iOS uses platform background-location behavior/indicator.
8. Current location sampling is approximately hourly/best-effort.
9. Shift and off-duty data are separated.
10. Location access is limited to authorized CGPE role(s).
11. Current retention commitment is 90-day hidden / 180-day permanent deletion, provided backend implementation confirms it.
12. Reviewer credentials.
13. Exact steps to exercise the feature.

---

# 36. App Store / Play Store Screenshots and Metadata

Prepare production assets:

## Apple

- app icon;
- required iPhone screenshots;
- iPad screenshots if `supportsTablet: true` is retained in the release;
- app description;
- keywords;
- support URL;
- privacy URL;
- review notes;
- age rating;
- App Privacy;
- category.

## Google Play

- app icon;
- phone screenshots;
- feature graphic;
- short description;
- full description;
- privacy-policy URL;
- support/contact details;
- Data Safety;
- Background Location declaration;
- FGS declaration;
- content rating;
- target audience;
- app access/reviewer credentials.

Metadata must describe the app honestly and must not hide the employee-location function.

---

# 37. iPad Support Audit

Current configuration includes:

```json
"supportsTablet": true
```

Therefore test iPad layouts if the final iOS release continues to advertise tablet compatibility.

Audit:

- login;
- consent;
- home/dashboard;
- maps;
- attendance;
- claims;
- task/calendar;
- settings;
- rotation behavior if applicable;
- modal widths;
- split view/multitasking if supported.

The App Store listing should not unintentionally represent a broken iPad experience.

---

# 38. Release Build / EAS

Current `eas.json` includes:

- development profile;
- preview/internal profile;
- iOS simulator profile;
- production profile with auto-increment;
- production submit profile.

Recommended release procedure:

```bash
npm ci
npm test
npm run lint

eas build --platform android --profile production
eas build --platform ios --profile production
```

Before submission:

- install/test Android release build;
- test iOS through TestFlight;
- validate native permission manifests;
- validate production API endpoints;
- validate production push environment;
- validate version/build numbers;
- archive release evidence.

Submission can then use EAS Submit or direct console upload according to the release owner's workflow.

---

# 39. Real-Device QA Matrix

Minimum location test matrix:

## Android

- Google Pixel / current Android 16/API-36-era device;
- Samsung;
- Xiaomi/Redmi;
- OnePlus;
- Oppo/Realme or Vivo where employee population uses them.

For each:

1. Fresh install.
2. Login.
3. Consent screen.
4. Decline path.
5. Agree path.
6. Foreground location permission.
7. Background/"Allow all the time" permission.
8. Notification permission.
9. Battery optimization flow.
10. App backgrounded.
11. Screen locked.
12. One-hour sample.
13. 6-hour background run.
14. 12-hour background run.
15. 24-hour background run.
16. Network off.
17. Network restored.
18. Reboot.
19. App swipe-away.
20. Process killed.
21. Permission revoked.
22. Permission restored.
23. Clock-in boundary.
24. Clock-out boundary.
25. Logout.
26. Different employee login.
27. Verify no cross-user buffered points.
28. Verify backend map.
29. Verify retention metadata.
30. Measure battery usage.

## iOS

- fresh install;
- login;
- consent;
- location permission transitions;
- Always authorization path;
- background indicator;
- screen lock;
- app background;
- low-power mode;
- 6/12/24-hour tests;
- network loss/recovery;
- app termination/relaunch;
- permission downgrade;
- reviewer-style workflow.

---

# 40. Observability Required Before Launch

Create production monitoring for:

### Location client metrics

- last successful point timestamp;
- last attempted point timestamp;
- accuracy;
- source: OS stream vs watchdog forced fix;
- current mode: shift vs ambient;
- current permission state;
- last upload result;
- local buffer size;
- background task running status where measurable.

### Backend metrics

- points received/minute;
- active tracked employees;
- ambient points vs shift points;
- rejected points;
- 401/403/429 rates;
- location upload latency;
- stale employee threshold;
- consent mismatch;
- retention job success/failure;
- purge counts;
- manager location-read volume;
- unusual bulk access.

Do not put raw sensitive coordinates into general-purpose application logs unless the log system is explicitly designed and authorized for that data.

---

# 41. Store-Submission Evidence Folder

Create a release evidence folder for each submitted version.

Example:

```text
store-release/
  1.10.0/
    android/
      merged-manifest.txt
      permissions.txt
      fgs-declaration.md
      background-location-declaration.md
      disclosure-screenshots/
      review-video.mp4
      device-tests.md
      battery-tests.md
    ios/
      entitlements.txt
      info-plist-location-copy.txt
      review-notes.md
      privacy-declaration.md
      testflight-build.txt
      device-tests.md
    privacy/
      privacy-policy-version.md
      consent-copy-v01.md
      retention-proof.md
      data-map.md
    security/
      secrets-scan.md
      dependency-audit.md
      authorization-tests.md
```

The purpose is to make every store answer reproducible.

---

# 42. Estimated Release Work Plan

Assuming the backend already exists and developer accounts are available:

| Phase | Work |
|---|---|
| 1 | Freeze release candidate and inventory current behavior |
| 2 | Validate 24/7 shift/ambient location and hourly cadence |
| 3 | Fix boundary attribution correctness and regression-test it |
| 4 | Verify consent, notification, permission, battery and watchdog flows |
| 5 | Verify 90/180-day backend retention |
| 6 | Complete privacy/data map |
| 7 | Security audit |
| 8 | Android real-device QA |
| 9 | iOS real-device QA |
| 10 | Store metadata/declarations/videos |
| 11 | Internal/TestFlight release |
| 12 | Production submission and review response |

A practical engineering target is roughly **1–2 focused working weeks** when accounts and backend are ready, with additional calendar time allowed for store review, organization verification, rejection/review questions, and resubmission.

---

# 43. 24/7 Feature — Store-Defensibility Checklist

Because this is the most sensitive capability, do not submit until all items are evidenced.

- [ ] 24/7 behavior is explicitly disclosed.
- [ ] Outside-working-hours collection is explicitly disclosed.
- [ ] Background collection is explicitly disclosed.
- [ ] Employee consent is recorded server-side.
- [ ] Consent notice is versioned.
- [ ] Location permission state is checked.
- [ ] Android foreground-service notification remains visible.
- [ ] iOS background indicator is enabled/tested.
- [ ] Current frequency is approximately hourly/best-effort.
- [ ] Shift accuracy and ambient accuracy are distinct.
- [ ] Ambient mode is approximately Balanced accuracy.
- [ ] Ambient mode uses 30 m distance gating.
- [ ] Shift mode uses High accuracy.
- [ ] Clock-in/out attribution is timestamp-correct.
- [ ] Location access is role-controlled.
- [ ] "Only Master can see it" is technically enforced if that statement remains in user copy.
- [ ] 90-day hidden policy exists in backend.
- [ ] 180-day permanent deletion exists in backend.
- [ ] Backup retention is documented.
- [ ] Permission revocation is detected.
- [ ] Withdrawal is reflected on backend.
- [ ] Master notification of withdrawal is auditable.
- [ ] Logout/shared-device handling is safe.
- [ ] Watchdog cannot re-arm an unauthorized recorder.
- [ ] Reboot behavior is tested.
- [ ] OEM battery behavior is measured.
- [ ] Public privacy policy exactly matches runtime behavior.
- [ ] Google Data Safety exactly matches runtime behavior.
- [ ] Google Background Location declaration exactly matches runtime behavior.
- [ ] Google FGS declaration exactly matches runtime behavior.
- [ ] Apple App Privacy exactly matches runtime behavior.
- [ ] Apple reviewer notes explicitly describe 24/7 location.
- [ ] Reviewer demo account works.
- [ ] Review video demonstrates the disclosure and visible notification.
- [ ] No hidden/dormant location feature exists outside the disclosed model.
- [ ] No ad/analytics use of location exists unless separately declared.
- [ ] Production logs do not unnecessarily expose raw coordinates.
- [ ] Access audit logs exist for sensitive location reads/exports.
- [ ] Retention purge failures alert operations.
- [ ] Real-device 24-hour test passes.
- [ ] Battery measurement is recorded.
- [ ] Network-offline/recovery test passes.
- [ ] Permission-revocation/recovery test passes.
- [ ] Cross-user/shared-device test passes.

---

# 44. Master Developer Release Checklist

This section is the final execution checklist. A store submission should not be marked release-ready until every applicable line has evidence.

## 44.1 Product and repository

- [ ] Confirm release branch/commit SHA.
- [ ] Confirm app version/build number.
- [ ] Confirm `com.cgpe.connect` Android package.
- [ ] Confirm `com.cgpe.connect` iOS bundle ID.
- [ ] Confirm Expo SDK / React Native versions.
- [ ] Confirm production EAS build succeeds.
- [ ] Confirm Android AAB installs through test track.
- [ ] Confirm iOS TestFlight build installs.

## 44.2 Permissions

- [ ] Export final Android merged manifest.
- [ ] Export final iOS Info.plist/entitlements.
- [ ] Map every permission to a feature.
- [ ] Verify location foreground permission flow.
- [ ] Verify background permission flow.
- [ ] Verify FGS location type.
- [ ] Verify notification permission.
- [ ] Verify battery-optimization flow.
- [ ] Verify calendar permissions.
- [ ] Verify camera/photo/mic permissions.
- [ ] Verify Face ID/biometric configuration.

## 44.3 24/7 location

- [ ] Confirm hourly constant is `3,600,000 ms`.
- [ ] Confirm shift profile High accuracy.
- [ ] Confirm shift `distanceInterval = 0`.
- [ ] Confirm ambient Balanced accuracy.
- [ ] Confirm ambient `distanceInterval = 30`.
- [ ] Confirm watchdog configuration.
- [ ] Confirm 45–60 minute practical backstop behavior.
- [ ] Confirm Android notification.
- [ ] Confirm iOS indicator.
- [ ] Confirm reboot recovery.
- [ ] Confirm offline buffer.
- [ ] Confirm mock-location handling.
- [ ] Confirm consent state.
- [ ] Confirm consent withdrawal handling.
- [ ] Confirm clock-in/out timestamp split.
- [ ] Confirm no cross-user point leakage.

## 44.4 Retention and privacy

- [ ] Confirm 90-day hide implementation.
- [ ] Confirm 180-day purge implementation.
- [ ] Confirm derived-copy purge.
- [ ] Confirm backup lifecycle.
- [ ] Confirm manager access controls.
- [ ] Confirm access audit logs.
- [ ] Publish privacy policy.
- [ ] Add privacy-policy link inside app.
- [ ] Complete data inventory.
- [ ] Complete Google Data Safety.
- [ ] Complete Apple App Privacy.

## 44.5 Authentication

- [ ] Confirm own-company account architecture.
- [ ] Confirm password hashes server-side.
- [ ] Confirm no DB credentials in app.
- [ ] Confirm OTP channel.
- [ ] Confirm OTP expiry.
- [ ] Confirm OTP rate limits.
- [ ] Confirm session expiry.
- [ ] Confirm reviewer demo login.
- [ ] Confirm no Apple login requirement is introduced by adding third-party social login before submission.

## 44.6 Notifications

- [ ] Android push works.
- [ ] iOS push works.
- [ ] FCM/APNs production credentials correct.
- [ ] Token rotation tested.
- [ ] Logout push token handling tested.
- [ ] Location FGS notification is independent from marketing/task push notifications.

## 44.7 Security

- [ ] Secret scan.
- [ ] Dependency audit.
- [ ] Authorization/IDOR test.
- [ ] Upload validation.
- [ ] TLS verification.
- [ ] Log redaction.
- [ ] Sensitive map endpoint test.
- [ ] Master/admin role test.
- [ ] Shared-device test.
- [ ] Release-binary string/secret scan.

## 44.8 Store evidence

- [ ] Privacy URL live.
- [ ] Support URL live.
- [ ] App screenshots final.
- [ ] Google background-location video final.
- [ ] Google FGS declaration final.
- [ ] Google background-location declaration final.
- [ ] Apple review notes final.
- [ ] Apple demo account final.
- [ ] Metadata does not hide 24/7 location behavior.
- [ ] Organization/developer account information verified.

## 44.9 QA

- [ ] 24h Android test.
- [ ] 24h iOS test.
- [ ] Battery test.
- [ ] Offline test.
- [ ] Reboot test.
- [ ] App-kill test.
- [ ] Permission-revoke test.
- [ ] Clock-in/out boundary test.
- [ ] Retention-job test.
- [ ] Crash-free release smoke test.

## 44.10 Go / No-Go record

Before submission, produce a final record:

```text
CGPE CONNECT RELEASE READINESS

Release commit:
App version:
Android versionCode:
iOS build:

24/7 LOCATION:
PASS / FAIL

HOURLY SAMPLING VERIFIED:
PASS / FAIL

ANDROID BACKGROUND LOCATION:
PASS / FAIL

ANDROID FGS:
PASS / FAIL

IOS BACKGROUND LOCATION:
PASS / FAIL

VISIBLE LOCATION INDICATOR:
PASS / FAIL

CONSENT:
PASS / FAIL

90-DAY HIDE:
PASS / FAIL

180-DAY DELETE:
PASS / FAIL

AUTH:
PASS / FAIL

OTP:
PASS / FAIL

PUSH:
PASS / FAIL

DATA SAFETY:
PASS / FAIL

APPLE APP PRIVACY:
PASS / FAIL

SECURITY AUDIT:
PASS / FAIL

ANDROID REAL-DEVICE QA:
PASS / FAIL

IOS REAL-DEVICE QA:
PASS / FAIL

STORE EVIDENCE PACK:
PASS / FAIL

READY TO SUBMIT:
YES / NO
```

---

# 45. Suggested Google Play Reviewer Narrative

The store-submission owner may adapt this only after confirming it exactly matches production:

> CGPE Connect is a business application used by CGPE employees and authorized field-team members. Location sharing is a core workforce-management function. Before location tracking is enabled, the user is shown a dedicated disclosure explaining that precise location and movement/activity can be shared 24 hours a day, including outside normal working hours, and the user records consent. The application currently samples location approximately hourly on a best-effort basis. During an active shift, location is used for shift/field-route records; outside an active shift, the application uses a separate ambient/off-duty mode with a coarser location profile. On Android, an ongoing notification remains visible while the foreground location service is active. Access to employee location is restricted to authorized company roles. The application's privacy policy explains the collection, purpose, access, and retention model.

Do not submit this text unless the final release has been verified against every statement.

---

# 46. Suggested Apple App Review Narrative

The store-submission owner may adapt this only after confirming it exactly matches production:

> CGPE Connect is an employee/business application for CGPE field-team operations. Users sign in with an existing CGPE account. The application has a disclosed 24/7 location-sharing workflow. Before the workflow is enabled, users see a dedicated notice explaining that location can be collected in the background and outside working hours, the purpose of collection, who can view it, and the retention period, and the user's consent is recorded. The application uses iOS background location capabilities for this workforce feature and enables the system background-location indicator. Current location sampling is approximately hourly on a best-effort basis. A review account and test instructions are provided below.

Again, the final notes must reflect the exact binary submitted.

---

# 47. Important Current-Code Facts the Developer Must Not Miss

1. `HOURLY_MS = 3600000`.
2. Hourly cadence applies to shift and ambient profiles.
3. Shift profile remains High accuracy.
4. Ambient profile remains Balanced accuracy.
5. Ambient profile uses 30 m distance gating.
6. Watchdog may cause practical points around the 45–60 minute range.
7. OS execution is best-effort; no exact one-hour SLA should be claimed.
8. 24/7 ambient state is persisted.
9. Consent is server-recorded before normal progression.
10. Consent notice version is `v.01`.
11. Consent text explicitly says location can be shared outside working hours.
12. Consent text promises an always-visible phone status-bar notice while location is shared.
13. Consent text says only the company Master can see location.
14. Consent text states 90-day hidden / 180-day permanent deletion.
15. Permission revocation can be treated as withdrawal and reported to the backend.
16. Android foreground service currently uses a neutral ambient notification.
17. The same recorder can transition between ambient and shift attribution.
18. Hourly batching creates a larger boundary-attribution risk than the older 60-second model.
19. The current offline point cap is 720.
20. Mocked locations are filtered by anti-circumvention logic.

---

# 48. Official Policy / Documentation References

These references were checked for this document on 29 August 2026.

## Google Play

- Background Location / Understanding location in the background permissions:  
  https://support.google.com/googleplay/android-developer/answer/9799150

- Permissions and APIs that Access Sensitive Information / Location Permissions:  
  https://support.google.com/googleplay/android-developer/answer/16558241

- Foreground Services / Device and Network Abuse:  
  https://support.google.com/googleplay/android-developer/answer/16559646

- Understanding Foreground Service requirements:  
  https://support.google.com/googleplay/android-developer/answer/13392821

- Play policy deadlines:  
  https://support.google.com/googleplay/android-developer/table/12921780

- Publish private apps / Managed Google Play:  
  https://support.google.com/googleplay/android-developer/answer/9874937

## Apple

- App Review Guidelines:  
  https://developer.apple.com/app-store/review/guidelines/

- Core Location — Handling location updates in the background:  
  https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background

- Apple Business distribution:  
  https://developer.apple.com/business/

- App Store Connect — Set distribution methods:  
  https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/set-distribution-methods

- Apple Developer Enterprise Program:  
  https://developer.apple.com/programs/enterprise/

## Repository evidence

- Repository root:  
  https://github.com/AazikoGlobalLLP/cgpe-android

- `app.json`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/app.json

- `eas.json`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/eas.json

- `package.json`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/package.json

- `src/lib/tracker.ts`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/src/lib/tracker.ts

- `src/lib/motion.ts`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/src/lib/motion.ts

- `src/app/consent.tsx`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/src/app/consent.tsx

- `src/i18n/index.tsx`:  
  https://github.com/AazikoGlobalLLP/cgpe-android/blob/Shivam/src/i18n/index.tsx

---

# 49. Final Developer Direction

The objective is **not** to redesign CGPE Connect's business requirement.

The objective is to make the existing application:

- technically reliable;
- privacy-consistent;
- security-hardened;
- transparently disclosed;
- accurately documented;
- verifiable by store reviewers;
- correct at shift/ambient boundaries;
- aligned with the current approximately hourly location cadence;
- auditable from consent through retention/deletion;
- ready for Apple App Store and Google Play submission.

The 24/7 employee-location capability is a fixed requirement for this release program.

Any proposal to remove or disable that capability, or to remove existing permissions, is outside the scope of this document and requires separate owner approval.

---

# Verification Errata (2026-08-29)

This document was written "from the last push." Every factual claim above was re-verified against the actual
code by an 8-agent read-only audit (each finding cited to file:line). The core technical claims are accurate;
the corrections below are the deltas found. **This section is authoritative where it disagrees with the body.**

### Corrections

1. **§1 Android permission baseline understates the real total.** `app.json` declares 10 permissions, but the
   generated/merged AndroidManifest carries **~20**: config plugins and native modules inject **CAMERA**,
   **RECORD_AUDIO** (because `microphonePermission` is set on expo-image-picker), **READ/WRITE_EXTERNAL_STORAGE**
   (`maxSdkVersion=32`), **INTERNET**, **ACCESS_NETWORK_STATE**, **VIBRATE**, **ACTIVITY_RECOGNITION**
   (expo-sensors — the accelerometer motion classifier that drives adaptive GPS sampling), **USE_BIOMETRIC**,
   **USE_FINGERPRINT**, plus (via FCM) very likely **WAKE_LOCK** and `com.google.android.c2dm.permission.RECEIVE`.
   Google Play Data Safety and the sensitive-permission review must account for all of these, not just the 10.

2. **§1 iOS Info.plist emits extra generic strings.** Beyond the app-specific purpose strings, the config plugins
   auto-fill boilerplate `NSLocationAlwaysUsageDescription`, **`NSMotionUsageDescription`**
   ("Allow CGPE Connect to detect your current motion activity"), and `NSRemindersUsageDescription` /
   `NSRemindersFullAccessUsageDescription`. `NSMotionUsageDescription` is generated even though no user-facing
   motion feature is disclosed — Apple review may query it. Give the motion/reminders strings accurate copy (or
   suppress them) before iOS submission.

3. **§1 App version is inconsistent three ways.** `app.json` = `1.10.0` (authoritative for the store build),
   `package.json` = `1.8.0` (stale), and `src/constants/config.ts` `APP.version` = `1.8.0` (the string the in-app
   About screen shows). *[Fixed 2026-08-29 — all aligned to 1.10.0.]* Also: `eas.json` sets
   `appVersionSource:"remote"`, so the Android `versionCode` / iOS `buildNumber` live on EAS servers (with
   `production.autoIncrement:true`), **not** in `app.json`.

4. **§5 / §15 retention is already IMPLEMENTED backend-side.** `cgpe-backend-main/services/locationRetention.js`
   soft-deletes `location_tracks` at **90 days** and hard-deletes at **180 days** on a 6h tick, wired at
   `server.js:204`, with reads excluding soft-deleted rows, and it is covered by tests (`auth.phase45.test.js`).
   The audit task is therefore "**confirm it is deployed on prod `origin/main` and the scheduler is running**,"
   not "verify it exists."

5. **§17 privacy links are already WIRED in-app.** `src/app/account.tsx` renders a tappable privacy-policy link
   (`https://cgpe.in/privacy`), a delete-account link (`cgpe.in/delete-account`), a DPDP protection banner, and a
   mandatory, fully-localized consent screen. The open item is **whether the public pages actually resolve**, not
   building the link.

6. **§26 OTP channel is email + WhatsApp, NOT SMS.** The backend picks by identifier: an `@` identifier → **email**
   (mailed code); otherwise → **WhatsApp** (via `waService`, which rides an n8n webhook that may be unconfigured in
   a given environment). There is no SMS/Twilio path anywhere. Login screen, privacy policy, and store support copy
   must say email/WhatsApp.

7. **§8 the "notification shows shift text while ambient is active" concern is a REAL open item.** If a member
   clocks in while NOT 24/7-armed (shift notification shows), then arms 24/7 mid-shift, then clocks out, the
   ongoing ambient session keeps displaying "Recording your field route / Clock out to stop" until a genuine
   service restart — the running service is never reconfigured by design. Edge-case (consent is normally armed at
   first boot, before clock-in, so the notification is neutral throughout), but it should be fixed for transparency.
   Separately: the foreground-service notification does **not** set an explicit Android `notificationChannelId`
   (it uses expo-location's internal default channel); the app-defined `default` channel is push-only.

8. **§6 consent record — what is actually sent.** The consent POST body carries only `granted` and `version`
   (`v.01`). The employee id (server-derived from the token) and timestamp (server `decided_at`) are correctly
   NOT client-sent. However, the **language/copy variant** the user actually read (en/gu/hi/hi-en/gu-en) is **not
   recorded at all**, and the withdrawal POST omits the notice version. Recording the language needs a
   backend-defined field on `POST /time-tracker/consent` (an app-only guess would be a dropped key) — file it as a
   contract item rather than inventing a field name.

9. **§38 `eas.json submit.production` is empty (`{}`).** No Google Play `serviceAccountKeyPath` and no Apple
   `ascApiKey`/`appleId`/`appleTeamId` are configured, so `eas submit` cannot upload non-interactively — store
   upload is manual/credential-prompt until the owner supplies keys.

10. **§41 the `docs/store-release/` evidence folder does not yet exist.** Created 2026-08-29 as
    `docs/store-release/1.10.0/` — see it for the merged-manifest permission map, data map, retention proof, and
    the Data Safety / declaration drafts built from this verification.

### Confirmed correct (not corrections — noted so they are not re-audited)

- All Section-47 "current-code facts" hold verbatim: `HOURLY_MS = 3600000`; all three profiles hourly; shift =
  High + `distanceInterval 0`; ambient = Balanced + `distanceInterval 30`; watchdog ~15 min; `STALE_AFTER_MS`
  45 min; `MAX_POINTS = 720`; mock-drop; consent `v.01` and its 10 disclosure sub-claims present verbatim;
  server-recorded consent that never fabricates a local "consented" state; separate shift/ambient endpoints.
- Notification copy (§8), iOS indicator flags (§9), `supportsTablet:true` (so §37 iPad QA genuinely applies),
  battery-opt-once (§10), watchdog idempotency/reboot/consent-gate (§11), buffer reset on logout/401/user-switch
  (§12), real-super_admin-only location access (§16), no secrets in the bundle + HTTPS-only production (§32),
  first-party-only auth (§24), local-unlock-only biometrics (§30) — all verified true.

### The one real code fix taken from this audit

**Section 5 (clock-in boundary attribution) is implemented** (2026-08-29): a new pure, tested seam
`src/lib/boundaryAttribution.ts` splits a flushed batch at the clock-in instant so a 24/7-armed member's
pre-clock-in off-duty points route to the ambient dataset, not the shift. It is a no-op for non-24/7 users and
defaults to pre-audit behaviour when the boundary is unknown. `tracker.ts` is device-only, so this wiring must be
walked on a handset during Phase 8 QA before it ships in an APK. The reverse clock-out spill is documented residual.
