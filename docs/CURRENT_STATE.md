# Current State (V1)

_Last updated: 2026-05-07_

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
- `no-speech` auto-retry is implemented and preserved.
- Retry clears current-attempt state (transcript, feedback, timer, attempt refs).
- Stop & Review prevents recognition restart after user stop.
- Pre-analysis view remains focused on prompt, timer, controls, and transcript/review.

## Writing Task 2 Practice (Implemented)
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
  - fallback-used status
  - timestamp
- Framework extraction diagnostics are labeled with the `writing_framework_extraction` operation so they are distinguishable from final essay analysis.
- Provider fallback warnings are shown near Speaking and Writing feedback when malformed output was normalized.

## Scope Guards (Current)
- Keep Practice mode and future Mock mode separate.
- Keep UI polish work separate from API connection work.
