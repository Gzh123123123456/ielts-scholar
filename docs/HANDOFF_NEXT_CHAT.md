# Handoff For Next Chat

_Last updated: 2026-05-24_

## Project

IELTS Scholar - Local-First Training Agent

Repo: `https://github.com/Gzh123123123456/ielts-scholar`

Local path: `D:\Personal\Desktop\ielts-scholar_-local-first-training-agent`

## Stable Checkpoint

Stable pushed checkpoint: `11614c3 Complete Speaking runtime and feedback stabilization`.

Git commands, not this document, determine the current branch and sync state.

## Current Product Status

- Speaking active mainland May-Aug seasonal bank runtime is integrated through the active adapter with V1 fallback.
- Speaking has one editable transcript box plus an audio-backed transcription path; audio transcription reliability remains limited and fallback-prone.
- Normal Speaking provider output is structured feedback only; markdown/export is generated locally after successful parsing.
- Writing Task 2 basic practice and annotated essay overlay baseline are implemented, but Writing target/score/feedback consistency still needs a future audit.
- Writing Task 1 Academic basic practice is implemented; calibration remains future work requiring real samples.
- History, Progress, question-bank browsing, active attempts, and localStorage records are available in the local-first prototype.
- Workflow/docs/skills simplification is completed as the current workflow baseline.

## Non-Negotiable Current Product Rules

- Speaking target headings:
  - lower bound below 7.0 -> `BAND 7 TARGET ANSWER`;
  - lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`;
  - high-band-stable -> `STANDARD ANSWER`.
- Normal Speaking flow has no learner-facing higher-band target promise, advanced-target label, validation badge, or validation gate.
- A valid adjacent half-band Speaking range may be shown from one ordinary analysis pass.
- Normal successful Speaking targets use neutral `generated_target` diagnostics.
- Low/mid-band Speaking feedback should remain meaningful and layered where transcript evidence supports it.
- User samples, screenshots, transcripts, and Debug Panel output are regression evidence, not production content. Fix shared logic and do not hardcode the sample.
- Never claim Writing is fixed by a Speaking-only change.

## Next Priority Sequence

1. Speaking Part 1 topic-thread flow is the next immediate product priority.
2. Speaking Part 3 discussion-flow refinement follows next.
3. Audio transcription reliability.
4. PDF folder import + mainland active-bank publishing + SaaS-ready bank layer.
5. Writing Task 2 target/score/feedback consistency audit.
6. Writing Task 1 calibration with real samples.

## Minimal Reading Rule

For a new context, read:

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `docs/CODEBASE_MAP.md`
4. `docs/PRODUCT_DESIGN_PRINCIPLES.md` only when product/UI/feedback behavior is involved

Read `docs/PROJECT_BACKLOG.md`, `docs/ROADMAP.md`, and `docs/DECISION_LOG.md` only as needed.

## Workflow Simplification

- Ordinary implementation uses `$ielts-implement`.
- Explicit daily closeout uses `$ielts-closeout`.
- Do not use closeout behavior during ordinary implementation.
