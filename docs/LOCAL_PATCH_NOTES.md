# Local Patch Notes

## 1. Summary

This project was exported from Google AI Studio as a React + TypeScript + Vite IELTS training app. Local fixes were applied to make Speaking Practice and Writing Task 2 Practice work reliably in a local Chrome browser before connecting any real AI provider.

No architecture was refactored. No Gemini integration was added. No database was introduced. No real-time AI correction was added. Mock Provider remains the default.

### Documentation update (2026-05-06)
This document now records the intentional V1 Writing Task 2 framework flow:
- Phase 1 separates **Coach Discussion / Notes** (process) from **Final Framework Summary** (output).
- Final Framework Summary is currently **manual and user-edited** in V1.
- Phase 2 surfaces the Final Framework Summary above essay writing.
- Phase 3 surfaces **My Framework** and **My Essay** before feedback.
- No real API summarization is enabled yet because Gemini/provider connection is intentionally pending.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/pages/SpeakingPractice.tsx` | Added missing `readQuestion` function; `no-speech` auto-retry with delay; stale-closure fix via `isRecordingRef`; Retry clears current-attempt state; `stopRecording` prevents further retries |
| `src/pages/WritingTask2Practice.tsx` | Removed hidden word-count gating on Submit button; added lightweight short-text hint |
| `src/pages/SpeechTest.tsx` | **New file** — standalone diagnostic page for microphone, MediaRecorder, SpeechRecognition, SpeechSynthesis |
| `src/App.tsx` | Added `/speech-test` route |
| `vite.config.ts` | Fixed corrupted UTF-8 comment |
| `index.html` | Title changed from "My Google AI Studio App" to "IELTS Scholar" |
| `package.json` | Removed unused dependencies: `express`, `@types/express`, `dotenv` |
| `docs/DECISION_LOG.md` | Added 2026-05-06 entries for speech and writing fixes |
| `docs/KNOWN_LIMITATIONS.md` | Updated browser support notes; added `no-speech` recovery entry |
| `docs/LOCAL_PATCH_NOTES.md` | **New file** — this document |
| `C:\Users\Administrator\Desktop\IELTS Scholar.bat` | **New file** — desktop launcher script |

---

## 3. Speaking Practice Fixes

### Why
After resolving a Chrome microphone device selection issue (Chrome was set to a previously-removed device), `no-speech` errors from the Web Speech API still interrupted recognition. A brief pause or silent moment would kill the session.

### What was fixed
- **`no-speech` is no longer a fatal error.** Only `not-allowed`, `service-not-allowed`, `audio-capture`, and similar errors stop recognition.
- **Auto-retry on `no-speech`.** When `onend` fires without speech results and no fatal error occurred, a new `SpeechRecognition` instance is created and started after a 500ms delay. Max 2 retries.
- **Retry clears current-attempt state.** Clicking Retry now resets `transcript`, `feedback`, `timer`, and all speech-related refs. Saved sessions in localStorage are not touched.
- **Stop & Review prevents further restarts.** `stopRecording` sets a `fatalSpeechErrorRef` flag and clears any pending retry timeout. The setTimeout callback also checks this flag before starting.
- **Stale-closure fix.** `isRecording` state was stale inside the `onend` closure (captured as `false` before `setIsRecording(true)` ran). An `isRecordingRef` synced via `useEffect` is now used in the closure.
- **Missing `readQuestion` function was added.** Uses `SpeechSynthesis` to read the question aloud with graceful fallback.

### What was NOT changed
- No volume meter.
- No real-time AI correction.
- No audio sent to the AI provider.
- No formal pronunciation scoring.
- No UI redesign.

---

## 4. Writing Task 2 Fixes

### Why
Phase 2 "Submit for Analysis" was gated behind `essay.length < 50` (~17 words). Short paragraph answers could not be submitted, blocking paragraph-level practice.

### What was fixed
- **Submit disabled only when empty.** `disabled={isAnalyzing || !essay.trim()}` — one non-whitespace character is enough.
- **Word count is informational only.** Still displayed in the footer bar, but does not gate submission.
- **Lightweight short-text hint.** When `0 < wordCount < 20`, a small italic note appears beside the Submit button: *"Short for a full Task 2 essay. Feedback is best treated as paragraph-level practice."*

### What was NOT changed
- Phase 3 Final Analysis flow.
- Mock Provider.
- Markdown export.
- Static Training Coach sidebar (right panel).
- No real-time sentence-by-sentence coaching.

---

## 5. Tested Scenarios

All verified in local Chrome:

- [x] Speaking — normal recording produces accurate transcript
- [x] Speaking — `no-speech` (deliberate silence) auto-recovers, subsequent speech is captured
- [x] Speaking — Stop & Review stops recognition, no further listening
- [x] Speaking — Retry clears transcript, feedback, timer, speech error state
- [x] Speaking — Analyze shows feedback panel on the right
- [x] Writing Task 2 — blank essay → Submit disabled
- [x] Writing Task 2 — short text (1 word) → Submit enabled, hint shown
- [x] Writing Task 2 — 20+ words → Submit enabled, hint hidden
- [x] Writing Task 2 — Phase 3 feedback displays correctly
- [x] Markdown export — downloads `.md` file for both Speaking and Writing
- [x] Debug Panel — shows speech capabilities, mic permission, AI provider, recent logs
- [x] `/speech-test` — all 5 diagnostic sections work

---

## Knowledge Layer Added

Created `/knowledge/ielts` as the V1 knowledge foundation. Nine Markdown files:

- `speaking_rubric.md`
- `speaking_part1_strategy.md`
- `speaking_part2_strategy.md`
- `speaking_part3_strategy.md`
- `writing_task2_rubric.md`
- `writing_task2_frameworks.md`
- `common_cn_speaker_errors.md`
- `sample_answer_guidelines.md`
- `note_generation_rules.md`

### Purpose
These files are not an encyclopedia, textbook, or answer bank. They provide stable feedback rules, rubric constraints, tag definitions, style boundaries, and note-generation standards.

### Runtime expectation
The AI should combine: user answer + question + module/mode + JSON schema + relevant knowledge rules + LLM language ability → targeted feedback.

### Important constraints
- Do not paste generic knowledge file content back to the user.
- Do not treat uploaded PDFs as official IELTS sources.
- Do not copy long copyrighted excerpts.
- Speaking and Writing feedback styles must remain separate.
- V1 pronunciation is not formally assessed.
- Short Writing Task 2 input may be analyzed as partial practice, not reliable full essay scoring.

---

## 6. How to Sync These Fixes Back to AI Studio

Copy the prompt below into an AI Studio session with the original project:

> I have two minimal fixes from local testing that need to be applied to this project. Do not redesign the UI. Do not add a volume meter. Do not add real-time AI correction. Do not connect Gemini. Do not change the Mock Provider default. Do not change the V1 product flow. Preserve the warm old-paper design style.
>
> **Fix A — SpeakingPractice.tsx: `no-speech` auto-retry + Retry state cleanup**
>
> 1. Add `isRecordingRef`, `speechRetriesRef`, `hasSpeechResultRef`, `fatalSpeechErrorRef`, `retryTimeoutRef` as useRef values.
> 2. Sync `isRecordingRef` with `isRecording` state via useEffect.
> 3. In the `SpeechRecognition` `onerror` handler: `no-speech` should only log `addDebugLog('lastSpeechError = "no-speech"')` — do NOT set a fatal status message. `not-allowed`, `service-not-allowed`, `audio-capture`, and all other errors should set `fatalSpeechErrorRef.current = true` and show an error status.
> 4. Add an `onend` handler: if `hasSpeechResultRef.current` is false, `fatalSpeechErrorRef.current` is false, `speechRetriesRef.current < 2`, and `isRecordingRef.current` is true → schedule a retry via `setTimeout(fn, 500)`. In the timeout callback, check `fatalSpeechErrorRef.current` again, create a new `SpeechRecognition` instance with the same handlers, and call `start()` wrapped in try/catch. Save the timeout ID to `retryTimeoutRef`.
> 5. In `stopRecording`: set `fatalSpeechErrorRef.current = true`, clear `retryTimeoutRef`, and call `recognitionRef.current.stop()` wrapped in try/catch.
> 6. Add a `resetCurrentAttempt` function that clears all refs, stops recognition, clears timeout, and resets `transcript`, `feedback`, `timer`, `step`, `statusMessage` to initial values. Wire it to the Retry button's onClick.
> 7. Do NOT clear localStorage sessions in Retry.
>
> **Fix B — WritingTask2Practice.tsx: Submit gating**
>
> 1. In Phase 2, change the Submit button's disabled condition from `essay.length < 50` to `!essay.trim()`.
> 2. When `0 < wordCount < 20`, show a small italic hint next to the button: "Short for a full Task 2 essay. Feedback is best treated as paragraph-level practice."
> 3. Do not change Phase 3, Mock Provider, Markdown export, or the Training Coach sidebar.

---

## 7. Remaining Non-Blocking Issues

- **Debug Panel** currently shows capabilities, route, session count, and recent logs. It could later be enhanced to display the last AI request payload, raw AI response, and parsed JSON.
- **Web Speech API** works reliably in Chrome and Edge. Safari and AI Studio preview environments may still be unreliable.
- **Knowledge files** under `/knowledge/ielts/` are not yet fully populated (only 2 of 9 planned files exist).
- **Gemini Provider** is not yet connected. Mock Provider remains the default.
- **Writing Task 1** is a placeholder page.
- **Speaking Mock** and **Writing Task 2 Mock** are placeholder pages.

---

## 8. Planned Next Step (V1.1 / API Phase)

### Writing framework consolidation
- Add a mock-safe but API-ready action such as:
  - **Generate Framework Summary**, or
  - **Extract Final Framework**
- When real provider is connected, summarize Phase 1 coach discussion into structured fields:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
- Keep user editability mandatory before moving to Phase 2.

### Session-level notes
- Current V1 export is attempt-level.
- Future flow should support **Finish Session / Export Session Note**.
- A session may include:
  - multiple speaking attempts
  - multiple questions
  - repeated attempts on the same question
- Session note target content:
  - repeated error patterns
  - improvement trends
  - best upgraded answers
  - reusable expressions
  - review cards

### Future writing feedback layers
- Keep current Phase 3 ordering (My Framework + My Essay before feedback).
- Add sentence-level correction mapping in a later version.
- Inline annotation is future scope only; not part of V1.
