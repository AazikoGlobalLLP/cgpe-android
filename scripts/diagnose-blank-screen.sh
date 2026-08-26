#!/usr/bin/env bash
#
# Phase 77 leftover — the More -> Today blank screen (#8).
#
# WHAT THIS IS FOR. The recorded prime suspect (`Appear`'s `cancelAnimation` cleanup in
# `src/ui/motion.tsx`) was DISPROVED in Phase 77, and no replacement cause is confirmed. Rather than
# ship another confident-but-wrong fix, this runs the two DISCRIMINATORS that decide it. Both run on
# the APK ALREADY INSTALLED on the phone — there is nothing to build, and the EAS build quota
# (exhausted until 1 Sep 2026) does not block them.
#
# WHAT IT DECIDES.
#   TEST 1 — animations off. Android's `isReduceMotionEnabled` reads `transition_animation_scale`
#     directly (AccessibilityInfoModule.kt:101-106,157), so setting it to 0 makes `useReducedMotion()`
#     return true and `Appear` take its reduced branch and never animate at all.
#       -> screen STILL blanks  => `Appear` is DEFINITIVELY not the cause. Close that line for good.
#       -> screen stops blanking => it IS animation-related after all, and the Phase-77 disproof needs
#                                   revisiting with a device repro in hand.
#   TEST 2 — hierarchy dump while blank. Widget text nodes present or absent.
#       -> PRESENT => a paint / opacity / native-view problem. Look at the view layer.
#       -> ABSENT  => a React render / data problem, and EVERY opacity theory is irrelevant. Look at
#                     the `loading || !uiReady` fork in `src/app/(tabs)/home.tsx` first.
#
# WHY IT IS A SCRIPT AND NOT A CHECKLIST. Screen-off drops the ADB session, so the script sets
# `stay_on_while_plugged_in` for the duration and — this is the part a checklist gets wrong — puts it
# and the animation scale BACK on exit, including on Ctrl-C, via a trap.
#
# PREREQUISITES (owner, physical): phone connected by USB, USB debugging enabled, this PC authorised,
# and the owner SIGNED IN to the app (this repo holds no credentials — the app is real-backend-only).
#
# USAGE:  bash scripts/diagnose-blank-screen.sh [path/to/adb.exe]
#         If adb is not on PATH and not passed, the script tells you where to get it.

set -uo pipefail

PKG="com.cgpe.connect"
OUT="${TMPDIR:-/tmp}/cgpe-blank-screen"
mkdir -p "$OUT"

# ---- locate adb ------------------------------------------------------------
ADB="${1:-}"
if [ -z "$ADB" ]; then
  if command -v adb >/dev/null 2>&1; then
    ADB="adb"
  else
    # Previous sessions unzip Google platform-tools into a scratchpad; reuse one if it is still there.
    ADB="$(ls -1 "$LOCALAPPDATA/Temp/claude"/*/*/scratchpad/platform-tools/adb.exe 2>/dev/null | head -1)"
  fi
fi
if [ -z "$ADB" ] || { [ "$ADB" != "adb" ] && [ ! -f "$ADB" ]; }; then
  cat <<'EOF'
adb was not found.

It needs no admin install: download Google platform-tools, unzip it, and pass the path:
  https://dl.google.com/android/repository/platform-tools-latest-windows.zip
  bash scripts/diagnose-blank-screen.sh /c/path/to/platform-tools/adb.exe
EOF
  exit 1
fi

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ask() { printf '\n>>> %s\n    Press ENTER when done. ' "$*"; read -r _; }

# ---- device check ----------------------------------------------------------
DEV="$("$ADB" devices | awk 'NR>1 && $2=="device" {print $1}' | head -1)"
if [ -z "$DEV" ]; then
  say "No authorised device."
  "$ADB" devices
  cat <<'EOF'

If the list is empty: plug the phone in, enable Developer options -> USB debugging.
If it says "unauthorized": unlock the phone and tap "Allow" on the RSA prompt.
EOF
  exit 1
fi
say "Device: $DEV"

# ---- restore state on ANY exit, including Ctrl-C ---------------------------
restore() {
  say "Restoring device settings"
  "$ADB" shell settings put global transition_animation_scale 1 >/dev/null 2>&1
  "$ADB" shell settings put global window_animation_scale 1     >/dev/null 2>&1
  "$ADB" shell settings put global animator_duration_scale 1    >/dev/null 2>&1
  "$ADB" shell settings put global stay_on_while_plugged_in 0   >/dev/null 2>&1
  echo "    animation scales -> 1, stay-awake -> off"
}
trap restore EXIT INT TERM

"$ADB" shell settings put global stay_on_while_plugged_in 7 >/dev/null 2>&1

# ---- record which build is actually on the phone ---------------------------
# Version strings CANNOT tell preview builds apart (every one is v1.10.0 / versionCode 1), so the
# APK's own hash is the only honest identifier of what is being tested.
say "Identifying the installed build"
APKPATH="$("$ADB" shell pm path "$PKG" 2>/dev/null | tr -d '\r' | sed 's/^package://' | head -1)"
if [ -n "$APKPATH" ]; then
  "$ADB" pull "$APKPATH" "$OUT/base.apk" >/dev/null 2>&1 &&
    echo "    sha256: $(sha256sum "$OUT/base.apk" | cut -d' ' -f1)"
  echo "    (compare against the EAS artifact to confirm WHICH build blanked)"
else
  echo "    $PKG is not installed on this device — install the APK first."
  exit 1
fi

# ============================================================================
say "TEST 1 of 2 — does it still blank with animations OFF?"
"$ADB" shell settings put global transition_animation_scale 0 >/dev/null
"$ADB" shell settings put global window_animation_scale 0     >/dev/null
"$ADB" shell settings put global animator_duration_scale 0    >/dev/null
echo "    animation scales -> 0 (useReducedMotion() now returns true; Appear cannot animate)"

"$ADB" shell am force-stop "$PKG" >/dev/null
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
echo "    app force-stopped and cold-started"

ask "On the phone: go to More, then tap Today. Watch what happens."

printf '    Did the screen go blank/empty? [y/n] '; read -r BLANK1
if [ "$BLANK1" = "y" ] || [ "$BLANK1" = "Y" ]; then
  VERDICT1="STILL BLANKS with animations off => Appear/cancelAnimation is DEFINITIVELY NOT the cause. Every opacity theory is dead."
else
  VERDICT1="Does NOT blank with animations off => it IS animation-related. The Phase-77 disproof must be revisited WITH this repro."
fi
say "$VERDICT1"

# ============================================================================
say "TEST 2 of 2 — is the content RENDERED but invisible, or NOT RENDERED at all?"
echo "    Animations stay off; reproduce the blank screen once more."
"$ADB" shell settings put global transition_animation_scale 1 >/dev/null
echo "    (animation scale back to 1 so this test sees the NORMAL app behaviour)"
"$ADB" shell am force-stop "$PKG" >/dev/null
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

ask "Reproduce the blank screen (More -> Today) and LEAVE IT ON SCREEN — do not navigate away."

"$ADB" shell uiautomator dump /sdcard/w.xml >/dev/null 2>&1
"$ADB" pull /sdcard/w.xml "$OUT/w.xml" >/dev/null 2>&1
if [ ! -s "$OUT/w.xml" ]; then
  echo "    uiautomator dump failed (it fails if the screen is mid-animation) — try again."
else
  NODES="$(grep -o 'text="[^"]\+"' "$OUT/w.xml" | grep -v 'text=""' | sort -u)"
  COUNT="$(printf '%s\n' "$NODES" | grep -c . )"
  echo "    dumped to $OUT/w.xml"
  say "Text nodes on screen while blank: $COUNT"
  printf '%s\n' "$NODES" | head -40 | sed 's/^/      /'
  if [ "$COUNT" -gt 5 ]; then
    VERDICT2="Text nodes ARE present => the content IS rendered but not visible: a PAINT / OPACITY / native-view problem."
  else
    VERDICT2="Text nodes are ABSENT => the content is NOT rendered: a REACT RENDER / DATA problem. Start at the 'loading || !uiReady' fork in src/app/(tabs)/home.tsx; opacity theories are irrelevant."
  fi
  say "$VERDICT2"
fi

# ---- free extra ------------------------------------------------------------
say "FREE EXTRA — pull-to-refresh while blank"
echo "    Home's RefreshControl is bound to load(). If the content comes back after a pull,"
echo "    a settled opacity: 0 in React state is impossible by construction."
ask "Pull down to refresh on the blank screen. Did the content come back?"

# ---- report ----------------------------------------------------------------
{
  echo "# Blank-screen (#8) diagnosis — $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "Device: $DEV"
  echo "APK sha256: $(sha256sum "$OUT/base.apk" 2>/dev/null | cut -d' ' -f1)"
  echo
  echo "## Test 1 — animations off"
  echo "$VERDICT1"
  echo
  echo "## Test 2 — hierarchy dump while blank"
  echo "${VERDICT2:-not captured}"
} > "$OUT/RESULT.md"

say "Written: $OUT/RESULT.md"
cat "$OUT/RESULT.md"
