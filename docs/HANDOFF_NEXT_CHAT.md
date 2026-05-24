# Handoff for Next Chat

_Last updated: 2026-05-24_

## Current Snapshot

- Codex is currently the primary implementation agent for scoped product slices.
- Claude Code, if used, is only an optional verifier/docs/status helper unless explicitly approved.
- No active product feature is currently in progress unless the user gives a new scoped task.
- Branch state must be verified by `git status` / `git log`, not by stale commit hashes in docs.
- Task 2 annotated essay overlay baseline is implemented; do not rebuild from scratch.
- Speaking 2026 May-Aug mainland active bank runtime is integrated through the active-bank adapter with V1 fallback.
- Speaking transcript flow has one editable transcript box plus audio-backed transcription, but audio transcription reliability remains a known limitation and can still fall back.
- Task 1 calibration remains future work and needs real Task 1 samples.
- Do not merge/push unless the user explicitly asks for daily closeout.
- Do not change provider routing, server/auth/database/RAG, advanced ASR, or pronunciation scoring unless explicitly scoped.
- For quick code orientation, read `docs/CODEBASE_MAP.md`.

## Repo

https://github.com/Gzh123123123456/ielts-scholar

## Local Path

`D:\Personal\Desktop\ielts-scholar_-local-first-training-agent`

## Current Branch

`main`

## Current Development Environment

Primary implementation environment: Codex for scoped product/product-code slices.

Claude Code, if used, is an optional verifier/docs/status helper unless explicitly approved for a specific task.

GitHub remains the shared sync point between Codex, Claude Code, and future ChatGPT sessions.

## Recent Events

- **2026-05-24 Speaking runtime and feedback stabilization closeout**:
  - Speaking active mainland seasonal bank runtime is now connected through `src/data/speaking/activeSpeakingBank.ts`; old V1 prompts remain fallback data and saved records preserve question snapshots.
  - Normal Speaking analysis keeps a structured provider contract with local markdown/export generation; provider-generated `obsidianMarkdown` and learner-facing Band 8+/certification/self-score target fields remain out of ordinary `speaking_analysis`.
  - Valid adjacent half-band ranges from one normal analysis pass now render in the learner score display; verified runtime evidence showed `5.5-6.0 ESTIMATED RANGE`.
  - Generated target answers display as learning resources when available. The accepted lower-band Part 2 result showed a complete `BAND 7 TARGET ANSWER`.
  - Debug target state for normal successful Speaking analysis is neutral: `targetState:generated_target` and `final generated_target`, not `needs_repair` or `target_failed_or_borderline`.
  - Low/mid-band Speaking feedback has shared coverage/classification guardrails for genuine high-impact issues; the family-album Part 2 answer is regression evidence only, not production-specific logic.
  - Audio-backed transcription exists but can still fail or fall back; do not treat audio transcription reliability as completed.
  - Part 1 topic-thread and Part 3 discussion-thread flow remain future work, and Writing Task 1 / Task 2 runtime behavior was not changed by the Speaking closeout.

- **2026-05-20 high-band boundary + Speaking Part 2 feedback cleanup slice**:
  - Added a shared final target-state vocabulary across all five modules: Speaking Part 1, Speaking Part 2, Speaking Part 3, Writing Task 1 Academic, and Writing Task 2.
  - 7.5/8.0 uncertainty is now `high_band_boundary`, not a deterministic analyzer/validator contradiction. Boundary means close to target but not fully reproducible yet.
  - `high_band_stable` no longer needs replacement output; Speaking can show the current answer as `STANDARD ANSWER` when stable.
  - Speaking Part 2 is the first UI cleanup pattern: module headers now follow the `LANGUAGE PERFORMANCE` style, generic UI guidance is removed, and learner-facing target labels distinguish Band 7.0+ target, Band 8+ target, boundary target, repair, and standard answer.
  - Speaking idea/expression upgrades must be grounded in the user answer; ungrounded generic items are omitted instead of rendered as filler.
  - Markdown export mirrors the semantic labels and avoids Risk note / empty replacement artifacts.
  - Task 1 remains visually conservative and not redesigned; it uses the shared target-state vocabulary and marks generated target reports as generated rather than independently validated.
  - Plugin/notranslate remains considered solved and should not be reopened unless a direct regression appears.

- **2026-05-23 Speaking response-contract cleanup slice**:
  - Normal Speaking analysis provider JSON is structured feedback only; Gemini/DeepSeek/Mock are no longer asked to generate `obsidianMarkdown`.
  - Speaking markdown/export remains available because the app builds it locally after successful parsing.
  - Normal Speaking provider output no longer requests Band 8+/certification/self-score target fields or `riskNoteZh`.
  - Boundary ranges remain active, and target headings stay local: lower bound below 7.0 -> `BAND 7 TARGET ANSWER`; lower bound at or above 7.0 -> `BAND 7+ TARGET ANSWER`; high-band-stable -> `STANDARD ANSWER`.
  - Low/mid-band Speaking feedback depth remains active across Parts 1/2/3, including MUST FIX, HIGH-IMPACT PHRASE FIXES, and PERSONAL MATERIAL & IDEA EXPANSION where the transcript supports them.
  - Speaking transcription/audio behavior, the one-box transcript UI, seasonal Speaking bank runtime, Writing Task 1, and Writing Task 2 runtime behavior were not changed.

- **2026-05-19 target-loop edge-case repair slice**: Remaining target-answer loop edge cases and feedback readability issues were repaired.
  - High-band stability no longer requires `upgradedAnswer` / `modelAnswer`; empty replacement text in this state is valid and should not trigger parse/schema fallback.
  - Non-high-band target states remain strict: missing target output, failed validation, or borderline validation must not be shown as successful Band 8+.
  - Speaking and Writing Task 2 validators now explicitly mirror normal analysis criteria and may be stricter, but must not be looser than normal analysis.
  - DebugPanel now exposes a compact target pipeline trail: initial analysis, target layer/status, validation attempts, retry repair focus, final status, provider, and fallback.
  - Prompt-mismatch detection adds a learner warning when an answer appears to belong to another question: “这段回答似乎没有回答当前题目，请确认是否选错题目。”
  - Feedback readability cleanup was limited, not a redesign: high-band stability is concise, internal labels are softened, empty high-band cards are removed, and quote artifacts are avoided.
  - No-translate protection is narrowed from app-root/page-root to stable chrome/debug labels so answer text, target text, examples, and expressions remain selectable and plugin-friendly.
  - Web Speech auto-resume remains protected: pause/auto-end resumes while recording; Stop, Retry, permission/support errors, and duplicate `start()` calls must stay safe.
  - Task 1 remains backward-compatible and still needs a later target-calibration pass with real Task 1 debug samples.

- **2026-05-19 independent target validation slice**: Target generation and target validation are now separate for Speaking and Writing Task 2.
  - Same-response target self-check is secondary evidence only; Band 7+ / Band 8+ labels require a scoring-only independent validation pass inside IELTS Scholar.
  - For current 7.0-7.5 answers, a generated Band 8+ target must validate at 8.0+ or it is marked borderline/failed. The app must not relabel 7.5 as 8.0 or inflate current user scores.
  - If validation fails, the app retries target generation once with the validator repair focus. If the second validation still fails, UI/export keep the compact target-needs-work state.
  - Mock provider demonstrates the fail-then-repair loop; real Gemini/DeepSeek providers expose validation operations without changing provider routing.
  - Speaking Web Speech recognition now distinguishes intentional stop from browser pause/auto-end and auto-resumes while recording remains active.
  - Page-level and app-container no-translate hints were added to reduce Chrome/extension translation pollution.
  - Advanced ASR/audio transcription, pronunciation scoring, Task 1 recalibration, server/auth/database/RAG, and provider routing changes remain out of scope.

- **2026-05-19 target-answer scoring loop slice**: Speaking and Writing Task 2 target generation now requires same-layer self-check before claiming the target.
  - Feedback schemas gained optional target-answer integrity fields: floor, layer, status, self-scores, rationale, repair focus, high-band stability guidance, and next step.
  - Gemini / DeepSeek prompts now require two-pass target generation: score current answer, generate target, self-score target with the same visible criteria, revise if needed, and downgrade to borderline/failed if the target still does not meet the floor.
  - Safety normalization prevents Band 8+ target claims when self-scores are missing or below floor, and records `targetAnswerIntegrity` / `targetLayerConsistency` markers.
  - Current 8.0+ answers move into high-band stability: naturalness, timing, transferability, clarity, and consistency. No default Band 9 / 冲9 advice.
  - Writing Task 2 framework summaries now adapt labels by task type; causes-solutions prompts use Cause Analysis / Solution Plan, not View A / View B.
  - Task 2 Phase 1 missing-item messaging uses cumulative notes so earlier causes/solutions are not re-listed after later follow-ups.
  - Advanced ASR/audio transcription and pronunciation scoring remain future separate slices. Task 1 target calibration remains a dedicated follow-up with real samples.

- **2026-05-18 feedback calibration slice**: Speaking and Writing Task 2 score/feedback/target integrity were repaired.
  - Speaking prompts now forbid hidden pronunciation penalties and require headline scores to align with visible FC/LR/GRA criteria unless a real cap or compact rationale exists.
  - Writing Task 2 prompts and safety fallback now require a real blocker for every sub-7 score dimension.
  - Target answers must keep a safety margin: current <7 -> Band 7.0-7.5; current 7.0-7.5 -> Band 8+; current around 8.0 -> Band 8+ refinement, not fake Band 9.
  - Safety diagnostics can surface `speakingScoreConsistency`, `writingScoreFeedbackConsistency`, and `targetLayerConsistency`.
  - Retesting target answers / same-question rewrites creates fresh attempt ids so earlier analyzed records remain in history.
  - Browser Web Speech API remains limited; advanced ASR/audio transcription and pronunciation scoring remain future separate slices.
  - Task 1 stayed backward-compatible and still needs a later dedicated calibration pass.

- **2026-05-17 closeout**: Local `main` was consolidated for daily closeout.
  - `main` now contains the question-bank picker commits (`3df306d`, `a7b2bef`) plus `f7b24f0 Consolidate completed IELTS Scholar slices`.
  - `codex/speaking-reliability-uplift` was integrated into `main`, including Speaking auto-restore reliability, markdown export, prompt calibration, and the global target-policy work.
  - `codex/speaking-single-attempt-export` was inspected and marked superseded by the newer `src/lib/markdownExport.ts` architecture.
  - `codex/task2-command-feedback` was inspected and not applied because it conflicts with the newer Band 7.0+ / Band 8+ target policy and reintroduces old Target Band 7.5 logic.
  - Older equivalent branches were not re-merged.
  - GitHub `origin/main` should be updated only during this closeout after lint/build pass and `main` is confirmed not diverged.
- **2026-05-17**: Codex added lightweight question-bank picker modals for Speaking and Writing.
  - Speaking practice removed the visible **Read Prompt** button and replaced it with **Browse Bank**.
  - Speaking bank browsing is current-Part only; there are no cross-Part tabs or cross-Part selection.
  - Change Question remains the random-switch action.
  - Speaking question cards show the current-Part bank count only.
  - Writing landing cards now show bank counts plus **Start Practice** and **Browse Bank** actions for Task 1 and Task 2.
  - Writing bank selections route into the correct Task 1 / Task 2 practice page.
  - The bank modal uses a full-viewport backdrop; outside clicks do not close it, X closes it, and the list is scrollable.
  - Question counts and filter chips are computed from bank data, not hardcoded.
  - Practice counts use only stable records with `status === 'analyzed'` and feedback present. Drafts, empty scratchpad attempts, and `provider_failed` records do not count as practiced.
  - New functional UI labels should remain English-only; Chinese remains for AI feedback and analysis content.
  - No separate question-bank page, search, favorites, mastery status, wrong-question notebook, Part 1 topic-thread practice, or Part 3 discussion-thread practice was implemented.
  - Future bank updates should keep stable `id`, topic/type/category fields, and tags populated so filters and practice-count matching remain accurate.
- **2026-05-16**: Global IELTS training target policy calibration completed.
  - Current estimates remain conservative and separate from generated targets.
  - Historical target policy at the time: all Speaking, Writing Task 2, and Writing Task 1 target answers/reports/models used a two-layer Band 7.0+ / Band 8+ training policy. Superseded for normal Speaking on 2026-05-23: Speaking now uses `BAND 7 TARGET ANSWER`, `BAND 7+ TARGET ANSWER`, or `STANDARD ANSWER` headings without learner-facing Band 8+, certification, VERIFIED / NOT VERIFIED, or target self-score flow.
  - Removed learner-facing intermediate targets such as Target Band 7.5 / 7.5-8.0 and default Band 9 wording.
  - Speaking feedback now renders Idea & Expression Upgrade plus Personal Material & Idea Expansion instead of treating retained ideas as a shallow preserved-style note.
  - Speaking/Writing markdown exports keep current estimate and target layer separate.
- **2026-05-16**: Speaking prompt/export calibration slice completed.
  - Speaking provider prompts now separate Part 1 conversational short answers, Part 2 spoken long-turn story spine, and Part 3 natural spoken discussion.
  - Speaking markdown export changed from a guided self-study manual to a minimal review card: part requirements, answer route, compact issue list, target answer, reusable expressions, and one transfer/follow-up section.
  - Follow-up calibration records single-question Speaking scores as conservative training estimates, excluding pronunciation, while target answers follow the global Band 7.0+ / Band 8+ two-layer policy.
  - Future Speaking interaction model recorded only, with no thread UI or session flow implemented:
    - Part 1 Topic Thread Practice: one topic, 3-4 short examiner-style questions, one connected mini-conversation, and one topic-level analysis focused on short natural answers, personal details, consistency, and avoiding memorized long answers.
    - Part 2 Single Long Turn Practice: one cue card, one long-turn answer, one analysis focused on story spine, detail, timing, and sustained fluency.
    - Part 3 Discussion Thread Practice: one abstract topic cluster, 3-4 related follow-up questions, one discussion-level analysis focused on position, reasoning, contrast, examples, consequences, and spoken discussion logic.
    - Full Speaking Mock later combines Part 1 topic thread, Part 2 long turn, and Part 3 discussion thread.
- **2026-05-13**: Speaking note standard finalized and handed off.
  - `docs/IELTS_SPEAKING_NOTE_STANDARD.md` is the final unified standard. Do not create new versions.
  - Standard adapts by session size: Single Question (1 Q, no P0/P1/P2), Mini Session (2–4 Q, no P0/P1/P2), Topic Session (5+ Q, with P0/P1/P2).
  - Part 1 single-question practice includes Conversation Thread follow-ups.
  - Part 2 includes Story Spine and long-turn retry. Part 3 includes Discussion Path and nuance training.
  - Manual VSCode Claude training and future product export use the same standard. Only Source metadata differs.
  - `/ielts-session` and `/ielts-export` updated for final handoff.
  - Three local validation notes under `notes/ielts/speaking/final/` (Work, Accommodation, Hometown). Must not be committed/pushed.
- **2026-05-12**: Final unified IELTS Speaking note standard created (`docs/IELTS_SPEAKING_NOTE_STANDARD.md`).
- **2026-05-12**: Speaking seasonal question bank data scaffolding completed (two passes).
  - Pass 1: Created `src/data/speaking/` folder with types, 2026 May-August bank data, V1 re-export, and priority index.
  - Pass 2 (completeness): Filled evergreen Part 1 (5 topics) and mainland reused Part 2&3 (26 topics) from `docs/source_materials/speaking/ielts-speaking-bank-2026-05-to-08.extracted.md`.
  - This is data-layer preparation only; runtime selection integration is deferred.
  - Existing `src/data/questions/bank.ts` preserved unchanged.
- A Claude Code patch attempted to redesign Writing Task 2 Phase 3 Vocabulary & Expression Upgrade.
- **That patch has been reverted and must NOT be treated as accepted design direction.**
- Do not continue from the rejected Claude patch.
- **2026-05-13**: Codex completed the accepted Writing Task 2 Phase 3 learner-facing feedback repair.
  - Phase 3 order now follows: My Essay -> Essay-level Warnings -> Vocabulary & Expression Upgrade -> Logic & Structure Review -> Sentence Corrections -> Target Model Excerpt / Revision Mission.
  - UI, provider prompt constraints, normalization, Mock Provider output, and markdown export are aligned to Chinese-first transferable feedback.
- **2026-05-13**: Codex completed Writing Task 2 Phase 3 visual semantics + analysis lifecycle polish.
  - Phase 3 is now a lower-noise revision workspace: Language Bank, Logic Review, Sentence Corrections, and Target Model Answer each have clearer jobs.
  - Language Bank was split/cleaned into Topic Vocabulary and Expression Upgrade. Topic Vocabulary must remain topic-specific and must not become writing strategy. Expression Upgrade should focus on phrase/frame upgrades and avoid repeated generic explanations.
  - Production logic remains topic-agnostic. Remote-work vocabulary and examples are mock/demo fixture data only, not hardcoded product logic.
  - Submit for Analysis now preserves the submitted essay snapshot and locks the Phase 2 editor while analysis is running. Phase 3 should use `feedback.essay` / submitted snapshot, not mutable live editor text.
  - Run-id protection ignores stale provider responses. Stop/timeout/failure preserve essay text, avoid fake feedback, and do not move to Phase 3.
  - Same-question rewrite / Practice this question again is available from Phase 3. New Question should choose a different prompt when alternatives exist.
  - Target Model Excerpt / Revision Mission was reworked into Target Model Answer. It should be a full training target answer, about 280-350 words, preserving the learner position, fixing the highest-priority Logic Review issue, and integrating Language Bank / Expression Upgrade / key corrections. It is not an official IELTS guarantee.
  - Sentence Correction cards are lower-noise and use grey/problem or strikethrough-style source marking. They must not use Target Model Answer learning-highlight styling. Phrase-level issues should mark only the exact problematic phrase when possible.
  - Preserve `sourceQuote`, `severity`, `issueType`, and `microUpgrades` for future annotation work.
- **2026-05-14**: Codex completed Writing Task 2 Phase 3 annotated essay overlay polish and score transparency.
  - Annotated My Essay markers open the real floating correction overlay with close/Escape/outside-click, drag, resize, mobile fallback, and a subtle tether line.
  - Logic Review accordion linking avoids unsafe fallback to Introduction/first group.
  - Temporary interaction lab and old visible Sentence Correction card list were removed from the Phase 3 UI; underlying correction data/export remains preserved.
  - Score cards now show clearer IELTS training dimensions plus compact provider/fallback/normalization/under-length transparency.
  - Visible Writing scores are conservative training estimates, not official IELTS scores. Under-length essays may show capped scores. Four equal 5.0 scores can come from mock provider output, under-length cap, or safety normalization, not necessarily four identical real-provider judgments.

## Current Priority

Current closeout state: Speaking active bank runtime, transcript review/audio-backed transcription path, structured normal Speaking feedback, local Speaking markdown export, simplified generated-target display, valid boundary range rendering, and shared low/mid-band feedback coverage are consolidated into local `main`.

No new product feature is in progress. The next immediate task is a separate project audit package for workflow/docs/skills optimization; do not begin that audit implementation unless explicitly scoped.

Global hard standard for all future feedback-loop work:
- Current estimate is conservative.
- Speaking current answer display is an estimated single-question training band or adjacent half-band range from one ordinary analysis pass.
- Speaking target answers are practice resources, not certified score guarantees; show `upgradedAnswer` whenever generation succeeds.
- Speaking target headings: lower bound below 7.0 -> `BAND 7 TARGET ANSWER`; lower bound at or above 7.0 -> `BAND 7+ TARGET ANSWER`; high-band-stable -> `STANDARD ANSWER`.
- Do not use Band 9 as a default learner-facing label.
- Do not use Target Band 7.5 or 7.5-8.0 intermediate labels.
- Do not inflate current score to match the target.
- Do not show Speaking `BAND 8+ TARGET ANSWER`, `ADVANCED TARGET ANSWER`, VERIFIED / NOT VERIFIED, target-certification failure, or raw provider method errors in the normal learner UI.
- Target outputs must apply feedback, idea-development advice, and retained useful learner material.
- Part 1 future remains topic-thread practice.
- Part 2 remains single long-turn practice.
- Part 3 future remains discussion-thread practice.
- Speaking single-question estimates remain training estimates and exclude pronunciation when applicable.
- Audio transcription reliability remains future dedicated work; the existing path can still fail or fall back.

Remaining future scoring work, if needed, belongs to a larger scoring calibration task. Do not reopen scoring/provider routing unless explicitly scoped.

## Agent Role Boundaries

### Codex — current implementation scope

- Primary implementation agent for scoped product/product-code slices.
- Work only from scoped prompts.
- Before implementation, follow `docs/CODEBASE_MAP.md`, `docs/AGENT_WORKFLOW.md`, `docs/PRODUCT_DESIGN_PRINCIPLES.md`, and the relevant task-specific source files.
- Keep changes small, task-scoped, and verifiable.
- Do not merge or push unless this is daily closeout or explicitly approved.

### Claude Code — optional helper scope

- Documentation updates
- Git status checks
- Lint / build verification if requested
- Optional verification/status support unless explicitly approved for more
- **No** product UI / information architecture implementation
- **No** "small UI fix" unless explicitly approved

GitHub remains the sync point between Codex, Claude Code, and future ChatGPT sessions. Merge/push should happen only during daily closeout or when explicitly approved. Future implementation prompts should include plain-language verification steps.

## Before Product/UI Work

Read these documents (in order):

1. `docs/HANDOFF_NEXT_CHAT.md` (this file)
2. `docs/PRODUCT_DESIGN_PRINCIPLES.md` — long-term product design source of truth
3. `docs/PROJECT_BACKLOG.md` — future task tree
4. `docs/AGENT_WORKFLOW.md` — agent workflow and rules

## Accepted Product Direction

### Low-noise UI

- Prefer structure over explanation.
- Do not use long module-level explanatory text when layout, grouping, labels, and hierarchy can communicate the purpose.
- The rejected example: "Expression bank for this essay — for revision and future reuse, not another correction list."

### Vocabulary Section

Four confirmed groups:

- `Topic Vocabulary`
- `From Your Essay`
- `Collocations`
- `Argument Frames`

Vocabulary is a reusable expression takeaway, not a second sentence correction list.
`From Your Essay` must be phrase-level.
Normal relevant input should not produce an empty vocabulary section.

### Empty State Rules

Only for inputs that are:

- not even one related complete sentence
- irrelevant
- meaningless
- a technical / provider / parser failure

### Language

- Chinese for guidance, strategy, reasoning, explanations.
- English for prompts, output, expressions, frames, excerpts, vocabulary.

### Progress

- May include reference band estimates and table-like summaries.
- Do not over-warn users that estimates are unofficial. Present estimates calmly as training references.

### Future Provider Direction

- May support user-provided API keys before entering the app.

## V1.3 Step 2 — Interactive Annotated Essay Overlay

- Baseline implemented on 2026-05-14 for Task 2 Phase 3.
- Future work should be polish/consolidation only unless explicitly scoped; do not rebuild from scratch.

## Development Rules

- Do not rely on old chat memory. Use repo docs and source code.
- Before code changes, read `docs/AGENT_WORKFLOW.md`.
- Keep changes small and task-scoped.
- Do not merge or push unless this is daily closeout.
- Do not rebuild Task 2 annotated essay overlay unless explicitly scoped.
- Do not edit `.env.local`.
