# Handoff For Next Chat

_Last updated: 2026-05-29_

## Project

IELTS Scholar - Local-First Training Agent

Repo: `https://github.com/Gzh123123123456/ielts-scholar`

Local path: `D:\Personal\Desktop\ielts-scholar_-local-first-training-agent`

## Stable Checkpoint

Stable pushed checkpoint before the Part 1 closeout: `ecb7de4 Simplify workflow docs and add Codex skills`.

Git commands, not this document, determine the current branch and sync state.

## Current Product Status

- Speaking active mainland May-Aug seasonal bank runtime is integrated through the active adapter with V1 fallback.
- Speaking has one editable transcript box plus an audio-backed transcription path; audio transcription reliability remains limited and fallback-prone.
- Normal Speaking provider output is structured feedback only; markdown/export is generated locally after successful parsing.
- Writing Task 2 basic practice and annotated essay overlay baseline are implemented, but Writing target/score/feedback consistency still needs a future audit.
- Writing Task 1 Academic basic practice is implemented; calibration remains future work requiring real samples.
- History, Progress, question-bank browsing, and active attempts are available in the local-first prototype.
- **2026-05-28/29 P0 storage incident**: localStorage quota exhaustion caused white-screen crash. Emergency P0 rescue implemented quota-safe writes, History visibility repair, and IndexedDB / PracticeRepository migration. Current state: 134 canonical records + 172 legacy sessions recovered into IndexedDB via backup import. **Final complete IndexedDB-inclusive backup confirmed exported by user 2026-05-29.** History migration-summary display fixed to show current IndexedDB inventory alongside initial migration result. See `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md` for full timeline and closeout record.
- Workflow/docs/skills simplification is completed as the current workflow baseline.
- Speaking Part 1 topic-thread practice is implemented as a development checkpoint: natural 3-4 question topic threads, traceable supplements for incomplete topics, annotated original answers, one cleaner retry answer per question, thread-level patterns, Material Bank, and Next Retry Plan.
- Part 1 integrity/reliability work is included: clean-retry safeguards, saved-result restoration safety, annotation de-duplication, transcript-spelling/pronunciation boundary tightening, audio-transcript candidate gating, exact-thread retry, coverage-aware/fair random selection, and topic-thread markdown/export cleanup.
- Prior real-provider browser checks established the general Part 1 results/feedback flow. The newest audio gating, exact-thread retry, fair random selection, stance/tense refinement, mixed-repair narrowing, and markdown export cleanup still need post-reinstall manual browser validation.

## Non-Negotiable Current Product Rules

- Speaking target headings:
  - lower bound below 7.0 -> `BAND 7 TARGET ANSWER`;
  - lower bound at or above 7.0, unless high-band-stable -> `BAND 7+ TARGET ANSWER`;
  - high-band-stable -> `STANDARD ANSWER`.
- Normal Speaking flow has no learner-facing higher-band target promise, advanced-target label, validation badge, or validation gate.
- A valid adjacent half-band Speaking range may be shown from one ordinary analysis pass.
- Normal successful Speaking targets use neutral `generated_target` diagnostics.
- Low/mid-band Speaking feedback should remain meaningful and layered where transcript evidence supports it.
- User samples, screenshots, transcripts, and Debug Panel output are regression evidence, not production content. Fix shared logic and do not hardcode the sample.
- Never claim Writing is fixed by a Speaking-only change.

## Next Priority Sequence

1. Verify the Part 1 checkpoint in browser after reinstall:
   - blank/low-signal recording does not auto-fill the main transcript and can only be adopted through the candidate action;
   - Retry This Thread replays the same question set in the same order;
   - Change Topic/random selection avoids immediate repeats and respects topic-level fairness;
   - one real-provider feedback/export run preserves explicit stance, keeps annotation tense aligned with cleaner-answer tense, avoids transcript-spelling/pronunciation repair, and exports the correct topic filename, Part 1 heading, nested transfer labels, and readable issue labels.
2. If those checks pass, mark this Part 1 checkpoint browser-accepted; if not, open a small follow-up fix.
3. Speaking Part 3 discussion-flow refinement follows next.
4. Audio transcription reliability.
5. PDF folder import + mainland active-bank publishing + SaaS-ready bank layer.
6. Writing Task 2 target/score/feedback consistency audit.
7. Writing Task 1 calibration with real samples.

## P0 Storage / IndexedDB Incident Handoff — 2026-05-28 to 2026-05-29

### 根因

localStorage 配额耗尽（约 6.056 MB）：`ielts_practice_records_v1`（约 3.362 MB，134 条记录）和 `ielts_sessions`（约 2.560 MB，172 条记录）占据几乎全部配额。`saveActiveSpeakingSession` → `writeJson` → `setItem` 路径上未捕获的 `QuotaExceededError` 导致白屏崩溃。

### 关键运行时证据

- 134 条规范练习记录（Speaking Parts 1/2/3 + Writing Tasks 1/2）存在于 `ielts_practice_records_v1`
- 172 条会话记录存在于 `ielts_sessions`
- 崩溃后 History 出现全局截断/可见性问题，但数据未被删除

### 已实施修复

**P0 即时救援**：配额安全写入、写入结果处理替代未捕获异常、`getAllPracticeRecords()` 消除 80 条截断、恢复失败阻止导航、存储健康面板 + 备份导出入口、只读 `查看结果`、AppContext 配额保护、Speaking/Writing 路径保存失败警告、AI usage 配额安全写入。

**IndexedDB / PracticeRepository 架构**：新建 `src/lib/practiceRepository.ts` + `src/lib/storage/indexedDb.ts`。stores：`practiceRecords`、`activeStates`、`legacySessionsArchive`、`meta`。将完整历史迁出 localStorage。支持完整 IndexedDB-inclusive 备份导出/导入。旧版 localStorage 释放保持手动和安全门控。

### 当前恢复状态

- 134 条规范 IndexedDB 练习记录已恢复且通过 History 可见
- 172 条旧版归档会话已恢复且可见
- 3 个活跃状态已报告
- Speaking Attempts、Writing Task 1 Attempts、Writing Task 2 Attempts 均可见
- localStorage 显示使用量 0.000 MB（用户未点击释放按钮；确切清除路径未证明）

### 未解决问题

- ~~History 迁移摘要显示陈旧（备份导入后不反映实际 IndexedDB 计数）~~ **已于 2026-05-29 修复** — 新增当前 IndexedDB 库存面板，迁移摘要重新标注为初始自动迁移
- `ielts_sessions` 在自动归档迁移前变为空/不可用的确切原因未确认
- localStorage 在未手动释放的情况下变为 0 MB 的确切路径未证明（2026-05-29 closeout 审计：源代码中不存在自动清除路径）
- ~~最终完整 IndexedDB-inclusive 备份导出待用户确认~~ **已于 2026-05-29 确认**

### Codex 注意事项

**在 Part 1 反馈或任何数据/存储工作之前**：
- 确认最终完整 IndexedDB-inclusive 备份已导出并保留在仓库之外
- 不要删除或重置任何 IndexedDB 历史
- 不要调用旧版释放/清理操作
- 不要运行破坏性 History 操作
- 不要依赖陈旧迁移摘要作为真实来源
- 使用可见 History 记录和恢复/导入报告作为当前证据

### 范围边界

- Part 1 反馈/教学问题收集正在进行中，有意不包含在本次存储事件文档中，等待后续用户指令
- 存储架构后续修复（迁移摘要修复、localStorage 消失审计）是独立的有界任务
- SaaS 云同步、跨浏览器迁移、诊断保留策略为未来架构工作

详细事件时间线和证据见 `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md`。

## Minimal Reading Rule

For a new context, read:

1. `AGENTS.md`
2. `docs/CURRENT_STATE.md`
3. `docs/CODEBASE_MAP.md`
4. `docs/PRODUCT_DESIGN_PRINCIPLES.md` only when product/UI/feedback behavior is involved

Read `docs/PROJECT_BACKLOG.md`, `docs/ROADMAP.md`, and `docs/DECISION_LOG.md` only as needed.

## Workflow Simplification

- Ordinary implementation uses `$ielts-implement`.
- Explicit daily closeout uses `$ielts-closeout`.
- Do not use closeout behavior during ordinary implementation.
