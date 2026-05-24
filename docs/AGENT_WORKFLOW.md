# Agent Workflow - IELTS Scholar

## Purpose

This workflow reduces prompt length and user burden. The user should not need to manage complex thread strategy, document selection, git rituals, or repeated safety boilerplate.

## Mode 1: Ordinary Implementation Slice

Use this for scoped product or bug-fix work.

1. The user describes the task and may include screenshots, transcript text, Debug Panel output, or runtime observations.
2. ChatGPT turns that into a short scoped task with:
   - Task
   - Evidence
   - Preserve
   - Done when
3. Codex uses `$ielts-implement`.
4. Codex reads `AGENTS.md`, then only the docs and files needed for the task.
5. Codex performs minimal git preflight, keeps edits scoped, validates, and reports plain-language verification.
6. No commit, merge, or push happens by default.

Ordinary implementation should not reread the full handoff, backlog, roadmap, and decision history unless the task actually needs them.

## Mode 2: Visual / Manual Verification

Use this when the user checks the actual product.

- The user can report what they see on the page and send screenshots or Debug Panel output when relevant.
- Do not require a project package for ordinary UI observations.
- Request a code/project audit package only when evidence is insufficient, reports conflict with runtime, or a full audit is intentionally needed.
- User-provided questions, answers, screenshots, transcripts, and Debug Panel output are regression evidence, not production content.

When one sample exposes a bug:

- locate and fix the shared runtime, provider, rendering, or workflow cause;
- do not hardcode the topic, answer, phrase, screenshot, transcript, or one regression example into production behavior;
- use the original sample as a regression check;
- verify at least one unrelated affected scenario where practical;
- if the fix affects shared Speaking behavior, smoke-test another relevant Part where practical;
- never claim Writing is fixed by a Speaking-only change.

## Mode 3: Daily Closeout

Use this only when the user explicitly requests daily closeout.

1. Codex uses `$ielts-closeout`.
2. It checks the full accumulated worktree, branch state, ahead/behind counts, untracked files, and secret/temp risks.
3. It syncs only necessary current-state documentation after validated product work.
4. It runs required validation.
5. It stages only intended files.
6. It commits and pushes only if safe and within the explicit closeout authorization.

If work is already on `main`, do not manufacture a merge. Never force push.

## Thread Guidance

- Continue the same Codex conversation while completing the same unresolved feature slice.
- Start a new Codex task when moving to a genuinely separate workstream or after a heavily superseded experimental thread has been closed.
- The user should not have to manage this alone; future prompts should explicitly state whether to continue the same task or open a new one.

## Documentation Timing

- Product implementation first.
- User/runtime verification next.
- Durable current-state documentation mainly after acceptance or during closeout.
- Do not turn experimental attempts into current truth.
- During ordinary feature work, update docs only when the user asks or when a confirmed durable rule/current-state fact would otherwise become false.
