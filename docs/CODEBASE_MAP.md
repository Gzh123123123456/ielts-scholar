# Codebase Map

_Last updated: 2026-05-29_

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
- Current Speaking runtime uses the active mainland adapter in `src/data/speaking/activeSpeakingBank.ts`.
- Old V1 speaking bank arrays in `src/data/questions/bank.ts` are preserved as fallback data.
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
- Target-validation helpers: `src/lib/ai/targetValidation.ts`. For normal Speaking, remaining target-validation or score-only helpers are dormant/compatibility/future-audit territory, not the learner-facing display gate.
- Shared target state: `src/lib/scoreLayer.ts`.
- Rendering/runtime: `src/pages/SpeakingPractice.tsx`.
- Export: `src/lib/markdownExport.ts`.
- Diagnostics: `src/components/ui/DebugPanel.tsx` if diagnostic fields or pipeline steps change.
- Audio transcription operation: `speaking_audio_transcription` is routed through `src/lib/ai/router.ts`, normalized in `src/lib/ai/safety.ts`, and exposed in provider diagnostics. Gemini implements real audio transcription through inline audio input; DeepSeek intentionally does not implement it; Mock returns a clearly labeled development transcript.
- Audio transcription context hints are built in `src/lib/ai/transcriptionHints.ts`. Keep the hint list compact and use it only for ASR disambiguation, not grammar correction. Do not add personal glossary or user-specific vocabulary memory.
- Speaking target display is intentionally simple in the normal learner flow: generated `upgradedAnswer` is shown when generation succeeds, without learner-facing validation gating.
- Normal Speaking provider responses should contain structured feedback only. Do not ask providers to generate `obsidianMarkdown`, higher-band validation/self-score target fields, or `riskNoteZh` for ordinary `speaking_analysis`; `src/lib/ai/safety.ts` / `src/lib/markdownExport.ts` build markdown locally after parsing.
- Speaking Part 1 / Part 2 / Part 3 share the same score and target display principles: current answer shows either an estimated single-question band or an adjacent half-band boundary range from the ordinary `speaking_analysis` pass.
- Speaking low/mid-band feedback depth is regression-sensitive: low-noise means layered, high-impact, readable feedback, not sparse feedback. For 5.0-6.0 answers, prompts should surface enough major phrase and language fixes across `fatalErrors` and `naturalnessHints`, link them to the target answer when useful, and keep `STANDARD ANSWER` reserved for high-band stable 8.0+ outputs.
- Valid adjacent half-band ranges are normalized in `src/lib/ai/safety.ts` and displayed by `src/pages/SpeakingPractice.tsx`; provider prompts should return the active schema shape, not placeholder ranges.
- `src/components/ui/DebugPanel.tsx` should show neutral `generated_target` diagnostics for normal successful Speaking target answers.
- Normal Speaking flow does not use `speaking_score_only` or target validation as a target display gate. Any remaining score-only or target-validation helpers must stay dormant/compatibility/dev-only unless a future scoped scoring audit reintroduces them.
- Speaking target labels are pedagogical: current lower bound below 7.0 shows `BAND 7 TARGET ANSWER`, current lower bound at or above 7.0 shows `BAND 7+ TARGET ANSWER`, and existing high-band-stable output may show `STANDARD ANSWER`.
- Provider diagnostics may stay in Debug Panel / API Status, but validation provider failures must not appear in the normal learner target-answer area.
- If one answer exposes a bug, inspect the shared provider, safety, rendering, or workflow path rather than editing data or behavior for that exact sample.
- Speaking Part 2 has a dedicated `part2Feedback` contract in `src/lib/ai/schemas.ts`, normalized in `src/lib/ai/safety.ts`, persisted/restored through `src/lib/practiceRecords.ts` / `src/lib/practiceRepository.ts`, rendered in `src/pages/SpeakingPractice.tsx`, and exported in `src/lib/markdownExport.ts`.
- Part 2 provider prompt policy lives in `speakingPart2NativeFeedbackInstruction` in `src/lib/ai/providers/geminiProvider.ts`; DeepSeek imports the same instruction. Mock fixtures in `src/lib/ai/providers/mockProvider.ts` should demonstrate the same contract.
- Part 2 learner-facing target output is `NEXT SPEAKABLE VERSION`, driven by `part2Feedback.nextSpeakableVersion`, not the old Band 7 target-answer label.
- Part 2 UI should display provider-native anchored annotations, story modules, six language signals, replace/add alternatives, and next-version highlights. It should not locally guess signal quality or patch provider output with phrase blacklists/whitelists.

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
- Target validation helpers: `src/lib/ai/targetValidation.ts`.
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
- Task 1 does not yet have the same target-validation maturity as Speaking and Writing Task 2.
- Full Task 1 calibration needs real Task 1 debug samples and should not be done blindly.

## AI provider / feedback contract map

The linked layers are:

- `src/lib/ai/schemas.ts`: feedback and diagnostic shapes.
- `src/lib/ai/providers/*`: provider implementations, prompts, and mock fixtures.
- `src/lib/ai/router.ts`: provider selection and fallback routing.
- `src/lib/ai/safety.ts`: parsing, fallback objects, normalization, score/target consistency safeguards.
- `src/lib/ai/targetValidation.ts`: target-validation loops for Speaking and Task 2.
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
- A lightweight global history drawer lives in `src/components/ui/HistoryPanel.tsx` and is mounted from `src/App.tsx`; it provides quick filtering, restore entry points, backup export, and a link to the full History page.
- Progress summaries and coverage are data-derived in `src/pages/Progress.tsx`.
- Question-bank practice counts are computed in `src/components/practice/QuestionBankModal.tsx` from analyzed records with feedback. Do not hardcode counts.

## Storage architecture map

IELTS Scholar 正在进行从 localStorage 到 IndexedDB 的 local-first 持久化过渡（由 2026-05-28/29 P0 存储配额事件触发）。详见 `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md`。

### 关键文件

- `src/lib/practiceRecords.ts` — 旧版 localStorage 练习记录持久化（配额安全写入、备份导出/导入 helper、`getAllPracticeRecords()` 消除 80 条截断）
- `src/lib/practiceRepository.ts` — **新文件**：IndexedDB-backed PracticeRepository（规范练习记录 + 活跃状态 + 旧版归档会话 + 元数据）
- `src/lib/storage/indexedDb.ts` — **新文件**：IndexedDB 包装层（数据库打开/升级、事务、存储操作）
- `src/pages/PracticeHistory.tsx` — History UI（迁移摘要、备份导出/导入、恢复导入、存储健康面板）
- `src/context/AppContext.tsx` — 应用级 localStorage 写入的配额保护

### IndexedDB stores

| Store | 内容 |
|---|---|
| `practiceRecords` | 规范练习记录（134 条已恢复） |
| `activeStates` | 活跃状态（3 个已报告） |
| `legacySessionsArchive` | 旧版会话档案（172 条已恢复） |
| `meta` | 元数据 |

### 重要提醒

- History 迁移摘要显示可能在备份导入后陈旧；不要将其作为 IndexedDB 状态的真实来源
- 旧版 localStorage 键（`ielts_practice_records_v1`、`ielts_sessions` 等）已被清除或不再暴露（确切路径未证明，用户未点击释放按钮）
- 当前轻量 localStorage 键（如 `ielts_profile`）保持为 localStorage 键
- 备份导出/导入支持完整的 IndexedDB-inclusive 备份（规范记录 + 旧版归档 + 活跃状态）

### 修改存储代码前的检查清单

- 检查 `practiceRepository.ts` 了解当前 IndexedDB store schema
- 检查 `indexedDb.ts` 了解数据库版本和升级逻辑
- 检查 `PracticeHistory.tsx` 了解迁移摘要、备份导入/导出、恢复导入 UI
- 检查 `practiceRecords.ts` 了解旧版 localStorage 兼容性和配额安全模式
- 在未确认最终备份的情况下，不要运行破坏性 IndexedDB 操作

## Common task entry checklist

- Before changing Speaking feedback, inspect `schemas.ts`, provider files, `router.ts`, `safety.ts`, `targetValidation.ts`, `scoreLayer.ts`, `SpeakingPractice.tsx`, `markdownExport.ts`, and `DebugPanel.tsx`.
- Before changing Task 2 feedback, inspect `schemas.ts`, provider files, `router.ts`, `safety.ts`, `targetValidation.ts`, `scoreLayer.ts`, `WritingTask2Practice.tsx`, `markdownExport.ts`, and `DebugPanel.tsx`.
- Before changing Task 1 calibration, inspect `WritingTask1Placeholder.tsx`, `schemas.ts`, provider files, `safety.ts`, `scoreLayer.ts`, `markdownExport.ts`, and require real Task 1 debug samples.
- Before changing question banks, inspect `src/data/questions/bank.ts`, `src/components/practice/QuestionBankModal.tsx`, `src/lib/practiceRecords.ts`, `src/pages/Progress.tsx`, and the seasonal files under `src/data/speaking/`; preserve IDs and practice counts.
- Before changing export, inspect `src/lib/markdownExport.ts` and the relevant feedback schema/rendering page.
