# IELTS Scholar Agent Instructions

This repo is IELTS Scholar: Local-First Training Agent.

Before changing code, read:

1. `docs/HANDOFF_NEXT_CHAT.md`
2. `docs/AGENT_WORKFLOW.md`
3. `docs/CURRENT_STATE.md`
4. `docs/DECISION_LOG.md`
5. `docs/PROJECT_BACKLOG.md`

Rules:

- Do not rely on chat memory for project state. Use repo docs and source code.
- Do not start new feature work unless explicitly requested.
- Do not merge or push unless the user asks for daily closeout.
- Before code changes, run the project start checklist from `docs/AGENT_WORKFLOW.md`.
- After each completed slice, run lint/build if code changed, then explain in plain language:
  - what changed
  - which files changed
  - how the user can verify it
- If future work is discussed but not implemented, write it into docs/backlog with the same commit.
- For Writing Task 2 Phase 3 work, do not implement interactive annotation overlay unless explicitly scoped.