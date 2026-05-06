# Current State (V1)

_Last updated: 2026-05-06_

## Product Baseline
- Mock Provider remains the default provider.
- No Gemini/API provider is connected yet.
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
- Final Framework Summary is manually user-edited in V1.
- Phase 2 displays Final Framework Summary before essay writing.
- Phase 3 displays My Framework and My Essay before AI feedback.
- Submit gating is disabled only when `essay.trim().length === 0` (implemented as `!essay.trim()`).
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
  - provider name
  - request payload
  - raw response
  - parsed JSON
  - parse error
  - validation errors
  - fallback-used status
  - timestamp
- Provider fallback warnings are shown near Speaking and Writing feedback when malformed output was normalized.

## Scope Guards (Current)
- Keep Practice mode and future Mock mode separate.
- Keep UI polish work separate from API connection work.
