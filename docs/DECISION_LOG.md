# Decision Log

## [2026-05-16] Speaking Estimate, Band 7+ Target, and Future Interaction Model
- **Decision**: Treat single-question Speaking scores as conservative training estimates excluding pronunciation, while keeping target answers and practice direction at Band 7.0+.
- **Reason**: IELTS Speaking is scored across a full test, so one Part 1/2/3 answer should not look like an official complete Speaking band. Training feedback should still uplift toward at least Band 7.0.
- **Implemented**:
  - Learner-facing Speaking estimate wording now says single-question training estimate / not including pronunciation, and normalization prefers the lower visible half-band when evidence is between bands.
  - Speaking markdown issue lists use Chinese learner-facing labels and a short Chinese explanation column.
  - Speaking reusable expressions and filler notes are filtered more strictly so provider/debug text, bracketed instructions, unclear fragments, and default filler advice do not enter review cards.
  - Provider and mock wording now targets Band 7.0+ for weak/medium answers and Band 8-9 refinement for already-strong answers.
- **Future interaction model**:
  - Part 1 Topic Thread Practice: one topic, 3-4 examiner-style questions, one connected mini-conversation, and one topic-level analysis.
  - Part 2 Single Long Turn Practice: one cue card, one long-turn answer, and one analysis.
  - Part 3 Discussion Thread Practice: one abstract topic cluster, 3-4 related follow-up questions, and one discussion-level analysis.
  - Full Speaking Mock later combines Part 1 topic thread, Part 2 long turn, and Part 3 discussion thread.
- **Explicitly unchanged**: no Part 1 topic-thread UI, no Part 3 discussion-thread UI, no 3-4 question conversation flow, no session-level Speaking export, no provider routing changes, no recording/transcription mechanics changes, no History architecture changes, and no Writing changes.

## [2026-05-16] Speaking Prompt and Minimal Review Card Export
- **Decision**: Calibrate Speaking Part 1/2/3 provider prompts around spoken-answer targets and rebuild attempt-level Speaking markdown as a minimal review card.
- **Reason**: Speaking feedback and exports should feel like concise training notes, not a guided self-study manual or Writing Task 2 advice applied to speech.
- **Implemented**:
  - Part 1 prompt/export stays compact and conversation-oriented, with possible same-topic follow-ups.
  - Part 2 prompt/export emphasizes spoken long-turn story spine.
  - Part 3 prompt/export emphasizes natural spoken discussion logic, examples, and consequences without essay-style connectors.
  - Export removes Start Here, Mission, Ready checklist, Why This Works, Mini Review, weighting labels, duplicate transfer sections, and default filler advice.
  - Safety filtering prevents provider/debug fallback text from entering learning fields or markdown.
- **Future**: Part 1 should later become topic-thread practice: one topic, 3-4 examiner-style follow-up questions, one connected mini-conversation, and final topic-level analysis.
- **Explicitly unchanged**: no Part 1 topic-thread UI, no session-level export, no scoring formula changes, no provider routing changes, no recording/transcription mechanics, no History architecture changes, no Writing changes.

## [2026-05-15] Future Question Bank Entry Points Deferred
- **Decision**: Record **Question bank count + browse/random/select entry points** as future product work, not part of the current markdown/status polish slice.
- **Future scope**:
  - Add low-noise question-bank status near module/practice question cards.
  - Speaking: show Part/topic question count, browse bank, random question, and later topic-filtered random.
  - Writing landing: show Task 1 / Task 2 question count, browse bank, random practice.
  - Writing Task 2 question page: show task type, question count, browse bank, random question.
  - First slice can add visible entry buttons/counts only.
  - Full browse/select modal or panel is a separate larger UI task.
  - Counts must be computed from question data, not hardcoded.
- **Explicitly unchanged**: no question-bank browse/select UI, no picker modal/panel, no disabled future buttons, no scoring/provider changes.

## [2026-05-15] Markdown Export Naming and Chinese-First Notes
- **Decision**: Attempt-level markdown exports for Speaking, Writing Task 2, and Writing Task 1 use deterministic local builders and Chinese-first training-note structures.
- **Implemented**:
  - Filenames now include module, task/part, topic-or-question slug, date, and local HHmm time.
  - Speaking and Writing exports use Chinese-led headings and guidance while preserving English prompts, learner output, corrections, expressions, and model answers.
  - Provider-returned `obsidianMarkdown` is kept only as a compatibility/fallback field when structured feedback is unavailable; local structured feedback controls current final export formatting.
- **Follow-up polish**:
  - Export builders now compress notes for Obsidian review instead of dumping every feedback item.
  - Task 2 filenames use shorter topic/task-type slugs such as `remote-work-outweigh`.
  - Speaking insufficient samples export a Starter Target Answer / Answer Development Plan instead of a fake full upgraded answer.
- **Explicitly unchanged**: no scoring formula changes, no provider routing changes, no UI redesign, no session-level export, no record migration, no `.env.local` edits.

## [2026-05-14] Writing Task 2 Phase 3 Annotation and Score Transparency
- **Decision**: Treat visible Writing Task 2 scores as conservative training estimates with compact provenance, not official IELTS scoring.
- **Implemented**:
  - Annotated My Essay overlay is implemented: source markers open a floating correction card with close/Escape/outside-click, drag/resize, mobile sheet fallback, and a subtle connector line.
  - Old visible Sentence Correction fallback cards were removed from Phase 3; correction data remains preserved for overlay, records, and markdown export.
  - Score cards now show clearer IELTS training dimensions and a compact transparency line with provider source, fallback/normalization indicators, validation issue count when present, and under-250-word cap reason.
- **Scoring note**: Four equal 5.0 visible scores can come from the mock provider, under-length cap, or safety normalization. This does not necessarily mean a real provider gave four identical fine-grained judgments.
- **Explicitly unchanged**: no scoring formula changes, no provider prompt/routing changes, no safety-normalization behavior changes, no API key UI, no `.env.local` edits.
- **Future**: Any deeper score calibration belongs to a separate scoring calibration task, not Phase 3 UI repair.

## [2026-05-13] Writing Task 2 Phase 3 Daily Closeout
- **Decision**: Close the Writing Task 2 Phase 3 repair as a low-noise revision workspace, not an AI report page.
- **Implemented**:
  - Language Bank was split/cleaned into Topic Vocabulary and Expression Upgrade.
  - Topic Vocabulary should remain topic-specific and should not become writing strategy.
  - Expression Upgrade should focus on phrase/frame upgrades and avoid repeated generic explanations.
  - Production logic must remain topic-agnostic; remote-work examples are mock/demo fixtures only, not hardcoded product logic.
  - Submit for Analysis now preserves the submitted essay snapshot and locks the Phase 2 editor while analysis is running.
  - Phase 3 results use `feedback.essay` / submitted snapshot rather than mutable live editor text.
  - Stale provider responses are ignored through run-id protection.
  - Timeout/stop/failure preserve essay text, avoid fake feedback, and do not move to Phase 3.
  - Same-question rewrite / Practice this question again creates a fresh attempt; New Question chooses a different prompt when possible.
  - Target Model Excerpt / Revision Mission was reworked into Target Model Answer.
  - Target Model Answer should be a full training target answer, about 280-350 words, preserving learner position, fixing the highest-priority Logic Review issue, and integrating Language Bank / Expression Upgrade / key corrections.
  - Sentence Correction cards were reduced in noise and now use grey/problem or strikethrough-style source marking, not Target Model Answer learning-highlight styling.
  - Phrase-level issues should mark only the exact problematic phrase when possible. Whole-sentence rewrite is reserved for cases where no reliable phrase-level source exists or the sentence-level logic/function is the issue.
  - `sourceQuote`, `severity`, `issueType`, and `microUpgrades` remain preserved for future annotation work.
- **Known follow-up**: Target Model Answer highlight explanation already exists but is too easy to miss. Move it closer to the model answer body later and use a small low-noise `高亮说明` label. Do not add a large legend/table or many colors.
- **Next planned task**: Annotated Essay interaction / My Essay annotation. Integrate Sentence Corrections into My Essay source text; likely behavior is source-span problem marking with click/hover correction overlay showing original issue, correction, Chinese explanation, related Language Bank, and related Logic Review. Do not start this task without explicit scope.
- **Collaboration workflow confirmed**: Claude Code handles docs/status/lint/build/verification only unless explicitly instructed; Codex handles main product implementation; GitHub is the sync point; merge/push happens only during daily closeout or explicit approval; future prompts should include plain-language verification steps.
- **Explicitly unchanged**: no interactive annotation overlay, no click popovers, no dot markers, no provider routing changes, no `.env.local` / API key edits, no server/auth/database/RAG, no Speaking feature work.

## [2026-05-13] Speaking Note Standard Final Handoff
- **Decision**: Finalize the Speaking note standard design. Do not create new versions, do not split by part, do not over-engineer P0/P1/P2.
- **Reason**: The standard has been validated across three full Topic Session notes (Work, Accommodation, Hometown). Further iteration on the format itself is diminishing returns. The remaining work is product implementation.
- **Final decisions confirmed**:
  - One unified standard for all speaking parts and session sizes.
  - Session density: Single Question (1 Q, no P0/P1/P2), Mini Session (2–4 Q, no P0/P1/P2), Topic Session (5+ Q, with P0/P1/P2).
  - P0/P1/P2 is internal weighting logic for Topic Sessions only — not a template system.
  - Part 1 single-question practice includes Conversation Thread follow-ups.
  - Part 2 includes Story Spine and long-turn retry. Part 3 includes Discussion Path and nuance training.
  - Manual VSCode Claude and future product export use the same standard. Only Source metadata differs.
  - Updated `docs/IELTS_SPEAKING_NOTE_STANDARD.md`, `.claude/commands/ielts-session.md`, `.claude/commands/ielts-export.md`, and all handoff/backlog docs.
  - Personal notes under `notes/ielts/` remain local/gitignored.
- **Next**: After Writing Task 2 Phase 3, implement product Speaking export following this standard. Add Conversation Thread, Material Bank, Error Pattern Bank, Filler Detox, and Transfer Loop gradually.

## [2026-05-12] Final Unified IELTS Speaking Note Standard
- **Decision**: Create one unified Speaking note standard that works for all session sizes (single question, mini session, topic session) and all Speaking parts (Part 1, 2, 3) instead of maintaining separate templates.
- **Reason**: Multiple note versions (v1, v2) and separate Part 1/2/3 templates create fragmentation. A single standard that adapts by session density is simpler to follow and easier to implement in future product export.
- **Implemented**:
  - Created `docs/IELTS_SPEAKING_NOTE_STANDARD.md` — the final standard.
  - Updated `.claude/commands/ielts-session.md` and created `ielts-export.md` to reference the standard.
  - Updated `.gitignore` to protect personal practice data under `notes/ielts/`.
  - Three existing high-frequency notes (Work, Accommodation, Hometown) rewritten into final format under `notes/ielts/speaking/final/` with P0/P1/P2 weighting.
  - Standard includes: session density rules, one universal Attempt Block, expression weighting (Active Today max 3, Recognize Only 5–8), separate filler/template/collocation warnings, quantitative readiness checklists, time-boxed practice plan.
- **Explicitly unchanged**: No product code, no Speaking UI, no Writing UI, no provider routing, no markdown export code, no `.env.local` edits.
- **Next**: After Task 2 Phase 3, update product markdown export to follow this standard.

## [2026-05-12] Speaking Seasonal Question Bank Data Scaffolding (Pass 1)
- **Decision**: Prepare Speaking module data files for the 2026 May-August seasonal IELTS Speaking question bank as a data-layer and documentation preparation task only. Do not connect to runtime behavior yet.
- **Reason**: The data preparation is mechanical and can be done safely without affecting current Speaking, recording, transcription, scoring, feedback, provider routing, History, or Progress logic. This slice is documented as the next small Speaking data slice AFTER the current Writing Task 2 Phase 3 priority.
- **Implemented**:
  - Created `src/data/speaking/` folder with four files (types, bank data, V1 re-export, index).
  - Priority order: latest mainland new > latest mainland reused > evergreen > V1 original > non-mainland.
  - Non-mainland topics stored as optional data with lower priority for mainland practice.
  - Updated all four docs.
- **Explicitly unchanged**: no Speaking UI changes, no runtime bank selection, no recording/transcription/scoring/feedback/provider/History/Progress changes, no `.env.local` edits, no merge, no push.

## [2026-05-12] Speaking Seasonal Question Bank Completeness Pass (Pass 2)
- **Decision**: Fill the two largest incomplete sections (evergreen Part 1 and mainland reused Part 2&3) from the extracted markdown source before handing off to Codex.
- **Reason**: Codex should not need to reconstruct the 26 reused Part 2&3 cue cards and follow-ups from PDF; the data should be ready to connect. The evergreen questions in the first pass were compressed/paraphrased locally and needed to be replaced with the actual source questions.
- **Implemented**:
  - Evergreen Part 1 (5 topics): replaced 4-5 compressed questions per topic with full source question lists (Work or studies: 22 questions, Home/accommodation: 16, Hometown: 14, The area you live in: 7, The city you live in: 11). Marked complete.
  - Mainland reused Part 2&3 (26 topics): replaced all `p2Partial` placeholders with full `p2` entries containing cue card prompt, cue card points, and 5-6 follow-up questions each from the extracted markdown. Marked complete.
  - `p2Partial` helper is retained for definition but is no longer called in section E.
  - Source coverage note added as a comment in the bank file.
  - Updated all four docs.
- **Partial entries remaining** (per source marking):
  - New Part 1: Sports team (1 question), Reading (3 questions), Typing (3 questions) — source marks 待补充.
  - All 14 new Part 2&3 topics — source marks follow-ups as 待补充/pending.
- **Next**: After Writing Task 2 Phase 3 product information architecture/content logic repair is completed, the next small Speaking data slice is "Speaking 2026 May-August seasonal question bank data integration" (runtime selection).

## [2026-05-09] Product Design Principles and Claude Patch Rejection

- **Event**: A Claude Code patch attempted to redesign Writing Task 2 Phase 3 Vocabulary & Expression Upgrade.
- **Decision**: The patch was reverted and is rejected as product direction.
- **Reasons**:
  - Explanatory module text such as "Expression bank for this essay — for revision and future reuse, not another correction list" created UI noise. The design should express itself through structure, not narration.
  - Empty state rules were too aggressive, causing "No expression bank items for this attempt" to appear for a normal essay.
  - Big-picture fixes remained too generic.
  - Claude Code is not currently suitable for product information architecture changes.
- **Actions taken**:
  - Created `docs/PRODUCT_DESIGN_PRINCIPLES.md` as the long-term product design source of truth.
  - Updated `docs/HANDOFF_NEXT_CHAT.md` to document the rejection and current agent role boundaries.
  - Updated `docs/PROJECT_BACKLOG.md` with a clear future task tree for Codex.
  - Updated `AGENTS.md` and `docs/AGENT_WORKFLOW.md` with role boundary notes.
- **Forward direction**:
  - Keep Claude Code to documentation, status checks, and verification.
  - Hand off Phase 3 product UI work to Codex later.
  - Future prompts must turn product principles into concrete task instructions.

## [2026-05-09] Task 2 Phase 3 Content Logic Refinement
- **Decision**: Keep Phase 3 card-based for now, but deepen the content model inside each section before building interactive essay annotations.
- **Reason**: Learners need clearer learning value from each feedback layer before source-text overlays are useful.
- **Implemented**:
  - Sentence corrections now support `primaryIssue`, `secondaryIssues`, and `microUpgrades` while preserving old records.
  - Vocabulary & Expression Upgrade is now a compact learning bank, not a duplicate correction list.
  - Logic-to-correction inference now checks location, task-response markers, off-topic openings, balance/concession gaps, and thesis/conclusion issues more deliberately.
  - Final writing analysis now receives optional Phase 1 framework notes and editable framework summary so new provider output can produce a personalized model excerpt.
  - New provider prompts require a learnable Band 7.5-8 personalized excerpt, not a generic Band 9 essay.
  - Task 2 markdown export includes sentence primary/secondary/micro fields and the personalized excerpt section when supported.
- **Explicitly unchanged**: no underline markers, no dot markers, no popovers, no overlay, no click-to-locate behavior, no provider routing change, no `.env.local` edits, no merge, no push.

## [2026-05-09] Task 2 Phase 3 Feedback Information Architecture
- **Decision**: Treat Task 2 Phase 3 feedback as four separate learner jobs: global essay warnings, big-picture logic/structure review, sentence-level corrections, and topic vocabulary/expression upgrades.
- **Reason**: Under-length warnings, lexical polish, paragraph logic, and local sentence fixes were competing in the same visual hierarchy, which made the most important revision task harder to see.
- **Implemented**:
  - Added normalized `essayLevelWarnings`, `location`, `issueType`, and `vocabularyUpgrade` support for Writing Task 2 feedback.
  - Under-length / insufficient-sample feedback is displayed above detailed feedback as **Essay-level Warnings** instead of inside **Logic & Structure Review**.
  - Logic issues are grouped by Whole Essay, Introduction, Body Paragraph 1, Body Paragraph 2, Conclusion, or Unknown / General.
  - Logic issues link to compact correction-number references when provider output or safe local inference can find related sentence corrections.
  - Pure lexical / grammar / local wording issues are filtered away from logic review and remain in sentence corrections or vocabulary upgrades unless they affect task response or structure.
  - Task 2 markdown export now uses the same hierarchy as the UI.
- **Explicitly unchanged**: no inline annotations, no click overlay, no provider routing change, no `.env.local` edits, no merge, no push.

## [2026-05-09] Task 2 Framework UX and Linked Feedback Repair
- **Decision**: Keep Task 2 phase tabs as one shared equal-width grid and constrain tab text inside each grid cell.
- **Root cause**: The tabs were already in a 3-column grid, but `.phase-tab` used `whitespace-nowrap`; longer labels such as Phase 3 visually overflowed their equal cell and made the active tab look wider or offset.
- **Implemented**:
  - Active/inactive/disabled phase tab states now change color/opacity only.
  - Framework summary buttons now follow three states: keep discussing, ready-generate-summary, and use-generated-framework-to-start-writing.
  - Generated framework summaries now ask for clear bilingual sections plus reusable sentence frames.
  - Phase 3 now separates **Logic & Structure Review** from **Sentence-level Corrections**.
  - Sentence corrections receive stable numbers, and logic issues link to related correction IDs or mark themselves as paragraph-level only.
- **Explicitly unchanged**: no V1.3 inline annotation, no click-to-highlight, no `.env.local` edits, no merge, no push.

## [2026-05-09] Task 2 Framework Coach Readiness Flow
- **Decision**: Treat Writing Task 2 Phase 1 as a readiness-gated framework workflow, not a generic chat loop.
- **Reason**: Learners need to know when their framework is ready enough to write, and Gemini quota should remain reserved for high-value final feedback.
- **Implemented**:
  - Framework Coach now returns `not_ready`, `almost_ready`, or `ready_to_write` with a Task 2 checklist.
  - `ready_to_write` stops asking more questions and unlocks **Framework Ready — Generate Summary**.
  - Enter inserts a newline; Ctrl/Cmd+Enter sends to coach.
  - Coach requests can be stopped best-effort, and the latest coach feedback can be deleted without removing user notes.
  - Framework Summary generation is grounded in notes, coach discussion, and unsent draft notes, and uses a bilingual editable structure.
  - Learners can skip framework discussion and start writing without an AI call.
  - In auto mode, framework coach and extraction continue to use DeepSeek V4 Flash; Gemini remains reserved for final feedback.
- **Explicitly unchanged**: no V1.3 sentence mapping work, no `.env.local` edits, no merge, no push.

## [2026-05-09] Provider Router Integration Fixes and Task 2 Framework Flow
- **Decision**: Keep Task 2 intermediate framework work off Gemini in auto mode.
- **Reason**: Framework coaching and summary extraction are low-cost planning steps; Gemini quota should be reserved for high-value final feedback.
- **Implemented**:
  - Added distinct `writing_framework_coach` diagnostics and routing.
  - Framework Coach uses DeepSeek V4 Flash in `VITE_AI_PROVIDER=auto` when DeepSeek is configured, otherwise local mock fallback is labeled as such.
  - Framework Summary continues to use `writing_framework_extraction`, also preferring DeepSeek V4 Flash in auto mode.
  - Framework Summary prompts now require grounding in user notes / coach discussion / unsent draft notes; missing decisions are marked instead of invented.
  - Removed the permanent Task 2 provider banner and restored stable three-column phase tabs.
  - API Status now clearly distinguishes auto router active, Gemini-only mode with auto fallback inactive, and DeepSeek fallback unavailable.
- **Env note**: Changing Vite env values such as `VITE_AI_PROVIDER` or provider keys requires restarting the local dev server.
- **Explicitly unchanged**: no V1.3 sentence mapping work, no provider UI key input, no merge, no push.

## [2026-05-09] Personal Provider Router v1, API Status, and Local Reset
- **Decision**: Keep Mock Provider as default, while adding `VITE_AI_PROVIDER=auto` for personal local development.
- **Reason**: Real-provider experimentation should be useful without making the prototype depend on paid APIs or browser-entered keys.
- **Implemented**:
  - Added DeepSeek provider through OpenAI-compatible chat completions.
  - Added quota-aware routing: Gemini is used for high-value final feedback when local estimates allow; DeepSeek V4 Flash handles lower-cost fallback and framework extraction.
  - Added Task 2 Pro fallback protection: DeepSeek V4 Pro is allowed before `2026-05-31T15:59:00Z`, then disabled unless explicitly allowed by env.
  - Added local API usage/router state in `localStorage`, API Status panel, Gemini cooldown handling, and one automatic DeepSeek retry after Gemini quota/rate failures.
  - Added Progress local-data reset for IELTS Scholar browser data only.
- **Security note**: Vite/client env keys remain local-personal prototype only. API keys must not appear in Debug Panel, diagnostics, markdown exports, console logs, or usage records.
- **Future direction**: OpenAI-compatible/OpenRouter UI remains hidden/future and is not implemented.

## [2026-05-09] UI Closeout: Global Shells and Feedback Rendering
- **Decision**: Keep one global TopBar width independent from page content width.
- **Reason**: Switching between medium landing pages and wide practice/history/progress pages should not move the top navigation inward or outward.
- **Implemented**:
  - Added a TopBar shell class and constrained medium/wide content below it rather than constraining the nav itself.
  - Kept landing pages medium and upper-aligned while restoring Speaking Practice to the wide practice workspace.
- **Decision**: Treat insufficient Speaking samples as an answer-development problem at render time.
- **Reason**: Very short or low-signal transcripts, including old restored records, should not display a full high-band rewrite just because one exists in stored feedback.
- **Implemented**:
  - Speaking feedback shows **Answer Development Plan** instead of full High-Band Transformation for insufficient samples.
  - The transformation card stays aligned with the main wide feedback container while long text uses readable line length.
  - Writing Task 2 correction labels are display-mapped from schema/provider keys to readable Chinese-first labels.
- **Explicitly unchanged**: no provider-default changes, no scoring formula changes, no record mutation/migration, no exports/routing/RAG/database/server/auth/API-key changes.

## [2026-05-08] Practice Pages Focus on Current Work
- **Decision**: Active practice pages should focus on the current Speaking or Writing attempt, not expanded record management panels.
- **Reason**: Large Recent Attempts / Practice Records panels duplicated History and made the practice workspace feel cluttered.
- **Implemented**:
  - Removed large record-list panels from Speaking Practice and Writing Task 2 Practice.
  - Kept Practice History as the main learner-facing record center for review, restore, export, and delete.
  - Removed the Writing landing Approach block and simplified Home copy while preserving the warm paper style.
- **Decision**: All visible score-like values remain conservative Training Estimates, not official IELTS scores.
- **Reason**: Short answers and thin local evidence should never imply official scoring precision or overstate readiness.
- **Implemented**:
  - Speaking short-sample guardrails apply to Parts 1/2/3, with stricter caps for Part 2 long-turn and Part 3 developed reasoning.
  - Writing Task 1 under 150 words and Task 2 under 250 words are accepted but capped conservatively with insufficient-sample feedback.
  - Progress estimates round to whole/half bands and cap thin evidence so one high record does not dominate.
- **Explicitly unchanged**: no provider-default change, no RAG, no database, no server/auth/API-key architecture changes, no new routes, no Mock Exam, no record auto-clearing, no merge, no push.

## [2026-05-08] Conservative Training Estimates, Split Writing Coverage, and Shared Layout Shells
- **Decision**: Treat all visible band values as local training estimates, rounded to whole/half bands and calculated conservatively.
- **Reason**: The app should not imply official IELTS scoring precision, and one high local attempt should not dominate learner-facing estimates.
- **Implemented**:
  - Added shared band helpers for half-band display and conservative recent estimates.
  - Progress combines Task 1 and Task 2 writing evidence separately, with Task 2 weighted more heavily when both exist.
  - Mock/local guardrails cap extremely short and under-length Task 1/Task 2 responses so short samples do not receive high estimates.
- **Decision**: Task 1 Progress coverage prioritizes visual type, not topic.
- **Reason**: Academic Task 1 improvement depends strongly on visual genre coverage; Task 2 remains topic-driven.
- **Implemented**:
  - Progress now separates Writing Task 1 Visual Type Coverage from Writing Task 2 Topic Coverage.
  - Recent writing estimate labels distinguish Task 1 visual type from Task 2 topic/type.
- **Decision**: Use shared layout shells for page width and workspace consistency.
- **Reason**: Navigation and practice pages should feel aligned without scattered max-width overrides.
- **Implemented**:
  - Added `.page-shell`, `.page-shell--medium`, `.page-shell--wide`, `.practice-workspace`, and `.reading-comfort`.
  - Medium shells are used for landing pages; wide shells are used for dense practice, History, and Progress surfaces.
- **Explicitly unchanged**: no provider-default change, no RAG, no database, no server/auth/API-key architecture changes, no new major routes, no interactive charts, no record auto-clearing, no merge, no push.

## [2026-05-08] Writing Task 1 Academic Before Mock Exam
- **Decision**: Implement Academic Writing Task 1 Basic Practice before starting V2 Mock Exam.
- **Reason**: Mock Exam should come after the core practice modules exist: Speaking, Writing Task 1 Academic, and Writing Task 2.
- **Implemented**:
  - Replaced the Writing Task 1 placeholder with a minimal Academic Task 1 practice page.
  - Added a small original Academic Task 1 prompt bank with task type, topic/tags, instruction, text visual brief, data details, expected overview/key features/comparisons, common traps, and reusable report patterns.
  - Added Task 1-specific feedback schema, provider interface support, safe wrapper diagnostics, and Mock Provider analysis.
  - Saved Task 1 local-first records under the stable practice-record list without clearing old records.
  - Practice History and Progress recognize Writing Task 1 records minimally.
- **Explicitly unchanged**: no GT letters, no interactive charts, no OCR/image upload, no RAG, no database, no server, no auth, no provider-default change, no Mock Exam.

## [2026-05-08] Text-Based Visual Briefs First
- **Decision**: Use text-based visual briefs and simple data cards for Academic Task 1 V1.2.
- **Reason**: This keeps the module usable locally without chart rendering complexity, upload/OCR scope, or visual-interaction work.
- **Later**: interactive chart rendering, richer data accuracy mapping, and official-source review remain future roadmap items.

## [2026-05-08] Reusable Report Patterns, Not Memorized Templates
- **Decision**: Task 1 feedback should provide reusable report moves/patterns rather than fixed memorized templates.
- **Reason**: Learners need transferable structure for overview, grouping, comparison, sequence, and map description without producing formulaic reports.

## [2026-05-08] Persist Prep Topic Metadata and Protect Local Records
- **Decision**: Persist static preparation topic metadata on new practice records and protect the local-first record store from automatic cleanup.
- **Reason**: Progress recommendations should work from stable local evidence, while local practice records must not disappear during app start, route navigation, dev-server restart, or malformed-data handling.
- **Implemented**:
  - New Speaking records store topic, tags, and part metadata when prompt metadata is available.
  - New Writing Task 2 records store topic, tags, task type, and task metadata when prompt metadata is available.
  - Progress now shows a rule-based **Suggested Training Plan** with up to 3 prioritized suggestions and reasons.
  - Practice record reads ignore malformed/unknown old entries for display without deleting them.
  - Removed automatic record-list truncation from practice-record upsert.
  - Active Writing deletion now requires a matching record id.
- **Explicitly unchanged**: no provider changes, no RAG, no database, no server, no auth, no routing architecture change, no History UI change, no AI auto-tagging, no localStorage migration, no bulk delete.

## [2026-05-08] Progress Topic Coverage Uses Static Prep Taxonomy
- **Decision**: Add topic coverage to Progress using static preparation categories on the local prompt bank.
- **Reason**: Learners need a simple view of which Speaking and Writing Task 2 areas they have practiced, without implying an official IELTS syllabus or adding AI auto-tagging.
- **Implemented**:
  - Added static topic-category metadata and tags to existing Speaking and Writing Task 2 prompt bank items.
  - Progress topic matching prefers metadata stored on records, falls back to prompt-bank matching, then uses a small keyword fallback.
  - Added Speaking Topic Coverage and Writing Task 2 Topic Coverage with practiced counts and `Not yet` markers.
  - Added rule-based Recommended Next Focus for one under-practiced Speaking category and one under-practiced Writing Task 2 category.
  - Removed Recent Practice Records from Progress to avoid duplicating History management.
- **Explicitly unchanged**: no AI tagging, no official-syllabus claim, no provider changes, no RAG, no database, no server, no auth, no save/restore/delete/history behavior changes.

## [2026-05-08] Minimal Local-First Practice History Entry
- **Decision**: Add a small Practice History entry point for existing localStorage practice records.
- **Reason**: Users needed a way to review and restore saved Speaking Practice and Writing Task 2 attempts without entering a page that immediately feels like a new practice session.
- **Implemented**:
  - Added `/practice-history`.
  - Reused the existing `ielts_practice_records_v1` record list and active-attempt restore helpers.
  - Speaking history shows part, question, timestamp, transcript preview, and status.
  - Writing Task 2 history shows prompt, timestamp, essay/framework preview, and status.
  - Open / Restore writes the selected record to the existing active restore path, then navigates to the relevant Practice page without making an AI call.
  - Added individual Delete actions to Practice History and Writing Task 2 Recent Attempts, scoped to the selected module record.
  - Shortened repeated Writing Task 2 framework helper copy while preserving useful textarea placeholders.
  - Added navigation from Home, TopBar, Speaking, and Writing.
- **Explicitly unchanged**: Mock Provider remains default, no RAG, no database, no server, no auth, no production API key logic, no cross-attempt analytics, no session export, no Mock mode changes, no redesign.

## [2026-05-07] Speaking Practice Records, Prompt Bank, and High-Band Refinement
- **Decision**: Close the first real-use Speaking QA gaps before adding larger product features.
- **Reason**: Practice needed reliable record access, meaningful question switching, and clearer coaching for answers that are already strong.
- **Implemented**:
  - Speaking Practice records are filtered by current Part 1/2/3 and can be deleted individually.
  - Empty question loads no longer create noisy draft records.
  - Change Question now switches to a different available prompt and does not call AI.
  - Added a small original V1 prompt bank for local testing:
    - Speaking Part 1: 11 topics / 36 questions.
    - Speaking Part 2: 12 cue cards.
    - Speaking Part 3: 37 abstract follow-up questions.
    - Writing Task 2: 22 IELTS-style prompts.
  - Speaking feedback uses a wider result layout with Must Fix / Optional Polish, a prominent upgraded answer, and secondary preserved-style context.
  - `obsidianMarkdown`-only provider issues are repaired locally when core Speaking feedback is valid, so valid feedback is not replaced with generic fallback.
  - Added **Band 9 Refinement / Examiner-Friendly Refinement** as a distinct high-level coaching layer for strong answers with few or no true errors.
  - Added **Practice This Question Again** so learners can retry the same prompt while preserving the analyzed attempt.
- **Explicitly unchanged**: Mock Provider remains default, no provider selection changes, no RAG, no pronunciation scoring, no SpeechRecognition behavior change, no Writing layout change, no API usage panel.

## [2026-05-07] Practice Persistence Before More Content
- **Decision**: Prioritize reliable local practice records before expanding question banks or API usage features.
- **Reason**: First real-use QA showed that moving from Speaking Part 1 to Part 2 and back made prior transcripts, feedback, and notes hard to recover. The same risk applies across practice modules.
- **Implemented**:
  - Added a minimal local-first practice record model in `localStorage`.
  - Speaking Practice saves active Part 1/2/3 attempts and restores previous part attempts without re-calling AI.
  - Writing Task 2 saves Phase 1 coach notes, final framework summary, essay draft, and analysis result.
  - Speaking and Writing practice pages include lightweight Recent Attempts access with local view/restore and markdown export when available.
  - Provider unavailable failures are marked separately from parse/schema fallback and no longer appear as successful coaching.
  - Speaking feedback readability was improved with Must Fix / Optional Polish grouping and a more prominent upgraded answer.
- **Explicitly unchanged**: Mock Provider remains default, no new provider, no RAG, no pronunciation scoring, no SpeechRecognition behavior redesign, no question-bank expansion, no API usage panel.

## [2026-05-07] Optional Gemini Provider Path
- **Decision**: Add a minimal optional Gemini Provider path for local development while keeping Mock Provider as the default.
- **Implemented**:
  - Added `GeminiProvider` implementing the existing provider interface:
    - Speaking analysis
    - Writing analysis
    - Writing Task 2 framework extraction
  - Gemini prompts request strict JSON-only output.
  - Gemini returns raw model text so the existing safety wrappers parse, normalize, and capture diagnostics.
  - Provider selection uses Vite env configuration:
    - `VITE_AI_PROVIDER=gemini`
    - `VITE_GEMINI_API_KEY=...`
  - Missing, unknown, or `mock` provider config uses Mock Provider.
  - `VITE_AI_PROVIDER=gemini` without a key safely falls back to Mock Provider and reports the effective provider as a missing-key fallback.
- **Security note**: `VITE_GEMINI_API_KEY` is exposed to browser/client code. This path is suitable only for local/personal prototype use; production key management is not implemented.
- **Explicitly unchanged**: Mock Provider remains default, no UI provider toggle, no browser-side API key input, no RAG, no pronunciation scoring, no SpeakingPractice SpeechRecognition changes, no Writing Task 2 phase-flow changes.

## [2026-05-07] Writing Task 2 Wide Workspace UX
- **Decision**: Change Writing Task 2 from a narrow vertical reading-page layout into a wider desktop writing workspace.
- **Reason**: Writing Task 2 requires frequent cross-reference between the prompt, framework notes, coach discussion, final framework, essay draft, and feedback.
- **Implemented layout**:
  - Phase 1 uses a two-column workspace:
    - left: Framework Notes / Coach Discussion / note input
    - right: Final Framework Summary / Generate Framework Summary / Done with Framework
  - Phase 2 uses a two-column writing workspace:
    - left: framework reference
    - right: essay editor
  - Phase 3 prioritizes:
    - My Essay
    - Key Corrections
    - Framework Logic Review
    - Model Answer Excerpt
    - My Framework only as secondary planning reference
- **Design principle**: Use horizontal workspace on desktop to reduce unnecessary vertical scrolling, while preserving the warm old-paper academic style. Keep mobile/tablet as a clean single-column flow.
- **Explicitly unchanged**: no Gemini connection, Mock Provider remains default, no RAG, no pronunciation scoring, no SpeakingPractice behavior changes, no business logic change to the Writing Task 2 flow.

## [2026-05-07] Mock-Safe Writing Task 2 Framework Extraction
- **Decision**: Implement the V1.1 **Generate Framework Summary** action without connecting a real API provider.
- **Implemented**:
  - Added a `WritingFrameworkSummary` schema before provider changes.
  - Added optional provider method `extractWritingFramework`.
  - Added Mock Provider implementation for deterministic framework extraction.
  - Added `safeExtractWritingFramework` normalization and provider diagnostics.
  - Added a Phase 1 button that extracts current user Coach Discussion / Notes into the existing Final Framework Summary textarea.
  - Generated summary sections:
    - Position
    - View A
    - View B
    - My opinion
    - Paragraph plan
    - Possible example
  - Empty notes show a non-blocking message and do not overwrite manual summary text.
  - Extracted summaries remain fully editable and do not automatically advance to Phase 2.
- **Explicitly unchanged**: Mock Provider remains default, Gemini remains unconnected, no RAG, no sentence-by-sentence coaching, no SpeakingPractice SpeechRecognition changes, no Writing Task 2 phase-flow changes, no UI redesign.

## [2026-05-06] V1.1 Provider Safety + Debug Panel Scaffolding
- **Decision**: Add provider safety scaffolding before connecting any real API provider.
- **Implemented**:
  - Added safe Speaking and Writing analysis wrappers around provider calls.
  - Added runtime normalization for malformed `SpeakingFeedback` and `WritingFeedback`.
  - Missing arrays normalize to `[]`.
  - Missing strings normalize to safe fallback text.
  - Missing scores normalize to safe fallback scores.
  - Provider diagnostics capture module, provider name, request payload, raw response, parsed JSON, parse error, validation errors, fallback-used status, and timestamp.
  - Debug Panel shows the latest provider diagnostic in a collapsible section while preserving existing debug information.
  - Speaking and Writing feedback pages show a small warning when fallback normalization was used.
- **Handoff docs**: `docs/HANDOFF.md` is now the canonical handoff file; the old Claude-specific handoff filename was removed to avoid duplicate/conflicting guidance.
- **Explicitly unchanged**: Mock Provider remains default, Gemini remains unconnected, no RAG, no pronunciation scoring, no SpeechRecognition behavior changes, no architecture rewrite, Debug Panel and Markdown export remain.

## [2026-05-06] UI Readability Polish (Writing Task 2 + Global Paper UI)
- **Decision**: Apply readability-focused UI polish only; no business logic changes.
- **Implemented**:
  - Slightly increased global serif body text size and line height to improve long-form reading comfort.
  - Increased PaperCard internal spacing for less cramped analysis blocks.
  - Increased phase-tab size for clearer phase navigation labels.
  - Improved spacing/line-height on Writing Task 2 Final Analysis sections:
    - My Framework
    - My Essay
    - Key Corrections
    - Framework Logic Review
    - Model Answer Excerpt
- **Style constraints preserved**: warm old-paper notebook aesthetic, serif typography, beige paper background, dark brown ink text, terracotta accent.
- **Explicitly unchanged**: provider/schema, Gemini connection status, RAG, pronunciation scoring, Debug Panel, Markdown export, Mock default.

## [2026-05-06] Deferred Idea Logged — Speaking Stuck-Point Assist / Chinese Idea Support (V1.2+)
- **Decision**: Record as deferred future feature only; do not implement in current UI-polish task.
- **Future concept**:
  - After Stop & Review in Speaking Practice, learner may optionally add a Chinese note describing what they wanted to say.
  - AI coach converts it into natural IELTS Speaking English, gives reusable expressions, and shows how to continue from the stuck point.
- **Guardrails**:
  - No real-time bilingual speech recognition now.
  - No changes to current SpeechRecognition logic in this task.

## [2026-05-06] Speech Recognition Resilience Fixes
- **Fix**: `no-speech` errors no longer treated as fatal in Speaking Practice.
- **Mechanism**: Auto-retry up to 2 times with 500ms delay before each restart. Uses refs (`isRecordingRef`, `fatalSpeechErrorRef`) to avoid React stale-closure bugs.
- **Fix**: Retry button now clears current-attempt state (transcript, feedback, timer, speech error refs) without touching saved sessions.
- **Fix**: `stopRecording` cancels any pending retry timeout and sets fatal flag to prevent restarts after user clicks Done.
- **Note**: Root cause of initial `no-speech` errors was Chrome selecting a previously-removed microphone device — not a code bug. Switched to correct mic resolved it.
- **Decision**: No volume meter, real-time AI correction, or audio-to-AI features added.

## [2026-05-06] Writing Task 2 Practice — Submit Gating Fix
- **Fix**: Phase 2 Submit for Analysis was gated behind `essay.length < 50` (hidden ~17-word threshold), blocking short-text or paragraph-level submissions.
- **New logic**: Button disabled only when `essay.trim().length === 0`.
- **Rationale**: Practice mode should accept paragraph-level and short-answer practice, not just full essays.
- **Word count**: Still displayed; a lightweight hint appears when `0 < wordCount < 20` indicating the text is short and feedback is best treated as paragraph-level practice. Word count does NOT gate submission.
- **Unchanged**: Phase 3 Final Analysis, Mock Provider, Markdown export, static Training Coach sidebar. No real-time sentence-by-sentence coaching, no Gemini.

## [2026-05-06] Writing Task 2 Framework Workflow (V1) and API-Phase Direction
- **Decision (V1)**: Phase 1 separates process and output:
  - **Coach Discussion / Notes** = iterative drafting conversation.
  - **Final Framework Summary** = user-edited consolidated framework used for writing.
- **Decision (V1)**: Final Framework Summary is **manual** (user editable), not auto-generated.
- **Decision (V1)**: Phase 2 displays Final Framework Summary before essay drafting.
- **Decision (V1)**: Phase 3 displays **My Framework** and **My Essay** before feedback sections.
- **Reason**: Real Gemini/API provider is not connected yet; V1 must stay mock-first and deterministic.
- **Future (V1.1 / API phase)**:
  - Add **Generate Framework Summary** / **Extract Final Framework** action.
  - Use real AI provider to summarize Phase 1 coach discussion into structured fields:
    - Position
    - View A
    - View B
    - My opinion
    - Paragraph plan
    - Possible example
  - User must still be able to edit the generated summary before moving to Phase 2.
- **Future writing feedback direction**:
  - Keep My Framework + My Essay placement before feedback.
  - Consider sentence-level correction mapping in later versions.
  - Inline annotation is future scope; explicitly not part of V1.

## [2026-05-06] Session-Level Notes Roadmap Decision
- **Current (V1)**: Markdown export is attempt-level (single speaking attempt or single writing analysis).
- **Future**: Add **Finish Session / Export Session Note**.
- **Session definition**: One session may include multiple speaking attempts, multiple questions, and repeated attempts on the same question.
- **Planned session note content**:
  - repeated error patterns
  - improvement trends across attempts
  - best upgraded answers
  - reusable expressions
  - review cards for spaced repetition

## [2026-05-06] IELTS Knowledge Layer Added
- **Added**: `/knowledge/ielts` Markdown files as app-usable feedback rules (rubric, strategy, error patterns, style boundaries, note-generation standards).
- **Decision**: Knowledge files are not answer banks or textbooks; they provide rubric, tag, style, and note-generation constraints.
- **Decision**: Uploaded learning PDFs are summarized as non-official references; no long copyrighted excerpts copied.
- **Decision**: Runtime AI should generate targeted feedback from the user's actual answer combined with relevant knowledge rules, rather than paste generic knowledge content.

## [2026-05-05] V1 Architecture Choices
- **Decision**: No real-time correction in Speaking Practice.
- **Reason**: To protect fluency. Correction should be a post-output reflection phase.

- **Decision**: Use Mock Provider by default.
- **Reason**: Ensure prototype works standalone without API keys and allows user to see the UI structure first.

- **Decision**: localStorage for storage.
- **Reason**: Simplest mechanism for browser-only prototype. Documentation provided for transition to IndexedDB or local files.

- **Decision**: Georgia/Serif typography + Warm Paper colors.
- **Reason**: Match the psychology of "serious study" vs "quick chat".

## [2026-05-06] Current State Lock for UI Polish + V1.1 Planning
- **Locked behavior**:
  - Writing Task 2 Phase 1 separates Coach Discussion from Final Framework Summary.
  - Final Framework Summary is user-edited manually in V1.
  - Phase 2 shows Final Framework Summary before essay drafting.
  - Phase 3 shows My Framework and My Essay before feedback.
  - Writing Submit gating remains empty-only (`essay.trim().length === 0`).
  - Speaking no-speech auto-retry, Retry cleanup, and Stop & Review protection remain preserved.
  - Mock Provider remains default; Gemini/API remains unconnected.
  - V1 pronunciation remains not formally assessed.

- **Deferred to V1.1+**:
  - API-assisted framework extraction (Generate/Extract Final Framework).
  - Session-level export (Finish Session / Export Session Note).
  - Sentence-level correction mapping and later inline annotation.
  - Advanced speaking comparison and pronunciation scoring.

- **Do Not Do Yet policy reaffirmed**:
  - No Gemini connection during UI polish.
  - No RAG yet.
  - No pronunciation scoring yet.
  - No full inline annotation editor yet.
  - No provider-default swap away from Mock.
  - No architecture rewrite.
