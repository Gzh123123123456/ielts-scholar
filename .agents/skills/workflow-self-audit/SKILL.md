---
name: workflow-self-audit
description: Read-only audit for repeated Codex/Claude workflows that should become prompts, AGENTS rules, skills, hooks/rules, or automations.
---

# Workflow Self Audit

Use this skill when the user wants to reduce repeated prompts, token waste, command noise, or agent workflow friction.

Default mode is read-only.

Do not create or modify files unless the user explicitly approves a shortlist item after the audit.

## Purpose

Review recent agent work and identify repeated manual workflows worth packaging.

The goal is not to create many rules. The goal is to find the smallest durable mechanism that reduces repeated prompting, prevents common mistakes, or improves reliability.

## Evidence Order

Use available evidence in this order:

1. Recent Codex/Claude sessions and task summaries, if available.
2. Existing project skills and commands.
3. Global and project `AGENTS.md` / `CLAUDE.md`.
4. Project workflow docs.
5. Source files only when needed to confirm a workflow boundary.

Do not inspect secrets, auth files, `.env`, API keys, private transcripts, or unrelated personal files.

## Candidate Criteria

Only treat something as a packaging candidate when it:

- occurred at least twice, or is clearly likely to recur and costly to repeat;
- is time-consuming, error-prone, context-heavy, or reliability-sensitive;
- has stable inputs;
- has a repeatable procedure;
- has a clear output or stopping condition;
- is not already adequately covered.

## Classification

Choose the smallest appropriate form:

- Keep as prompt: useful but not stable enough to package.
- Move to `AGENTS.md`: high-frequency project behavior every agent should know.
- Create or extend a skill: repeatable workflow or playbook.
- Create hook/rule/permission: deterministic safety, formatting, validation, or blocking behavior.
- Create automation: scheduled or recurring check/report/reminder.
- Skip: too one-off, ambiguous, sensitive, speculative, or poorly evidenced.

## Output Format

Produce a compact shortlist.

For each candidate, include:

- repeated workflow;
- evidence and dates if available;
- frequency / confidence;
- recommended form;
- expected token saving or reliability gain;
- files/configs to inspect before implementation;
- why it is or is not worth creating.

## Stop Rule

After the shortlist, stop and ask the user what to approve.

Do not create skills, hooks, rules, commands, automations, or config changes during the audit unless the user explicitly approves a specific item.

## Final Summary

Finish with:

- what should be created first;
- what should be skipped;
- what needs more evidence;
- whether any existing rule/skill should be shortened instead of expanded.
