# Speaking Part 2 / Part 3 Reuse Scout - 2026-06-06

This note captures the read-only analysis after the current Part 1 checkpoint and the product direction discussed for Part 2. It started as a planning note.

## Status Update - 2026-06-09

The first Part 2 slice has now been implemented:

- Provider-native `part2Feedback` contract for anchored annotations, material type, story modules, six language signals, next speakable version, and highlights.
- Part 2 UI renders `NEXT SPEAKABLE VERSION` instead of the old Band 7 target-answer surface.
- Part 2 result rendering no longer treats old `fatalErrors`, `naturalnessHints`, or `preservedStyle` as the final Part 2 learning surface.
- Six language signals now use provider-side teacher planning, candidate ranking, one-signal ownership, and replace/add alternatives.
- Practice history restore/retest paths were hardened for saved Part 2 results.

Remaining direction from this scout still applies to Part 3, shared material/profile design, and Part 2 provider-output QA hardening.

## Current Evidence

- Part 1 now has a topic-thread workflow: ordered same-topic questions, annotated original answers, clean retry answers, learning assets, material display/export cleanup, and exact-thread retry behavior.
- Part 1's strongest reusable mechanism is the separation between core feedback and learning assets:
  - core analysis owns scoring, anchored errors, and clean retry answers;
  - a separate learning-assets pass owns reusable material, expression chunks, and answer development;
  - a display model filters and packages learner-facing assets for UI and export.
- Part 2 currently remains single long-turn practice. Part 3 currently uses individual follow-up questions derived from Part 2 prompts.
- Verification run from this scout:
  - `npm run verify:part1-runtime-fixtures` passed: 68 passes, 0 failures.
  - `npm run lint` passed.
  - `npm run build` passed, with existing Vite chunk-size / dynamic-import warnings only.

## What Part 2 Can Borrow From Part 1

Borrow the architecture, not the Part 1 short-answer rules.

- Keep score and core diagnosis separate from reusable learning assets.
- Use a dedicated display model so UI and Markdown export show the same filtered learning material.
- Treat learner examples as regression evidence, not hardcoded production fixtures.
- Keep material extraction grounded: preserve confirmed personal facts and plausible answer angles, but do not invent private experiences.
- Let weak provider learning payloads fail a quality gate instead of locally padding cross-topic material.

## Proposed Part 2 Product Logic

Part 2 should behave like a long-turn material and story-building trainer:

```text
Topic -> material type -> personal material library -> story modules -> six language-signal check -> next speakable version
```

The first classification layer should identify the likely material type:

- person;
- place;
- object;
- experience/event;
- abstract or opinion-shaped experience.

Part 1 material can be useful upstream evidence for Part 2, but it should be transformed, not copied. For example:

- `handmade album` can become an object/gift/story package;
- `Xiamen` can become a place/hometown package;
- `PC games / Black Myth: Wukong` can become a hobby/object/experience package;
- `Zhongshan Road / commercial area` can become a place/waiting/shopping/city-area package.

## Part 2 Material Package Shape

A Part 2 story package should contain modular material, not a memorized full answer:

1. What / who / where it is.
2. Background.
3. Concrete details.
4. What happened.
5. How I felt.
6. Why it mattered.
7. Current or future influence.

The product should help the learner combine modules for the current cue card. If material is missing or unsuitable, AI may suggest safe expansion directions, but should mark them as prompts to confirm rather than confirmed personal memory.

## Six Language Signals For Part 2

The six language signals are a Part 2 checklist, not a mechanical insertion rule.

- Idiomatic expression: natural spoken habits, no forced idioms.
- Tense: clear timeline across past event, current reflection, and future influence.
- Connector: story flow beyond repeated `and` / `but`.
- Phrasal verb: natural spoken action verbs when accurate.
- Collocation: precise topic pairings instead of basic word combinations.
- Clause: useful dependent clauses for detail, reason, contrast, or reflection.

Useful feedback shape:

```text
Your material is strong enough, but the language signals are thin.
This attempt should mainly improve:
1. collocation
2. clause control
3. tense timeline
```

Do not force all six into every answer. But when several can fit naturally and accurately, the product should surface them. More feedback is acceptable when it is grounded, accurate, and not noisy.

## Part 2 Drill Direction

The "polarity training" idea fits Part 2 better than Part 1.

Potential drill mode:

- daily focus: one or more weak language signals;
- random material seed: book / park / gift / person / object / event;
- learner speaks for 1-2 minutes;
- system checks only the focus signals;
- system extracts reusable expressions and story modules;
- repeated weak points are chained into later drills.

Examples:

- Collocation focus: collect stronger pairings for the current material.
- Clause focus: practise `which`, `where`, `that`, `because`, and reduced relative structures only when natural.
- Connector focus: practise spoken narrative transitions such as `what made it special was`, `on top of that`, `as a result`, and `looking back`.

## Shared Material Library Boundary

A cross-Part material layer is not redundant if it is treated as a meaning store, not an answer store.

Potential shared layer:

- stores confirmed learner material and safe AI-suggested candidates separately;
- tags material by semantic type, part fit, topic family, freshness, and confidence;
- lets Part 1, Part 2, and Part 3 reuse the same underlying facts with different answer shapes.

Boundary:

- Part 1 uses material as short personal detail.
- Part 2 uses material as story modules.
- Part 3 uses material as example, observation, contrast, or consequence.

Do not implement this broadly until the storage and product surfaces are scoped. A persistent cross-part material library touches storage, history/export behavior, user review/delete workflows, and provider prompts.

## What Should Not Change Now

- Do not change Part 1 for this Part 2 direction.
- Do not convert Part 2 into a multi-question thread.
- Do not implement Part 3 in the same slice.
- Do not add storage for a shared material library without a separate scoped decision.
- Do not use the six language signals as a hard "must include all six" score gate.

## Recommended Next Slice

Start with Part 2 only:

1. First remove the separate lower `MUST FIX` / phrase-fix card pattern from the Part 2 result page.
2. Reuse Part 1's interaction model, but avoid treating the old `fatalErrors` / `naturalnessHints` arrays as the final annotation source. That is only a temporary display adapter.
3. The correct direction is provider-native anchored annotations: the analysis should quote the learner's original span, classify severity, and explain why that span deserves repair or polish.
4. Do not expose unanchored correction notes in the Part 2 learner UI. If a note cannot be grounded in the learner's words, improve the provider contract rather than display a loose fallback chip.
5. Only after the correction surface is stable, define a `part2_learning_assets` contract for story modules, language-signal gaps, and the next speakable version.
6. Add fixtures before real-provider tuning.

Part 3 can then reuse the architecture, but with a discussion-thread contract rather than a long-turn story package.
