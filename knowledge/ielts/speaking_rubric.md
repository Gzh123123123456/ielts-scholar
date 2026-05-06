---
module: speaking
scope: rubric
last_reviewed: 2026-05-06
source_policy: app-usable summary based on uploaded learning materials and product rules; not official IELTS source; no long copyrighted excerpts
---

# IELTS Speaking Rubric (Summarized)

## Purpose
Define the four official IELTS Speaking assessment criteria. Used by the AI to assign band estimates and generate feedback. In V1, pronunciation is not formally scored.

## Core Rules

### Fluency & Coherence (FC)
- Speaks at length without noticeable effort.
- Connectives and discourse markers used naturally (well, actually, I mean, to some extent).
- Natural hesitation is acceptable — short pauses and minor self-correction are normal in spoken English.
- Penalize hesitation mainly when it repeatedly blocks communication or makes the answer hard to follow.
- Do not over-penalize short thinking pauses, especially in Part 2 (long-turn) and Part 3 (abstract/unscripted). Some planning during speech is expected.
- Answers are logically organized, not rambling.

### Lexical Resource (LR)
- Uses a range of vocabulary, not just common words.
- Paraphrases effectively when a precise word is unknown.
- Collocations are natural (e.g., "heavy rain" not "strong rain").
- Avoids overuse of fillers like "very" or "good" without qualifiers.

### Grammatical Range & Accuracy (GRA)
- Mix of simple and complex sentence structures.
- Errors in basic grammar (tense, articles, subject-verb agreement) lower the band.
- Complex structures attempted even if not perfectly executed.

### Pronunciation (P)
- Sounds are clear and mostly accurate.
- Intonation and stress convey meaning.
- L1 accent does not prevent comprehension.
- **V1: Not formally assessed.** Feedback should note: "Not formally assessed in V1."

## Feedback Rules
- Each sub-score is a half-band (e.g., 6.0, 6.5, 7.0).
- The overall band estimate is calculated from FC, LR, GRA only.
- Pronunciation is marked `null` with a note in the output schema.
- Band estimate label: "Band Estimate (Excluding Pronunciation)".

## Tags
`fluency`, `coherence`, `tense`, `article`, `preposition`, `word_choice`, `collocation`, `pronoun`, `sentence_structure`, `overly_written_style`, `lack_of_example`, `unclear_reference`

## Transcript-Only Limitation (V1)
- V1 feedback is based on transcript text only — no audio analysis is performed.
- Pronunciation must NOT be inferred from spelling errors or transcript quality. A misspelled word in the transcript does not indicate mispronunciation.
- If the automatic transcription appears inaccurate, provide a warning in feedback: "Transcript may contain recognition errors. Feedback is based on the text as captured."

## Do Not
- Do not give a score that includes pronunciation.
- Do not inflate scores. Default to calibrated strictness.
- Do not use letter grades or percentages — always half-band IELTS scale (4.0–9.0).
