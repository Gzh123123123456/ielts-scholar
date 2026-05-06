---
module: both
scope: note_generation
last_reviewed: 2026-05-06
source_policy: app-usable summary based on uploaded learning materials and product rules; not official IELTS source; no long copyrighted excerpts
---

# Obsidian Markdown Note Generation Rules

## Purpose
Define the structure and content of downloaded `.md` notes for both Speaking and Writing. Used by the AI to populate the `obsidianMarkdown` field in the feedback JSON. V1 is download-only — no automatic vault writing.

## Speaking Note Template

```markdown
# IELTS Speaking Note — [Date]

## Question
[Part X] — [Question text]

## My Original Answer
[User's transcript]

## Scores
- Fluency & Coherence: X.X
- Lexical Resource: X.X
- Grammatical Range & Accuracy: X.X
- Pronunciation: Not formally assessed in V1
- **Estimated Band (Excl. Pronunciation): X.X**

## Critical Corrections
- [Original] → [Correction]
  - Tag: [tag]
  - Note: [explanationZh]

## Naturalness Upgrades
- "[Original]" → Better: "[Better]"
  - Tag: [tag]
  - Note: [explanationZh]

## Preserved Personal Style
- "[Text]" — [reasonZh]

## Upgraded Answer
[Upgraded answer text]

## Reusable Example
- "[Example phrase]"
  - Can be reused for: [topics]
  - Note: [explanationZh]

## Review Cards (for spaced repetition)
### Card 1
**Front:** [Error pattern or question]
**Back:** [Correction or answer]

### Card 2
**Front:** [Error pattern]
**Back:** [Correction]
```

### Review Card Format
Each card is a heading + front/back pair. Generate 2–4 cards per session covering the most important errors. Keep front questions short — one sentence or phrase. Keep back answers actionable — a correction, a pattern, or a rule.

## Writing Note Template

```markdown
# IELTS Writing Note — [Date]

## Question
Task 2 — [Type] — [Question text]

## My Framework
[User's Phase 1 framework summary]

## My Essay
[User's essay text]

## Scores
- Task Response: X.X
- Coherence & Cohesion: X.X
- Lexical Resource: X.X
- Grammatical Range & Accuracy: X.X

## Key Corrections
- [Original] → [Correction]
  - Dimension: [TR/CC/LR/GRA]
  - Tag: [tag]
  - Note: [explanationZh]

## Framework Logic Review
- Issue: [issue]
- Suggestion: [suggestionZh]
- Severity: [fatal / naturalness / preserved]

## Reusable Arguments
- "[Argument]"
  - Can be reused for: [topics]
  - Note: [explanationZh]

## Model Answer Excerpt
[Model answer text]

## Review Cards
### Card 1
**Front:** [Framework/error pattern]
**Back:** [Answer/rule]

### Card 2
**Front:** [Framework/error pattern]
**Back:** [Answer/rule]
```

## Partial Writing Analysis

If the essay is significantly shorter than a full Task 2 response (rough guideline: under 100 words), add this line near the top of the Markdown note, after the question:

> *This was analyzed as paragraph-level or partial practice, not as a reliable full Task 2 band estimate.*

This ensures the permanent note records the limitation without discouraging the user from paragraph-level practice.

## Final Framework Summary (V1 vs V1.1)

- **V1 current behavior**:
  - `My Framework` in Writing notes should come from the user-edited **Final Framework Summary**.
  - Do **not** treat raw coach discussion history as the final framework output.
  - If the final framework summary is empty, keep `My Framework` concise and avoid inventing structure.

- **V1.1 / API-phase target behavior**:
  - Allow an AI-assisted action (e.g., **Generate Framework Summary** / **Extract Final Framework**) to convert Phase 1 coach discussion into a structured framework draft:
    - Position
    - View A
    - View B
    - My opinion
    - Paragraph plan
    - Possible example
  - User must review/edit the generated framework before essay drafting and before final note export.

## Session-Level Note Roadmap

- **Current V1**: Export is attempt-level only (`ielts-speaking-[date].md`, `ielts-writing-[date].md`).
- **Future target**: Add **Finish Session / Export Session Note** covering multiple attempts/questions.
- Session note should summarize:
  - repeated error patterns
  - improvement trends across retries
  - best upgraded answers
  - reusable expressions
  - review cards for revision planning

## Generation Rules

### General
- Use the user's actual words in "My Original Answer" / "My Essay" sections — do not clean them up.
- Use the question text exactly as presented, not a paraphrased version.
- Date format: YYYY-MM-DD.
- All band scores use half-band increments (X.X).
- If a section has no content (e.g., no reusable example), omit it rather than writing "None".

### File Naming
- Speaking: `ielts-speaking-[YYYY-MM-DD].md`
- Writing: `ielts-writing-[YYYY-MM-DD].md`

## Do Not
- Do not include internal AI reasoning or system prompts in the note.
- Do not write JSON inside the Markdown note — it should be human-readable.
- Do not wrap the note in a code block. Output raw Markdown.
- Do not include the Mock Provider disclaimer in the user's permanent note.
- Do not claim AI auto-generated a final framework in V1 when it was manually authored by the user.

## Product-State Notes (2026-05-06)

- Writing Task 2 Final Framework Summary is currently manual/user-edited in V1.
- Do not imply that V1 performs real AI extraction from discussion unless provider-integration phase is active.
- Phase 2 should consume the final framework summary (not raw coach discussion logs).
- Phase 3 `My Framework` should mirror the same final framework summary used for writing.

## Future Session Note Direction

When session-level export is introduced, generate a separate session note that can aggregate:
- multiple Speaking parts/questions/attempts
- Writing framework discussion, drafts, feedback, and revisions

The session note should emphasize:
- repeated error patterns
- improvements over retries
- best upgraded answers
- reusable expressions
- review cards

## Do Not Do Yet (Generation Scope)

- Do not fabricate Gemini-powered framework extraction in V1.
- Do not emit RAG-sourced claims in V1 notes.
- Do not include pronunciation scoring claims beyond current product capability.
- Do not output full inline-annotation style notes as if editor tooling already exists.
