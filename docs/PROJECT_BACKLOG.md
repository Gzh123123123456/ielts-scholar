# Project Backlog

_Last updated: 2026-05-06_

## P0 — Provider Safety + API Readiness

### 1) API / Gemini Provider (Optional, Mock still default)
- Keep Mock Provider as default.
- Add Gemini as optional provider toggle/path.
- Add Debug Panel visibility for:
  - raw provider response
  - parsed JSON
  - parse error details
- Ensure invalid JSON never crashes UI.
- Add resilient fallback path when provider output is malformed.

### 2) Framework Intelligence (Writing Task 2)
- Add future button: **Generate Framework Summary** / **Extract Final Framework**.
- Use real AI provider to extract from Phase 1 discussion:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
- Require user edit/confirm before moving to Phase 2.

## P1 — Learning Loop Depth

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
- Clean pre-analysis layout.
- Repeated-attempt comparison views.
- Better transcript-based naturalness upgrades.
- Pronunciation remains not formally assessed until real audio scoring exists.
- **Deferred (V1.2+) — Speaking Stuck-Point Assist / Chinese Idea Support**
  - After Stop & Review, allow learner to optionally add a Chinese note for the idea they could not express in English.
  - AI coach rewrites that idea into natural IELTS Speaking English.
  - Return reusable expressions + a suggested continuation from the stuck point.
  - Explicitly out of scope now: real-time bilingual speech recognition.
  - Explicitly out of scope now: SpeechRecognition architecture changes.

## P2 — Mock Exam Productization

### 6) V2 Mock Exam
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
