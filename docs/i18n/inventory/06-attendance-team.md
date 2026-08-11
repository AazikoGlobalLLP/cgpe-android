# Inventory — attendance / calendar / reminders / team / agent-map / agent-track

~187 strings, all 7 screens **100% hardcoded** (none call `t()`). Line numbers as of 2026-08-11 —
anchor on the English literal, not the line. Interpolation marked `(dynamic)`. See `../SCOPE.md`.

## `src/app/attendance.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 56–59 | label | Month names `January … December` (section headers) | attendance.monthLong (set) |
| 97 | header | `${MONTH_LONG[m]} ${year}` (dynamic) | attendance.monthYear |
| 90 | other | `${h}h ${m}m` / `${m}m` worked-duration (dynamic) | attendance.workedDuration |
| 95 | header | Undated entries | attendance.undatedEntries |
| 212 | label | Days logged | attendance.daysLogged |
| 213 | label | Closed days | attendance.closedDays |
| 222 | title | My attendance | attendance.title |
| 222 | header | Your GPS clock-in history | attendance.subtitle |
| 269 | label | Today | attendance.today |
| 274 | label | Clocked in | attendance.clockedIn |
| 275 | label | Not clocked in | attendance.notClockedIn |
| 279 | label | Location not recorded | attendance.locationNotRecorded |
| 280 | label | Clock in from the Today tab to start the day. | attendance.clockInPrompt |
| 284 | label | Present | attendance.present |
| 301 | empty | Attendance could not load | attendance.couldNotLoadTitle |
| 302 | empty | The server did not answer, so this history is unconfirmed rather than empty. | attendance.couldNotLoadSubtitle |
| 303 | button | Try again | common.tryAgain |
| 306 | empty | No clock-in history yet | attendance.emptyTitle |
| 309 | empty | Every day you clock in appears here with its times and the location it was marked from. | attendance.emptySubtitle |
| 310 | button | Go to Today | attendance.goToToday |
| 341 | label | `${inAt} to ${outAt}` (dynamic) | attendance.inToOut |
| 342 | label | `In at ${inAt}` (dynamic) | attendance.inAt |
| 343 | label | No clock-in recorded | attendance.noClockInRecorded |
| 359 | label | Full day | attendance.fullDay |
| 359 | label | Open | attendance.open |
| 359 | label | No entry | attendance.noEntry |

## `src/app/calendar.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 30 | label | Weekday short `Sun … Sat` | calendar.weekdayShort (set) |
| 31 | label | Weekday full `Sunday … Saturday` | calendar.weekdayFull (set) |
| 56 | label | Today | calendar.today |
| 57 | label | Tomorrow | calendar.tomorrow |
| 60 | label | Month-abbrev `Jan … Dec` + `${wd}, ${date} ${mon}` (dynamic) | calendar.monthShort (set) / calendar.dayTitle |
| 126 | header | Loading the next 14 days | calendar.loadingSubtitle |
| 128 | header | `${openTotal} open in the next 14 days` (dynamic) | calendar.openInNext14 |
| 129 | header | Next 14 days | calendar.next14Days |
| 133 | title | Calendar | calendar.title |
| 148 | label | `${weekday} ${date}, ${count} open` a11y (dynamic) | calendar.dayCellA11y |
| 164 | label | `${n} item${s}` (dynamic, plural) | calendar.itemCount |
| 240 | label | Done | common.done |
| 244 | button | Call | common.call |
| 246 | button | WhatsApp | common.whatsapp |
| 280 | empty | Your calendar could not load | calendar.couldNotLoadTitle |
| 281 | empty | The server did not answer, so this day is unconfirmed rather than clear. Check your connection and try again. | calendar.couldNotLoadSubtitle |
| 282 | button | Try again | common.tryAgain |
| 290 | empty | Nothing scheduled in the next 14 days | calendar.emptyTitle |
| 291 | empty | Birthdays, premium chases and follow-ups appear here as soon as they are raised against your book. | calendar.emptySubtitle |
| 292 | button | Refresh | common.refresh |
| 299 | empty | `${dayLabel} is clear` (dynamic) | calendar.dayClearTitle |
| 300 | empty | No follow-ups, greetings or premium chases fall on this day. | calendar.dayClearSubtitle |
| 302 | button | `Go to ${dayTitle}` (dynamic) | calendar.goToDay |

## `src/app/reminders.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 103 | label | Today (gutter) | reminders.today |
| 112 | label | No date on record. (+ optional `${subtitle}`) | reminders.noDateOnRecord |
| 116 | label | `Overdue by ${n} day(s). ${subtitle}` (dynamic) | reminders.overdueBy |
| 209 | error | Not marked done | reminders.notMarkedDone |
| 210 | toast | `"${title}" could not be saved — it never reached the server, so it is still open. Check your connection and try again.` (dynamic) | reminders.notSavedMessage |
| 234 | header | Every follow-up is closed | reminders.allClosedSubtitle |
| 234 | header | Nothing pending | reminders.nothingPending |
| 236 | header | `${n} pending, ${m} overdue` (dynamic) | reminders.pendingOverdue |
| 237 | header | `${n} pending follow-up(s)` (dynamic) | reminders.pendingCount |
| 241 | title | Reminders | reminders.title |
| 265 | empty | Reminders did not load | reminders.couldNotLoadTitle |
| 266 | empty | The server could not be reached, so this is not a confirmed empty list. Pull down to try again. | reminders.couldNotLoadSubtitle |
| 267 | button | Try again | common.tryAgain |
| 271 | empty | No follow-ups yet | reminders.emptyTitle |
| 273 | empty | Birthdays, renewals and maturities from your client book appear here as they come due. | reminders.emptySubtitle |
| 280 | header | Overdue (section) | reminders.overdue |
| 283 | header | Today (section) | reminders.todaySection |
| 285 | header | Upcoming | reminders.upcoming |
| 289 | header | Completed | reminders.completed |
| 296 | empty | Nothing left to chase | reminders.allDoneTitle |
| 298 | empty | Every follow-up on your book is closed. New ones appear here as they come due. | reminders.allDoneSubtitle |
| 305–306 | label | Swipe a reminder for quick actions, or press and hold it. | reminders.swipeHint |
| 337 | button | Done (swipe) | common.done |
| 341 | button | WhatsApp (swipe) | common.whatsapp |
| 343 | other | `Namaste ${clientName}` (dynamic, WhatsApp prefill) | common.whatsappGreeting |
| 371 | label | `Mark ${title} done` a11y (dynamic) | reminders.markDoneA11y |

## `src/app/team/index.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 73 | label | On duty now | team.onDutyNow |
| 74 | label | Signed in | team.signedIn |
| 79 | label | Team premium (MTD) | team.teamPremiumMtd |
| 104 | title | Team | team.title |
| 105 | header | Loading the roster | team.loadingSubtitle |
| 105 | header | `${n} member(s), ${m} on duty` (dynamic) | team.rosterSubtitle |
| 119 | empty | The roster could not load | team.rosterCouldNotLoadTitle |
| 119 | empty | No team members yet | team.emptyTitle |
| 120–121 | empty | The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again. | team.rosterCouldNotLoadSubtitle |
| 122 | empty | People appear here once they are added to your branch in the admin panel. | team.emptySubtitle |
| 123 | button | Try again | common.tryAgain |
| 140 | label | 1 agent in the field / `${n} agents in the field` (dynamic) | team.agentsInField |
| 142 | label | Clocked in today | team.clockedInToday |
| 151 | header | Team activity | team.activityTitle |
| 160 | header | `Members (${n})` (dynamic) | team.membersTitle |
| 164 | placeholder | Name, role or branch | team.searchPlaceholder |
| 171 | empty | `No member matches "${q}"` (dynamic) | team.noMatchTitle |
| 172 | empty | Search runs over the names, roles and branches on the roster loaded here. | team.noMatchSubtitle |
| 173 | button | Clear search | common.clearSearch |
| 177 | label | `${n} of ${m} shown` (dynamic) | team.shownOfTotal |
| 214 | label | On duty (pill) | common.onDuty |

## `src/app/team/[id].tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 66 | label | Premium (MTD) | team.premiumMtd |
| 67 | label | Clients | team.clients |
| 68 | label | Done (MTD) | team.doneMtd |
| 69 | label | Completion | team.completion |
| 70 | label | Open work | team.openWork |
| 71 | label | Open claims | team.openClaims |
| 80 / 99 / 229 | title | Team member (header) | team.memberTitle |
| 83 | empty | This profile could not load | team.profileCouldNotLoadTitle |
| 83 | empty | Member not found | team.memberNotFoundTitle |
| 84–85 | empty | The server did not answer, so nothing here is confirmed. Check your connection and try again. | team.profileCouldNotLoadSubtitle |
| 86 | empty | This person is no longer on a roster you can see. They may have been moved or removed. | team.memberNotFoundSubtitle |
| 87 | button | Try again | common.tryAgain |
| 109 | button | No mobile number on this profile | team.noMobileTitle |
| 111 | error | Calls and WhatsApp both need a number on the staff record. | team.noMobileMessage |
| 129 | label | On duty (pill) | common.onDuty |
| 130 | label | Signed in (pill) | common.signedIn |
| 131 | label | `${tier} club` (dynamic) | team.tierClub |
| 145–146 | empty | No performance figures have come back for this member yet. | team.noFigures |
| 152 | header | Contact | team.contact |
| 153 | label | Mobile | team.mobile |
| 154 | label | Email | team.email |
| 155 | label | Branch | team.branch |
| 156 | label | Role | team.role |
| 157 | label | Last active | team.lastActive |
| 164 | header | Recent activity | team.recentActivity |
| 168 | empty | No recorded activity | team.noActivityTitle |
| 169 | empty | Task and field activity shows here once this member starts working from the app. | team.noActivitySubtitle |
| 206 | label | `Call ${name}` a11y (dynamic) | team.callA11y |
| 209 | button | WhatsApp | common.whatsapp |

## `src/app/agent-map.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 122 / 323 | title | Agent locations | agentMap.title |
| 123 | header | `${n} on duty, ${m} tracked` (dynamic) | agentMap.subtitle |
| 144 | label | Live field status | agentMap.liveFieldStatus |
| 148 | label | agent is clocked in right now / agents are clocked in right now | agentMap.clockedInRightNow |
| 156 | label | On duty (legend) | agentMap.legendOnDuty |
| 157 | label | Clock-in point (legend) | agentMap.legendClockIn |
| 158 | label | Clock-out point (legend) | agentMap.legendClockOut |
| 162–165 | label | Drag to pan, pinch to zoom. Tap a pin for the name and time, or a numbered badge to open the agents standing on the same spot. | agentMap.mapHint |
| 178 | label | Movement paths | agentMap.movementPaths |
| 179 | label | Replay where each agent went, by date | agentMap.movementPathsSub |
| 188 | header | My check-in | agentMap.myCheckIn |
| 188 | label | Still on duty. Clock out from the Today tab. | agentMap.stillOnDuty |
| 190 | label | Clocked in | agentMap.clockedIn |
| 191 | label | Time not recorded | agentMap.timeNotRecorded |
| 198 | label | Clocked out | agentMap.clockedOut |
| 212 | header | `On duty (${n})` (dynamic) | agentMap.onDutySection |
| 216 | empty | Field status could not load | agentMap.statusCouldNotLoadTitle |
| 217 | empty | Nobody is being tracked yet | agentMap.nobodyTrackedTitle |
| 218 | empty | Nobody is on duty | agentMap.nobodyOnDutyTitle |
| 219–220 | empty | The server did not answer, so an empty map here is unconfirmed rather than quiet. Check your connection and try again. | agentMap.statusCouldNotLoadSubtitle |
| 222 | empty | Pins appear once your team clocks in from the app with location on. | agentMap.nobodyTrackedSubtitle |
| 223 | empty | Everyone tracked today has clocked out. Pins return as soon as someone clocks back in. | agentMap.nobodyOnDutySubtitle |
| 224 | button | Refresh | common.refresh |
| 236 | header | `Off duty (${n})` (dynamic) | agentMap.offDutySection |
| 246 | label | Off (pill) | agentMap.off |
| 254–256 | label | Shows clock-in and clock-out points only. No travel history is recorded here. | agentMap.pointsOnlyNote |
| 271 | label | On field (subtitle fallback) | agentMap.onField |
| 284 | label | `Call ${name}` a11y (dynamic) | agentMap.callA11y |
| 292 | label | `Open WhatsApp chat with ${name}` a11y (dynamic) | agentMap.whatsappA11y |

## `src/app/agent-track.tsx`

| line | kind | english | proposedKey |
|---|---|---|---|
| 45 / 47 | label | Unknown (duration fallback) | agentTrack.unknown |
| 50 | other | `${mins}m` / `${h}h ${m}m` (dynamic) | agentTrack.durationFmt |
| 53 | other | `${n} km` (dynamic) | agentTrack.kmFmt |
| 145 | label | Distance | agentTrack.distance |
| 146 | label | Points | agentTrack.points |
| 147 | label | Duration | agentTrack.durationLabel |
| 154 / 167 | title | Movement paths | agentTrack.title |
| 156 | empty | Master access only | agentTrack.masterOnlyTitle |
| 157 | empty | Field-route history is visible to the master admin. Ask them if you need a route checked. | agentTrack.masterOnlySubtitle |
| 168 | header | Pick a team member | agentTrack.pickMember |
| 185 | placeholder | Search team member | agentTrack.searchPlaceholder |
| 191 | empty | `No member matches "${q}"` (dynamic) | agentTrack.noMatchTitle |
| 192 | empty | The roster could not load | agentTrack.rosterCouldNotLoadTitle |
| 193 | empty | No trackable members | agentTrack.noMembersTitle |
| 194 | empty | Search runs over the names and roles on the roster loaded here. | agentTrack.noMatchSubtitle |
| 195–196 | empty | The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again. | agentTrack.rosterCouldNotLoadSubtitle |
| 197 | empty | Only staff with a user account can be tracked. Add one in the admin panel first. | agentTrack.noMembersSubtitle |
| 199 | button | Clear search | common.clearSearch |
| 200 | button | Try again | common.tryAgain |
| 204 | label | `${n} of ${m} shown` (dynamic) | agentTrack.shownOfTotal |
| 222 | button | All members | agentTrack.allMembers |
| 238 | empty | No points recorded for this shift | agentTrack.noPointsTitle |
| 239 | empty | The shift was opened but no location fixes came back for it. That normally means location was switched off, or the app never ran in the background that day. | agentTrack.noPointsSubtitle |
| 252–256 | label | Drag to pan, pinch to zoom. The line runs from A to B, faint at the start of the shift and solid at the newest point. Tap anywhere on it for the time. | agentTrack.mapHint |
| 272 / 283 | header | Tracked shifts (last 14 days) | agentTrack.trackedShifts |
| 275 | empty | Shifts could not load | agentTrack.shiftsCouldNotLoadTitle |
| 275 | empty | No routes recorded yet | agentTrack.noRoutesTitle |
| 276–277 | empty | The server did not answer, so this is unconfirmed rather than empty. Check your connection and try again. | agentTrack.shiftsCouldNotLoadSubtitle |
| 278 | empty | `${name} has not recorded a field route in the last 14 days. Paths appear here after they clock in from the app.` (dynamic) | agentTrack.noRoutesSubtitle |
| 279 | button | Try again | common.tryAgain |
| 314 | other | `${n} points` (dynamic) | agentTrack.pointsCount |
| 324 | label | `Shift ${date}, ${detail}` a11y (dynamic) | agentTrack.shiftA11y |
| 341 | label | On duty (pill) | common.onDuty |
