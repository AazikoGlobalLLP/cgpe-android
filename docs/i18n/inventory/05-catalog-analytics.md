# Inventory — analytics / commissions / lic-plans / contests / kb / tickets / payroll / dashboards

~238 strings, all 9 screens **100% hardcoded**. Line numbers as of 2026-08-11 — anchor on the English
literal. Interpolation marked `(dynamic)`. See `../SCOPE.md`.

## `src/app/analytics.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 247 | label | Birthdays today | analytics.birthdaysToday |
| 248 | label | Anniversaries | analytics.anniversaries |
| 249 | label | Maturity soon | analytics.maturitySoon |
| 266 | title | Portfolio analytics | analytics.title |
| 267 | header | Organisation wide, live figures | analytics.subtitle |
| 274 | label | Reload portfolio figures (a11y) | analytics.reloadA11y |
| 294 | empty | Portfolio figures did not load | analytics.loadFailedTitle |
| 295 | empty | The server could not be reached, so nothing here is confirmed. Pull down to try the request again. | analytics.loadFailedBody |
| 302 | empty | No live portfolio yet | analytics.emptyTitle |
| 303 | empty | These figures are read from your CGPE account. Sign in and the whole book is measured here. | analytics.emptyBody |
| 296,304,400 | button | Try again | common.tryAgain |
| 312 | header | Total annual premium | analytics.totalPremiumEyebrow |
| 316 | label | `${n} clients` (dynamic) | analytics.clientsCount |
| 321 | label | `${amount} sum assured` (dynamic) | analytics.sumAssuredInline |
| 328 | label | `${n} readings taken in this session` (dynamic) | analytics.readingsCount |
| 343 | label | Clients | analytics.clients |
| 351 | label | Sum assured | analytics.sumAssured |
| 367 | label | Renewals due | analytics.renewalsDue |
| 377 | label | Birthdays this month | analytics.birthdaysThisMonth |
| 388 | label | Badges and strips compare readings taken in this session, not against yesterday. A tile with no strip has not been read twice with a complete answer. | analytics.sessionNote |
| 394 | header | Reach | analytics.reach |
| 398 | error | Campaign counters did not load | analytics.campFailTitle |
| 399 | error | The campaign aggregate did not answer, so reach and this month's counts are not shown. The portfolio totals above are unaffected. | analytics.campFailBody |
| 406 | empty | No clients counted yet | analytics.noClientsTitle |
| 407 | empty | Reach is measured against the size of your book, and the book currently reads zero. | analytics.noClientsBody |
| 413 | label | Reachable on WhatsApp | analytics.reachableWhatsapp |
| 415,422 | label | `${n} of ${total}` (dynamic) | analytics.ofCount |
| 420 | label | Premium due this month | analytics.premiumDueMonth |
| 436 | header | This month | analytics.thisMonth |
| 443 | label | Every counter here was answered as zero by the campaign engine. Nothing falls due this month, and nothing is missing. | analytics.allZeroNote |
| 453 | header | Book detail | analytics.bookDetail |
| 454 | label | Averages are derived from the totals above. A counter that reads zero was answered as zero by the server. | analytics.bookDetailFooter |
| 456 | label | Total annual premium | analytics.rowTotalPremium |
| 457 | label | Total sum assured | analytics.rowSumAssured |
| 460 | label | Average annual premium | analytics.avgPremium |
| 467 | label | Average cover per client | analytics.avgCover |
| 472 | label | Clients on the book | analytics.clientsOnBook |
| 475 | label | Reachable on WhatsApp | analytics.rowReachable |

## `src/app/commissions.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 133 | header | Loading your earnings | commissions.loadingSub |
| 135 | header | Earnings and payouts | commissions.blankSub |
| 136 | header | `${amount} year to date` (dynamic) | commissions.ytdSub |
| 140 | title | Commissions | commissions.title |
| 165 | empty | Your earnings did not load | commissions.loadFailedTitle |
| 166 | empty | The commission ledger could not be reached, so these blanks are unconfirmed rather than zero. Pull down to try again. | commissions.loadFailedBody |
| 167 | button | Try again | common.tryAgain |
| 171 | empty | No commission recorded yet | commissions.emptyTitle |
| 173 | empty | Once a policy you booked is processed, the earning, its payout status and the running year total appear here. | commissions.emptyBody |
| 174 | button | Refresh | common.refresh |
| 182 | header | This month | commissions.thisMonthEyebrow |
| 188 | label | No figure for last month, so there is nothing to compare against yet. | commissions.noLastMonth |
| 193 | label | Level with last month | commissions.levelWithLast |
| 194 | label | `${+/-}${n}% vs last month` (dynamic) | commissions.vsLastMonth |
| 210 | label | Monthly target | commissions.monthlyTarget |
| 212 | label | `${amount} of ${target}` (dynamic) | commissions.targetOf |
| 218 | label | No monthly target is set on your profile. | commissions.noTarget |
| 228 | label | Last month | commissions.lastMonth |
| 233 | label | Pending payout | commissions.pendingPayout |
| 245 | header | `Last ${n} months` (dynamic) | commissions.lastNMonths |
| 245 | header | Year to date | commissions.ytdHeader |
| 249 | label | Year to date | commissions.ytdLabel |
| 253 | label | `Best ${amount}` (dynamic) | commissions.best |
| 289 | empty | Not enough months on record yet to draw a trend. | commissions.noTrend |
| 298 | header | Recent commissions | commissions.recentTitle |
| 303 | empty | No individual payouts listed | commissions.noPayoutsTitle |
| 304 | empty | The totals above are in, but the ledger has not returned the line items behind them. | commissions.noPayoutsBody |
| 317 | label | Client (fallback name) | commissions.clientFallback |

## `src/app/lic-plans.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 64 | label | `${lo} to ${hi} years` (dynamic) | lic.ageRange |
| 66 | label | `From ${lo} years` (dynamic) | lic.ageFrom |
| 67 | label | `Up to ${hi} years` (dynamic) | lic.ageUpTo |
| 104 | label | Unnamed plan | lic.unnamedPlan |
| 107 | label | Other (kind fallback) | lic.kindOther |
| 117 | label | All plans | lic.allPlans |
| 156 | header | Loading the product library | lic.loadingSub |
| 158 | header | Product library | lic.librarySub |
| 159 | header | `${n} plan(s) on file` (dynamic) | lic.onFileCount |
| 163 | title | LIC Plans | lic.title |
| 193 | empty | The plan library could not load | lic.loadFailedTitle |
| 194 | empty | No plans on file yet | lic.emptyTitle |
| 194 | empty | The server did not answer, so nothing here is confirmed. Pull down to try again. | lic.loadFailedBody |
| 195 | empty | The product catalogue is empty right now, so there is nothing to list here. Nothing has gone wrong with your account. | lic.emptyBody |
| 196 | button | Check again | lic.checkAgain |
| 200 | label | Plan wordings and benefit tables stay with your branch until the library is populated. | lic.branchNote |
| 216 | empty | `No plan is filed under "${kind}"` (dynamic) | lic.filterMissTitle |
| 216 | empty | `The library holds ${n} plan(s), none of them in this group.` (dynamic) | lic.filterMissBody |
| 217 | button | Show all plans | lic.showAll |
| 227 | label | Tap a plan for its entry ages, term and what it is usually sold for. | lic.listFooter |
| 235 | label | `Plan ${code}` (dynamic) | lic.planCode |
| 266 | title | Plan (sheet fallback) | lic.planFallback |
| 267 | header | `Plan number ${code}` (dynamic) | lic.planNumberSub |
| 276 | label | Type | lic.rowType |
| 277 | label | Entry age | lic.rowEntryAge |
| 278 | label | Term | lic.rowTerm |
| 279 | label | Plan number | lic.rowPlanNumber |
| 284 | header | Riders | lic.riders |
| 293 | label | This record carries only a name and a type. Ask your branch for the full plan wording. | lic.sparseRecord |

## `src/app/contests.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 73 | title | Contests | contests.title |
| 74 | header | Loading your qualifications | contests.loadingSub |
| 74 | header | `${n} running` (dynamic) | contests.runningSub |
| 74 | header | Leaderboards and rewards | contests.defaultSub |
| 91 | empty | Contests could not load | contests.loadFailedTitle |
| 92 | empty | No contest running right now | contests.emptyTitle |
| 93 | empty | The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again. | contests.loadFailedBody |
| 94 | empty | Club and campaign contests appear here while they are open, with your live progress against each one. | contests.emptyBody |
| 96 | button | Try again | common.tryAgain |
| 116 | label | Closed | contests.closed |
| 117 | label | Closes today | contests.closesToday |
| 118,119 | label | `${n} days left` (dynamic) | contests.daysLeft |
| 145 | label | rank | contests.rank |

## `src/app/kb.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 74 | label | Untitled note | kb.untitled |
| 206 | label | All domains | kb.allDomains |
| 210 | label | All topics | kb.allTopics |
| 251 | header | Opening the field reference | kb.loadingReadout |
| 253 | header | Nothing to read here | kb.emptyReadout |
| 254 | header | `${n} article(s){, ${m} loaded}` (dynamic) | kb.articleCountReadout |
| 259 | title | Knowledge Base | kb.title |
| 260 | header | Answers you can read out loud | kb.subtitle |
| 265 | label | Articles | kb.articlesEyebrow |
| 274 | placeholder | Ask it the way a customer would | kb.searchPlaceholder |
| 282 | button | Clear | common.clear |
| 311 | empty | `Nothing filed under "${query}"` (dynamic) | kb.searchMissTitle |
| 313 | empty | No article in this part of the library | kb.facetMissTitle |
| 314 | empty | The reference could not load | kb.loadFailedTitle |
| 315 | empty | The reference library is empty | kb.emptyTitle |
| 320 | empty | Search covers titles, body text, topics, tags and the example questions each article answers. Try fewer words. | kb.searchMissBody |
| 321 | empty | Nothing is filed under this domain and topic together. Widen one of them. | kb.facetMissBody |
| 322 | empty | The server did not answer, so nothing here is confirmed. Pull down to try again. | kb.loadFailedBody |
| 323 | empty | No articles have been published to this build yet. Your branch still holds the printed circulars. | kb.emptyBody |
| 326 | button | Clear search | common.clearSearch |
| 327 | button | Show everything | kb.showEverything |
| 328 | button | Try again | common.tryAgain |
| 356 | button | Load more articles | kb.loadMore |
| 359 | label | `All ${n} shown` (dynamic) | kb.allShown |
| 474 | error | Could not refresh this article | kb.refreshFailTitle |
| 474 | error | This article could not be opened | kb.openFailTitle |
| 476 | error | Showing the copy that arrived with the list. Check the review date before you quote it. | kb.refreshFailBody |
| 477 | error | The server did not answer. Try again once you have a signal. | kb.openFailBody |
| 478 | button | Try again | kb.readerTryAgain |
| 505 | empty | This entry carries a title but no body text. Ask your branch for the full circular. | kb.noBody |
| 512 | header | Questions this answers | kb.questionsHeader |
| 527 | header | Where this comes from | kb.provenanceTitle |
| 528 | label | No review date is recorded on this entry. | kb.noReviewDate |
| 530 | label | Topic | kb.rowTopic |
| 531 | label | Domain | kb.rowDomain |
| 532 | label | Category | kb.rowCategory |
| 533 | label | Applies to | kb.rowAppliesTo |
| 534 | label | Source | kb.rowSource |
| 536 | label | Last reviewed | kb.rowLastReviewed |
| 539 | label | Reference | kb.rowReference |

## `src/app/tickets/index.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 229 | label | All (segment) | tickets.stateAll |
| 230 | label | Active (segment) | tickets.stateActive |
| 231 | label | Closed (segment) | tickets.stateClosed |
| 239 | label | All types | tickets.allTypes |
| 249 | label | Nothing to show | tickets.nothingToShow |
| 252 | label | `${n} of ${total} loaded, page ${p} of ${tp}` (dynamic) | tickets.readoutLoaded |
| 253 | label | `${n} of ${total} shown` (dynamic) | tickets.readoutShown |
| 268 | empty | The request inbox could not load | tickets.loadFailedTitle |
| 269 | empty | The server did not answer, so nothing here is confirmed. Check your connection and pull down to refresh. | tickets.loadFailedBody |
| 271 | button | Try again | tickets.tryAgain |
| 277 | empty | `No request matches "${query}"` (dynamic) | tickets.searchMissTitle |
| 278 | empty | Search runs over the whole inbox, by client name, phone, ticket reference, policy number or task. | tickets.searchMissBody |
| 279 | button | Clear search | tickets.clearSearch |
| 286 | empty | `No ${type} requests in this view` (dynamic) | tickets.typeMissTitle |
| 287 | empty | This type has nothing in the state you are looking at. Try another state, or drop the type filter. | tickets.typeMissBody |
| 288 | button | Show all types | tickets.showAllTypes |
| 294 | empty | Nothing closed yet | tickets.closedEmptyTitle |
| 295 | empty | Requests move here once they are resolved, completed or cancelled. | tickets.closedEmptyBody |
| 297 | button | See active requests | tickets.seeActive |
| 303 | empty | No open requests | tickets.noOpenTitle |
| 303 | empty | No requests raised yet | tickets.noneRaisedTitle |
| 304 | empty | Every request raised for your clients has been closed. New ones arrive here from WhatsApp automatically. | tickets.noOpenBody |
| 306 | empty | Requests raised by the WhatsApp bot, by AI-Ops or from the admin panel land here. | tickets.noneRaisedBody |
| 308 | button | Include closed | tickets.includeClosed |
| 309 | button | Refresh | tickets.refresh |
| 317 | title | Requests | tickets.title |
| 318 | header | Every ticket raised across the firm | tickets.subtitle |
| 323 | label | In the inbox | tickets.inboxEyebrow |
| 331 | placeholder | Client, phone, reference or task | tickets.searchPlaceholder |
| 355 | button | Clear type | tickets.clearType |
| 428 | button | Call (swipe) | tickets.actionCall |
| 431 | button | WhatsApp (swipe) | tickets.actionWhatsapp |
| 433 | other | `Namaste ${name}` (dynamic, WhatsApp prefill) | tickets.waGreeting |
| 451 | label | Request (ref fallback) | tickets.refFallback |
| 465 | empty | No description was captured | tickets.noDescription |
| 519 | button | Load more requests | tickets.loadMore |
| 522 | label | `All ${total} matching requests shown` (dynamic) | tickets.allMatchingShown |
| 522 | label | `All ${total} requests shown` (dynamic) | tickets.allShown |

## `src/app/tickets/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 121 | label | Nobody has started on it | tickets.hintNew |
| 122 | label | Being worked on right now | tickets.hintInProgress |
| 123 | label | Waiting on the customer for something | tickets.hintAwaiting |
| 124 | label | Done, pending a final close | tickets.hintResolved |
| 125 | label | Finished. It leaves the active inbox | tickets.hintClosed |
| 221 | error | Your profile has no name on it, so the request cannot be assigned to you. Add a name in your profile and try again. | tickets.claimNoName |
| 232 | error | The server did not accept the assignment, so this request is still unclaimed. Nothing was changed. | tickets.claimRefused |
| 233 | toast | You are handling this request | tickets.claimDone |
| 249 | error | The server did not accept the status change, so the request is still where it was. | tickets.advanceRefused |
| 251 | toast | `Status set to ${state}` (dynamic) | tickets.advanceDone |
| 265 | error | The note was not saved. Nothing has been added to this request. | tickets.noteRefused |
| 266 | toast | Note added | tickets.noteDone |
| 286,320 | title | Request (header/fallback) | tickets.detailTitle |
| 289 | empty | This request could not load | tickets.detailLoadFailedTitle |
| 289 | empty | Request not found | tickets.detailNotFoundTitle |
| 291 | empty | The server did not answer, so nothing here is confirmed. Check your connection and try again. | tickets.detailLoadFailedBody |
| 292 | empty | This ticket is not in the inbox you can see. It may have been closed, reassigned or removed. | tickets.detailNotFoundBody |
| 293 | button | Try again | tickets.detailTryAgain |
| 321 | header | `${typeLabel} · raised ${ago}` (dynamic) | tickets.detailSubtitle |
| 346 | label | No number on this request | tickets.noNumber |
| 357 | label | Closed | tickets.pillClosed |
| 372 | label | You are handling this | tickets.ownedByYou |
| 373 | label | `${owner} is handling this` (dynamic) | tickets.ownedByOther |
| 374 | label | Nobody is handling this yet | tickets.unowned |
| 387 | header | Why this was raised | tickets.whyRaised |
| 389 | empty | No description was captured for this request. | tickets.noDescriptionDetail |
| 397 | header | What needs doing | tickets.whatNeedsDoing |
| 407 | header | In the customer's words | tickets.customerWords |
| 415 | header | Request (section) | tickets.sectionRequest |
| 417 | label | Status | tickets.rowStatus |
| 423 | label | Policy number | tickets.rowPolicyNo |
| 425 | label | Mobile | tickets.rowMobile |
| 426 | label | Raised by | tickets.rowRaisedBy |
| 427 | label | Category | tickets.rowCategory |
| 429 | label | `Linked ${type}` / record (dynamic) | tickets.rowLinked |
| 431 | label | Language | tickets.rowLanguage |
| 432 | label | Raised | tickets.rowRaised |
| 434 | label | Last update | tickets.rowLastUpdate |
| 440 | header | Ownership | tickets.sectionOwnership |
| 443 | label | Owner | tickets.rowOwner |
| 443 | label | Unclaimed (owner fallback) | tickets.unclaimed |
| 447 | label | Team | tickets.rowTeam |
| 449 | label | Assignment | tickets.rowAssignment |
| 457 | button | Update status | tickets.updateStatus |
| 466 | button | Take it over | tickets.takeOver |
| 479 | header | Notes | tickets.sectionNotes |
| 479 | label | Notes are visible to everyone who can see this request. | tickets.notesFooter |
| 491 | header | Activity | tickets.sectionActivity |
| 491 | label | Newest first. Every status change, assignment and note is recorded here. | tickets.activityFooter |
| 499 | empty | Nothing has happened on this request since it was raised. | tickets.noActivity |
| 522 | label | `Call ${name}` a11y (dynamic) | tickets.callA11y |
| 530 | other | `Namaste ${name}` (dynamic, WhatsApp prefill) | tickets.waGreeting |
| 531 | label | `Open WhatsApp chat with ${name}` a11y (dynamic) | tickets.waA11y |
| 535 | button | I'll handle this | tickets.claimCta |
| 545 | button | Add a note | tickets.addNoteCta |
| 558 | title | Update status (sheet) | tickets.updateStatusSheet |
| 559 | header | `Currently ${status}` (dynamic) | tickets.currentlyStatus |
| 577 | title | Add a note (sheet) | tickets.addNoteSheet |
| 581 | button | Save note | tickets.saveNote |
| 592 | label | Note (field) | tickets.noteFieldLabel |
| 595 | placeholder | What happened, or what you agreed with the customer | tickets.notePlaceholder |
| 598 | label | This is added to the activity trail with your name against it. | tickets.noteHint |
| 333 | error | That change was not saved | tickets.changeNotSavedTitle |

## `src/app/payroll.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 44 | label | Day-wise | payroll.segDayWise |
| 44 | label | Hourly | payroll.segHourly |
| 44 | label | Base | payroll.segBase |
| 138 | empty | Payroll is admin-only | payroll.gatedTitle |
| 139 | empty | Salary figures are visible to administrators and the master account. Ask an administrator if you need access. | payroll.gatedBody |
| 148 | title | Payroll | payroll.title |
| 148 | header | Loading the salary roster | payroll.loadingSub |
| 168 | empty | The payroll roster did not load | payroll.loadFailedTitle |
| 171 | empty | The salary service could not be reached, so this is blank rather than empty. Pull down to try again. | payroll.loadFailedBodyDegraded |
| 172 | empty | We could not load the payroll roster for this month. Pull down or retry. | payroll.loadFailedBody |
| 174 | button | Try again | payroll.tryAgain |
| 179 | empty | No payroll profiles yet | payroll.emptyTitle |
| 180 | empty | Nobody has a salary profile for this month. Payroll profiles are created in the admin panel; once they exist, each member's computed pay appears here. | payroll.emptyBody |
| 187 | header | `Total payable · ${month}` (dynamic) | payroll.totalPayable |
| 190 | label | `${n} member(s)` (dynamic) | payroll.memberCount |
| 191 | label | `${n} with pay` (dynamic) | payroll.withPay |
| 193 | label | Computed by the server from each member's attendance. Figures are gross, before deductions. | payroll.grossNote |
| 202 | header | By member | payroll.byMember |
| 260 | label | `${present}/${working} days` (dynamic) | payroll.daysCount |
| 264 | label | Member (name fallback) | payroll.memberFallback |
| 270 | label | No staff match | payroll.noStaffMatch |
| 274 | label | No pay | payroll.noPay |

## `src/screens/dashboards.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 184 | title | Team performance today | dashboards.adminHeroTitle |
| 185 | header | tasks completed across your team | dashboards.adminHeroSub |
| 191 | label | Open team (a11y) | dashboards.openTeamA11y |
| 204 | label | Clocked in | dashboards.clockedIn |
| 205 | label | Online | dashboards.online |
| 206 | label | Open tasks | dashboards.openTasksMini |
| 218 | label | Client book | dashboards.clientBook |
| 219 | label | Claims in process | dashboards.claimsInProcess |
| 220 | label | Open tickets | dashboards.openTickets |
| 224 | header | Admin actions | dashboards.adminActions |
| 226 | label | Assign task | dashboards.assignTask |
| 227 | label | Send renewals | dashboards.sendRenewals |
| 228 | label | Team | dashboards.team |
| 229 | label | Agent map | dashboards.agentMap |
| 230 | label | Claims | dashboards.claims |
| 235 | header | `Team (${n})` (dynamic) | dashboards.teamCount |
| 235 | button | View all | dashboards.viewAll |
| 244 | label | On duty | dashboards.onDuty |
| 245 | label | Off | dashboards.off |
| 272 | title | Organisation book | dashboards.masterHeroTitle |
| 275 | header | `clients · ${n} active leads · ${m} team` (dynamic) | dashboards.masterHeroSub |
| 276 | header | Loading the organisation book | dashboards.masterHeroLoading |
| 281 | label | Open analytics (a11y) | dashboards.openAnalyticsA11y |
| 292 | label | Admins | dashboards.adminsMini |
| 293 | label | Agents | dashboards.agentsMini |
| 294 | label | On duty | dashboards.onDutyMini |
| 307 | label | Total clients | dashboards.totalClients |
| 308 | label | Active leads | dashboards.activeLeads |
| 309 | label | Claims total | dashboards.claimsTotal |
| 310 | label | In process | dashboards.inProcess |
| 311 | label | Claims paid | dashboards.claimsPaid |
| 312 | label | Open tasks | dashboards.openTasksTile |
| 316 | header | Master controls | dashboards.masterControls |
| 318 | label | All teams | dashboards.allTeams |
| 319 | label | Agent map | dashboards.agentMapMaster |
| 320 | label | Movement | dashboards.movement |
| 321 | label | Analytics | dashboards.analytics |
| 322 | label | Campaigns | dashboards.campaigns |
| 323 | label | Assign task | dashboards.assignTaskMaster |
| 328 | header | `Admins (${n})` (dynamic) | dashboards.adminsCount |
| 328 | button | All teams | dashboards.allTeamsAction |
| 344 | header | Live activity | dashboards.liveActivity |
| 344 | button | All | dashboards.allAction |
