# Current State (V1.3 Speaking closeout)

_Last updated: 2026-05-24_

## Current Snapshot

- Branch/sync state must be verified with `git status` and `git log` before work; do not treat commit hashes in docs as permanent truth.
- Codex is currently the primary implementation agent for scoped product slices.
- Claude Code, if used, is only an optional verifier/docs/status helper unless explicitly approved.
- No active product feature is currently in progress unless the user gives a new scoped task.
- Task 2 annotated essay overlay baseline is implemented; future work is polish/consolidation only unless explicitly scoped.
- Speaking 2026 May-Aug mainland active bank runtime is integrated through an adapter with V1 fallback and stable IDs.
- Task 1 target output is conservative/generated; full calibration remains future work and needs real Task 1 samples.
- Provider routing, server/auth/database/RAG, advanced ASR, pronunciation scoring, export behavior, and history architecture should not change unless explicitly scoped.
- For code navigation, read `docs/CODEBASE_MAP.md`.

## Branch / Sync State
- Verify local branch/sync state with git commands before work. The last documented closeout said local `main` and `origin/main` were synced after the 2026-05-20 daily closeout, but docs can lag behind the actual repository.
- Today's completed work includes independent target validation follow-ups plus the high-band boundary / score-layer semantic model.
- `codex/speaking-reliability-uplift` has been integrated.
- `codex/speaking-single-attempt-export` and `codex/task2-command-feedback` were inspected and kept unapplied as superseded.

## Product Baseline
- Mock Provider remains the default provider.
- Optional Gemini Provider path is implemented for local development only.
  - Configure with `VITE_AI_PROVIDER=gemini` and `VITE_GEMINI_API_KEY=...`.
  - Missing, unknown, or `mock` provider configuration uses Mock Provider.
  - If Gemini is configured without a key, the app safely falls back to Mock Provider.
  - `VITE_GEMINI_API_KEY` is exposed to browser/client code and is suitable only for local/personal prototype use.
  - No production key management exists yet.
- Provider Router v1 is implemented for personal local development with `VITE_AI_PROVIDER=auto`.
  - Gemini 2.5 Flash is quota-aware and reserved for high-value final feedback when local estimates permit.
  - `VITE_AI_PROVIDER=gemini` is Gemini-only mode; auto DeepSeek fallback is inactive in that mode.
  - DeepSeek fallback requires `VITE_AI_PROVIDER=auto`, a DeepSeek key/config, and a Vite dev-server restart after env changes.
  - DeepSeek V4 Flash is the cheap fallback and default for low-cost Task 2 framework coach / framework extraction.
  - DeepSeek V4 Pro is the default Task 2 high-quality fallback before `2026-05-31T15:59:00Z`; after that UTC time it is disabled unless `VITE_DEEPSEEK_ALLOW_PRO_AFTER_DISCOUNT=true`.
  - Google official remaining quota cannot be read reliably from the browser; API Status shows only local estimates.
  - OpenAI-compatible/OpenRouter UI is not implemented and remains a future hidden direction.
  - Vite/client API keys are local-personal prototype only and are not production-safe.
- No RAG pipeline is connected.
- V1 pronunciation is **not formally assessed**.
- Global target policy is active, with Speaking using the simplified target-answer flow recorded below:
  - current estimates stay conservative and honest;
  - Writing Task 1 / Task 2 target reports and models keep the existing minimum Band 7.0+ / Band 8+ training policy;
  - Speaking current answers show either one estimated training band or a valid adjacent half-band range from one ordinary analysis pass;
  - Speaking target headings are local and pedagogical: current lower bound below 7.0 -> `BAND 7 TARGET ANSWER`; current lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`; high-band-stable -> `STANDARD ANSWER`;
  - Speaking normal learner flow has no learner-facing Band 8+, certification, VERIFIED / NOT VERIFIED, or target self-score flow;
  - learner-facing Band 9 and Target Band 7.5 / 7.5-8.0 labels are not default target tiers;
  - current scores must not be inflated to match target outputs;
  - stronger targets mean stronger logic, precision, examples, naturalness, and examiner-friendly execution, not more formal or more essay-like language by default.
- Shared target-state semantics remain available across Speaking Part 1, Speaking Part 2, Speaking Part 3, Writing Task 1 Academic, and Writing Task 2:
  - `needs_repair`
  - `generated_target`
  - `target_failed_or_borderline`
  - `high_band_boundary`
  - `high_band_stable`
- In the current normal successful Speaking learner flow, generated target answers use neutral `generated_target` semantics; `needs_repair` and certification-style failure wording must not appear merely because no independent target certification ran.
- A 7.5/8.0 split between normal analysis and independent validation is treated as a high-band boundary: close to target, not a hard failure or fake stable success.
- `STANDARD ANSWER` is reserved for 8.0+ / high-band stable outputs.
- Generated Task 1 target reports remain conservative and are not independently validated; full Task 1 calibration remains future work.
- Speaking Part 1 / Part 2 / Part 3 now use the same simplified learner-facing model: the current answer shows an estimated single-question training band or adjacent half-band range from one ordinary Speaking analysis pass, and generated target answers are shown whenever `upgradedAnswer` is present.
- Speaking target headings are pedagogical: lower bound below 7.0 -> `BAND 7 TARGET ANSWER`; lower bound at or above 7.0 -> `BAND 7+ TARGET ANSWER`; existing high-band-stable -> `STANDARD ANSWER`.
- Normal Speaking learner UI does not show `BAND 8+ TARGET ANSWER`, `ADVANCED TARGET ANSWER`, VERIFIED / NOT VERIFIED states, target-certification failures, or provider method errors.
- Normal Speaking provider responses return structured feedback only. Providers no longer generate `obsidianMarkdown`, Band 8+/certification/self-score target fields, or `riskNoteZh` for ordinary `speaking_analysis`; markdown export is built locally after successful parsing.
- Accepted 2026-05-24 runtime evidence: a real lower-band Part 2 result rendered a valid adjacent range as `5.5-6.0 ESTIMATED RANGE`, showed a complete `BAND 7 TARGET ANSWER`, and Debug reported `targetState:generated_target` / `final generated_target`.
- Low/mid-band Speaking feedback now has shared coverage/classification guardrails so substantial answers keep meaningful MUST FIX, HIGH-IMPACT PHRASE FIXES, and PERSONAL MATERIAL & IDEA EXPANSION treatment without sample-specific hardcoding.
- Speaking transcription/audio behavior and the one-box transcript UI were not changed by this target-display cleanup. Writing Task 2 target/score consistency and Writing Task 1 calibration remain separate future audits.
- V1.1 provider safety scaffolding is implemented:
  - Speaking and Writing provider calls route through safe analysis wrappers.
  - Malformed provider output is normalized into safe feedback objects.
  - Latest provider diagnostic is captured for Debug Panel inspection.

## Speaking Practice (Implemented)
- Speaking Practice now saves local-first practice attempts so Part 1/2/3 work can be recovered after part switching, navigation, or page reload.
- Speaking transcript flow includes the current simplified one-box editable transcript review plus an audio-backed transcription path.
- Audio transcription reliability remains limited and fallback-prone; when provider transcription fails or is unavailable, browser transcript review and manual editing remain the safe path.
- Active Speaking practice pages no longer show large Recent Attempts / Practice Records panels; History is the learner-facing record center.
- Empty Speaking question loads are not saved as noisy draft records; drafts are saved only after meaningful transcript or analysis state exists.
- Speaking question banks now include a small V1 prompt set for practical local testing:
  - Part 1: 11 common topics / 36 questions.
  - Part 2: 12 cue cards.
  - Part 3: 37 follow-up discussion questions.
- Speaking Change Question now avoids returning the same prompt when alternatives exist and does not call AI.
- Speaking **Browse Bank** replaces the visible **Read Prompt** button.
- Speaking Browse Bank is current-Part only and the question card shows the current-Part bank count only.
- Speaking users can start **Practice This Question Again** after analysis, preserving the analyzed attempt while opening a fresh attempt for the same question.
- Provider unavailable failures are distinguished from schema/parse fallback; provider-unavailable attempts preserve the transcript and show a retry-later message instead of normal coaching.
- Speaking feedback readability was improved with larger Part tabs, clearer Training Estimate presentation, fully visible Must Fix / Optional Polish sections, a more readable upgraded-answer layout, and larger preserved-style context.
- Short Speaking samples across Parts 1/2/3 are capped conservatively and receive insufficient-sample feedback instead of inflated training estimates.
- Speaking feedback now suppresses full target-answer transformation rendering for very short, nonsense, or insufficient-sample transcripts, including old restored records; the UI shows a concise Answer Development Plan instead without mutating saved records.
- Speaking Practice uses the wide practice workspace consistently with Writing Task 1 / Task 2; feedback cards align to the same main container while long transformation text keeps a readable inner line length.
- Speaking feedback now supports a distinct **Idea & Expression Upgrade** section for strong answers with few or no true errors.
- Speaking Part 2 is the first feedback readability cleanup pattern:
  - module headers use the `LANGUAGE PERFORMANCE` style;
  - high-band boundary and stability use compact target-state labels;
  - generic UI reminder text and learner-facing mock/prototype labels are removed;
  - idea/expression upgrade items must be grounded in the learner's actual wording or material.
- Speaking prompts are calibrated by part: Part 1 short natural answers, Part 2 single long-turn story spine, and Part 3 natural spoken abstract discussion rather than Writing Task 2 spoken aloud.
- Speaking markdown export uses the local minimal review-card structure from `src/lib/markdownExport.ts`; provider-generated Speaking `obsidianMarkdown` is no longer part of the normal analysis contract.
- Malformed provider/debug strings are filtered out of learning content.
- Incomplete provider feedback remains retryable instead of rendering as normal results.
- `no-speech` auto-retry is implemented and preserved.
- Web Speech auto-resume remains a regression item: browser pause/auto-end should resume while recording; Stop and Retry should still stop/clear cleanly.
- Retry clears current-attempt state (transcript, feedback, timer, attempt refs).
- Stop & Review prevents recognition restart after user stop.
- Pre-analysis view remains focused on prompt, timer, controls, and transcript/review.

## Writing Task 2 Practice (Implemented)
- Writing Task 2 now saves active local-first drafts for Phase 1 notes, final framework, essay draft, and existing analysis result.
- Active Writing Task 2 practice no longer shows a large Recent Attempts panel; History is the learner-facing record center and restore path.
- Writing landing cards show bank counts, **Start Practice**, and **Browse Bank**; selected Task 2 prompts route into this practice page.
- Provider unavailable failures preserve the draft/framework/essay and show a retry-later message instead of presenting fallback output as successful coaching.
- Phase 1 separates:
  - Coach Discussion (process)
  - Final Framework Summary (output)
- Final Framework Summary remains user-editable.
- Phase 1 includes a provider-routed Framework Coach and **Generate Framework Summary** action:
  - Framework Coach uses `writing_framework_coach`; in auto mode with DeepSeek configured, it uses DeepSeek V4 Flash and does not spend Gemini.
  - Framework Coach is short, specific, Socratic, and limited to 2-4 comments/questions.
  - Generate Framework Summary uses `writing_framework_extraction`; in auto mode with DeepSeek configured, it uses DeepSeek V4 Flash and does not spend Gemini.
  - Reads current user Coach Discussion / Notes, coach feedback, and unsent draft notes.
  - Framework Summary must summarize user notes instead of generating a full model plan from the prompt alone.
  - Missing user decisions are marked as `Not decided yet / 需要继续补充`; possible examples must come from notes or be marked `Suggested example, please confirm`.
  - Populates structured sections: Position, View A, View B, My opinion, Paragraph plan, Possible example.
  - Shows calm non-blocking messages for empty input, loading, success, and safe fallback.
  - Captures provider diagnostics for Debug Panel inspection.
- The permanent Task 2 provider banner was removed; Task 2 now shows inline provider notices only when fallback/cooldown/quota reserve/discount protection/provider-unavailable events occur.
- Phase tabs use stable three-column alignment so active/inactive/disabled states do not resize or shift the tab positions.
- Task 2 Framework Coach now returns readiness states: `not_ready`, `almost_ready`, and `ready_to_write`.
- Ready-to-write stops the coaching loop and enables **Framework Ready — Generate Summary**; summary generation uses `writing_framework_extraction` and does not auto-advance to Phase 2.
- Learners can use **Skip Framework Discussion — Start Writing** to move to Phase 2 without an AI call, preserving any manual Final Framework Summary as reference.
- Framework Summary uses an editable bilingual grounded structure: Position, View A, View B, My opinion, and Paragraph plan, with missing decisions marked instead of invented.
- Phase 1 notes input supports Enter for newline, Ctrl/Cmd+Enter to send, Stop generating, Delete last coach feedback, and IME composition protection for Chinese/Japanese/Korean input.
- Phase 2 displays Final Framework Summary before essay writing.
- Phase 3 displays My Essay prominently before feedback; My Framework remains available as secondary planning reference.
- Submit gating is disabled only when `essay.trim().length === 0` (implemented as `!essay.trim()`).
- Under-length or extremely short Task 2 submissions are accepted, but receive conservative low/insufficient-sample feedback instead of high training estimates.
- Writing Task 2 desktop layout now uses a wider workspace for reduced scrolling and better cross-reference:
  - Phase 1 uses side-by-side Coach Discussion / Notes and Final Framework Summary panels.
  - Phase 2 uses side-by-side framework reference and essay editor panels.
  - Phase 3 emphasizes My Essay, Key Corrections, Framework Logic Review, and Model Answer Excerpt; My Framework remains available as secondary planning reference.
- UI readability polish implemented (no logic changes):
  - Slightly larger base body typography and line-height.
  - Slightly larger feedback-card/paper-card spacing and phase-tab readability.
  - Improved line-height/spacing in Final Analysis sections (My Framework, My Essay, Key Corrections, Framework Logic Review, Model Answer Excerpt).
- Writing Task 2 correction labels are display-normalized so learner UI shows readable Chinese-first labels instead of raw schema/provider enum keys such as `LR` or `LEXICAL_PRECISION`.
- Latest Task 2 UX repair:
  - Phase tab root cause was `whitespace-nowrap` allowing longer labels to visually overflow equal-width grid cells; the shared `.phase-tabs` / `.phase-tab` pattern now keeps all tabs in a stable 3-column grid and active/disabled states only change color/opacity.
  - Framework summary buttons now have three states: keep discussing when not/almost ready, **Framework Ready — Generate Summary** when ready with no summary yet, and **Use This Framework — Start Writing** after a generated summary exists.
  - Framework Summary now uses clear bilingual sections and reusable sentence frames instead of one dense block.
  - Phase 3 separates **Logic & Structure Review** from **Sentence-level Corrections**; logic issues link to numbered corrections or explicitly mark paragraph-level revision.

### Task 2 Phase 3 Feedback Hierarchy Repair
- Phase 3 now uses a clearer hierarchy: **My Essay**, **Essay-level Warnings**, **Logic & Structure Review**, **Sentence-level Corrections**, and **Vocabulary & Expression Upgrade**.
- Under-length / insufficient-sample messages are global warnings, not normal logic cards.
- Logic cards are grouped by essay location, stay limited to paragraph/task-response/structure problems, and link to numbered sentence corrections when relevant.
- Pure lexical or grammar/local wording issues are rendered as sentence corrections or vocabulary upgrades, not big logic issues.
- Logic cards no longer repeat full sentence correction text or duplicate the old "No sentence-level correction covers this issue" grey box.
- Task 2 markdown export follows the same warning -> logic -> sentence correction -> vocabulary hierarchy.
- Task 2 annotated essay overlay baseline is implemented; future work is polish/consolidation only unless explicitly scoped.

### Task 2 Phase 3 Content Logic Refinement
- **Vocabulary & Expression Upgrade** now behaves as a compact learning bank rather than a second correction list, with topic vocabulary, short user wording upgrades, collocations, and reusable argument frames.
- **Sentence-level Corrections** now support a primary issue, up to 2-3 secondary issues, and short micro upgrades, while old records render without empty placeholders.
- **Logic & Structure Review** uses stronger local inference for related correction numbers, especially off-topic introductions, weak thesis/position issues, balance/concession gaps, and body-paragraph development problems.
- **Personalized Model Answer Excerpt** is supported by passing Phase 1 notes and the editable framework summary into final analysis. New provider output can mark the excerpt as personalized when it preserves the learner's position/framework and fixes the feedback issues.
- Old saved records that only contain the earlier `modelAnswer` field still render as a normal model excerpt instead of being falsely labeled personalized.
- V1.3 Step 2, **Interactive Annotated Essay Overlay**, has a baseline implementation in Phase 3. Do not rebuild it from scratch.

## Writing Task 1 Academic Practice (Implemented)
- V1.2 product direction is now Writing Task 1 Academic Basic Practice before Mock Exam.
- `/writing/task1` is a usable Academic Task 1 practice page instead of a placeholder.
- Scope is Academic only; General Training letters are deferred.
- Task 1 uses original text-based visual briefs and simple data cards for line graph, bar chart, table, pie chart, mixed chart, process, and map practice.
- Task 1 feedback has its own schema and Mock Provider analysis path covering overview, key features, comparisons, data accuracy, coherence, must-fix items, rewrite task, reusable report patterns, improved report/model excerpt, and markdown export.
- Task 1 diagnosis is Chinese-first in learner-facing sections, with English corrections/examples where useful; the target report remains English and follows the shared Band 7.0+ / Band 8+ target policy.
- Task 1 target reports now share the global target-state vocabulary, but are marked generated rather than independently validated.
- Old Task 1 feedback records with sparse, English-only, or malformed display text receive Chinese-first display framing at render time without rewriting stored records.
- Task 1 under-length and extremely short answers receive conservative training estimates and explicit length feedback instead of high mock/local scores.
- Active Writing Task 1 practice links to History instead of embedding a recent-record list.
- Task 1 reports save local-first records with module `writing_task1`, task type, topic/tags, instruction, visual brief, quick plan, report, feedback, status, and timestamps.
- Task 1 retry/new prompt starts a new attempt without clearing unrelated saved records.
- Writing landing cards show bank counts, **Start Practice**, and **Browse Bank**; selected Task 1 prompts route into this practice page.
- Text-based visual briefs are the V1.2 baseline; interactive charts and richer data-accuracy mapping remain later work.

## Export Behavior (Implemented)
- Markdown export is attempt-level in V1.
- Speaking exports should keep active expressions as 2-4 short reusable chunks and use conceptual Answer Paths, not sliced sentence fragments.
- Speaking exports mirror high-band boundary / stable / repair target labels and avoid empty replacement-answer artifacts.
- Writing Task 2 exports should read as compact Obsidian training notes: max 3 revision-focus actions, compact logic cards, top sentence corrections only, and a phrase-level Language Bank.
- Task 1 exports a downloaded `.md` file using the same pattern as other modules; if provider markdown is absent, the app generates a complete local note from structured feedback.
- Session-level consolidated note export is not implemented yet.

## Question Bank Picker (Implemented)
- Lightweight picker modals are implemented inside existing practice flows.
- Speaking **Browse Bank** is current-Part only; **Change Question** remains the random-switch action.
- Writing module cards show bank counts, **Start Practice**, and **Browse Bank** for Task 1 and Task 2.
- Writing Browse Bank selections route selected prompts into the proper practice page.
- Modal backdrop is full viewport; outside clicks do not close it, X closes it, and the list is scrollable.
- Tags, filters, and counts are derived from question data, not hardcoded.
- Practice counts include only analyzed records with real feedback; drafts, empty drafts, and `provider_failed` records do not count as practiced.
- New functional UI labels should remain English-only; Chinese remains for AI feedback and analysis content.
- Full standalone question-bank page, search, favorites, mastery status, wrong-question notebook, Part 1 topic-thread practice, and Part 3 discussion-thread practice remain future work.
- Future question-bank updates must preserve stable `id`, topic/type/category, and tags so counts, filters, route-state selection, and practice-count matching stay accurate.

## Practice History (Implemented)
- A lightweight `/practice-history` page lists existing localStorage practice records without starting a new attempt.
- Speaking attempts show part, question, timestamp, transcript preview, and status when available.
- Writing Task 2 attempts show prompt, timestamp, essay/framework preview, and status when available.
- Writing Task 1 attempts are recognized minimally with prompt, timestamp, report/plan preview, status, and Open / Restore.
- Opening a history item writes it into the existing active practice restore path, then navigates to the matching Practice page without making an AI call.
- Practice History supports deleting individual Speaking and Writing Task 2 attempts from localStorage without affecting unrelated records.
- Active practice pages focus on current work; record review, restore, export, and delete live in Practice History.
- Writing Task 2 framework UI copy was shortened so the workspace stays focused while textarea placeholders retain useful guidance.
- Empty history sections show “No saved attempts yet.”
- Practice History is linked from Home, TopBar, Speaking, and Writing.
- No cross-attempt analytics, export, database, RAG, auth, server, Mock mode, or provider-default changes were added.

## Progress Snapshot (Implemented)
- Progress is now a local training snapshot based on `ielts_practice_records_v1`, not a mock exam score.
- Speaking and Writing estimates use analyzed records with valid scores only; drafts are not counted as score 0.
- Training estimates are rounded to whole/half bands for display and are conservative by design: recent attempts are preferred, weak evidence rounds down, and one high record does not dominate.
- Writing estimate combines Task 1 and Task 2 separately, weighting Task 2 more heavily when both exist.
- Progress shows recent Speaking and Writing training estimates as simple lists instead of a chart.
- Topic coverage is implemented with static IELTS-preparation categories attached to the prompt bank:
  - Speaking: 12 preparation categories.
  - Writing Task 2: 12 preparation categories.
- Writing coverage is split:
  - Writing Task 1 Visual Type Coverage: line graph, bar chart, table, pie chart, mixed chart, process, map.
  - Writing Task 2 Topic Coverage: 12 preparation categories.
- Progress resolves topic coverage by preferring stored record metadata, matching prompt-bank metadata, then using a small keyword fallback. Unknown topics are not counted as score 0.
- Progress includes a rule-based **Suggested Training Plan** with up to 3 modest suggestions covering data sufficiency, Task 1 visual type coverage, Task 2 topic coverage, Speaking coverage, and unfinished drafts when local records support them.
- Topic coverage is explicitly presented as IELTS preparation categories, not an official exam syllabus.

## Layout Shells (Implemented)
- Shared CSS layout shells now define medium and wide page widths with `.page-shell`, `.page-shell--medium`, `.page-shell--wide`, `.practice-workspace`, and `.reading-comfort`.
- Home, Speaking, and Writing landing pages use the medium shell; Task 1, Task 2, History, and Progress use the wide shell where the workspace benefits from comparison space.
- Top navigation placement is shared through a global TopBar shell so medium and wide page content widths do not move the navigation inward or outward.
- Landing pages are upper-aligned and medium-width; practice/history/progress pages retain wide workspaces where useful.

## Practice Record Safety (Implemented)
- New Speaking records persist static prompt metadata when available: topic, tags, and part.
- New Writing Task 2 records persist static prompt metadata when available: topic, tags, task type, and task.
- New Writing Task 1 records persist static prompt metadata when available: topic, tags, task type, and task.
- Old records without topic metadata remain readable; Progress falls back to prompt-bank matching and then minimal keyword matching.
- Practice records use the stable `ielts_practice_records_v1` key.
- Malformed or unknown old record entries are ignored for display but preserved in storage; they are not automatically deleted.
- Practice records are protected from automatic clearing during app start, route navigation, server restart, build, or normal development flow.
- Deletion remains explicit and record-specific through user delete actions.

## Debug / Provider Safety (Implemented)
- Debug Panel remains globally available.
- Debug Panel now includes a collapsible latest provider diagnostic section showing:
  - module
  - operation
  - provider name
  - request payload
  - raw response
  - parsed JSON
  - parse error
  - validation errors
  - normalized fields, when a non-core field was repaired locally
  - fallback-used status
  - timestamp
- Framework coach diagnostics are labeled `writing_framework_coach`; framework extraction diagnostics are labeled `writing_framework_extraction`, so both are distinguishable from final `writing_analysis`.
- Provider normalization details remain available in Debug Panel; normal learner feedback no longer shows the yellow malformed/normalized warning unless the provider is truly unavailable and retry is needed.
- API Status is available beside Debug Panel and shows router mode, last effective provider/model, Gemini local quota estimate/cooldown, DeepSeek configured/balance-unavailable status, and the latest fallback reason.
- Provider diagnostics and debug exports redact API-key-like values.

## Local Data Reset (Implemented)
- Progress includes a bottom danger section, **清空所有个人数据**.
- The reset clears IELTS Scholar local browser data only: practice records, active attempts, sessions/profile snapshots, provider diagnostics through reload/state reset, and API usage/router state.
- Env files and non-app browser storage are not touched.

## Scope Guards (Current)
- Keep Practice mode and future Mock mode separate.
- Keep UI polish work separate from API connection work.
- V2 Mock Exam comes after Speaking, Writing Task 1 Academic, and Writing Task 2 basic practice modules exist.
- V3 keeps advanced visualization and interactive chart work.
- Session-level notes are deferred until user value and scope are clearer.
