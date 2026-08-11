# Inventory — whatsapp / notifications / notify / notice-board / notes / campaigns / job

~302 strings, all 8 screens **100% hardcoded**. Line numbers as of 2026-08-11 — anchor on the English
literal. Interpolation marked `(dynamic)`. No inline customer-message templates here (all message bodies
are server-provided or user-typed); `Namaste {name}` prefills are UI-triggered outbound text — see
`../SCOPE.md` §4.2. See `../SCOPE.md`.

## `src/app/whatsapp/index.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 156 | label | Loading your inbox | whatsapp.loadingInbox |
| 158 | label | Nothing to read right now | whatsapp.subNothing |
| 160 | label | `${n} chats, ${waiting} waiting on you` (dynamic) | whatsapp.subWaiting |
| 161 | label | `${n} chats, all caught up` (dynamic) | whatsapp.subCaughtUp |
| 186 | empty | `No chat matches "${q}"` (dynamic) | whatsapp.emptySearchTitle |
| 187 | empty | Nothing unread | whatsapp.emptyFilterTitle |
| 188 | empty | Your inbox could not load | whatsapp.emptyOutageTitle |
| 189 | empty | No conversations yet | whatsapp.emptyNoneTitle |
| 192 | empty | Search runs over the name, the last message, the tag and the mobile number. | whatsapp.emptySearchSub |
| 193 | empty | Every chat here has been read. Switch back to All to see the rest of the inbox. | whatsapp.emptyFilterSub |
| 194 | empty | The server did not answer, so nothing here is confirmed. Check your connection and pull to refresh. | whatsapp.emptyOutageSub |
| 195 | empty | Conversations appear here as soon as someone messages the business number. | whatsapp.emptyNoneSub |
| 198 | button | Clear search | whatsapp.clearSearch |
| 199 | button | Show all chats | whatsapp.showAllChats |
| 200 | button | Try again | common.tryAgain |
| 208 | title | WhatsApp | whatsapp.title |
| 214 | label | Unread | whatsapp.unread |
| 224 | placeholder | Name, message or mobile number | whatsapp.searchPlaceholder |
| 230 | label | `All ${n}` (dynamic) | whatsapp.filterAll |
| 231 | label | `Unread ${waiting}` / Unread (dynamic) | whatsapp.filterUnread |
| 291 | label | WhatsApp (swipe) | common.whatsapp |
| 298 | label | Call (swipe) | common.call |
| 308 | label | No message text on this thread | whatsapp.noMessageText |
| 363 | label | `1 chat` / `${count} chats` (dynamic) | whatsapp.chatCount |
| 364 | other | . Swipe a row to call or reply. | whatsapp.swipeHint |

## `src/app/whatsapp/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 81 | error | Message not sent | whatsapp.sendFailTitle |
| 82 | error | `The WhatsApp gateway did not accept it. Your text is back in the box, so you can try again.${note}` (dynamic) | whatsapp.gatewayRejected |
| 83 | error | WhatsApp sending is switched off on this server | whatsapp.sendingOffTitle |
| 84 | error | Your message was saved but nothing was sent, and trying again will not change that until someone switches sending on. Use "Open in WhatsApp" to send it yourself. | whatsapp.sendingOffMsg |
| 89 | error | This account is not allowed to send WhatsApp messages. Your text is back in the box. | whatsapp.forbiddenMsg |
| 91 | error | Sending is not available | whatsapp.unsupportedTitle |
| 92 | error | This server has no WhatsApp send endpoint, so nothing can go out from here. | whatsapp.unsupportedMsg |
| 95 | error | That message did not go out. Your text is back in the box, so you can try again. | whatsapp.sendFailGeneric |
| 129 | label | Today | common.today |
| 130 | label | Yesterday | common.yesterday |
| 320 | toast | Sent in test mode | whatsapp.testModeTitle |
| 321 | toast | The gateway accepted this message but is simulating sends, so it has not reached the customer. | whatsapp.testModeMsg |
| 328 | label | WhatsApp conversation | whatsapp.convSubtitle |
| 329 | label | Opening the conversation | whatsapp.opening |
| 329 | label | Conversation unavailable | whatsapp.convUnavailable |
| 337 | label | `Call ${name ?? 'this contact'}` a11y (dynamic) | whatsapp.a11yCall |
| 345 | label | Open this chat in WhatsApp (a11y) | whatsapp.a11yOpenInWa |
| 352 | title | Chat | whatsapp.chatTitle |
| 360 | empty | This conversation could not be opened | whatsapp.convErrorTitle |
| 362 | empty | The server did not answer, so no message history is confirmed. Check your connection and try again. | whatsapp.convErrorOutage |
| 363 | empty | The chat history did not come back from the server. Try again in a moment. | whatsapp.convErrorSub |
| 364 | button | Try again | common.tryAgain |
| 391 | empty | No messages in this chat yet | whatsapp.noMessagesTitle |
| 392 | empty | Anything you send from here goes out over WhatsApp to this number. | whatsapp.noMessagesSub |
| 393 | button | Open in WhatsApp | whatsapp.openInWa |
| 442 | placeholder | Type a message | whatsapp.composerPlaceholder |
| 445 | label | Message (a11y) | whatsapp.a11yMessage |
| 457 | label | Send message (a11y) | whatsapp.a11ySend |
| 489 | label | You said / They said (a11y fragment) | whatsapp.a11ySaidBy |
| 492 | label | sending / sent from this app (a11y fragment) | whatsapp.a11ySendState |

## `src/app/notifications.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 77 | label | Today | common.today |
| 78 | label | Yesterday | common.yesterday |
| 79 | label | `${diff} days ago` (dynamic) | notifications.daysAgo |
| 149 | label | No date recorded | notifications.noDate |
| 235 | label | Loading your feed | notifications.loadingFeed |
| 238 | label | Nothing waiting | notifications.subNothing |
| 240 | label | `${unread} of ${n} still unread` (dynamic) | notifications.subUnread |
| 241 | label | `${n} notification(s), all read` (dynamic) | notifications.subAllRead |
| 245 | title | Notifications | notifications.title |
| 251 | label | `${unread} unread` / All read (dynamic) | notifications.pillUnread |
| 278 | error | Not everything could be marked as read | notifications.markFailTitle |
| 279 | error | The server still lists some of these as unread, so the feed below is what it actually holds. | notifications.markFailMsg |
| 290 | empty | The feed did not load | notifications.emptyOutageTitle |
| 291 | empty | Your notifications could not be fetched, so this is not a confirmed empty inbox. Try again once you are back on a signal. | notifications.emptyOutageSub |
| 293 | button | Try again | common.tryAgain |
| 297 | empty | You are all caught up | notifications.emptyNoneTitle |
| 298 | empty | Claim updates, renewal reminders, new leads and contest results land here as they happen. | notifications.emptyNoneSub |
| 323 | label | Notification (fallback) | notifications.itemFallbackTitle |
| 328 | label | New | notifications.newBadge |
| 349 | button | `Mark ${unread} as read` (dynamic) | notifications.markAllBtn |

## `src/app/notify.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 39 | label | Whole team | notify.audienceAll |
| 40 | label | Choose people | notify.audienceSelected |
| 44 | label | Low | notify.priorityLow |
| 45 | label | Normal | notify.priorityMedium |
| 46 | label | Urgent | notify.priorityHigh |
| 100 | error | Give the notification a title. | notify.errTitle |
| 101 | error | Write the message body. | notify.errMessage |
| 103 | error | Choose at least one person, or switch to the whole team. | notify.errNoRecipients |
| 135 | error | Could not send the notification. Please try again. | notify.sendFailGeneric |
| 143 | confirm | everyone on the team | notify.whoAll |
| 144 | confirm | `${n} person / people` (dynamic) | notify.whoCount |
| 156 | title | Notify team | notify.title |
| 159 | title | Admins only | notify.lockedTitle |
| 160 | empty | Sending notifications to the team is limited to admin and master accounts. | notify.lockedSub |
| 168 | header | Send an alert to your people | notify.subtitle |
| 172 | error | Not sent | notify.bannerNotSent |
| 177 | label | Title | notify.fieldTitle |
| 181 | placeholder | Branch meeting moved to 4 PM | notify.titlePlaceholder |
| 184 | other | `${title.length} of ${TITLE_MAX} characters` (dynamic) | notify.charCount |
| 189 | label | Message | notify.fieldMessage |
| 193 | placeholder | Write what the team needs to know. | notify.messagePlaceholder |
| 204 | label | Priority | notify.priorityLabel |
| 212 | other | Urgent notifications are highlighted in red in the feed. | notify.urgentHint |
| 219 | label | Send to | notify.sendToLabel |
| 236 | title | `Recipients (${n})` (dynamic) | notify.recipientsTitle |
| 239 | label | Nobody chosen yet. | notify.nobodyChosen |
| 245 | label | Member (fallback) | notify.memberFallback |
| 248 | label | `+${n} more` (dynamic) | notify.moreCount |
| 253 | button | Change recipients / Choose recipients | notify.changeRecipients |
| 265 | button | Sending / Send notification | notify.sendBtn |
| 276 | title | Choose recipients | notify.pickerTitle |
| 278 | placeholder | Search by name or role | notify.pickerSearch |
| 288 | empty | `No match for "${query}"` / No team members loaded (dynamic) | notify.pickerEmptyTitle |
| 289 | empty | Try a different name or role. | notify.pickerEmptySearchSub |
| 290 | empty | The roster could not be loaded from the server. Pull back and try again. | notify.pickerEmptyLoadSub |
| 313 | label | Added / Add | notify.addToggle |
| 328 | button | Clear | common.clear |
| 334 | button | `Done (${n})` (dynamic) | notify.doneCount |
| 343 | confirm | Send this notification? | notify.confirmTitle |
| 346 | confirm | `This goes to ${who} straight away. There is no way to unsend it.` (dynamic) | notify.confirmBody |
| 348 | title | Preview | notify.previewTitle |
| 351 | label | Untitled (fallback) | notify.untitled |
| 359 | button | Cancel | common.cancel |
| 365 | button | Send now | notify.sendNow |

## `src/app/notice-board.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 64 | label | Event / Events | noticeBoard.catEvent |
| 65 | label | Meeting / Meetings | noticeBoard.catMeeting |
| 66 | label | Announcement / Announcements | noticeBoard.catAnnouncement |
| 67 | label | Policy / Policy updates | noticeBoard.catPolicy |
| 68 | label | Holiday / Holidays | noticeBoard.catHoliday |
| 76 | label | Notice / Other notices (fallback) | noticeBoard.catOther |
| 83 | label | Untitled notice (fallback) | noticeBoard.untitled |
| 109 | label | `Was ${fmtDay(d)}` (dynamic) | noticeBoard.tokenWas |
| 189 | label | All | common.all |
| 210 | title | Pinned | noticeBoard.pinnedSection |
| 234 | empty | The notice board could not load | noticeBoard.emptyOutageTitle |
| 235 | empty | The server did not answer, so this is not an empty board, it is an unanswered request. Check your connection and try again. | noticeBoard.emptyOutageSub |
| 236 | button | Try again | common.tryAgain |
| 241 | empty | `Nothing under ${group}` (dynamic) | noticeBoard.emptyFilterTitle |
| 242 | empty | Other parts of the board still have notices on them. | noticeBoard.emptyFilterSub |
| 243 | button | Show the whole board | noticeBoard.showWholeBoard |
| 248 | empty | Nothing posted yet | noticeBoard.emptyNoneTitle |
| 249 | empty | Announcements, meetings, policy updates and holidays from the firm all land here. Only admins can post, so there is nothing for you to add. | noticeBoard.emptyNoneSub |
| 250 | button | Refresh | common.refresh |
| 257 | title | Notice Board | noticeBoard.title |
| 258 | header | From the firm | noticeBoard.subtitle |
| 263 | label | Coming up | noticeBoard.comingUp |
| 304 | other | Kept at the top by the office until it is taken down. | noticeBoard.pinnedFooter |
| 322 | label | `1 notice on the board` / `${n} notices on the board` (dynamic) | noticeBoard.count |
| 384 / 425 | label | Pinned (badge) | noticeBoard.pinnedBadge |
| 432 | label | This notice was posted with a title only. There is no further detail on it. | noticeBoard.noBody |
| 436 | title | Details | noticeBoard.detailsTitle |
| 437 | label | When | noticeBoard.rowWhen |
| 438 | label | Where | noticeBoard.rowWhere |
| 439 | label | Posted | noticeBoard.rowPosted |
| 440 | label | Posted by | noticeBoard.rowPostedBy |
| 441 | label | For | noticeBoard.rowFor |
| 444 | label | Reference | noticeBoard.rowReference |
| 447 | other | Notices are posted by the office. You cannot edit or remove one from here. | noticeBoard.readOnlyFooter |

## `src/app/notes.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 55 | label | Task | notes.catTask |
| 56 | label | Reminder | notes.catReminder |
| 57 / 70 | label | Note (+ fallback) | notes.catNote |
| 58 | label | Idea | notes.catIdea |
| 59 | label | Follow up | notes.catFollowUp |
| 205 | error | That note was not saved. The server refused the write, so nothing has been added to your board. | notes.saveFail |
| 224 | toast | Note saved to your board. | notes.savedToast |
| 226 | toast | `Note saved under ${category}.` (dynamic) | notes.savedUnderToast |
| 238 | error | That note could not be changed. The server refused the write, so it is unchanged on your board. | notes.pinFail |
| 243 | toast | Note pinned to the top. / Note unpinned. | notes.pinToast |
| 249 | confirm | Delete this note? | notes.deleteTitle |
| 249 | confirm | It leaves your board for good. Nobody else can see it, and it cannot be brought back. | notes.deleteBody |
| 251 | button | Delete | common.delete |
| 252 | button | Keep it | notes.keepIt |
| 264 | error | That note was not deleted. The server refused the write, so it is still on your board. | notes.deleteFail |
| 275 | toast | Note deleted. | notes.deletedToast |
| 299 | label | All | common.all |
| 322 | empty | Your board needs your mobile number | notes.noBoardTitle |
| 322 | empty | Notes are matched to the WhatsApp number they were dictated from, so your profile has to carry that number before a board can exist. Nothing is missing, there is simply no board yet. | notes.noBoardSub |
| 323 | button | Open my profile | notes.openProfile |
| 328 | empty | Your notes could not load | notes.emptyOutageTitle |
| 329 | empty | The server did not answer, so this is not an empty board, it is an unanswered request. Check your connection and try again. | notes.emptyOutageSub |
| 330 | button | Try again | common.tryAgain |
| 335 | empty | `No note matches "${q}"` (dynamic) | notes.emptySearchTitle |
| 336 | empty | Search looks through the note text, the original dictation and the tags. | notes.emptySearchSub |
| 337 | button | Clear search | notes.clearSearch |
| 342 | empty | `Nothing filed under ${label}` (dynamic) | notes.emptyFilterTitle |
| 343 | empty | Other categories on your board still have notes in them. | notes.emptyFilterSub |
| 344 | button | Show all notes | notes.showAll |
| 349 | empty | Nothing on your board yet | notes.emptyNoneTitle |
| 350 | empty | Jot something below, or send a voice note to the CGPE WhatsApp number and it lands here transcribed. | notes.emptyNoneSub |
| 351 | button | Jot a note | notes.jotNote |
| 358 | title | Notes | notes.title |
| 359 | header | Private to you | notes.subtitle |
| 365 | label | On your board | notes.onYourBoard |
| 374 | error | That change did not save | notes.writeErrorTitle |
| 406 | placeholder | Search your notes and dictations | notes.searchPlaceholder |
| 418 | label | `1 note matches` / `${total} notes match` (dynamic) | notes.matchCount |
| 420 | button | Clear | common.clear |
| 517 | button | Hide original dictation / Show original dictation | notes.discloseDictation |
| 518 | button | Show less / Show more | notes.discloseMore |
| 523 | label | Unpin / Pin (swipe) | notes.pinAction |
| 527 | label | Delete (swipe) | common.delete |
| 565 | label | No text was saved with this note. | notes.noText |
| 570 | label | Voice note | notes.voiceNote |
| 571 | label | Pinned | notes.pinnedBadge |
| 604 | label | As dictated on WhatsApp | notes.asDictated |
| 649 | label | New note | notes.newNoteLabel |
| 652 | placeholder | What do you need to remember? | notes.composerPlaceholder |
| 663 | button | Cancel | common.cancel |
| 665 | button | Save note | notes.saveNote |
| 679 / 689 | label | Jot a note (+ a11y) | notes.jotNote |
| 741 | button | Load older notes | notes.loadOlder |
| 744 | label | `1 note shown` / `All ${count} notes shown` (dynamic) | notes.shownCount |

## `src/app/campaigns.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 78 | label | Clients with a premium falling due | campaigns.audRenewal |
| 83 | label | Clients with a birthday this month | campaigns.audBirthday |
| 88 | label | Clients with a policy maturing soon | campaigns.audMaturity |
| 93 | label | Clients whose policy anniversary falls this month | campaigns.audAnniversary |
| 98 | label | Renewals | campaigns.kindRenewal |
| 99 | label | Birthdays | campaigns.kindBirthday |
| 100 | label | Maturity | campaigns.kindMaturity |
| 101 | label | Anniversary | campaigns.kindAnniversary |
| 197 | label | No number on record | campaigns.noNumber |
| 206 | button | Send | campaigns.sendRow |
| 233 | label | `Collapse the message to ${name}` / `Read the full message to ${name}` a11y (dynamic) | campaigns.a11yToggleMessage |
| 239 | button | Show less / Read the full message | campaigns.readFullMessage |
| 373 | error | Your role cannot send bulk campaigns | campaigns.roleRefusedTitle |
| 374 | error | The server refused the bulk send for this account. Nothing was dispatched. Message clients one at a time from the sample below, or ask an admin or team leader to run this campaign. | campaigns.roleRefusedMsg |
| 383 | error | Dispatch failed | campaigns.dispatchFailTitle |
| 385 | error | The send did not reach the server, so nothing was delivered. Try again, or message clients one at a time from the sample below. | campaigns.dispatchFailMsg |
| 394 | label | Nothing to send | campaigns.nothingToSendTitle |
| 396 | label | No client matched this occasion, so nothing was dispatched. | campaigns.nothingMatchedMsg |
| 407 | label | `Dispatched to ${n} client(s)` (dynamic) | campaigns.dispatchedTitle |
| 409 | label | The server confirmed the campaign was handed to the sender. | campaigns.dispatchedMsg |
| 416 | label | Nothing was confirmed sent | campaigns.noneConfirmedTitle |
| 419 | label | `${n} recipient(s) found, but the server did not confirm a single delivery. Send them one at a time from the sample below.` (dynamic) | campaigns.noneConfirmedMsg |
| 429 | label | Unnamed client (fallback) | campaigns.unnamedClient |
| 448 | label | Renewals due | campaigns.kpiRenewalsDue |
| 449 | label | Birthdays | campaigns.kpiBirthdays |
| 450 | label | Maturity soon | campaigns.kpiMaturitySoon |
| 451 | label | Anniversaries | campaigns.kpiAnniversaries |
| 452 | label | Reachable | campaigns.kpiReachable |
| 453 | label | In the book | campaigns.kpiInBook |
| 473 | label | Nothing to send | campaigns.nothingToSendTitle |
| 475 | label | No client matches this occasion right now, so there is nobody to message. | campaigns.nobodyToMessage |
| 481 | confirm | `Send to ${n} client(s)?` (dynamic) | campaigns.confirmSendTitle |
| 483 | confirm | `Your whole client book is re-scanned when this runs, so the final count can differ a little from ${n}. Every client with a premium due gets a personalised WhatsApp. This messages real policyholders.` (dynamic) | campaigns.confirmRenewalMsg |
| 484 | confirm | `A personalised WhatsApp goes to all ${n} matching client(s), not just the ones sampled below. This messages real policyholders and cannot be recalled.` (dynamic) | campaigns.confirmOtherMsg |
| 485 | button | Start sending | campaigns.startSending |
| 503 | confirm | Campaign handed off | campaigns.handoffTitle |
| 504 | confirm | Your client book is being scanned and renewal reminders dispatched in the background. Watch the progress, or keep working? | campaigns.handoffRenewalMsg |
| 506 | confirm | The messages are being dispatched in the background. Watch the progress, or keep working? | campaigns.handoffOtherMsg |
| 508 | button | Monitor progress | campaigns.monitorProgress |
| 509 | button | Continue working | campaigns.continueWorking |
| 513 | toast | Running in the background. Tap the progress bar to monitor. | campaigns.runningToast |
| 530 | empty | `${n} matched, none sampled` (dynamic) | campaigns.emptyNoSampleTitle |
| 531 | empty | The server counted this audience but returned no sample rows, so there are no names or messages to check. The send button above still reaches every one of them. | campaigns.emptyNoSampleSub |
| 531 | button | Reload the sample | campaigns.reloadSample |
| 536 | empty | The audience did not load | campaigns.emptyOutageTitle |
| 537 | empty | The server did not answer, so this is not a confirmed empty audience. Check your connection and try the request again. | campaigns.emptyOutageSub |
| 538 | button | Try again | common.tryAgain |
| 543 | empty | Nobody is due for this | campaigns.emptyNoneTitle |
| 544 | empty | `${audience} would appear here. Nobody on your book qualifies right now, so there is nothing to send.` (dynamic) | campaigns.emptyNoneSub |
| 545 | button | Pick another occasion | campaigns.pickAnother |
| 551 | title | Campaigns | campaigns.title |
| 551 | header | Bulk WhatsApp outreach | campaigns.subtitle |
| 592 | label | Your book right now | campaigns.bookNow |
| 625 | other | Each client gets their own reminder with their premium, policy number and due date. The book is re-scanned live when you send, so the final count can differ slightly from the figure above. | campaigns.blurbRenewal |
| 626 | other | Each client gets their own message, personalised from their record. The rows below are a sample of the audience, not the whole of it. | campaigns.blurbOther |
| 633 | label | Reachable on WhatsApp | campaigns.reachableLabel |
| 634 | label | `${opted_in} of ${total_clients}` (dynamic) | campaigns.reachableValue |
| 644 | button | Starting / `Send to all ${n}` / Nobody to send to (dynamic) | campaigns.sendAllBtn |
| 657 | label | Dispatching now | campaigns.dispatchingNow |
| 661 | label | `${processedShown} of ${jobTotal}` (dynamic) | campaigns.dispatchValue |
| 664 | label | Building the audience for this send. | campaigns.buildingAudience |
| 667 / 685 | button | Monitor progress | campaigns.monitorProgress |
| 694 | title | `Sample of ${n} recipient(s)` (dynamic) | campaigns.sampleTitle |
| 695 | other | `These are a sample. Sending reaches all ${n} client(s), including ${hidden} not shown here.` (dynamic) | campaigns.sampleFooterMore |
| 697 | other | `Every matching client is shown. Sending reaches all ${n} of them.` (dynamic) | campaigns.sampleFooterAll |

## `src/app/job/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 40 | label | Sending | job.statusSending |
| 41 | label | Completed | job.statusCompleted |
| 42 | label | Failed | job.statusFailed |
| 83 | title | Job | job.title |
| 86 | empty | This job is no longer running | job.goneTitle |
| 87 | empty | Background jobs are kept only while the app is open. It has finished and been cleared. | job.goneSub |
| 88 | button | Go back | job.goBack |
| 100 | header | Background job | job.subtitle |
| 112 | label | Live / Finished | job.livePill |
| 120 | label | messages | job.messagesUnit |
| 129 | label | Dispatching / Dispatched | job.meterLabel |
| 133 | other | The audience is handed to the sender in one call, so this tracks dispatch progress, not per-message delivery. | job.dispatchNote |
| 144 | label | The send did not complete / Send finished | job.bannerTitle |
| 152 / 161 | title | Activity | job.activityTitle |
| 153 | empty | Nothing logged yet | job.noLogTitle |
| 154 | empty | Each step of the send is written here as it happens. | job.noLogSub |
| 162 | other | Newest first. The list keeps the last 40 steps. | job.activityFooter |
| 176 | button | Keep working, this runs in the background / Done | job.doneBtn |
