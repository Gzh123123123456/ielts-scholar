# Product Design Principles

_Last updated: 2026-05-24_

This file records durable product principles for IELTS Scholar. It is not an implementation diary.

## Low-Noise Feedback UI

IELTS Scholar feedback pages already ask the learner to read a lot. Prefer structure over explanation.

- Use grouping, labels, hierarchy, spacing, and content shape to communicate purpose.
- Avoid long module-level explanatory copy when the interface can make the section's role obvious.
- Feedback should feel like a calm revision workspace, not a raw AI dump, documentation page, or warning panel.

## Chinese Guidance + English Learning Material

IELTS Scholar is designed for Chinese-native IELTS learners.

- Chinese is for guidance, strategy, reasoning, explanations, and why-it-matters notes.
- English is for IELTS prompts, learner output, upgraded expressions, sentence frames, target answers, and vocabulary to imitate.
- Functional UI labels and commands should remain English-only.

## Meaningful Empty States

An empty feedback state should appear only when the input is unrelated, meaningless, corrupted, too short to analyze, or blocked by a provider/parser failure.

If the learner provides even one serious related complete sentence, the system should give useful feedback where possible: a wording upgrade, a logic reminder, a sentence-level correction, or topic vocabulary.

## Vocabulary And Expression Upgrades

Vocabulary and expression areas are reusable learning banks, not duplicate correction lists.

Confirmed groups:

```text
Topic Vocabulary
From Your Essay
Collocations
Argument Frames
```

- `From Your Essay` must be phrase-level.
- Topic vocabulary should visibly connect to the task topic.
- Universal academic phrases are acceptable in small, relevant doses.
- Production logic must remain topic-agnostic. Mock/demo examples must not become hardcoded product behavior.

## Logic Review Quality

Logic review should be a revision roadmap.

Each major issue should make clear:

- what the issue is;
- why it affects IELTS performance;
- what to add, remove, or rewrite.

Prefer task-specific advice over generic rewrite instructions.

## Overlay Principles

For annotated writing overlays:

- My Essay source marking should use problem/grey or strikethrough-style marking for original issues.
- Target Model Answer highlights are a different visual language for recommended repairs and expressions.
- Phrase-level issues should mark only the exact phrase when reliable.
- Whole-sentence rewrite should be reserved for sentence-level logic/function issues or cases where no reliable phrase-level source exists.
- Overlay content must remain meaningful; do not weaken feedback just to make the overlay compact.

## Target Answers

Target answers are training resources, not official IELTS guarantees.

- Current estimates must stay conservative and describe the learner's current answer, essay, or report.
- Do not inflate current scores to match the target layer.
- Target answers should preserve useful learner material while applying important corrections and idea-development advice.
- Do not use learner-facing Band 9 as the default target label.
- Do not use intermediate Target Band 7.5 or 7.5-8.0 labels.

### Current Speaking Target Policy

Speaking scores are conservative single-question training estimates or valid adjacent half-band ranges. Speaking target answers are pedagogical practice resources, not certified guarantees.

- Current lower bound below 7.0 -> `BAND 7 TARGET ANSWER`.
- Current lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`.
- High-band-stable only -> `STANDARD ANSWER`.
- Normal Speaking learner flow has no learner-facing higher-band target promise, advanced-target label, validation badge, or validation-failure state.
- Speaking single-question estimates exclude pronunciation unless a future real pronunciation-scoring path is explicitly implemented.

Do not assume this simplified Speaking policy has fixed Writing. Writing Task 2 target/score/feedback consistency remains a future separate audit. Writing Task 1 calibration remains future scoped work and requires real samples.

## Regression Evidence Must Generalize

User-provided questions, answers, screenshots, transcripts, and Debug Panel output are regression evidence, not product fixtures.

- Runtime behavior must remain topic-agnostic.
- Do not hardcode a reported example into production.
- Fixes should apply through shared logic and be checked beyond the reported sample where practical.
- Never claim another module is fixed by a change that only touched one module.

## Agent Role Boundary

- Codex is the current primary implementation agent for scoped product work.
- Claude Code remains an optional docs/status/verification helper unless explicitly approved for more.
- Product/UI/feedback behavior changes should follow `AGENTS.md`, `docs/CURRENT_STATE.md`, this file, and the relevant source/runtime evidence.
