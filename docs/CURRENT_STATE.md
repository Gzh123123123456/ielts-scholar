# Current State (V1)

_Last updated: 2026-05-06_

## Product Baseline
- Mock Provider remains the default provider.
- No Gemini/API provider is connected yet.
- No RAG pipeline is connected.
- V1 pronunciation is **not formally assessed**.

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

## Export Behavior (Implemented)
- Markdown export is attempt-level in V1.
- Session-level consolidated note export is not implemented yet.

## Scope Guards (Current)
- Keep Practice mode and future Mock mode separate.
- Keep UI polish work separate from API connection work.
