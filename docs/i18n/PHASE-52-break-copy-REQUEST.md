# Phase 52 — Break feature copy — ✅ RECEIVED from owner 2026-08-18

Owner supplied all 4 non-English columns (human copy, not machine-translated). Wired into
`src/i18n/index.tsx` as the 9 `break.*` keys (parity test bumped 94 → 103). This file is the record.

| # | key | English (en) | ગુજરાતી (gu) | हिन्दी (hi) | Hinglish (hi-en) | Roman Gujarati (gu-en) |
|---|-----|--------------|--------------|------------|------------------|------------------------|
| 1 | `break.start` | Break | બ્રેક | ब्रेक | Break | Break |
| 2 | `break.end` | End break | બ્રેક પૂરો કરો | ब्रेक समाप्त करें | Break khatam karein | Break puro karo |
| 3 | `break.reasonTitle` | Add a reason (optional) | કારણ ઉમેરો (વૈકલ્પિક) | कारण जोड़ें (वैकल्पिक) | Reason dalein (optional) | Reason lakho (optional) |
| 4 | `break.reasonPlaceholder` | Why are you taking a break? | તમે બ્રેક કેમ લઈ રહ્યા છો? | आप ब्रेक क्यों ले रहे हैं? | Aap break kyu le rahe hain? | Tame break kem lai rahya chho? |
| 5 | `break.reasonSkip` | Skip | સ્કીપ કરો | छोड़ें | Skip karein | Skip karo |
| 6 | `break.reasonStart` | Start break | બ્રેક શરૂ કરો | ब्रेक शुरू करें | Break shuru karein | Break sharu karo |
| 7 | `break.minDoneTitle` | You've done 8h 30m | તમે 8h 30m પૂર્ણ કર્યા છે | आपने 8h 30m पूरे कर लिए हैं | Aapne 8h 30m complete kar liye hain | Tame 8h 30m pura kari lidha chhe |
| 8 | `break.minDoneBody` | You've completed your minimum hours. Take a break, or clock out? | તમે તમારા લઘુત્તમ કલાકો પૂર્ણ કર્યા છે. બ્રેક લેવો છે કે ક્લોક-આઉટ કરવો છે? | आपने अपने न्यूनतम घंटे पूरे कर लिए हैं। ब्रेक लेना है या क्लॉक-आउट करना है? | Aapne minimum hours complete kar liye hain. Break lena hai ya clock out? | Tame minimum hours pura kari lidha chhe. Break levo chhe ke clock out? |
| 9 | `break.minDoneConfirm` | Take a break | બ્રેક લો | ब्रेक लें | Break lein | Break lo |

**Note:** #5 Hindi — owner supplied "छोड़ें / स्किप करें"; used the cleaner button word **छोड़ें**.
("Cancel" reuses the existing `common.cancel`.)
