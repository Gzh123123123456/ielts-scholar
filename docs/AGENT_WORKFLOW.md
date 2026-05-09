# Agent Workflow — IELTS Scholar

## Project Identity

Project: IELTS Scholar — Local-First Training Agent  
Repo: https://github.com/Gzh123123123456/ielts-scholar  
Local path: `D:\Personal\Desktop\ielts-scholar_-local-first-training-agent`

This is a local-first React + TypeScript + Vite IELTS training app.

## Source of Truth Order

Use this order:

1. Current source code
2. `docs/HANDOFF_NEXT_CHAT.md`
3. `docs/CURRENT_STATE.md`
4. `docs/DECISION_LOG.md`
5. `docs/PROJECT_BACKLOG.md`
6. `docs/ROADMAP.md`
7. Chat messages

Do not rely on old chat memory when repo docs or source code are available.

## Start-of-Work Checklist

Before changing code, run:

```bash
git status --short
git status
git branch --show-current
git remote -v
git fetch origin
git status -sb
git log --oneline -5
```

Then report:

- current branch
- whether working tree is clean
- whether local branch is ahead/behind/diverged from origin
- latest commit
- untracked files

If the branch is diverged, stop and ask the user.

If local is behind origin/main and working tree is clean, use:

```bash
git pull --ff-only origin main
```

Do not merge manually unless explicitly requested.

## Agent Role Boundary

- Claude Code should **not** perform product UI / information architecture patches unless explicitly approved.
- For product / UI design work, first consult `docs/PRODUCT_DESIGN_PRINCIPLES.md`.
- Claude Code may still do documentation, status checks, lint / build verification, and explicitly scoped mechanical edits if later approved.

## Normal Development Rules

- Keep changes small and task-scoped.
- Do not start unrelated feature work.
- Do not change provider routing unless explicitly requested.
- Do not edit `.env.local` or expose API keys.
- Do not add a database, server, auth, RAG, or production key management unless explicitly scoped.
- Preserve the local-first prototype architecture.
- Preserve the warm academic paper UI unless the task is a redesign task.

## Writing Task 2 Phase 3 Rules

Current priority may involve Phase 3 feedback logic.

Allowed in Phase 3 content logic repair:

- Feedback schema / normalization updates
- Provider prompt updates
- Mock provider updates
- Phase 3 rendering updates
- Markdown export alignment
- Docs/backlog updates

Do not implement unless explicitly scoped:

- inline underlines
- solid problem dots
- click overlays
- source-text annotation popovers
- interactive correction mapping UI
- collapsing old correction cards
- new provider routing
- merge or push

## Documentation Rule

If a future idea is discussed but not implemented, record it in one of:

- `docs/PROJECT_BACKLOG.md`
- `docs/ROADMAP.md`
- `docs/DECISION_LOG.md`
- `docs/HANDOFF_NEXT_CHAT.md`

Do not leave important future scope only in chat.

## Completion Checklist for a Small Slice

After code changes, run:

```bash
npm run lint
npm run build
git status --short
git diff --stat
```

Then report in plain language:

- what changed
- which files changed
- whether lint passed
- whether build passed
- how the user can verify the result in the UI
- whether any docs/backlog were updated

Committing is allowed after a completed slice if the user’s current workflow allows it.

Do not push unless it is a daily closeout or the user explicitly requests push.

## Daily Closeout Rules

Only during daily closeout:

1. Run git status checks.
2. Confirm branch.
3. Confirm ahead/behind/diverged state.
4. Run lint.
5. Run build.
6. Confirm `.env.local` and API key files are not staged.
7. Commit clearly related tracked changes.
8. Push only if:
   - working tree is clean
   - lint/build pass
   - local main is ahead of origin/main
   - branch is not diverged
   - user requested closeout

Never force push.

## Final Response Format

For every completed coding task, explain:

1. What changed
2. Why it changed
3. How to verify
4. What was intentionally not changed
5. Whether commit/push was done