# Current State

_Last updated: 2026-06-10_

This is the active baseline, not a history log. Verify branch and sync state with git commands before work.

## Current Validated Baseline

- Current closeout baseline: Speaking Part 2 provider-output QA/repair, six-signal calibration, mastered-expression memory, and History/Storage panel cleanup are implemented for the 2026-06-10 closeout.
- Previous pushed workflow checkpoint: `ecb7de4 Simplify workflow docs and add Codex skills`.
- Workflow/docs/skills simplification remains the current workflow baseline.
- Codex is the primary implementation agent for scoped product work.
- Claude Code is an optional docs/status/lint/build helper unless explicitly approved for more.
- The app is a local-first React + TypeScript + Vite prototype.
- Mock Provider remains the default. Optional Gemini and auto/DeepSeek local provider modes exist for personal development only.
- Browser/client API keys are not production-safe; no SaaS provider/key architecture exists yet.
- Question-bank browsing, History, Progress, active attempts, and IndexedDB-backed practice records are implemented for the current local-first prototype.
- A lightweight global storage/backup drawer is mounted app-wide for repository status, backup export/import, and storage maintenance; full practice history lives on `/practice-history`.
- Task 2 annotated essay overlay baseline is implemented; future work should be polish/consolidation unless explicitly scoped.
- Writing Task 2 basic practice, framework coach/extraction, local-first records, feedback rendering, and export are implemented, but target/score/feedback consistency still needs a separate future audit.
- Writing Task 1 Academic basic practice is implemented with text-based visual briefs; full calibration remains future work and requires real samples.

## Current Speaking Rules

- Speaking uses the 2026 May-Aug mainland seasonal active bank through the active adapter, with V1 arrays preserved as fallback.
- Part 3 discussion questions are derived from mainland Part 2 follow-ups in the current seasonal data shape.
- Speaking has one editable transcript box for analysis plus an audio-backed transcription path.
- Audio transcription reliability remains limited and fallback-prone; manual transcript editing remains the safe path.
- Normal Speaking provider output is structured feedback only.
- Speaking markdown/export is generated locally after successful parsing.
- Speaking current answer display may show one conservative single-question estimate or a valid adjacent half-band range from one ordinary analysis pass.
- Speaking target headings:
  - lower bound below 7.0 -> `BAND 7 TARGET ANSWER`;
  - lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`;
  - high-band-stable -> `STANDARD ANSWER`.
- Speaking Part 2 is the exception to the old target-answer label: provider `part2Feedback.nextSpeakableVersion` is shown as `NEXT SPEAKABLE VERSION` and replaces the old Band 7 target answer surface.
- Normal Speaking learner flow does not use learner-facing higher-band target promises, advanced-target labels, validation badges, validation-failure states, or raw provider method errors.
- Normal successful Speaking targets use neutral `generated_target` diagnostics.
- Low/mid-band substantial Speaking answers should preserve meaningful corrections where supported by the transcript.

### Speaking Part 1

- Speaking Part 1 topic-thread practice is implemented as a development checkpoint: one-topic natural 3-4 question sets, multiple coherent thread sets for larger topics, and traceable product-supplement questions where the source topic is incomplete.
- Part 1 results are organized around annotated original answers, one cleaner retry answer per question, thread-level patterns, Material Bank, and a Next Retry Plan.
- Part 1 clean-retry integrity checks, saved-result safeguards, annotation de-duplication, transcript-spelling/pronunciation boundary tightening, audio-transcript candidate gating, exact-thread retry, coverage-aware/fair topic selection, and topic-thread markdown/export refinements are implemented.

### Speaking Part 2

- Speaking Part 2 now has a provider-native `part2Feedback` contract for anchored annotations, material type, story modules, six language signals, priority focus, next speakable version, and next-version highlights.
- The Part 2 UI displays `part2Feedback` fields; it should not infer final Part 2 feedback from old `fatalErrors`, `naturalnessHints`, or `preservedStyle`.
- Part 2 annotations are for necessary local anchored repairs only. Low-yield opener polish and language-signal enrichment belong in story modules or six language signals.
- Part 2 annotation volume adapts to learner level: mid/high answers stay low-noise, while low-band structurally unstable answers can surface more repeated anchored repairs.
- Part 2 six language signals are fixed: idiomatic expression, tense, connector, phrasal verb, collocation, and clause.
- Provider prompts define teacher planning, candidate ranking, one-signal ownership, field responsibility, and replace/add alternatives. The frontend renders provider-native fields while safety normalization repairs low-value connector upgrades, meta `bestUpgrade` labels, same-frame alternatives, invalid samples, and mastered-expression repeats.
- Connector upgrades should avoid low-training-value defaults such as `so`, `and`, and `but`; the product goal is to train richer spoken discourse links, not merely prove a connector is grammatically possible.
- Tense feedback should diagnose three layers first: past event/background, present reflection/current relevance, and future/current-future influence. It should not mechanically mark present-tense lines wrong inside a mostly past story.
- Collocation focuses on precise adverb + adjective first, then adverb + verb. Adjective+noun vocabulary chunks belong in story/vocabulary material rather than the collocation best-upgrade slot.
- Idiom and phrasal verb can overlap in real English, but the product assigns one primary teaching role and should not double-count the same expression.
- Clause feedback should teach high-quality clause frames or sentence-level structures, not bare `because`/`when`/`although` filler.
- Chinese diagnostic fields in six-signal cards should analyze user behavior, narrowness, confusion, or missing signal usage; concrete English recommendations belong in Best upgrade, Alternatives, samples, or the next speakable version.
- `alternativeUpgrades` supports `replace` and `add` so high-value learning assets are not forced into local source replacement.
- Part 2 Best upgrades can be marked mastered. This is a teaching-asset memory, not a language blacklist: future analysis should avoid re-teaching the exact mastered asset while still allowing natural use and correction.
- Speaking result-page retest keeps the previous result visible when re-analysis fails.
- Saved Part 2 history records are sanitized/restored with `part2Feedback` so older history entries do not open to blank result pages.

### Speaking Part 3

- Speaking Part 3 still uses individual follow-up questions derived from Part 2 prompts.
- Discussion-flow refinement remains upcoming product work.

## Storage Baseline

- IELTS Scholar moved from localStorage-only practice persistence toward IndexedDB-backed `PracticeRepository` after the 2026-05-28/29 P0 storage incident.
- See `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md` for the incident record.
- Current practice history restore/open paths should use the repository/sanitization layers rather than assuming legacy localStorage shape.
- No destructive IndexedDB, backup, migration, or deletion work should run without a separate scoped decision and verified backup state.

## Known Active Limitations

- Audio transcription can fail or fall back; browser Web Speech remains limited.
- Pronunciation is not formally scored.
- Provider keys in Vite/browser env are local-personal prototype only and not SaaS-safe.
- No production server/auth/database/RAG/provider-key architecture exists.
- PDF folder import, mainland active-bank publishing, and SaaS-ready bank administration remain future work.
- Writing Task 2 target/score/feedback consistency needs a separate audit.
- Writing Task 1 calibration remains future scoped work and needs real samples.
- Speaking Part 2 does not yet have full learner habit/profile aggregation or a shared cross-Part material library. Current persistent profile memory is limited to Part 2 mastered teaching assets; `profileSignalZh` remains per-attempt unless future profile aggregation is scoped.

## Next Priorities

1. Speaking/Writing profile design: aggregate repeated weak signals, low-range expressions, missing signal usage, common errors, and accumulated expression assets without turning per-attempt UI into unsupported cross-session claims.
2. Speaking profile information architecture: keep Part 1 / Part 2 / Part 3 under one Speaking Profile with part tags and filters; keep mastered Part 2 expressions as a secondary collapsible module.
3. Shared material library design: confirmed learner material, suggested material, topic-bank links, user keep/delete workflow, and cross-Part reuse boundaries.
4. Speaking Part 3 discussion-flow refinement.
5. Audio transcription reliability.
6. PDF folder import + mainland active-bank publishing + SaaS-ready bank layer.
7. Writing Task 2 target/score/feedback consistency audit.
8. Writing Task 1 calibration with real samples.

## Navigation Pointers

- Use `docs/CODEBASE_MAP.md` to find files.
- Use `docs/PRODUCT_DESIGN_PRINCIPLES.md` for durable product principles.
- Use `docs/PROJECT_BACKLOG.md` and `docs/ROADMAP.md` only when planning future work.
- Use `docs/DECISION_LOG.md` only for historical decisions and rationale; superseded entries are not current instructions.
