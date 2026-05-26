# Current State

_Last updated: 2026-05-26_

This is the active baseline, not a history log. Verify branch and sync state with git commands before work.

## Current Validated Baseline

- Stable pushed checkpoint before this closeout: `ecb7de4 Simplify workflow docs and add Codex skills`.
- Workflow/docs/skills simplification is completed as the current workflow baseline.
- Codex is the primary implementation agent for scoped product work.
- Claude Code is an optional docs/status/lint/build helper unless explicitly approved for more.
- The app is a local-first React + TypeScript + Vite prototype.
- Mock Provider remains the default. Optional Gemini and auto/DeepSeek local provider modes exist for personal development only.
- Browser/client API keys are not production-safe; no SaaS provider/key architecture exists yet.
- Task 2 annotated essay overlay baseline is implemented; future work should be polish/consolidation unless explicitly scoped.
- Writing Task 2 basic practice, framework coach/extraction, local-first records, feedback rendering, and export are implemented, but target/score/feedback consistency still needs a separate future audit.
- Writing Task 1 Academic basic practice is implemented with text-based visual briefs; full calibration remains future work and requires real samples.
- Question-bank browsing, History, Progress, active attempts, and localStorage records are implemented for the current local-first prototype.

## Current Speaking Rules

- Speaking uses the 2026 May-Aug mainland seasonal active bank through the active adapter, with V1 arrays preserved as fallback.
- Part 3 discussion questions are derived from mainland Part 2 follow-ups in the current seasonal data shape.
- Speaking has one editable transcript box for analysis plus an audio-backed transcription path.
- Audio transcription reliability remains limited and fallback-prone; manual transcript editing remains the safe path.
- Normal Speaking provider output is structured feedback only.
- Speaking markdown/export is generated locally after successful parsing.
- Speaking current answer display may show one conservative single-question estimate or a valid adjacent half-band range from one ordinary analysis pass.
- Speaking target headings:
  - lower bound below 7.0 -> `BAND 7 TARGET ANSWER`;
  - lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`;
  - high-band-stable -> `STANDARD ANSWER`.
- Normal Speaking learner flow does not use learner-facing higher-band target promises, advanced-target labels, validation badges, validation-failure states, or raw provider method errors.
- Normal successful Speaking targets use neutral `generated_target` diagnostics.
- Low/mid-band substantial Speaking answers should preserve meaningful MUST FIX, HIGH-IMPACT PHRASE FIXES, and PERSONAL MATERIAL & IDEA EXPANSION where supported by the transcript.
- Speaking Part 1 topic-thread practice is implemented as a development checkpoint: one-topic natural 3-4 question sets, multiple coherent thread sets for larger topics, and traceable product-supplement questions where the source topic is incomplete.
- Part 1 results are organized around annotated original answers, one cleaner retry answer per question, thread-level patterns, Material Bank, and a Next Retry Plan.
- Part 1 clean-retry integrity checks, saved-result safeguards, annotation de-duplication, transcript-spelling/pronunciation boundary tightening, audio-transcript candidate gating, exact-thread retry, coverage-aware/fair topic selection, and topic-thread markdown/export refinements are implemented.
- The newest Part 1 runtime/export behavior is a pushed development checkpoint, not yet final browser-accepted behavior.
- Part 3 discussion-flow refinement remains upcoming product work.

## Known Active Limitations

- Audio transcription can fail or fall back; browser Web Speech remains limited. New low-signal audio transcript candidate gating is implemented but still needs post-reinstall browser validation.
- Pronunciation is not formally scored.
- Provider keys in Vite/browser env are local-personal prototype only and not SaaS-safe.
- Persistence is localStorage only.
- No production server/auth/database/RAG/provider-key architecture exists.
- PDF folder import, mainland active-bank publishing, and SaaS-ready bank administration remain future work.
- Writing Task 2 target/score/feedback consistency needs a separate audit.
- Writing Task 1 calibration remains future scoped work and needs real samples.

## Next Priorities

1. Post-reinstall manual browser validation of the Part 1 checkpoint: blank/low-signal recording candidate adoption, exact-thread retry, fair random/change-topic selection, real-provider stance/tense/annotation/export behavior.
2. If validation passes, mark the Part 1 checkpoint browser-accepted; if not, open a small follow-up fix.
3. Speaking Part 3 discussion-flow refinement follows next.
4. Audio transcription reliability.
5. PDF folder import + mainland active-bank publishing + SaaS-ready bank layer.
6. Writing Task 2 target/score/feedback consistency audit.
7. Writing Task 1 calibration with real samples.

## Navigation Pointers

- Use `docs/CODEBASE_MAP.md` to find files.
- Use `docs/PRODUCT_DESIGN_PRINCIPLES.md` for durable product principles.
- Use `docs/PROJECT_BACKLOG.md` and `docs/ROADMAP.md` only when planning future work.
- Use `docs/DECISION_LOG.md` only for historical decisions and rationale; superseded entries are not current instructions.
