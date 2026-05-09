# Current State (V1.1 closing)

_Last updated: 2026-05-09_

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
  - DeepSeek V4 Flash is the cheap fallback and default for framework extraction.
  - DeepSeek V4 Pro is the default Task 2 high-quality fallback before `2026-05-31T15:59:00Z`; after that UTC time it is disabled unless `VITE_DEEPSEEK_ALLOW_PRO_AFTER_DISCOUNT=true`.
  - Google official remaining quota cannot be read reliably from the browser; API Status shows only local estimates.
  - OpenAI-compatible/OpenRouter UI is not implemented and remains a future hidden direction.
  - Vite/client API keys are local-personal prototype only and are not production-safe.
- No RAG pipeline is connected.
- V1 pronunciation is **not formally assessed**.
- V1.1 provider safety scaffolding is implemented:
  - Speaking and Writing provider calls route through safe analysis wrappers.
  - Malformed provider output is normalized into safe feedback objects.
  - Latest provider diagnostic is captured for Debug Panel inspection.

## Speaking Practice (Implemented)
- Speaking Practice now saves local-first practice attempts so Part 1/2/3 work can be recovered after part switching, navigation, or page reload.
- Active Speaking practice pages no longer show large Recent Attempts / Practice Records panels; History is the learner-facing record center.
- Empty Speaking question loads are not saved as noisy draft records; drafts are saved only after meaningful transcript or analysis state exists.
- Speaking question banks now include a small V1 prompt set for practical local testing:
  - Part 1: 11 common topics / 36 questions.
  - Part 2: 12 cue cards.
  - Part 3: 37 follow-up discussion questions.
- Speaking Change Question now avoids returning the same prompt when alternatives exist and does not call AI.
- Speaking users can start **Practice This Question Again** after analysis, preserving the analyzed attempt while opening a fresh attempt for the same question.
- Provider unavailable failures are distinguished from schema/parse fallback; provider-unavailable attempts preserve the transcript and show a retry-later message instead of normal coaching.
- Speaking feedback readability was improved with larger Part tabs, clearer Training Estimate presentation, fully visible Must Fix / Optional Polish sections, a more readable upgraded-answer layout, and larger preserved-style context.
- Short Speaking samples across Parts 1/2/3 are capped conservatively and receive insufficient-sample feedback instead of inflated training estimates.
- Speaking feedback now suppresses full High-Band Transformation rendering for very short, nonsense, or insufficient-sample transcripts, including old restored records; the UI shows a concise Answer Development Plan instead without mutating saved records.
- Speaking Practice uses the wide practice workspace consistently with Writing Task 1 / Task 2; feedback cards align to the same main container while long transformation text keeps a readable inner line length.
- Speaking feedback now supports a distinct **Band 9 Refinement / Examiner-Friendly Refinement** section for strong answers with few or no true errors.
- Speaking markdown export can be locally generated when the provider returns valid core feedback but omits `obsidianMarkdown`; this is shown as a normalized field in diagnostics rather than a full feedback failure.
- `no-speech` auto-retry is implemented and preserved.
- Retry clears current-attempt state (transcript, feedback, timer, attempt refs).
- Stop & Review prevents recognition restart after user stop.
- Pre-analysis view remains focused on prompt, timer, controls, and transcript/review.

## Writing Task 2 Practice (Implemented)
- Writing Task 2 now saves active local-first drafts for Phase 1 notes, final framework, essay draft, and existing analysis result.
- Active Writing Task 2 practice no longer shows a large Recent Attempts panel; History is the learner-facing record center and restore path.
- Provider unavailable failures preserve the draft/framework/essay and show a retry-later message instead of presenting fallback output as successful coaching.
- Phase 1 separates:
  - Coach Discussion (process)
  - Final Framework Summary (output)
- Final Framework Summary remains user-editable.
- Phase 1 includes a mock-safe **Generate Framework Summary** action:
  - Reads current user Coach Discussion / Notes, including unsent draft notes.
  - Uses Mock Provider framework extraction by default.
  - Populates structured sections: Position, View A, View B, My opinion, Paragraph plan, Possible example.
  - Shows calm non-blocking messages for empty input, loading, success, and safe fallback.
  - Captures provider diagnostics for Debug Panel inspection.
- Phase 1 notes input supports Enter-to-send, Shift+Enter for newline, and IME composition protection for Chinese/Japanese/Korean input.
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

## Writing Task 1 Academic Practice (Implemented)
- V1.2 product direction is now Writing Task 1 Academic Basic Practice before Mock Exam.
- `/writing/task1` is a usable Academic Task 1 practice page instead of a placeholder.
- Scope is Academic only; General Training letters are deferred.
- Task 1 uses original text-based visual briefs and simple data cards for line graph, bar chart, table, pie chart, mixed chart, process, and map practice.
- Task 1 feedback has its own schema and Mock Provider analysis path covering overview, key features, comparisons, data accuracy, coherence, must-fix items, rewrite task, reusable report patterns, improved report/model excerpt, and markdown export.
- Task 1 diagnosis is Chinese-first in learner-facing sections, with English corrections/examples where useful; Improved Report / Model Excerpt remains English.
- Old Task 1 feedback records with sparse, English-only, or malformed display text receive Chinese-first display framing at render time without rewriting stored records.
- Task 1 under-length and extremely short answers receive conservative training estimates and explicit length feedback instead of high mock/local scores.
- Active Writing Task 1 practice links to History instead of embedding a recent-record list.
- Task 1 reports save local-first records with module `writing_task1`, task type, topic/tags, instruction, visual brief, quick plan, report, feedback, status, and timestamps.
- Task 1 retry/new prompt starts a new attempt without clearing unrelated saved records.
- Text-based visual briefs are the V1.2 baseline; interactive charts and richer data-accuracy mapping remain later work.

## Export Behavior (Implemented)
- Markdown export is attempt-level in V1.
- Task 1 exports a downloaded `.md` file using the same pattern as other modules; if provider markdown is absent, the app generates a complete local note from structured feedback.
- Session-level consolidated note export is not implemented yet.

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
- Framework extraction diagnostics are labeled with the `writing_framework_extraction` operation so they are distinguishable from final essay analysis.
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
