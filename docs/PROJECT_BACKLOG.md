# Project Backlog

_Last updated: 2026-05-09_

## P0 — Provider Safety + API Readiness

### 1) API / Gemini Provider (Optional, Mock still default)
- Keep Mock Provider as default.
- **Done in V1.1 Slice 1**: Add Gemini as an optional env-configured provider path for local development.
- Gemini configuration:
  - `VITE_AI_PROVIDER=gemini`
  - `VITE_GEMINI_API_KEY=...`
- Missing Gemini API key safely falls back to Mock Provider.
- `VITE_GEMINI_API_KEY` is exposed to browser/client code and is suitable only for local/personal prototype use.
- No production key management exists yet.
- **Done in V1.1 scaffolding**: provider safety wrappers normalize malformed Speaking/Writing feedback and prevent invalid provider output from crashing feedback UI.
- **Done in V1.1 scaffolding**: Debug Panel visibility for latest provider diagnostic:
  - raw provider response
  - parsed JSON
  - parse error details
  - validation errors
  - fallback-used status
- Ensure invalid JSON never crashes UI. *(Scaffolded via safe wrappers; real provider connection still pending.)*
- Add resilient fallback path when provider output is malformed. *(Scaffolded for existing provider interface.)*
- Still pending: UI provider toggle, browser-side key input decision, and production-safe server-side key management.

### 2) Framework Intelligence (Writing Task 2)
- **Done mock-safe in V1.1**: Add **Generate Framework Summary** / **Extract Final Framework** action using Mock Provider by default.
- Still pending: use real AI provider to extract from Phase 1 discussion:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
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
- Step 1: sentence numbering and correction-to-source mapping.
- Step 2: click-to-locate correction.
- Step 3: inline annotation.
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

## Do Not Do Yet
- Do not connect Gemini during UI polish.
- Do not add RAG yet.
- Do not add pronunciation scoring yet.
- Do not implement full inline annotation editor yet.
- Do not replace Mock Provider as default.
- Do not rewrite app architecture.
