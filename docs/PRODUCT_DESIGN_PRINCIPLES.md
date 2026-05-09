# Product Design Principles

_Last updated: 2026-05-09_

This document is the long-term product design source of truth for IELTS Scholar.
It applies to all modules, all phases, and all future implementation work.

---

## A. Low-noise Feedback UI

IELTS Scholar feedback pages already require the learner to read a lot.
Every line of explanatory module text is potential UI noise.

**Rule:** Prefer structure over explanation.

- Prefer layout, grouping, labels, arrows, hierarchy, and content format to communicate what a section is for.
- If a module needs a long sentence to explain its purpose, first suspect weak information architecture.
- Do not use module-level explanatory copy as the first solution.

**Rejected example:**
> "Expression bank for this essay — for revision and future reuse, not another correction list."

This sentence was rejected because it explains the design instead of letting the design express itself.
The section title, grouping, and content shape should make the purpose obvious without narration.

---

## B. Interface Should Feel Like a Calm Revision Workspace

The product should feel like:

- a calm IELTS training workspace
- a strict but helpful teacher's revision desk
- **not** a raw AI output dump
- **not** a documentation page
- **not** a page full of warnings and disclaimers

Feedback UI should help the learner revise, not feel like reading a system report.

---

## C. Chinese Guidance + English Learning Material

IELTS Scholar is designed for Chinese-native IELTS learners.

**Rule:**

| Language | Used for |
|----------|----------|
| Chinese (中文) | Guidance, strategy, reasoning, explanations, why-it-matters notes |
| English | IELTS prompts, user output, upgraded expressions, sentence frames, model excerpts, vocabulary to memorize or imitate |

- Chinese guidance helps the learner understand safely.
- English content is where the learner enters output / input / memorization mode.
- Do not force all guidance into English when it harms comprehension.

---

## D. Empty States Must Be Rare and Meaningful

An empty feedback state should **only** appear when:

1. the user input is not even one related complete sentence;
2. the user input is meaningless, random, or corrupted;
3. the user input is completely unrelated to the task;
4. there is a technical / provider / parser failure — in which case the UI should show a retry/failure state, not pretend there is "nothing to extract."

If the learner writes even **one serious, related, complete sentence**, the system should provide feedback where possible.

Even one sentence can support:

- Topic Vocabulary
- one wording upgrade
- one logic reminder
- one sentence-level correction

**Do not show** cold empty text like:
> "No expression bank items for this attempt."

For invalid / too-short input, Chinese empty-state text is acceptable, for example:
> 本次回答太短，暂时无法提取稳定的表达积累。请先写出至少一句与题目相关的完整句子。

---

## E. Vocabulary & Expression Upgrade Principles

### Section Title Groups (Confirmed)

```
Topic Vocabulary
From Your Essay
Collocations
Argument Frames
```

### Principles

- Vocabulary & Expression Upgrade is a **reusable expression takeaway area**.
- It is **not** a second sentence correction list.
- It should **not** display full sentence correction duplicates.
- `From Your Essay` must be **phrase-level**.
- Universal academic essay phrases can exist, but only in small numbers and only when strongly relevant.
- Generic filler should not dominate.
- Topic vocabulary should be **visibly connected to the task topic**.
- Normal relevant responses should **not** produce an empty vocabulary section.

### Universal Phrases

Universal academic phrases are **not banned**. They are acceptable as "seasoning," not the main dish.
A few well-chosen reusable frames are fine. A list of generic template sentences is not.

---

## F. Logic Review Principles

Logic & Structure Review should be a **revision roadmap**, not just a problem list.

Each major logic issue should help the learner understand:

1. **what** the issue is;
2. **why** it affects IELTS performance;
3. **what** to add, remove, or rewrite.

**Avoid generic fixes** like:
> "Rewrite the whole essay around one clear idea with support."

**Prefer task-specific guidance**, e.g.:
- If the essay only discusses advantages when the task asks for advantages/disadvantages, tell the learner to add a short disadvantages side before defending the final position.

---

## G. Overlay Future Principle

After V1.3 annotated essay overlay is implemented:

- Old large Sentence-level Correction cards may become **default-collapsed**.
- Long-term direction: old large correction cards may eventually be **removed**.
- However, overlay content must **not** be compressed or weakened just to look neat.
- Overlay must satisfy layout aesthetics while preserving **meaningful feedback depth**.

Overlay should be a lightweight but complete correction panel, not a tiny tooltip that cuts learning value.

---

## H. Agent Role Boundary

### Claude Code — current role

- Documentation updates
- Git status checks
- Lint / build verification if requested
- **No** product UI / information architecture implementation
- **No** "small UI fix" unless explicitly approved

### Codex — future role

- Main UI / product implementation
- Writing Task 2 Phase 3 product information architecture repair
- React implementation based on documented product principles and specific prompts
