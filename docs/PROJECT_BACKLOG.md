# Project Backlog

_Last updated: 2026-05-26_

This is the current backlog. Completed implementation history belongs in `docs/DECISION_LOG.md`.

## Ordered Active List

### 0. Workflow / Docs / Skills Simplification

Status: completed; this is now the workflow baseline.

Why it matters: future ordinary work should not require huge repeated prompts or rereading all history. Current docs must distinguish active truth from superseded Speaking validation history.

Minimum scope:

- simplify durable workflow docs;
- add repo-local `$ielts-implement` and `$ielts-closeout` skills;
- add the generalization rule that user samples are regression evidence, not production content.

Non-scope:

- no product runtime code;
- no source/config/package changes;
- no commit, merge, or push unless a later explicit closeout is requested.

### 1. Speaking Part 1 Topic Follow-Up Flow

Status: development checkpoint implemented; pending post-reinstall browser acceptance.

Why it matters: Part 1 should train short natural answers across a topic thread, not isolated overlong single answers.

Minimum scope:

- one topic with 3-4 examiner-style questions;
- one connected mini-conversation;
- topic-level feedback focused on natural short answers, personal detail, consistency, and avoiding memorized long answers.

Checkpoint implemented:

- topic-thread practice with natural 3-4 question sets, multiple coherent sets for larger topics, and traceable supplements where source topics are incomplete;
- annotated original answers, one cleaner retry answer per question, thread-level patterns, Material Bank, and Next Retry Plan;
- clean-retry integrity, saved-result safeguards, annotation/transcript safety improvements, audio-transcript candidate gating, exact-thread retry, coverage-aware/fair Part 1 selection, and markdown/export cleanup.

Pending acceptance:

- post-reinstall browser checks for low-signal audio candidate adoption, exact-thread retry order, fair random/change-topic behavior, real-provider stance/tense/annotation behavior, no transcript-spelling/pronunciation repair, and corrected Part 1 markdown/export labels.

Non-scope:

- no full mock exam;
- no session-level export unless separately scoped;
- no scoring/provider architecture rewrite.

### 2. Speaking Part 3 Discussion-Flow Refinement

Status: follows after Part 1 topic-thread flow.

Why it matters: Part 3 needs spoken abstract discussion training, not Writing Task 2 spoken aloud.

Minimum scope:

- clustered follow-up questions;
- discussion-level analysis for position, reasoning, contrast, examples, consequences, and nuance;
- preserve current single-question flow unless the new thread behavior is explicitly accepted.

Non-scope:

- no full Speaking mock;
- no Writing behavior changes;
- no pronunciation scoring.

### Future Follow-up: Persistent Speaking Material Library

After Part 1 Topic-Thread feedback is validated, add a later scoped slice that lets learners save selected items from `MY USABLE MATERIAL` and `REUSABLE SPOKEN LANGUAGE` across Part 1 / Part 2 / Part 3 sessions. Initial scope should use local-first storage with review, filter, and delete workflows.

### 3. Audio Transcription Reliability

Why it matters: audio-backed transcription exists but can still fail or fall back, so the editable transcript remains the safe path.

Minimum scope:

- improve reliability/diagnostics of `speaking_audio_transcription`;
- preserve one editable transcript box;
- keep browser/audio/raw details secondary.

Non-scope:

- no grammar correction during transcription;
- no personal glossary or user-specific vocabulary memory;
- no pronunciation score;
- no persistent audio storage unless separately scoped.

### 4. PDF Folder Import + Mainland Active-Bank Publishing + SaaS-Ready Bank Layer

Why it matters: the active mainland seasonal bank needs a traceable update workflow and later admin publishing path.

Minimum scope:

- local-first PDF folder import concept;
- extraction report for review;
- mainland active-bank publishing flow;
- preserve question snapshots in history.
- current mainland seasonal bank is usable but still has source-completeness gaps/partial topics from the available extracted source;
- future PDF import/publishing should improve traceable completeness rather than silently invent missing questions;
- non-mainland material must remain excluded from default mainland practice.

Non-scope:

- no immediate SaaS backend unless separately scoped;
- no unreviewed OCR/LLM output becoming active data;
- no answer/sample paragraphs, translations, guides, Q&A, QR/promo text, page headers/footers, or low-confidence fragments in active bank data.

### 5. Writing Task 2 Target / Score / Feedback Consistency Audit

Why it matters: Speaking target-display simplification does not prove Writing consistency.

Minimum scope:

- audit Task 2 score, feedback blockers, target model answer, rendering, export, and Debug Panel alignment;
- use real or user-provided samples as regression evidence, not hardcoded content.
- pending polish: Target Model Answer highlight explanation exists but is too easy to miss; later move it closer to the model-answer body with a small low-noise `高亮说明` label, without adding a large legend/table or multiple colors.

Non-scope:

- no Speaking changes unless a shared bug is proven;
- no redesign of the annotated essay overlay unless separately scoped.

### 6. Writing Task 1 Calibration With Real Samples

Why it matters: Task 1 target reports are conservative/generated and need real samples before calibration changes.

Minimum scope:

- collect representative Task 1 samples and Debug Panel evidence;
- audit score/feedback/model report consistency.

Non-scope:

- no blind scoring rewrite;
- no interactive chart system;
- no General Training letters unless separately scoped.

## Completed Baseline Pointer

Speaking runtime and feedback stabilization is complete at the validated checkpoint:

- active mainland seasonal bank runtime integrated with V1 fallback;
- one editable transcript box plus audio-backed transcription path;
- structured normal Speaking feedback;
- local Speaking markdown/export generation;
- simplified generated-target display;
- valid adjacent range rendering;
- low/mid-band feedback coverage guardrails.

For historical details, read `docs/DECISION_LOG.md`.
