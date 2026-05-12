# Project Backlog

_Last updated: 2026-05-12 (final Speaking note standard)_

## P0 — Provider Safety + API Readiness

### 1) API / Provider Router (Optional, Mock still default)
- Keep Mock Provider as default.
- **Done in V1.1 Slice 1**: Add Gemini as an optional env-configured provider path for local development.
- **Done in Provider Router v1**: Add `VITE_AI_PROVIDER=auto` for personal local development.
- Gemini configuration:
  - `VITE_AI_PROVIDER=gemini`
  - `VITE_GEMINI_API_KEY=...`
- Missing Gemini API key safely falls back to Mock Provider.
- `VITE_GEMINI_API_KEY` is exposed to browser/client code and is suitable only for local/personal prototype use.
- No production key management exists yet.
- Auto-mode configuration includes Gemini local quota estimates and DeepSeek fallback env vars.
- Gemini is quota-aware and used mainly for high-value final feedback.
- DeepSeek V4 Flash is the cheap fallback and low-cost Task 2 framework coach / framework-extraction provider.
- DeepSeek V4 Pro is the Task 2 high-quality fallback before `2026-05-31T15:59:00Z`; it is disabled after that unless `VITE_DEEPSEEK_ALLOW_PRO_AFTER_DISCOUNT=true`.
- API Status panel shows local estimates only; official Gemini remaining quota must be checked in Google AI Studio.
- API Status distinguishes auto mode from Gemini-only mode, and reports DeepSeek fallback unavailable when auto/config is missing.
- Vite env changes require restarting the local dev server.
- **Done in V1.1 scaffolding**: provider safety wrappers normalize malformed Speaking/Writing feedback and prevent invalid provider output from crashing feedback UI.
- **Done in V1.1 scaffolding**: Debug Panel visibility for latest provider diagnostic:
  - raw provider response
  - parsed JSON
  - parse error details
  - validation errors
  - fallback-used status
- Ensure invalid JSON never crashes UI. *(Scaffolded via safe wrappers; real provider connection still pending.)*
- Add resilient fallback path when provider output is malformed. *(Scaffolded for existing provider interface.)*
- Still pending: UI provider toggle, browser-side key input decision, production-safe server-side key management, and future hidden OpenAI-compatible/OpenRouter UI.

### 2) Framework Intelligence (Writing Task 2)
- **Done mock-safe in V1.1**: Add **Generate Framework Summary** / **Extract Final Framework** action using Mock Provider by default.
- **Done Provider Router v1 integration fix**: Add low-cost `writing_framework_coach` and route both coach/extraction to DeepSeek V4 Flash in auto mode when configured.
- **Done Provider Router v1 integration fix**: Framework Summary is grounded in user notes, coach feedback/discussion, and unsent draft notes; missing decisions are marked rather than invented.
- **Done Task 2 coach readiness flow**: Framework Coach returns `not_ready`, `almost_ready`, or `ready_to_write`; ready-to-write gates summary generation and stops the generic coaching loop.
- **Done Task 2 coach readiness flow**: Enter inserts a newline, Ctrl/Cmd+Enter sends, Stop generating cancels/ignores late coach responses best-effort, and Delete last coach feedback removes only the latest coach item.
- **Done Task 2 coach readiness flow**: Learners can skip framework discussion and start writing without an AI call.
- Summary fields:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
- Current summary UI now presents a bilingual editable learning structure rather than a full model answer.
- **Done Task 2 UX repair**: Framework summary button states now distinguish not/almost ready, ready-without-summary, and generated-summary cases.
- **Done Task 2 UX repair**: Framework summaries include reusable sentence frames/transitions and stay editable.
- **Done Task 2 feedback hierarchy**: Phase 3 separates essay-level warnings, logic/structure review, sentence-level corrections, and vocabulary/expression upgrades.
- **Done Task 2 feedback hierarchy**: under-length is treated as a global warning, pure lexical issues stay out of big-picture logic cards, and logic issues link to correction numbers when relevant.
- **Done Task 2 feedback content refinement**: Vocabulary & Expression Upgrade is a compact learning bank; sentence corrections support primary issue, secondary issues, and micro upgrades; personalized model excerpts can use learner essay/framework context.
- Require user edit/confirm before moving to Phase 2.

### 2b) Future UI Consistency Notes
- **Done closeout**: Speaking Practice now uses the shared wide practice workspace consistently with Writing Task 1 / Task 2, while the High-Band Transformation text itself keeps a readable inner width.
- **Done closeout**: global TopBar width is independent from medium/wide page content widths.
- **Done closeout**: learner-facing feedback labels should render readable Chinese-first labels instead of provider/schema enum keys.
- **Done basic V1.2**: Writing Task 1 Academic now inherits the Writing workspace design language in a minimal two-column practice page:
  - wider desktop workspace
  - prompt/chart context area
  - writing editor
  - feedback area
  - reduced unnecessary vertical scrolling
- Still pending for Task 1:
  - General Training letters later
  - data-driven chart rendering later, kept separate from current text-brief practice
  - richer Task 1 data accuracy mapping later
  - official-source review of topic taxonomy and prompt coverage
  - optional AI tagging later, kept separate from static prep taxonomy

## P1 — Learning Loop Depth

### 2.4) Prompt Bank Depth
- **Done minimal V1.1**: small original local-testing prompt bank:
  - Speaking Part 1: 11 topics / 36 questions.
  - Speaking Part 2: 12 cue cards.
  - Speaking Part 3: 37 follow-up discussion questions.
  - Writing Task 2: 22 prompts across common IELTS Task 2 types.
- **Done minimal V1.1**: static preparation topic metadata supports Progress topic coverage:
  - Speaking: 12 preparation categories.
  - Writing Task 2: 12 preparation categories.
- Still pending:
  - larger curated prompt bank
  - richer topic taxonomy and difficulty metadata
  - stronger scoring calibration with real provider data and larger local attempt samples
  - official-source review, source-quality review, and deduplication
  - optional AI tagging later, clearly separated from static prep taxonomy and never treated as official syllabus coverage
  - topic-filtered practice start from Progress or History
  - prompt rotation analytics

### 2.5) Practice Persistence and History Access
- **Done minimal V1.1**: local-first active attempts and recent records for Speaking Practice and Writing Task 2 Practice.
- **Done basic V1.2**: local-first active attempts and history recognition for Writing Task 1 Academic Practice.
- **Done minimal V1.1**: Speaking records are filtered by current part and can be deleted individually.
- **Done minimal V1.1**: empty Speaking question loads are not saved as noisy drafts.
- Still pending:
  - richer full history dashboard
  - cross-attempt comparison
  - session-level consolidated note export
  - optional manual backup/export for local practice records before any future storage migration
  - storage migration from localStorage to IndexedDB or a local file/database layer if records grow large
  - optional backup/export before bulk local reset if reset becomes common

### 3) Session-level Obsidian Notes
- Current V1: attempt-level export only.
- Future: **Finish Session / Export Session Note**.
- Speaking session can include:
  - multiple parts
  - multiple questions
  - repeated attempts
- Writing session can include:
  - framework discussion
  - drafts
  - feedback
  - revisions
- Session note should summarize:
  - repeated error patterns
  - improvements
  - best upgraded answers
  - reusable expressions
  - review cards

### 4) Sentence-level Feedback
- Step 1: sentence numbering and correction-to-source mapping. *(Basic correction numbers and logic-to-correction references are implemented for Task 2 Phase 3 cards.)*
- Step 1b: sentence correction depth. *(Primary issue, secondary issues, and micro upgrades are implemented for Task 2 Phase 3 cards.)*
- **V1.3 Step 2 - Interactive Annotated Essay Overlay** *(documented only; not implemented yet)*:
  - inject correction markers into the original essay
  - underline/problem-dot on source text
  - click marker to open correction overlay card
  - overlay includes correction, micro vocabulary upgrade, and related logic issue
  - right-side Logic Review aligns by essay paragraph
  - old correction card list can become secondary/collapsible
- Step 3: full inline annotation/editor refinements after Step 2 proves useful.
- Do not implement full inline editor yet.

### 5) Speaking Improvements
- **Done minimal V1.1**: cleaner pre-analysis layout and wider post-analysis feedback layout.
- **Done minimal V1.1**: Change Question works across Parts 1/2/3 when alternatives exist.
- **Done minimal V1.1**: Practice This Question Again starts a fresh attempt for the same prompt without re-calling AI.
- **Done minimal V1.1**: Band 9 Refinement / Examiner-Friendly Refinement layer for already-strong answers.
- Still pending:
  - richer repeated-attempt comparison views
  - more advanced speaking structure coaching beyond the current prompt/schema layer
  - broader transcript-based naturalness upgrades
- Pronunciation remains not formally assessed until real audio scoring exists.
- **Deferred (V1.2+) — Speaking Stuck-Point Assist / Chinese Idea Support**
  - After Stop & Review, allow learner to optionally add a Chinese note for the idea they could not express in English.
  - AI coach rewrites that idea into natural IELTS Speaking English.
  - Return reusable expressions + a suggested continuation from the stuck point.
  - Explicitly out of scope now: real-time bilingual speech recognition.
  - Explicitly out of scope now: SpeechRecognition architecture changes.

## P2 — Mock Exam Productization

### 6) V2 Mock Exam
- Starts after Speaking, Writing Task 1 Academic, and Writing Task 2 basic practice modules exist.
- Strict timers.
- Sequential Speaking Part 1/2/3 flow.
- Writing Task 2 40-minute mock mode.
- End-of-session report.
- Practice mode and Mock mode must remain separate.

---

## P1 Future — Writing Task 2 Phase 3 (Codex Priority)

### Vocabulary & Expression Upgrade Redesign

Redesign according to `docs/PRODUCT_DESIGN_PRINCIPLES.md`.

- Use four confirmed groups:
  - `Topic Vocabulary`
  - `From Your Essay`
  - `Collocations`
  - `Argument Frames`
- Avoid long module explanations.
- Avoid duplicate sentence corrections.
- `From Your Essay` must be phrase-level.
- Universal academic phrases are allowed in small, strongly relevant doses.
- Normal relevant input should not produce an empty vocabulary section.

### Logic Review — Revision Roadmap

- Logic Review should become a revision roadmap with specific paragraph-level fixes.
- Each major logic issue should explain what, why, and what to do.
- Avoid generic fixes; prefer task-specific guidance.

### Personalized Model Answer Excerpt

- Should remain a learner-specific upgraded direction, not a generic Band 9 essay.
- Preserve learner's position and main ideas; fix the specific Phase 3 issues.

---

## P1 Future — V1.3 Annotated Essay Overlay

- Source-text underline / marker / overlay is future work.
- After overlay works, old large sentence correction cards can default-collapse.
- Long-term direction: old large cards may eventually be removed.
- Overlay must be aesthetically clean but must not compress or weaken content.

---

## P1 Future — Writing Task 2 Phase 1 Coach Upgrade

- Framework Coach should be stronger than originally scoped.
- It should not only organize a framework.
- It should point out flawed claims, weak evidence, unsupported examples, imbalance, task-response gaps, and possible better argument directions.
- It should use guided questions / suggestions to train the learner's thinking.
- The stronger Coach is, the less Generate Framework Summary needs to invent.
- Generate Framework Summary should organize already-discussed decisions, not think for the learner.

---

## P1 Future — Speaking Note Standard & Export

### Unified IELTS Speaking Note Standard *(standard created; product export code not yet updated)*
- **Done 2026-05-12**: Created `docs/IELTS_SPEAKING_NOTE_STANDARD.md` — final unified standard for all Speaking training notes.
  - Single standard adapts by session size: single question / mini session / topic session.
  - Part 1, Part 2, and Part 3 share one Attempt Block structure; only Answer Path shape and readiness criteria differ by part.
  - Manual VSCode Claude training uses `/ielts-session` and `/ielts-export` slash commands.
  - Personal practice notes under `notes/ielts/` are gitignored local data.
- **Still pending**:
  - Update product markdown export code to follow this standard.
  - Implement session-level export aggregation.
  - Add Personal Material Bank / Error Pattern Bank / Filler Detox / Transfer Loop to product export gradually.
- **Next** (after Task 2 Phase 3): Update product Speaking export to match `docs/IELTS_SPEAKING_NOTE_STANDARD.md`.

## P1 Future — Speaking Seasonal Question Bank

### Speaking 2026 May-August Seasonal Question Bank Data Scaffolding *(data files created; not connected to runtime)*
- **Done 2026-05-12 (scaffolding pass)**: Created `src/data/speaking/` data folder with:
  - `speakingPromptTypes.ts` — shared types for seasonal Speaking prompts (bank ID, season, region, new/reused/evergreen/non-mainland status, Part 1/2/3, topic, cue card, follow-ups, tags, priority, completeness).
  - `speakingBank2026MayAug.ts` — structured 2026 May-August mainland and non-mainland prompt data.
  - `speakingBankV1.ts` — re-export of existing V1 original prompt bank (no breakage).
  - `speakingBankIndex.ts` — bank metadata, priority helpers, and part-filtered selectors (pure, side-effect-free).
- **Done 2026-05-12 (completeness pass)**:
  - Evergreen Part 1 (5 topics): replaced compressed questions with full source questions from `docs/source_materials/speaking/ielts-speaking-bank-2026-05-to-08.extracted.md`. Marked complete.
  - Mainland reused Part 2&3 (26 topics): replaced all `p2Partial` placeholders with full `p2` entries including cue card, cue points, and complete follow-up questions from extracted markdown. Marked complete.
  - New May Part 1 topics that remain `partial`: Sports team (1 question), Reading (3 questions), Typing (3 questions) — marked partial in the source.
  - New May Part 2&3 topics all remain `partial` — source marks all follow-ups as 待补充/pending.
- Existing `src/data/questions/bank.ts` preserved unchanged; all existing imports continue to work.
- Priority order defined: latest mainland new > latest mainland reused > evergreen > V1 original > non-mainland.
- Non-mainland topics stored as optional data with lower priority for mainland practice.
- **Still pending**:
  - Runtime selection integration — connect the new bank to Speaking Practice prompt selection behavior.
  - PDF runtime parsing of question banks.
  - User-uploaded bank UI.
  - Speaking UI changes for bank selection.
  - Deferred to a later Codex/product implementation step after Writing Task 2 Phase 3 is complete.
- **Next slice** (after Task 2 Phase 3): "Speaking 2026 May-August seasonal question bank data integration."

## P1 Future — Speaking Pre-Answer Coaching

- Speaking should have pre-answer coaching / planning, especially for Part 2 and Part 3.
- Training flow may become:
  - get question
  - plan answer structure / answer pattern
  - then record
  - then transcript + feedback
- Part 2 needs story / cue-card structure support.
- Part 3 needs abstract reasoning, comparison, cause/result, concession, example-building support.
- Transcript fidelity is critical.
- Do not use "smart correction" that silently fixes mispronounced words through context.
- Raw transcript and possible intended word should be separated if better ASR is added.

---

## P1 Future — History

- History should eventually include all user practice data.
- It should not be artificially light.
- The key is clear arrangement, summaries, filters, restore / export paths.
- History should become the learner's practice archive.

---

## P1 Future — Progress

- Progress can include reference band estimates.
- Progress can use tables and data summaries.
- Do not over-warn users that estimates are unofficial.
- Present estimates calmly as training references.
- Future progress can include trends, topic coverage, visual-type coverage, repeated issue statistics, practice frequency, and repeated-attempt comparisons.

---

## P1 Future — Provider / API Direction

- Mock Provider means no-key fallback / local fake feedback path.
- The user's current local setup may call real Gemini / DeepSeek APIs and consume tokens.
- These are not contradictory.
- Future shared / open-source mode may support user-provided API keys before entering the app.
- Website may recommend mainstream model providers.
- Each user should ideally use their own API key instead of consuming the project owner's tokens.
- Production-safe server-side proxy / account / encrypted storage is a later direction, not current priority.

---

## P1 Future — Agent Workflow

- Claude Code is not trusted for product UI / information architecture changes right now.
- Claude Code should be used for docs, status checks, and verification only unless explicitly re-authorized.
- Codex should handle main product / UI implementation once available.

---

## Do Not Do Yet
- Do not connect Gemini during UI polish.
- Do not add RAG yet.
- Do not add pronunciation scoring yet.
- Do not implement full inline annotation editor yet.
- Do not replace Mock Provider as default.
- Do not rewrite app architecture.
