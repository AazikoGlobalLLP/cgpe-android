# Phase 52 — Break feature: translations needed (owner to fill)

The app shows every label in **5 languages**. English is done. I need the **4 other columns**
filled in by a human (machine translation is not allowed in this project). These 9 phrases are the
entire Break feature's on-screen wording.

## The 5 languages (only the last 4 are needed)

| Code | Language | What it means |
|------|----------|---------------|
| `en`    | English | already written (the reference column) |
| `gu`    | **ગુજરાતી** (Gujarati) | Gujarati in the Gujarati script |
| `hi`    | **हिन्दी** (Hindi) | Hindi in the Devanagari script |
| `hi-en` | **Hinglish** | **Hindi** words written in English letters (e.g. "break lena hai") |
| `gu-en` | **Roman Gujarati** | **Gujarati** words written in English letters |

> Note: `hi-en` and `gu-en` are the SAME two spoken languages as `hi`/`gu`, just typed in English
> letters — NOT English. Please use real Hindi/Gujarati words, not the English phrase.

## The 9 phrases to translate

Fill each blank cell. Where a word is fine to keep as-is (some people keep "Break" as "Break"),
just write what you'd actually want a team member to read.

| # | English | Where it appears | ગુજરાતી (gu) | हिन्दी (hi) | Hinglish (hi-en) | Roman Gujarati (gu-en) |
|---|---------|------------------|--------------|------------|------------------|------------------------|
| 1 | **Break** | Button after clock-in (next to Clock out) | | | | |
| 2 | **End break** | Same button while a break is running | | | | |
| 3 | **Add a reason (optional)** | Title of the reason box before a break starts | | | | |
| 4 | **Why are you taking a break?** | Placeholder text inside the reason box | | | | |
| 5 | **Skip** | Button to start the break WITHOUT a reason | | | | |
| 6 | **Start break** | Button to start the break WITH the typed reason | | | | |
| 7 | **You've done 8h 30m** | Title of the confirm popup (only if ≥ 8h30m worked) | | | | |
| 8 | **You've completed your minimum hours. Take a break, or clock out?** | Body of that confirm popup | | | | |
| 9 | **Take a break** | Confirm-popup button that proceeds to the break | | | | |

("Cancel" is already translated in the app — not needed here.)

## How to return it

Reply in chat with the 4 languages for each number (any format), OR fill this table and hand it back.
Once I have real copy for all four columns I wire the keys `break.start / break.end / break.reasonTitle /
break.reasonPlaceholder / break.reasonSkip / break.reasonStart / break.minDoneTitle / break.minDoneBody /
break.minDoneConfirm` and build the Break buttons.
