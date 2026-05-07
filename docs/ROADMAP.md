# Roadmap

_Last updated: 2026-05-07_

## V1.1 — API Readiness + Framework Intelligence
- Keep Mock Provider as default.
- Add Gemini provider as optional path.
  - Done in Slice 1 as env-configured local-development path.
  - Mock Provider remains default.
  - No UI provider toggle or production key management yet.
- Add Debug Panel diagnostics for raw response, parsed JSON, and parse errors.
- Ensure invalid JSON does not crash UI.

### Writing Task 2 Framework Intelligence
- Add **Generate Framework Summary** / **Extract Final Framework**.
- Extract structured framework from Phase 1 discussion:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
- Require user edit/confirmation before entering Phase 2.

## V1.2 — Session-Level Note System
- Add **Finish Session / Export Session Note**.
- Aggregate multi-attempt learning across a full study session.
- Include repeated error patterns, improvements, best upgraded answers, reusable expressions, and review cards.
- Add **Speaking Stuck-Point Assist / Chinese Idea Support** (post-review optional note):
  - Learner can add a Chinese note after Stop & Review to explain intended meaning.
  - AI converts intended meaning into natural IELTS Speaking English.
  - AI provides reusable expressions and a suggested continuation from the stuck point.
  - No real-time bilingual speech recognition in this phase.

## V1.3 — Feedback Granularity Upgrade
- Sentence numbering and correction-to-source mapping.
- Click-to-locate correction.
- Inline annotation later (not full editor yet).

## V2 — Mock Exam Update
- Dedicated Speaking and Writing Task 2 mock flows.
- Strict timers and sequential Speaking Part 1/2/3.
- Writing Task 2 40-minute mock mode.
- End-of-session report.
- Practice and Mock modes remain separate.

## V3 — Data & Visualization
- Task 1 Academic charts with interaction.
- Writing Task 1 should follow the established Writing workspace system when implemented:
  - wider desktop workspace
  - prompt/chart context area
  - writing editor
  - feedback area
  - reduced unnecessary vertical scrolling
- Task 1 General Training letter prompts.
- Audio recording storage (MediaRecorder) and simple playback.

## V4 — Knowledge & RAG (Later)
- PDF RAG for personal IELTS materials.
- Local filesystem access options.
- Advanced pronunciation scoring integration (after reliable audio scoring path).

## Future UI Polish
- Speaking UI polish may be considered later, but should remain lighter than Writing because Speaking has lower simultaneous information density.
- Keep Practice mode and Mock mode separate.

---

## Do Not Do Yet
- Do not connect Gemini during UI polish.
- Do not add RAG yet.
- Do not add pronunciation scoring yet.
- Do not implement full inline annotation editor yet.
- Do not replace Mock Provider as default.
- Do not rewrite app architecture.
