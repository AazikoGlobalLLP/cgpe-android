# Data map — CGPE Connect 1.10.0

The single source of truth for Google Play **Data Safety** and Apple **App Privacy**. Built from the verified
code. All backend traffic is **HTTPS-only** to `cgpe.in` (`src/constants/config.ts` `PROD_API`), so every
transmitted type is **encrypted in transit**. The app performs **no advertising and no cross-app/site tracking**
(no ad SDK, empty `oauth_client`), so nothing is declared under Apple "Tracking".

| Data type | Collected from device | Sent off-device | Stored server | Shared (processor) | Req/Opt | Purpose | User-linked | Deletable |
|---|---|---|---|---|---|---|---|---|
| **Precise location** (shift, High acc.) | Yes (background) | Yes → `/track/points` | Yes | — | Required | Workforce field-route | Yes | 90d hidden / 180d deleted |
| **Approximate location** (ambient, Balanced) | Yes (background) | Yes → `/track/ambient` | Yes | — | Required (consented) | 24/7 off-duty workforce mgmt | Yes | 90d hidden / 180d deleted |
| **Name** | Yes | Yes | Yes | — | Required | Account/app function | Yes | Account deletion |
| **Phone number** | Yes | Yes | Yes | WhatsApp (OTP, phone id) | Required | Auth / OTP | Yes | Account deletion |
| **Email** | Yes | Yes | Yes | Email provider (OTP, `@` id) | Required | Auth / OTP | Yes | Account deletion |
| **User / employee ID** | Derived | Yes (token) | Yes | — | Required | Account function | Yes | Account deletion |
| **Auth info** (password, OTP) | Yes | Yes (verified server-side; hash stored) | Yes (hash) | — | Required | Auth | Yes | Account deletion |
| **Photos / videos** | Yes (camera/gallery) | Yes (upload) | Yes (object storage) | — | Optional | Claim/KYC docs + evidence | Yes | File/record deletion |
| **Documents** | Yes (picker) | Yes (upload) | Yes | — | Optional | Claim/KYC attachments | Yes | File/record deletion |
| **Calendar** | Yes (read/write local) | **No** (local device calendar only) | No | — | Optional | Add tasks/reminders to phone calendar | n/a | Cleared on sign-out |
| **Push token** | Yes | Yes → `/push/register` | Yes | Expo + Firebase FCM (delivery) | Optional | Notifications | Yes | Cleared on logout (`/push/unregister`) |
| **App interactions / diagnostics** | Minimal | Minimal | — | — | Optional | App function | Partial | n/a |
| **Device identifiers** | Push token only | Yes | Yes | Expo/FCM | Optional | Notifications | Yes | Logout |

## Access control (must be technically true — it is)

- Employee location coordinates are viewable **only by the company Master** (real `super_admin`), enforced at both
  the fetch and render layers (`store/roles.ts` `canSeeLiveLocation`/`canMonitorTeam`; `agent-map`/`agent-track`
  screens block non-masters). Admin and leader tiers are folded out of this gate on purpose. The backend 403 on
  the location endpoints is the real authority; the app gate is defence-in-depth.

## Service providers / sub-processors to declare

- **Expo (push)** and **Firebase Cloud Messaging** — push-notification delivery (token + message).
- **Email provider** — OTP email delivery (`@` identifiers).
- **WhatsApp (via backend `waService`/n8n)** — OTP delivery (phone identifiers).
- Hosting/object storage for uploads — CGPE backend infrastructure.

## Retention

Location history is **hidden after 90 days** and **permanently deleted after 180 days** — implemented backend-side
(`services/locationRetention.js`); see `retention-proof.md`. Push token cleared on logout. Calendar events cleared
on sign-out. Account deletion available in-app (`cgpe.in/delete-account`) + a data-request channel.
