# Decision Log

## [2026-05-07] Speaking Practice Records, Prompt Bank, and High-Band Refinement
- **Decision**: Close the first real-use Speaking QA gaps before adding larger product features.
- **Reason**: Practice needed reliable record access, meaningful question switching, and clearer coaching for answers that are already strong.
- **Implemented**:
  - Speaking Practice records are filtered by current Part 1/2/3 and can be deleted individually.
  - Empty question loads no longer create noisy draft records.
  - Change Question now switches to a different available prompt and does not call AI.
  - Added a small original V1 prompt bank for local testing:
    - Speaking Part 1: 11 topics / 36 questions.
    - Speaking Part 2: 12 cue cards.
    - Speaking Part 3: 37 abstract follow-up questions.
    - Writing Task 2: 22 IELTS-style prompts.
  - Speaking feedback uses a wider result layout with Must Fix / Optional Polish, a prominent upgraded answer, and secondary preserved-style context.
  - `obsidianMarkdown`-only provider issues are repaired locally when core Speaking feedback is valid, so valid feedback is not replaced with generic fallback.
  - Added **Band 9 Refinement / Examiner-Friendly Refinement** as a distinct high-level coaching layer for strong answers with few or no true errors.
  - Added **Practice This Question Again** so learners can retry the same prompt while preserving the analyzed attempt.
- **Explicitly unchanged**: Mock Provider remains default, no provider selection changes, no RAG, no pronunciation scoring, no SpeechRecognition behavior change, no Writing layout change, no API usage panel.

## [2026-05-07] Practice Persistence Before More Content
- **Decision**: Prioritize reliable local practice records before expanding question banks or API usage features.
- **Reason**: First real-use QA showed that moving from Speaking Part 1 to Part 2 and back made prior transcripts, feedback, and notes hard to recover. The same risk applies across practice modules.
- **Implemented**:
  - Added a minimal local-first practice record model in `localStorage`.
  - Speaking Practice saves active Part 1/2/3 attempts and restores previous part attempts without re-calling AI.
  - Writing Task 2 saves Phase 1 coach notes, final framework summary, essay draft, and analysis result.
  - Speaking and Writing practice pages include lightweight Recent Attempts access with local view/restore and markdown export when available.
  - Provider unavailable failures are marked separately from parse/schema fallback and no longer appear as successful coaching.
  - Speaking feedback readability was improved with Must Fix / Optional Polish grouping and a more prominent upgraded answer.
- **Explicitly unchanged**: Mock Provider remains default, no new provider, no RAG, no pronunciation scoring, no SpeechRecognition behavior redesign, no question-bank expansion, no API usage panel.

## [2026-05-07] Optional Gemini Provider Path
- **Decision**: Add a minimal optional Gemini Provider path for local development while keeping Mock Provider as the default.
- **Implemented**:
  - Added `GeminiProvider` implementing the existing provider interface:
    - Speaking analysis
    - Writing analysis
    - Writing Task 2 framework extraction
  - Gemini prompts request strict JSON-only output.
  - Gemini returns raw model text so the existing safety wrappers parse, normalize, and capture diagnostics.
  - Provider selection uses Vite env configuration:
    - `VITE_AI_PROVIDER=gemini`
    - `VITE_GEMINI_API_KEY=...`
  - Missing, unknown, or `mock` provider config uses Mock Provider.
  - `VITE_AI_PROVIDER=gemini` without a key safely falls back to Mock Provider and reports the effective provider as a missing-key fallback.
- **Security note**: `VITE_GEMINI_API_KEY` is exposed to browser/client code. This path is suitable only for local/personal prototype use; production key management is not implemented.
- **Explicitly unchanged**: Mock Provider remains default, no UI provider toggle, no browser-side API key input, no RAG, no pronunciation scoring, no SpeakingPractice SpeechRecognition changes, no Writing Task 2 phase-flow changes.

## [2026-05-07] Writing Task 2 Wide Workspace UX
- **Decision**: Change Writing Task 2 from a narrow vertical reading-page layout into a wider desktop writing workspace.
- **Reason**: Writing Task 2 requires frequent cross-reference between the prompt, framework notes, coach discussion, final framework, essay draft, and feedback.
- **Implemented layout**:
  - Phase 1 uses a two-column workspace:
    - left: Framework Notes / Coach Discussion / note input
    - right: Final Framework Summary / Generate Framework Summary / Done with Framework
  - Phase 2 uses a two-column writing workspace:
    - left: framework reference
    - right: essay editor
  - Phase 3 prioritizes:
    - My Essay
    - Key Corrections
    - Framework Logic Review
    - Model Answer Excerpt
    - My Framework only as secondary planning reference
- **Design principle**: Use horizontal workspace on desktop to reduce unnecessary vertical scrolling, while preserving the warm old-paper academic style. Keep mobile/tablet as a clean single-column flow.
- **Explicitly unchanged**: no Gemini connection, Mock Provider remains default, no RAG, no pronunciation scoring, no SpeakingPractice behavior changes, no business logic change to the Writing Task 2 flow.

## [2026-05-07] Mock-Safe Writing Task 2 Framework Extraction
- **Decision**: Implement the V1.1 **Generate Framework Summary** action without connecting a real API provider.
- **Implemented**:
  - Added a `WritingFrameworkSummary` schema before provider changes.
  - Added optional provider method `extractWritingFramework`.
  - Added Mock Provider implementation for deterministic framework extraction.
  - Added `safeExtractWritingFramework` normalization and provider diagnostics.
  - Added a Phase 1 button that extracts current user Coach Discussion / Notes into the existing Final Framework Summary textarea.
  - Generated summary sections:
    - Position
    - View A
    - View B
    - My opinion
    - Paragraph plan
    - Possible example
  - Empty notes show a non-blocking message and do not overwrite manual summary text.
  - Extracted summaries remain fully editable and do not automatically advance to Phase 2.
- **Explicitly unchanged**: Mock Provider remains default, Gemini remains unconnected, no RAG, no sentence-by-sentence coaching, no SpeakingPractice SpeechRecognition changes, no Writing Task 2 phase-flow changes, no UI redesign.

## [2026-05-06] V1.1 Provider Safety + Debug Panel Scaffolding
- **Decision**: Add provider safety scaffolding before connecting any real API provider.
- **Implemented**:
  - Added safe Speaking and Writing analysis wrappers around provider calls.
  - Added runtime normalization for malformed `SpeakingFeedback` and `WritingFeedback`.
  - Missing arrays normalize to `[]`.
  - Missing strings normalize to safe fallback text.
  - Missing scores normalize to safe fallback scores.
  - Provider diagnostics capture module, provider name, request payload, raw response, parsed JSON, parse error, validation errors, fallback-used status, and timestamp.
  - Debug Panel shows the latest provider diagnostic in a collapsible section while preserving existing debug information.
  - Speaking and Writing feedback pages show a small warning when fallback normalization was used.
- **Handoff docs**: `docs/HANDOFF.md` is now the canonical handoff file; the old Claude-specific handoff filename was removed to avoid duplicate/conflicting guidance.
- **Explicitly unchanged**: Mock Provider remains default, Gemini remains unconnected, no RAG, no pronunciation scoring, no SpeechRecognition behavior changes, no architecture rewrite, Debug Panel and Markdown export remain.

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
