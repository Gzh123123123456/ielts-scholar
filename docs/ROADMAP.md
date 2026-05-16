# Roadmap

_Last updated: 2026-05-16_

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
- Done 2026-05-13: Phase 3 learner-facing repair now orders feedback as My Essay -> Essay-level Warnings -> Language Bank -> Logic & Structure Review -> Sentence Corrections -> Target Model Answer, with Chinese-first transferable guidance and aligned markdown export.
- Done 2026-05-13 closeout polish: Submit for Analysis preserves the submitted essay snapshot and locks the Phase 2 editor while analysis runs; stale provider responses are ignored through run-id protection; stop/timeout/failure preserve essay text and avoid fake feedback; Practice this question again creates a fresh same-question attempt; New Question avoids the current prompt when alternatives exist.
- Done 2026-05-13 closeout polish: Target Model Answer is a full answer in page flow, normally about 280-350 words, not a short excerpt or inner-scroll panel. It preserves the learner's position, fixes the highest-priority Logic Review issue, and integrates Language Bank / Expression Upgrade / key corrections as a training target model.
- Done 2026-05-13 closeout polish: Sentence Corrections use grey/problem or strikethrough-style source marking, not Target Model Answer learning-highlight styling. Phrase-level issues should mark only the exact problematic phrase when possible; whole-sentence rewrite is reserved for cases where no reliable phrase-level source exists or the sentence-level logic/function is the issue.

## V1.3 - Speaking Note Standard & Seasonal Bank

### Speaking Prompt / Export Calibration
- **Done 2026-05-16**: Speaking Part 1/2/3 provider prompts and attempt markdown export were recalibrated for spoken IELTS training notes.
- Speaking export now uses a minimal review card: part requirements, answer route, compact issue list, target answer, reusable expressions, and one transfer/follow-up section.
- Speaking single-question estimates are conservative training estimates excluding pronunciation; target answers remain Band 7.0+ training targets, with Band 8-9 refinement reserved for already-strong answers.
- Future interaction model remains pending and roadmap-only:
  - Part 1 Topic Thread Practice: one topic, 3-4 short examiner-style questions, one connected mini-conversation, and one topic-level analysis focused on short natural answers, personal details, consistency, and avoiding memorized long answers.
  - Part 2 Single Long Turn Practice: one cue card, one long-turn answer, and one analysis focused on story spine, detail, timing, and sustained fluency.
  - Part 3 Discussion Thread Practice: one abstract topic cluster, 3-4 related follow-up questions, and one discussion-level analysis focused on position, reasoning, contrast, examples, consequences, and spoken discussion logic.
  - Full Speaking Mock later combines Part 1 topic thread, Part 2 long turn, and Part 3 discussion thread.
- No topic-thread UI, discussion-thread UI, conversation flow, or session-level Speaking export was implemented in this slice.

### Unified Speaking Note Standard *(standard finalized; product export not yet updated)*
- **Done 2026-05-13 (final handoff)**: `docs/IELTS_SPEAKING_NOTE_STANDARD.md` finalized.
- Session density: Single Question (1 Q, no P0/P1/P2), Mini Session (2–4 Q, no P0/P1/P2), Topic Session (5+ Q, with P0/P1/P2).
- Part 1 includes Conversation Thread. Part 2 includes Story Spine + long-turn retry. Part 3 includes Discussion Path + nuance training.
- `/ielts-session` and `/ielts-export` updated.
- Future product markdown export reads this standard as its specification.

### Speaking Seasonal Question Bank (Data Scaffolding)
- **Done 2026-05-12 (scaffolding pass)**: Created `src/data/speaking/` with type definitions, 2026 May-August bank data, V1 re-export, and index with priority helpers.
- **Done 2026-05-12 (completeness pass)**: Evergreen Part 1 (5 topics) and mainland reused Part 2&3 (26 topics) completed with full source questions from extracted markdown. New May topics remain partial only where the source explicitly marks them as 待补充.
- Data files are scaffolding only; runtime selection integration is deferred to a later Codex/product implementation step.
- Non-mainland topics are stored as optional data and should not be default-priority for mainland practice.
- Speaking seasonal bank runtime integration remains pending, but the immediate next planned product task after the 2026-05-13 Writing Task 2 closeout is Annotated Essay interaction / My Essay annotation.

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
- **Step 2 - Interactive Annotated Essay Overlay** is the next planned product task:
  - integrate Sentence Corrections into My Essay source text
  - underline/problem-mark exact source spans
  - click/hover opens a correction overlay
  - overlay includes original issue, correction, Chinese explanation, related Language Bank, and related Logic Review where available
  - use grey/problem source marking, not Target Model Answer learning-highlight style
  - old correction card list can become secondary/collapsible after overlay proves useful
- Step 2 is documented only in the current repair; no inline underline, marker, popover, overlay, or click-to-locate behavior is implemented yet.

### Small Follow-up Before / During Step 2
- Target Model Answer highlight explanation already exists but is too easy to miss.
- Move it closer to the model answer body later and use a small low-noise `高亮说明` label.
- Do not add a large legend/table or many colors.

## V2 - Mock Exam Update
- Dedicated Speaking, Writing Task 1, and Writing Task 2 mock flows after the three basic practice modules exist.
- Strict timers and sequential Speaking Part 1/2/3.
- Writing Task 2 40-minute mock mode.
- End-of-session report.
- Practice and Mock modes remain separate.

## V3 - Data & Visualization
- Question bank count + browse/random/select entry points:
  - Add low-noise question-bank status near Speaking and Writing question cards.
  - Speaking should expose Part/topic count, browse bank, random question, and later topic-filtered random.
  - Writing should expose Task 1 / Task 2 counts, browse bank, random practice, and Task 2 task-type/count context.
  - First slice may add visible entry buttons/counts only; full browse/select modal or panel is separate.
  - Counts must come from question data, not hardcoded values.
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
