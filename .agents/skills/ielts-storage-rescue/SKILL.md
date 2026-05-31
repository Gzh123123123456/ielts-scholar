---
name: ielts-storage-rescue
description: IELTS Scholar storage-rescue workflow for localStorage quota errors, IndexedDB migration, PracticeRepository changes, Practice History restore/open failures, backup export/import, record-count mismatches, suspected data loss, and storage health panel issues. Use before any storage, backup, restore, migration, or data-preservation incident work.
---

# IELTS Storage Rescue

Use this skill for IELTS Scholar storage and data-preservation work. Storage incidents are safety-sensitive: preserve user data first, prove the current state from runtime/source evidence, and pause before any destructive or format-changing action.

Do not use this as an ordinary implementation shortcut. Storage tasks must begin in Scout Mode.

## Core Principle

Preserve user data first.

Never clear, release, migrate, overwrite, delete, or compact storage until backup/export state is confirmed and the user has approved the plan.

Runtime evidence, Debug Panel / storage-health output, browser console errors, and current source code override stale docs. Docs explain context; they do not prove the current browser storage state.

## When To Use

Use this skill when the task involves:

- `localStorage` quota errors or `QuotaExceededError`;
- IndexedDB migration, schema, inventory, or repair;
- `PracticeRepository` changes;
- Practice History restore/open failure;
- backup export/import;
- record-count mismatch;
- suspected data loss;
- storage health panel issues;
- failed or silent storage writes;
- release/cleanup of legacy storage;
- changes to active attempt, canonical practice record, or legacy session persistence.

## Required Scout Mode

Start read-only.

Before proposing edits:

1. Inspect the user's runtime evidence, screenshots, Debug Panel output, storage health report, import/export report, and console error if available.
2. Inspect current source and the narrow docs needed to understand the storage boundary.
3. State the risk level: `low`, `medium`, `high`, or `P0 data-preservation`.
4. State what is proven, what is not proven, and what must not be done yet.
5. Output a proposed implementation plan and validation plan.
6. Stop for user approval before implementation if the plan touches any hard-stop area.

If evidence is missing, ask for the smallest runtime evidence needed. Do not infer deletion from a missing UI row, stale migration summary, or one count mismatch.

## Source Map

Inspect only what is relevant to the current incident.

Primary source files:

- `src/lib/practiceRepository.ts` - IndexedDB-backed repository, canonical records, active states, legacy archive, metadata.
- `src/lib/storage/indexedDb.ts` - database open/upgrade, store access, transactions.
- `src/lib/practiceRecords.ts` - legacy localStorage compatibility, quota-safe writes, backup/import helpers.
- `src/pages/PracticeHistory.tsx` - History UI, storage health, restore/open, backup export/import.
- `src/context/AppContext.tsx` - app-level localStorage writes and quota protection.
- `src/lib/ai/usage.ts` - API usage persistence and quota-safe diagnostics.
- `src/components/ui/DebugPanel.tsx` - diagnostics that may confirm storage/provider/runtime state.

Context docs:

- `docs/P0_STORAGE_INDEXEDDB_INCIDENT_20260528_20260529.md` - incident history and safety boundary.
- `docs/CURRENT_STATE.md` - current product baseline.
- `docs/CODEBASE_MAP.md` - navigation and storage map.
- `docs/DECISION_LOG.md` - historical rationale only; do not treat as current truth.

## Hard Stop Rules

Stop and ask the user before:

- clearing `localStorage`;
- releasing legacy storage;
- deleting records or sessions;
- changing backup format;
- changing migration logic;
- changing import/export behavior;
- hiding, suppressing, or downgrading storage errors;
- treating record-count mismatch as deletion without proof;
- changing IndexedDB store names, keys, versions, or upgrade behavior;
- running any manual browser storage mutation;
- adding automatic cleanup, compaction, or dedupe of persisted personal records.

Do not run destructive browser-console snippets. Do not delete IndexedDB or localStorage data as a debugging step.

## Required Evidence Checklist

Capture or request the smallest available evidence for:

- current storage usage;
- relevant localStorage keys;
- IndexedDB inventory counts;
- canonical practice record count;
- legacy session/archive count;
- active state count;
- backup export status;
- restore/open failure details;
- console error if available;
- whether `/practice-history` can open;
- whether storage health/inventory renders;
- whether the issue affects read-only viewing, restore, saving, export, import, or active attempt recovery.

Known incident reference points from the 2026-05-28/29 P0 event:

- recovered canonical records: 134;
- recovered legacy archived sessions: 172;
- active states reported during import: 3;
- stale migration summaries are not authoritative after backup import;
- the exact path that caused old large localStorage keys to disappear was not proven from source evidence.

Use those numbers only as historical context unless the current runtime evidence confirms them again.

## Investigation Pattern

1. Start from runtime evidence and `git status`.
2. Use `docs/CODEBASE_MAP.md` to choose the smallest source path.
3. Inspect `PracticeHistory.tsx` and repository/storage helpers before making conclusions about counts or restore behavior.
4. Distinguish:
   - canonical practice records;
   - active attempt states;
   - legacy session archive;
   - migration summary / metadata;
   - visible History cards.
5. Treat missing visibility as a UI/query/import problem until storage inventory proves otherwise.
6. Prefer adding visibility, warnings, and safe read-only access before changing persistence behavior.
7. Keep Part 1 feedback, provider prompts, scoring, and storage architecture work separate unless the storage bug directly blocks the user flow.

## Validation Checklist

For source-code changes, run:

```bash
npm run lint
npm run build
```

Manual/runtime validation should cover the relevant subset:

- `/practice-history` opens;
- storage health/inventory renders;
- read-only result view works;
- backup export works;
- import/restore path is safe;
- no `QuotaExceededError` on restore/open;
- failed storage writes are visible, not silent;
- canonical record count matches the intended inventory;
- legacy archive count is visible where expected;
- active states remain recoverable where expected;
- no automatic legacy release/clear happened unless explicitly approved and verified.

If only this skill or other markdown workflow files changed, do not run npm. Say app verification was not required because no app source changed.

## Final Report

Always report:

- mode used;
- storage risk level;
- data-preservation status;
- files inspected;
- files changed;
- validation run;
- user verification steps;
- remaining risks / unverified assumptions.

Also state explicitly whether backup/export state was confirmed and whether any storage was cleared, released, migrated, deleted, or compacted.
