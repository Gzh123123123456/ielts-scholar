---
name: ielts-implement
description: IELTS Scholar workflow for scoped implementation, bug fixes, read-only scouting, review passes, and bounded goal-mode work.
---

# IELTS Implement

Use this skill for ordinary scoped IELTS Scholar work.

This skill exists to reduce long repeated prompts. The user should not need to restate the same preflight, safety, file-scope, Part 1 invariants, validation, and final-report rules in every task.

Do not use this skill for explicit daily closeout. Use `$ielts-closeout` only when the user explicitly requests closeout, commit, merge, or push.

## Core Rule

Treat the user's short task statement as the current scope.

Use `AGENTS.md`, current source/runtime evidence, and the smallest relevant project docs/source files. Do not rely on old chat memory. Do not read the full handoff, backlog, roadmap, and decision history for every small fix.


## Decision Discipline

Use these rules before choosing Scout, Implement, Review, or Goal Mode.

1. Do not assume the user knows exactly what they want.
   - If motivation, target state, or desired product behavior is unclear, pause before implementation.
   - Ask for the missing decision in plain language.
   - Do not turn vague dissatisfaction or a screenshot into a code task without identifying the product goal.

2. If the user has a clear goal but the requested route is not the shortest safe route, say so.
   - Recommend the better route.
   - Explain briefly why it reduces diff size, user testing burden, runtime risk, or rework.

3. Root cause first.
   - Every implementation decision must answer: “why is this the right layer to change?”
   - Do not add local guards, blacklists, or one-sample patches when the issue belongs in shared provider/safety/display/export logic.
   - If the root cause is unknown, choose Scout or Review Mode and stop before edits.

4. Say only what changes the next decision.
   - Final reports should be compact and tied to acceptance, verification, rollback, or the next task.
   - Do not repeat project history, old chat context, or unchanged boilerplate unless it changes the current decision.
## Choose One Work Mode First

At the start, state the chosen mode briefly.

### Scout Mode

Use when the task is ambiguous, risky, based on screenshots/runtime symptoms, architecture-sensitive, or likely to affect storage/provider/scoring/history.

Rules:
- Read-only.
- Do not edit files.
- Inspect only the smallest relevant docs/source path.
- Output:
  - affected files likely involved;
  - current behavior;
  - likely cause or competing hypotheses;
  - implementation options;
  - recommended option;
  - verification plan;
  - what needs the user's decision.

### Implement Mode

Use when the scope is clear.

Rules:
- Read relevant source/docs first.
- Make one small, reversible diff.
- Keep changes task-scoped.
- Do not start unrelated cleanup or feature work.
- Run required verification after code changes.

### Review Mode

Use after Codex, Claude, or another session changed files.

Rules:
- Do not rewrite the implementation unless explicitly asked.
- Compare the diff against:
  - current source;
  - `AGENTS.md`;
  - `docs/CURRENT_STATE.md`;
  - `docs/CODEBASE_MAP.md`;
  - `docs/PRODUCT_DESIGN_PRINCIPLES.md`;
  - runtime/debug evidence when provided.
- Classify findings as:
  - MUST FIX;
  - SHOULD FIX;
  - OPTIONAL.
- Focus on correctness, scope, regression risk, and whether the fix generalized beyond the reported sample.

### Goal Mode

Use only for work larger than one prompt but smaller than an open-ended backlog.

Before editing, define:
- objective;
- non-goals;
- checkpoints;
- files likely to be touched;
- validation commands;
- stop conditions.

Pause before:
- broad architecture changes;
- storage/migration/backup changes;
- provider prompt/schema/scoring changes;
- product information-architecture changes;
- deletion or broad file moves;
- Git operations.

## Source Reading Budget

Start with targeted navigation, not full-repo reading.

Preferred order:
1. `AGENTS.md`.
2. `docs/CODEBASE_MAP.md` for file navigation.
3. `docs/CURRENT_STATE.md` only if current baseline matters.
4. `docs/PRODUCT_DESIGN_PRINCIPLES.md` only for product/UI/feedback behavior.
5. Directly affected source files.

Avoid reading these for every small task:
- full handoff docs;
- full backlog;
- full roadmap;
- full decision log;
- old chat summaries.

If more than 8 files seem necessary before any edit, pause and explain:
- why the task cannot be narrowed yet;
- which files are essential;
- whether Scout Mode should continue.

## Minimal Git Preflight

For ordinary implementation, run only:

```bash
git status --short
git branch --show-current
git status -sb
```

Run remote/ahead-behind checks only when commit/branch safety matters or the user asks for closeout.

Stop and ask the user if:

* branch is diverged;
* unrelated tracked changes make the task unsafe;
* the requested work would overwrite or conflict with existing dirty work.

Do not reset, stash, clean, revert, merge, commit, or push unless explicitly asked.

## Dirty Worktree Safety

Before editing:

* identify files likely to be touched;
* check whether they already have unrelated changes;
* preserve unrelated user/agent work;
* avoid formatting or rewriting unrelated sections.

If the dirty state is unclear, pause and ask.

## Decision Gate

Pause and explain options in plain language when the task touches:

* storage, IndexedDB, localStorage, migration, backups, restore, or data recovery;
* provider routing, provider prompts, schemas, parsing, safety normalization, or scoring;
* visible IELTS target policy or score interpretation;
* saved history, export, or restore behavior;
* broad UI/product information architecture;
* secrets, `.env`, API keys, or local credentials;
* deletion, large file moves, or Git history;
* more than one viable implementation route with product consequences.

Do not guess the product decision.

## Regression Evidence Must Generalize

User-provided screenshots, transcripts, answers, topics, and debug logs are regression evidence, not production content.

Rules:

* Fix shared runtime/provider/rendering/workflow logic.
* Do not hardcode the reported topic, exact phrase, or sample answer.
* Verify the reported case and at least one unrelated affected case where practical.
* Do not claim untested modules are fixed.

## IELTS Speaking Part 1 Validation Matrix

Use this compact matrix only when the task affects Part 1 topic-thread behavior, analysis, result rendering, retry, export, history, or material extraction.

Check relevant items only:

### Thread/session integrity

* Natural 3–4 question topic thread remains intact.
* Three-question source topics are not padded unless genuinely incomplete.
* Incomplete source topics use traceable product-supplement questions.
* Retry keeps the exact thread when expected.

### Annotated answers

* Each locked answer appears in the result.
* Local issues are anchored to the original answer where possible.
* Annotation labels do not duplicate severity/type text.
* Probable ASR/transcript artifacts are not treated as learner language errors.

### Cleaner retry answers

* Each question has a cleaner answer where useful.
* Cleaner answer preserves the learner's confirmed meaning and real personal material.
* It repairs important language problems without becoming a full band-labeled target module.
* It does not invent uncertain names, facts, breeds, places, or personal details.

### Material Bank

* Stores useful, concrete reusable material.
* Does not store generic stance, weak reasoning, or corrupted transcript fragments.
* Does not overclaim broad cultural facts from personal observation unless framed as impression.

### Content/task alignment

* Opinion/generalization questions distinguish personal impression from unsupported broad claims.
* Content-development notes appear near the relevant answer when answer-specific.

### Completion state

* Genuine language errors prioritize corrected retry.
* System-generated cleaner-answer conflicts are not blamed on the learner.
* Accurate but too-thin answers should surface development need rather than endless error retry.
* Fully stable threads can encourage changing topic.

### History/export

* Saved results restore detailed feedback, annotations, cleaner answers, and material where expected.
* Markdown/export labels match the current UI policy.
* Storage writes do not silently fail.

## Verification

If app code changed, run:

```bash
npm run lint
npm run build
```

If only markdown/docs/config workflow files changed, do not run npm. Say that app verification was not required because no app code changed.

For risky behavior, also provide manual browser verification steps in plain language.

## Documentation Rule

Do not edit durable docs during ordinary implementation unless:

* the user explicitly asks; or
* a confirmed durable current-state fact would otherwise become false.

Otherwise, list suggested doc updates for closeout.

## Final Report

Always finish with:

* Mode used;
* files changed;
* what changed in plain language;
* what was intentionally not changed;
* checks run;
* how the user can verify;
* risks / unverified assumptions;
* whether docs/commit/push were intentionally skipped.

Do not commit, merge, or push unless the user explicitly changes scope to closeout.
