# Current State (V1)

_Last updated: 2026-05-08_

## Product Baseline
- Mock Provider remains the default provider.
- Optional Gemini Provider path is implemented for local development only.
  - Configure with `VITE_AI_PROVIDER=gemini` and `VITE_GEMINI_API_KEY=...`.
  - Missing, unknown, or `mock` provider configuration uses Mock Provider.
  - If Gemini is configured without a key, the app safely falls back to Mock Provider.
  - `VITE_GEMINI_API_KEY` is exposed to browser/client code and is suitable only for local/personal prototype use.
  - No production key management exists yet.
- No RAG pipeline is connected.
- V1 pronunciation is **not formally assessed**.
- V1.1 provider safety scaffolding is implemented:
  - Speaking and Writing provider calls route through safe analysis wrappers.
  - Malformed provider output is normalized into safe feedback objects.
  - Latest provider diagnostic is captured for Debug Panel inspection.

## Speaking Practice (Implemented)
- Speaking Practice now saves local-first practice attempts so Part 1/2/3 work can be recovered after part switching, navigation, or page reload.
- Recent Speaking attempts are accessible from the practice page; opening a saved attempt restores local transcript/feedback without re-calling AI.
- Recent Speaking attempts are filtered by the current part, and individual saved Speaking attempts can be deleted from localStorage.
- Empty Speaking question loads are not saved as noisy draft records; drafts are saved only after meaningful transcript or analysis state exists.
- Speaking question banks now include a small V1 prompt set for practical local testing:
  - Part 1: 11 common topics / 36 questions.
  - Part 2: 12 cue cards.
  - Part 3: 37 follow-up discussion questions.
- Speaking Change Question now avoids returning the same prompt when alternatives exist and does not call AI.
- Speaking users can start **Practice This Question Again** after analysis, preserving the analyzed attempt while opening a fresh attempt for the same question.
- Provider unavailable failures are distinguished from schema/parse fallback; provider-unavailable attempts preserve the transcript and show a retry-later message instead of normal coaching.
- Speaking feedback readability was improved with clearer Must Fix / Optional Polish sections, a wider result layout, a more prominent upgraded answer, and secondary preserved-style context.
- Speaking feedback now supports a distinct **Band 9 Refinement / Examiner-Friendly Refinement** section for strong answers with few or no true errors.
- Speaking markdown export can be locally generated when the provider returns valid core feedback but omits `obsidianMarkdown`; this is shown as a normalized field in diagnostics rather than a full feedback failure.
- `no-speech` auto-retry is implemented and preserved.
- Retry clears current-attempt state (transcript, feedback, timer, attempt refs).
- Stop & Review prevents recognition restart after user stop.
- Pre-analysis view remains focused on prompt, timer, controls, and transcript/review.

## Writing Task 2 Practice (Implemented)
- Writing Task 2 now saves active local-first drafts for Phase 1 notes, final framework, essay draft, and existing analysis result.
- Recent Writing Task 2 attempts are accessible from the practice page; opening a saved attempt restores local state without re-calling AI.
- Provider unavailable failures preserve the draft/framework/essay and show a retry-later message instead of presenting fallback output as successful coaching.
- Phase 1 separates:
  - Coach Discussion (process)
  - Final Framework Summary (output)
- Final Framework Summary remains user-editable.
- Phase 1 includes a mock-safe **Generate Framework Summary** action:
  - Reads current user Coach Discussion / Notes, including unsent draft notes.
  - Uses Mock Provider framework extraction by default.
  - Populates structured sections: Position, View A, View B, My opinion, Paragraph plan, Possible example.
  - Shows calm non-blocking messages for empty input, loading, success, and safe fallback.
  - Captures provider diagnostics for Debug Panel inspection.
- Phase 1 notes input supports Enter-to-send, Shift+Enter for newline, and IME composition protection for Chinese/Japanese/Korean input.
- Phase 2 displays Final Framework Summary before essay writing.
- Phase 3 displays My Essay prominently before feedback; My Framework remains available as secondary planning reference.
- Submit gating is disabled only when `essay.trim().length === 0` (implemented as `!essay.trim()`).
- Writing Task 2 desktop layout now uses a wider workspace for reduced scrolling and better cross-reference:
  - Phase 1 uses side-by-side Coach Discussion / Notes and Final Framework Summary panels.
  - Phase 2 uses side-by-side framework reference and essay editor panels.
  - Phase 3 emphasizes My Essay, Key Corrections, Framework Logic Review, and Model Answer Excerpt; My Framework remains available as secondary planning reference.
- UI readability polish implemented (no logic changes):
  - Slightly larger base body typography and line-height.
  - Slightly larger feedback-card/paper-card spacing and phase-tab readability.
  - Improved line-height/spacing in Final Analysis sections (My Framework, My Essay, Key Corrections, Framework Logic Review, Model Answer Excerpt).

## Export Behavior (Implemented)
- Markdown export is attempt-level in V1.
- Session-level consolidated note export is not implemented yet.

## Practice History (Implemented)
- A lightweight `/practice-history` page lists existing localStorage practice records without starting a new attempt.
- Speaking attempts show part, question, timestamp, transcript preview, and status when available.
- Writing Task 2 attempts show prompt, timestamp, essay/framework preview, and status when available.
- Opening a history item writes it into the existing active practice restore path, then navigates to the matching Practice page without making an AI call.
- Practice History supports deleting individual Speaking and Writing Task 2 attempts from localStorage without affecting unrelated records.
- Writing Task 2 Recent Attempts now supports View, Export, and Delete, and the visible list updates immediately after deletion.
- Writing Task 2 framework UI copy was shortened so the workspace stays focused while textarea placeholders retain useful guidance.
- Empty history sections show “No saved attempts yet.”
- Practice History is linked from Home, TopBar, Speaking, and Writing.
- No cross-attempt analytics, export, database, RAG, auth, server, Mock mode, or provider-default changes were added.

## Progress Snapshot (Implemented)
- Progress is now a local training snapshot based on `ielts_practice_records_v1`, not a mock exam score.
- Speaking and Writing Task 2 estimates use analyzed records with valid scores only; drafts are not counted as score 0.
- Progress shows recent scored Speaking and Writing Task 2 attempts as simple lists instead of a chart.
- Topic coverage is implemented with static IELTS-preparation categories attached to the prompt bank:
  - Speaking: 12 preparation categories.
  - Writing Task 2: 12 preparation categories.
- Progress resolves topic coverage by preferring stored record metadata, matching prompt-bank metadata, then using a small keyword fallback. Unknown topics are not counted as score 0.
- Recommended Next Focus is rule-based and modest: it suggests one under-practiced Speaking category and one under-practiced Writing Task 2 category, and mentions unfinished drafts only when local draft records exist.
- Topic coverage is explicitly presented as IELTS preparation categories, not an official exam syllabus.

## Debug / Provider Safety (Implemented)
- Debug Panel remains globally available.
- Debug Panel now includes a collapsible latest provider diagnostic section showing:
  - module
  - operation
  - provider name
  - request payload
  - raw response
  - parsed JSON
  - parse error
  - validation errors
  - normalized fields, when a non-core field was repaired locally
  - fallback-used status
  - timestamp
- Framework extraction diagnostics are labeled with the `writing_framework_extraction` operation so they are distinguishable from final essay analysis.
- Provider fallback warnings are shown near Speaking and Writing feedback when malformed output was normalized.

## Scope Guards (Current)
- Keep Practice mode and future Mock mode separate.
- Keep UI polish work separate from API connection work.
