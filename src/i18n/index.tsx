import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { storage } from '@/lib/storage';

/* ------------------------------------------------------------------ *
 * Language support.
 *
 * FIVE LANGUAGES, THREE SCRIPTS. English, Gujarati and Hindi are written in their own
 * script. Hinglish and Roman Gujarati are the SAME two regional languages written in the
 * English alphabet, and they exist because a large share of advisors in Gujarat speak
 * Gujarati or Hindi fluently but read the Roman alphabet far faster than they read
 * Devanagari or the Gujarati abugida — they type that way on WhatsApp all day.
 *
 * THEY ARE NOT THE SAME DICTIONARY TWICE. Hinglish is Hindi vocabulary ("Aaj ke kaam",
 * "Nayi lead", "ka / ki / ke", "bhejein"); Roman Gujarati is Gujarati vocabulary
 * ("Aaj na kaam", "Navi lead", "nu / ni / na", "moklo"). A native reader spots a
 * copy-pasted line instantly, so every string below is written in its own language.
 *
 * TRADE VOCABULARY STAYS IN ENGLISH. Nobody in this business says "prabhaar jama karein";
 * they say "Premium bharo". policy, premium, claim, lead, WhatsApp, KYC, renewal,
 * maturity, target, commission and report are left in English inside the romanized
 * strings, because translating them to Sanskritised Hindi or literary Gujarati would read
 * as absurd and, worse, as unfamiliar.
 *
 * t(key) falls back to English and then to the key itself, so an untranslated string can
 * never render as blank space.
 *
 * t(key, params) adds two things, and ONLY these two — see `translate` at the foot of the
 * file. (1) Named interpolation: `t('x', { name: 'Asha' })` fills every `{name}` in the
 * resolved string. A placeholder with no matching param is left verbatim (`{name}`), so a
 * missing value is visible in testing rather than silently dropped. (2) Count-aware plurals:
 * when `params.count` is a number, `t('x', { count })` prefers `x_one` / `x_other`, chosen by
 * the CLDR cardinal rule for the ACTIVE language (English: only 1 is `one`; Hindi & Gujarati:
 * 0 and 1 are both `one`), and falls back to the base key `x` when neither variant exists.
 * There is NO string concatenation anywhere — Hindi/Gujarati word order differs from English,
 * so a dynamic string is one template with placeholders, never glued-together fragments.
 * ------------------------------------------------------------------ */

export type Lang = 'en' | 'gu' | 'hi' | 'hi-en' | 'gu-en';

/**
 * The Settings screen maps over this. English first, then the two script languages, then
 * the romanized pair — a reader scanning for their language finds it under its own name
 * in `native`, which is the only field they are guaranteed to be able to read.
 */
export const LANGS: { code: Lang; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
  { code: 'hi-en', label: 'Hinglish', native: 'Hinglish' },
  { code: 'gu-en', label: 'Roman Gujarati', native: 'Gujarati (Roman)' },
];

/** The app default. Deliberately NOT device-locale detected: a shared handset set to
 *  hi-IN must not silently put a new advisor into a script they may not read. */
const DEFAULT_LANG: Lang = 'en';

// English is the source of truth. Left unannotated on purpose so its keys infer as string
// literals — every other dictionary is typed against them, so a missing or misspelled key
// in any translation is a compile error rather than a blank label at runtime.
const en = {
  'tab.home': 'Today', 'tab.tasks': 'Tasks', 'tab.leads': 'Leads', 'tab.clients': 'Clients', 'tab.claims': 'Claims', 'tab.search': 'Search', 'tab.more': 'More',
  'tasks.title': 'My Tasks', 'tasks.today': 'Today', 'tasks.overdue': 'Overdue', 'tasks.inProgress': 'In progress',
  'tasks.upcoming': 'Upcoming', 'tasks.doneLabel': 'Done', 'tasks.dueNow': 'due now', 'tasks.add': 'Add task',
  'tasks.todayProgress': "Today's progress", 'tasks.allClear': 'All clear!', 'tasks.nothingHere': 'No tasks in this view.',
  'home.tasksToday': "Today's tasks", 'home.taskProgress': 'Task progress', 'home.viewAll': 'View all',
  'greet.morning': 'Good morning', 'greet.afternoon': 'Good afternoon', 'greet.evening': 'Good evening',
  'home.commission': "This month's commission", 'home.vsLast': 'vs last month', 'home.target': 'Monthly target',
  'home.markAttendance': 'Mark attendance', 'home.gpsCheckin': 'GPS check-in for the day',
  'home.clockedIn': 'Clocked in', 'home.clockIn': 'Clock in', 'home.clockOut': 'Clock out',
  // PHASE 52 — Break feature. Human copy supplied by owner 2026-08-18 (docs/i18n/PHASE-52-break-copy-REQUEST.md).
  'break.start': 'Break', 'break.end': 'End break',
  'break.reasonTitle': 'Add a reason (optional)', 'break.reasonPlaceholder': 'Why are you taking a break?',
  'break.reasonSkip': 'Skip', 'break.reasonStart': 'Start break',
  'break.minDoneTitle': "You've done 8h 30m",
  'break.minDoneBody': "You've completed your minimum hours. Take a break, or clock out?",
  'break.minDoneConfirm': 'Take a break',
  // PHASE 50 — out-of-range / early clock-in/out reason prompt. Owner human copy in all 5 languages
  // (supplied 2026-08-20), not machine-translated. Buttons reuse common.cancel / home.clockIn / home.clockOut.
  'clock.reasonTitleOut': 'Add a reason to clock out', 'clock.reasonTitleIn': 'Add a reason to clock in',
  'clock.reasonEarly': 'You are clocking out before your shift ends. Your manager will be notified.',
  'clock.reasonAway': 'You are away from the office. Your manager will be notified.',
  // Edge case: the server rejected an already-supplied reason (a second REASON_REQUIRED).
  'clock.reasonNeededTitleOut': 'Reason needed to clock out', 'clock.reasonNeededBodyOut': 'Please add a short reason to clock out here.',
  'clock.reasonNeededTitleIn': 'Reason needed to clock in', 'clock.reasonNeededBodyIn': 'Please add a short reason to clock in here.',
  'home.hotLeads': 'Hot leads', 'home.openClaims': 'Open claims', 'home.renewals': 'Renewals',
  'home.quickActions': 'Quick actions', 'home.followups': "Today's follow-ups", 'home.quickContacts': 'Quick contacts',
  'home.allCaught': 'All caught up!', 'home.noFollowups': 'No pending follow-ups right now.',
  'act.newLead': 'New lead', 'act.newClaim': 'New claim', 'act.whatsapp': 'WhatsApp', 'act.licPlans': 'LIC plans',
  'act.calendar': 'Calendar', 'act.contests': 'Contests', 'act.premiumDue': 'Premium due', 'act.birthdays': 'Birthdays',
  'common.signIn': 'Sign in', 'common.signOut': 'Sign out', 'common.cancel': 'Cancel', 'common.send': 'Send',
  'common.call': 'Call', 'common.whatsapp': 'WhatsApp', 'common.seeAll': 'See all', 'common.search': 'Search',
  'common.pipeline': 'Pipeline', 'common.delete': 'Delete', 'common.save': 'Save', 'common.today': 'Today',
  'premium.title': 'Premium & Greetings', 'premium.dueThisMonth': 'Premium due this month', 'premium.birthdaysThisMonth': 'Birthdays this month',
  'premium.sendReminder': 'Send reminder', 'premium.sendAll': 'Send to all', 'premium.oneClick': 'One tap sends a personalised WhatsApp to every matching client.',
  'premium.renewalDue': 'Renewal due', 'premium.maturitySoon': 'Maturity soon', 'premium.anniversaries': 'Anniversaries',
  'report.generate': 'Generate client report', 'report.generating': 'Generating report…', 'report.title': 'Client report',
  'signout.title': 'Sign out?', 'signout.msg': 'Are you sure you want to sign out of CGPE Connect?',
  'settings.language': 'App language', 'settings.title': 'Settings',
  // Phase 41 — 24/7 location + DPDP consent notice. Human copy in all 5 languages (translation-v.01,
  // owner-supplied 2026-08-14); see docs/i18n/PHASE-41-CONSENT-COPY.md. Doc-only **bold** markers stripped.
  'consent.title': 'Location sharing for work',
  'consent.intro': 'Please read this before you start. CGPE Connect shares your location so the company can manage the field team.',
  'consent.collect': 'What is shared: your precise location and your movement/activity, 24 hours a day — including outside your working hours.',
  'consent.why': 'Why: so the company can manage and support the field team.',
  'consent.who': 'Who can see it: only the company Master. Your colleagues cannot see your location.',
  'consent.retention': 'How long it is kept: your location history is hidden after 90 days and permanently deleted after 180 days.',
  'consent.transparent': "Nothing is hidden from you: whenever location is being shared, a notice stays in your phone's status bar. You always know it is on.",
  'consent.mandatory': 'This is required to use the CGPE Connect work app. If you do not agree, you cannot continue.',
  'consent.withdraw': 'You can turn location off later, but the app will stop working until you turn it back on, and the Master is told when you turn it off.',
  'consent.agreeButton': 'I Agree',
  'consent.declineButton': 'I do not agree',
  'consent.declineTitle': 'You cannot continue without agreeing',
  'consent.declineBody': 'Sharing your location is required for this work app. If you have questions, please talk to your manager.',
  'consent.declineBack': 'Go back',
  'consent.serviceTitle': 'CGPE Connect',
  'consent.serviceBody': 'Location on for work',
  'consent.blockedTitle': 'Turn location back on to use CGPE Connect',
  'consent.blockedBody': 'Location sharing is required for this app. Please turn location and the "Allow all the time" permission back on to continue.',
  'consent.blockedAction': 'Open settings',
  // D4 + D6b (owner copy, 2026-08-22) — Tasks time views + first-run guide.
  'tasks.viewWeek': 'This week', 'tasks.viewMonth': 'This month', 'tasks.viewCalendar': 'Calendar',
  'tasks.tomorrow': 'Tomorrow', 'tasks.yesterday': 'Yesterday',
  'tasks.emptyTodayTitle': 'Nothing due today',
  'tasks.emptyTodayBody': 'Today is clear — nothing due and nothing overdue. Add a task to plan the rest of the day.',
  'tasks.emptyWeekTitle': 'Nothing this week',
  'tasks.emptyWeekBody': 'No task falls in this week. Try This month or the Calendar to look further ahead.',
  'tasks.emptyMonthTitle': 'Nothing this month',
  'tasks.emptyMonthBody': 'No task is scheduled in this calendar month.',
  // Band 2 #4: reworded "strip above" → "calendar above" now that the Calendar view is a month grid,
  // not the removed day rail. CLOSED 2026-08-26 — the owner supplied human copy and all four
  // translations now say "calendar" too, so the debt this comment recorded is paid. Kept as the
  // record of why the wording changed (see docs/spec/BAND2-4-calendar.md).
  'tasks.emptyCalendarBody': 'No task is due on the selected day. Pick another day from the calendar above.',
  'guide.welcome': 'Welcome', 'guide.title': 'Your day in 3 steps',
  'guide.step1Title': 'Clock in', 'guide.step1Body': 'Tap Clock in when you reach the office to start your day.',
  'guide.step2Title': "See today's tasks", 'guide.step2Body': 'Your work for today is listed right here on this screen.',
  'guide.step3Title': 'Mark done', 'guide.step3Body': 'Swipe a task, or tap the tick, once it is finished.',
  'guide.gotIt': 'Got it',
  // PHASE 77 — Settings › Storage. All five languages were SUPPLIED BY THE OWNER on 2026-08-26 and
  // are not machine-translated. `Cancel` deliberately reuses `common.cancel` rather than adding a
  // twelfth key. Where a Hinglish/Roman-Gujarati value below is the plain English word, that is the
  // owner's own choice and the same sanctioned trade-vocab fallback as `common.whatsapp`.
  'storage.title': 'Storage',
  'storage.description': 'Manage the files and downloads the app has saved temporarily.',
  'storage.clear': 'Clear cached downloads',
  'storage.clearing': 'Clearing cache…',
  'storage.confirmTitle': 'Clear cache?',
  'storage.confirmBody': 'This removes the temporary files the app has saved. Your original files are not affected.',
  'storage.clearCta': 'Clear',
  'storage.doneBody': 'Temporary files were removed successfully.',
  'storage.partialBody': 'Some temporary files could not be removed. You can try again.',
  'storage.failBody': 'There was a problem removing the temporary files. Please try again.',
  // The sentence the owner's shorter `storage.description` dropped. Rendered after it, so clearing
  // does not look broken when 125 MB fails to fall back to 63 MB. Supplied 2026-08-26.
  'storage.installNote': 'The app’s own install size does not change — your phone’s Settings › Apps › CGPE Connect › Storage shows the real figures.',

  /* ------------------------------------------------------------------ *
   * PHASE 77 COPY DROP (2026-08-26) — Batches 2, 3 and 4 of
   * `docs/i18n/COPY-REQUEST-2026-08-26.md`. All five languages SUPPLIED BY THE OWNER in one batch,
   * human-written, NOT machine-translated. Adding the keys is separate from wiring them: a key
   * sitting here is inert until a screen calls it, so the copy is captured safely first and the
   * ~170 hardcoded call sites are replaced in stages.
   * ------------------------------------------------------------------ */

  // Batch 2 — the shared-word layer. `common.tryAgain` alone replaces 55 hardcoded copies across
  // 37 files, and `common.offlineBody` is the ONE canonical replacement for 39 near-identical
  // "the server did not answer" variants (60 occurrences).
  'common.tryAgain': 'Try again',
  'common.clearSearch': 'Clear search',
  'common.refresh': 'Refresh',
  'common.offlineBody': 'The server could not be reached. Check your connection and try again.',
  'common.loadMore': 'Load more',
  'common.all': 'All',
  'common.done': 'Done',
  'common.clear': 'Clear',
  'common.continue': 'Continue',
  'common.showResults': 'Show results',
  'common.saving': 'Saving…',
  'common.uploading': 'Uploading…',
  'common.mobile': 'Mobile',
  'common.onDuty': 'On duty',
  'common.offDuty': 'Off duty',
  'common.goToSignIn': 'Go to sign in',
  'common.a11yCall': 'Call {name}',
  'common.a11yWhatsapp': 'Open WhatsApp chat with {name}',
  'common.close': 'Close',

  // Batch 3 — the shared components. These render on many screens at once, so they are the
  // cheapest wins per string: the connection banner alone can appear over any screen in the app.
  'health.slow': 'The server is responding slowly',
  'health.offline': 'Can’t reach the network',
  'health.server': 'The server had a problem',
  'health.someData': 'Some data could not load',
  'health.oneRequest': 'One request could not be completed. Some values may be missing or out of date.',
  'health.manyRequests': '{n} requests could not be completed. Some values may be missing or out of date.',
  'health.a11yUnconfirmed': '{n} request(s) could not be completed. Blank values are unconfirmed.',
  'common.dismiss': 'Dismiss',
  'common.confirm': 'Confirm',
  'lock.title': 'App locked',
  'lock.body': 'Unlock CGPE Connect with your fingerprint, Face ID, or device passcode.',
  'lock.verifying': 'Verifying…',
  'lock.unlock': 'Unlock',
  'sync.pending': 'Pending sync',
  'sync.syncedAt': 'Synced {time} · may be out of date',
  'sync.savedLocal': 'Saved on this device — it’ll sync when you’re back online.',
  'sync.savedLocalNamed': '{name} saved on this device — it will sync when you’re back online',
  'sync.droppedOne': 'One offline change could not be saved and was removed.',
  'sync.droppedMany': '{n} offline changes could not be saved and were removed.',
  'doc.attachTitle': 'Attach a document',
  'doc.attachSubtitle': 'Take a new photo, or pick something already on your phone',
  'doc.takePhoto': 'Take a photo',
  'doc.gallery': 'Choose from gallery',
  'doc.file': 'Choose a file',
  'filter.title': 'Filters',
  'filter.applied': '{n} filter(s) applied',
  'filter.showingAll': 'Showing everything',
  'filter.reset': 'Reset',
  'common.add': 'Add',
  'common.increase': 'Increase',
  'common.decrease': 'Decrease',
  'common.hidePassword': 'Hide password',
  'common.showPassword': 'Show password',
  'common.goBack': 'Go back',
  'common.copyLabel': 'Copy {label}',
  'map.loading': 'Loading map',
  'map.pointsHere': '{n} points here',
  'map.andMore': 'and {n} more',

  // Batch 4 — the status words. These render on Home, Leads, Claims, Tasks AND Search at the same
  // time, so until they land those screens cannot look translated whatever else is done. They
  // mirror `data/labels.ts` and `data/tasks.ts`, which is where they are consumed.
  'stage.new': 'New',
  'stage.meeting': 'Meeting',
  'stage.docsShared': 'Docs shared',
  'stage.policyIssued': 'Policy issued',
  'stage.lost': 'Lost',
  'claimStatus.intake': 'Intake',
  'claimStatus.docsPending': 'Docs pending',
  'claimStatus.review': 'Under review',
  'claimStatus.submitted': 'Submitted',
  'claimStatus.settled': 'Settled',
  'claimStatus.rejected': 'Rejected',
  'seg.renewal': 'Renewal due',
  'seg.maturity': 'Maturity soon',
  'seg.birthday': 'Birthday',
  'seg.crossSell': 'Cross-sell',
  'seg.hot': 'Hot',
  'taskStatus.todo': 'To do',
  'taskStatus.inProgress': 'In progress',
  'taskStatus.blocked': 'Blocked',
  'taskStatus.done': 'Done',
  'priority.high': 'High',
  'priority.medium': 'Medium',
  'priority.low': 'Low',
  'task.followUp': 'Follow-up',

  // Batch 1e — the parameterised form. `home.clockedIn` above stays as the no-time FALLBACK; this
  // is what actually renders. English reworded to "Clocked in at {time}" on the owner's own
  // recommendation (2026-08-26) — proposed by them, not silently changed.
  'home.clockedInAt': 'Clocked in at {time}',

  /* ------------------------------------------------------------------ *
   * BATCH 6a (2026-08-27) — the copy that CLOSES the groups Phase 80's sweep left half
   * translated. All five languages supplied by the owner in one drop, human-written, NOT
   * machine-translated; the table is recorded verbatim in
   * `docs/i18n/BATCH-6A-RECEIVED-2026-08-27.md`.
   *
   * Six of the 70 supplied rows add NO key here, deliberately:
   *   `Search` → `tab.search`, `WhatsApp` → `common.whatsapp`, `All` → `common.all` (all three
   *   came back identical to copy already in this file), `Generating report` →
   *   `report.generating` (already here and already wired in Phase 81), `Open tickets` is one
   *   key read by two screens, and `0 clients in process` HAS NO CALL SITE — the extraction
   *   picked it up out of a source COMMENT in `screens/dashboards.tsx`, so a key for it would
   *   be a zero-consumer key, the exact defect Phases 79/81 spent themselves closing.
   *
   * ⚠️ `search.row*` deliberately does NOT reuse `tab.clients`/`tab.claims`/`tab.tasks`. The
   * owner filled those cells fresh and their words DIFFER from the tab bar's (ક્લાયન્ટ્સ vs
   * ગ્રાહકો, ક્લેમ્સ vs ક્લેમ, ટાસ્ક્સ vs કાર્યો). Supplied copy wins over a reuse we would be
   * inventing — but it does mean two Gujarati words for one noun in two places, which is
   * flagged to the owner as an open question, not settled here.
   * ------------------------------------------------------------------ */
  'claims.inRegister': 'In the register',
  'claims.paidOut': 'Paid out',
  'claims.pending': 'Pending',
  'claims.yours': 'Your claims',
  'claims.stillInProgress': 'Still in progress',
  // The filter chip's SHORT form. `claimStatus.review` ('Under review') is the status word and
  // stays as it is — this phase translates, it does not reword any English.
  'claims.filterReview': 'Review',
  'filter.segment': 'Segment',
  'filter.next30': 'Next 30 days',
  'filter.later': 'Later',
  'filter.contact': 'Contact',
  'filter.hasPhone': 'Phone on file',
  'filter.noPhone': 'Missing phone',
  'common.dueToday': 'Due today',
  // NOT `home.followUps`: `home.followups` already exists with different copy ("Today's
  // follow-ups"), and two keys differing only by one capital letter is a trap, not a name.
  'common.followUps': 'Follow-ups',
  'home.openTickets': 'Open tickets',
  'home.activeLeads': 'Active leads',
  'common.reminders': 'Reminders',
  'common.tickets': 'Tickets',
  'search.whereItLooks': 'Where it looks',
  'search.whereFooterClients': 'Clients and tickets are matched on the server, so the whole book is searched, not only what this device has loaded. Four digits or more will match a mobile number by its last digits.',
  'search.whereFooterTickets': 'Tickets are matched on the server. Four digits or more will match a mobile number by its last digits.',
  'search.rowClients': 'Clients',
  'search.rowClientsHint': 'Name, mobile, policy, email',
  'search.rowLeads': 'Leads',
  'search.rowLeadsHint': 'Name, mobile, interest',
  'search.rowClaims': 'Claims',
  'search.rowClaimsHint': 'Reference, name, policy',
  'search.rowTicketsHint': 'Reference, name, request',
  'search.rowTasks': 'Tasks',
  'search.rowTasksHint': 'Title, client, details',
  'premium.birthdaysToday': 'Birthdays today',
  'home.notClockedIn': 'Not clocked in',
  'premium.renewalsDue': 'Renewals due',
  'premium.reachable': 'Reachable',
  'common.inTheBook': 'In the book',
  'client.annualPremium': 'Annual premium',
  'client.policies': 'Policies',
  'client.maturity': 'Maturity',
  'lead.closedAsLost': 'Closed as lost',
  'lead.pipelineProgress': 'Pipeline progress',
  'lead.notProceeding': 'Not proceeding',
  'task.due': 'Due',
  'task.keep': 'Keep',
  'task.inAWeek': 'In a week',
  'task.priority': 'Priority',
  'team.premiumMtd': 'Premium (MTD)',
  'team.doneMtd': 'Done (MTD)',
  'team.completion': 'Completion',
  'team.openWork': 'Open work',
  'dash.online': 'Online',
  'dash.openTasks': 'Open tasks',
  'dash.clientBook': 'Client book',
  'dash.claimsInProcess': 'Claims in process',
  'dash.adminActions': 'Admin actions',
  'dash.assignTask': 'Assign task',
  'dash.sendRenewals': 'Send renewals',
  'dash.team': 'Team',
  'dash.agentMap': 'Agent map',
  'dash.liveActivity': 'Live activity',

  // Batch 5, the sign-in screen (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised.
  // Provisional; see the machine-translation note in the English dictionary. The rest of
  // the request's Batch 5 (session.*, net.*, biometric.prompt, login.codeSent*) lives in
  // modules with NO React translator and would be zero-consumer here, so it is NOT added.
  'login.modePassword': 'Password',
  'login.modeOtp': 'OTP',
  'login.eyebrow': 'Secure sign in',
  'login.welcome': 'Welcome back',
  'login.unlockWithFingerprint': 'Unlock with fingerprint',
  'login.orSignIn': 'or sign in',
  'login.identifierLabel': 'Email or mobile number',
  'login.passwordLabel': 'Password',
  'login.unlockAndSignIn': 'Unlock and sign in',
  'login.otpLabel': 'Enter code',
  'login.verifyAndSignIn': 'Verify and sign in',
  'login.resendCode': 'Send a new code',
  'login.sendCode': 'Send code',
  'login.passwordPlaceholder': 'Your CGPE password',
  'login.otpPlaceholder': '6 digit code',
  'login.otpChannelHint': 'Email gets the code by mail. A mobile number gets it on WhatsApp.',
  'login.errIdentifierRequired': 'Enter your email or mobile number.',
  'login.errPasswordRequired': 'Enter your password.',
  'login.errIdentifierShape': 'Enter your work email, or a 10 digit mobile number.',
  'login.errEmailShape': 'That email address does not look right.',
  'login.errOtpRequired': 'Enter the code from your WhatsApp message.',
  'login.errOtpRequiredEmail': 'Enter the code from your email.',
  'login.bannerTimeout': 'The server is taking too long',
  'login.bannerPasswordNotSent': 'Your details were not sent',
  'login.bannerCodeNotChecked': 'Your code was not checked',
  'login.bannerCodeRequestNotSent': 'The code request was not sent',
  'login.bannerSignInRefused': 'Sign in refused',
  'login.bannerCodeNotAccepted': 'Code not accepted',
  'login.bannerCodeNotSent': 'Code not sent',
  'login.bannerSessionEnded': 'Your session ended',
  'login.msgUnlockNotConfirmed': 'Unlock was not confirmed on this device. Try again.',
  'login.msgCodeNotAccepted': 'That code was not accepted. It may have expired, so request a new one.',
  'login.msgQuickUnlockGone': 'Quick unlock is no longer available. Please sign in with your password or OTP.',
  'login.msgUnlockFailed': 'Could not unlock right now. Check your connection and try again.',
  'login.msgDetailsRefused': 'Those details were not accepted. Check them and try again.',
  'login.msgCodeCheckFailed': 'That code could not be checked. Please try again.',
  'login.msgCodeSendFailed': 'Could not send the code. Please try again.',
  'login.footerHint': 'Sign in with your CGPE account. Next time you can unlock with fingerprint or Face ID.',

  /* ------------------------------------------------------------------ *
   * BATCH 6f / 6d / 6e / 5b / 4b (2026-08-27) — TRANSLATED BY CLAUDE, NOT BY THE OWNER.
   *
   * Every other block in this file is human copy the owner supplied, and PHASE-19 §4 forbids
   * machine translation for exactly one reason: the parity test can prove a value EXISTS in five
   * languages but never that it is CORRECT, so a wrong string ships green and can live for
   * months. That risk has not gone away — it has been ACCEPTED. On 2026-08-27 the owner was told
   * the rule and overrode it in writing: "translation aap abhi ke liye khud se kar lijiye … agar
   * [problem] aaye toh hum solve kar denge."
   *
   * SO: treat everything from here to the end of this block as PROVISIONAL. It is written to be
   * plain and field-readable rather than literary, and the trade-vocabulary rule at the top of
   * this file is respected (policy, premium, claim, lead, video, analytics stay English). A
   * native reader should still review it; correcting a line needs no code change.
   *
   * Do NOT extend this block by machine-translating anything else without the same explicit
   * instruction, and do NOT quietly convert owner-supplied copy into this style.
   * ------------------------------------------------------------------ */
  'task.assignTo': 'Assign to',
  'task.assignHint': 'Nobody is assigned yet. The task stays on your own list.',
  'task.category': 'Category',
  'report.totalPolicies': 'Total policies',
  'report.lifeCover': 'Total life cover',
  'report.familyMembers': 'Family members',
  'clients.searchSubtitle': 'Search your whole book',
  'lead.closeOut': 'Close out',
  'lead.closeOutFooter': 'A closed lead stays in the pipeline list under its own stage, so nothing is lost.',
  'common.current': 'Current',
  'dash.masterControls': 'Master controls',
  'dash.allTeams': 'All teams',
  'dash.movement': 'Movement',
  'dash.analytics': 'Analytics',
  'dash.campaigns': 'Campaigns',
  'dash.totalClients': 'Total clients',
  'dash.claimsTotal': 'Claims total',
  'dash.inProcess': 'In process',
  'dash.claimsPaid': 'Claims paid',
  'home.followUpsEmptyBody': 'Birthdays, renewals and callbacks land here on the day they are due.',
  'home.openFollowUps': 'Open follow-ups',
  'common.dueOn': 'Due {date}',
  'common.daysLate': '{n} days late',
  'common.inDays': 'In {n} days',
  'home.claimsOpen': 'Claims open',
  'home.portfolioAnalytics': 'Portfolio analytics',
  'home.portfolioFooter': 'Organisation-wide totals. Open analytics for the full breakdown.',
  'clients.restrictedTitle': 'Clients are master and admin only',
  'clients.restrictedBody': 'The client directory is available to administrators and the master account. Ask an administrator if you need a client’s details.',
  'job.goneTitle': 'This job is no longer running',
  'job.goneBody': 'Background jobs are kept only while the app is open. It has finished and been cleared.',
  'job.keepWorking': 'Keep working, this runs in the background',
  'common.added': 'Added',
  'home.vsLastPct': '{pct}% vs last month',
  'premium.sendAllCount': 'Send to all {n}',
  'doc.recordVideo': 'Record a video',
  'doc.videoHint': 'Videos are limited to {seconds} seconds and are made smaller on your phone before they are sent.',
  'doc.preparingVideo': 'Preparing video…',
};

/** Every dictionary carries exactly the English key set. */
/**
 * Every key the dictionaries carry. EXPORTED (Phase 77) so a module that stores a key rather than a
 * sentence — `data/labels.ts`'s status maps — can be typed against the real key set instead of a
 * bare `string`, which would let a typo ship as visible text.
 */
export type TKey = keyof typeof en;
type Dict = Record<TKey, string>;

const gu: Dict = {
  'tab.home': 'આજે', 'tab.tasks': 'કાર્યો', 'tab.leads': 'લીડ્સ', 'tab.clients': 'ગ્રાહકો', 'tab.claims': 'ક્લેમ', 'tab.search': 'શોધો', 'tab.more': 'વધુ',
  'tasks.title': 'મારા કાર્યો', 'tasks.today': 'આજે', 'tasks.overdue': 'મુદત વીતી', 'tasks.inProgress': 'ચાલુ',
  'tasks.upcoming': 'આવનારા', 'tasks.doneLabel': 'પૂર્ણ', 'tasks.dueNow': 'બાકી', 'tasks.add': 'કાર્ય ઉમેરો',
  'tasks.todayProgress': 'આજની પ્રગતિ', 'tasks.allClear': 'બધું પૂર્ણ!', 'tasks.nothingHere': 'આ યાદીમાં કોઈ કાર્ય નથી.',
  'home.tasksToday': 'આજના કાર્યો', 'home.taskProgress': 'કાર્ય પ્રગતિ', 'home.viewAll': 'બધું જુઓ',
  'greet.morning': 'સુપ્રભાત', 'greet.afternoon': 'શુભ બપોર', 'greet.evening': 'શુભ સાંજ',
  'home.commission': 'આ મહિનાનું કમિશન', 'home.vsLast': 'ગયા મહિના કરતાં', 'home.target': 'માસિક લક્ષ્ય',
  'home.markAttendance': 'હાજરી નોંધો', 'home.gpsCheckin': 'આજની GPS હાજરી',
  'home.clockedIn': 'હાજરી નોંધાઈ', 'home.clockIn': 'હાજરી', 'home.clockOut': 'ક્લોક આઉટ',
  'break.start': 'બ્રેક', 'break.end': 'બ્રેક પૂરો કરો',
  'break.reasonTitle': 'કારણ ઉમેરો (વૈકલ્પિક)', 'break.reasonPlaceholder': 'તમે બ્રેક કેમ લઈ રહ્યા છો?',
  'break.reasonSkip': 'સ્કીપ કરો', 'break.reasonStart': 'બ્રેક શરૂ કરો',
  'break.minDoneTitle': 'તમે 8h 30m પૂર્ણ કર્યા છે',
  'break.minDoneBody': 'તમે તમારા લઘુત્તમ કલાકો પૂર્ણ કર્યા છે. બ્રેક લેવો છે કે ક્લોક-આઉટ કરવો છે?',
  'break.minDoneConfirm': 'બ્રેક લો',
  'clock.reasonTitleOut': 'ક્લૉક આઉટ કરવાનું કારણ ઉમેરો', 'clock.reasonTitleIn': 'ક્લૉક ઇન કરવાનું કારણ ઉમેરો',
  'clock.reasonEarly': 'તમે તમારી શિફ્ટ પૂરી થતાં પહેલાં ક્લૉક આઉટ કરી રહ્યા છો. તમારા મેનેજરને જાણ કરવામાં આવશે.',
  'clock.reasonAway': 'તમે ઑફિસથી દૂર છો. તમારા મેનેજરને જાણ કરવામાં આવશે.',
  'clock.reasonNeededTitleOut': 'ક્લૉક આઉટ કરવા માટે કારણ જરૂરી છે', 'clock.reasonNeededBodyOut': 'કૃપા કરીને અહીં ક્લૉક આઉટ કરવાનું ટૂંકું કારણ ઉમેરો.',
  'clock.reasonNeededTitleIn': 'ક્લૉક ઇન કરવા માટે કારણ જરૂરી છે', 'clock.reasonNeededBodyIn': 'કૃપા કરીને અહીં ક્લૉક ઇન કરવાનું ટૂંકું કારણ ઉમેરો.',
  'home.hotLeads': 'હોટ લીડ્સ', 'home.openClaims': 'ખુલ્લા ક્લેમ', 'home.renewals': 'રિન્યુઅલ',
  'home.quickActions': 'ઝડપી ક્રિયાઓ', 'home.followups': 'આજના ફોલો-અપ', 'home.quickContacts': 'ઝડપી સંપર્કો',
  'home.allCaught': 'બધું પૂર્ણ!', 'home.noFollowups': 'હાલ કોઈ ફોલો-અપ બાકી નથી.',
  'act.newLead': 'નવી લીડ', 'act.newClaim': 'નવો ક્લેમ', 'act.whatsapp': 'વોટ્સએપ', 'act.licPlans': 'LIC પ્લાન',
  'act.calendar': 'કેલેન્ડર', 'act.contests': 'સ્પર્ધાઓ', 'act.premiumDue': 'પ્રીમિયમ બાકી', 'act.birthdays': 'જન્મદિવસ',
  'common.signIn': 'સાઇન ઇન', 'common.signOut': 'સાઇન આઉટ', 'common.cancel': 'રદ કરો', 'common.send': 'મોકલો',
  'common.call': 'કૉલ', 'common.whatsapp': 'વોટ્સએપ', 'common.seeAll': 'બધું જુઓ', 'common.search': 'શોધો',
  'common.pipeline': 'પાઇપલાઇન', 'common.delete': 'ડિલીટ', 'common.save': 'સાચવો', 'common.today': 'આજે',
  'premium.title': 'પ્રીમિયમ અને શુભેચ્છા', 'premium.dueThisMonth': 'આ મહિને પ્રીમિયમ બાકી', 'premium.birthdaysThisMonth': 'આ મહિનાના જન્મદિવસ',
  'premium.sendReminder': 'રિમાઇન્ડર મોકલો', 'premium.sendAll': 'બધાને મોકલો', 'premium.oneClick': 'એક ટેપથી દરેક ગ્રાહકને વ્યક્તિગત વોટ્સએપ સંદેશ જાય છે.',
  'premium.renewalDue': 'રિન્યુઅલ બાકી', 'premium.maturitySoon': 'મેચ્યોરિટી નજીક', 'premium.anniversaries': 'એનિવર્સરી',
  'report.generate': 'ગ્રાહક રિપોર્ટ બનાવો', 'report.generating': 'રિપોર્ટ બની રહ્યો છે…', 'report.title': 'ગ્રાહક રિપોર્ટ',
  'signout.title': 'સાઇન આઉટ કરવું?', 'signout.msg': 'શું તમે ખરેખર CGPE Connect માંથી સાઇન આઉટ કરવા માંગો છો?',
  'settings.language': 'એપ ભાષા', 'settings.title': 'સેટિંગ્સ',
  'consent.title': 'કામ માટે લોકેશન શેરિંગ',
  'consent.intro': 'કૃપા કરીને શરૂ કરતા પહેલા આ વાંચો. CGPE Connect તમારું લોકેશન શેર કરે છે જેથી કંપની ફિલ્ડ ટીમને મેનેજ કરી શકે.',
  'consent.collect': 'શું શેર કરવામાં આવે છે: તમારું ચોક્કસ લોકેશન અને તમારી હિલચાલ/પ્રવૃત્તિ, 24 કલાક — જેમાં તમારા કામના કલાકો સિવાયનો સમય પણ સામેલ છે.',
  'consent.why': 'શા માટે: જેથી કંપની ફિલ્ડ ટીમને યોગ્ય રીતે મેનેજ અને સપોર્ટ કરી શકે.',
  'consent.who': 'કોણ જોઈ શકે છે: માત્ર કંપનીના માસ્ટર (Master). તમારા સહકર્મીઓ તમારું લોકેશન જોઈ શકતા નથી.',
  'consent.retention': 'કેટલા સમય સુધી રાખવામાં આવે છે: તમારો લોકેશન હિસ્ટ્રી ડેટા 90 દિવસ પછી છુપાવી દેવામાં આવશે અને 180 દિવસ પછી કાયમ માટે ડિલીટ કરી દેવામાં આવશે.',
  'consent.transparent': 'તમારાથી કંઈ છુપાયેલું નથી: જ્યારે પણ લોકેશન શેર થઈ રહ્યું હશે, તમારા ફોનના સ્ટેટસ બારમાં નોટિફિકેશન હંમેશા રહેશે. તમને હંમેશા ખબર રહેશે કે તે ચાલુ છે.',
  'consent.mandatory': 'CGPE Connect વર્ક એપનો ઉપયોગ કરવા માટે આ ફરજિયાત છે. જો તમે સંમત ન હોવ, તો તમે આગળ વધી શકતા નથી.',
  'consent.withdraw': 'તમે તેને પછીથી બંધ કરી શકો છો, પરંતુ જ્યાં સુધી તમે ફરી ચાલુ ન કરો ત્યાં સુધી એપ કામ કરવાનું બંધ કરી દેશે, અને બંધ કરશો ત્યારે માસ્ટરને જાણ કરવામાં આવશે.',
  'consent.agreeButton': 'હું સંમત છું',
  'consent.declineButton': 'હું સંમત નથી',
  'consent.declineTitle': 'સંમત થયા વિના તમે આગળ વધી શકતા નથી',
  'consent.declineBody': 'આ વર્ક એપ માટે તમારું લોકેશન શેર કરવું ફરજિયાત છે. જો તમને કોઈ પ્રશ્નો હોય, તો કૃપા કરીને તમારા મેનેજર સાથે વાત કરો.',
  'consent.declineBack': 'પાછા જાઓ',
  'consent.serviceTitle': 'CGPE Connect',
  'consent.serviceBody': 'કામ માટે લોકેશન ચાલુ છે',
  'consent.blockedTitle': 'CGPE Connect નો ઉપયોગ કરવા માટે લોકેશન ફરીથી ચાલુ કરો',
  'consent.blockedBody': 'આ એપ માટે લોકેશન શેરિંગ ફરજિયાત છે. આગળ વધવા માટે કૃપા કરીને લોકેશન અને "Allow all the time" પરમિશન ફરીથી ચાલુ કરો.',
  'consent.blockedAction': 'સેટિંગ્સ ખોલો',
  // D4 + D6b (owner copy, 2026-08-22)
  'tasks.viewWeek': 'આ અઠવાડિયે', 'tasks.viewMonth': 'આ મહિને', 'tasks.viewCalendar': 'કેલેન્ડર',
  'tasks.tomorrow': 'આવતીકાલે', 'tasks.yesterday': 'ગઈકાલે',
  'tasks.emptyTodayTitle': 'આજે કંઈ બાકી નથી',
  'tasks.emptyTodayBody': 'આજે બધું ક્લિયર છે — આજે કંઈ બાકી નથી અને કંઈ ઓવરડ્યૂ પણ નથી. બાકીના દિવસનું આયોજન કરવા માટે ટાસ્ક ઉમેરો.',
  'tasks.emptyWeekTitle': 'આ અઠવાડિયે કંઈ નથી',
  'tasks.emptyWeekBody': 'આ અઠવાડિયામાં કોઈ ટાસ્ક નથી. આગળના ટાસ્ક જોવા માટે આ મહિનો અથવા કેલેન્ડર જુઓ.',
  'tasks.emptyMonthTitle': 'આ મહિને કંઈ નથી',
  'tasks.emptyMonthBody': 'આ કેલેન્ડર મહિનામાં કોઈ ટાસ્ક શેડ્યૂલ નથી.',
  'tasks.emptyCalendarBody': 'પસંદ કરેલા દિવસે કોઈ ટાસ્ક બાકી નથી. ઉપરના કેલેન્ડરમાંથી બીજો દિવસ પસંદ કરો.',
  'guide.welcome': 'સ્વાગત છે', 'guide.title': 'તમારો દિવસ 3 પગલાંમાં',
  'guide.step1Title': 'ક્લોક ઇન', 'guide.step1Body': 'ઓફિસ પહોંચ્યા પછી તમારો દિવસ શરૂ કરવા માટે Clock in પર ટેપ કરો.',
  'guide.step2Title': 'આજના ટાસ્ક જુઓ', 'guide.step2Body': 'આજનું તમારું કામ આ જ સ્ક્રીન પર અહીં દર્શાવેલું છે.',
  'guide.step3Title': 'પૂર્ણ તરીકે માર્ક કરો', 'guide.step3Body': 'ટાસ્ક પૂર્ણ થયા પછી તેને સ્વાઇપ કરો અથવા ટિક પર ટેપ કરો.',
  'guide.gotIt': 'સમજાયું',
  'storage.title': 'સ્ટોરેજ',
  'storage.description': 'એપ દ્વારા તાત્કાલિક રીતે સેવ કરેલી ફાઇલો અને ડાઉનલોડ મેનેજ કરો.',
  'storage.clear': 'કૅશ કરેલા ડાઉનલોડ સાફ કરો',
  'storage.clearing': 'કૅશ સાફ થઈ રહ્યો છે…',
  'storage.confirmTitle': 'કૅશ સાફ કરવો છે?',
  'storage.confirmBody': 'આ એપ દ્વારા સેવ કરેલી તાત્કાલિક ફાઇલો દૂર કરશે. તમારી મૂળ ફાઇલો પર કોઈ અસર નહીં થાય.',
  'storage.clearCta': 'સાફ કરો',
  'storage.doneBody': 'તાત્કાલિક ફાઇલો સફળતાપૂર્વક દૂર કરવામાં આવી છે.',
  'storage.partialBody': 'કેટલીક તાત્કાલિક ફાઇલો દૂર કરી શકાઈ નથી. તમે ફરી પ્રયાસ કરી શકો છો.',
  'storage.failBody': 'તાત્કાલિક ફાઇલો દૂર કરતી વખતે સમસ્યા આવી. કૃપા કરીને ફરી પ્રયાસ કરો.',
  'storage.installNote': 'એપનું પોતાનું ઇન્સ્ટોલ સાઇઝ બદલાતું નથી — સાચી સ્ટોરેજ માહિતી જોવા માટે તમારા ફોનમાં Settings › Apps › CGPE Connect › Storage ખોલો.',
  'common.tryAgain': 'ફરી પ્રયાસ કરો',
  'common.clearSearch': 'શોધ સાફ કરો',
  'common.refresh': 'રિફ્રેશ કરો',
  'common.offlineBody': 'સર્વર સુધી પહોંચી શકાયું નથી. તમારું કનેક્શન તપાસો અને ફરી પ્રયાસ કરો.',
  'common.loadMore': 'વધુ લોડ કરો',
  'common.all': 'બધા',
  'common.done': 'પૂર્ણ',
  'common.clear': 'સાફ કરો',
  'common.continue': 'આગળ વધો',
  'common.showResults': 'પરિણામો બતાવો',
  'common.saving': 'સેવ થઈ રહ્યું છે…',
  'common.uploading': 'અપલોડ થઈ રહ્યું છે…',
  'common.mobile': 'મોબાઇલ',
  'common.onDuty': 'ડ્યુટી પર',
  'common.offDuty': 'ડ્યુટી પર નથી',
  'common.goToSignIn': 'સાઇન ઇન પર જાઓ',
  'common.a11yCall': '{name} ને કૉલ કરો',
  'common.a11yWhatsapp': '{name} સાથે WhatsApp ચેટ ખોલો',
  'common.close': 'બંધ કરો',
  'health.slow': 'સર્વર ધીમો પ્રતિસાદ આપી રહ્યું છે',
  'health.offline': 'નેટવર્ક સુધી પહોંચી શકાયું નથી',
  'health.server': 'સર્વરમાં સમસ્યા આવી',
  'health.someData': 'થોડો ડેટા લોડ થઈ શક્યો નથી',
  'health.oneRequest': 'એક રિક્વેસ્ટ પૂર્ણ થઈ શકી નથી. કેટલીક માહિતી ગાયબ અથવા જૂની હોઈ શકે છે.',
  'health.manyRequests': '{n} રિક્વેસ્ટ પૂર્ણ થઈ શકી નથી. કેટલીક માહિતી ગાયબ અથવા જૂની હોઈ શકે છે.',
  'health.a11yUnconfirmed': '{n} રિક્વેસ્ટ પૂર્ણ થઈ શકી નથી. ખાલી મૂલ્યોની પુષ્ટિ થઈ નથી.',
  'common.dismiss': 'બંધ કરો',
  'common.confirm': 'ખાતરી કરો',
  'lock.title': 'એપ લૉક છે',
  'lock.body': 'તમારા ફિંગરપ્રિન્ટ, Face ID અથવા ડિવાઇસ પાસકોડથી CGPE Connect અનલૉક કરો.',
  'lock.verifying': 'ચકાસણી થઈ રહી છે…',
  'lock.unlock': 'અનલૉક કરો',
  'sync.pending': 'સિંક બાકી છે',
  'sync.syncedAt': '{time} પર સિંક થયું · માહિતી જૂની હોઈ શકે છે',
  'sync.savedLocal': 'આ ડિવાઇસ પર સેવ થયું છે — તમે ફરી ઑનલાઇન થશો ત્યારે સિંક થશે.',
  'sync.savedLocalNamed': '{name} આ ડિવાઇસ પર સેવ થયું છે — તમે ફરી ઑનલાઇન થશો ત્યારે સિંક થશે',
  'sync.droppedOne': 'એક ઑફલાઇન ફેરફાર સેવ થઈ શક્યો નહીં અને દૂર કરવામાં આવ્યો.',
  'sync.droppedMany': '{n} ઑફલાઇન ફેરફારો સેવ થઈ શક્યા નહીં અને દૂર કરવામાં આવ્યા.',
  'doc.attachTitle': 'દસ્તાવેજ જોડો',
  'doc.attachSubtitle': 'નવો ફોટો લો અથવા તમારા ફોનમાં પહેલેથી રહેલી ફાઇલ પસંદ કરો',
  'doc.takePhoto': 'ફોટો લો',
  'doc.gallery': 'ગેલેરીમાંથી પસંદ કરો',
  'doc.file': 'ફાઇલ પસંદ કરો',
  'filter.title': 'ફિલ્ટર્સ',
  'filter.applied': '{n} ફિલ્ટર લાગુ છે',
  'filter.showingAll': 'બધું બતાવી રહ્યું છે',
  'filter.reset': 'રીસેટ કરો',
  'common.add': 'ઉમેરો',
  'common.increase': 'વધારો',
  'common.decrease': 'ઘટાડો',
  'common.hidePassword': 'પાસવર્ડ છુપાવો',
  'common.showPassword': 'પાસવર્ડ બતાવો',
  'common.goBack': 'પાછા જાઓ',
  'common.copyLabel': '{label} કૉપી કરો',
  'map.loading': 'નકશો લોડ થઈ રહ્યો છે',
  'map.pointsHere': 'અહીં {n} પોઇન્ટ છે',
  'map.andMore': 'અને {n} વધુ',
  'stage.new': 'નવું',
  'stage.meeting': 'મીટિંગ',
  'stage.docsShared': 'દસ્તાવેજો શેર કર્યા',
  'stage.policyIssued': 'પોલિસી જારી થઈ',
  'stage.lost': 'ગુમાવ્યું',
  'claimStatus.intake': 'ઇન્ટેક',
  'claimStatus.docsPending': 'દસ્તાવેજો બાકી',
  'claimStatus.review': 'સમીક્ષા હેઠળ',
  'claimStatus.submitted': 'સબમિટ કર્યું',
  'claimStatus.settled': 'સેટલ થયું',
  'claimStatus.rejected': 'નકારવામાં આવ્યું',
  'seg.renewal': 'રિન્યુઅલ બાકી',
  'seg.maturity': 'ટૂંક સમયમાં મેચ્યોરિટી',
  'seg.birthday': 'જન્મદિવસ',
  'seg.crossSell': 'ક્રોસ-સેલ',
  'seg.hot': 'હોટ',
  'taskStatus.todo': 'કરવાનું બાકી',
  'taskStatus.inProgress': 'ચાલુ છે',
  'taskStatus.blocked': 'અટકેલું',
  'taskStatus.done': 'પૂર્ણ',
  'priority.high': 'ઊંચી',
  'priority.medium': 'મધ્યમ',
  'priority.low': 'ઓછી',
  'task.followUp': 'ફોલો-અપ',
  'home.clockedInAt': '{time} વાગ્યે ક્લૉક ઇન કર્યું',

  // Batch 6a (2026-08-27) — owner-supplied, human-written. See the English block for why six
  // supplied rows add no key and why `search.row*` does not reuse the `tab.*` words.
  'claims.inRegister': 'રજિસ્ટરમાં',
  'claims.paidOut': 'ચૂકવેલ',
  'claims.pending': 'બાકી',
  'claims.yours': 'તમારા ક્લેમ્સ',
  'claims.stillInProgress': 'હજુ પ્રક્રિયામાં',
  'claims.filterReview': 'સમીક્ષા',
  'filter.segment': 'સેગમેન્ટ',
  'filter.next30': 'આગામી 30 દિવસ',
  'filter.later': 'પછી',
  'filter.contact': 'સંપર્ક',
  'filter.hasPhone': 'ફોન ઉપલબ્ધ',
  'filter.noPhone': 'ફોન ઉપલબ્ધ નથી',
  'common.dueToday': 'આજે બાકી',
  'common.followUps': 'ફોલો-અપ્સ',
  'home.openTickets': 'ઓપન ટિકિટ્સ',
  'home.activeLeads': 'સક્રિય લીડ્સ',
  'common.reminders': 'રિમાઇન્ડર્સ',
  'common.tickets': 'ટિકિટ્સ',
  'search.whereItLooks': 'ક્યાં શોધ થાય છે',
  'search.whereFooterClients': 'ક્લાયન્ટ્સ અને ટિકિટ્સ સર્વર પર મેચ થાય છે, તેથી ફક્ત આ ડિવાઇસ પર લોડ થયેલી માહિતી નહીં, પરંતુ આખી ક્લાયન્ટ બુકમાં શોધ થાય છે. ચાર કે તેથી વધુ અંકો મોબાઇલ નંબરના છેલ્લા અંકો સાથે મેચ થશે.',
  'search.whereFooterTickets': 'ટિકિટ્સ સર્વર પર મેચ થાય છે. ચાર કે તેથી વધુ અંકો મોબાઇલ નંબરના છેલ્લા અંકો સાથે મેચ થશે.',
  'search.rowClients': 'ક્લાયન્ટ્સ',
  'search.rowClientsHint': 'નામ, મોબાઇલ, પોલિસી, ઇમેઇલ',
  'search.rowLeads': 'લીડ્સ',
  'search.rowLeadsHint': 'નામ, મોબાઇલ, રસ',
  'search.rowClaims': 'ક્લેમ્સ',
  'search.rowClaimsHint': 'રેફરન્સ, નામ, પોલિસી',
  'search.rowTicketsHint': 'રેફરન્સ, નામ, વિનંતી',
  'search.rowTasks': 'ટાસ્ક્સ',
  'search.rowTasksHint': 'શીર્ષક, ક્લાયન્ટ, વિગતો',
  'premium.birthdaysToday': 'આજે જન્મદિવસ',
  'home.notClockedIn': 'ક્લોક-ઇન કર્યું નથી',
  'premium.renewalsDue': 'બાકી રિન્યુઅલ્સ',
  'premium.reachable': 'સંપર્ક કરી શકાય તેવા',
  'common.inTheBook': 'ક્લાયન્ટ બુકમાં',
  'client.annualPremium': 'વાર્ષિક પ્રીમિયમ',
  'client.policies': 'પોલિસીઓ',
  'client.maturity': 'મેચ્યોરિટી',
  'lead.closedAsLost': 'લોસ્ટ તરીકે બંધ',
  'lead.pipelineProgress': 'પાઇપલાઇન પ્રગતિ',
  'lead.notProceeding': 'આગળ વધી રહ્યું નથી',
  'task.due': 'નિયત તારીખ',
  'task.keep': 'યથાવત્ રાખો',
  'task.inAWeek': 'એક અઠવાડિયામાં',
  'task.priority': 'પ્રાથમિકતા',
  'team.premiumMtd': 'પ્રીમિયમ (આ મહિને)',
  'team.doneMtd': 'પૂર્ણ (આ મહિને)',
  'team.completion': 'પૂર્ણતા',
  'team.openWork': 'બાકી કામ',
  'dash.online': 'ઓનલાઇન',
  'dash.openTasks': 'ઓપન ટાસ્ક્સ',
  'dash.clientBook': 'ક્લાયન્ટ બુક',
  'dash.claimsInProcess': 'પ્રક્રિયામાં ક્લેમ્સ',
  'dash.adminActions': 'એડમિન એક્શન્સ',
  'dash.assignTask': 'ટાસ્ક સોંપો',
  'dash.sendRenewals': 'રિન્યુઅલ્સ મોકલો',
  'dash.team': 'ટીમ',
  'dash.agentMap': 'એજન્ટ મેપ',

  // Batch 5, the sign-in screen (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised.
  // Provisional; see the machine-translation note in the English dictionary. The rest of
  // the request's Batch 5 (session.*, net.*, biometric.prompt, login.codeSent*) lives in
  // modules with NO React translator and would be zero-consumer here, so it is NOT added.
  'login.modePassword': 'પાસવર્ડ',
  'login.modeOtp': 'OTP',
  'login.eyebrow': 'સુરક્ષિત સાઇન ઇન',
  'login.welcome': 'ફરી સ્વાગત છે',
  'login.unlockWithFingerprint': 'ફિંગરપ્રિન્ટથી ખોલો',
  'login.orSignIn': 'અથવા સાઇન ઇન કરો',
  'login.identifierLabel': 'ઇમેઇલ અથવા મોબાઇલ નંબર',
  'login.passwordLabel': 'પાસવર્ડ',
  'login.unlockAndSignIn': 'ખોલો અને સાઇન ઇન કરો',
  'login.otpLabel': 'કોડ દાખલ કરો',
  'login.verifyAndSignIn': 'ચકાસો અને સાઇન ઇન કરો',
  'login.resendCode': 'નવો કોડ મોકલો',
  'login.sendCode': 'કોડ મોકલો',
  'login.passwordPlaceholder': 'તમારો CGPE પાસવર્ડ',
  'login.otpPlaceholder': '6 અંકનો કોડ',
  'login.otpChannelHint': 'ઇમેઇલ પર કોડ મેઇલથી આવશે. મોબાઇલ નંબર પર WhatsApp પર આવશે.',
  'login.errIdentifierRequired': 'તમારો ઇમેઇલ અથવા મોબાઇલ નંબર દાખલ કરો.',
  'login.errPasswordRequired': 'તમારો પાસવર્ડ દાખલ કરો.',
  'login.errIdentifierShape': 'તમારો કામનો ઇમેઇલ, અથવા 10 અંકનો મોબાઇલ નંબર દાખલ કરો.',
  'login.errEmailShape': 'આ ઇમેઇલ સરનામું બરાબર લાગતું નથી.',
  'login.errOtpRequired': 'તમારા WhatsApp સંદેશમાંનો કોડ દાખલ કરો.',
  'login.errOtpRequiredEmail': 'તમારા ઇમેઇલમાંનો કોડ દાખલ કરો.',
  'login.bannerTimeout': 'સર્વર બહુ સમય લઈ રહ્યું છે',
  'login.bannerPasswordNotSent': 'તમારી વિગતો મોકલાઈ નથી',
  'login.bannerCodeNotChecked': 'તમારો કોડ ચકાસાયો નથી',
  'login.bannerCodeRequestNotSent': 'કોડની વિનંતી મોકલાઈ નથી',
  'login.bannerSignInRefused': 'સાઇન ઇન નકારાયું',
  'login.bannerCodeNotAccepted': 'કોડ સ્વીકારાયો નથી',
  'login.bannerCodeNotSent': 'કોડ મોકલાયો નથી',
  'login.bannerSessionEnded': 'તમારું સેશન પૂરું થયું',
  'login.msgUnlockNotConfirmed': 'આ ડિવાઇસ પર અનલૉક ખાતરી થઈ નથી. ફરી પ્રયાસ કરો.',
  'login.msgCodeNotAccepted': 'આ કોડ સ્વીકારાયો નથી. તેની મુદત પૂરી થઈ ગઈ હોઈ શકે, નવો કોડ મંગાવો.',
  'login.msgQuickUnlockGone': 'ઝડપી અનલૉક હવે ઉપલબ્ધ નથી. કૃપા કરીને પાસવર્ડ અથવા OTP થી સાઇન ઇન કરો.',
  'login.msgUnlockFailed': 'અત્યારે અનલૉક થઈ શક્યું નહીં. તમારું કનેક્શન તપાસીને ફરી પ્રયાસ કરો.',
  'login.msgDetailsRefused': 'આ વિગતો સ્વીકારાઈ નથી. તપાસીને ફરી પ્રયાસ કરો.',
  'login.msgCodeCheckFailed': 'આ કોડ ચકાસી શકાયો નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.',
  'login.msgCodeSendFailed': 'કોડ મોકલી શકાયો નહીં. કૃપા કરીને ફરી પ્રયાસ કરો.',
  'login.footerHint': 'તમારા CGPE એકાઉન્ટથી સાઇન ઇન કરો. આગલી વખતે તમે ફિંગરપ્રિન્ટ કે Face ID થી ખોલી શકશો.',
  'dash.liveActivity': 'લાઇવ પ્રવૃત્તિ',

  // Batch 6f/6d/6e/5b/4b (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised. Provisional;
  // see the English block for why the machine-translation rule was waived and what it costs.
  'task.assignTo': 'કોને સોંપવું',
  'task.assignHint': 'હજુ કોઈને સોંપ્યું નથી. આ કામ તમારી પોતાની યાદીમાં જ રહેશે.',
  'task.category': 'શ્રેણી',
  'report.totalPolicies': 'કુલ પોલિસી',
  'report.lifeCover': 'કુલ લાઇફ કવર',
  'report.familyMembers': 'પરિવારના સભ્યો',
  'clients.searchSubtitle': 'તમારી આખી ક્લાયન્ટ બુકમાં શોધો',
  'lead.closeOut': 'બંધ કરો',
  'lead.closeOutFooter': 'બંધ કરેલી લીડ પાઇપલાઇન યાદીમાં તેના પોતાના સ્ટેજ હેઠળ રહે છે, તેથી કંઈ ખોવાતું નથી.',
  'common.current': 'હાલનું',
  'dash.masterControls': 'માસ્ટર કંટ્રોલ્સ',
  'dash.allTeams': 'બધી ટીમો',
  'dash.movement': 'હિલચાલ',
  'dash.analytics': 'એનાલિટિક્સ',
  'dash.campaigns': 'કેમ્પેઇન',
  'dash.totalClients': 'કુલ ક્લાયન્ટ્સ',
  'dash.claimsTotal': 'કુલ ક્લેમ્સ',
  'dash.inProcess': 'પ્રક્રિયામાં',
  'dash.claimsPaid': 'ચૂકવેલ ક્લેમ્સ',
  'home.followUpsEmptyBody': 'જન્મદિવસ, રિન્યુઅલ અને કૉલબૅક જે દિવસે બાકી હોય તે દિવસે અહીં દેખાશે.',
  'home.openFollowUps': 'ફોલો-અપ્સ ખોલો',
  'common.dueOn': '{date} બાકી',
  'common.daysLate': '{n} દિવસ મોડું',
  'common.inDays': '{n} દિવસમાં',
  'home.claimsOpen': 'ખુલ્લા ક્લેમ્સ',
  'home.portfolioAnalytics': 'પોર્ટફોલિયો એનાલિટિક્સ',
  'home.portfolioFooter': 'સમગ્ર સંસ્થાના કુલ આંકડા. પૂરી વિગત માટે એનાલિટિક્સ ખોલો.',
  'clients.restrictedTitle': 'ક્લાયન્ટ્સ ફક્ત માસ્ટર અને એડમિન માટે છે',
  'clients.restrictedBody': 'ક્લાયન્ટ ડિરેક્ટરી ફક્ત એડમિન અને માસ્ટર એકાઉન્ટ માટે ઉપલબ્ધ છે. કોઈ ક્લાયન્ટની વિગત જોઈતી હોય તો એડમિનને પૂછો.',
  'job.goneTitle': 'આ કામ હવે ચાલુ નથી',
  'job.goneBody': 'બૅકગ્રાઉન્ડનાં કામ ફક્ત એપ ખુલ્લી હોય ત્યાં સુધી જ રહે છે. તે પૂરું થઈને હટાવી દેવાયું છે.',
  'job.keepWorking': 'કામ ચાલુ રાખો, આ બૅકગ્રાઉન્ડમાં ચાલશે',
  'common.added': 'ઉમેર્યું',
  'home.vsLastPct': 'ગયા મહિના કરતાં {pct}%',
  'premium.sendAllCount': 'બધા {n}ને મોકલો',
  'doc.recordVideo': 'વિડિયો રેકોર્ડ કરો',
  'doc.videoHint': 'વિડિયો વધુમાં વધુ {seconds} સેકન્ડનો હોઈ શકે અને મોકલતા પહેલાં તમારા ફોનમાં જ નાનો કરવામાં આવે છે.',
  'doc.preparingVideo': 'વિડિયો તૈયાર થઈ રહ્યો છે…',
};

const hi: Dict = {
  'tab.home': 'आज', 'tab.tasks': 'कार्य', 'tab.leads': 'लीड्स', 'tab.clients': 'ग्राहक', 'tab.claims': 'क्लेम', 'tab.search': 'खोजें', 'tab.more': 'और',
  'tasks.title': 'मेरे कार्य', 'tasks.today': 'आज', 'tasks.overdue': 'अतिदेय', 'tasks.inProgress': 'चालू',
  'tasks.upcoming': 'आगामी', 'tasks.doneLabel': 'पूर्ण', 'tasks.dueNow': 'बाकी', 'tasks.add': 'कार्य जोड़ें',
  'tasks.todayProgress': 'आज की प्रगति', 'tasks.allClear': 'सब पूरा!', 'tasks.nothingHere': 'इस सूची में कोई कार्य नहीं.',
  'home.tasksToday': 'आज के कार्य', 'home.taskProgress': 'कार्य प्रगति', 'home.viewAll': 'सभी देखें',
  'greet.morning': 'सुप्रभात', 'greet.afternoon': 'शुभ दोपहर', 'greet.evening': 'शुभ संध्या',
  'home.commission': 'इस महीने का कमीशन', 'home.vsLast': 'पिछले महीने से', 'home.target': 'मासिक लक्ष्य',
  'home.markAttendance': 'हाज़िरी दर्ज करें', 'home.gpsCheckin': 'आज की GPS हाज़िरी',
  'home.clockedIn': 'हाज़िरी दर्ज', 'home.clockIn': 'हाज़िरी', 'home.clockOut': 'क्लॉक आउट',
  'break.start': 'ब्रेक', 'break.end': 'ब्रेक समाप्त करें',
  'break.reasonTitle': 'कारण जोड़ें (वैकल्पिक)', 'break.reasonPlaceholder': 'आप ब्रेक क्यों ले रहे हैं?',
  'break.reasonSkip': 'छोड़ें', 'break.reasonStart': 'ब्रेक शुरू करें',
  'break.minDoneTitle': 'आपने 8h 30m पूरे कर लिए हैं',
  'break.minDoneBody': 'आपने अपने न्यूनतम घंटे पूरे कर लिए हैं। ब्रेक लेना है या क्लॉक-आउट करना है?',
  'break.minDoneConfirm': 'ब्रेक लें',
  'clock.reasonTitleOut': 'क्लॉक आउट करने का कारण दर्ज करें', 'clock.reasonTitleIn': 'क्लॉक इन करने का कारण दर्ज करें',
  'clock.reasonEarly': 'आप अपनी शिफ्ट खत्म होने से पहले क्लॉक आउट कर रहे हैं। आपके मैनेजर को सूचित किया जाएगा।',
  'clock.reasonAway': 'आप ऑफिस से दूर हैं। आपके मैनेजर को सूचित किया जाएगा।',
  'clock.reasonNeededTitleOut': 'क्लॉक आउट करने के लिए कारण आवश्यक है', 'clock.reasonNeededBodyOut': 'कृपया यहाँ क्लॉक आउट करने का संक्षिप्त कारण दर्ज करें।',
  'clock.reasonNeededTitleIn': 'क्लॉक इन करने के लिए कारण आवश्यक है', 'clock.reasonNeededBodyIn': 'कृपया यहाँ क्लॉक इन करने का संक्षिप्त कारण दर्ज करें।',
  'home.hotLeads': 'हॉट लीड्स', 'home.openClaims': 'खुले क्लेम', 'home.renewals': 'रिन्यूअल',
  'home.quickActions': 'त्वरित क्रियाएँ', 'home.followups': 'आज के फ़ॉलो-अप', 'home.quickContacts': 'त्वरित संपर्क',
  'home.allCaught': 'सब पूरा!', 'home.noFollowups': 'अभी कोई फ़ॉलो-अप बाकी नहीं.',
  'act.newLead': 'नई लीड', 'act.newClaim': 'नया क्लेम', 'act.whatsapp': 'व्हाट्सएप', 'act.licPlans': 'LIC प्लान',
  'act.calendar': 'कैलेंडर', 'act.contests': 'प्रतियोगिताएँ', 'act.premiumDue': 'प्रीमियम देय', 'act.birthdays': 'जन्मदिन',
  'common.signIn': 'साइन इन', 'common.signOut': 'साइन आउट', 'common.cancel': 'रद्द करें', 'common.send': 'भेजें',
  'common.call': 'कॉल', 'common.whatsapp': 'व्हाट्सएप', 'common.seeAll': 'सभी देखें', 'common.search': 'खोजें',
  'common.pipeline': 'पाइपलाइन', 'common.delete': 'डिलीट', 'common.save': 'सहेजें', 'common.today': 'आज',
  'premium.title': 'प्रीमियम और शुभकामनाएँ', 'premium.dueThisMonth': 'इस महीने प्रीमियम देय', 'premium.birthdaysThisMonth': 'इस महीने के जन्मदिन',
  'premium.sendReminder': 'रिमाइंडर भेजें', 'premium.sendAll': 'सभी को भेजें', 'premium.oneClick': 'एक टैप से हर ग्राहक को व्यक्तिगत व्हाट्सएप संदेश जाता है.',
  'premium.renewalDue': 'रिन्यूअल देय', 'premium.maturitySoon': 'मैच्योरिटी नज़दीक', 'premium.anniversaries': 'एनिवर्सरी',
  'report.generate': 'ग्राहक रिपोर्ट बनाएँ', 'report.generating': 'रिपोर्ट बन रही है…', 'report.title': 'ग्राहक रिपोर्ट',
  'signout.title': 'साइन आउट करें?', 'signout.msg': 'क्या आप वाकई CGPE Connect से साइन आउट करना चाहते हैं?',
  'settings.language': 'ऐप भाषा', 'settings.title': 'सेटिंग्स',
  'consent.title': 'काम के लिए लोकेशन शेयरिंग',
  'consent.intro': 'कृपया शुरू करने से पहले इसे ध्यान से पढ़ें। CGPE Connect आपकी लोकेशन शेयर करता है ताकि कंपनी फील्ड टीम को मैनेज कर सके।',
  'consent.collect': 'क्या शेयर किया जाता है: आपकी सटीक लोकेशन और आपकी मूवमेंट/एक्टिविटी, 24 घंटे — जिसमें आपके काम के घंटों के बाहर का समय भी शामिल है।',
  'consent.why': 'क्यों: ताकि कंपनी फील्ड टीम को सही ढंग से मैनेज और सपोर्ट कर सके।',
  'consent.who': 'कौन देख सकता है: केवल कंपनी के मास्टर (Master)। आपके सहकर्मी आपकी लोकेशन नहीं देख सकते।',
  'consent.retention': 'कितने समय तक रखा जाता है: आपकी लोकेशन हिस्ट्री 90 दिनों के बाद हाइड कर दी जाएगी और 180 दिनों के बाद हमेशा के लिए डिलीट कर दी जाएगी।',
  'consent.transparent': 'आपसे कुछ भी छिपा नहीं है: जब भी लोकेशन शेयर हो रही होगी, आपके फोन के स्टेटस बार में नोटिफिकेशन हमेशा रहेगा। आपको हमेशा पता रहेगा कि यह चालू है।',
  'consent.mandatory': 'CGPE Connect वर्क ऐप का उपयोग करने के लिए यह अनिवार्य है। यदि आप सहमत नहीं हैं, तो आप आगे नहीं बढ़ सकते।',
  'consent.withdraw': 'आप इसे बाद में बंद कर सकते हैं, लेकिन जब तक आप इसे दोबारा चालू नहीं करते तब तक ऐप काम करना बंद कर देगा, और बंद करने पर मास्टर को सूचित किया जाएगा।',
  'consent.agreeButton': 'मैं सहमत हूँ',
  'consent.declineButton': 'मैं सहमत नहीं हूँ',
  'consent.declineTitle': 'सहमत हुए बिना आप आगे नहीं बढ़ सकते',
  'consent.declineBody': 'इस वर्क ऐप के लिए आपकी लोकेशन शेयर करना अनिवार्य है। यदि आपके कोई प्रश्न हैं, तो कृपया अपने मैनेजर से बात करें।',
  'consent.declineBack': 'वापस जाएं',
  'consent.serviceTitle': 'CGPE Connect',
  'consent.serviceBody': 'काम के लिए लोकेशन चालू है',
  'consent.blockedTitle': 'CGPE Connect का उपयोग करने के लिए लोकेशन दोबारा चालू करें',
  'consent.blockedBody': 'इस ऐप के लिए लोकेशन शेयरिंग अनिवार्य है। आगे बढ़ने के लिए कृपया लोकेशन और "Allow all the time" परमिशन दोबारा चालू करें।',
  'consent.blockedAction': 'सेटिंग्स खोलें',
  // D4 + D6b (owner copy, 2026-08-22)
  'tasks.viewWeek': 'इस हफ्ते', 'tasks.viewMonth': 'इस महीने', 'tasks.viewCalendar': 'कैलेंडर',
  'tasks.tomorrow': 'आने वाला कल', 'tasks.yesterday': 'बीता हुआ कल',
  'tasks.emptyTodayTitle': 'आज कुछ भी बाकी नहीं है',
  'tasks.emptyTodayBody': 'आज सब क्लियर है — आज कुछ भी बाकी नहीं है और कुछ भी ओवरड्यू नहीं है। बाकी दिन की योजना बनाने के लिए एक टास्क जोड़ें।',
  'tasks.emptyWeekTitle': 'इस हफ्ते कुछ नहीं है',
  'tasks.emptyWeekBody': 'इस हफ्ते कोई टास्क नहीं है। आगे के टास्क देखने के लिए इस महीने या कैलेंडर को देखें।',
  'tasks.emptyMonthTitle': 'इस महीने कुछ नहीं है',
  'tasks.emptyMonthBody': 'इस कैलेंडर महीने में कोई टास्क शेड्यूल नहीं है।',
  'tasks.emptyCalendarBody': 'चुने गए दिन कोई टास्क बाकी नहीं है। ऊपर दिए गए कैलेंडर से कोई दूसरा दिन चुनें।',
  'guide.welcome': 'स्वागत है', 'guide.title': 'आपका दिन 3 स्टेप्स में',
  'guide.step1Title': 'क्लॉक इन', 'guide.step1Body': 'ऑफिस पहुँचने के बाद अपना दिन शुरू करने के लिए Clock in पर टैप करें।',
  'guide.step2Title': 'आज के टास्क देखें', 'guide.step2Body': 'आज का आपका काम इसी स्क्रीन पर यहाँ दिया गया है।',
  'guide.step3Title': 'पूरा मार्क करें', 'guide.step3Body': 'टास्क पूरा होने के बाद उसे स्वाइप करें या टिक पर टैप करें।',
  'guide.gotIt': 'समझ गया',
  'storage.title': 'स्टोरेज',
  'storage.description': 'ऐप द्वारा अस्थायी रूप से सेव की गई फ़ाइलें और डाउनलोड प्रबंधित करें।',
  'storage.clear': 'कैश किए गए डाउनलोड साफ़ करें',
  'storage.clearing': 'कैश साफ़ किया जा रहा है…',
  'storage.confirmTitle': 'कैश साफ़ करें?',
  'storage.confirmBody': 'यह ऐप द्वारा सेव की गई अस्थायी फ़ाइलें हटा देगा। आपकी मूल फ़ाइलें प्रभावित नहीं होंगी।',
  'storage.clearCta': 'साफ़ करें',
  'storage.doneBody': 'अस्थायी फ़ाइलें सफलतापूर्वक हटा दी गई हैं।',
  'storage.partialBody': 'कुछ अस्थायी फ़ाइलें हटाई नहीं जा सकीं। आप दोबारा कोशिश कर सकते हैं।',
  'storage.failBody': 'अस्थायी फ़ाइलें हटाते समय समस्या हुई। कृपया दोबारा कोशिश करें।',
  'storage.installNote': 'ऐप का अपना इंस्टॉल साइज़ नहीं बदलता — सही स्टोरेज जानकारी देखने के लिए अपने फ़ोन में Settings › Apps › CGPE Connect › Storage खोलें।',
  'common.tryAgain': 'फिर से कोशिश करें',
  'common.clearSearch': 'खोज साफ़ करें',
  'common.refresh': 'रीफ़्रेश करें',
  'common.offlineBody': 'सर्वर से संपर्क नहीं हो सका। अपना कनेक्शन जाँचें और फिर से कोशिश करें।',
  'common.loadMore': 'और लोड करें',
  'common.all': 'सभी',
  'common.done': 'पूरा',
  'common.clear': 'साफ़ करें',
  'common.continue': 'जारी रखें',
  'common.showResults': 'परिणाम दिखाएँ',
  'common.saving': 'सेव हो रहा है…',
  'common.uploading': 'अपलोड हो रहा है…',
  'common.mobile': 'मोबाइल',
  'common.onDuty': 'ड्यूटी पर',
  'common.offDuty': 'ड्यूटी पर नहीं',
  'common.goToSignIn': 'साइन इन पर जाएँ',
  'common.a11yCall': '{name} को कॉल करें',
  'common.a11yWhatsapp': '{name} के साथ WhatsApp चैट खोलें',
  'common.close': 'बंद करें',
  'health.slow': 'सर्वर धीरे जवाब दे रहा है',
  'health.offline': 'नेटवर्क से संपर्क नहीं हो सका',
  'health.server': 'सर्वर में समस्या आई',
  'health.someData': 'कुछ डेटा लोड नहीं हो सका',
  'health.oneRequest': 'एक अनुरोध पूरा नहीं हो सका। कुछ जानकारी गायब या पुरानी हो सकती है।',
  'health.manyRequests': '{n} अनुरोध पूरे नहीं हो सके। कुछ जानकारी गायब या पुरानी हो सकती है।',
  'health.a11yUnconfirmed': '{n} अनुरोध पूरे नहीं हो सके। खाली मानों की पुष्टि नहीं हुई है।',
  'common.dismiss': 'बंद करें',
  'common.confirm': 'पुष्टि करें',
  'lock.title': 'ऐप लॉक है',
  'lock.body': 'अपने फ़िंगरप्रिंट, Face ID या डिवाइस पासकोड से CGPE Connect अनलॉक करें।',
  'lock.verifying': 'सत्यापन हो रहा है…',
  'lock.unlock': 'अनलॉक करें',
  'sync.pending': 'सिंक बाकी है',
  'sync.syncedAt': '{time} पर सिंक हुआ · जानकारी पुरानी हो सकती है',
  'sync.savedLocal': 'इस डिवाइस पर सेव हो गया है — ऑनलाइन होने पर सिंक हो जाएगा।',
  'sync.savedLocalNamed': '{name} इस डिवाइस पर सेव हो गया है — ऑनलाइन होने पर सिंक हो जाएगा',
  'sync.droppedOne': 'एक ऑफ़लाइन बदलाव सेव नहीं हो सका और हटा दिया गया।',
  'sync.droppedMany': '{n} ऑफ़लाइन बदलाव सेव नहीं हो सके और हटा दिए गए।',
  'doc.attachTitle': 'दस्तावेज़ अटैच करें',
  'doc.attachSubtitle': 'नई फ़ोटो लें या अपने फ़ोन में पहले से मौजूद चीज़ चुनें',
  'doc.takePhoto': 'फ़ोटो लें',
  'doc.gallery': 'गैलरी से चुनें',
  'doc.file': 'फ़ाइल चुनें',
  'filter.title': 'फ़िल्टर',
  'filter.applied': '{n} फ़िल्टर लागू हैं',
  'filter.showingAll': 'सभी दिखाए जा रहे हैं',
  'filter.reset': 'रीसेट करें',
  'common.add': 'जोड़ें',
  'common.increase': 'बढ़ाएँ',
  'common.decrease': 'घटाएँ',
  'common.hidePassword': 'पासवर्ड छिपाएँ',
  'common.showPassword': 'पासवर्ड दिखाएँ',
  'common.goBack': 'वापस जाएँ',
  'common.copyLabel': '{label} कॉपी करें',
  'map.loading': 'मैप लोड हो रहा है',
  'map.pointsHere': 'यहाँ {n} पॉइंट हैं',
  'map.andMore': 'और {n}',
  'stage.new': 'नया',
  'stage.meeting': 'मीटिंग',
  'stage.docsShared': 'दस्तावेज़ साझा किए',
  'stage.policyIssued': 'पॉलिसी जारी हुई',
  'stage.lost': 'खो गया',
  'claimStatus.intake': 'इनटेक',
  'claimStatus.docsPending': 'दस्तावेज़ लंबित',
  'claimStatus.review': 'समीक्षा में',
  'claimStatus.submitted': 'जमा किया गया',
  'claimStatus.settled': 'निपटाया गया',
  'claimStatus.rejected': 'अस्वीकृत',
  'seg.renewal': 'रिन्यूअल बाकी',
  'seg.maturity': 'मैच्योरिटी जल्द',
  'seg.birthday': 'जन्मदिन',
  'seg.crossSell': 'क्रॉस-सेल',
  'seg.hot': 'हॉट',
  'taskStatus.todo': 'करना है',
  'taskStatus.inProgress': 'काम जारी है',
  'taskStatus.blocked': 'रुका हुआ',
  'taskStatus.done': 'पूरा',
  'priority.high': 'उच्च',
  'priority.medium': 'मध्यम',
  'priority.low': 'कम',
  'task.followUp': 'फ़ॉलो-अप',
  'home.clockedInAt': '{time} पर क्लॉक इन किया',

  // Batch 6a (2026-08-27) — owner-supplied, human-written. See the English block for the six
  // supplied rows that add no key here.
  'claims.inRegister': 'रजिस्टर में',
  'claims.paidOut': 'भुगतान किया गया',
  'claims.pending': 'लंबित',
  'claims.yours': 'आपके क्लेम',
  'claims.stillInProgress': 'अभी प्रक्रिया में',
  'claims.filterReview': 'समीक्षा',
  'filter.segment': 'सेगमेंट',
  'filter.next30': 'अगले 30 दिन',
  'filter.later': 'बाद में',
  'filter.contact': 'संपर्क',
  'filter.hasPhone': 'फ़ोन उपलब्ध',
  'filter.noPhone': 'फ़ोन उपलब्ध नहीं',
  'common.dueToday': 'आज देय',
  'common.followUps': 'फ़ॉलो-अप',
  'home.openTickets': 'ओपन टिकट',
  'home.activeLeads': 'सक्रिय लीड',
  'common.reminders': 'रिमाइंडर',
  'common.tickets': 'टिकट',
  'search.whereItLooks': 'कहाँ खोज होती है',
  'search.whereFooterClients': 'क्लाइंट और टिकट सर्वर पर मैच किए जाते हैं, इसलिए केवल इस डिवाइस पर लोड की गई जानकारी में नहीं, बल्कि पूरी क्लाइंट बुक में खोज होती है। चार या उससे अधिक अंक मोबाइल नंबर के आखिरी अंकों से मैच होंगे।',
  'search.whereFooterTickets': 'टिकट सर्वर पर मैच किए जाते हैं। चार या उससे अधिक अंक मोबाइल नंबर के आखिरी अंकों से मैच होंगे।',
  'search.rowClients': 'क्लाइंट',
  'search.rowClientsHint': 'नाम, मोबाइल, पॉलिसी, ईमेल',
  'search.rowLeads': 'लीड',
  'search.rowLeadsHint': 'नाम, मोबाइल, रुचि',
  'search.rowClaims': 'क्लेम',
  'search.rowClaimsHint': 'रेफरेंस, नाम, पॉलिसी',
  'search.rowTicketsHint': 'रेफरेंस, नाम, अनुरोध',
  'search.rowTasks': 'टास्क',
  'search.rowTasksHint': 'शीर्षक, क्लाइंट, विवरण',
  'premium.birthdaysToday': 'आज जन्मदिन',
  'home.notClockedIn': 'क्लॉक-इन नहीं किया',
  'premium.renewalsDue': 'देय रिन्यूअल',
  'premium.reachable': 'संपर्क योग्य',
  'common.inTheBook': 'क्लाइंट बुक में',
  'client.annualPremium': 'वार्षिक प्रीमियम',
  'client.policies': 'पॉलिसियाँ',
  'client.maturity': 'मैच्योरिटी',
  'lead.closedAsLost': 'लॉस्ट के रूप में बंद',
  'lead.pipelineProgress': 'पाइपलाइन प्रगति',
  'lead.notProceeding': 'आगे नहीं बढ़ रहा',
  'task.due': 'देय तारीख',
  'task.keep': 'जैसा है रखें',
  'task.inAWeek': 'एक हफ्ते में',
  'task.priority': 'प्राथमिकता',
  'team.premiumMtd': 'प्रीमियम (इस महीने)',
  'team.doneMtd': 'पूरे हुए (इस महीने)',
  'team.completion': 'पूर्णता',
  'team.openWork': 'लंबित काम',
  'dash.online': 'ऑनलाइन',
  'dash.openTasks': 'ओपन टास्क',
  'dash.clientBook': 'क्लाइंट बुक',
  'dash.claimsInProcess': 'प्रक्रिया में क्लेम',
  'dash.adminActions': 'एडमिन एक्शन',
  'dash.assignTask': 'टास्क असाइन करें',
  'dash.sendRenewals': 'रिन्यूअल भेजें',
  'dash.team': 'टीम',
  'dash.agentMap': 'एजेंट मैप',

  // Batch 5, the sign-in screen (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised.
  // Provisional; see the machine-translation note in the English dictionary. The rest of
  // the request's Batch 5 (session.*, net.*, biometric.prompt, login.codeSent*) lives in
  // modules with NO React translator and would be zero-consumer here, so it is NOT added.
  'login.modePassword': 'पासवर्ड',
  'login.modeOtp': 'OTP',
  'login.eyebrow': 'सुरक्षित साइन इन',
  'login.welcome': 'फिर से स्वागत है',
  'login.unlockWithFingerprint': 'फ़िंगरप्रिंट से खोलें',
  'login.orSignIn': 'या साइन इन करें',
  'login.identifierLabel': 'ईमेल या मोबाइल नंबर',
  'login.passwordLabel': 'पासवर्ड',
  'login.unlockAndSignIn': 'खोलें और साइन इन करें',
  'login.otpLabel': 'कोड दर्ज करें',
  'login.verifyAndSignIn': 'जाँचें और साइन इन करें',
  'login.resendCode': 'नया कोड भेजें',
  'login.sendCode': 'कोड भेजें',
  'login.passwordPlaceholder': 'आपका CGPE पासवर्ड',
  'login.otpPlaceholder': '6 अंकों का कोड',
  'login.otpChannelHint': 'ईमेल पर कोड मेल से आएगा। मोबाइल नंबर पर WhatsApp पर आएगा।',
  'login.errIdentifierRequired': 'अपना ईमेल या मोबाइल नंबर दर्ज करें।',
  'login.errPasswordRequired': 'अपना पासवर्ड दर्ज करें।',
  'login.errIdentifierShape': 'अपना काम का ईमेल, या 10 अंकों का मोबाइल नंबर दर्ज करें।',
  'login.errEmailShape': 'यह ईमेल पता सही नहीं लग रहा।',
  'login.errOtpRequired': 'अपने WhatsApp संदेश वाला कोड दर्ज करें।',
  'login.errOtpRequiredEmail': 'अपने ईमेल वाला कोड दर्ज करें।',
  'login.bannerTimeout': 'सर्वर बहुत समय ले रहा है',
  'login.bannerPasswordNotSent': 'आपकी जानकारी भेजी नहीं गई',
  'login.bannerCodeNotChecked': 'आपका कोड जाँचा नहीं गया',
  'login.bannerCodeRequestNotSent': 'कोड का अनुरोध भेजा नहीं गया',
  'login.bannerSignInRefused': 'साइन इन अस्वीकार',
  'login.bannerCodeNotAccepted': 'कोड स्वीकार नहीं हुआ',
  'login.bannerCodeNotSent': 'कोड भेजा नहीं गया',
  'login.bannerSessionEnded': 'आपका सेशन खत्म हो गया',
  'login.msgUnlockNotConfirmed': 'इस डिवाइस पर अनलॉक पुष्टि नहीं हुई। दोबारा कोशिश करें।',
  'login.msgCodeNotAccepted': 'यह कोड स्वीकार नहीं हुआ। इसकी अवधि खत्म हो गई हो सकती है, नया कोड मंगाएँ।',
  'login.msgQuickUnlockGone': 'क्विक अनलॉक अब उपलब्ध नहीं है। कृपया पासवर्ड या OTP से साइन इन करें।',
  'login.msgUnlockFailed': 'अभी अनलॉक नहीं हो सका। अपना कनेक्शन जाँचकर दोबारा कोशिश करें।',
  'login.msgDetailsRefused': 'यह जानकारी स्वीकार नहीं हुई। जाँचकर दोबारा कोशिश करें।',
  'login.msgCodeCheckFailed': 'यह कोड जाँचा नहीं जा सका। कृपया दोबारा कोशिश करें।',
  'login.msgCodeSendFailed': 'कोड भेजा नहीं जा सका। कृपया दोबारा कोशिश करें।',
  'login.footerHint': 'अपने CGPE अकाउंट से साइन इन करें। अगली बार आप फ़िंगरप्रिंट या Face ID से खोल सकेंगे।',
  'dash.liveActivity': 'लाइव गतिविधि',

  // Batch 6f/6d/6e/5b/4b (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised. Provisional;
  // see the English block for why the machine-translation rule was waived and what it costs.
  'task.assignTo': 'किसे सौंपें',
  'task.assignHint': 'अभी किसी को नहीं सौंपा गया है। यह काम आपकी अपनी सूची में ही रहेगा।',
  'task.category': 'श्रेणी',
  'report.totalPolicies': 'कुल पॉलिसी',
  'report.lifeCover': 'कुल लाइफ कवर',
  'report.familyMembers': 'परिवार के सदस्य',
  'clients.searchSubtitle': 'अपनी पूरी क्लाइंट बुक में खोजें',
  'lead.closeOut': 'बंद करें',
  'lead.closeOutFooter': 'बंद की गई लीड पाइपलाइन सूची में अपने स्टेज के अंतर्गत बनी रहती है, इसलिए कुछ भी नहीं खोता।',
  'common.current': 'मौजूदा',
  'dash.masterControls': 'मास्टर कंट्रोल',
  'dash.allTeams': 'सभी टीमें',
  'dash.movement': 'मूवमेंट',
  'dash.analytics': 'एनालिटिक्स',
  'dash.campaigns': 'कैंपेन',
  'dash.totalClients': 'कुल क्लाइंट',
  'dash.claimsTotal': 'कुल क्लेम',
  'dash.inProcess': 'प्रक्रिया में',
  'dash.claimsPaid': 'भुगतान किए गए क्लेम',
  'home.followUpsEmptyBody': 'जन्मदिन, रिन्यूअल और कॉलबैक जिस दिन देय होंगे उसी दिन यहाँ दिखेंगे।',
  'home.openFollowUps': 'फ़ॉलो-अप खोलें',
  'common.dueOn': '{date} देय',
  'common.daysLate': '{n} दिन की देरी',
  'common.inDays': '{n} दिन में',
  'home.claimsOpen': 'खुले क्लेम',
  'home.portfolioAnalytics': 'पोर्टफोलियो एनालिटिक्स',
  'home.portfolioFooter': 'पूरी संस्था के कुल आंकड़े। पूरा ब्यौरा देखने के लिए एनालिटिक्स खोलें।',
  'clients.restrictedTitle': 'क्लाइंट केवल मास्टर और एडमिन के लिए हैं',
  'clients.restrictedBody': 'क्लाइंट डायरेक्ट्री केवल एडमिन और मास्टर अकाउंट के लिए उपलब्ध है। किसी क्लाइंट की जानकारी चाहिए तो एडमिन से पूछें।',
  'job.goneTitle': 'यह काम अब नहीं चल रहा',
  'job.goneBody': 'बैकग्राउंड के काम सिर्फ़ ऐप खुली रहने तक ही रखे जाते हैं। यह पूरा होकर हटा दिया गया है।',
  'job.keepWorking': 'काम करते रहिए, यह बैकग्राउंड में चलता रहेगा',
  'common.added': 'जोड़ा गया',
  'home.vsLastPct': 'पिछले महीने से {pct}%',
  'premium.sendAllCount': 'सभी {n} को भेजें',
  'doc.recordVideo': 'वीडियो रिकॉर्ड करें',
  'doc.videoHint': 'वीडियो ज़्यादा से ज़्यादा {seconds} सेकंड का हो सकता है और भेजने से पहले आपके फ़ोन में ही छोटा कर दिया जाता है।',
  'doc.preparingVideo': 'वीडियो तैयार हो रहा है…',
};

/**
 * HINGLISH — Hindi vocabulary in the Roman alphabet.
 * Hindi possessives (ka / ki / ke), Hindi verbs (bhejein, dekhein, jodein, banayein) and
 * the Hindi copula (hai / hain). Business nouns stay English.
 */
const hiEn: Dict = {
  'tab.home': 'Aaj', 'tab.tasks': 'Kaam', 'tab.leads': 'Leads', 'tab.clients': 'Client', 'tab.claims': 'Claim', 'tab.search': 'Search', 'tab.more': 'Aur',
  'tasks.title': 'Mere kaam', 'tasks.today': 'Aaj', 'tasks.overdue': 'Bakaya', 'tasks.inProgress': 'Chalu',
  'tasks.upcoming': 'Aane wale', 'tasks.doneLabel': 'Ho gaya', 'tasks.dueNow': 'baaki hain', 'tasks.add': 'Kaam jodein',
  'tasks.todayProgress': 'Aaj ki progress', 'tasks.allClear': 'Sab poora!', 'tasks.nothingHere': 'Is list mein koi kaam nahi hai.',
  'home.tasksToday': 'Aaj ke kaam', 'home.taskProgress': 'Kaam ki progress', 'home.viewAll': 'Sab dekhein',
  'greet.morning': 'Suprabhat', 'greet.afternoon': 'Shubh dopahar', 'greet.evening': 'Shubh sandhya',
  'home.commission': 'Is mahine ka commission', 'home.vsLast': 'pichhle mahine se', 'home.target': 'Mahine ka target',
  'home.markAttendance': 'Haazri lagayein', 'home.gpsCheckin': 'Aaj ki GPS haazri',
  'home.clockedIn': 'Haazri lag gayi', 'home.clockIn': 'Haazri lagayein', 'home.clockOut': 'Clock out',
  'break.start': 'Break', 'break.end': 'Break khatam karein',
  'break.reasonTitle': 'Reason dalein (optional)', 'break.reasonPlaceholder': 'Aap break kyu le rahe hain?',
  'break.reasonSkip': 'Skip karein', 'break.reasonStart': 'Break shuru karein',
  'break.minDoneTitle': 'Aapne 8h 30m complete kar liye hain',
  'break.minDoneBody': 'Aapne minimum hours complete kar liye hain. Break lena hai ya clock out?',
  'break.minDoneConfirm': 'Break lein',
  'clock.reasonTitleOut': 'Clock out karne ka reason add karein', 'clock.reasonTitleIn': 'Clock in karne ka reason add karein',
  'clock.reasonEarly': 'Aap apni shift khatam hone se pehle clock out kar rahe hain. Aapke manager ko notify kiya jayega.',
  'clock.reasonAway': 'Aap office se door hain. Aapke manager ko notify kiya jayega.',
  'clock.reasonNeededTitleOut': 'Clock out karne ke liye reason zaroori hai', 'clock.reasonNeededBodyOut': 'Please yahan clock out karne ka short reason add karein.',
  'clock.reasonNeededTitleIn': 'Clock in karne ke liye reason zaroori hai', 'clock.reasonNeededBodyIn': 'Please yahan clock in karne ka short reason add karein.',
  'home.hotLeads': 'Hot leads', 'home.openClaims': 'Khule claim', 'home.renewals': 'Renewal',
  'home.quickActions': 'Turant kaam', 'home.followups': 'Aaj ke follow-up', 'home.quickContacts': 'Turant contact',
  'home.allCaught': 'Sab ho gaya!', 'home.noFollowups': 'Abhi koi follow-up baaki nahi hai.',
  'act.newLead': 'Nayi lead', 'act.newClaim': 'Naya claim', 'act.whatsapp': 'WhatsApp', 'act.licPlans': 'LIC plan',
  'act.calendar': 'Calendar', 'act.contests': 'Contest', 'act.premiumDue': 'Premium bakaya', 'act.birthdays': 'Janmdin',
  'common.signIn': 'Sign in', 'common.signOut': 'Sign out', 'common.cancel': 'Radd karein', 'common.send': 'Bhejein',
  'common.call': 'Call', 'common.whatsapp': 'WhatsApp', 'common.seeAll': 'Sab dekhein', 'common.search': 'Khojein',
  'common.pipeline': 'Pipeline', 'common.delete': 'Delete', 'common.save': 'Save karein', 'common.today': 'Aaj',
  'premium.title': 'Premium aur shubhkamnaein', 'premium.dueThisMonth': 'Is mahine premium bakaya', 'premium.birthdaysThisMonth': 'Is mahine ke janmdin',
  'premium.sendReminder': 'Reminder bhejein', 'premium.sendAll': 'Sabko bhejein', 'premium.oneClick': 'Ek tap se har matching client ko personal WhatsApp message chala jata hai.',
  'premium.renewalDue': 'Renewal bakaya', 'premium.maturitySoon': 'Maturity nazdeek', 'premium.anniversaries': 'Anniversary',
  'report.generate': 'Client report banayein', 'report.generating': 'Report ban rahi hai…', 'report.title': 'Client report',
  'signout.title': 'Sign out karein?', 'signout.msg': 'Kya aap sach mein CGPE Connect se sign out karna chahte hain?',
  'settings.language': 'App ki bhasha', 'settings.title': 'Settings',
  'consent.title': 'Work ke liye location sharing',
  'consent.intro': 'Kripya shuru karne se pehle ise dhyan se padhein. CGPE Connect aapki location share karta hai taaki company field team ko manage kar sake.',
  'consent.collect': 'Kya share hota hai: aapki precise location aur movement/activity, 24 ghante — jisme aapke working hours ke bahar ka time bhi shamil hai.',
  'consent.why': 'Kyun: taaki company field team ko theek se manage aur support kar sake.',
  'consent.who': 'Kaun dekh sakta hai: sirf company Master. Aapke colleagues aapki location nahi dekh sakte.',
  'consent.retention': 'Kitne time tak rakha jata hai: aapki location history 90 days ke baad hide ho jayegi aur 180 days ke baad permanently delete ho jayegi.',
  'consent.transparent': 'Aapse kuch bhi chhupa nahi hai: jab bhi location share ho rahi hogi, aapke phone ke status bar me notification hamesha rahega. Aapko hamesha pata rahega ki yeh on hai.',
  'consent.mandatory': 'CGPE Connect work app use karne ke liye yeh mandatory hai. Agar aap agree nahi karte, toh aap aage nahi badh sakte.',
  'consent.withdraw': 'Aap ise baad me band kar sakte hain, lekin jab tak aap ise wapas on nahi karte tab tak app kaam karna band kar degi, aur band karne par Master ko notify kiya jayega.',
  'consent.agreeButton': 'Main sehmat hoon',
  'consent.declineButton': 'Main sehmat nahi hoon',
  'consent.declineTitle': 'Agree kiye bina aap aage nahi badh sakte',
  'consent.declineBody': 'Is work app ke liye location share karna mandatory hai. Agar aapka koi sawaal hai, toh kripya apne manager se baat karein.',
  'consent.declineBack': 'Wapas jayein',
  'consent.serviceTitle': 'CGPE Connect',
  'consent.serviceBody': 'Work ke liye location on hai',
  'consent.blockedTitle': 'CGPE Connect use karne ke liye location wapas on karein',
  'consent.blockedBody': 'Is app ke liye location sharing mandatory hai. Aage badhne ke liye kripya location aur "Allow all the time" permission wapas on karein.',
  'consent.blockedAction': 'Settings kholein',
  // D4 + D6b (owner copy, 2026-08-22)
  'tasks.viewWeek': 'Is hafte', 'tasks.viewMonth': 'Is mahine', 'tasks.viewCalendar': 'Calendar',
  'tasks.tomorrow': 'Aane wala kal', 'tasks.yesterday': 'Beeta hua kal',
  'tasks.emptyTodayTitle': 'Aaj kuch bhi due nahi hai',
  'tasks.emptyTodayBody': 'Aaj sab clear hai — kuch bhi due nahi hai aur kuch bhi overdue nahi hai. Baaki din plan karne ke liye ek task add karein.',
  'tasks.emptyWeekTitle': 'Is hafte kuch nahi hai',
  'tasks.emptyWeekBody': 'Is hafte koi task nahi hai. Aage ke tasks dekhne ke liye This month ya Calendar dekhein.',
  'tasks.emptyMonthTitle': 'Is mahine kuch nahi hai',
  'tasks.emptyMonthBody': 'Is calendar month mein koi task scheduled nahi hai.',
  'tasks.emptyCalendarBody': 'Selected din par koi task due nahi hai. Upar wale calendar se koi doosra din select karein.',
  'guide.welcome': 'Swagat hai', 'guide.title': 'Aapka din 3 steps mein',
  'guide.step1Title': 'Clock in', 'guide.step1Body': 'Office pahunchne ke baad apna din start karne ke liye Clock in par tap karein.',
  'guide.step2Title': 'Aaj ke tasks dekhein', 'guide.step2Body': 'Aaj ka aapka kaam isi screen par yahin listed hai.',
  'guide.step3Title': 'Done mark karein', 'guide.step3Body': 'Task complete hone ke baad use swipe karein ya tick par tap karein.',
  'guide.gotIt': 'Samajh gaya',
  'storage.title': 'Storage',
  'storage.description': 'App ke temporary saved files aur downloads manage karein.',
  'storage.clear': 'Cached downloads saaf karein',
  'storage.clearing': 'Cache clear ho raha hai…',
  'storage.confirmTitle': 'Cache clear karein?',
  'storage.confirmBody': 'Isse app ke temporary saved files remove ho jayenge. Aapki original files par koi asar nahi padega.',
  'storage.clearCta': 'Clear',
  'storage.doneBody': 'Temporary files successfully remove ho gayi hain.',
  'storage.partialBody': 'Kuch temporary files remove nahi ho saki. Aap dobara try kar sakte hain.',
  'storage.failBody': 'Temporary files remove karte waqt problem aayi. Please dobara try karein.',
  'storage.installNote': 'App ka apna install size change nahi hota — actual storage figures dekhne ke liye phone mein Settings › Apps › CGPE Connect › Storage kholein.',
  'common.tryAgain': 'Dobara try karein',
  'common.clearSearch': 'Search clear karein',
  'common.refresh': 'Refresh karein',
  'common.offlineBody': 'Server se connect nahi ho saka. Apna connection check karein aur dobara try karein.',
  'common.loadMore': 'Aur load karein',
  'common.all': 'Sabhi',
  'common.done': 'Ho gaya',
  'common.clear': 'Clear karein',
  'common.continue': 'Aage badhein',
  'common.showResults': 'Results dikhayein',
  'common.saving': 'Save ho raha hai…',
  'common.uploading': 'Upload ho raha hai…',
  'common.mobile': 'Mobile',
  'common.onDuty': 'Duty par',
  'common.offDuty': 'Duty par nahi',
  'common.goToSignIn': 'Sign in par jayein',
  'common.a11yCall': '{name} ko call karein',
  'common.a11yWhatsapp': '{name} ke saath WhatsApp chat kholein',
  'common.close': 'Band karein',
  'health.slow': 'Server slowly respond kar raha hai',
  'health.offline': 'Network se connect nahi ho saka',
  'health.server': 'Server mein problem aayi',
  'health.someData': 'Kuch data load nahi ho saka',
  'health.oneRequest': 'Ek request complete nahi ho saki. Kuch values missing ya outdated ho sakti hain.',
  'health.manyRequests': '{n} requests complete nahi ho saki. Kuch values missing ya outdated ho sakti hain.',
  'health.a11yUnconfirmed': '{n} request(s) complete nahi ho saki. Blank values confirm nahi hui hain.',
  'common.dismiss': 'Band karein',
  'common.confirm': 'Confirm karein',
  'lock.title': 'App locked hai',
  'lock.body': 'Fingerprint, Face ID ya device passcode se CGPE Connect unlock karein.',
  'lock.verifying': 'Verify ho raha hai…',
  'lock.unlock': 'Unlock karein',
  'sync.pending': 'Sync pending hai',
  'sync.syncedAt': '{time} par sync hua · data outdated ho sakta hai',
  'sync.savedLocal': 'Is device par save ho gaya hai — online aane par sync ho jayega.',
  'sync.savedLocalNamed': '{name} is device par save ho gaya hai — online aane par sync ho jayega',
  'sync.droppedOne': 'Ek offline change save nahi ho saka aur remove kar diya gaya.',
  'sync.droppedMany': '{n} offline changes save nahi ho sake aur remove kar diye gaye.',
  'doc.attachTitle': 'Document attach karein',
  'doc.attachSubtitle': 'Nayi photo lein ya phone mein pehle se maujood file choose karein',
  'doc.takePhoto': 'Photo lein',
  'doc.gallery': 'Gallery se choose karein',
  'doc.file': 'File choose karein',
  'filter.title': 'Filters',
  'filter.applied': '{n} filter(s) applied hain',
  'filter.showingAll': 'Sab kuch dikhaya ja raha hai',
  'filter.reset': 'Reset karein',
  'common.add': 'Add karein',
  'common.increase': 'Badhayein',
  'common.decrease': 'Ghatayein',
  'common.hidePassword': 'Password hide karein',
  'common.showPassword': 'Password dikhayein',
  'common.goBack': 'Wapas jayein',
  'common.copyLabel': '{label} copy karein',
  'map.loading': 'Map load ho raha hai',
  'map.pointsHere': 'Yahan {n} points hain',
  'map.andMore': 'aur {n} aur',
  'stage.new': 'Naya',
  'stage.meeting': 'Meeting',
  'stage.docsShared': 'Docs share kiye',
  'stage.policyIssued': 'Policy issue ho gayi',
  'stage.lost': 'Lost',
  'claimStatus.intake': 'Intake',
  'claimStatus.docsPending': 'Docs pending',
  'claimStatus.review': 'Review mein',
  'claimStatus.submitted': 'Submit ho gaya',
  'claimStatus.settled': 'Settled',
  'claimStatus.rejected': 'Rejected',
  'seg.renewal': 'Renewal due',
  'seg.maturity': 'Maturity jaldi',
  'seg.birthday': 'Birthday',
  'seg.crossSell': 'Cross-sell',
  'seg.hot': 'Hot',
  'taskStatus.todo': 'Karna hai',
  'taskStatus.inProgress': 'Kaam chal raha hai',
  'taskStatus.blocked': 'Blocked',
  'taskStatus.done': 'Ho gaya',
  'priority.high': 'High',
  'priority.medium': 'Medium',
  'priority.low': 'Low',
  'task.followUp': 'Follow-up',
  'home.clockedInAt': '{time} par clock in kiya',

  // Batch 6a (2026-08-27) — owner-supplied, human-written. Where a value below is the plain
  // English word, that is the owner's own choice and the same trade-vocabulary fallback as
  // `common.whatsapp`, not a missing translation.
  'claims.inRegister': 'Register mein',
  'claims.paidOut': 'Bhugtan kiya gaya',
  'claims.pending': 'Lambit',
  'claims.yours': 'Aapke claim',
  'claims.stillInProgress': 'Abhi prakriya mein',
  'claims.filterReview': 'Sameeksha',
  'filter.segment': 'Segment',
  'filter.next30': 'Agle 30 din',
  'filter.later': 'Baad mein',
  'filter.contact': 'Sampark',
  'filter.hasPhone': 'Phone uplabdh',
  'filter.noPhone': 'Phone uplabdh nahi',
  'common.dueToday': 'Aaj dey',
  'common.followUps': 'Follow-ups',
  'home.openTickets': 'Open tickets',
  'home.activeLeads': 'Sakriya leads',
  'common.reminders': 'Reminders',
  'common.tickets': 'Tickets',
  'search.whereItLooks': 'Kahan khoj hoti hai',
  'search.whereFooterClients': 'Clients aur tickets server par match hote hain, isliye sirf is device par load hui jankari mein nahi, balki poori client book mein khoj hoti hai. Chaar ya usse zyada digits mobile number ke aakhri digits se match honge.',
  'search.whereFooterTickets': 'Tickets server par match hote hain. Chaar ya usse zyada digits mobile number ke aakhri digits se match honge.',
  'search.rowClients': 'Clients',
  'search.rowClientsHint': 'Naam, mobile, policy, email',
  'search.rowLeads': 'Leads',
  'search.rowLeadsHint': 'Naam, mobile, ruchi',
  'search.rowClaims': 'Claims',
  'search.rowClaimsHint': 'Reference, naam, policy',
  'search.rowTicketsHint': 'Reference, naam, anurodh',
  'search.rowTasks': 'Tasks',
  'search.rowTasksHint': 'Shirshak, client, vivaran',
  'premium.birthdaysToday': 'Aaj janmadin',
  'home.notClockedIn': 'Clock-in nahi kiya',
  'premium.renewalsDue': 'Dey renewals',
  'premium.reachable': 'Sampark yogya',
  'common.inTheBook': 'Client book mein',
  'client.annualPremium': 'Varshik premium',
  'client.policies': 'Policies',
  'client.maturity': 'Maturity',
  'lead.closedAsLost': 'Lost ke roop mein band',
  'lead.pipelineProgress': 'Pipeline pragati',
  'lead.notProceeding': 'Aage nahi badh raha',
  'task.due': 'Dey tareekh',
  'task.keep': 'Jaisa hai rakhein',
  'task.inAWeek': 'Ek hafte mein',
  'task.priority': 'Prathmikta',
  'team.premiumMtd': 'Premium (is mahine)',
  'team.doneMtd': 'Poore hue (is mahine)',
  'team.completion': 'Poornata',
  'team.openWork': 'Lambit kaam',
  'dash.online': 'Online',
  'dash.openTasks': 'Open tasks',
  'dash.clientBook': 'Client book',
  'dash.claimsInProcess': 'Prakriya mein claims',
  'dash.adminActions': 'Admin actions',
  'dash.assignTask': 'Task assign karein',
  'dash.sendRenewals': 'Renewals bhejein',
  'dash.team': 'Team',
  'dash.agentMap': 'Agent map',
  'dash.liveActivity': 'Live gatividhi',

  // Batch 5, the sign-in screen (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised.
  // Provisional; see the machine-translation note in the English dictionary. The rest of
  // the request's Batch 5 (session.*, net.*, biometric.prompt, login.codeSent*) lives in
  // modules with NO React translator and would be zero-consumer here, so it is NOT added.
  'login.modePassword': 'Password',
  'login.modeOtp': 'OTP',
  'login.eyebrow': 'Surakshit sign in',
  'login.welcome': 'Phir se swagat hai',
  'login.unlockWithFingerprint': 'Fingerprint se kholein',
  'login.orSignIn': 'ya sign in karein',
  'login.identifierLabel': 'Email ya mobile number',
  'login.passwordLabel': 'Password',
  'login.unlockAndSignIn': 'Kholein aur sign in karein',
  'login.otpLabel': 'Code darj karein',
  'login.verifyAndSignIn': 'Jaanchein aur sign in karein',
  'login.resendCode': 'Naya code bhejein',
  'login.sendCode': 'Code bhejein',
  'login.passwordPlaceholder': 'Aapka CGPE password',
  'login.otpPlaceholder': '6 ank ka code',
  'login.otpChannelHint': 'Email par code mail se aayega. Mobile number par WhatsApp par aayega.',
  'login.errIdentifierRequired': 'Apna email ya mobile number darj karein.',
  'login.errPasswordRequired': 'Apna password darj karein.',
  'login.errIdentifierShape': 'Apna kaam ka email, ya 10 ank ka mobile number darj karein.',
  'login.errEmailShape': 'Yeh email pata sahi nahi lag raha.',
  'login.errOtpRequired': 'Apne WhatsApp message wala code darj karein.',
  'login.errOtpRequiredEmail': 'Apne email wala code darj karein.',
  'login.bannerTimeout': 'Server bahut samay le raha hai',
  'login.bannerPasswordNotSent': 'Aapki jankari bheji nahi gayi',
  'login.bannerCodeNotChecked': 'Aapka code jaancha nahi gaya',
  'login.bannerCodeRequestNotSent': 'Code ka anurodh bheja nahi gaya',
  'login.bannerSignInRefused': 'Sign in asweekar',
  'login.bannerCodeNotAccepted': 'Code sweekar nahi hua',
  'login.bannerCodeNotSent': 'Code bheja nahi gaya',
  'login.bannerSessionEnded': 'Aapka session khatam ho gaya',
  'login.msgUnlockNotConfirmed': 'Is device par unlock pushti nahi hui. Dobara koshish karein.',
  'login.msgCodeNotAccepted': 'Yeh code sweekar nahi hua. Iski avadhi khatam ho gayi ho sakti hai, naya code mangayein.',
  'login.msgQuickUnlockGone': 'Quick unlock ab uplabdh nahi hai. Kripya password ya OTP se sign in karein.',
  'login.msgUnlockFailed': 'Abhi unlock nahi ho saka. Apna connection jaanchkar dobara koshish karein.',
  'login.msgDetailsRefused': 'Yeh jankari sweekar nahi hui. Jaanchkar dobara koshish karein.',
  'login.msgCodeCheckFailed': 'Yeh code jaancha nahi ja saka. Kripya dobara koshish karein.',
  'login.msgCodeSendFailed': 'Code bheja nahi ja saka. Kripya dobara koshish karein.',
  'login.footerHint': 'Apne CGPE account se sign in karein. Agli baar aap fingerprint ya Face ID se khol sakenge.',

  // Batch 6f/6d/6e/5b/4b (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised. Provisional;
  // see the English block for why the machine-translation rule was waived and what it costs.
  'task.assignTo': 'Kise saunpein',
  'task.assignHint': 'Abhi kisi ko nahi saunpa gaya hai. Yeh kaam aapki apni list mein hi rahega.',
  'task.category': 'Shreni',
  'report.totalPolicies': 'Kul policy',
  'report.lifeCover': 'Kul life cover',
  'report.familyMembers': 'Parivar ke sadasya',
  'clients.searchSubtitle': 'Apni poori client book mein khojein',
  'lead.closeOut': 'Band karein',
  'lead.closeOutFooter': 'Band ki gayi lead pipeline list mein apne stage ke andar bani rehti hai, isliye kuch bhi nahi khota.',
  'common.current': 'Maujuda',
  'dash.masterControls': 'Master controls',
  'dash.allTeams': 'Sabhi teams',
  'dash.movement': 'Movement',
  'dash.analytics': 'Analytics',
  'dash.campaigns': 'Campaigns',
  'dash.totalClients': 'Kul clients',
  'dash.claimsTotal': 'Kul claims',
  'dash.inProcess': 'Prakriya mein',
  'dash.claimsPaid': 'Bhugtan kiye gaye claims',
  'home.followUpsEmptyBody': 'Janmadin, renewal aur callback jis din dey honge usi din yahan dikhenge.',
  'home.openFollowUps': 'Follow-ups kholein',
  'common.dueOn': '{date} dey',
  'common.daysLate': '{n} din ki deri',
  'common.inDays': '{n} din mein',
  'home.claimsOpen': 'Khule claims',
  'home.portfolioAnalytics': 'Portfolio analytics',
  'home.portfolioFooter': 'Poori sanstha ke kul aankde. Poora byora dekhne ke liye analytics kholein.',
  'clients.restrictedTitle': 'Clients sirf master aur admin ke liye hain',
  'clients.restrictedBody': 'Client directory sirf admin aur master account ke liye uplabdh hai. Kisi client ki jankari chahiye to admin se poochein.',
  'job.goneTitle': 'Yeh kaam ab nahi chal raha',
  'job.goneBody': 'Background ke kaam sirf app khuli rehne tak hi rakhe jate hain. Yeh poora hokar hata diya gaya hai.',
  'job.keepWorking': 'Kaam karte rahiye, yeh background mein chalta rahega',
  'common.added': 'Joda gaya',
  'home.vsLastPct': 'Pichhle mahine se {pct}%',
  'premium.sendAllCount': 'Sabhi {n} ko bhejein',
  'doc.recordVideo': 'Video record karein',
  'doc.videoHint': 'Video zyada se zyada {seconds} second ka ho sakta hai aur bhejne se pehle aapke phone mein hi chhota kar diya jata hai.',
  'doc.preparingVideo': 'Video taiyar ho raha hai…',
};

/**
 * ROMAN GUJARATI — Gujarati vocabulary in the Roman alphabet.
 * Gujarati possessives (nu / ni / na), Gujarati verbs (moklo, juo, umero, banavo), the
 * Gujarati copula (chhe) and the Gujarati negative (nathi). Business nouns stay English.
 */
const guEn: Dict = {
  'tab.home': 'Aaje', 'tab.tasks': 'Kaam', 'tab.leads': 'Leads', 'tab.clients': 'Client', 'tab.claims': 'Claim', 'tab.search': 'Search', 'tab.more': 'Vadhu',
  'tasks.title': 'Mara kaam', 'tasks.today': 'Aaje', 'tasks.overdue': 'Mudat viti', 'tasks.inProgress': 'Chaalu',
  'tasks.upcoming': 'Aavnara', 'tasks.doneLabel': 'Thai gayu', 'tasks.dueNow': 'baaki chhe', 'tasks.add': 'Kaam umero',
  'tasks.todayProgress': 'Aaj ni progress', 'tasks.allClear': 'Badhu puru!', 'tasks.nothingHere': 'Aa list ma koi kaam nathi.',
  'home.tasksToday': 'Aaj na kaam', 'home.taskProgress': 'Kaam ni progress', 'home.viewAll': 'Badhu juo',
  'greet.morning': 'Suprabhat', 'greet.afternoon': 'Shubh bapor', 'greet.evening': 'Shubh sanjh',
  'home.commission': 'Aa mahina nu commission', 'home.vsLast': 'gaya mahina karta', 'home.target': 'Mahina nu target',
  'home.markAttendance': 'Hajari nondho', 'home.gpsCheckin': 'Aaj ni GPS hajari',
  'home.clockedIn': 'Hajari nondhai gai', 'home.clockIn': 'Hajari nondho', 'home.clockOut': 'Clock out',
  'break.start': 'Break', 'break.end': 'Break puro karo',
  'break.reasonTitle': 'Reason lakho (optional)', 'break.reasonPlaceholder': 'Tame break kem lai rahya chho?',
  'break.reasonSkip': 'Skip karo', 'break.reasonStart': 'Break sharu karo',
  'break.minDoneTitle': 'Tame 8h 30m pura kari lidha chhe',
  'break.minDoneBody': 'Tame minimum hours pura kari lidha chhe. Break levo chhe ke clock out?',
  'break.minDoneConfirm': 'Break lo',
  'clock.reasonTitleOut': 'Clock out karvanu kaaran add karo', 'clock.reasonTitleIn': 'Clock in karvanu kaaran add karo',
  'clock.reasonEarly': 'Tame tamari shift puri thata pehla clock out kari rahya chho. Tamara manager ne notify karva ma aavshe.',
  'clock.reasonAway': 'Tame office thi door chho. Tamara manager ne notify karva ma aavshe.',
  'clock.reasonNeededTitleOut': 'Clock out karva maate kaaran jaroori chhe', 'clock.reasonNeededBodyOut': 'Krupa karine ahi clock out karvanu tooku kaaran add karo.',
  'clock.reasonNeededTitleIn': 'Clock in karva maate kaaran jaroori chhe', 'clock.reasonNeededBodyIn': 'Krupa karine ahi clock in karvanu tooku kaaran add karo.',
  'home.hotLeads': 'Hot leads', 'home.openClaims': 'Khulla claim', 'home.renewals': 'Renewal',
  'home.quickActions': 'Zadapi kaam', 'home.followups': 'Aaj na follow-up', 'home.quickContacts': 'Zadapi contact',
  'home.allCaught': 'Badhu thai gayu!', 'home.noFollowups': 'Atyare koi follow-up baaki nathi.',
  'act.newLead': 'Navi lead', 'act.newClaim': 'Navo claim', 'act.whatsapp': 'WhatsApp', 'act.licPlans': 'LIC plan',
  'act.calendar': 'Calendar', 'act.contests': 'Contest', 'act.premiumDue': 'Premium baaki', 'act.birthdays': 'Janmdivas',
  'common.signIn': 'Sign in', 'common.signOut': 'Sign out', 'common.cancel': 'Radd karo', 'common.send': 'Moklo',
  'common.call': 'Call', 'common.whatsapp': 'WhatsApp', 'common.seeAll': 'Badhu juo', 'common.search': 'Shodho',
  'common.pipeline': 'Pipeline', 'common.delete': 'Delete', 'common.save': 'Save karo', 'common.today': 'Aaje',
  'premium.title': 'Premium ane shubhechha', 'premium.dueThisMonth': 'Aa mahine premium baaki', 'premium.birthdaysThisMonth': 'Aa mahina na janmdivas',
  'premium.sendReminder': 'Reminder moklo', 'premium.sendAll': 'Badha ne moklo', 'premium.oneClick': 'Ek tap thi darek matching client ne personal WhatsApp message jaay chhe.',
  'premium.renewalDue': 'Renewal baaki', 'premium.maturitySoon': 'Maturity najik', 'premium.anniversaries': 'Anniversary',
  'report.generate': 'Client report banavo', 'report.generating': 'Report bani rahyo chhe…', 'report.title': 'Client report',
  'signout.title': 'Sign out karvu chhe?', 'signout.msg': 'Shu tame kharekhar CGPE Connect mathi sign out karva mango chho?',
  'settings.language': 'App ni bhasha', 'settings.title': 'Settings',
  'consent.title': 'Kaam maate location sharing',
  'consent.intro': 'Krupya sharu karta pehla aa vaacho. CGPE Connect tamaru location share kare chhe jethi company field team ne manage kari shake.',
  'consent.collect': 'Shu share thai chhe: tamaru accurate location ane tamari movement/activity, 24 kalak — jema tamara kaam na kalako sivay no samay pan shamel chhe.',
  'consent.why': 'Sha maate: jethi company field team ne barabar manage ane support kari shake.',
  'consent.who': 'Kon joi shake chhe: maatra company na Master. Tamara sathe kaam karta loko tamaru location joi shaksho nahi.',
  'consent.retention': 'Ketla samay sudhi rakhvama aavshe: tamaro location history data 90 divas pachhi hide kari devama aavshe ane 180 divas pachhi permanently delete kari devama aavshe.',
  'consent.transparent': 'Tamara thi kai chhupayelu nathi: jyare pan location share thai rahyu hase, tamara phone na status bar ma notification hamesha rehshe. Tamne hamesha khabar rehshe ke te chalu chhe.',
  'consent.mandatory': 'CGPE Connect work app use karva maate aa farajiyat chhe. Jo tame agree nathi karta, toh tame aagal vadhi shaksho nahi.',
  'consent.withdraw': 'Tame tene pachhithi bandh kari shako chho, pan jya sudhi tame fari chalu na karo tya sudhi app kaam karvanu bandh kari deshe, ane bandh karva par Master ne jaan karvama aavshe.',
  'consent.agreeButton': 'Hu Sehmat Chhu',
  'consent.declineButton': 'Hu Sehmat Nathi',
  'consent.declineTitle': 'Sehmat thaya vina tame aagal vadhi shaksho nahi',
  'consent.declineBody': 'Aa work app maate tamaru location share karvu farajiyat chhe. Jo tamne koi prashna hoy, toh krupya tamara manager sathe vaat karo.',
  'consent.declineBack': 'Pachha jao',
  'consent.serviceTitle': 'CGPE Connect',
  'consent.serviceBody': 'Kaam maate location on chhe',
  'consent.blockedTitle': 'CGPE Connect use karva maate location fari chalu karo',
  'consent.blockedBody': 'Aa app maate location sharing farajiyat chhe. Aagal vadharva maate krupya location ane "Allow all the time" permission fari chalu karo.',
  'consent.blockedAction': 'Settings kholo',
  // D4 + D6b (owner copy, 2026-08-22)
  'tasks.viewWeek': 'Aa athvadiye', 'tasks.viewMonth': 'Aa mahine', 'tasks.viewCalendar': 'Calendar',
  'tasks.tomorrow': 'Aavtikale', 'tasks.yesterday': 'Gaikale',
  'tasks.emptyTodayTitle': 'Aaje kai pan baki nathi',
  'tasks.emptyTodayBody': 'Aaje badhu clear chhe — kai pan baki nathi ane kai pan overdue pan nathi. Bakina divasnu planning karva mate ek task umero.',
  'tasks.emptyWeekTitle': 'Aa athvadiye kai nathi',
  'tasks.emptyWeekBody': 'Aa athvadiyama koi task nathi. Aagalna tasks jova mate Aa mahino athva Calendar juo.',
  'tasks.emptyMonthTitle': 'Aa mahine kai nathi',
  'tasks.emptyMonthBody': 'Aa calendar mahinama koi task schedule nathi.',
  'tasks.emptyCalendarBody': 'Selected divase koi task due nathi. Upar na calendar mathi bijo divas select karo.',
  'guide.welcome': 'Swagat chhe', 'guide.title': 'Tamaro divas 3 steps ma',
  'guide.step1Title': 'Clock in', 'guide.step1Body': 'Office pahonchya pachi tamaro divas sharu karva mate Clock in par tap karo.',
  'guide.step2Title': 'Aajna tasks juo', 'guide.step2Body': 'Aajnu tamaru kaam aa j screen par ahi listed chhe.',
  'guide.step3Title': 'Puru mark karo', 'guide.step3Body': 'Task puro thai gaya pachi tene swipe karo athva tick par tap karo.',
  'guide.gotIt': 'Samajayu',
  'storage.title': 'Storage',
  'storage.description': 'App na temporary saved files ane downloads manage karo.',
  'storage.clear': 'Cached downloads clear karo',
  'storage.clearing': 'Cache clear thai rahyo chhe…',
  'storage.confirmTitle': 'Cache clear karvo chhe?',
  'storage.confirmBody': 'Aa app na temporary saved files remove karshe. Tamari original files par koi asar nahi pade.',
  'storage.clearCta': 'Clear',
  'storage.doneBody': 'Temporary files successfully remove thai gai chhe.',
  'storage.partialBody': 'Ketlik temporary files remove thai shaki nathi. Tame fari try kari shako cho.',
  'storage.failBody': 'Temporary files remove karta problem aavi. Please fari try karo.',
  'storage.installNote': 'App nu potanu install size change thatu nathi — actual storage figures jova mate phone ma Settings › Apps › CGPE Connect › Storage kholo.',
  'common.tryAgain': 'Fari try karo',
  'common.clearSearch': 'Search clear karo',
  'common.refresh': 'Refresh karo',
  'common.offlineBody': 'Server sathe connect thai shakyu nathi. Tamaru connection check karo ane fari try karo.',
  'common.loadMore': 'Vadhu load karo',
  'common.all': 'Badha',
  'common.done': 'Puru',
  'common.clear': 'Clear karo',
  'common.continue': 'Aagal vadho',
  'common.showResults': 'Results batavo',
  'common.saving': 'Save thai rahyu chhe…',
  'common.uploading': 'Upload thai rahyu chhe…',
  'common.mobile': 'Mobile',
  'common.onDuty': 'Duty par',
  'common.offDuty': 'Duty par nathi',
  'common.goToSignIn': 'Sign in par jao',
  'common.a11yCall': '{name} ne call karo',
  'common.a11yWhatsapp': '{name} sathe WhatsApp chat kholo',
  'common.close': 'Band karo',
  'health.slow': 'Server dhime respond kari rahyu chhe',
  'health.offline': 'Network sathe connect thai shakyu nathi',
  'health.server': 'Server ma problem aavi',
  'health.someData': 'Thodo data load thai shakyo nathi',
  'health.oneRequest': 'Ek request complete thai shaki nathi. Ketlik values missing ke outdated hoi shake chhe.',
  'health.manyRequests': '{n} requests complete thai shaki nathi. Ketlik values missing ke outdated hoi shake chhe.',
  'health.a11yUnconfirmed': '{n} request(s) complete thai shaki nathi. Blank values confirm thai nathi.',
  'common.dismiss': 'Band karo',
  'common.confirm': 'Confirm karo',
  'lock.title': 'App locked chhe',
  'lock.body': 'Fingerprint, Face ID ke device passcode thi CGPE Connect unlock karo.',
  'lock.verifying': 'Verify thai rahyu chhe…',
  'lock.unlock': 'Unlock karo',
  'sync.pending': 'Sync baki chhe',
  'sync.syncedAt': '{time} par sync thayu · data outdated hoi shake chhe',
  'sync.savedLocal': 'Aa device par save thayu chhe — online aavsho tyare sync thai jashe.',
  'sync.savedLocalNamed': '{name} aa device par save thayu chhe — online aavsho tyare sync thai jashe',
  'sync.droppedOne': 'Ek offline change save thai shakyo nahi ane remove kari didho.',
  'sync.droppedMany': '{n} offline changes save thai shakya nahi ane remove kari didha.',
  'doc.attachTitle': 'Document attach karo',
  'doc.attachSubtitle': 'Navo photo lo ke phone ma pehle thi hoy te file choose karo',
  'doc.takePhoto': 'Photo lo',
  'doc.gallery': 'Gallery mathi choose karo',
  'doc.file': 'File choose karo',
  'filter.title': 'Filters',
  'filter.applied': '{n} filter(s) applied chhe',
  'filter.showingAll': 'Badhu batavi rahyu chhe',
  'filter.reset': 'Reset karo',
  'common.add': 'Add karo',
  'common.increase': 'Vadharo',
  'common.decrease': 'Ghataado',
  'common.hidePassword': 'Password hide karo',
  'common.showPassword': 'Password batavo',
  'common.goBack': 'Pachha jao',
  'common.copyLabel': '{label} copy karo',
  'map.loading': 'Map load thai rahyo chhe',
  'map.pointsHere': 'Ahiya {n} points chhe',
  'map.andMore': 'ane {n} vadhu',
  'stage.new': 'Navu',
  'stage.meeting': 'Meeting',
  'stage.docsShared': 'Docs share karya',
  'stage.policyIssued': 'Policy issue thai',
  'stage.lost': 'Lost',
  'claimStatus.intake': 'Intake',
  'claimStatus.docsPending': 'Docs pending',
  'claimStatus.review': 'Review ma',
  'claimStatus.submitted': 'Submit thai gayu',
  'claimStatus.settled': 'Settled',
  'claimStatus.rejected': 'Rejected',
  'seg.renewal': 'Renewal due',
  'seg.maturity': 'Maturity jaldi',
  'seg.birthday': 'Birthday',
  'seg.crossSell': 'Cross-sell',
  'seg.hot': 'Hot',
  'taskStatus.todo': 'Karvanu baki',
  'taskStatus.inProgress': 'Kaam chalu chhe',
  'taskStatus.blocked': 'Atkelu',
  'taskStatus.done': 'Puru',
  'priority.high': 'High',
  'priority.medium': 'Medium',
  'priority.low': 'Low',
  'task.followUp': 'Follow-up',
  'home.clockedInAt': '{time} vagye clock in karyu',

  // Batch 6a (2026-08-27) — owner-supplied, human-written. Roman Gujarati is Gujarati
  // vocabulary in Latin letters, not the Hinglish line repeated: `Baaki` / `Pachhi` /
  // `Aaje baaki` / `Yathavat rakho` differ from their Hindi counterparts above on purpose.
  'claims.inRegister': 'Register ma',
  'claims.paidOut': 'Chukavel',
  'claims.pending': 'Baaki',
  'claims.yours': 'Tamara claims',
  'claims.stillInProgress': 'Haju prakriya ma',
  'claims.filterReview': 'Sameeksha',
  'filter.segment': 'Segment',
  'filter.next30': 'Aagami 30 divas',
  'filter.later': 'Pachhi',
  'filter.contact': 'Sampark',
  'filter.hasPhone': 'Phone uplabdh',
  'filter.noPhone': 'Phone uplabdh nathi',
  'common.dueToday': 'Aaje baaki',
  'common.followUps': 'Follow-ups',
  'home.openTickets': 'Open tickets',
  'home.activeLeads': 'Sakriya leads',
  'common.reminders': 'Reminders',
  'common.tickets': 'Tickets',
  'search.whereItLooks': 'Kyan shodh thay chhe',
  'search.whereFooterClients': 'Clients ane tickets server par match thay chhe, etle fakt aa device par load thayeli mahiti ma nahi, pan aakhi client book ma shodh thay chhe. Chaar ke tethi vadhu digits mobile number na chhella digits sathe match thashe.',
  'search.whereFooterTickets': 'Tickets server par match thay chhe. Chaar ke tethi vadhu digits mobile number na chhella digits sathe match thashe.',
  'search.rowClients': 'Clients',
  'search.rowClientsHint': 'Naam, mobile, policy, email',
  'search.rowLeads': 'Leads',
  'search.rowLeadsHint': 'Naam, mobile, ras',
  'search.rowClaims': 'Claims',
  'search.rowClaimsHint': 'Reference, naam, policy',
  'search.rowTicketsHint': 'Reference, naam, vinanti',
  'search.rowTasks': 'Tasks',
  'search.rowTasksHint': 'Shirshak, client, vigato',
  'premium.birthdaysToday': 'Aaje janmadivas',
  'home.notClockedIn': 'Clock-in karyu nathi',
  'premium.renewalsDue': 'Baaki renewals',
  'premium.reachable': 'Sampark kari shakay teva',
  'common.inTheBook': 'Client book ma',
  'client.annualPremium': 'Varshik premium',
  'client.policies': 'Policies',
  'client.maturity': 'Maturity',
  'lead.closedAsLost': 'Lost tarike bandh',
  'lead.pipelineProgress': 'Pipeline pragati',
  'lead.notProceeding': 'Aagal vadhi rahyu nathi',
  'task.due': 'Niyat tarikh',
  'task.keep': 'Yathavat rakho',
  'task.inAWeek': 'Ek athvadiya ma',
  'task.priority': 'Prathmikta',
  'team.premiumMtd': 'Premium (aa mahine)',
  'team.doneMtd': 'Purna (aa mahine)',
  'team.completion': 'Purnata',
  'team.openWork': 'Baaki kaam',
  'dash.online': 'Online',
  'dash.openTasks': 'Open tasks',
  'dash.clientBook': 'Client book',
  'dash.claimsInProcess': 'Prakriya ma claims',
  'dash.adminActions': 'Admin actions',
  'dash.assignTask': 'Task sompo',
  'dash.sendRenewals': 'Renewals moklo',
  'dash.team': 'Team',
  'dash.agentMap': 'Agent map',
  'dash.liveActivity': 'Live pravrutti',

  // Batch 5, the sign-in screen (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised.
  // Provisional; see the machine-translation note in the English dictionary. The rest of
  // the request's Batch 5 (session.*, net.*, biometric.prompt, login.codeSent*) lives in
  // modules with NO React translator and would be zero-consumer here, so it is NOT added.
  'login.modePassword': 'Password',
  'login.modeOtp': 'OTP',
  'login.eyebrow': 'Surakshit sign in',
  'login.welcome': 'Fari swagat chhe',
  'login.unlockWithFingerprint': 'Fingerprint thi kholo',
  'login.orSignIn': 'athva sign in karo',
  'login.identifierLabel': 'Email athva mobile number',
  'login.passwordLabel': 'Password',
  'login.unlockAndSignIn': 'Kholo ane sign in karo',
  'login.otpLabel': 'Code dakhal karo',
  'login.verifyAndSignIn': 'Chakaso ane sign in karo',
  'login.resendCode': 'Navo code moklo',
  'login.sendCode': 'Code moklo',
  'login.passwordPlaceholder': 'Tamaro CGPE password',
  'login.otpPlaceholder': '6 ank no code',
  'login.otpChannelHint': 'Email par code mail thi aavse. Mobile number par WhatsApp par aavse.',
  'login.errIdentifierRequired': 'Tamaro email athva mobile number dakhal karo.',
  'login.errPasswordRequired': 'Tamaro password dakhal karo.',
  'login.errIdentifierShape': 'Tamaro kaam no email, athva 10 ank no mobile number dakhal karo.',
  'login.errEmailShape': 'Aa email saranamu barabar lagtu nathi.',
  'login.errOtpRequired': 'Tamara WhatsApp message no code dakhal karo.',
  'login.errOtpRequiredEmail': 'Tamara email no code dakhal karo.',
  'login.bannerTimeout': 'Server bahu samay lai rahyu chhe',
  'login.bannerPasswordNotSent': 'Tamari vigato moklai nathi',
  'login.bannerCodeNotChecked': 'Tamaro code chakasayo nathi',
  'login.bannerCodeRequestNotSent': 'Code ni vinanti moklai nathi',
  'login.bannerSignInRefused': 'Sign in nakarayu',
  'login.bannerCodeNotAccepted': 'Code sweekarayo nathi',
  'login.bannerCodeNotSent': 'Code moklayo nathi',
  'login.bannerSessionEnded': 'Tamaru session puru thayu',
  'login.msgUnlockNotConfirmed': 'Aa device par unlock khatri thai nathi. Fari prayas karo.',
  'login.msgCodeNotAccepted': 'Aa code sweekarayo nathi. Teni mudat puri thai gai hoi shake, navo code mangavo.',
  'login.msgQuickUnlockGone': 'Zadapi unlock have uplabdh nathi. Krupya password athva OTP thi sign in karo.',
  'login.msgUnlockFailed': 'Atyare unlock thai shakyu nahi. Tamaru connection tapasi ne fari prayas karo.',
  'login.msgDetailsRefused': 'Aa vigato sweekarai nathi. Tapasi ne fari prayas karo.',
  'login.msgCodeCheckFailed': 'Aa code chakasi shakayo nahi. Krupya fari prayas karo.',
  'login.msgCodeSendFailed': 'Code mokli shakayo nahi. Krupya fari prayas karo.',
  'login.footerHint': 'Tamara CGPE account thi sign in karo. Aagli vakhat tame fingerprint ke Face ID thi kholi shakso.',

  // Batch 6f/6d/6e/5b/4b (2026-08-27) — CLAUDE-TRANSLATED, owner-authorised. Provisional;
  // see the English block for why the machine-translation rule was waived and what it costs.
  'task.assignTo': 'Kone sopvu',
  'task.assignHint': 'Haju koine sopyu nathi. Aa kaam tamari potani list ma j rahese.',
  'task.category': 'Shreni',
  'report.totalPolicies': 'Kul policy',
  'report.lifeCover': 'Kul life cover',
  'report.familyMembers': 'Parivar na sabhyo',
  'clients.searchSubtitle': 'Tamari aakhi client book ma shodho',
  'lead.closeOut': 'Bandh karo',
  'lead.closeOutFooter': 'Bandh karel lead pipeline list ma potana stage ni niche rahe chhe, etle kai khovatu nathi.',
  'common.current': 'Halnu',
  'dash.masterControls': 'Master controls',
  'dash.allTeams': 'Badhi teams',
  'dash.movement': 'Hilchal',
  'dash.analytics': 'Analytics',
  'dash.campaigns': 'Campaigns',
  'dash.totalClients': 'Kul clients',
  'dash.claimsTotal': 'Kul claims',
  'dash.inProcess': 'Prakriya ma',
  'dash.claimsPaid': 'Chukavel claims',
  'home.followUpsEmptyBody': 'Janmadivas, renewal ane callback je divase baaki hoy te divase ahin dekhase.',
  'home.openFollowUps': 'Follow-ups kholo',
  'common.dueOn': '{date} baaki',
  'common.daysLate': '{n} divas modu',
  'common.inDays': '{n} divas ma',
  'home.claimsOpen': 'Khulla claims',
  'home.portfolioAnalytics': 'Portfolio analytics',
  'home.portfolioFooter': 'Aakhi sanstha na kul aankda. Puri vigat mate analytics kholo.',
  'clients.restrictedTitle': 'Clients fakt master ane admin mate chhe',
  'clients.restrictedBody': 'Client directory fakt admin ane master account mate uplabdh chhe. Koi client ni vigat joiti hoy to admin ne pucho.',
  'job.goneTitle': 'Aa kaam have chalu nathi',
  'job.goneBody': 'Background na kaam fakt app khulli hoy tya sudhi j rakhvama aave chhe. Te puru thai ne hatavi devayu chhe.',
  'job.keepWorking': 'Kaam chalu rakho, aa background ma chalse',
  'common.added': 'Umeryu',
  'home.vsLastPct': 'Gaya mahina karta {pct}%',
  'premium.sendAllCount': 'Badha {n} ne moklo',
  'doc.recordVideo': 'Video record karo',
  'doc.videoHint': 'Video vadhu ma vadhu {seconds} second no hoi shake ane moklta pehla tamara phone ma j nano kari devay chhe.',
  'doc.preparingVideo': 'Video taiyar thai rahyo chhe…',
};

/**
 * Exported for the Phase 19 dictionary-parity test (`__tests__/dictionaries.test.ts`), which
 * asserts every language carries the exact same key set with no empty / key-identical values —
 * the value checks `Dict = Record<TKey, string>` cannot make at compile time. Nothing under
 * `src/app` imports this: screens read strings through `t()`, never the raw table.
 */
export const DICT: Record<Lang, Dict> = { en, gu, hi, 'hi-en': hiEn, 'gu-en': guEn };

/* ------------------------------------------------------------------ *
 * Persistence — per user, on a handset that is shared.
 *
 * Language is a PERSONAL preference and these phones are passed between staff, so the
 * choice is stored under `cgpe.lang.<userId>`. `cgpe.lang` (no suffix) remains the
 * signed-out / pre-upgrade key.
 *
 * WHY THE USER ID IS READ FROM STORAGE AND NOT FROM THE AUTH STORE. `store/auth.tsx` is
 * mounted around this provider and importing it here would be a require cycle, which Metro
 * resolves by handing one module a half-initialised copy of the other (the same reasoning
 * `lib/session.ts` documents). Instead we read the session record that auth already
 * persists. The coupling is one key name, `cgpe.user`, and if that record is missing or
 * unparseable we simply fall back to the device-level key — the app never breaks over it.
 * ------------------------------------------------------------------ */

const DEVICE_KEY = 'cgpe.lang';
const SESSION_USER_KEY = 'cgpe.user'; // written by store/auth.tsx

// expo-secure-store only accepts alphanumerics, '.', '-' and '_' in a key. Ids are Mongo
// hex in practice, but a phone-shaped or email-shaped id must not silently fail to persist.
const langKeyFor = (uid: string) => `${DEVICE_KEY}.${uid.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 64)}`;

const isLang = (v: string | null): v is Lang => !!v && LANGS.some((l) => l.code === v);

/** Reads the signed-in user's id from the persisted session, or null when signed out. */
async function readUserId(): Promise<string | null> {
  try {
    const raw = await storage.get(SESSION_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { id?: string | number } | null;
    const id = parsed && parsed.id != null ? String(parsed.id).trim() : '';
    return id || null;
  } catch {
    return null; // corrupt record: behave exactly as if signed out
  }
}

/**
 * Resolves the language for a given account.
 *
 * The migration branch matters on a shared handset. An advisor who already chose Gujarati
 * before this build must keep it, so the first account to sign in adopts the device-level
 * value — and then CLAIMS it (removes it), so the next person to sign in on the same phone
 * starts from the app default instead of inheriting a colleague's language.
 */
async function loadLang(uid: string | null): Promise<Lang> {
  if (uid) {
    const mine = await storage.get(langKeyFor(uid));
    if (isLang(mine)) return mine;
    const device = await storage.get(DEVICE_KEY);
    if (isLang(device)) {
      await storage.set(langKeyFor(uid), device);
      await storage.remove(DEVICE_KEY);
      return device;
    }
    return DEFAULT_LANG;
  }
  const device = await storage.get(DEVICE_KEY);
  return isLang(device) ? device : DEFAULT_LANG;
}

/* Sign-in and sign-out happen in a module this one cannot import, so the provider listens
 * on a tiny bus instead. `refreshI18nUser()` is the seam: calling it after a login or a
 * logout re-reads the session and swaps the language to that account's choice within the
 * same app run. Nothing breaks if it is never called — the provider also re-checks on
 * mount and whenever the app returns to the foreground, which covers the common
 * hand-the-phone-over case. */
type Watcher = () => void;
const watchers = new Set<Watcher>();

function watchUser(fn: Watcher): () => void {
  watchers.add(fn);
  return () => { watchers.delete(fn); };
}

/** Ask the i18n provider to re-read who is signed in. Safe to call at any time. */
export function refreshI18nUser(): void {
  watchers.forEach((fn) => {
    try {
      fn();
    } catch {
      // one bad listener must not stop the others
    }
  });
}

/** Widen a fixed-key dictionary so an arbitrary runtime key can be looked up safely. */
const loose = (table: Dict): Record<string, string | undefined> => table;

/** Empty strings count as missing, otherwise a blank translation renders as blank UI. */
function pick(table: Dict, key: string): string | undefined {
  const v = loose(table)[key];
  return v ? v : undefined;
}

/* ------------------------------------------------------------------ *
 * t(key, params) — interpolation and plurals. Three small PURE pieces so each is pinnable
 * on its own (`__tests__/format.test.ts`): the CLDR plural rule, the placeholder fill, and
 * the composed resolver. None of them touch React, storage or the network.
 * ------------------------------------------------------------------ */

/** Values a template can carry. `count` is special-cased for plural selection; everything
 *  else is substituted by name. Numbers are stringified at the point of substitution. */
export type TParams = Record<string, string | number>;

/** The shape every `t` in the app satisfies. Exported so a screen can type a `t` it receives. */
export type TFn = (key: string, params?: TParams) => string;

/**
 * CLDR cardinal plural category, restricted to the two forms the dictionaries carry
 * (`one` / `other`). English marks only exactly 1 as `one`; Hindi and Gujarati — and so
 * their romanized pair — mark BOTH 0 and 1 as `one` ("0 kaam" takes the singular form).
 * Counts are integers here, so the integer-part subtleties of the full rule do not arise.
 */
export function pluralCategory(lang: Lang, count: number): 'one' | 'other' {
  const n = Math.abs(count);
  switch (lang) {
    case 'hi':
    case 'hi-en':
    case 'gu':
    case 'gu-en':
      return n === 0 || n === 1 ? 'one' : 'other';
    case 'en':
    default:
      return n === 1 ? 'one' : 'other';
  }
}

/**
 * Fill `{name}` placeholders from `params`. A placeholder with no matching (non-null) value
 * is left exactly as written — a visible `{name}` is a bug you can see, not a silent blank.
 * Only `{word}` tokens are touched, so a stray brace in copy is never mangled.
 */
export function interpolate(template: string, params: TParams): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const v = params[name];
    return v == null ? whole : String(v);
  });
}

/** Raw lookup for one key: the active language, then English, else undefined. */
function resolve(lang: Lang, key: string): string | undefined {
  return pick(DICT[lang], key) ?? pick(en, key);
}

/**
 * The composed resolver behind `t`. Order: pick the plural variant when `params.count` is a
 * number AND that variant exists (else the base key); resolve through language → English →
 * the key itself (the never-blank contract, unchanged from the old `t`); then interpolate.
 *
 * `lookup` is injected only so the plural + interpolation paths can be pinned against a
 * controlled dictionary without adding real keys (which would bump the parity gate). Every
 * app caller uses the default, which reads the shipped dictionaries.
 */
export function translate(
  lang: Lang,
  key: string,
  params?: TParams,
  lookup: (k: string) => string | undefined = (k) => resolve(lang, k),
): string {
  let lookupKey = key;
  if (params && typeof params.count === 'number') {
    const variant = `${key}_${pluralCategory(lang, params.count)}`;
    if (lookup(variant) != null) lookupKey = variant;
  }
  const raw = lookup(lookupKey) ?? key;
  return params ? interpolate(raw, params) : raw;
}

type I18n = { lang: Lang; setLang: (l: Lang) => void; t: TFn };
const I18nContext = createContext<I18n>({ lang: DEFAULT_LANG, setLang: () => {}, t: (k) => k });

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(DEFAULT_LANG);
  const uidRef = useRef<string | null>(null);
  const loadedRef = useRef(false);
  // Sequence token: a foreground event can land while the mount read is still in flight,
  // and the older of the two must not be the one that wins.
  const seqRef = useRef(0);

  useEffect(() => {
    let alive = true;

    const sync = async () => {
      const mine = ++seqRef.current;
      const uid = await readUserId();
      if (!alive || mine !== seqRef.current) return;
      if (loadedRef.current && uid === uidRef.current) return; // same account, nothing to do
      const next = await loadLang(uid);
      if (!alive || mine !== seqRef.current) return;
      uidRef.current = uid;
      loadedRef.current = true;
      setLangState(next);
    };

    void sync();
    const off = watchUser(() => { void sync(); });
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void sync(); });
    return () => {
      alive = false;
      seqRef.current++; // invalidate anything still awaiting
      off();
      sub.remove();
    };
  }, []);

  /**
   * The write re-reads who is signed in rather than trusting the cached id, so a choice
   * made straight after a user switch still lands on the right account's key instead of
   * overwriting the previous advisor's preference.
   */
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    loadedRef.current = true;
    seqRef.current++; // an explicit choice outranks any read still in flight
    void (async () => {
      const uid = await readUserId();
      uidRef.current = uid;
      await storage.set(uid ? langKeyFor(uid) : DEVICE_KEY, l);
    })();
  }, []);

  const t = useCallback<TFn>((key, params) => translate(lang, key, params), [lang]);

  const value = useMemo<I18n>(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
