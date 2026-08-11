# Inventory — login / account / profile / settings / more / premium / home

~436 strings. `login`, `account`, `profile` are **100% hardcoded**; `settings`, `more`, `premium`,
`home` are **partially wired** (only their remaining hardcoded strings are listed). `home.tsx` is the
app's most-seen screen and still >80% hardcoded — highest priority. Line numbers as of 2026-08-11 —
anchor on the English literal. Interpolation marked `[dynamic]`. See `../SCOPE.md`.

## `src/app/(auth)/login.tsx` (100% hardcoded)

| line | kind | english | proposedKey |
|---|---|---|---|
| 55 | label | Password | login.modePassword |
| 56 | label | OTP | login.modeOtp |
| 117 | error | Enter your email or mobile number. | login.errIdRequired |
| 118 | error | Enter your password. | login.errPwRequired |
| 132 | error | Unlock was not confirmed on this device. Try again. | login.errUnlockNotConfirmed |
| 140 | error | Those details were not accepted. Check them and try again. | login.errCredsRejected |
| 160 | error | Enter your work email, or a 10 digit mobile number. | login.errPhoneOrEmail |
| 165 | error | That email address does not look right. | login.errEmailInvalid |
| 194 | error | Could not send the code. Please try again. | login.errSendOtp |
| 201 | error | Enter the code from your WhatsApp message. | login.errOtpRequired |
| 216 | error | That code could not be checked. Please try again. | login.errOtpCheck |
| 225 | error | That code was not accepted. It may have expired, so request a new one. | login.errOtpRejected |
| 252 | error | Your details were not sent | login.bannerDetailsNotSent |
| 253 | error | Your code was not checked | login.bannerCodeNotChecked |
| 254 | error | The code request was not sent | login.bannerCodeReqNotSent |
| 257 | button | Try again | common.tryAgain |
| 264 | error | Sign in refused | login.bannerSignInRefused |
| 265 | error | Code not accepted | login.bannerCodeNotAccepted |
| 266 | error | Code not sent | login.bannerCodeNotSent |
| 327 | header | Secure sign in | login.eyebrow |
| 328 | title | Welcome back | login.welcome |
| 334 | title | Your session ended | login.sessionEndedTitle |
| 345 / 382 | label | Email or mobile number | login.idLabel |
| 348 | placeholder | you@cgpe.in or 98250 ... | login.idPlaceholder |
| 354 | label | Password | login.pwLabel |
| 358 | placeholder | Your CGPE password | login.pwPlaceholder |
| 364 | button | Unlock and sign in / Sign in | login.btnUnlockSignIn / login.btnSignIn |
| 390 | placeholder | you@cgpe.in  or  98250 00000 | login.otpIdPlaceholder |
| 395 | label | Email gets the code by mail. A mobile number gets it on WhatsApp. | login.otpHint |
| 401 | label | Enter code | login.otpCodeLabel |
| 405 | placeholder | 6 digit code | login.otpCodePlaceholder |
| 411 | button | Verify and sign in | login.btnVerify |
| 420 | button | Send a new code | login.btnResend |
| 432 | button | Send code | login.btnSendCode |
| 451 | label | Sign in with your CGPE account. Next time you can unlock with fingerprint or Face ID. | login.reassurance |

## `src/app/account.tsx` (100% hardcoded)

| line | kind | english | proposedKey |
|---|---|---|---|
| 56 | confirm | Delete your account? | account.confirm1Title |
| 57 | confirm | This permanently deletes your CGPE Connect account and all associated personal data (profile, leads, client notes). This cannot be undone. | account.confirm1Msg |
| 58 | confirm | Continue | common.continue |
| 64 | confirm | Are you absolutely sure? | account.confirm2Title |
| 65 | confirm | Your data will be erased. This action is irreversible. | account.confirm2Msg |
| 66 | confirm | Yes, delete everything | account.confirm2Confirm |
| 67 | confirm | Keep my account | account.confirm2Cancel |
| 92 | error | The server did not confirm the deletion, so your account is unchanged. | account.deleteFailUnsupported |
| 93 | error | The server did not confirm the deletion, so your account is unchanged. Check your connection and try again. | account.deleteFailRetry |
| 100 | toast | Could not open the browser. The policy is at cgpe.in/privacy. | account.privacyOpenFail |
| 106 | toast | A data export will be emailed to you. | account.exportQueued |
| 112 / 152 / 165 | header | Account and privacy | account.title |
| 155 | empty | You are signed out | account.signedOutTitle |
| 156 | empty | Sign in to export your data or to delete your account. You can also request deletion at cgpe.in/delete-account. | account.signedOutSubtitle |
| 157 | button | Go to sign in | common.goToSignIn |
| 174 | error | Your account was not deleted | account.deleteBannerTitle |
| 178 | button | Try again | common.tryAgain |
| 198 | banner | Your data is protected | account.protectedTitle |
| 199 | banner | Encrypted in transit. We follow India's DPDP Act for personal and policy data. | account.protectedMsg |
| 202 | header | Your data | account.dataSection |
| 202 | label | An export is sent to the address on your account. | account.dataSectionFooter |
| 206 | label | Export my data | account.exportRow |
| 214 | label | Privacy policy | account.privacyRow |
| 224 | header | Danger zone | account.dangerZone |
| 226 | title | Delete account | account.deleteHeading |
| 227–231 | label | Permanently delete your account and all associated personal data. You can also request deletion at cgpe.in/delete-account. This action is irreversible. | account.deleteBody |
| 234 | button | Delete my account | account.deleteBtn |

## `src/app/profile.tsx` (100% hardcoded)

| line | kind | english | proposedKey |
|---|---|---|---|
| 41 / 66 / 86 | header | My profile | profile.title |
| 69 | empty | You are signed out | profile.signedOutTitle |
| 70 | empty | Sign in again to see your agent code, branch and contact details. | profile.signedOutSubtitle |
| 71 | button | Go to sign in | common.goToSignIn |
| 92 | label | Open settings | profile.a11yOpenSettings |
| 110 | label | `${tier} Club` [dynamic] | profile.clubPill |
| 118 | header | Contact | profile.contactSection |
| 119 | label | Tap a row to open your dialler or mail app. Tap the copy icon to put the value on the clipboard. | profile.contactFooter |
| 124 | label | Mobile | profile.mobile |
| 125 / 135 / 142 | label | Not on file | profile.notOnFile |
| 133 | label | Email | profile.email |
| 142 | label | Branch | profile.branch |
| 147 | header | Role | profile.roleSection |
| 148 | label | Access level is set by your administrator. Ask them if something here looks wrong. | profile.roleFooter |
| 153 | label | Access level | profile.accessLevel |
| 159 | label | Agent code | profile.agentCode |
| 163 | label | Club tier | profile.clubTier |

## `src/app/settings.tsx` (partial — ~95% still hardcoded)

| line | kind | english | proposedKey |
|---|---|---|---|
| 114 | error | No fingerprint or face unlock on this device | settings.bioNoneTitle |
| 116 | error | Enrol one in your phone settings, then turn this on again. | settings.bioNoneMsg |
| 128 | toast | Biometric unlock enabled / disabled | settings.bioEnabled / settings.bioDisabled |
| 134 | error | Biometric unlock was not enabled | settings.bioFailTitle |
| 135 | error | The device did not confirm your identity, so the setting was left off. | settings.bioFailMsg |
| 156 | error | `${name} could not be saved` [dynamic] | settings.toggleSaveFailTitle |
| 157 | error | The switch was put back to where it was. Try again in a moment. | settings.toggleSaveFailMsg |
| 173 | toast | `Language changed to ${label}` [dynamic] | settings.langChanged |
| 176 | label | Dark, follows system / Light, follows system | settings.themeDark / settings.themeLight |
| 207 | header | Security | settings.securitySection |
| 208 | label | Biometric unlock asks for your fingerprint or face every time the app comes back to the foreground. | settings.securityFooter |
| 213 | label | Biometric unlock | settings.bioRow |
| 229 | label | Change password | settings.changePw |
| 231 | toast | Password changes are handled in the web panel for now. | settings.changePwToast |
| 237 | header | Notifications | settings.notifSection |
| 238 | label | Push covers reminders, claims and lead alerts. WhatsApp alerts cover new Hub messages. | settings.notifFooter |
| 243 | label | Push notifications | settings.pushRow |
| 259 | label | WhatsApp alerts | settings.waRow |
| 274 | header | Appearance | settings.appearanceSection |
| 276 | label | Theme | settings.theme |
| 291 | label | Changes the app labels straight away. Client records stay in the language they were entered in. | settings.langHint |
| 294 | header | Script languages | settings.scriptLangsSection |
| 308 | header | Romanized | settings.romanizedSection |
| 309 | label | The same regional languages written in the English alphabet, for anyone who reads Roman script faster. | settings.romanizedFooter |
| 329 | header | Support and about | settings.supportSection |
| 333 | label | Help and FAQ | settings.helpRow |
| 337 | toast | Help articles are on the web panel for now. | settings.helpToast |
| 343 | label | Rate CGPE Connect | settings.rateRow |
| 345 | toast | CGPE Connect is not on the Play Store yet. Ratings open once it is listed. | settings.rateToast |
| 351 | label | Account and privacy | settings.accountRow |
| 352 | label | Data and deletion | settings.accountRowValue |
| 357 | label | Version | settings.version |

## `src/app/(tabs)/more.tsx` (partial — ~95% still hardcoded)

| line | kind | english | proposedKey |
|---|---|---|---|
| 77 | label | Master / Full oversight | more.viewMaster / more.viewMasterHint |
| 78 | label | Admin / Runs a team | more.viewAdmin / more.viewAdminHint |
| 79 | label | Team member / Own work only | more.viewTeam / more.viewTeamHint |
| 119 | toast | `Now previewing the ${label} side` [dynamic] / Back to your own view | more.previewOn / more.previewOff |
| 141 / 297 | header | More | more.title |
| 167 | header | Master control / Admin | more.groupMasterControl / more.groupAdmin |
| 171 | label | All teams and admins / Team members | more.allTeamsAdmins / more.teamMembers |
| 174 | label | Roster | more.rosterValue |
| 176 | label | Agent locations / Live | more.agentLocations / more.liveValue |
| 178 | label | Movement paths / Replay | more.movementPaths / more.replayValue |
| 180 | label | Portfolio analytics / Org-wide | more.portfolioAnalytics / more.orgWideValue |
| 185 | label | Payroll / Salary roster | more.payroll / more.payrollValue |
| 187 | label | Campaigns / Bulk sends | more.campaigns / more.campaignsValue |
| 188 | label | Notify team / Send alert | more.notifyTeam / more.notifyTeamValue |
| 192 | header | The book | more.groupBook |
| 194 | label | Leads and pipeline / Stages | more.leads / more.leadsValue |
| 195 | label | Segments / Smart lists | more.segments / more.segmentsValue |
| 196 | label | Families / Households | more.families / more.familiesValue |
| 197 | label | Premium and greetings / Renewals | more.premium / more.premiumValue |
| 198 | label | Prospects / Recruitment | more.prospects / more.prospectsValue |
| 202 | header | Day to day | more.groupDayToDay |
| 205 | label | Tickets | more.tickets |
| 208 | label | `${n} open` [dynamic] / Requests | more.ticketsOpenCount / more.ticketsValue |
| 214 | label | Reminders and follow-ups / Due dates | more.reminders / more.remindersValue |
| 215 | label | Calendar / Meetings | more.calendar / more.calendarValue |
| 216 | label | My attendance / GPS log | more.attendance / more.attendanceValue |
| 217 | label | WhatsApp Hub / Chats | more.whatsappHub / more.whatsappHubValue |
| 221 | header | Board | more.groupBoard |
| 223 | label | Notice Board / From the firm | more.noticeBoard / more.noticeBoardValue |
| 224 | label | Notes / Private | more.notes / more.notesValue |
| 228 | header | Reference | more.groupReference |
| 230 | label | Knowledge Base / Field guide | more.kb / more.kbValue |
| 231 | label | LIC plans / Products | more.licPlans / more.licPlansValue |
| 232 | label | Global search / Everything | more.search / more.searchValue |
| 236 | header | Account | more.groupAccount |
| 241 | label | Viewing as | more.viewingAs |
| 243 | label | Preview | more.previewPill |
| 245 | label | My profile | more.profile |
| 246 | label | Settings / Security, language | more.settings / more.settingsValue |
| 247 | label | Account and privacy / Data and deletion | more.account / more.accountValue |
| 258 | label | Search | more.qaSearch |
| 259 | label | Reminders | more.qaReminders |
| 260 | label | Tickets | more.qaTickets |
| 261 | label | WhatsApp | more.qaWhatsapp |
| 266 | label | Version | more.version |
| 270 | label | Data / Live / Not verified | more.dataRow / more.dataLive / more.dataNotVerified |
| 273 | label | Signed in as | more.signedInAs |
| 297 | label | `${label} access` [dynamic] | more.headerSubtitle |
| 317 | label | Preview mode | more.previewModePill |
| 327 | header | Quick actions | more.quickActions |
| 350 | header | About | more.aboutSection |
| 366 | title | Preview another side | more.sheetTitle |
| 367 | label | Changes what this app shows you. It does not change anyone's permissions. | more.sheetSubtitle |
| 369 | label | A preview only affects your own screen, and it ends when you switch back. | more.sheetFooter |
| 380 | label | Current | more.currentPill |
| 388 | label | My own view / Stop previewing | more.myOwnView / more.myOwnViewValue |

## `src/app/premium.tsx` (partial — ~65% still hardcoded)

| line | kind | english | proposedKey |
|---|---|---|---|
| 251 | error | Dispatch failed | premium.dispatchFailTitle |
| 252 | error | The send did not reach the server, so nothing was delivered. Try again, or message clients one at a time from the list. | premium.dispatchFailMsg |
| 261 / 311 | error | Nothing to send | premium.nothingToSendTitle |
| 263 | error | No client matched this occasion, so nothing was dispatched. | premium.nothingMatchedMsg |
| 274 | toast | `Dispatched to ${n} client(s)` [dynamic] | premium.dispatchedTitle |
| 276 | toast | The server confirmed the campaign was handed to the sender. | premium.dispatchedMsg |
| 285 | error | Nothing was confirmed sent | premium.noneConfirmedTitle |
| 286 | error | `${n} recipient(s) were found, but the server did not confirm a single delivery. Send them one at a time from the list below.` [dynamic] | premium.noneConfirmedMsg |
| 313 | error | No client matches this occasion right now, so there is nobody to message. | premium.nobodyToMessage |
| 318 | confirm | Find and send renewal reminders? / `Send to ${n} client(s)?` [dynamic] | premium.confirmScanTitle / premium.confirmSendTitle |
| 320 | confirm | Your whole client book is scanned for premiums due in the next 30 days, and each of those clients is sent a personalised WhatsApp. It runs in the background, so you can keep working. | premium.confirmScanMsg |
| 321 | confirm | `A personalised WhatsApp will be sent to all ${n} matching client(s). This runs in the background.` [dynamic] | premium.confirmSendMsg |
| 322 | confirm | Scan and send / Start sending | premium.confirmScanBtn / premium.confirmSendBtn |
| 340 | confirm | Campaign handed off | premium.handoffTitle |
| 341 | confirm | Your client book is being scanned and renewal reminders dispatched in the background. Watch the progress, or keep working? | premium.handoffScanMsg |
| 343 | confirm | The messages are being dispatched in the background. Watch the progress, or keep working? | premium.handoffSendMsg |
| 344 | confirm | Monitor progress | premium.monitorProgress |
| 345 | confirm | Continue working | premium.continueWorking |
| 350 | toast | Running in the background. Tap the progress bar to monitor. | premium.runningBg |
| 359 | button | Starting | premium.btnStarting |
| 360 / 458 | button | Find and send renewals | premium.btnFindSendRenewals |
| 365 | header | Personalised WhatsApp campaigns | premium.subtitle |
| 406 | title | Scan the book | premium.scanTheBook |
| 411 | label | Premiums falling due in the next 30 days | premium.scanCaption |
| 421 | label | Your whole client book is read live, then each client with a premium due is sent a personalised reminder on WhatsApp. It runs in the background. | premium.scanBody |
| 446 | button | Monitor progress | premium.monitorProgress |
| 456 | empty | Scan on demand | premium.emptyScanTitle |
| 457 | empty | Renewals are read live from your full client book rather than cached, so there is nothing to list until a scan runs. | premium.emptyScanSubtitle |
| 466 | empty | `${n} matched, none listed` [dynamic] | premium.emptyMatchedNoneTitle |
| 466 | empty | The server counted this audience but sent back no sample rows, so there are no names to show. The send button above still reaches every one of them. | premium.emptyMatchedNoneSubtitle |
| 467 | button | Reload the sample | premium.reloadSample |
| 472 | empty | Audience did not load | premium.emptyDegradedTitle |
| 473 | empty | The server could not be reached, so this is not a confirmed empty list. Try the request again in a moment. | premium.emptyDegradedSubtitle |
| 474 | button | Try again | common.tryAgain |
| 478 | empty | Nothing due | premium.emptyNothingDueTitle |
| 479 | empty | No client on your book matches this occasion this month. | premium.emptyNothingDueSubtitle |
| 486 | header | Audience sample | premium.audienceSample |
| 488 | label | `Plus ${n} more client(s). Use the send button above to reach every one of them.` [dynamic] | premium.audienceMoreFooter |
| 489 | label | Every matching client is listed here. | premium.audienceAllFooter |

## `src/app/(tabs)/home.tsx` (partial — >80% still hardcoded; highest priority)

| line | kind | english | proposedKey |
|---|---|---|---|
| 127 | label | `Clocked in ${time}` [dynamic] | home.clockedInAt |
| 142/145/898 | label | On field | home.onField |
| 146 | label | Location captured | home.locationCaptured |
| 269 | title | Notice board / Announcements from the firm | home.wNoticeBoardTitle / home.wNoticeBoardSub |
| 270 | title | Campaigns / Bulk WhatsApp sends to your book | home.wCampaignsTitle / home.wCampaignsSub |
| 271 | title | Smart segments / Slice the client book by need | home.wSegmentsTitle / home.wSegmentsSub |
| 272 | title | Families / Households and their total cover | home.wFamiliesTitle / home.wFamiliesSub |
| 273 | title | Knowledge base / The advisor field guide | home.wKbTitle / home.wKbSub |
| 274 | title | Commissions / What you have earned so far | home.wCommissionsTitle / home.wCommissionsSub |
| 275 | title | My attendance / Your GPS clock log, day by day | home.wAttendanceTitle / home.wAttendanceSub |
| 319 | label | `On duty, ${elapsed}` [dynamic] / On duty / Off duty | home.a11yOnDutyElapsed / home.onDuty / home.offDuty |
| 337 | label | on duty (lower) | home.onDutyLower |
| 750 | error | Location needed | home.locNeededTitle |
| 750 | error | Turn on location to clock in or out. Attendance is confirmed by GPS at the office. | home.locNeededMsg |
| 772 | error | Background location needed | home.bgLocTitle |
| 774 | error | Set location access to "Allow all the time" so your field route is recorded for the whole shift, then clock in again. | home.bgLocMsg |
| 801 / 857 | error | Too far to clock in | home.tooFarInTitle |
| 817 | error | Too far to clock out | home.tooFarOutTitle |
| 817 | error | You have to be at the office to clock out. | home.tooFarOutMsg |
| 827/872/908 | error | Attendance could not be recorded | home.attFailTitle |
| 828/873/909 | error | The server could not be reached. Check your connection and try again. | home.serverUnreachable |
| 845 | toast | Clocked out away from the office | home.clockedOutAwayTitle |
| 847 | toast | `You were ${distance} from the office when you clocked out.` [dynamic] | home.clockedOutAwayMsg |
| 857 | error | You have to be inside the office area to clock in. | home.tooFarInMsg |
| 893 | toast | Shift started, route not recorded | home.routeNotRecordedTitle |
| 894 | toast | Your clock-in was saved, but this phone could not start recording your field route. Tell your manager if the route matters today. | home.routeNotRecordedMsg |
| 934 | error | Task was not closed | home.taskNotClosedTitle |
| 936 | error | This task is assigned to someone else, so it cannot be closed from here. | home.taskForbiddenMsg |
| 937 | error | The server did not accept the change. Try again in a moment. | home.taskRejectedMsg |
| 1033 | label | `${dutyFor} on duty` [dynamic] / On duty | home.dutyElapsed / home.onDuty |
| 1050 | label | Due today | home.kpiDueToday |
| 1053 | label | Follow-ups | home.kpiFollowUps |
| 1056 | label | Open claims | home.kpiOpenClaims |
| 1059 | label | Open tickets | home.kpiOpenTickets |
| 1062 | label | Active leads | home.kpiActiveLeads |
| 1077 | label | Attendance | home.qaAttendance |
| 1165 | empty | Today's list did not load | home.tasksFailTitle |
| 1165 | empty | The server could not be reached, so this is not a confirmed empty day. Pull down to refresh. | home.unconfirmedDay |
| 1166 | button | Try again | common.tryAgain |
| 1170 | empty | No tasks assigned yet | home.tasksEmptyTitle |
| 1171 | empty | Work assigned to you shows up here. Add your own to plan the day. | home.tasksEmptySub |
| 1179 | empty | Nothing is overdue and nothing else is due today. | home.tasksAllClearSub |
| 1197 | label | `Overdue · ${who}` [dynamic] | home.taskOverduePrefix |
| 1207 | label | `Mark ${title} done` [dynamic] | home.a11yMarkTaskDone |
| 1240 | title | The day, in order | home.wDaySpineTitle |
| 1247 | empty | Today did not load / Nothing is timed for today | home.daySpineFailTitle / home.daySpineEmptyTitle |
| 1250 | empty | Tasks and follow-ups dated today appear here in the order they fall due. | home.daySpineEmptySub |
| 1251 | button | Try again / Open calendar | common.tryAgain / home.openCalendar |
| 1288 | empty | Follow-ups did not load / No follow-up is pending | home.followUpsFailTitle / home.followUpsEmptyTitle |
| 1290 | empty | The server did not answer, so an empty list here is not confirmed. Pull down to refresh. | home.unsureList |
| 1291 | empty | Birthdays, renewals and callbacks land here on the day they are due. | home.followUpsEmptySub |
| 1294 | button | Open follow-ups | home.openFollowUps |
| 1314 | label | `Namaste ${clientName}` [dynamic, WhatsApp prefill] | common.whatsappGreeting |
| 1332 | title | Prospects | home.wProspectsTitle |
| 1339 | empty | Prospects did not load / No prospect in the pool yet | home.prospectsFailTitle / home.prospectsEmptyTitle |
| 1341 | empty | The server did not answer, so an empty pool here is not confirmed. Pull down to refresh. | home.prospectsUnsure |
| 1342 | empty | People you are recruiting appear here as soon as they are added. | home.prospectsEmptySub |
| 1345 | button | Open prospects | home.openProspects |
| 1351 | label | Unnamed prospect | home.unnamedProspect |
| 1380 | title | Leads pipeline | home.wLeadsTitle |
| 1387 | empty | The pipeline did not load / Every lead is closed / No lead in the pipeline yet | home.leadsFailTitle / home.leadsAllClosedTitle / home.leadsEmptyTitle |
| 1389 | empty | The server did not answer, so an empty pipeline here is not confirmed. Pull down to refresh. | home.leadsUnsure |
| 1391 | empty | Nothing is open right now. Closed leads — policy issued, or lost — stay on the pipeline screen. | home.leadsAllClosedSub |
| 1392 | empty | New enquiries land here and move along the stages as you work them. | home.leadsEmptySub |
| 1395 | button | Open pipeline | home.openPipeline |
| 1437 | title | Notes | home.wNotesTitle |
| 1444 | empty | Your notes did not load / Nothing on your board yet | home.notesFailTitle / home.notesEmptyTitle |
| 1446 | empty | The server did not answer, so an empty board here is not confirmed. Pull down to refresh. | home.notesUnsure |
| 1447 | empty | Your private board holds what you jot down here and what you dictate on WhatsApp. It is tied to your own number. | home.notesEmptySub |
| 1448 | button | Try again / Open notes | common.tryAgain / home.openNotes |
| 1467 | label | Voice note | home.voiceNoteFallback |
| 1472 | label | Voice | home.voicePill |
| 1491 | title | Claim requests | home.wClaimsTitle |
| 1498 | empty | Claims did not load / No claim is open / No claim on the register yet | home.claimsFailTitle / home.claimsNoneOpenTitle / home.claimsEmptyTitle |
| 1500 | empty | The server did not answer, so an empty register here is not confirmed. Pull down to refresh. | home.claimsUnsure |
| 1502 | empty | Everything on the register is settled or closed. The full history stays on the Claims screen. | home.claimsNoneOpenSub |
| 1503 | empty | Claims raised by your policyholders appear here from intake to settlement. | home.claimsEmptySub |
| 1506 | button | Open claims | home.openClaims |
| 1540 | title | Issue log | home.wIssueLogTitle |
| 1547 | empty | The issue log did not load / Nothing needs attention | home.issueLogFailTitle / home.issueLogEmptyTitle |
| 1549 | empty | The server did not answer, so an empty log here is not confirmed. Pull down to refresh. | home.issueLogUnsure |
| 1550 | empty | This log lists open tickets that are unclaimed, flagged red, or raised as P1. None of them is right now. | home.issueLogEmptySub |
| 1553 | button | Open all tickets | home.openAllTickets |
| 1556 | label | Open tickets that are unclaimed, flagged red, or raised as P1. | home.issueLogFooter |
| 1561/1609 | label | Ticket (fallback) | home.ticketFallback |
| 1567 | label | Unclaimed | home.unclaimed |
| 1586 | title | Tickets | home.wTicketsTitle |
| 1593 | empty | Tickets did not load / Every ticket is closed / No ticket in the inbox | home.ticketsFailTitle / home.ticketsAllClosedTitle / home.ticketsEmptyTitle |
| 1595 | empty | The server did not answer, so an empty inbox here is not confirmed. Pull down to refresh. | home.ticketsUnsure |
| 1597 | empty | Nothing is open right now. Closed tickets stay on the Tickets screen. | home.ticketsAllClosedSub |
| 1598 | empty | Requests raised by policyholders land here as tickets you can claim and work. | home.ticketsEmptySub |
| 1601 | button | Open tickets | home.openTickets |
| 1630 | title | Team | home.wTeamTitle |
| 1637 | empty | The roster did not load / No one on your roster yet | home.teamFailTitle / home.teamEmptyTitle |
| 1639 | empty | The server did not answer, so an empty roster here is not confirmed. Pull down to refresh. | home.teamUnsure |
| 1640 | empty | People reporting to you appear here with their live task counts. | home.teamEmptySub |
| 1643 | button | Open team | home.openTeam |
| 1646 | label | `${onDuty} of ${n} on duty right now.` [dynamic] | home.teamOnDutyFooter |
| 1658 | label | On duty / Off duty | home.onDuty / home.offDuty |
| 1678 | title | Portfolio analytics | home.wAnalyticsTitle |
| 1683 | label | Organisation-wide totals. Open analytics for the full breakdown. | home.analyticsFooter |
| 1687 | label | Clients | home.analyticsClients |
| 1691 | label | Leads | home.analyticsLeads |
| 1697 | label | Claims open | home.analyticsClaimsOpen |
| 1701 | label | Tickets | home.analyticsTickets |
| 1710 | empty | Analytics did not load | home.analyticsFailTitle |
| 1711 | empty | The server did not answer, so no total here would be confirmed. Pull down to refresh. | home.analyticsUnsure |
| 1718 | label | Book value, cover bands and trends across the organisation | home.analyticsLinkSub |
| 1764 | label | Team (greeting name fallback) | home.greetingNameFallback |
| 1778 | label | Search everything (a11y) | home.a11ySearch |
| 1793 | label | `Notifications, ${unread} unread` [dynamic] / Notifications (a11y) | home.a11yNotifsUnread / home.a11yNotifs |
| 1821 | label | Your profile (a11y) | home.a11yProfile |
| 1848 / 1865 | header | Today | home.today |
| 1846 | label | `Today, ${done} of ${n} tasks done` [dynamic] | home.a11yTodayTasks |
| 1855 | label | tasks done today | home.tasksDoneToday |
| 1867 | label | Not confirmed / Nothing scheduled | home.heroNotConfirmed / home.heroNothingScheduled |
| 1871 | label | The server did not answer, so this is not a confirmed empty day. Pull down to refresh. | home.heroUnconfirmedSub |
| 1872 | label | No task is due today. | home.heroNoTaskSub |
| 1879 | header | Attendance | home.attendanceEyebrow |
| 1948 | header | Organisation / Your branch | home.orgSection / home.branchSection |
| 1961 | empty | Organisation figures did not load | home.orgFailTitle |
| 1962 | empty | The server did not answer, so no org total here would be confirmed. Pull down to refresh. | home.orgUnsure |
| 1967 | empty | No organisation figures yet | home.orgEmptyTitle |
| 1969 | empty | Team and org totals appear here once records are linked to this account. | home.orgEmptySub |
| 1970 | button | Open team | home.openTeam |
