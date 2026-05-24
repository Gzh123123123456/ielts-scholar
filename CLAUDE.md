# IELTS Scholar Agent Instructions

This repo is IELTS Scholar, a local-first IELTS training app.

Codex is the primary implementation agent for scoped product work. Claude Code is an optional docs, status, lint, and build verification helper unless the user explicitly approves a larger role.

Follow `AGENTS.md` first, then the relevant workflow documentation. Do not merge or push unless the user explicitly requests daily closeout.

Claude Code should not perform product UI or information-architecture changes by default. Product changes should be scoped through Codex and checked against the current source, runtime evidence, and the durable product principles.

## Documentation Principle

Do not write every speculative idea into durable docs during ordinary feature work. Record durable confirmed decisions or user-approved backlog changes.

Large current-state or documentation sync is normally done after user/runtime validation or during explicit closeout, not inside every small feature slice.
