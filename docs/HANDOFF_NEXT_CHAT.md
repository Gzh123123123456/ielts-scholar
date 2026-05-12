# Handoff for Next Chat

_Last updated: 2026-05-12 (final Speaking note standard)_

## Repo

https://github.com/Gzh123123123456/ielts-scholar

## Local Path

`D:\Personal\Desktop\ielts-scholar_-local-first-training-agent`

## Current Branch

`main`

## Current Development Environment

Primary temporary environment: local Claude Code.

Claude Code currently uses a DeepSeek Anthropic-compatible endpoint, mapped to `deepseek-v4-pro[1m]`.

Codex may resume later. GitHub is the shared sync point between local Claude Code and Codex.

## Recent Events

- **2026-05-12**: Final unified IELTS Speaking note standard created (`docs/IELTS_SPEAKING_NOTE_STANDARD.md`).
  - Single standard for all session sizes (single question / mini session / topic session) and all Speaking parts (Part 1 / 2 / 3).
  - Manual VSCode Claude training and future product export use the same standard.
  - Two slash commands: `/ielts-session` and `/ielts-export`.
  - Personal practice notes under `notes/ielts/` are gitignored and must not be pushed/merged.
- **2026-05-12**: Speaking seasonal question bank data scaffolding completed (two passes).
  - Pass 1: Created `src/data/speaking/` folder with types, 2026 May-August bank data, V1 re-export, and priority index.
  - Pass 2 (completeness): Filled evergreen Part 1 (5 topics) and mainland reused Part 2&3 (26 topics) from `docs/source_materials/speaking/ielts-speaking-bank-2026-05-to-08.extracted.md`.
  - This is data-layer preparation only; runtime selection integration is deferred.
  - Existing `src/data/questions/bank.ts` preserved unchanged.
- A Claude Code patch attempted to redesign Writing Task 2 Phase 3 Vocabulary & Expression Upgrade.
- **That patch has been reverted and must NOT be treated as accepted design direction.**
- Do not continue from the rejected Claude patch.

## Current Priority

Writing Task 2 Phase 3 product information architecture / content logic repair.

This is **not** new feature expansion. The goal is to make the actual implementation match documented Phase 3 feedback logic and product design principles.

## Agent Role Boundaries

### Claude Code — current scope only

- Documentation updates
- Git status checks
- Lint / build verification if requested
- **No** product UI / information architecture implementation
- **No** "small UI fix" unless explicitly approved

### Codex — future scope

- Main UI / product implementation
- Phase 3 product information architecture repair
- React implementation based on documented product principles

## Before Product/UI Work

Read these documents (in order):

1. `docs/HANDOFF_NEXT_CHAT.md` (this file)
2. `docs/PRODUCT_DESIGN_PRINCIPLES.md` — long-term product design source of truth
3. `docs/PROJECT_BACKLOG.md` — future task tree
4. `docs/AGENT_WORKFLOW.md` — agent workflow and rules

## Accepted Product Direction

### Low-noise UI

- Prefer structure over explanation.
- Do not use long module-level explanatory text when layout, grouping, labels, and hierarchy can communicate the purpose.
- The rejected example: "Expression bank for this essay — for revision and future reuse, not another correction list."

### Vocabulary Section

Four confirmed groups:

- `Topic Vocabulary`
- `From Your Essay`
- `Collocations`
- `Argument Frames`

Vocabulary is a reusable expression takeaway, not a second sentence correction list.
`From Your Essay` must be phrase-level.
Normal relevant input should not produce an empty vocabulary section.

### Empty State Rules

Only for inputs that are:

- not even one related complete sentence
- irrelevant
- meaningless
- a technical / provider / parser failure

### Language

- Chinese for guidance, strategy, reasoning, explanations.
- English for prompts, output, expressions, frames, excerpts, vocabulary.

### Progress

- May include reference band estimates and table-like summaries.
- Do not over-warn users that estimates are unofficial. Present estimates calmly as training references.

### Future Provider Direction

- May support user-provided API keys before entering the app.

## V1.3 Step 2 — Interactive Annotated Essay Overlay

- **Remains future work**, not the immediate next implementation task.
- Documented in backlog/roadmap only.

## Development Rules

- Do not rely on old chat memory. Use repo docs and source code.
- Before code changes, read `docs/AGENT_WORKFLOW.md`.
- Keep changes small and task-scoped.
- Do not merge or push unless this is daily closeout.
- Do not implement V1.3 Step 2 interactive annotation unless explicitly scoped.
- Do not edit `.env.local`.
