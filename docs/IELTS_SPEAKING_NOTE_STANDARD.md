# IELTS Speaking Note Standard

_Last updated: 2026-05-13 (final handoff)_

This document defines the **final unified standard** for all IELTS Speaking training notes.

**Single standard. All sessions. All parts. One format.**

---

## 1. Purpose

IELTS Speaking notes are **not answer archives.** They are training tools.

Each note must help the learner:
1. **Correct habits** — filler abuse, template language, Chinese-English mixing, unnatural phrasing.
2. **Build reusable material** — personal material blocks that answer multiple questions.
3. **Practice from a path, not a script** — Answer Path before Revised Answer, always.
4. **Transfer** — same material / same answer path / same skill across different questions.
5. **Return to the product** — with a clear, quantitative readiness checklist.
6. **Review in Obsidian** — scannable sections, review cards, error pattern bank.

---

## 2. Core Principles

### Language split

| Language | Used for |
|----------|----------|
| Chinese (中文) | Guidance, diagnosis, strategy, why-it-matters notes, training instructions |
| English | Answers, expressions, sentence frames, Answer Paths, vocabulary, model excerpts |

### Content principles

- Do not encourage memorizing full revised answers.
- Preserve the learner's personal details and original ideas.
- Prefer natural spoken English over fancy vocabulary.
- Every note must tell the learner **what to do first.**
- Every note must include a **route back to product testing.**
- Every note must include **transfer guidance.**
- The same note standard is used by manual VSCode Claude practice **and** future IELTS Scholar product markdown export.

### Format principles

- Notes must be Obsidian-readable markdown (`.md`).
- Scannable: the learner finds "Answer Path" in under 2 seconds.
- Prefer short tables, bullet lists, and checklists over long prose.
- One universal Attempt Block for all Speaking parts.
- The standard adapts by **session size**, not by separate templates.

---

## 3. Session Density

The note adapts to session size. All three densities use the **same Attempt Block structure** (Section 4). What changes is how much surrounding material is generated.

### 3.1 Single Question Session

**When:** Learner practiced exactly one question.

**Output density:**
- Short **Start Here** (3 targets + 1–2 active expressions + filler budget)
- One **Attempt Block**
- Mini review (1–2 review items max)
- 2–3 Transfer Questions

**Do NOT generate:** giant Personal Material Bank, Topic-Level Transfer Map, full Error Pattern Bank, Review Cards section, or Final Practice Plan with multiple phases. These belong in larger session types.

---

### 3.2 Mini Session

**When:** Learner practiced 2–4 questions.

**Output density:**
- Short **Start Here** (3 targets + 2–3 active expressions + filler budget)
- Session Diagnosis
- Each **Attempt Block**
- Small Personal Material Bank (1–3 materials max)
- Small Error Pattern Bank (highest-priority items only)
- Small Transfer list (cross-question)
- Compact Final Practice Plan
- 2–4 Review Cards

**Do NOT generate:** full Topic-Level Transfer Map with material-to-skill mapping, P0/P1/P2 weighting, or 10+ review cards.

---

### 3.3 Topic Session

**When:** Learner practiced 5+ questions on one or related topics.

**Output density:**
- Full **Start Here** with weighted learning route (P0 / P1 / P2)
- Session Diagnosis
- P0 — Must Practice Today (2–4 question Attempt Blocks)
- P1 — Continue If You Have Time (remaining question Attempt Blocks)
- P2 — Full Review / Obsidian Archive (complete archive items)
- Personal Material Bank (3–6 materials)
- Speaking Habit Warnings (3A Filler, 3B Template, 3C Chinese Collocation)
- Error Pattern Bank
- Topic-Level Transfer Map
- Review Cards (error + naturalness + transfer)
- Final Practice Plan with time-boxed routes

---

### 3.4 Weight Levels for Topic Session

**P0/P1/P2 weighting applies only to Topic Sessions (5+ questions).** Single Question and Mini Sessions do NOT use P0/P1/P2. They use their own compact structures defined in Sections 3.1 and 3.2. P0/P1/P2 are not separate templates for different session types — they are internal weighting logic for large topic sessions only.

**P0 — Must Practice Today**

Use for:
- Most serious errors (grammar collapse, Chinese fragments, self-created English words)
- Highest-frequency IELTS questions (Hometown, Work/Study, Home/Accommodation — evergreen topics)
- Strongest personal materials (unique life details that answer 5+ questions)
- Most transferable Answer Paths (structures that work across question types)
- Repeated learner habits (filler chains, template openings, same spelling error across sessions)
- Questions that unlock many similar questions

P0 items appear first. The learner should practice P0 before reading anything else.

**P1 — Continue If You Have Time**

Use for:
- Related questions that reinforce P0 skills
- Secondary but useful personal materials
- Medium-priority expression/collocation issues
- Transfer reinforcement (questions that test whether the P0 skill really transferred)

**P2 — Full Review / Obsidian Archive**

Use for:
- Warm-up questions (simple factual questions that went fine)
- Low-risk factual questions (didn't expose errors but are useful archive)
- Useful but lower-priority review items
- Complete archive material for future Obsidian search

P2 is **not a trash section.** P2 content is still correct, useful, and worth archiving. It is simply not today's active practice priority.

---

## 4. One Universal Attempt Block

Every question in every session type uses this structure. Part 1, Part 2, and Part 3 share the same block — only the Answer Path shape and readiness criteria differ per part.

### Structure

```
## Attempt [number]: [question text]

### 1. Answer Path
### 2. Re-answer Mission
### 3. Original Answer
### 4. Diagnosis
### 5. Revised Answer
### 6. Why This Works
### 7. Transfer
### 8. Ready to Test Again
```

### Sub-section specifications

#### 1. Answer Path

The learner should memorize the **path**, not the full answer.

Must be shorter than the Revised Answer — typically 3–5 short steps, each a phrase.

Part-specific shapes:

**Part 1 Answer Path (2–4 sentences, 10–30 seconds, conversational):**
1. Direct answer (first 5 words answer the question)
2. One personal detail (something only you would say)
3. Light reason / feeling
4. Stop

**Part 2 Answer Path (1.5–2 minutes, story spine):**
1. Who / what / where (set the scene)
2. Specific scene (one moment, not a summary)
3. Key details (sensory — sight, sound, fact)
4. Feeling change (what you felt then vs. now)
5. Why it matters (one sentence of reflection)
Target: story spine, not memorized script.

**Part 3 Answer Path (4–6 sentences, discussion logic):**
1. Direct position (not "in my opinion…")
2. Depends / contrast / condition (show nuance)
3. Example (concrete, not hypothetical)
4. Consequence (so what?)
5. Balanced close (not a forced conclusion)
Target: discussion logic, not essay paragraph.

#### 2. Re-answer Mission

Three tiers. The "Must do" tier is the only required tier.

**Must do:**
- Answer within part-appropriate timing
- Use Answer Path only (do not read the Revised Answer)
- No Chinese
- Obey filler budget
- Include required part-specific element (Part 1: one personal detail by sentence 2; Part 2: one specific scene; Part 3: one concrete example or reasoning step)
- Do not repeat the core mistake identified in this Attempt

**Try to use:**
- 0–1 Active Today expression, only if it fits naturally

**Optional:**
- One bright phrase, only if it sounds natural

Do **not** list 3–5 required expressions per question. The Must-Use Today section controls expression load for the whole note.

#### 3. Original Answer

Preserved exactly as spoken. Use `>` blockquote. Do not clean up grammar, fillers, or hesitations.

#### 4. Diagnosis

Classify problems into:

| Category | Description |
|----------|-------------|
| Idea organization | Structure, order of ideas, weak opening/closing, internal contradiction |
| Naturalness | Awkward phrasing, Chinese-English mixing, overly written style, template language |
| Grammar / collocation | Article, tense, preposition, word choice, self-created English, wrong collocation |
| Filler / hesitation | Empty fillers, filler chains, weak tails, stalling |
| Development / support | Too short, too long for part, no example, no reasoning, list-like |
| Personal detail | Missing, too generic, fabricated-sounding, brochure language instead of personal observation |

Present as a short table or bullet list. Chinese for explanation is acceptable.

#### 5. Revised Answer

- Natural spoken version.
- Fit for the Speaking part (Part 1: conversational 2–4 sentences; Part 2: story-like 1.5–2 min; Part 3: analytical but spoken 4–6 sentences).
- Do not over-polish into an essay.
- Do not make it sound memorized.
- Do not strip out personal details — upgrade expression, preserve idea.

#### 6. Why This Works

2–4 sentences. Explain what was fixed, why it sounds more natural, what speaking skill it trains.

#### 7. Transfer

Separate into three types:

**Same material:** Questions where the exact same personal material (place, person, object, experience) can be reused.

**Same answer path:** Questions where the structure can be reused, but the material changes.

**Same skill:** Questions where a trained ability transfers (describe-around, sensory detail, concrete scene, before/after contrast, honest self-assessment, etc.).

Add topic-bank parentheses: `(相近题库：Hometown / Travel / Relaxation)`

#### 8. Ready to Test Again

Quantitative checklist:

- [ ] Fits target time range (Part 1: 10–30s; Part 2: 90–120s; Part 3: 20–40s)
- [ ] 0 Chinese
- [ ] Filler count within budget (Part 1: ≤2; Part 2: no chain fillers; Part 3: only logical bridges)
- [ ] Includes required element (Part 1: personal detail by sentence 2; Part 2: one specific scene; Part 3: one concrete example or reasoning step)
- [ ] No repeated core error from original answer
- [ ] Can answer twice with same logic but different wording (not word-for-word identical each time)
- [ ] Not word-for-word identical to the Revised Answer

---

## 5. Expression Weighting

### Active Today

Maximum **3 expressions** for the entire note.

The learner actively practices these 3 in today's session. Each appears in the Start Here menu.

### Recognize Only

**5–8 expressions** listed for passive recognition.

The learner reads these but does not actively force them into answers. They appear in the note for Obsidian review.

### Bright Phrase Budget

Maximum **1 bright phrase per Part 1 answer.** 0 is fine.

Naturalness is more important than vocabulary display. A Part 1 answer with 0 bright phrases and perfect naturalness scores higher than one with 3 forced idioms.

---

## 6. Speaking Habit Warnings

Three categories, kept separate:

### A. Filler / Hesitation

Examples: "I mean" (when not correcting), "honestly" (before neutral facts), "to be honest" (overused), "so" / "and" chains, "that's a good question" (stalling).

For each: type (useful / clarification / empty / damaging), rule, self-check.

### B. Template / Generic Language

Examples: "enjoy some fresh air", "people are generally friendly" (without nuance), "people from all walks of life", "plenty of job opportunities", "broaden my horizons", "there are many advantages and disadvantages."

For each: why generic, what personal detail should replace it, a better natural version.

### C. Chinese-Style Collocation / Self-Created English

Examples: "five minutes walking" → "a five-minute walk", "midnight person" → "night owl", "documentations" → "documents / documentation", "release my pressure" → "help me relax / reduce stress / clear my head", "learn knowledge" → "gain knowledge", "I was majored in" → "I majored in."

For each: your version, correct version, brief Chinese explanation.

---

## 7. Topic Session Structure

The full structure for 5+ question sessions:

```
# IELTS Speaking Training Note – [Topic or Mixed Topic]

## Metadata
Date, module, part(s), topic, session type, training band estimate, main focus.

## 0. Start Here: Today's Practice Route

### Practice Routes
- 10–20 min route: finish P0 only
- 30–40 min route: finish P0 + P1
- Deep review route: read P2 and archive sections

### Today's 3 Targets
(Only 3. Concrete, observable behaviors.)

### Active Today (max 3)
| # | Expression | 中文 | Example | Use in |
|---|-----------|------|---------|--------|

### Recognize Only (5–8)
| Expression | 中文 | Note |
|-----------|------|------|

### Filler Budget
- Part 1: max 2 per answer
- Part 2: no chain fillers
- Part 3: only logical bridges
- "I mean" only for genuine correction
- Silence > fake filler

### Return to Product When
- [ ] Quantitative checklist

## 1. Session Diagnosis
Main problem, repeated habits, most valuable materials, what to fix before returning.

## 2. Personal Material Bank
(3–6 materials for Topic Session; 1–3 for Mini Session)
Each: name, core details, useful expressions, can answer (with transfer type labels).

## 3. Speaking Habit Warnings
### A. Filler / Hesitation
### B. Template / Generic Language
### C. Chinese-Style Collocation / Self-Created English

## 4. P0 — Must Practice Today
(2–4 full Attempt Blocks)

## 5. P1 — Continue If You Have Time
(Remaining question Attempt Blocks)

## 6. P2 — Full Review / Obsidian Archive
(Archive items — still full Attempt Blocks, not compressed)

## 7. Topic-Level Transfer Map
Material → best-used-for questions → transfer type → skill trained → don't overuse.
For Mini Session: compact 2–4 item transfer list instead.

## 8. Error Pattern Bank
Table: error type, your version, correct version, 说明, which questions.

## 9. Review Cards
A. Error cards (max 5)
B. Naturalness cards (max 5)
C. Transfer cards (max 5)

## 10. Final Practice Plan
Time-boxed: 0–2 min menu → 2–8 min P0 → 8–12 min weakest twice → 12–16 min transfers → 16–20 min product simulation.
End condition: pass checklist → test in product. Fail → repeat tomorrow.
```

---

## 8. Mini Session Structure

Compact version for 2–4 questions:

```
# IELTS Speaking Training Note – [Topic]

## Metadata
## 0. Start Here (short — no P0/P1/P2 routes, just one practice route)
## 1. Session Diagnosis
## 2. Attempt Blocks (2–4, full structure)
## 3. Small Personal Material Bank (1–3 materials)
## 4. Small Error Pattern Bank
## 5. Transfer List (compact)
## 6. Review Cards (2–4)
## 7. Compact Practice Plan (10–15 min)
```

---

## 9. Single Question Structure

Minimal version for 1 question:

```
# IELTS Speaking Training Note – [Part] – [Topic]

## Metadata
## 0. Start Here (3 targets + 1–2 active expressions + filler budget)
## 1. Attempt Block (full 8-part structure)
## 2. Mini Review (1–2 items)
## 3. Transfer (2–3 questions)
```

---

## 10. Part-Specific Notes

### Part 1

- Answer Path: direct answer → personal detail → light reason → stop (2–4 sentences, 10–30s)
- Filler budget: ≤2 per answer
- Target tone: conversational, not mini-speech
- Required element: one personal detail by sentence 2

#### Part 1 Conversation Thread (Single Question Session)

Part 1 is chat-like and flexible. A Part 1 single-question practice should not only include the main question. It should include a **Conversation Thread:**

- main question
- user's main answer
- diagnosis
- revised main answer
- 1–2 natural follow-up questions generated from the user's answer
- follow-up answer paths
- follow-up coaching
- Part 1 chat skill trained
- ready-to-test checklist

A natural follow-up is generated from a detail the learner already mentioned.

Example: If the user says they live near a fire station, a natural follow-up can be:
- Does the noise bother you?
- What kind of noise do you usually hear?

Example: If the user says they walk more in Japan, a natural follow-up can be:
- Where do you usually walk?
- Why do you think you walk more now?

Part 1 follow-up readiness criteria:
- main answer: usually 10–25 seconds
- follow-up answer: usually 8–18 seconds
- 0 Chinese
- filler count ≤ 2
- no "that's a good question" unless genuinely needed
- answer the follow-up based on the detail already mentioned
- do not repeat the main answer word-for-word

### Part 2

- Answer Path: who/what/where → specific scene → key details → feeling change → why it matters (1.5–2 min)
- Filler budget: structural fillers allowed, chain fillers banned
- Target tone: story spine, not memorized script
- Required element: one specific scene (a moment, not a summary of the whole experience)

Part 2 training should include:
- **Story Spine:** the 5-step path above, practiced without a full script
- **Long-turn retry:** if the answer falls significantly short (under 1 minute), practice the same cue card again with the same story spine but different wording
- **1-minute planning notes** if the session context allows it
- **Reusable story material:** the same personal story should be pivotable to multiple cue card topics

### Part 3

- Answer Path: direct position → depends/contrast/condition → example → consequence → balanced close (4–6 sentences, 20–40s)
- Filler budget: only logical bridges, no empty fillers
- Target tone: discussion logic, not essay paragraph
- Required element: one concrete example or a clear reasoning step

Part 3 training should include:
- **Discussion Path:** the 5-step path above, practiced as a thinking structure, not a memorized paragraph
- **Nuance training:** "it depends" is valid; a forced conclusion is not
- **Speculative language:** "It's hard to say for certain, but…", "One possibility is…"
- **Cross-question reasoning:** the same reasoning structure (position → condition → example → consequence) should transfer across Part 3 question types

### Mixed-Part Sessions

When a session covers multiple parts (e.g., Part 1 + Part 2), each Attempt Block uses its part-specific Answer Path shape and readiness criteria. The Start Here filler budget lists all applicable parts. No separate template needed.

---

## 11. Manual VSCode Claude Training Workflow

### Before product export is ready:

1. Learner tells Claude: module, part(s), topic, question text, raw answer.
2. Claude coaches. May ask clarifying questions or follow-ups.
3. When learner says **"Export Obsidian Note"** or runs **`/ielts-export`**, Claude creates a markdown file following this standard.
4. Claude writes the file to `notes/ielts/speaking/`. Reports file path + short summary.
5. Claude must **not** only print the full note in chat when file access is available.

### File naming

```
YYYY-MM-DD_IELTS_Speaking_Work.md
YYYY-MM-DD_IELTS_Speaking_Hometown.md
YYYY-MM-DD_IELTS_Speaking_Part2_Person.md
YYYY-MM-DD_IELTS_Speaking_Mixed_Part1_Part3.md
```

### Session type detection

Claude auto-detects session density:
- 1 question → Single Question structure
- 2–4 questions → Mini Session structure
- 5+ questions → Topic Session structure with P0/P1/P2 weighting

---

## 12. Product and VSCode Claude Consistency

Manual VSCode Claude training notes and future product-exported notes must use the **same standard.** The note logic must not diverge.

The only difference should be metadata:

```
Source: VSCode Claude Manual Training
```
or
```
Source: IELTS Scholar Product Export
```

All other sections — Attempt Block structure, Answer Path, Re-answer Mission tiers, Transfer labels, readiness checklists, session density rules, P0/P1/P2 weighting (Topic Sessions only), language rules, expression limits — are identical regardless of source.

## 13. Product Export Workflow (Future)

When the IELTS Scholar product markdown export is updated:

1. Product feedback UI remains compact. Exported `.md` is richer and training-oriented.
2. Export follows this standard — same structure, same Attempt Block, same sections.
3. Export adapts density by session: single question / mini session / topic session.
4. Attempt-level export preserved for single questions.
5. Future session-level export aggregates cross-attempt patterns into: repeated error patterns, best upgraded answers, cross-question transfer map, session-level review cards.
6. The export code reads this standard document as its specification.

---

## 14. Guardrails

### Content volume

| Item | Limit |
|------|-------|
| Active Today expressions | Max 3 |
| Recognize Only expressions | 5–8 |
| Review cards per session | 4–15 (depending on session size) |
| Personal Material Bank (topic session) | 3–6 materials |
| Personal Material Bank (mini session) | 1–3 materials |
| Bright phrases per Part 1 answer | Max 1 |

### Answer quality

- Do not make Part 1 answers longer than 4 sentences.
- Do not turn speaking answers into written essays.
- Do not strip out personal details.
- Do not generate fake personal details.
- Do not hide serious errors behind polite phrasing.
- Do not treat every filler as wrong.

### Memorization

- Answer Path before Revised Answer in every Attempt Block.
- Ready to Test Again requires "same logic, different wording twice."
- Never encourage memorizing revised answers word for word.

### Language

- Chinese for guidance, diagnosis, strategy, training instructions.
- English for answers, expressions, sentence frames, Answer Paths, vocabulary.
- Do not mix languages mid-sentence.

---

## Appendix: Relationship to Other Docs

| Document | Relationship |
|----------|-------------|
| `docs/IELTS_OBSIDIAN_NOTE_OUTPUT_STANDARD.md` | Earlier broader standard covering both Speaking and Writing. This document supersedes the Speaking portion with the final unified format. The Writing portion remains valid in that document. |
| `knowledge/ielts/note_generation_rules.md` | Current V1 product export schema. This standard replaces the Speaking note template in that file for future export. |
| `knowledge/ielts/speaking_part1_strategy.md` | Part 1 strategy rules used by Answer Path and diagnosis. |
| `knowledge/ielts/speaking_part2_strategy.md` | Part 2 strategy rules. |
| `knowledge/ielts/speaking_part3_strategy.md` | Part 3 strategy rules. |
| `knowledge/ielts/common_cn_speaker_errors.md` | Error taxonomy used by Diagnosis and Habit Warnings. |
| `knowledge/ielts/sample_answer_guidelines.md` | Style rules for Revised Answers. |

---

## Appendix: Manual Claude Slash Commands

Two slash commands support this standard:
- `/ielts-session` (`docs/../.claude/commands/ielts-session.md`) — starts an IELTS training session
- `/ielts-export` (`docs/../.claude/commands/ielts-export.md`) — exports the session note following this standard

Personal practice notes under `notes/ielts/` are local data and must not be committed/pushed to the GitHub repo.
