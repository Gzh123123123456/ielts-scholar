# Decision Log

## [2026-05-06] Speech Recognition Resilience Fixes
- **Fix**: `no-speech` errors no longer treated as fatal in Speaking Practice.
- **Mechanism**: Auto-retry up to 2 times with 500ms delay before each restart. Uses refs (`isRecordingRef`, `fatalSpeechErrorRef`) to avoid React stale-closure bugs.
- **Fix**: Retry button now clears current-attempt state (transcript, feedback, timer, speech error refs) without touching saved sessions.
- **Fix**: `stopRecording` cancels any pending retry timeout and sets fatal flag to prevent restarts after user clicks Done.
- **Note**: Root cause of initial `no-speech` errors was Chrome selecting a previously-removed microphone device — not a code bug. Switched to correct mic resolved it.
- **Decision**: No volume meter, real-time AI correction, or audio-to-AI features added.

## [2026-05-06] Writing Task 2 Practice — Submit Gating Fix
- **Fix**: Phase 2 Submit for Analysis was gated behind `essay.length < 50` (hidden ~17-word threshold), blocking short-text or paragraph-level submissions.
- **New logic**: Button disabled only when `essay.trim().length === 0`.
- **Rationale**: Practice mode should accept paragraph-level and short-answer practice, not just full essays.
- **Word count**: Still displayed; a lightweight hint appears when `0 < wordCount < 20` indicating the text is short and feedback is best treated as paragraph-level practice. Word count does NOT gate submission.
- **Unchanged**: Phase 3 Final Analysis, Mock Provider, Markdown export, static Training Coach sidebar. No real-time sentence-by-sentence coaching, no Gemini.

## [2026-05-06] IELTS Knowledge Layer Added
- **Added**: `/knowledge/ielts` Markdown files as app-usable feedback rules (rubric, strategy, error patterns, style boundaries, note-generation standards).
- **Decision**: Knowledge files are not answer banks or textbooks; they provide rubric, tag, style, and note-generation constraints.
- **Decision**: Uploaded learning PDFs are summarized as non-official references; no long copyrighted excerpts copied.
- **Decision**: Runtime AI should generate targeted feedback from the user's actual answer combined with relevant knowledge rules, rather than paste generic knowledge content.

## [2026-05-05] V1 Architecture Choices
- **Decision**: No real-time correction in Speaking Practice.
- **Reason**: To protect fluency. Correction should be a post-output reflection phase.

- **Decision**: Use Mock Provider by default.
- **Reason**: Ensure prototype works standalone without API keys and allows user to see the UI structure first.

- **Decision**: localStorage for storage.
- **Reason**: Simplest mechanism for browser-only prototype. Documentation provided for transition to IndexedDB or local files.

- **Decision**: Georgia/Serif typography + Warm Paper colors.
- **Reason**: Match the psychology of "serious study" vs "quick chat".
