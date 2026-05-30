# Start Work

Use this command only for project re-entry, unclear branch/worktree state, daily-start status checks, or before a larger planning/closeout session.

Do not use this as the default entry point for every small implementation task.

For ordinary scoped IELTS Scholar fixes, use `$ielts-implement` instead.

Do not change code.

## When To Use

Use this command when:

- starting work after a long break;
- the current branch/worktree state is unclear;
- project baseline may have changed;
- the user asks for a status check before work;
- preparing for daily closeout or a larger planning session.

Do not use this command when:

- the task is a small scoped bug fix;
- the user already provided a narrow implementation scope;
- only one or two files are likely involved;
- `$ielts-implement` Scout Mode is enough.

## Step 1 — Read Project Context Selectively

Always read:

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `docs/CODEBASE_MAP.md`

Read these only if relevant to the requested work:

- `docs/PRODUCT_DESIGN_PRINCIPLES.md` for product/UI/feedback behavior;
- `docs/DECISION_LOG.md` for historical rationale or conflict resolution;
- `docs/PROJECT_BACKLOG.md` for future task selection;
- `docs/ROADMAP.md` for horizon planning;
- `docs/HANDOFF_NEXT_CHAT.md` only when the user asks for handoff continuity or the current state is unclear;
- `docs/AGENT_WORKFLOW.md` only when changing agent workflow.

Do not read the full backlog, roadmap, decision log, and handoff automatically for every small task.

## Step 2 — Check Git State

Run:

```bash
git status --short
git branch --show-current
git status -sb
git log --oneline -5
```

Run these only if sync state matters for the user's request:

```bash
git remote -v
git fetch origin
git status -sb
```

## Step 3 — Report Status

Report:

* current branch;
* latest commit;
* working tree status;
* tracked changes;
* untracked files;
* whether local branch appears ahead/behind/diverged when checked;
* whether it is safe to start scoped work;
* whether `$ielts-implement` Scout Mode or Implement Mode should be used next.

## Step 4 — Safety Rules

If the branch is diverged, stop and ask the user.

If the working tree has unrelated changes, stop and ask the user.

If local is behind `origin/main` and the working tree is clean, ask before pulling unless the user already asked to sync.

Do not merge.

Do not push.

Do not modify `.env.local`.

Do not start feature work until the user confirms the task scope.
