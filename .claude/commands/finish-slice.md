# Finish Slice

Run the IELTS Scholar small-slice completion checklist.

Do not push.

## Step 1 — Verify Code

If code changed, run:

```bash
npm run lint
npm run build
```

If only documentation changed, say that lint/build were not required and explain why.

## Step 2 — Check Git State

Run:

```bash
git status --short
git diff --stat
```

Also check whether sensitive files are changed or staged:

- `.env`
- `.env.local`
- API key files
- local provider key files
- token files

If sensitive files are changed or staged, stop and warn the user.

## Step 3 — Report Result

Report in plain language:

- what changed
- which files changed
- why the change was made
- lint result
- build result
- how the user can verify the result
- what was intentionally not changed
- whether docs/backlog were updated
- whether commit/push was done

## Step 4 — Commit Rule

Committing is allowed only if:

- the user’s current workflow allows commits
- changes are clearly related to the completed task
- lint/build pass when code changed
- no sensitive files are staged

Before committing, show the planned commit message.

Do not push unless this is daily closeout or the user explicitly requests push.

Never force push.