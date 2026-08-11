# Inventory — claims / claim-detail / claim-new / task-detail / task-new / tasks

~280 strings. `claims`, `claim/[id]`, `claim-new`, `task/[id]`, `task-new` are **100% hardcoded**;
`(tabs)/tasks` is **partially wired** (~14 `t()` calls) — only its remaining hardcoded strings are
listed. Line numbers as of 2026-08-11 — anchor on the English literal. Interpolation marked `(dynamic)`.
See `../SCOPE.md`.

## `src/app/(tabs)/claims.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 64 | empty | No claims in your register | claims.emptyAllTitle |
| 66 | empty | Claims you register appear here with their documents and status. Start one with the button below. | claims.emptyAllSub |
| 71 | empty | Nothing at intake | claims.emptyIntakeTitle |
| 72 | empty | No claim is waiting to be opened. New claims land here first. | claims.emptyIntakeSub |
| 76 | empty | Nothing waiting on documents | claims.emptyDocsTitle |
| 77 | empty | Every open claim has the paperwork it needs right now. | claims.emptyDocsSub |
| 81 | empty | Nothing under review | claims.emptyReviewTitle |
| 82 | empty | No claim is being assessed by the insurer at the moment. | claims.emptyReviewSub |
| 86 | empty | Nothing submitted | claims.emptySubmittedTitle |
| 87 | empty | No claim has been sent to the insurer yet. | claims.emptySubmittedSub |
| 91 | empty | Nothing settled yet | claims.emptySettledTitle |
| 92 | empty | Claims move here once the insurer has paid out. | claims.emptySettledSub |
| 96 | empty | Nothing rejected | claims.emptyRejectedTitle |
| 97 | empty | No claim in your register has been turned down. | claims.emptyRejectedSub |
| 197 | label | In the register | claims.kpiInRegister |
| 198 | label | Paid out | claims.kpiPaidOut |
| 199 | label | Pending | claims.kpiPending |
| 203 | label | Your claims | claims.kpiYourClaims |
| 204 | label | Still in progress | claims.kpiInProgress |
| 205 | label | Settled | claims.kpiSettled |
| 211 | label | All | claims.filterAll |
| 212 | label | Intake | claims.filterIntake |
| 213 | label | Docs pending | claims.filterDocsPending |
| 214 | label | Review | claims.filterReview |
| 215 | label | Submitted | claims.filterSubmitted |
| 216 | label | Settled | claims.filterSettled |
| 221 | label | Rejected | claims.filterRejected |
| 239 | label | `${n} claim${s} · ${inrShort} still in progress` (dynamic) | claims.readoutAll |
| 240 | label | `${n} of ${count} claim${s} match this status` (dynamic) | claims.readoutStatus |
| 248 | label | Loading the register | claims.subtitleLoading |
| 250 | label | `${total} in the register · ${pending} pending` (dynamic) | claims.subtitleRegister |
| 251 | label | `${n} on your rows · ${active} in progress` (dynamic) | claims.subtitleRows |
| 283 | title | Claims | claims.title |
| 311 | empty | The register did not load | claims.outageTitle |
| 312 | empty | The server could not be reached, so this is not a confirmed empty register. Pull down to try again. | claims.outageSub |
| 313 | button | Try again | common.tryAgain |
| 321 / 339 | button | New claim | act.newClaim (existing key) |
| 322 | button | Show all claims | claims.showAll |
| 374 | label | No amount | claims.noAmount |
| 381 | label | `${received} of ${total} documents received` a11y (dynamic) | claims.docsReceivedA11y |

## `src/app/claim/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 212 | error | Camera and photos are blocked | claim.camBlockedTitle |
| 213 | error | Allow camera or photo access in your device settings to attach a document to this claim. | claim.camBlockedMsg |
| 239 | error | The document did not upload | claim.uploadFailTitle |
| 240 | error | It never reached the server, so the checklist has not been changed. Check your connection and try again. | claim.uploadFailMsg |
| 250 | error | The document was not sent | claim.notSentTitle |
| 252 | error | This session is not signed in to the register, so the file stayed on the handset. Sign in again and retry. | claim.notSentMsg |
| 275 | toast | `Uploaded. ${name} ticked on your checklist.` (dynamic) | claim.uploadedTicked |
| 276 | toast | Document uploaded to the server. | claim.uploadedServer |
| 284 / 293 | title | Claim | claim.title |
| 299 | empty | This claim did not load | claim.outageTitle |
| 300 | empty | The server could not be reached, so we cannot confirm whether this claim still exists. | claim.outageSub |
| 301 | button | Try again | common.tryAgain |
| 306 | empty | Claim not found | claim.notFoundTitle |
| 307 | empty | It may have been closed, merged, or moved to another advisor's register. | claim.notFoundSub |
| 308 | button | Back to claims | claim.backToClaims |
| 323 | other | `Namaste, regarding your ${type} claim ${ref}, we need a few documents to proceed.` (dynamic, WhatsApp) | claim.docsWhatsappMsg |
| 329 | header | `${type} claim · ${ref}` (dynamic) | claim.headerSubtitle |
| 342 | label | Claim amount | claim.amountLabel |
| 348 | label | Amount not recorded | claim.amountNotRecorded |
| 320 / 351 | label | `Opened ${date} · ${age} day${s} in progress` (dynamic; fallback "Date not recorded") | claim.openedAge / claim.dateNotRecorded |
| 359 | label | No mobile number is on file for this claimant, so they cannot be reached from here. | claim.noMobile |
| 379 | header | Latest update | claim.latestUpdate |
| 388 | header | Claim record | claim.recordTitle |
| 388 | label | Copy a reference straight into the insurer portal instead of retyping it. | claim.recordFooter |
| 391 | label | Reference | claim.refLabel |
| 392 | label | Not issued | claim.notIssued |
| 397 | label | Policy number | claim.policyLabel |
| 398 / 402 | label | Not recorded | claim.notRecorded |
| 402 | label | Insurer or TPA | claim.insurerLabel |
| 403 | label | Opened | claim.openedLabel |
| 405 | label | Claimant mobile | claim.claimantMobile |
| 415 | header | Documents | claim.docsTitle |
| 416 | label | This checklist is a working note on your handset. Ticking a document does not update the register. | claim.docsFooter |
| 421 | label | Checklist complete | claim.checklistComplete |
| 432 | label | `${name}, received / still pending` a11y (dynamic) | claim.docStateA11y |
| 454 | label | Received | claim.docReceived |
| 454 | label | Pending | claim.docPending |
| 466 | empty | No checklist on this claim | claim.noChecklistTitle |
| 467 | empty | The register did not list any required documents for this claim, so there is nothing to tick off yet. | claim.noChecklistSub |
| 473 | button | Uploading | common.uploading |
| 473 | button | Capture or upload a document | claim.captureUpload |
| 481 | label | Files go to the CGPE server. The register cannot link a file to a claim yet, so quote the reference when you tell the claims desk. | claim.filesCaption |
| 495 | button | `Move to ${statusLabel}` (dynamic) | claim.moveTo |
| 502 | label | Claim stage is set in the register. This app can read it, but it cannot save a change yet, so ask the claims desk to move it. | claim.stageCaption |
| 511 | header | Timeline | claim.timeline |
| 533 | empty | No history recorded | claim.noHistoryTitle |
| 535 | empty | The register has not logged any movement on this claim yet. | claim.noHistorySub |
| 562 | label | `Call ${name}` a11y (dynamic) | claim.callA11y |
| 565 | button | Request documents | claim.requestDocs |

## `src/app/claim-new.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 59 | label | Health | claimNew.typeHealth |
| 60 | label | Death | claimNew.typeDeath |
| 61 | label | Maturity | claimNew.typeMaturity |
| 62 | label | Surrender | claimNew.typeSurrender |
| 63 | label | Accident | claimNew.typeAccident |
| 190 | error | Camera and photos are blocked | claimNew.camBlockedTitle |
| 191 | error | Allow camera or photo access in your device settings to attach a document to this claim. | claimNew.camBlockedMsg |
| 211 | error | The document did not upload | claimNew.uploadFailTitle |
| 212 | error | It never reached the server, so it has not been attached. Check your connection and try again. | claimNew.uploadFailMsg |
| 222 | error | The document was not sent | claimNew.notSentTitle |
| 224 | error | This session is not signed in to the register, so the file stayed on the handset. Sign in again and retry. | claimNew.notSentMsg |
| 247 | error | Choose the client this claim belongs to. A claim cannot be filed without a record from the book. | claimNew.clientRequired |
| 253 | error | Enter the amount being claimed, in rupees. | claimNew.amountRequired |
| 270 | other | `Insurer or TPA: ${insurer}` (dynamic, notes payload) | claimNew.notesInsurerPrefix |
| 271 | other | `Documents uploaded: ${names}` (dynamic, notes payload) | claimNew.notesDocsPrefix |
| 293 | error | This account cannot register claims | claimNew.forbiddenTitle |
| 294 | error | Filing a claim needs an admin or super admin role. Ask your branch admin to raise it, or ask them to register this claim for you. | claimNew.forbiddenMsg |
| 303 | error | The claim was not created | claimNew.errorTitle |
| 316 | error | The claim was not filed | claimNew.notFiledTitle |
| 317 | error | This session is not signed in to the register, so what you typed is only held on this handset. Sign in again and register it. | claimNew.notFiledMsg |
| 323 | toast | `Claim registered for ${name}.` (dynamic) | claimNew.registeredToast |
| 337 | title | New claim | claimNew.title |
| 337 | header | File against a client already in the book | claimNew.subtitle |
| 355 | label | Client | claimNew.clientLabel |
| 357 | label | Tap to pick a different client. | claimNew.clientHintChange |
| 357 | label | Required. Search your book by name, policy number or mobile. | claimNew.clientHintRequired |
| 362 | label | `Client, currently ${name}. Tap to change` / Choose a client a11y (dynamic) | claimNew.clientA11y |
| 382 | label | Search your client book | claimNew.searchBook |
| 386 / 537 | label | No number on file | claimNew.noNumber |
| 397 | label | Claim type | claimNew.typeLabel |
| 405 | label | Policy number | claimNew.policyLabel |
| 408 | placeholder | Policy the claim is filed against | claimNew.policyPlaceholder |
| 411 | label | No policy number is on record for this client. Type the one on the bond. | claimNew.policyHintNone |
| 412 | label | Prefilled from the book when a number is on record. | claimNew.policyHintPrefilled |
| 415 | label | Claim amount | claimNew.amountLabel |
| 422 | label | `${inr} claimed` (dynamic) | claimNew.amountHintValid |
| 422 | label | Required. Rupees, digits only. | claimNew.amountHintRequired |
| 425 | label | Insurer or TPA | claimNew.insurerLabel |
| 430 | label | The register has no insurer field on a new claim, so this is written into the notes. | claimNew.insurerHint |
| 433 | label | Notes | claimNew.notesLabel |
| 436 | placeholder | Anything the claims desk should know before they open this | claimNew.notesPlaceholder |
| 445 | label | Documents | claimNew.docsLabel |
| 447 | label | Optional. Each capture is uploaded to the CGPE server as soon as you take it. | claimNew.docsHintEmpty |
| 448 | label | `${n} file${s} on the server. The register cannot link a file to a claim yet, so the names go into the notes.` (dynamic) | claimNew.docsHintCount |
| 459 | label | Uploaded | claimNew.uploaded |
| 466 | label | `Do not mention ${name} in the claim notes` a11y (dynamic) | claimNew.removeDocA11y |
| 477 | button | Uploading | common.uploading |
| 477 | button | Capture a document | claimNew.captureDoc |
| 500 | button | Register claim | claimNew.register |
| 507 | title | Choose a client | claimNew.pickerTitle |
| 508 | header | Search runs across your whole book | claimNew.pickerSubtitle |
| 515 | placeholder | Name, policy number or mobile | claimNew.searchPlaceholder |
| 549 | empty | The book did not load | claimNew.bookOutageTitle |
| 549 | empty | `No client matches "${term}"` (dynamic) | claimNew.noMatchTitle |
| 551 | empty | The server could not be reached, so this is not a confirmed empty result. Try the search again in a moment. | claimNew.bookOutageSub |
| 552 | empty | Search covers the whole book by name, policy number and mobile number. Check the spelling, or try the policy number. | claimNew.noMatchSub |
| 553 | button | Clear search | claimNew.clearSearch |
| 558 | empty | Search your client book | claimNew.searchBook |
| 559 | empty | Type at least two letters of a name, or the start of a policy or mobile number. | claimNew.searchHint |

## `src/app/task/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 57 | label | Not started yet. | task.noteTodo |
| 58 | label | Being worked on right now. | task.noteInProgress |
| 59 | label | Waiting on someone else or on a document. | task.noteBlocked |
| 60 | label | Finished. Every step is ticked. | task.noteDone |
| 204 | error | Status was not saved | task.statusNotSaved |
| 206 | error | This task is assigned to someone else, so it cannot be changed from here. | task.forbiddenMsg |
| 207 | error | The server did not accept the change. Try again in a moment. | task.serverRejectedMsg |
| 214 | toast | Task completed. | task.completedToast |
| 240 | error | Transfer failed | task.transferFailTitle |
| 242 | error | The server did not accept the reassignment. Check your connection and try again. | task.transferFailMsg |
| 247 | toast | `Task transferred to ${to}.` (dynamic) | task.transferredToast |
| 273 | error | No number on file | task.noNumberTitle |
| 274 | error | `There is no phone number saved for ${name}, so this client cannot be reached from here.` (dynamic) | task.noNumberMsg |
| 287 / 294 | title | Task | task.title |
| 300 | empty | This task did not load | task.outageTitle |
| 301 | empty | The server could not be reached, so we cannot confirm whether this task still exists. | task.outageSub |
| 303 | button | Try again | common.tryAgain |
| 308 | empty | Task not found | task.notFoundTitle |
| 309 | empty | It may have been closed or reassigned to someone else. | task.notFoundSub |
| 310 | button | Back to tasks | task.backToTasks |
| 353 | label | `${priorityLabel} priority` (dynamic) | task.prioritySuffix |
| 366 / 602 | button | Call | common.call |
| 368 / 604 | button | WhatsApp | common.whatsapp |
| 372 | button | Contact client | task.contactClient |
| 389 | header | Details | task.detailsTitle |
| 391 | label | Due | task.dueLabel |
| 395 | label | Assigned by | task.assignedBy |
| 395 | label | Not recorded | task.notRecorded |
| 400 | label | Assigned to | task.assignedTo |
| 407 | label | Transfer this task | task.transferThis |
| 412 | label | Client | task.clientLabel |
| 414 | label | Phone | task.phoneLabel |
| 418 | label | Status | task.statusLabel |
| 429 | header | Workflow | task.workflowTitle |
| 438 | label | Steps completed | task.stepsCompleted |
| 451 | label | `${step}. Completed / Not completed.` a11y (dynamic) | task.stepStateA11y |
| 476 | empty | No checklist on this task | task.noChecklistTitle |
| 478 | empty | This one is tracked by status alone. Move it along with the status control above. | task.noChecklistSub |
| 479 | button | Change status | task.changeStatus |
| 499 | button | Reopen task | task.reopen |
| 502 | button | Mark task complete | task.markComplete |
| 511 | title | Move this task | task.moveTitle |
| 512 | header | `Currently ${statusLabel}` (dynamic) | task.moveSubtitle |
| 553 | title | Transfer task | task.transferTitle |
| 554 | header | `Currently with ${assignee}` (dynamic) | task.transferSubCurrent |
| 554 | header | Hand this task to another team member | task.transferSubEmpty |
| 570 | empty | No one to transfer to | task.noTransferTitle |
| 572 | empty | The team roster could not be loaded, so this list is not confirmed. Close this and try again. | task.noTransferOutageSub |
| 574 | empty | There is no other team member on your roster right now. | task.noTransferSub |
| 596 | title | Contact | task.contactTitle |
| 597 | header | Open the client record | task.contactSubtitle |
| 609 | button | Open client profile | task.openProfile |

## `src/app/task-new.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 57 | label | Follow-up | taskNew.catFollowup |
| 57 | label | Claim | taskNew.catClaim |
| 57 | label | Renewal | taskNew.catRenewal |
| 57 | label | Meeting | taskNew.catMeeting |
| 57 | label | Documentation | taskNew.catDocumentation |
| 57 | label | Collection | taskNew.catCollection |
| 57 | label | Training | taskNew.catTraining |
| 57 | label | General | taskNew.catGeneral |
| 138 | error | Give the task a title so it can be recognised in a list. | taskNew.titleRequired |
| 163 | error | This account cannot create tasks | taskNew.forbiddenTitle |
| 164 | error | Creating work for the team needs an admin, leader, or super admin role. Ask your branch admin to raise it, or ask them to add the task. | taskNew.forbiddenMsg |
| 170 | toast | `Task assigned to ${assignee}.` (dynamic) | taskNew.assignedToast |
| 170 | toast | Task created. | taskNew.createdToast |
| 178 | title | New task | taskNew.title |
| 178 | header | Assign work to yourself or the team | taskNew.subtitle |
| 196 | label | Task title | taskNew.titleLabel |
| 199 | placeholder | Collect KYC from the client | taskNew.titlePlaceholder |
| 201 | label | Required. What has to happen, in a few words. | taskNew.titleHint |
| 205 | label | Details | taskNew.detailsLabel |
| 208 | placeholder | Anything the person doing this needs to know | taskNew.detailsPlaceholder |
| 212 | label | Client | taskNew.clientLabel |
| 215 | placeholder | Client name | taskNew.clientPlaceholder |
| 217 | label | Optional. Links the task to a name in the book. | taskNew.clientHint |
| 224 | label | Assign to | taskNew.assignLabel |
| 224 | label | Nobody is assigned yet. The task stays on your own list. | taskNew.assignHint |
| 228 | label | `Assign to. Currently ${assignee}` a11y (dynamic) | taskNew.assignA11y |
| 243 | label | Nobody yet | taskNew.nobodyYet |
| 252 | label | Due | taskNew.dueLabel |
| 252 | label | `${date} at ${time}` (dynamic) | taskNew.dueHint |
| 256 | label | Today | taskNew.whenToday |
| 257 | label | Tomorrow | taskNew.whenTomorrow |
| 258 | label | In a week | taskNew.whenWeek |
| 267 | label | Priority | taskNew.priorityLabel |
| 271 | label | High | taskNew.prioHigh |
| 272 | label | Medium | taskNew.prioMedium |
| 273 | label | Low | taskNew.prioLow |
| 282 | label | Category | taskNew.categoryLabel |
| 303 | button | Create task | taskNew.create |
| 310 | title | Assign to | taskNew.assignLabel |
| 311 | header | Leave it unassigned to keep it on your own list | taskNew.assignSubEmpty |
| 311 | header | `Currently ${assignee}` (dynamic) | taskNew.assignSubCurrent |
| 317 | label | Leave unassigned (a11y) | taskNew.leaveUnassignedA11y |
| 334 | label | Leave unassigned | taskNew.leaveUnassigned |
| 336 | label | Stays on your own list | taskNew.staysOwn |
| 357 | empty | The roster did not load | taskNew.rosterOutageTitle |
| 357 | empty | No team members yet | taskNew.noMembersTitle |
| 359 | empty | The server could not be reached, so this list is not confirmed. The task can still be created unassigned. | taskNew.rosterOutageSub |
| 360 | empty | There is nobody else on your roster, so this task can only stay on your own list. | taskNew.noMembersSub |

## `src/app/(tabs)/tasks.tsx` (partially wired — remaining hardcoded only)

| line | kind | english | proposedKey |
|---|---|---|---|
| 80 | empty | Nothing due today | tasks.emptyTodayTitle |
| 81 | empty | Today is clear. Add a task to plan the rest of the day. | tasks.emptyTodaySub |
| 85 | empty | Nothing overdue | tasks.emptyOverdueTitle |
| 86 | empty | Every task from an earlier day has been closed. | tasks.emptyOverdueSub |
| 90 | empty | Nothing in progress | tasks.emptyInProgressTitle |
| 91 | empty | Open a task and start it, and it will be listed here. | tasks.emptyInProgressSub |
| 95 | empty | Nothing upcoming | tasks.emptyUpcomingTitle |
| 96 | empty | No task is scheduled after today. | tasks.emptyUpcomingSub |
| 101 | empty | Nothing completed yet | tasks.emptyDoneTitle |
| 102 | empty | Tasks you close are collected here for the rest of the day. | tasks.emptyDoneSub |
| 302 | label | tasks done today | tasks.doneToday |
| 308 | label | Nothing scheduled | tasks.nothingScheduled |
| 311 | label | No task is due today. | tasks.noneDueToday |
| 403 | empty | Tasks did not load | tasks.outageTitle |
| 404 | empty | The server could not be reached, so this is not a confirmed empty list. Pull down to refresh. | tasks.outageSub |
| 405 | button | Retry | tasks.retry |
| 409 | empty | No tasks yet | tasks.bookEmptyTitle |
| 411 | empty | Nothing has been assigned to you, and you have not created anything. Add the first task to start your day. | tasks.bookEmptySub |
| 462 | label | `${label}, ${value} tasks` a11y (dynamic) | tasks.heroStatA11y |
| 503 | button | Done (swipe) | tasks.swipeDone |
| 505 | button | Call (swipe) | common.call |
| 507 | button | Reopen (swipe) | tasks.swipeReopen |
| 509 | label | `Overdue · ` prefix + `${day} · ${time} · ${client}` (dynamic) | tasks.overduePrefix |
| 550 | label | `Mark ${title} done` a11y (dynamic) | tasks.markDoneA11y |
