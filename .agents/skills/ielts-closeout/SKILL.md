---
name: ielts-closeout
description: Minimal IELTS Scholar workflow for explicit daily closeout, validation, commit, and push.
---

# IELTS Closeout

Use this skill only after the user explicitly requests daily closeout.

## Workflow

1. Confirm the user explicitly requested closeout.
2. Inspect the full accumulated worktree, not only the latest slice.
3. Run full git safety checks:
   - current branch;
   - origin sync / ahead-behind / divergence;
   - tracked and untracked files;
   - secrets, temp files, audit artifacts, and unrelated helpers.
4. Decide whether merge is actually necessary:
   - if work is already on `main`, do not manufacture a merge;
   - if a completed feature branch exists, merge only if safe and explicitly within the closeout.
5. Sync only necessary current-state documentation after validated product work.
6. Do not begin new features or workflow redesign during product closeout unless explicitly scoped.
7. Run lint/build before commit/push when code or product state changed.
8. Stage only intended files. Exclude `.env.local`, API keys, audit zips, temporary diagnostics, personal notes, and unrelated helpers.
9. Commit and push only if safe and within the explicit closeout authorization.
10. Never force push.

## Final Report

Include:

- branch/sync state;
- whether merge was needed;
- committed files grouped by purpose;
- files intentionally excluded;
- secret/temp safety;
- lint/build results;
- commit/push result;
- next task.
