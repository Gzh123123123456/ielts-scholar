# Codebase Map

_Last updated: 2026-05-24_

## Purpose

This is a navigation map for Codex and future agents. It is not a product spec, not a backlog, and not a decision log. Use it to find the right files quickly before making a scoped change.

## Source-of-truth rule

- Current source code is the highest source of truth.
- `git status` and `git log` are the source of truth for branch and sync state.
- `docs/HANDOFF_NEXT_CHAT.md` and `docs/CURRENT_STATE.md` explain product context, but commit hashes or branch notes in docs can lag behind the real repo.

## App routes and main pages

- Route wiring lives in `src/App.tsx`.
- `/speaking/practice` -> `src/pages/SpeakingPractice.tsx`.
- `/writing` -> `src/pages/Writing.tsx`, the Writing entry page and Task 1 / Task 2 bank launch point.
- `/writing/task1` -> `src/pages/WritingTask1Placeholder.tsx`. The filename is legacy; the page is the usable Task 1 Academic practice page.
- `/writing/task2/practice` -> `src/pages/WritingTask2Practice.tsx`.
- `/progress` -> `src/pages/Progress.tsx`.
- `/practice-history` -> `src/pages/PracticeHistory.tsx`.
- Global diagnostics render from `src/components/ui/DebugPanel.tsx` and `src/components/ui/ApiStatusPanel.tsx`.

## Speaking runtime map

- Speaking practice runtime lives mostly in `src/pages/SpeakingPractice.tsx`: part switching, recording/transcript state, active attempt restore, analysis, retry/new question, bank modal, export, and result rendering.
- Speaking recording now runs browser Web Speech and MediaRecorder audio capture in parallel where available. Audio blobs are kept in page memory for explicit transcription requests and are not written to localStorage.
- Speaking transcript review centers one editable transcript box for analysis. Browser and audio transcripts remain secondary/collapsed details and internal record/debug fields. Only the visible transcript is sent to `routedAnalyzeSpeaking`.
- Provider route status should stay in `src/components/ui/DebugPanel.tsx` and `src/components/ui/ApiStatusPanel.tsx`, not as a main Speaking learner banner. Local transcript status may still say whether audio or browser transcription was used.
- Current runtime imports V1 bank arrays from `src/data/questions/bank.ts`: `speakingPart1`, `speakingPart2`, and `speakingPart3`.
- Old V1 speaking bank data lives in `src/data/questions/bank.ts`.
- 2026 May-Aug seasonal bank data lives in `src/data/speaking/speakingBank2026MayAug.ts`, with shared types in `src/data/speaking/speakingPromptTypes.ts` and helpers in `src/data/speaking/speakingBankIndex.ts`.
- Active Speaking practice bank exports live in `src/data/speaking/activeSpeakingBank.ts`.
- The active adapter converts mainland-only 2026 May-Aug seasonal `SpeakingPrompt` data into the V1 `SpeakingQuestion` runtime shape and preserves V1 fallback arrays from `src/data/questions/bank.ts`.
- Part 3 is derived from mainland Part 2 `followUps` because the seasonal data stores discussion questions under Part 2 prompts.
- Preserve V1 fallback in any future seasonal integration task.
- Stable IDs matter for route-state selection, practice-count matching, history restore, and Progress coverage.

## Speaking feedback map

Before changing Speaking feedback, inspect:

- Contract: `src/lib/ai/schemas.ts`.
- Provider prompts and fixtures: `src/lib/ai/providers/mockProvider.ts`, `src/lib/ai/providers/geminiProvider.ts`, `src/lib/ai/providers/deepseekProvider.ts`, and `src/lib/ai/providers/base.ts`.
- Routing: `src/lib/ai/router.ts`.
- Safety normalization: `src/lib/ai/safety.ts`.
- Independent target validation: `src/lib/ai/targetValidation.ts`.
- Shared target state: `src/lib/scoreLayer.ts`.
- Rendering/runtime: `src/pages/SpeakingPractice.tsx`.
- Export: `src/lib/markdownExport.ts`.
- Diagnostics: `src/components/ui/DebugPanel.tsx` if diagnostic fields or pipeline steps change.
- Audio transcription operation: `speaking_audio_transcription` is routed through `src/lib/ai/router.ts`, normalized in `src/lib/ai/safety.ts`, and exposed in provider diagnostics. Gemini implements real audio transcription through inline audio input; DeepSeek intentionally does not implement it; Mock returns a clearly labeled development transcript.
- Audio transcription context hints are built in `src/lib/ai/transcriptionHints.ts`. Keep the hint list compact and use it only for ASR disambiguation, not grammar correction. Do not add personal glossary or user-specific vocabulary memory.
- Speaking target display is intentionally simple in the normal learner flow: generated `upgradedAnswer` is shown when generation succeeds, without learner-facing certification gating.
- Normal Speaking provider responses should contain structured feedback only. Do not ask providers to generate `obsidianMarkdown`, Band 8+/certification/self-score target fields, or `riskNoteZh` for ordinary `speaking_analysis`; `src/lib/ai/safety.ts` / `src/lib/markdownExport.ts` build markdown locally after parsing.
- Speaking Part 1 / Part 2 / Part 3 share the same score and target display principles: current answer shows either an estimated single-question band or an adjacent half-band boundary range from the ordinary `speaking_analysis` pass.
- Speaking low/mid-band feedback depth is regression-sensitive: low-noise means layered, high-impact, readable feedback, not sparse feedback. For 5.0-6.0 answers, prompts should surface enough major phrase and language fixes across `fatalErrors` and `naturalnessHints`, link them to the target answer when useful, and keep `STANDARD ANSWER` reserved for high-band stable 8.0+ outputs.
- Valid adjacent half-band ranges are normalized in `src/lib/ai/safety.ts` and displayed by `src/pages/SpeakingPractice.tsx`; provider prompts should return the active schema shape, not placeholder ranges.
- `src/components/ui/DebugPanel.tsx` should show neutral `generated_target` diagnostics for normal successful Speaking target answers.
- Normal Speaking flow does not use `speaking_score_only` as a target display gate. Any remaining score-only helpers must stay dormant/dev-only unless a future scoped scoring audit reintroduces them.
- Speaking target labels are pedagogical, not certified: current lower bound below 7.0 shows `BAND 7 TARGET ANSWER`, current lower bound at or above 7.0 shows `BAND 7+ TARGET ANSWER`, and existing high-band-stable output may show `STANDARD ANSWER`.
- Provider diagnostics may stay in Debug Panel / API Status, but certification provider failures must not appear in the normal learner target-answer area.

## Writing Task 2 map

Task 2 has a three-phase flow in `src/pages/WritingTask2Practice.tsx`:

- Phase 1: framework discussion and editable framework summary.
- Phase 2: essay writing.
- Phase 3: feedback, annotated essay, language bank, logic review, target model answer, and export.

Relevant layers:

- Contract: `src/lib/ai/schemas.ts`.
- Provider prompts and mock fixtures: `src/lib/ai/providers/*`.
- Routing: `src/lib/ai/router.ts`.
- Safety normalization: `src/lib/ai/safety.ts`.
- Independent target validation: `src/lib/ai/targetValidation.ts`.
- Shared target state: `src/lib/scoreLayer.ts`.
- Page rendering: `src/pages/WritingTask2Practice.tsx`.
- Sentence corrections, Language Bank, target model answer, and annotated essay overlay are rendered in `src/pages/WritingTask2Practice.tsx` from `WritingFeedback`.
- Export: `src/lib/markdownExport.ts`.
- Debug diagnostics: `src/components/ui/DebugPanel.tsx`.

Important: the Task 2 annotated essay overlay baseline is already implemented. Future work should be polish or consolidation only unless explicitly scoped. Do not rebuild it from scratch.

## Writing Task 1 map

- `src/pages/WritingTask1Placeholder.tsx` is legacy-named but currently contains the usable Task 1 Academic practice page.
- Task 1 prompt data lives in `writingTask1Academic` inside `src/data/questions/bank.ts`.
- Task 1 feedback uses `WritingTask1Feedback` in `src/lib/ai/schemas.ts`, provider support in `src/lib/ai/providers/*`, safety normalization in `src/lib/ai/safety.ts`, target-state resolution in `src/lib/scoreLayer.ts`, and export support in `src/lib/markdownExport.ts`.
- Task 1 target output is conservative/generated.
- Task 1 does not yet have the same independent target validation maturity as Speaking and Writing Task 2.
- Full Task 1 calibration needs real Task 1 debug samples and should not be done blindly.

## AI provider / feedback contract map

The linked layers are:

- `src/lib/ai/schemas.ts`: feedback and diagnostic shapes.
- `src/lib/ai/providers/*`: provider implementations, prompts, and mock fixtures.
- `src/lib/ai/router.ts`: provider selection and fallback routing.
- `src/lib/ai/safety.ts`: parsing, fallback objects, normalization, score/target consistency safeguards.
- `src/lib/ai/targetValidation.ts`: independent target validation loops for Speaking and Task 2.
- `src/lib/scoreLayer.ts`: shared target-state semantics.
- UI rendering in `src/pages/SpeakingPractice.tsx`, `src/pages/WritingTask2Practice.tsx`, and `src/pages/WritingTask1Placeholder.tsx`.
- `src/lib/markdownExport.ts`: learner-facing markdown notes.
- `src/components/ui/DebugPanel.tsx`: diagnostics and target pipeline display.

Score, diagnosis, target layer, target output, UI, export, and history must stay aligned. Do not fix contradictions by changing display text only.

## Practice records / history map

- Local practice persistence lives in `src/lib/practiceRecords.ts`.
- The stable record key is `ielts_practice_records_v1`.
- Active attempts are also stored there through module-specific helpers for Speaking, Writing Task 2, and Writing Task 1.
- History display and restore/delete behavior live in `src/pages/PracticeHistory.tsx`.
- Progress summaries and coverage are data-derived in `src/pages/Progress.tsx`.
- Question-bank practice counts are computed in `src/components/practice/QuestionBankModal.tsx` from analyzed records with feedback. Do not hardcode counts.

## Common task entry checklist

- Before changing Speaking feedback, inspect `schemas.ts`, provider files, `router.ts`, `safety.ts`, `targetValidation.ts`, `scoreLayer.ts`, `SpeakingPractice.tsx`, `markdownExport.ts`, and `DebugPanel.tsx`.
- Before changing Task 2 feedback, inspect `schemas.ts`, provider files, `router.ts`, `safety.ts`, `targetValidation.ts`, `scoreLayer.ts`, `WritingTask2Practice.tsx`, `markdownExport.ts`, and `DebugPanel.tsx`.
- Before changing Task 1 calibration, inspect `WritingTask1Placeholder.tsx`, `schemas.ts`, provider files, `safety.ts`, `scoreLayer.ts`, `markdownExport.ts`, and require real Task 1 debug samples.
- Before changing question banks, inspect `src/data/questions/bank.ts`, `src/components/practice/QuestionBankModal.tsx`, `src/lib/practiceRecords.ts`, `src/pages/Progress.tsx`, and the seasonal files under `src/data/speaking/`; preserve IDs and practice counts.
- Before changing export, inspect `src/lib/markdownExport.ts` and the relevant feedback schema/rendering page.
