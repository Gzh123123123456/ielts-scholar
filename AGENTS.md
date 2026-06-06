# AGENTS.md

IELTS Scholar is a local-first IELTS training app. Do not rely on old chat memory.

## Source Of Truth

Use this order:

1. Actual runtime evidence, Debug Panel output, and current source code.
2. `docs/CURRENT_STATE.md` for the active product baseline.
3. `docs/CODEBASE_MAP.md` for file navigation.
4. `docs/PRODUCT_DESIGN_PRINCIPLES.md` for durable product/UI/feedback principles.
5. `docs/PROJECT_BACKLOG.md` and `docs/ROADMAP.md` only when selecting or planning future work.
6. `docs/DECISION_LOG.md` only for historical rationale; superseded entries are not current instructions.

Product runtime evidence and source code override stale documentation.

## Permanent Safety Rules

- Keep changes scoped and verifiable.
- Do not merge or push unless the user explicitly requests daily closeout.
- Never expose or commit `.env.local`, API keys, local audit artifacts, or personal practice notes.
- Do not start unrelated feature work.

## Regression Evidence Must Generalize

- A reported example is regression evidence, not production content.
- Fix shared runtime, provider, rendering, or workflow logic; never hardcode the sample, exact answer, topic, or phrases.
- Use the original sample as a regression check.
- Verify an unrelated affected case where practical.

## Skill Routing

- For an approved ordinary implementation or fix slice, use `$ielts-implement`.
- For an explicitly requested daily closeout, use `$ielts-closeout`.
- Do not use closeout behavior during ordinary implementation.
## Work Mode

Before implementation, choose one mode:

1. Scout mode
   - Read-only.
   - Use when the task is ambiguous, risky, or architecture-sensitive.
   - Output: likely files, current behavior, options, risks, and recommended next step.
   - Do not edit files.

2. Implement mode
   - Use only after the scope is clear.
   - Read relevant docs and the smallest relevant source path.
   - Make a small, testable diff.
   - Run verification.

3. Review mode
   - Use after another agent or earlier session changed code.
   - Compare the diff against source of truth, product rules, and runtime evidence.
   - Output MUST FIX / SHOULD FIX / OPTIONAL only.

4. Goal mode
   - Use only for work bigger than one prompt but smaller than an open backlog.
   - Define objective, non-goals, checkpoints, validation commands, and stop conditions.
   - Pause at checkpoints if the next step changes product behavior or architecture.

## Source Reading Budget

- Start with docs/CODEBASE_MAP.md and targeted search.
- Read entry points and directly affected files first.
- Avoid full-repo reading unless there is no reliable narrower path.
- If more than 8 files seem necessary before any edit, stop and explain why.

## Disagreement Protocol

When there is uncertainty:
- State the disputed point.
- State the evidence from code/docs/runtime.
- Give 2鈥? options in plain language.
- Recommend one option.
- Ask the user to decide only if the decision is product-level, destructive, or cannot be proven from source.

## Token Budget

- Do not paste large unchanged code.
- Do not summarize old project history unless it changes the current decision.
- Prefer file paths and concise findings.
- Use existing project docs as references, not as text to repeat.
## Work Modes

Before starting, choose one mode and state it briefly.

### Scout mode

Use when the task is ambiguous, risky, architecture-sensitive, or based on screenshots/runtime symptoms.

- Read-only.
- Inspect docs and the smallest relevant source path.
- Output affected files, current behavior, possible causes, options, risks, and recommended next step.
- Do not edit files.

### Implement mode

Use only when the scope is clear.

- Read the relevant source and docs first.
- Make one small, reversible diff.
- Run available verification.
- Report files changed, behavior changed, checks run, and risks.

### Review mode

Use after Codex, Claude, or another session changed files.

- Compare the diff against current source, AGENTS.md, CURRENT_STATE.md, CODEBASE_MAP.md, and PRODUCT_DESIGN_PRINCIPLES.md.
- Classify findings as MUST FIX / SHOULD FIX / OPTIONAL.
- Do not rewrite the implementation unless explicitly asked.

### Goal mode

Use only for work larger than one prompt but smaller than an open-ended backlog.

- Define objective, non-goals, checkpoints, validation commands, and stop conditions.
- Pause before broad architecture changes, product behavior changes, deletion, storage migration, or Git operations.
