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
- Add personal local-first Provider Router v1.
  - Done: `VITE_AI_PROVIDER=auto`, DeepSeek provider, API Status panel, local usage/router state, Gemini cooldown/retry, and Progress local-data reset.
  - Gemini is quota-aware and reserved for high-value final feedback when local estimates permit.
  - DeepSeek V4 Flash is cheap fallback and framework-extraction default.
  - DeepSeek V4 Pro is Task 2 high-quality fallback before `2026-05-31T15:59:00Z`, then disabled unless explicitly allowed.
  - Official Gemini remaining quota is not readable; UI shows local estimates only.
  - OpenAI-compatible/OpenRouter UI remains a future hidden direction.
  - Auto fallback requires `VITE_AI_PROVIDER=auto`; Gemini-only mode does not use DeepSeek fallback.
  - Vite env changes require restarting the local dev server.
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
- Add `writing_framework_coach` as a distinct low-cost intermediate operation.
- In auto mode with DeepSeek configured, framework coach and framework extraction use DeepSeek V4 Flash and do not spend Gemini.
- Framework Coach now has readiness states (`not_ready`, `almost_ready`, `ready_to_write`) based on a Task 2 planning checklist.
- `ready_to_write` stops the coaching loop and enables **Framework Ready — Generate Summary**; summary generation stays in Phase 1 for editing.
- Enter inserts a newline in Framework Notes; Ctrl/Cmd+Enter sends to Coach.
- Learners can stop a running coach response, delete the latest coach feedback, or skip framework discussion and start writing without AI.
- Extract structured framework from Phase 1 discussion:
  - Position
  - View A
  - View B
  - My opinion
  - Paragraph plan
  - Possible example
- The current extraction format is a bilingual grounded summary; missing learner decisions are marked instead of invented.
- Framework Summary now includes reusable sentence frames/transitions and uses clear bullet sections rather than a dense block.
- Phase 3 feedback now separates **Essay-level Warnings**, **Logic & Structure Review**, **Sentence-level Corrections**, and **Vocabulary & Expression Upgrade**.
- Under-length is a global warning, pure lexical issues stay out of big-picture logic cards, and logic issues link to numbered corrections where relevant.
- Vocabulary & Expression Upgrade is now a compact learning bank; sentence corrections support primary issue, secondary issues, and micro upgrades; personalized model excerpts can be grounded in the learner essay and Phase 1 framework context.
- Phase tab root cause repaired: nowrap labels were visually overflowing equal grid cells.
- Require user edit/confirmation before entering Phase 2.
- Framework Summary must summarize the learner's notes and coach discussion, not generate a full model plan from the prompt alone.
- Task 2 provider banner has been removed; provider notices appear only when routing/fallback events actually occur.
- Phase tab layout is restored to stable three-column alignment.

## V1.2 - Writing Task 1 Academic Basic Practice
- Add a minimal Academic Task 1 practice page.
- Use text-based visual briefs and simple data cards, not interactive charts.
- Cover line graph, bar chart, table, pie chart, mixed chart, process, and map prompts.
- Add Task 1-specific feedback, reusable report patterns, and local-first Task 1 records.
- Defer General Training letters.
- Session-level notes are deferred until their user value and scope are clearer.

## V1.3 - Feedback Granularity Upgrade
- Sentence numbering and correction-to-source mapping. Basic correction numbers and logic-to-correction references are implemented in Phase 3 cards.
- Sentence correction depth. Primary issue, secondary issues, and micro upgrades are implemented in Phase 3 cards.
- **Step 2 - Interactive Annotated Essay Overlay** is the next task only:
  - inject correction markers into the original essay
  - underline/problem-dot on source text
  - click marker to open correction overlay card
  - overlay includes correction, micro vocabulary upgrade, and related logic issue
  - right-side Logic Review aligns by essay paragraph
  - old correction card list can become secondary/collapsible
- Step 2 is documented only in the current repair; no inline underline, marker, popover, overlay, or click-to-locate behavior is implemented yet.

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
- Production-safe provider key management through a server-side proxy before any non-personal deployment.
- Future hidden OpenAI-compatible/OpenRouter routing UI after provider architecture settles.
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
