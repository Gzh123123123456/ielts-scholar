# Roadmap

_Last updated: 2026-05-24_

This roadmap describes horizons, not implementation history.

## Current Baseline

- Local-first React + TypeScript + Vite IELTS training app.
- Mock Provider default, optional local Gemini and auto/DeepSeek provider modes.
- Speaking, Writing Task 1 Academic, Writing Task 2, History, Progress, question-bank browsing, local records, and attempt-level export are available in the prototype.
- Speaking active mainland May-Aug seasonal bank runtime is integrated through the active adapter with V1 fallback.
- Speaking target-display policy is simplified and current:
  - lower bound below 7.0 -> `BAND 7 TARGET ANSWER`;
  - lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`;
  - high-band-stable -> `STANDARD ANSWER`;
  - no learner-facing higher-band target promise, advanced-target label, validation badge, or validation gate.
- Task 2 annotated essay overlay baseline is implemented.

## Next Product Horizon

Speaking interaction flow should move beyond isolated prompts.

- Part 1 topic-thread practice: one topic, 3-4 short examiner-style questions, one connected mini-conversation, topic-level feedback.
- Part 3 discussion-flow refinement: clustered follow-up questions and discussion-level feedback for spoken reasoning, contrast, examples, consequences, and nuance.
- Part 2 remains single long-turn practice focused on story spine, detail, timing, and sustained fluency.

Explicitly not now: full Speaking mock, session-level Speaking export, pronunciation scoring, or Writing behavior changes.

## Reliability / Data Horizon

- Improve audio transcription reliability while preserving one editable transcript box and manual-edit fallback.
- Build PDF folder import and extraction-report workflow for mainland active-bank updates.
- Prepare SaaS-ready active-bank publishing: admin review/publish later, active seasonal bank overwrite, and saved history preserving question snapshots.
- Preserve stable question IDs, topics/categories, tags, route-state selection, practice counts, History restore, and Progress coverage.

## Writing Calibration Horizon

- Audit Writing Task 2 target/score/feedback consistency separately from Speaking.
- Calibrate Writing Task 1 only with real samples and Debug Panel evidence.
- Preserve the existing Task 2 annotated essay overlay baseline unless a focused polish/consolidation task is selected.

## Later SaaS / Production Horizon

- Server-side provider key management or proxy before non-personal deployment.
- User/account model, auth, database/storage migration, and admin publishing workflow.
- Optional OpenAI-compatible/OpenRouter routing UI after provider architecture settles.
- Optional IndexedDB/local file backup before any storage migration.
- Full mock exam mode after basic practice flows are stable.

## Explicit Not Now

- Do not add RAG.
- Do not add pronunciation scoring.
- Do not replace Mock Provider as default.
- Do not rewrite app architecture.
- Do not implement PDF import, SaaS bank publishing, Writing audits, Part 1 topic-thread flow, or Part 3 discussion flow unless explicitly scoped.
