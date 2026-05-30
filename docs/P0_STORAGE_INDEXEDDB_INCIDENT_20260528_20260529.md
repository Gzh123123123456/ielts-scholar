# P0 Storage / IndexedDB Incident — 2026-05-28 to 2026-05-29

## 事件概要

localStorage 配额耗尽导致应用白屏崩溃。紧急 P0 修复：添加配额保护写入、恢复 History 可见性、实施 IndexedDB / PracticeRepository 架构迁移。当前数据已通过备份导入恢复到 IndexedDB，但存在未解决的显示一致性问题，最终备份确认仍待完成。

---

## 1. 初始故障症状

### 触发场景

Speaking Part 1 测试过程中，在 analysis / history restore 操作附近发生白屏崩溃。

### 控制台错误

```
Uncaught QuotaExceededError:
Failed to execute 'setItem' on 'Storage':
Setting the value of 'ielts_active_speaking_practice_v1' exceeded the quota.

调用路径:
practiceRecords.ts writeJson
→ saveActiveSpeakingSession
→ PracticeHistory.tsx openSpeakingAttempt
```

### 崩溃后观察到的现象

- Practice History 最初似乎丢失了之前的 Writing 和 Part 3 记录
- 可见的 History 条目无法打开/恢复
- `/practice-history` 页面上的 Debug Panel 显示 saved-session 计数但不显示 provider 诊断/日志

---

## 2. 存储大小诊断

### localStorage 使用量

| 键 | 大约大小 |
|---|---|
| `ielts_practice_records_v1` | 3.362 MB |
| `ielts_sessions` | 2.560 MB |
| `ielts_active_writing_task2_practice_v1` | 0.068 MB |
| `ielts_api_usage_v1` | 0.054 MB |
| 其他键 | 较小 |

**总计约 6.056 MB**，接近浏览器 localStorage 配额上限（通常 5-10 MB）。

### 根本原因

累积的完整历史/会话数据存储在 localStorage 中导致配额耗尽，而非用户记录被删除。

---

## 3. 记录计数证据

### `ielts_practice_records_v1`

| 类别 | 数量 |
|---|---|
| speaking part=2 | 50 |
| speaking part=1 / part1_topic_thread | 44 |
| speaking part=1 / legacy-single | 15 |
| speaking part=3 | 11 |
| writing task2 | 10 |
| writing_task1 | 4 |
| **总计** | **134** |

### `ielts_sessions`

| 类别 | 数量 |
|---|---|
| speaking part=2 | 55 |
| speaking part=1 / part1_topic_thread | 43 |
| writing | 32 |
| speaking part=1 / legacy-single | 27 |
| speaking part=3 | 15 |
| **总计** | **172** |

### 诊断结论

```
localStorage 配额耗尽
+ History 全局截断 / 可见性问题
+ 恢复-写入崩溃路径
```

而非确认的 Writing 或 Speaking 记录删除。

---

## 4. P0 修复实施

Claude Code 在此次紧急 P0 存储/数据完整性工作中被临时授权，因为 Codex 配额不可用且任务仅限于数据救援和存储安全，不涉及 product-feedback 功能开发。

### Phase 1 — 即时 P0 救援层

- `src/lib/practiceRecords.ts` 中添加配额安全写入
- 存储写入结果处理，替代未捕获的 `QuotaExceededError`
- 添加 `getAllPracticeRecords()`，使 History 不再在模块分组前全局截断 80 条记录
- 恢复失败时阻止导航到损坏状态
- History 页面添加存储健康面板和备份导出入口
- 已保存记录支持只读 `查看结果` 访问
- 相关 `AppContext` localStorage 写入添加配额保护
- 相关 Speaking/Writing 路径添加可见的保存失败警告
- 非关键 AI usage/router 记录添加配额安全写入，避免诊断持久化中断已生成的反馈

### Phase 2 — IndexedDB / PracticeRepository 架构切片

实施了新架构：

```
IndexedDB-backed PracticeRepository
```

规划的 stores：

| Store | 用途 |
|---|---|
| `practiceRecords` | 规范练习记录 |
| `activeStates` | 活跃状态 |
| `legacySessionsArchive` | 旧版会话档案 |
| `meta` | 元数据 |

目的：

- 将完整历史结果从 localStorage 迁出
- 停止将 localStorage 作为权威长期历史数据库
- 避免重复完整会话持久化
- 分别保存规范练习历史和旧版会话档案
- 支持完整的 IndexedDB-inclusive 备份导出和备份导入
- 旧版 localStorage 释放保持手动和安全门控

---

## 5. 恢复时间线

### Phase A — 崩溃与诊断 (2026-05-28)

- Part 1 analysis/history 交互触发白屏行为
- 控制台显示 `ielts_active_speaking_practice_v1` 上的 `QuotaExceededError`
- 浏览器存储检查显示约 6.056 MB localStorage 使用量
- 记录计数检查证明历史记录仍存在于浏览器存储中

### Phase B — P0 只读救援 (2026-05-28)

- History 可见性修复，Writing Task 1 / Task 2 和较早的 Speaking 数据可再次显示
- 只读结果访问可用
- 添加存储警告和备份导出入口
- 手动截图验证确认旧的 Speaking 和 Writing 记录可再次读取

### Phase C — IndexedDB 迁移尝试 (2026-05-28 至 2026-05-29)

- 创建了新的 IndexedDB / PracticeRepository 实现
- 初始自动迁移显示成功规范迁移：

```
134 规范练习记录
3 活跃状态
```

- 但是，在该自动迁移显示中，旧版会话报告为：

```
0 旧版源记录
0 旧版归档记录
```

即使之前的浏览器证据显示 `ielts_sessions` 中有 172 条记录。

### Phase D — 旧版恢复导入 (2026-05-29)

- 用户导入了之前导出的 pre-IndexedDB 浏览器备份
- History UI 随后显示成功恢复/导入结果：

```
Imported canonical records: 134
Skipped canonical records: 0
Archived legacy sessions: 172
Skipped legacy sessions: 0
Archive key verification: 172 / 172
Active states: 3
```

- History 再次显示 Speaking Attempts、Writing Task 1 Attempts、Writing Task 2 Attempts，以及：

```
旧版会话档案（172 总计）
```

### Phase E — 当前观察到状态 (2026-05-29)

最新截图证据显示：

```
localStorage 显示使用量: 0.000 MB
可见的剩余轻量键: ielts_profile
```

同时页面显示：

- 已恢复的 Speaking 历史卡片
- 已恢复的 Writing Task 1 历史卡片
- 已恢复的 Writing Task 2 历史卡片
- `旧版会话档案（172 总计）`
- 导入报告确认 134 条规范记录和 172 条归档会话恢复到 IndexedDB

### 重要说明：localStorage 变为空

用户明确表示**没有**点击 `释放旧版存储空间` 操作。

```
在代码更改和应用重启后，History UI 显示的 localStorage 使用量为 0.000 MB，即使用户未手动调用旧版释放操作。导致较早的大 localStorage 键被清除或停止暴露的确切路径尚未从当前可用证据中得到证实。
```

另外记录：

```
用户一直使用 localhost:3000；观察到的空 localStorage 状态不能用切换到不同 localhost 端口/origin 来解释。
```

---

## 6. 当前恢复状态

### 确认已恢复且可见

| 项目 | 状态 |
|---|---|
| 规范 IndexedDB 练习记录 | 134 条已恢复 / 通过 History 可见 |
| 旧版归档会话 | 172 条已恢复 / 作为归档旧版会话可见 |
| 活跃状态 | 恢复导入期间报告 3 个 |
| Speaking Attempts | 可见 |
| Writing Task 1 Attempts | 可见 |
| Writing Task 2 Attempts | 可见 |

### 当前已知显示不一致

~~绿色自动迁移摘要可能仍显示零源/零复制或过时的迁移信息，即使下方的导入报告和可见的 History 记录证明 IndexedDB 当前包含已恢复的练习/归档数据。~~

**已于 2026-05-29 closeout 修复：** 迁移摘要现在标注为「初始自动迁移」并附说明，明确指出其反映的是首次数据库创建时的结果，而非备份导入后的当前状态。新增从 `getStorageHealth()` 实时读取的「当前 IndexedDB 库存」面板，直接显示规范记录、旧版归档会话和活跃状态的实际数量。

### 备份状态

**已于 2026-05-29 确认：** 最终完整 IndexedDB-inclusive 备份已由用户导出并保存在 IELTS Scholar 项目目录之外。此确认基于用户声明；Claude 未独立检查外部备份文件。

备份内容应包含：
- 134 条规范练习记录
- 172 条旧版归档会话
- 存在的 3 个活跃状态

---

## 7. 当前安全边界

在最终备份/导出确认和有意的 closeout 决定之前：

- 不要将存储事件视为完全关闭
- 不要删除或重置任何 IndexedDB 历史
- 不要再次调用任何旧版释放/清理操作
- 不要运行破坏性 History 操作（如 Delete）
- 不要依赖过时的迁移摘要作为真实来源
- 使用可见的 History 记录和恢复/导入报告作为当前证据
- 将 Part 1 反馈重新设计与存储架构问题分开

```
在恢复密集 Part 1 回归测试之前，确认最终完整 IndexedDB-inclusive 备份已导出并保留在仓库之外，并将存储事件保留为已知架构后续事项。
```

---

## 8. 未解决问题

1. **History 迁移摘要陈旧** — **已于 2026-05-29 closeout 修复**。Practice History 现在显示：
   - 标注为「初始自动迁移」的历史迁移结果（含说明：此结果可能不反映备份导入后的实际库存）
   - 从 `getStorageHealth()` 实时读取的「当前 IndexedDB 库存」面板（规范记录数、旧版归档数、活跃状态数）
   迁移摘要不再被误认为是恢复后的当前真实状态。
2. **`ielts_sessions` 在自动迁移前不可用**：在自动归档迁移之前，`ielts_sessions` 中的 172 条记录变得不可用/为空的确切原因未确认。
3. **localStorage 在未手动释放的情况下变空**：代码更改和重启后，localStorage 显示 0.000 MB 的确切路径未证明。**2026-05-29 closeout 审计结果**：当前源代码中不存在自动清除 `ielts_practice_records_v1` 或 `ielts_sessions` 的代码路径。`initializePracticeRepository()` 仅从 localStorage 读取，不写入或删除。所有 localStorage 清除路径（`releaseLegacyLocalStorage`、`clearAllPersonalDataExplicitly`、`clearAllIeltsLocalData`、各 `removeJson` 调用点）均需显式用户操作。确切原因仍未从当前可用代码证据中得到证实。
4. **最终备份确认** — **已于 2026-05-29 解决**。用户确认最终完整 IndexedDB-inclusive 备份已导出并保存在项目目录之外。

---

## 9. 未来后续事项

### P0 / P1

- 恢复后确认最终完整 IndexedDB-inclusive 备份导出
- 修复 History 迁移摘要显示，使其反映恢复导入后的实际 IndexedDB 规范/归档计数
- 审计为什么 localStorage 在重启后显示 0 MB（用户未手动释放旧存储）；没有证据不声称根本原因
- 备份确认和受控冒烟测试后验证正常新练习持久化
- 重新审视剩余的存储释放控件，使其不会错误表示已为空或已导入的恢复状态

### 未来架构

- 为未来 SaaS 同步进行 payload 精简
- 诊断保留策略
- 安全的云同步/导入模型
- 跨浏览器/账户迁移策略

### 明确不在范围内

Part 1 反馈/教学问题收集正在进行中，有意不包含在本次存储事件文档更新中，等待后续用户指令。

---

## 10. 2026-05-29 Closeout 记录

### 已完成

- **备份确认记录**：最终完整 IndexedDB-inclusive 备份已由用户确认导出并保存在项目目录之外。
- **History 迁移摘要修复**：迁移摘要重新标注为「初始自动迁移」，新增实时「当前 IndexedDB 库存」面板（规范记录数、旧版归档数、活跃状态数、localStorage 用量）。History 页面不再将陈旧迁移结果显示为当前恢复真相。
- **localStorage 0.000 MB 审计**：审查了所有 localStorage 写入/删除路径。未发现可自动清除 `ielts_practice_records_v1` 或 `ielts_sessions` 的代码路径。确切原因仍未从当前代码证据中得到证实，已记录为未解释。
- **冒烟测试计划**：见下方第 11 节。

### 未修改

- 无 Speaking Part 1 反馈更改
- 无 provider prompt / score label 更改
- 无 Writing 更改
- 无 merge / push / commit
- 无数据删除或重置
- 未触发旧版存储释放

### 修改的文件

- `src/pages/PracticeHistory.tsx` — 新增当前 IndexedDB 库存显示，迁移摘要重新标注
- `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md` — 更新备份状态、未解决问题、新增 closeout 记录
- `docs/HANDOFF_NEXT_CHAT.md` — 更新备份确认状态
- `docs/CURRENT_STATE.md` — 更新存储恢复状态
- `docs/PROJECT_BACKLOG.md` — 更新 P0/P1 项目状态
- `docs/KNOWN_LIMITATIONS.md` — 更新已知限制 #5

## 11. 实施文件参考

### 已修改的源文件（未提交，在脏工作树中）

- `src/lib/practiceRecords.ts` — 配额安全写入、getAllPracticeRecords、备份导出/导入支持
- `src/lib/practiceRepository.ts` — **新文件**：IndexedDB-backed PracticeRepository
- `src/lib/storage/indexedDb.ts` — **新文件**：IndexedDB 包装层
- `src/pages/PracticeHistory.tsx` — 存储健康面板、备份导出/导入、迁移摘要、恢复导入 UI
- `src/context/AppContext.tsx` — 配额保护的 localStorage 写入
- `src/pages/SpeakingPractice.tsx` — 保存失败警告、配额安全路径
- `src/pages/WritingTask1Placeholder.tsx` — 保存失败警告
- `src/pages/WritingTask2Practice.tsx` — 保存失败警告
- `src/lib/ai/usage.ts` — 配额安全非关键诊断持久化
- `src/components/ui/DebugPanel.tsx` — 存储诊断更新
