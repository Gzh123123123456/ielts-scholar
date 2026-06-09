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

### Speaking Part 2 Feedback Principles

Speaking Part 2 is a long-turn story and material trainer, not a short phrase-card correction page.

- Provider `part2Feedback` is the learner-facing source for Part 2 anchored annotations, material type, story modules, six language signals, and next speakable version.
- The UI should classify, order, and display provider fields; it should not infer final Part 2 feedback from old `fatalErrors`, `naturalnessHints`, `preservedStyle`, local phrase lists, or front-end keyword rules.
- Part 2 annotations are for necessary local anchored repairs. Low-yield opener polish and language-signal enrichment belong in story modules or six language signals.
- Six language signals should teach high-value spoken habits: idiomatic expression, tense timeline, connector range, phrasal verbs, collocation, and clause control.
- Signal upgrades should be chosen by teacher planning: inventory evidence, rank by IELTS value, assign one primary teaching role, then produce a direct learnable expression.
- `bestUpgrade` should be the exact English expression/frame the learner should notice, not a meta instruction such as "add a future clause".
- Alternatives may be replace/add learning assets. They should not become low-value near-synonym polishing or duplicate the best upgrade.
- Connector upgrades should avoid default shortcuts such as `so`, `and`, and `but` in this surface. Those words can be correct, but they have low training value when the product goal is richer spoken discourse.
- Collocation should prioritize adverb + adjective, then adverb + verb. Adjective+noun vocabulary chunks belong in story or vocabulary material.
- Tense feedback should first diagnose past event/background, present reflection/current relevance, and future/current-future influence; do not mechanically mark present-tense lines wrong inside a mostly past story.

## Regression Evidence Must Generalize

User-provided questions, answers, screenshots, transcripts, and Debug Panel output are regression evidence, not product fixtures.

- Runtime behavior must remain topic-agnostic.
- Do not hardcode a reported example into production.
- Fixes should apply through shared logic and be checked beyond the reported sample where practical.
- Never claim another module is fixed by a change that only touched one module.


## Product Decision Discipline

Product and feedback changes must solve the underlying learner/product problem, not only the visible symptom.

- If the learner goal, product role, or acceptance state is unclear, stop and clarify before implementation.
- If the requested path is slower, riskier, or more fragile than another route, state the better route directly.
- Every product decision should answer “why”: why this section exists, why this content belongs here, why this layer should change, and why the change helps the learner.
- Avoid blacklist-style product rules such as “do not show X” as the primary solution. Define the positive contract: what the section should contain, what evidence it should use, how to transform internal fields into learner-facing output, and what to do when evidence is insufficient.
- Keep learner-facing UI and agent reports low-noise. Remove text that does not change the learner's action or the next product decision.
## Agent Role Boundary

- Codex is the current primary implementation agent for scoped product work.
- Claude Code remains an optional docs/status/verification helper unless explicitly approved for more.
- Product/UI/feedback behavior changes should follow `AGENTS.md`, `docs/CURRENT_STATE.md`, this file, and the relevant source/runtime evidence.
