# Roadmap

_Last updated: 2026-05-09_

## V1.1 - API Readiness + Framework Intelligence
- Keep Mock Provider as default.
- Add Gemini provider as an optional local-development path.
  - Done as env-configured local-development support.
  - Mock Provider remains default.
  - No UI provider toggle or production key management yet.
- Add Debug Panel diagnostics for raw response, parsed JSON, and parse errors.
- Ensure invalid JSON does not crash UI.
- Add local-first practice reliability for current practice modules.
  - Done: Speaking and Writing Task 2 active attempts and recent records.
  - Done: Speaking records filtered by part and individual Speaking record deletion.
- Add a small original prompt bank for local testing.
  - Done: Speaking Part 1/2/3 and Writing Task 2 prompt coverage sufficient for local QA.
- Improve Speaking feedback readability and high-band usefulness.
  - Done: wider result layout, prominent upgraded answer, and Band 9 Refinement section.
- Current stage: V1.1 closing.

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

## V1.2 - Writing Task 1 Academic Basic Practice
- Add a minimal Academic Task 1 practice page.
- Use text-based visual briefs and simple data cards, not interactive charts.
- Cover line graph, bar chart, table, pie chart, mixed chart, process, and map prompts.
- Add Task 1-specific feedback, reusable report patterns, and local-first Task 1 records.
- Defer General Training letters.
- Session-level notes are deferred until their user value and scope are clearer.

## V1.3 - Feedback Granularity Upgrade
- Sentence numbering and correction-to-source mapping.
- Click-to-locate correction.
- Inline annotation later, not a full editor yet.

## V2 - Mock Exam Update
- Dedicated Speaking, Writing Task 1, and Writing Task 2 mock flows after the three basic practice modules exist.
- Strict timers and sequential Speaking Part 1/2/3.
- Writing Task 2 40-minute mock mode.
- End-of-session report.
- Practice and Mock modes remain separate.

## V3 - Data & Visualization
- Task 1 Academic data-driven chart rendering with richer data accuracy mapping.
- Task 1 General Training letter prompts.
- Stronger scoring calibration using real provider data and larger local attempt samples.
- Optional richer topic taxonomy review, official-source review, and optional AI tagging later.
- Optional manual backup/export for local practice records before any future storage migration.
- Audio recording storage with MediaRecorder and simple playback.

## V4 - Knowledge & RAG (Later)
- PDF RAG for personal IELTS materials.
- Local filesystem access options.
- Advanced pronunciation scoring integration after a reliable audio scoring path exists.

## Future UI Polish
- Global TopBar shell consistency, medium landing shells, wide practice shells, Speaking transformation layout, and feedback label display mapping are complete for current V1 polish.
- Further Speaking UI polish may be considered later, but the active practice page already has larger Part tabs, wide workspace alignment, insufficient-sample transformation suppression, and clearer feedback readability.
- Keep Practice mode and Mock mode separate.

---

## Do Not Do Yet
- Do not connect Gemini during UI polish.
- Do not add RAG yet.
- Do not add pronunciation scoring yet.
- Do not implement full inline annotation editor yet.
- Do not replace Mock Provider as default.
- Do not rewrite app architecture.
