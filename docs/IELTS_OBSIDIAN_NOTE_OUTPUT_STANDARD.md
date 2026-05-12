# IELTS Obsidian Note Output Standard

_Last updated: 2026-05-12_

This document defines the unified markdown note output standard for IELTS Scholar.

Applies to:
- Manual VSCode Claude IELTS training sessions
- Future IELTS Scholar product markdown export

---

## 1. Purpose

IELTS training notes are **not answer archives.** They are training tools.

Each note should help the learner:

1. **Correct habits** — identify and fix repeated filler, structure, and naturalness errors.
2. **Extract reusable material** — turn personal examples into flexible answer blocks.
3. **Re-answer practice** — practice using a short Answer Path, not a memorized script.
4. **Transfer practice** — use the same material or skill across different questions.
5. **Spaced review** — flag errors and patterns for future review sessions.

A note that only contains a corrected answer is incomplete. A complete note tells the learner exactly what to do next.

---

## 2. Universal Principles

These apply to both Speaking and Writing notes.

### Language split

| Language | Used for |
|----------|----------|
| Chinese (中文) | Guidance, diagnosis, strategy, why-it-matters notes, training instructions |
| English | Answers, expressions, sentence frames, answer paths, vocabulary, model excerpts |

### Content principles

- Do not make the learner memorize full model answers.
- Preserve the learner's personal details and original ideas.
- Prefer natural spoken English over fancy vocabulary.
- Every note must show the learner what to do next.
- Every note must include transfer guidance — how to reuse the material/skill.
- Turn one personal material into multiple possible answers.
- The note format should reduce effort, not add reading burden.

### Format principles

- Notes must be Obsidian-readable markdown (`.md`).
- Use `##` for major sections, `###` for sub-sections, `####` for question-level headings.
- Use tables, bullet lists, and short paragraphs. Avoid long prose blocks.
- Each section must be independently scannable — a learner should find "Answer Path" in under 2 seconds.
- Use `**bold**` for key terms, action items, and section-internal emphasis.
- Use `>` blockquotes for learner original answers.
- Use inline code `` ` `` for expressions, fillers, and short language items.

---

## 3. Speaking Note Format

### Required sections (in order)

```
# IELTS Speaking Training Note – [Part] – [Topic]

## 0. How to Use This Note
## 1. Today's 3 Training Targets
## 2. Personal Material Bank
## 3. Filler & Spoken Habit Diagnosis
## 4. Question-by-Question Coaching
## 5. Topic-Level Transfer Map
## 6. Do Not Memorize List
## 7. Must-Use Today
## 8. Review Cards
## 9. Final Practice Plan
```

### Section specifications

---

#### 0. How to Use This Note

Short, practical instructions. Maximum 6 lines.

Template:
```
1. Do not memorize the revised answers word for word.
2. First read Today's 3 Training Targets.
3. Then practice each question using the Answer Path, not the full revised answer.
4. Record or speak the answer without looking at the note.
5. Return to the product to test the same question only when the readiness checklist is met.
6. Then use the Transfer Questions to test whether the skill transfers to similar questions.
```

---

#### 1. Today's 3 Training Targets

Exactly 3. No more.

Each target must be a concrete, observable behavior the learner can check during self-practice.

Good examples:
- Start with a direct answer, not a filler.
- Add one concrete personal detail by sentence 2.
- Replace template phrases with real observation.
- Use no more than 2 fillers in one Part 1 answer.
- Avoid Chinese-English mixing by describing around missing words.
- Keep Part 1 answers to 2–4 sentences.
- In Part 2, use the cue card as a story flow, not a checklist.
- In Part 3, give a reason + example, not just an opinion.

Bad examples (too vague):
- Improve fluency.
- Speak more naturally.
- Use better vocabulary.

---

#### 2. Personal Material Bank

Extract the learner's reusable personal materials from the session.

Each material entry:

```
### Material: [name]

Core details:
- ...

Useful expressions:
- ...

Can also answer:
- [question 1]
- [question 2]
- [question 3]

(题库相近问题：Describe a ... / Describe a ... / ...)
```

Rules:
- Store flexible material blocks, not full memorized answers.
- "Core details" are the facts — not sentences, not paragraphs. Bullet points.
- "Useful expressions" are phrases the learner already used or should learn, not full sentences.
- "Can also answer" should list 3–5 topic-bank questions where the same core details apply.
- Parentheses at the end link to topic-bank question types for cross-reference.

Example:
```
### Material: Gulangyu

Core details:
- tiny island, 10-minute ferry from Xiamen
- no cars, no bikes — only walking
- colonial-era architecture (1840s–1940s)
- Piano Museum with antique pianos
- feels like stepping into a different era

Useful expressions:
- a ten-minute ferry ride from Xiamen
- no cars — you walk everywhere
- the whole island feels frozen in time
- a strange mix of European villas and tropical coastline

Can also answer:
- a place you like in your hometown
- a tourist attraction
- a relaxing place
- a place with history
- a place you recommend to visitors

(题库相近问题：Describe a natural place / Describe a place where you can relax / Describe a place you recommend)
```

---

#### 3. Filler & Spoken Habit Diagnosis

Four-way filler classification:

1. **Useful filler** — briefly softens tone or buys one natural second. (e.g., "Well, …", "I'd say …")
2. **Clarification filler** — used when genuinely correcting or clarifying. (e.g., "I mean, not the city center exactly, but …")
3. **Empty filler** — used because the speaker doesn't know what to say next. (e.g., "Honestly … I mean … so … and …")
4. **Damaging filler** — used too often or in the wrong place, causing the sentence to collapse.

For each repeated filler, include:
- what the learner said
- why it is a problem
- what to use instead
- when it is still acceptable

Filler budget table:

| Part | Maximum fillers | Which types allowed |
|------|----------------|---------------------|
| Part 1 (2–4 sentences) | 1–2 | Well, Actually, I'd say — only to soften tone |
| Part 2 (long turn) | Unlimited structural fillers | Well, So, Anyway, I suppose — to manage narrative flow; chain fillers still banned |
| Part 3 (discussion) | Few, only logical bridges | The thing is, It depends — when they buy a real thinking moment |

Content triggers to replace empty fillers:
- The easiest example is …
- In my case …
- One thing I noticed is …
- Compared with before …
- The main reason is …
- That's why …

Self-check rule:
> If deleting the phrase does not change the meaning, delete it.

Test examples:
- "~~Honestly,~~ my hometown is in Fujian." → Meaning unchanged. Delete.
- "It's near the coast — I mean, not right on the beach, but close." → Meaning changes without "I mean." Keep.

---

#### 4. Question-by-Question Coaching

For each question in the session, use exactly this structure:

```
## Q[number]: [full question text]

### A. Original Answer
### B. Diagnosis
### C. Revised Answer
### D. Why This Works
### E. Answer Path
### F. Re-answer Mission
### G. Ready to Return to Product When...
### H. Transfer Questions
```

Sub-section specifications:

**A. Original Answer**
- Preserve the learner's original answer exactly as spoken.
- Use `>` blockquote formatting.
- Do not clean up grammar, fillers, or hesitations. The original must be honest.

**B. Diagnosis**
- Do not only list grammar mistakes.
- Classify each problem into one or more of:

| Category | Description |
|----------|-------------|
| Idea organization | Answer structure, order of ideas, weak opening/closing |
| Naturalness | Awkward phrasing, Chinese-English mixing, overly written style |
| Grammar / collocation | Article, tense, preposition, word choice, collocation errors |
| Filler / hesitation | Empty fillers, filler chains, weak tails, stalling |
| Answer length | Too short, too long, inappropriate for the part |
| Personal detail | Missing, too generic, or fake-sounding personal content |

- Present diagnosis as a short table or list. Chinese for explanation is acceptable.

**C. Revised Answer**
- Natural spoken version.
- Fit for IELTS Speaking Part 1 / Part 2 / Part 3 tone and length.
- Do not over-polish into an essay.
- Do not make it sound memorized.
- Do not strip out the learner's personal details — upgrade the expression, preserve the idea.

**D. Why This Works**
- 2–4 sentences. Explain:
  - what was fixed
  - why it sounds more natural
  - what IELTS speaking skill it trains

**E. Answer Path** (mandatory)
- A short skeleton the learner memorizes instead of the full answer.
- Must be shorter than the revised answer — 3–5 steps, each a short phrase.
- The learner should be able to speak from the path without sounding scripted.

Example:
```
1. Job title
2. Company type
3. Main daily task
4. One concrete example
5. Light ending
```

**F. Re-answer Mission**
- One concrete re-practice task.
- Must specify:
  - target time (in seconds)
  - what to use (Answer Path only, not the revised answer)
  - what must be included (one concrete detail, no Chinese, max filler count)
  - what must NOT appear (the repeated core mistake, "I mean" unless correcting, etc.)

Example:
```
Re-answer this question in 20–30 seconds.
Do not look at the revised answer. Use the Answer Path only.
Must include:
- one concrete detail
- no Chinese
- no more than 2 fillers
- no "I mean" unless you are truly correcting yourself
```

**G. Ready to Return to Product When…**
- A checklist of observable criteria.
- The learner should be able to self-check each item before going back to the app.

Example:
```
You can return to the product and test this same question when:
- you can answer without reading the revised answer
- you finish in 20–30 seconds
- you include one personal detail
- you use no Chinese
- you do not repeat the same corrected mistake
- your answer sounds similar in logic, but not word-for-word memorized
```

**H. Transfer Questions**
- 2–5 similar questions.
- Each must note what is being reused:
  - reuse the same material
  - reuse the same answer path
  - use the same contrast / example / personal detail
- Add topic-bank parentheses when useful.

Example:
```
Transfer Questions:
- What do you like most about your hometown? — reuse Gulangyu material
- Is your hometown a good place for tourists? — reuse Gulangyu + seafood stalls
- What food is your region known for? — expand the seafood stall material

(相近题库：Hometown / Food / Travel)
```

---

#### 5. Topic-Level Transfer Map

After all questions, create a cross-question map.

Format:
```
### Material: "[material name]"

Can be used for:
- [question 1]
- [question 2]
- ...

Skill trained: [what speaking skill this material trains]

### Material: "[material name]"

Can be used for:
- ...

Skill trained: ...

### Skill: "[skill name]"

Trained by: [materials or questions]
Can be applied to: [question types]
```

Rules:
- Group by material first, then by skill.
- Each entry must name the skill being trained, not just list questions.
- A learner reading this section should see: "One material → many questions, one trained skill."

---

#### 6. Do Not Memorize List

A table of expressions the learner should avoid overusing.

| Avoid | Why | Use instead |
|-------|-----|-------------|
| [expression] | [reason in Chinese or English] | [natural replacement] |

Categories to cover:
- Template phrases ("There are many advantages and disadvantages …")
- Repeated fillers ("I mean … I mean …")
- Chinese-style collocations ("release my pressure", "learn knowledge")
- Fake high-band expressions used incorrectly
- Too-written expressions for speaking ("furthermore", "nevertheless", "it is universally acknowledged that")

Each entry must give a natural replacement. "Just don't say it" is not enough.

---

#### 7. Must-Use Today

Limit: exactly 5 expressions. No more.

The note may contain many useful expressions, but the learner actively practices only 5 today.

For each:

| # | Expression | Meaning | Example | Use in |
|---|-----------|---------|---------|--------|
| 1 | [expression] | [Chinese meaning] | [short example sentence] | [which question] |

Rules:
- Pick expressions that are transferable — the learner can use them in multiple questions.
- Prefer collocations and sentence frames over single words.
- Each expression must have a real example from the session context.

---

#### 8. Review Cards

Divide into three types:

**A. Error cards** — for repeated mistakes or Chinese-style expressions.
```
**Card N**
Front: [the error — original sentence or pattern]
Back: [the correction + why it matters — concise, actionable]
```

**B. Naturalness cards** — for unnatural but grammatically possible expressions.
```
**Card N**
Front: [the unnatural expression]
Back: [the natural version + rule for when to use which]
```

**C. Transfer cards** — for turning one material into answers for multiple questions.
```
**Card N**
Front: How can "[material]" be reused for different questions?
Back:
- [question type 1] → [angle]
- [question type 2] → [angle]
- ...
Core principle: [one-line summary]
```

Generate 4–8 cards per session. Do not pad — every card should cover a real issue from the session.

---

#### 9. Final Practice Plan

A step-by-step plan the learner can follow immediately after reading the note.

```
Step 1: Read Today's 3 Training Targets again.

Step 2: Pick 3 questions only from this note.

Step 3: For each question:
  - Read the Answer Path (not the revised answer).
  - Speak once without looking at anything.
  - Count your fillers. If any filler appears more than twice, redo.
  - Speak a second time, cutting filler count by half.

Step 4: Try 2 Transfer Questions.
  - Use the same material, but pivot to the new question.

Step 5: Go back to the product.
  - Test the same 3 questions under the timer.
  - Do not look at this note while testing.

Step 6: After testing, check:
  - Did the same filler habit appear again? → save to Error Pattern Bank.
  - Did any answer sound memorized? → practice a looser version.
  - Did you freeze on a question you thought you mastered? → practice it again tomorrow.
```

---

## 4. Writing Note Format

### Required sections (in order)

```
# IELTS Writing Training Note – [Task 1 / Task 2] – [Topic]

## 0. How to Use This Note
## 1. Today's 3 Writing Targets
## 2. Original Prompt
## 3. My Framework / My Notes
## 4. My Original Draft
## 5. Essay-Level Diagnosis
## 6. Logic & Structure Repair
## 7. Sentence-Level Corrections
## 8. Vocabulary & Expression Upgrade
## 9. Revised Paragraph / Model Excerpt
## 10. Revision Mission
## 11. Transfer Patterns
## 12. Review Cards
## 13. Final Practice Plan
```

### Key Writing-specific rules

- Do not only give a model answer. The learner must have a revision task.
- Preserve the learner's position and main ideas where possible — upgrade execution, not argument.
- Separate logic problems (essay-level) from sentence problems (local).
- Extract reusable argument frames, collocations, and sentence patterns.
- Turn every piece of feedback into a concrete revision action.
- Include a "ready to return to product" checklist.
- Writing targets differ from speaking targets — focus on:
  - Task response: answer all parts of the question.
  - Coherence: each paragraph has one clear job.
  - Lexical precision: avoid vague nouns, Chinese collocations, empty intensifiers.
  - Grammar: article, tense consistency, sentence boundary control.
- The **Revision Mission** replaces the Speaking "Re-answer Mission." It should specify:
  - which paragraph to rewrite
  - what specific issue to fix
  - word count target
  - what NOT to repeat

### Vocabulary & Expression Upgrade groups

Four confirmed groups (from `docs/PRODUCT_DESIGN_PRINCIPLES.md`):
- Topic Vocabulary
- From Your Essay
- Collocations
- Argument Frames

Each group should be compact and scannable. Avoid long explanatory paragraphs — let the grouping and labels communicate purpose.

---

## 5. Manual VSCode Claude Training Workflow

For sessions before the product markdown export feature is ready.

### Workflow

1. I (the learner) tell Claude:
   - Module: Speaking or Writing
   - Part/Task: Part 1 / Part 2 / Part 3 or Task 1 / Task 2
   - Topic: e.g., Work, Hometown, Technology, Education
   - Question text (exact wording)
   - My raw answer (transcript or typed)

2. Claude coaches me. Claude may ask:
   - Clarifying questions about my intended meaning.
   - Follow-up questions to draw out more personal detail.
   - Confirmation before generating a revised version.

3. When I type **"Export Obsidian Note"** or **"生成训练笔记"**, Claude must:
   - Create a markdown file following this standard.
   - Write it to the recommended notes folder.
   - Report the file path and a 2–3 sentence summary.

4. Claude should **not** only print the full note in chat when file access is available. Writing the file is the primary output. A short summary in chat is sufficient.

### Recommended folder structure

```
notes/ielts/
notes/ielts/speaking/
notes/ielts/writing/
```

### Recommended file naming

```
YYYY-MM-DD_IELTS_Speaking_Part1_Work.md
YYYY-MM-DD_IELTS_Speaking_Part2_Person.md
YYYY-MM-DD_IELTS_Speaking_Part3_Technology.md
YYYY-MM-DD_IELTS_Writing_Task2_Education.md
YYYY-MM-DD_IELTS_Writing_Task1_LineGraph.md
```

Date format: `YYYY-MM-DD`. Topic word: English, short, capitalized.

---

## 6. Product Export Workflow

For when the IELTS Scholar product markdown export is updated.

### Current state (V1)

- Markdown export is attempt-level: one `.md` file per Speaking attempt or Writing analysis.
- The export format is defined in `knowledge/ielts/note_generation_rules.md`.
- The export includes: question, original answer, scores, corrections, naturalness upgrades, upgraded answer, reusable examples, review cards.

### Future direction

When the product export is upgraded:

1. The product feedback UI may remain compact. The exported markdown note should be richer and training-oriented.
2. Export must include (in addition to current content):
   - Answer Path
   - Re-answer Mission / Revision Mission
   - Transfer Questions / Transfer Patterns
   - Personal Material Bank
   - Filler & Spoken Habit Diagnosis
   - Do Not Memorize List
   - Must-Use Today (max 5)
   - Ready to Return checklist
   - Final Practice Plan
3. Attempt-level export remains valid for single-question practice.
4. When session-level export is introduced, it should aggregate:
   - repeated error patterns across attempts
   - best upgraded answers
   - cross-question transfer map
   - session-level review cards
5. The export code should read this standard document as its specification.

---

## 7. Guardrails

### Content volume

- **Must-Use Today: max 5 expressions.** The note may expose more vocabulary, but the learner's active practice list is capped.
- **Today's Training Targets: max 3.**
- **Review Cards: 4–8 per session.** Do not generate 20 cards — the learner cannot review them all.
- **Personal Material Bank: 2–5 materials per session.** One strong material block is better than 8 thin ones.

### Answer quality

- Do not make Part 1 answers longer than 4 sentences.
- Do not turn speaking answers into written essays.
- Do not strip out personal details to make answers sound "more academic."
- Do not generate fake personal details — no fake names, fake cities, fake jobs.
- Do not hide serious grammar or collocation errors behind polite phrasing.
- Do not treat every filler as wrong — "Well" and "Actually" have legitimate uses.

### Memorization

- Never encourage memorizing revised answers word for word.
- The Answer Path must be shorter than the revised answer — it is a skeleton, not a script.
- Transfer Questions must test whether the skill transfers, not whether the learner memorized one answer.

### Language

- Chinese for guidance, diagnosis, strategy, training instructions, why-it-matters notes.
- English for answers, expressions, sentence frames, answer paths, vocabulary, model excerpts.
- Do not mix languages mid-sentence. Each sentence is fully Chinese or fully English.

---

## 8. Example Mini Template

A compact example showing one Speaking Part 1 question through the full format.

```
## Q1: Where is your hometown?

### A. Original Answer
> Well, honestly, I mean, my hometown is a city in Fujian province, it's in the south of China, and it's near the sea.

### B. Diagnosis

| Problem | Category |
|---------|----------|
| Three fillers before city name — examiner still doesn't know where | Filler / hesitation |
| "a city in Fujian" — no city name given | Personal detail |
| "near the sea" is the most interesting detail but buried at the end | Idea organization |

### C. Revised Answer
> My hometown is Xiamen, a coastal city in southern Fujian. It's not huge by Chinese standards — maybe four or five million — but it's got a really distinct character because it's right on the water.

### D. Why This Works
- City name is word 4 — examiner gets the answer immediately.
- "Coastal city in southern Fujian" is precise and compact.
- "Right on the water" is natural spoken English, not a textbook phrase.

### E. Answer Path
1. City name immediately
2. Size + one defining feature (sea)
3. One specific detail only a local would know

### F. Re-answer Mission
Re-answer in 10–15 seconds. Use the Answer Path only.
Must include: city name as first 3 words, one concrete detail, no "I mean," no "honestly."

### G. Ready to Return to Product When...
- you name your city within the first 4 words
- you include one specific detail (not a generic adjective)
- you finish in 10–15 seconds
- you use 0–1 fillers

### H. Transfer Questions
- What city do you live in? — same structure, different city
- Is your hometown a big city or a small place? — reuse size + coastal detail
- Do you like your hometown? — use the same concrete detail as evidence

(相近题库：Hometown / The city you live in)
```

---

## Appendix: Relationship to Existing Docs

| Document | Relationship |
|----------|-------------|
| `knowledge/ielts/note_generation_rules.md` | Current V1 product export schema — defines JSON `obsidianMarkdown` field generation. This standard extends and replaces the Speaking/Writing note templates in that file for future export. |
| `docs/PRODUCT_DESIGN_PRINCIPLES.md` | Product-wide design rules. This standard applies those principles to note output (low-noise structure, Chinese guidance + English content, empty state rules, etc.). |
| `knowledge/ielts/sample_answer_guidelines.md` | Style rules for AI-generated answers. This standard inherits those rules for Revised Answer and Model Excerpt sections. |
| `knowledge/ielts/common_cn_speaker_errors.md` | Error classification taxonomy. This standard uses those tags in Diagnosis sections. |
| `knowledge/ielts/speaking_part1_strategy.md` | Part 1 strategy rules. This standard's Answer Path and Re-answer Mission sections should reflect Part-specific timing and length rules from those documents. |
| `knowledge/ielts/speaking_part2_strategy.md` | Part 2 strategy rules. Same relationship as above. |
| `knowledge/ielts/speaking_part3_strategy.md` | Part 3 strategy rules. Same relationship as above. |
