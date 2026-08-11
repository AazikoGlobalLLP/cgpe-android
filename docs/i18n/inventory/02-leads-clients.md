# Inventory — leads / lead-detail / clients / client-detail / search / segments / families / prospects

~360 strings, all 8 screens **100% hardcoded**. Line numbers as of 2026-08-11 — anchor on the English
literal. Interpolation marked `(interp)`. `Namaste {name}` prefills are outbound WhatsApp text — see
`../SCOPE.md` §4.2. Data-derived labels (`STAGE_META`, `SEG_META`, `CLAIM_STATUS`) are excluded — they
live in `src/data/labels.ts`, a separate surface (`../SCOPE.md` §4.2). See `../SCOPE.md`.

## `src/app/(tabs)/leads.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 149 | label | All | leads.filterAll |
| 187 | toast | `${name} moved to ${stageLabel}` (interp) | leads.movedToast |
| 194 | error | That move was not saved | leads.moveNotSavedTitle |
| 195 | error | `${name} could not be moved. The server did not confirm the change, so the lead is still at ${stage}.` (interp) | leads.moveNotSavedMsg |
| 218 | toast | `${name} added to your pipeline` (interp) | leads.addedToast |
| 228 | error | That lead is not on the server yet | leads.notOnServerTitle |
| 229 | error | `${name} was captured on this device, but the server did not confirm it. Pull to refresh and check before adding this lead again.` (interp) | leads.notOnServerMsg |
| 231 | error | That lead was not added | leads.notAddedTitle |
| 233 | error | `The server refused to create ${name}: this account does not have access to Leads. Nothing was saved, on this device or on the server.` (interp) | leads.notAddedForbidden |
| 234 | error | `The server has nowhere to create ${name} — it answered that the leads endpoint is not there. Nothing was saved, on this device or on the server.` (interp) | leads.notAddedMissing |
| 264 | empty | `No lead matches "${q}"` (interp) | leads.emptySearchTitle |
| 265 | empty | `Nothing at ${stageLabel} right now` (interp) | leads.emptyFilterTitle |
| 265 | empty | this stage | leads.thisStage |
| 266 | empty | Your pipeline could not load | leads.emptyOutageTitle |
| 267 | empty | No leads in your pipeline yet | leads.emptyNoneTitle |
| 270 | empty | Search runs over name, interest, city and mobile number. | leads.emptySearchSub |
| 271 | empty | Every other stage is still there. Switch the filter to see the rest of the pipeline. | leads.emptyFilterSub |
| 272 | empty | The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh. | leads.emptyOutageSub |
| 273 | empty | Add the first one and it will sit at the New stage until you move it forward. | leads.emptyNoneSub |
| 276 | button | Clear search | common.clearSearch |
| 277 | button | Show all stages | leads.showAllStages |
| 278 | button | Try again | common.tryAgain |
| 279 / 721 | button | Add a lead / Add lead | leads.addLead |
| 287 | title | Leads | leads.title |
| 288 | header | Loading your pipeline | leads.loadingSubtitle |
| 288 | header | `${n} leads, ${openCount} still open` (interp) | leads.headerSubtitle |
| 292 | label | Open pipeline | leads.openPipeline |
| 302 | placeholder | Name, interest, city or mobile | leads.searchPlaceholder |
| 326 | label | Meeting booked or further | leads.meterLabel |
| 328 | label | `${engaged} of ${open}` (interp) | leads.meterValue |
| 336 | button | By stage | leads.byStage |
| 349 | button | Refresh | common.refresh |
| 435 | label | No interest recorded | leads.noInterest |
| 447 | button | `To ${stageLabel}` (interp) | leads.swipeToStage |
| 447 / 610 | button | Close as won | leads.closeAsWon |
| 454 | button | WhatsApp | common.whatsapp |
| 457 | other | `Namaste ${name}` (interp, WhatsApp prefill) | common.whatsappGreeting |
| 462 | button | Call | common.call |
| 517 | label | 1 lead / `${count} leads` (interp) | leads.footerCount |
| 517 | label | . Swipe a row to move it on. | leads.footerSwipeHint |
| 544 | title | Pipeline by stage | leads.pipelineTitle |
| 546 | header | `${open} open, ${value} in play` (interp) | leads.pipelineSubtitle |
| 547 | header | Nothing open right now | leads.pipelineNothingOpen |
| 552 | label | Policy issued, out of every lead you have closed | leads.wonRateLabel |
| 554 | label | `${won} of ${closed}` (interp) | leads.wonRateValue |
| 559 | other | No lead has been closed yet, so there is no win rate to show. | leads.noWinRate |
| 563 | header | Stages | leads.stagesTitle |
| 563 | label | Tap a stage to filter the list behind this sheet. | leads.stagesFooter |
| 571 | label | None | leads.none |
| 601 | title | Close this lead as won? | leads.closeSheetTitle |
| 606 | header | `${name} leaves the open pipeline. Any stage can still be set again from the lead's own screen.` (interp) | leads.closeSheetSubtitle |
| 609 | button | Not yet | leads.notYet |
| 615 | header | What moves | leads.whatMovesTitle |
| 616 | label | Lead | leads.lead |
| 617 | label | From | leads.from |
| 618 | label | To | leads.to |
| 620 | label | Premium potential | leads.premiumPotential |
| 625 | other | The change is only confirmed once the server sends the updated lead back. | leads.confirmNote |
| 671 | error | A name is the one thing a lead cannot be without. | leads.nameRequired |
| 717 | title | New lead | leads.newLeadTitle |
| 718 | header | It starts at the New stage. You can move it on straight away. | leads.newLeadSubtitle |
| 721 | button | Saving | common.saving |
| 734 | error | The server did not accept this lead | leads.refusedTitle |
| 740 | label | Name | leads.fieldName |
| 743 | placeholder | Who is this lead? | leads.namePlaceholder |
| 747 | label | Mobile number | leads.fieldMobile |
| 751 | placeholder | 10 digit mobile | leads.mobilePlaceholder |
| 753 | label | Needed for the call and WhatsApp actions on the row — and the server requires it. | leads.mobileHint |
| 757 | label | Interested in | leads.fieldInterest |
| 759 | placeholder | Plan or need | leads.interestPlaceholder |
| 763 | label | Premium potential | leads.fieldPotential |
| 766 | placeholder | Annual premium in rupees | leads.potentialPlaceholder |
| 771 | label | City | leads.fieldCity |
| 774 | placeholder | Where are they based? | leads.cityPlaceholder |

## `src/app/lead/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 57 | label | Hot lead | lead.priorityHot |
| 58 | label | Warm lead | lead.priorityWarm |
| 59 | label | Cold lead | lead.priorityCold |
| 145 | toast | `Moved to ${stageLabel}` (interp) | lead.movedToast |
| 151 | error | `The server did not confirm the move to ${stage}, so this lead is still at ${stage}. Nothing was saved.` (interp) | lead.moveNotConfirmed |
| 161 | title | Lead | lead.title |
| 164 | empty | This lead could not load | lead.emptyOutageTitle |
| 164 | empty | This lead could not be opened | lead.emptyNotFoundTitle |
| 166 | empty | The server did not answer, so nothing here is confirmed. Check your connection and try again. | lead.emptyOutageSub |
| 172 | empty | The server would not open it. A lead can only be opened by the advisor it belongs to, and this one may belong to someone else or have been removed. | lead.emptyForbiddenSub |
| 173 | button | Try again | common.tryAgain |
| 196 | button | Saving | common.saving |
| 197 | button | `Move to ${stageLabel}` (interp) | lead.moveTo |
| 198 | button | Close this lead | lead.closeThisLead |
| 199 | button | Change stage | lead.changeStage |
| 215 | label | Choose a different stage (a11y) | lead.a11yChooseStage |
| 228 | error | Stage was not changed | lead.bannerStageNotChanged |
| 237 | label | No mobile number on this lead | lead.noMobileTitle |
| 239 | label | Calls, WhatsApp and SMS all need a number on the record before they can be used. | lead.noMobileMsg |
| 249 | label | No city or source recorded | lead.noCitySource |
| 269 / 298 | label | Premium potential | lead.premiumPotential |
| 274 | other | No premium potential recorded on this lead yet. | lead.noPotential |
| 279 | label | Closed as lost | lead.meterLost |
| 279 | label | Policy issued | lead.meterWon |
| 279 | label | Pipeline progress | lead.meterProgress |
| 281 | label | Not proceeding | lead.notProceeding |
| 281 | label | `${step + 1} of ${FLOW.length}` (interp) | lead.meterStepValue |
| 287 | label | `Next step: ${stageLabel}.` (interp) | lead.nextStep |
| 295 | header | Lead detail | lead.detailSection |
| 296 | label | Interested in | lead.interestedIn |
| 296 | label | Not recorded | lead.notRecorded |
| 302 | label | Mobile | common.mobile |
| 316 | label | `Send an SMS to ${name}` a11y (interp) | lead.a11ySms |
| 321 | label | City | lead.city |
| 322 | label | Source | lead.source |
| 328 | header | Timeline | lead.timelineSection |
| 329 | label | Times come from the lead record itself, so they move whenever the record does. | lead.timelineFooter |
| 331 | label | Added | lead.added |
| 333 | label | Last activity | lead.lastActivity |
| 336 | label | Next action | lead.nextAction |
| 338 | label | Action due | lead.actionDue |
| 343 | header | `Notes (${n})` (interp) / Notes | lead.notesTitleCount / lead.notes |
| 349 | empty | No notes on this lead yet. Anything written against it on the panel shows up here. | lead.noNotes |
| 371 | label | `Call ${name}` a11y (interp) | common.a11yCall |
| 379 | other | `Namaste ${name}` (interp, WhatsApp prefill) | common.whatsappGreeting |
| 380 | label | `Open WhatsApp chat with ${name}` a11y (interp) | common.a11yWhatsapp |
| 441 | title | Move this lead | lead.stageSheetTitle |
| 443 | header | `Currently at ${stageLabel}` (interp) | lead.currentlyAt |
| 446 | header | Pipeline | lead.pipelineSection |
| 453 | label | `Step ${i + 1}` (interp) | lead.stepN |
| 457 | label | Current | lead.current |
| 458 | label | Next | lead.next |
| 459 | label | Passed | lead.passed |
| 468 | header | Close out | lead.closeOutSection |
| 469 | label | A closed lead stays in the pipeline list under its own stage, so nothing is lost. | lead.closeOutFooter |
| 481 | other | The change is only confirmed once the server sends the updated lead back. | lead.confirmNote |

## `src/app/(tabs)/clients.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 108 | label | Segment | clients.filterSegment |
| 118 | label | Premium due | clients.filterPremiumDue |
| 121 | label | Overdue | clients.filterOverdue |
| 122 | label | Next 30 days | clients.filterNext30 |
| 123 | label | Later | clients.filterLater |
| 128 | label | Contact | clients.filterContact |
| 131 | label | Phone on file | clients.filterHasPhone |
| 132 | label | Missing phone | clients.filterNoPhone |
| 162 | label | `${n} of ${loaded} loaded match these filters` (interp) | clients.readoutFiltered |
| 164 | label | `${loaded} loaded, keep scrolling for more` (interp) | clients.readoutMore |
| 165 | label | `${loaded} loaded` (interp) | clients.readoutLoaded |
| 171 | empty | Nothing loaded matches these filters | clients.emptyFilterTitle |
| 172 | empty | `No client matches "${q}"` (interp) | clients.emptySearchTitle |
| 173 | empty | The client book could not load | clients.emptyOutageTitle |
| 174 | empty | No clients in your book yet | clients.emptyNoneTitle |
| 177 | empty | Filters run over the clients loaded so far. Clear them, or load more of the book first. | clients.emptyFilterSub |
| 178 | empty | Search runs across the whole book, by name, policy number or mobile number. | clients.emptySearchSub |
| 179 | empty | The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh. | clients.emptyOutageSub |
| 180 | empty | Clients appear here as soon as records are assigned to you. | clients.emptyNoneSub |
| 183 | button | Clear filters | clients.clearFilters |
| 184 | button | Clear search | common.clearSearch |
| 185 | button | Try again | common.tryAgain |
| 193 | title | Clients | clients.title |
| 194 | header | Search your whole book | clients.subtitle |
| 198 | label | In the book | clients.inTheBook |
| 208 | placeholder | Name, policy number or mobile | clients.searchPlaceholder |
| 218 | label | `Filters, ${n} active` a11y (interp) | clients.a11yFiltersActive |
| 218 | label | Filter clients (a11y) | clients.a11yFilter |
| 239 | button | Clear | common.clear |
| 291 | title | Filter loaded clients | clients.filterSheetTitle |
| 292 | button | Show results | common.showResults |
| 309 | label | `Policy ${number}` (interp) | clients.policyNumberSub |
| 309 | label | No policy number on record | clients.noPolicyNumber |
| 313 | label | Overdue | clients.overdue |
| 314 | label | Due today | clients.dueToday |
| 315 | label | `Due ${fmtDay}` (interp) | clients.dueOn |
| 316 | label | Birthday | clients.birthday |
| 321 | button | Call | common.call |
| 325 | button | WhatsApp | common.whatsapp |
| 326 | other | `Namaste ${name}` (interp, WhatsApp prefill) | common.whatsappGreeting |
| 389 | button | Load more clients | clients.loadMore |
| 391 | label | `All ${count} loaded` (interp) | clients.allLoaded |

## `src/app/client/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 52 | label | In force | client.statusInForce |
| 53 | label | Lapsed | client.statusLapsed |
| 54 | label | Matured | client.statusMatured |
| 55 | label | Paid up | client.statusPaidUp |
| 63 | label | `${n} days late` (interp) | client.daysLate |
| 64 | label | Due today | client.dueToday |
| 65 | label | `In ${d} days` (interp) | client.inDays |
| 119 | error | The report service did not answer, so nothing was generated. No figures are shown. | client.reportFailMsg |
| 136 | label | Annual premium | client.kpiAnnualPremium |
| 137 | label | Policies | client.kpiPolicies |
| 140 | label | Premium due | client.kpiPremiumDue |
| 142 | label | Maturity | client.kpiMaturity |
| 151 | title | Client 360 | client.title |
| 154 | empty | This client could not load | client.emptyOutageTitle |
| 154 | empty | Client not found | client.emptyNotFoundTitle |
| 156 | empty | The server did not answer, so nothing here is confirmed. Check your connection and try again. | client.emptyOutageSub |
| 157 | empty | This record is no longer in the book you can see. It may have been reassigned or removed. | client.emptyNotFoundSub |
| 158 | button | Try again | common.tryAgain |
| 164 | label | `Client since ${since}` (interp) | client.clientSince |
| 181 | error | Report was not generated | client.reportBannerTitle |
| 191 | label | No mobile number on this record | client.noMobileTitle |
| 192 | label | Calls, WhatsApp and premium reminders all need a number on the client record. | client.noMobileMsg |
| 220 | label | Total cover | client.totalCover |
| 232 | header | Contact | client.contactSection |
| 233 | label | Mobile | common.mobile |
| 234 | label | Email | client.email |
| 235 | label | City | client.city |
| 236 | label | Family | client.family |
| 237 | label | Date of birth | client.dob |
| 249 | button | Generating report | client.generatingReport |
| 249 | button | Generate client report | client.generateReport |
| 273 | label | `Call ${name}` a11y (interp) | common.a11yCall |
| 281 | other | `Namaste ${name}` (interp, WhatsApp prefill) | common.whatsappGreeting |
| 282 | label | `Open WhatsApp chat with ${name}` a11y (interp) | common.a11yWhatsapp |
| 285 | button | Send reminder | client.sendReminder |
| 317 | header | `Policy ${i} of ${count}` (interp) / Policy | client.policyNofM / client.policy |
| 318 | label | This record carries no policy number, so it cannot be matched to LIC yet. | client.noPolicyNumberFooter |
| 320 | label | Status | client.status |
| 321 | label | Plan | client.plan |
| 322 | label | Policy number | client.policyNumber |
| 323 | label | Sum assured | client.sumAssured |
| 324 | label | Premium | client.premium |
| 325 | label | Mode | client.mode |
| 326 | label | Commenced | client.commenced |
| 327 | label | Maturity | client.maturity |
| 331 | label | Next premium | client.nextPremium |
| 351 | label | Total policies | client.reportTotalPolicies |
| 352 | label | Total life cover | client.reportLifeCover |
| 353 | label | Annual premium | client.reportAnnualPremium |
| 354 | label | Family members | client.reportMembers |
| 359 | other | `${familyHead}, CGPE client report` (interp, share) / Client | client.shareHeadline / client.clientFallback |
| 360 | other | `Total life cover: ${inr}` (interp, share) | client.shareLifeCover |
| 361 | other | `Annual premium: ${inr}` (interp, share) | client.shareAnnualPremium |
| 362 | other | `Policies: ${n}` (interp, share) | client.sharePolicies |
| 372 | title | Client report | client.reportSheetTitle |
| 374 | button | Share report | client.shareReport |
| 378 | header | Summary | client.summarySection |
| 383 | other | The report was generated but returned no summary figures. | client.reportNoSummary |
| 389 | button | View full report | client.viewFullReport |
| 396 | button | Download PDF | client.downloadPdf |
| 405 | other | No hosted link came back with this report, so only the figures above are available. | client.reportNoLink |

## `src/app/search.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 578 | header | `Clients (${n})` (interp) | search.groupClients |
| 587 | label | Unnamed client | search.unnamedClient |
| 589 | label | `${cover} cover` (interp) / On your book | search.coverValue / search.onYourBook |
| 599 | header | `Leads (${n})` (interp) | search.groupLeads |
| 607 | label | Unnamed lead | search.unnamedLead |
| 619 | header | `Claims (${n})` (interp) | search.groupClaims |
| 627 | label | Claim (fallback) | search.claimFallback |
| 639 | header | `Tickets (${n})` (interp) | search.groupTickets |
| 645 | label | Ticket (fallback) | search.ticketFallback |
| 647 | label | Closed / Open | search.ticketClosed / search.ticketOpen |
| 656 | header | `Tasks (${n})` (interp) | search.groupTasks |
| 664 | label | Task (fallback) | search.taskFallback |
| 689 | header | Clients, leads, claims, tickets and tasks | search.subtitleResting |
| 691 | header | Looking through your book | search.subtitleSearching |
| 692 | header | `${total} result(s) for "${term}"` (interp) | search.subtitleResults |
| 696 | title | Search | search.title |
| 703 | placeholder | Name, mobile, email or reference | search.placeholder |
| 731 | error | Search could not reach every collection | search.outageBannerTitle |
| 732 | error | At least one request did not get an answer, so this is not a confirmed miss. | search.outageBannerMsg |
| 733 | button | Search again | search.searchAgain |
| 737 | empty | Nothing confirmed | search.outageEmptyTitle |
| 738 | empty | `The server went quiet while looking for "${term}". A matching record may well exist. Check your connection, then run it again.` (interp) | search.outageEmptySub |
| 745 | empty | `No match for "${term}"` (interp) | search.noMatchTitle |
| 746 | empty | Nothing in your clients, leads, claims, tickets or tasks carries that. Try a shorter piece of the name, or the last four digits of a mobile number. | search.noMatchSub |
| 747 | button | Clear search | common.clearSearch |
| 753 | error | These results may be incomplete | search.incompleteBannerTitle |
| 754 | error | At least one collection did not answer, so a record matching your search could be missing from this list. | search.incompleteBannerMsg |
| 756 | button | Run it again | search.runAgain |
| 783 | label | `Showing the ${GROUP_CAP} closest matches in each group. Add a few more characters to narrow it.` (interp) | search.cappedNote |
| 807 | title | Start typing to search | search.restingTitle |
| 808 | other | Part of a name works. So does part of a mobile number, a fragment of an email, or a claim or ticket reference. | search.restingSub |
| 817 | header | `Recent searches (${n})` (interp) | search.recentTitle |
| 823 | button | Clear recent searches | search.clearRecent |
| 830 | header | Where it looks | search.whereItLooksTitle |
| 831 | label | Clients and tickets are matched on the server, so the whole book is searched, not only what this device has loaded. Four digits or more will match a mobile number by its last digits. | search.whereItLooksFooter |
| 833 | label | Clients / Name, mobile, policy, email | search.whereClients / search.whereClientsFields |
| 834 | label | Leads / Name, mobile, interest | search.whereLeads / search.whereLeadsFields |
| 835 | label | Claims / Reference, name, policy | search.whereClaims / search.whereClaimsFields |
| 836 | label | Tickets / Reference, name, request | search.whereTickets / search.whereTicketsFields |
| 837 | label | Tasks / Title, client, details | search.whereTasks / search.whereTasksFields |

## `src/app/segments.tsx`

~60 strings — includes in-file `FALLBACK_FLAGS` and `SORTS` (rendered when server flag defs are absent).

| line | kind | english | proposedKey |
|---|---|---|---|
| 101 | label | Hot lead | segments.flagHotLead |
| 102 | label | Underinsured | segments.flagUnderinsured |
| 103 | label | Well insured | segments.flagWellInsured |
| 104 | label | No cover on file | segments.flagNoCoverage |
| 105 | label | Birthday soon | segments.flagBirthdaySoon |
| 106 | label | Birthday today | segments.flagBirthdayToday |
| 107 | label | Renewal due | segments.flagRenewalDue |
| 108 | label | Maturing soon | segments.flagMaturitySoon |
| 109 | label | High value | segments.flagHighValue |
| 110 | label | Large family | segments.flagLargeFamily |
| 111 | label | Inactive | segments.flagInactive |
| 138 | label | Priority | segments.sortPriority |
| 139 | label | Birthday first | segments.sortBirthday |
| 140 | label | Lowest cover | segments.sortCoverageAsc |
| 141 | label | Highest cover | segments.sortCoverageDesc |
| 142 | label | Highest premium | segments.sortPremiumDesc |
| 143 | label | Name A to Z | segments.sortName |
| 206 | label | Unnamed household | segments.unnamedHousehold |
| 207 | label | Unnamed client | segments.unnamedClient |
| 210 | label | `${n} ${member/members}` (interp) / Household | segments.memberCount / segments.household |
| 211 | label | No phone on file | segments.noPhone |
| 239 | label | today | segments.today |
| 240 | label | `${n} days ago` (interp) | segments.daysAgo |
| 241 | label | tomorrow | segments.tomorrow |
| 242 | label | `in ${n} days` (interp) | segments.inDays |
| 243 | label | `in ${n} months` (interp) | segments.inMonths |
| 352 / 576 | label | Household flags / Client flags | segments.householdFlags / segments.clientFlags |
| 389 | label | Working through the book | segments.readoutLoading |
| 391 | label | Nothing matches | segments.readoutNone |
| 392 | label | `${total} ${unit}(s) match` (interp) | segments.readoutMatch |
| 387 | label | household / client (unit words) | segments.unitHousehold / segments.unitClient |
| 398 | empty | No match for those flags and that search | segments.flagTitleSearch |
| 400 | empty | Nobody carries that flag right now | segments.flagTitleOne |
| 402 | empty | Nobody carries all of those flags | segments.flagTitleAll |
| 403 | empty | Nobody carries any of those flags | segments.flagTitleAny |
| 406 | empty | The search and the flags both have to agree. Clear one of them to widen the list. | segments.flagSubSearch |
| 408 | empty | A row has to carry every flag you picked. Switch the match to "Any flag", or drop one. | segments.flagSubAll |
| 409 | empty | Nothing in your book qualifies today. This changes as renewals, birthdays and maturities come round. | segments.flagSubDefault |
| 418 | empty | `No ${unit} matches "${query}"` (interp) | segments.emptySearchTitle |
| 419 | empty | Segments could not load | segments.emptyOutageTitle |
| 420 | empty | `No ${unit}s in your book yet` (interp) | segments.emptyNoneTitle |
| 425 | empty | Search looks at every member name and the household surname. | segments.emptySearchSubFamily |
| 427 | empty | Search covers names, mobile numbers and policy numbers across the whole book. | segments.emptySearchSubIndividual |
| 428 | empty | The server did not answer, so nothing here is confirmed. Pull down to try again. | segments.emptyOutageSub |
| 429 | empty | Segments are built from your client book. They fill in as records are assigned to you. | segments.emptyNoneSub |
| 432 / 509 | button | Clear flags | segments.clearFlags |
| 433 | button | Clear search | common.clearSearch |
| 434 | button | Try again | common.tryAgain |
| 442 | title | Smart segments | segments.title |
| 443 | header | Build a working list from your book | segments.subtitle |
| 449 | label | Matching | segments.matching |
| 456 | label | People / Households | segments.unitPeople / segments.unitHouseholds |
| 478 | placeholder | Household or member name / Name, mobile or policy number | segments.searchPlaceholderFamily / segments.searchPlaceholderIndividual |
| 488 | label | `Flags, ${n} active` a11y (interp) / Filter by flag (a11y) | segments.a11yFlagsActive / segments.a11yFilter |
| 517 | label | A row must carry | segments.aRowMustCarry |
| 520 | label | All flags / Any flag | segments.matchAll / segments.matchAny |
| 577 | button | Show results | common.showResults |
| 583 | title | Sort | segments.sortTitle |
| 584 | header | Order the matching rows | segments.sortSubtitle |
| 621 | label | `${title}, ${flagWords}` a11y (interp) | segments.a11yRow |
| 680 | header | `${n} people in this household` (interp) / Household | segments.peopleInHousehold / segments.household |
| 686 | button | Call | common.call |
| 692 | button | WhatsApp | common.whatsapp |
| 697 | other | `Namaste ${title}` (interp, WhatsApp prefill) | common.whatsappGreeting |
| 714 | label | Mobile | common.mobile |
| 717 | label | Age / `${age} years` (interp) | segments.age / segments.ageValue |
| 720 | label | Members | segments.members |
| 723 | label | Policies | segments.policies |
| 726 | label | Life cover | segments.lifeCover |
| 729 | label | Yearly premium | segments.yearlyPremium |
| 734 | header | Dates | segments.datesSection |
| 737 | label | `Birthday, ${name}` (interp) / Birthday | segments.birthdayNamed / segments.birthday |
| 745 | label | Premium due | segments.premiumDue |
| 753 | label | Next maturity | segments.nextMaturity |
| 763 | header | Household | segments.householdHeading |
| 768 | label | `${age} yrs` (interp) | segments.ageYrs |
| 778 | label | `Call ${name}` a11y (interp) | common.a11yCall |
| 792 | other | No mobile number is on file for this client, so there is nothing to dial from here. | segments.noMobileDial |
| 845 | button | Load more | common.loadMore |
| 848 | label | `All ${total} shown` (interp) | segments.allShown |

## `src/app/families.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 145 | label | Unnamed household | families.unnamedHousehold |
| 255 | label | Households | families.kpiHouseholds |
| 256 | label | People | families.kpiPeople |
| 257 | label | Multi-person | families.kpiMultiPerson |
| 259 | label | Needs a check | families.kpiReview |
| 260 | label | Largest | families.kpiLargest |
| 265 | label | Grouping your book into households | families.readoutLoading |
| 267 | label | No households | families.readoutNone |
| 268 | label | `${total} household${s}` (interp) / , keep scrolling | families.readoutCount / families.keepScrolling |
| 274 | empty | `No household matches "${query}"` (interp) | families.emptySearchTitle |
| 275 | empty | Households could not load | families.emptyOutageTitle |
| 276 | empty | No households to group yet | families.emptyNoneTitle |
| 279 | empty | Search looks at every member name and the household surname. | families.emptySearchSub |
| 280 | empty | The server did not answer, so nothing here is confirmed. Pull down to try again. | families.emptyOutageSub |
| 281 | empty | Households are grouped from your client book. They appear once records are assigned to you. | families.emptyNoneSub |
| 284 | button | Clear search | common.clearSearch |
| 285 | button | Try again | common.tryAgain |
| 293 | title | Families | families.title |
| 294 | header | Your book, grouped into households | families.subtitle |
| 299 | label | Households | families.households |
| 313 | placeholder | Household or member name | families.searchPlaceholder |
| 371 | label | `${n} ${person/people}` (interp) | families.memberCount |
| 372 | label | `${n} units` (interp) | families.units |
| 373 | label | `${n} generations` (interp) | families.generations |
| 393 | label | `${n} to check` (interp) | families.toCheck |
| 395 | label | `${cover} cover` (interp) | families.coverValue |
| 459 | error | Could not refresh this household | families.refreshFailTitle |
| 459 | error | This household could not be opened | families.openFailTitle |
| 461 | error | Showing the copy that arrived with the list. It may be a few minutes old. | families.staleMsg |
| 462 | error | The server did not answer. Nothing is missing from your book, it just could not be read right now. | families.openFailMsg |
| 464 | button | Try again | common.tryAgain |
| 475 | label | People | families.people |
| 478 | label | Units | families.units2 |
| 481 | label | Generations | families.generationsLabel |
| 484 | label | Policies | families.policies |
| 487 | label | Total cover | families.totalCover |
| 490 | label | Yearly premium | families.yearlyPremium |
| 493 | label | Weak matches | families.weakMatches |
| 501 | header | `${head}'s family` (interp) / `Unit ${no}` (interp) | families.unitFamily / families.unitNo |
| 502 | header | `generation ${n}` (interp) | families.generation |
| 508 | label | `${age} yrs` (interp) | families.ageYrs |
| 518 | button | Call | common.call |
| 529 | empty | No members on this household | families.noMembersTitle |
| 531 | empty | The grouping engine returned this household without any member records. | families.noMembersSub |
| 536 | other | Members marked with a question mark were matched to this household by name alone. Confirm the relation before you use it in a conversation. | families.weakMatchNote |
| 591 | button | Load more households | families.loadMore |
| 593 | label | `All ${total} shown` (interp) | families.allShown |

## `src/app/prospects.tsx`

~55 strings — in-file `STAGE_META` (prospect pipeline, distinct from leads) rendered as pills.

| line | kind | english | proposedKey |
|---|---|---|---|
| 138 | label | Not contacted | prospects.stageNotContacted |
| 139 | label | Prospect | prospects.stageProspect |
| 140 | label | Target | prospects.stageTarget |
| 141 | label | Contacted | prospects.stageContacted |
| 142 | label | Responded | prospects.stageResponded |
| 143 | label | Lead | prospects.stageLead |
| 144 | label | Meeting | prospects.stageMeeting |
| 145 | label | Quotation | prospects.stageQuotation |
| 146 | label | Documents | prospects.stageDocuments |
| 147 | label | Policy login | prospects.stageLogin |
| 148 | label | Won | prospects.stageWon |
| 149 | label | Hold | prospects.stageHold |
| 150 | label | Lost | prospects.stageLost |
| 120 | label | Unnamed prospect | prospects.unnamedProspect |
| 216 | label | No number on record | prospects.noNumber |
| 243 | label | `${n} ${touch/touches}` (interp) | prospects.touches |
| 369 | label | In the pool | prospects.kpiInPool |
| 370 | label | Not contacted | prospects.kpiNotContacted |
| 371 | label | Contacted | prospects.kpiContacted |
| 372 | label | Responded | prospects.kpiResponded |
| 373 | label | Touches logged | prospects.kpiTouches |
| 396 | label | All | common.all |
| 413 | label | `${shown} of ${rows} loaded ${row/rows} match this stage` (interp) | prospects.readoutStage |
| 415 | label | `${rows} ${match/matches} loaded for "${q}"` (interp) | prospects.readoutSearch |
| 417 | label | `${rows} of ${total} loaded` (interp) | prospects.readoutLoadedTotal |
| 418 | label | `${rows} loaded` (interp) | prospects.readoutLoaded |
| 437 | error | This record carries no id, so nothing can be saved against it. Open it in the web panel instead. | prospects.noIdError |
| 443 | error | Write the note first. The server rejects an empty one. | prospects.noteRequired |
| 457 | error | That did not save. You may be signed out, or the server refused the change. Nothing was recorded. | prospects.saveFailed |
| 466 | toast | `Connect logged for ${who}.` (interp) | prospects.toastConnect |
| 467 | toast | `Reply recorded for ${who}.` (interp) | prospects.toastReply |
| 468 | toast | `Note saved for ${who}.` (interp) | prospects.toastNote |
| 490 | label | Mobile | common.mobile |
| 491 | label | Firm | prospects.factFirm |
| 492 | label | City | prospects.factCity |
| 493 | label | Category | prospects.factCategory |
| 497 | label | Owner | prospects.factOwner |
| 498 | label | Touches logged | prospects.factTouches |
| 499 | label | Last contacted | prospects.factLastContacted |
| 500 | label | Their reply | prospects.factReply |
| 501 | label | Replied on | prospects.factRepliedOn |
| 502 | label | On file | prospects.factOnFile |
| 525 | label | Recruitment prospect | prospects.recruitmentProspect |
| 537 | empty | `Nothing loaded is at ${stageLabel}` (interp) | prospects.emptyStageTitle |
| 538 | empty | `No prospect matches "${q}"` (interp) | prospects.emptySearchTitle |
| 539 | empty | The prospect pool did not load | prospects.emptyOutageTitle |
| 540 | empty | No prospects in the pool yet | prospects.emptyNoneTitle |
| 543 | empty | Stage filtering runs over the rows loaded so far. Clear the stage, or load more of the pool first. | prospects.emptyStageSub |
| 544 | empty | Search runs across the whole pool and matches any field on the record, including firm, city and notes. | prospects.emptySearchSub |
| 545 | empty | The server did not answer, so this is not a confirmed empty pool. Check your connection and pull to refresh. | prospects.emptyOutageSub |
| 546 | empty | Recruitment targets appear here once they are added to the pool. | prospects.emptyNoneSub |
| 549 | button | Show every stage | prospects.showEveryStage |
| 550 | button | Clear search | common.clearSearch |
| 551 | button | Try again | common.tryAgain |
| 577 | button | Load more prospects | prospects.loadMore |
| 581 | label | `All ${n} loaded` (interp) | prospects.allLoaded |
| 590 | header | Pool composition | prospects.poolComposition |
| 590 | label | Counts are for the whole prospect pool, not only the rows loaded above. A prospect can carry more than one classification. | prospects.poolCompositionFooter |
| 605 | title | Prospects | prospects.title |
| 606 | header | Recruitment pipeline | prospects.subtitle |
| 611 | label | In the pool | prospects.inThePool |
| 619 | placeholder | Name, firm, city or number | prospects.searchPlaceholder |
| 663 | title | Prospect (fallback) | prospects.prospectFallback |
| 670 | button | Logging / Log a connect | prospects.logging / prospects.logConnect |
| 682 | label | No stage recorded | prospects.noStage |
| 688 | label | `${n} ${touch/touches} logged` (interp) | prospects.touchesLogged |
| 700 | error | Not saved | prospects.notSavedTitle |
| 709 | button | Call | common.call |
| 716 | button | WhatsApp | common.whatsapp |
| 723 | other | `Namaste ${name}` (interp, WhatsApp prefill) | common.whatsappGreeting |
| 730 | header | On record | prospects.onRecord |
| 743 | empty | Nothing else on file | prospects.nothingElseTitle |
| 745 | empty | This record carries no number, city or classification. Logging a connect still works and is written to the activity history. | prospects.nothingElseSub |
| 750 | label | Note | prospects.noteLabel |
| 753 | placeholder | What was said, what was agreed, what happens next | prospects.notePlaceholder |
| 755 | label | Saved to the activity history against your name. Required for a note or a reply, optional on a connect. | prospects.noteHint |
| 760 | button | Saving / Save note | common.saving / prospects.saveNote |
| 769 | button | Saving / Record a reply | common.saving / prospects.recordReply |
| 779 | other | A connect marks the prospect contacted, credits it to you, and moves a brand new prospect to Contacted. Moving further down the pipeline, and handing a prospect to someone else, are done from the web panel. | prospects.connectExplainer |
