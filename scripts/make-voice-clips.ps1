# Generate test speech clips for the voice probe — locally, free, no vendor and no credits.
#
# WHY: exercising `POST /api/voice/ask` end to end (STT -> brain -> TTS) needs real spoken audio, and
# the obvious routes all cost something: a paid TTS API, or a human recording clips by hand on a
# phone. Windows ships a speech engine, so neither is necessary — `System.Speech` writes a WAV, and
# the backend's own upload filter accepts `.wav` (`cgpe-backend-main/routes/voice.js:47`).
#
# LIMIT, stated plainly: this machine has only en-US voices (David, Zira), so these clips test the
# ENGLISH half of the battery. The Hindi/Hinglish commands staff actually speak cannot be generated
# here and still need either a Hindi voice pack or a human recording. What this DOES prove is the
# whole pipeline: upload -> Sarvam STT -> n8n brain -> action -> TTS.
#
#   powershell -ExecutionPolicy Bypass -File scripts\make-voice-clips.ps1
#   node scripts/voice-probe.mjs

$dir = Join-Path $PSScriptRoot "..\e2e\voice-probe\audio"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Add-Type -AssemblyName System.Speech

# Ordinary reads, one deliberate nonsense clip (must NOT navigate), and one multi-command sentence
# (the contract returns ONE action — see the NOTE printed by voice-probe.mjs).
$clips = [ordered]@{
  "tasks-today" = "show me my tasks for today"
  "claims"      = "open my claims"
  "attendance"  = "show my attendance"
  "leads"       = "show me my leads"
  "earnings"    = "how much are my earnings this month"
  "calendar"    = "open the calendar"
  "nonsense"    = "asdf qwerty zxcv plugh"
  "multi"       = "show me my tasks for today and also create a new task for tomorrow"
}

# 16 kHz / 16-bit / mono is the standard speech-recognition format and keeps each clip under ~200 KB.
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, `
  [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, `
  [System.Speech.AudioFormat.AudioChannel]::Mono)

foreach ($k in $clips.Keys) {
  # A fresh synthesizer per clip: reusing one after SetOutputToWaveFile can leave the previous file
  # handle open and truncate the next clip.
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  try { $s.SelectVoice("Microsoft Zira Desktop") } catch { }
  $s.Rate = -1   # slightly slower than default; STT accuracy improves noticeably
  $path = Join-Path $dir "$k.wav"
  $s.SetOutputToWaveFile($path, $fmt)
  $s.Speak($clips[$k])
  $s.Dispose()
}

Write-Output "Wrote $($clips.Count) clips to $dir"
Get-ChildItem $dir -Filter *.wav | Select-Object Name, Length | Format-Table -AutoSize
