---
name: ielts-implement
description: Minimal IELTS Scholar workflow for ordinary scoped implementation or bug-fix slices.
---

# IELTS Implement

Use this skill for ordinary scoped IELTS Scholar implementation or bug-fix work.

## Workflow

1. Treat the user's short task statement as the scope.
2. Read `AGENTS.md` automatically, then only the files/docs needed for the requested task.
   - Do not read the full handoff, backlog, roadmap, and decision history for every small fix.
3. Run minimal preflight:
   - `git status --short`
   - `git branch --show-current`
   - `git status -sb`
   - fetch/check remote state if the task may be committed later or branch safety matters.
4. Stop if the branch is diverged or unrelated tracked changes make the task unsafe.
5. Keep implementation narrow and task-scoped.
6. Enforce the generalization rule:
   - sample evidence is not production content;
   - fix shared logic;
   - do not hardcode the example;
   - verify the original regression and at least one unrelated affected scenario where practical.
7. Do not claim untested modules are fixed.
8. Do not edit durable docs during ordinary product work unless:
   - the user explicitly asks; or
   - a confirmed durable rule/current-state fact would otherwise become false.
   Otherwise, report suggested doc updates for closeout.
9. After code changes, run:
   - `npm run lint`
   - `npm run build`
10. Report:
   - changed files;
   - what changed;
   - what was intentionally not changed;
   - plain-language user verification.
11. Do not commit, merge, or push unless the user explicitly changes scope to closeout.

Rely on `AGENTS.md`, current source/runtime evidence, and relevant current docs for product rules. Do not copy full Speaking rules into this skill.
