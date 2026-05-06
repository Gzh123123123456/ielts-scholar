# Decision Log

## [2026-05-06] UI Readability Polish (Writing Task 2 + Global Paper UI)
- **Decision**: Apply readability-focused UI polish only; no business logic changes.
- **Implemented**:
  - Slightly increased global serif body text size and line height to improve long-form reading comfort.
  - Increased PaperCard internal spacing for less cramped analysis blocks.
  - Increased phase-tab size for clearer phase navigation labels.
  - Improved spacing/line-height on Writing Task 2 Final Analysis sections:
    - My Framework
    - My Essay
    - Key Corrections
    - Framework Logic Review
    - Model Answer Excerpt
- **Style constraints preserved**: warm old-paper notebook aesthetic, serif typography, beige paper background, dark brown ink text, terracotta accent.
- **Explicitly unchanged**: provider/schema, Gemini connection status, RAG, pronunciation scoring, Debug Panel, Markdown export, Mock default.

## [2026-05-06] Deferred Idea Logged — Speaking Stuck-Point Assist / Chinese Idea Support (V1.2+)
- **Decision**: Record as deferred future feature only; do not implement in current UI-polish task.
- **Future concept**:
  - After Stop & Review in Speaking Practice, learner may optionally add a Chinese note describing what they wanted to say.
  - AI coach converts it into natural IELTS Speaking English, gives reusable expressions, and shows how to continue from the stuck point.
- **Guardrails**:
  - No real-time bilingual speech recognition now.
  - No changes to current SpeechRecognition logic in this task.

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

## [2026-05-06] Writing Task 2 Framework Workflow (V1) and API-Phase Direction
- **Decision (V1)**: Phase 1 separates process and output:
  - **Coach Discussion / Notes** = iterative drafting conversation.
  - **Final Framework Summary** = user-edited consolidated framework used for writing.
- **Decision (V1)**: Final Framework Summary is **manual** (user editable), not auto-generated.
- **Decision (V1)**: Phase 2 displays Final Framework Summary before essay drafting.
- **Decision (V1)**: Phase 3 displays **My Framework** and **My Essay** before feedback sections.
- **Reason**: Real Gemini/API provider is not connected yet; V1 must stay mock-first and deterministic.
- **Future (V1.1 / API phase)**:
  - Add **Generate Framework Summary** / **Extract Final Framework** action.
  - Use real AI provider to summarize Phase 1 coach discussion into structured fields:
    - Position
    - View A
    - View B
    - My opinion
    - Paragraph plan
    - Possible example
  - User must still be able to edit the generated summary before moving to Phase 2.
- **Future writing feedback direction**:
  - Keep My Framework + My Essay placement before feedback.
  - Consider sentence-level correction mapping in later versions.
  - Inline annotation is future scope; explicitly not part of V1.

## [2026-05-06] Session-Level Notes Roadmap Decision
- **Current (V1)**: Markdown export is attempt-level (single speaking attempt or single writing analysis).
- **Future**: Add **Finish Session / Export Session Note**.
- **Session definition**: One session may include multiple speaking attempts, multiple questions, and repeated attempts on the same question.
- **Planned session note content**:
  - repeated error patterns
  - improvement trends across attempts
  - best upgraded answers
  - reusable expressions
  - review cards for spaced repetition

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

## [2026-05-06] Current State Lock for UI Polish + V1.1 Planning
- **Locked behavior**:
  - Writing Task 2 Phase 1 separates Coach Discussion from Final Framework Summary.
  - Final Framework Summary is user-edited manually in V1.
  - Phase 2 shows Final Framework Summary before essay drafting.
  - Phase 3 shows My Framework and My Essay before feedback.
  - Writing Submit gating remains empty-only (`essay.trim().length === 0`).
  - Speaking no-speech auto-retry, Retry cleanup, and Stop & Review protection remain preserved.
  - Mock Provider remains default; Gemini/API remains unconnected.
  - V1 pronunciation remains not formally assessed.

- **Deferred to V1.1+**:
  - API-assisted framework extraction (Generate/Extract Final Framework).
  - Session-level export (Finish Session / Export Session Note).
  - Sentence-level correction mapping and later inline annotation.
  - Advanced speaking comparison and pronunciation scoring.

- **Do Not Do Yet policy reaffirmed**:
  - No Gemini connection during UI polish.
  - No RAG yet.
  - No pronunciation scoring yet.
  - No full inline annotation editor yet.
  - No provider-default swap away from Mock.
  - No architecture rewrite.
