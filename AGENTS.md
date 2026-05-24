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
