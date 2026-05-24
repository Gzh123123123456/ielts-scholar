# Roadmap

_Last updated: 2026-05-24_

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
  - Done: wider result layout, prominent upgraded answer, and Idea & Expression Upgrade section.
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
- Speaking single-question estimates are conservative training estimates excluding pronunciation. The current answer shows either one estimated training band or a valid adjacent half-band range from one ordinary analysis pass. Target headings are local and pedagogical: current lower bound below 7.0 -> `BAND 7 TARGET ANSWER`; current lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`; high-band-stable -> `STANDARD ANSWER`. Normal Speaking flow does not show learner-facing Band 8+, certification, VERIFIED / NOT VERIFIED, or target self-score states.

### Speaking Transcript Fidelity
- High-priority baseline: learner control of the analyzed transcript matters more than automatic cleanup.
- Do not silently grammar-correct learner speech, tense, articles, prepositions, or contractions.
- Preserve the raw browser transcript separately when Web Speech produces text.
- Analysis uses the user-reviewed editable transcript only.
- Browser ASR review hints may flag likely artifacts, but must not rewrite the transcript automatically.
- Transcript Fidelity v1 review checkpoint is implemented.
- Audio-backed verbatim transcription v1 is implemented:
  - MediaRecorder captures audio in memory beside browser Web Speech during Speaking recording.
  - Browser transcript remains the fast fallback.
  - Provider audio transcription runs automatically after Stop when real Gemini audio transcription is available; Retry transcription remains a small optional control.
  - The UI now centers one editable transcript box for analysis; browser and audio transcripts are collapsed secondary details.
  - A successful real audio transcript becomes the default final transcript draft unless the learner has already edited the final transcript manually.
  - Compact context/keyword hints are supplied to audio transcription to improve likely ASR ambiguities such as proper nouns, IELTS topic words, and common misheard phrases.
  - Hints are disambiguation only and must not grammar-correct, polish, or rewrite learner speech.
  - 2026-05-22 polish: audio transcription context includes Speaking part, current question, cue-card text/bullets, topic/tags, a compact generic IELTS hint list, and the browser transcript as a weak hint only.
  - No personal glossary or user-specific vocabulary memory is used for transcription; topic-derived hints come only from the current prompt context.
  - Provider route banners should stay out of the main Speaking learner UI; provider/model state belongs in Debug Panel and API Status.
  - Mock audio transcription is development-only, clearly labeled, and must not be used as real analysis input.
  - Audio transcription is transcription only, not grammar correction or IELTS feedback.
  - Gemini can support real audio transcription in the current local API setup; DeepSeek does not support audio input here; Mock is development-only and clearly labeled.
- Pronunciation scoring, real-time speech correction, persistent audio storage, and production/SaaS transcription provider policy remain future scope.

## Global Feedback Target Policy

- Current estimates are conservative and must not be inflated to match target outputs.
- Speaking Part 1/2/3 target answers are pedagogical practice resources, not self-certified score guarantees. Normal Speaking flow shows generated `upgradedAnswer` when generation succeeds and does not run target-certification gating before display.
- Speaking Part 1/2/3 use the same learner-facing score display: either an estimated single-question training band or an adjacent half-band range returned by one ordinary `speaking_analysis` pass.
- Valid adjacent half-band ranges render in the learner UI when returned by the normal analysis pass; otherwise the page continues to show a single estimated band.
- Normal Speaking provider responses are structured feedback only. `obsidianMarkdown` is generated locally after successful parsing, and ordinary `speaking_analysis` should not request Band 8+/certification/self-score target fields or `riskNoteZh`.
- Speaking feedback depth guardrail: low-noise feedback means layered, high-impact, readable feedback, not sparse feedback. For 5.0-6.0 answers with enough stable transcript material, the system should surface enough serious errors and important phrase fixes without nitpicking likely ASR artifacts.
- Normal successful Speaking target answers use neutral `generated_target` semantics in diagnostics. `needs_repair`, `target_failed_or_borderline`, verification failure, or certification failure wording should not appear merely because no target certification ran.
- Training targets are minimum Band 7.0+ across Speaking, Writing Task 2, and Writing Task 1.
- If the Speaking current lower bound is 7.0 or above, the next generated answer should be a stronger Band 7+ practice target without promising Band 8+ certification.
- Do not use default learner-facing Band 9 labels or Target Band 7.5 / 7.5-8.0 intermediate labels.
- Band 8+ means stronger logic, precision, examples, naturalness, and examiner-friendly execution; it does not mean more formal or more essay-like language by default.
- Target outputs must apply corrections, idea-development guidance, and retained useful learner material.
- Speaking correction cards should connect to the generated target when useful, and the target answer should visibly apply the most important fixes while preserving useful personal material.
- Speaking single-question estimates remain training estimates and exclude pronunciation when applicable.
- Shared target-state semantics are now part of the roadmap baseline across all five practice modules: `needs_repair`, `generated_target`, `target_failed_or_borderline`, `high_band_boundary`, and `high_band_stable`.
- A 7.5/8.0 split around the high-band threshold is a `high_band_boundary`, not a deterministic contradiction, failure, or fake stable Band 8+ success.
- `STANDARD ANSWER` is only for the existing high-band-stable output. Speaking attempts with current lower bound below 7.0 use `BAND 7 TARGET ANSWER`; attempts with current lower bound at or above 7.0 use `BAND 7+ TARGET ANSWER`.
- Generated targets without independent validation should be described as generated, not validated. Task 1 full target calibration remains future work.
- 2026-05-23 target-display guardrail: no VERIFIED / NOT VERIFIED target status, target-certification unavailable text, certification repair status, or raw provider method errors should appear in the normal Speaking learner UI.
- Internal target certification is not part of the normal Speaking learner flow; any future scoring audit must be separately scoped and must not hide useful generated answers.
- Retesting a generated target through normal Speaking analysis is regression-sensitive because provider/model differences can expose weak target margins; do not fix this by inflating the user's current score.
- Speaking Part 2 is the first visual cleanup pattern for this score layer; broader visual cleanup should be scoped separately.
- Idea/expression upgrade items should be grounded in the learner's original wording or material instead of rendered as generic filler.
- Writing Task 2 should later receive a separate target-consistency audit using its own rubric. Writing Task 1 remains separately calibrated/future-scoped; this Speaking scoring slice does not claim Writing repair.
- Writing Task 2 target/score consistency and Writing Task 1 calibration remain separate future audits; this Speaking slice does not change Writing runtime behavior.
- Part 1 topic-thread practice and Part 3 discussion-thread practice remain future work.
- Future interaction model remains pending and roadmap-only:
  - Part 1 Topic Thread Practice: one topic, 3-4 short examiner-style questions, one connected mini-conversation, and one topic-level analysis focused on short natural answers, personal details, consistency, and avoiding memorized long answers.
  - Part 2 Single Long Turn Practice: one cue card, one long-turn answer, and one analysis focused on story spine, detail, timing, and sustained fluency.
  - Part 3 Discussion Thread Practice: one abstract topic cluster, 3-4 related follow-up questions, and one discussion-level analysis focused on position, reasoning, contrast, examples, consequences, and spoken discussion logic.
  - Full Speaking Mock later combines Part 1 topic thread, Part 2 long turn, and Part 3 discussion thread.
- No topic-thread UI, discussion-thread UI, conversation flow, or session-level Speaking export was implemented in this slice.
- Audio-backed transcription exists, but transcription reliability remains future dedicated work; failure/fallback is still expected in some runs.

### Unified Speaking Note Standard *(standard finalized; product export now follows the minimal review-card direction)*
- **Done 2026-05-13 (final handoff)**: `docs/IELTS_SPEAKING_NOTE_STANDARD.md` finalized.
- Session density: Single Question (1 Q, no P0/P1/P2), Mini Session (2–4 Q, no P0/P1/P2), Topic Session (5+ Q, with P0/P1/P2).
- Part 1 includes Conversation Thread. Part 2 includes Story Spine + long-turn retry. Part 3 includes Discussion Path + nuance training.
- `/ielts-session` and `/ielts-export` updated.
- Product attempt-level markdown export now follows the concise review-card direction; session-level aggregation remains future work.

### Speaking Seasonal Question Bank (Data Scaffolding)
- **Done 2026-05-12 (scaffolding pass)**: Created `src/data/speaking/` with type definitions, 2026 May-August bank data, V1 re-export, and index with priority helpers.
- **Done 2026-05-12 (completeness pass)**: Evergreen Part 1 (5 topics) and mainland reused Part 2&3 (26 topics) completed with full source questions from extracted markdown. New May topics remain partial only where the source explicitly marks them as 待补充.
- **Done 2026-05-17**: lightweight bank picker modals are connected to the existing practice flow.
  - Speaking **Browse Bank** replaces **Read Prompt** and browses only the current Speaking Part.
  - Change Question remains the random-switch action and the Speaking card shows the current-Part bank count only.
  - Writing Task 1 and Task 2 cards show bank counts, Start Practice, and Browse Bank; bank selections route selected prompts into practice pages.
  - The modal backdrop is full viewport; outside clicks do not close it, X closes it, and the list is scrollable.
  - Counts and filter chips are data-derived; practice status counts only analyzed records with feedback.
  - Drafts, empty scratchpad attempts, and provider-failed records do not count as practiced.
  - New functional UI labels should remain English-only; Chinese remains for AI feedback and analysis content.
- Seasonal runtime integration now uses `src/data/speaking/activeSpeakingBank.ts` as the active mainland adapter for Speaking Practice and Progress.
- The adapter preserves V1 fallback, excludes non-mainland prompts, and derives Part 3 questions from mainland Part 2 `followUps`.
- Non-mainland topics are stored as optional data and should not be default-priority for mainland practice.
- Source-quality audit 2026-05-21: the checked repo source material does not contain complete mainland entries for the requested missing Part 1 topics (Music, Scenery, Building, Childhood activities, Views, Life stages) or the requested retained/old Part 2 topics. Sports team, Reading, Typing, and new May Part 2 topics remain partial where the extracted source is partial.
- Full browse page, search, favorites, mastery status, wrong-question notebook, Part 1 topic-thread practice, and Part 3 discussion-thread practice are still future scope.
- Future bank updates should preserve stable IDs plus topic/type/category and tags so filters, counts, and practice-count matching stay accurate.

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
- **Step 2 - Interactive Annotated Essay Overlay** baseline is implemented in Task 2 Phase 3.
  - My Essay source markers open a correction overlay with source/correction details.
  - The baseline includes phrase/sentence matching, severity markers, floating overlay, mobile fallback, connector line, and safe Logic Review linking.
  - Future work is polish/consolidation only unless explicitly scoped; do not rebuild it from scratch.

### Small Follow-up After Step 2
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
- Full question-bank system beyond the lightweight picker:
  - Standalone bank page, search, favorites/mastery, wrong-question notebook, richer filters, and topic-filtered practice are future work.
  - Keep question-bank data stable: `id`, topic/type/category, and tags are required for filters, counts, route-state selection, and practice-count matching.
- Future PDF folder speaking-bank import pipeline:
  - Start local-first with PDFs in `tools/speaking-bank-import/inbox`, draft JSON output, and an `extraction-report.md` review summary.
  - Filter non-mainland topics, answer/sample content, translations, guides, Q&A, QR/promo text, page headers/footers, OCR garbage, and low-confidence fragments before publishing.
  - Merge multiple PDFs into a mainland active-bank union unless items are non-mainland, obsolete, incomplete, or low-confidence.
  - Later SaaS direction can move the same review/publish flow behind an admin upload page, overwrite active practice banks by season, and preserve question snapshots in history.
  - API key/provider/cost policy for SaaS remains undecided future work.
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
