# Handoff for Next Chat

_Last updated: 2026-05-13 (daily closeout)_

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

- **2026-05-13**: Speaking note standard finalized and handed off.
  - `docs/IELTS_SPEAKING_NOTE_STANDARD.md` is the final unified standard. Do not create new versions.
  - Standard adapts by session size: Single Question (1 Q, no P0/P1/P2), Mini Session (2–4 Q, no P0/P1/P2), Topic Session (5+ Q, with P0/P1/P2).
  - Part 1 single-question practice includes Conversation Thread follow-ups.
  - Part 2 includes Story Spine and long-turn retry. Part 3 includes Discussion Path and nuance training.
  - Manual VSCode Claude training and future product export use the same standard. Only Source metadata differs.
  - `/ielts-session` and `/ielts-export` updated for final handoff.
  - Three local validation notes under `notes/ielts/speaking/final/` (Work, Accommodation, Hometown). Must not be committed/pushed.
- **2026-05-12**: Final unified IELTS Speaking note standard created (`docs/IELTS_SPEAKING_NOTE_STANDARD.md`).
- **2026-05-12**: Speaking seasonal question bank data scaffolding completed (two passes).
  - Pass 1: Created `src/data/speaking/` folder with types, 2026 May-August bank data, V1 re-export, and priority index.
  - Pass 2 (completeness): Filled evergreen Part 1 (5 topics) and mainland reused Part 2&3 (26 topics) from `docs/source_materials/speaking/ielts-speaking-bank-2026-05-to-08.extracted.md`.
  - This is data-layer preparation only; runtime selection integration is deferred.
  - Existing `src/data/questions/bank.ts` preserved unchanged.
- A Claude Code patch attempted to redesign Writing Task 2 Phase 3 Vocabulary & Expression Upgrade.
- **That patch has been reverted and must NOT be treated as accepted design direction.**
- Do not continue from the rejected Claude patch.
- **2026-05-13**: Codex completed the accepted Writing Task 2 Phase 3 learner-facing feedback repair.
  - Phase 3 order now follows: My Essay -> Essay-level Warnings -> Vocabulary & Expression Upgrade -> Logic & Structure Review -> Sentence Corrections -> Target Model Excerpt / Revision Mission.
  - UI, provider prompt constraints, normalization, Mock Provider output, and markdown export are aligned to Chinese-first transferable feedback.
- **2026-05-13**: Codex completed Writing Task 2 Phase 3 visual semantics + analysis lifecycle polish.
  - Phase 3 is now a lower-noise revision workspace: Language Bank, Logic Review, Sentence Corrections, and Target Model Answer each have clearer jobs.
  - Language Bank was split/cleaned into Topic Vocabulary and Expression Upgrade. Topic Vocabulary must remain topic-specific and must not become writing strategy. Expression Upgrade should focus on phrase/frame upgrades and avoid repeated generic explanations.
  - Production logic remains topic-agnostic. Remote-work vocabulary and examples are mock/demo fixture data only, not hardcoded product logic.
  - Submit for Analysis now preserves the submitted essay snapshot and locks the Phase 2 editor while analysis is running. Phase 3 should use `feedback.essay` / submitted snapshot, not mutable live editor text.
  - Run-id protection ignores stale provider responses. Stop/timeout/failure preserve essay text, avoid fake feedback, and do not move to Phase 3.
  - Same-question rewrite / Practice this question again is available from Phase 3. New Question should choose a different prompt when alternatives exist.
  - Target Model Excerpt / Revision Mission was reworked into Target Model Answer. It should be a full training target answer, about 280-350 words, preserving the learner position, fixing the highest-priority Logic Review issue, and integrating Language Bank / Expression Upgrade / key corrections. It is not an official IELTS guarantee.
  - Sentence Correction cards are lower-noise and use grey/problem or strikethrough-style source marking. They must not use Target Model Answer learning-highlight styling. Phrase-level issues should mark only the exact problematic phrase when possible.
  - Preserve `sourceQuote`, `severity`, `issueType`, and `microUpgrades` for future annotation work.

## Current Priority

Writing Task 2 Phase 3 product information architecture / content logic repair and visual semantics polish are complete.

Next planned product task: Annotated Essay interaction / My Essay annotation. Do not start it unless explicitly scoped in a future prompt.

Goal for the next task: integrate Sentence Corrections into My Essay source text. Likely behavior: underline/problem-mark exact source spans; click or hover opens a correction overlay; overlay shows original issue, correction, Chinese explanation, and related Language Bank / Logic Review.

Known small follow-up before or during that work: Target Model Answer highlight explanation exists but is too easy to miss. Move it closer to the model answer body later and use a small low-noise `高亮说明` label. Do not add a large legend/table or many colors.

## Agent Role Boundaries

### Claude Code — current scope only

- Documentation updates
- Git status checks
- Lint / build verification if requested
- **No** product UI / information architecture implementation
- **No** "small UI fix" unless explicitly approved

### Codex — future scope

- Main UI / product implementation
- Product implementation and future annotated essay interaction
- React implementation based on documented product principles

GitHub remains the sync point between Claude Code, Codex, and future ChatGPT sessions. Merge/push should happen only during daily closeout or when explicitly approved. Future implementation prompts should include plain-language verification steps.

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

- **Next planned product task**, but not started in the 2026-05-13 closeout.
- Documented in backlog/roadmap only.

## Development Rules

- Do not rely on old chat memory. Use repo docs and source code.
- Before code changes, read `docs/AGENT_WORKFLOW.md`.
- Keep changes small and task-scoped.
- Do not merge or push unless this is daily closeout.
- Do not implement V1.3 Step 2 interactive annotation unless explicitly scoped.
- Do not edit `.env.local`.
