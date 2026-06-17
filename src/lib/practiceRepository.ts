import {
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
  ActiveSpeakingPracticeSession,
  getAllPracticeRecords,
  sanitizePracticeRecord,
  sanitizeActiveSpeakingSession,
  getActiveSpeakingSession as getLegacyActiveSpeaking,
  getActiveWritingTask1 as getLegacyActiveWritingTask1,
  getActiveWritingTask2 as getLegacyActiveWritingTask2,
  IELTS_LOCAL_STORAGE_KEYS,
  getStorageUsage,
  StorageUsageInfo,
} from '@/src/lib/practiceRecords';
import {
  getDatabase,
  storePut,
  storeGet,
  storeGetAll,
  storeDelete,
  storeClear,
  storeCount,
  deleteDatabase,
  STORE_NAMES,
  closeDatabase,
} from '@/src/lib/storage/indexedDb';
import {
  buildPracticeHistoryDedupePlan,
  type PracticeHistoryDedupePlan,
  type PracticeHistoryDedupeRunReport,
} from '@/src/lib/practiceHistoryDedupe';

// ──────────────────────────────────────
// Types
// ──────────────────────────────────────

export interface MigrationReport {
  status: 'not_started' | 'completed' | 'incomplete' | 'failed';
  safeToReleaseLegacyStorage: boolean;
  startedAt: string;
  completedAt?: string;
  canonicalSourceCount: number;
  canonicalCopiedCount: number;
  canonicalInvalidCount: number;
  legacySourceCount: number;
  legacyArchivedCount: number;
  activeStatesCopied: number;
  verifiedCanonicalCount: number;
  verifiedLegacyArchiveCount: number;
  errors: string[];
}

export interface LegacySessionSummary {
  archiveKey: string;
  module?: string;
  part?: number;
  date?: string;
  id?: string;
}

export interface StorageHealth {
  indexedDb: {
    practiceRecords: number;
    legacySessionsArchive: number;
    activeStates: number;
    estimatedBytes: number;
  };
  localStorage: {
    entries: StorageUsageInfo[];
    totalBytes: number;
    totalMB: string;
  };
}

export interface ExportBackupPayload {
  formatVersion: number;
  capturedAt: string;
  origin: string;
  indexedDb: {
    practiceRecords: any[];
    activeStates: any[];
    legacySessionsArchive: any[];
    meta: any[];
  };
  localStorage: Record<string, string | null>;
  sessionStorage: Record<string, string | null>;
}

export interface ImportPreview {
  backupType: string;
  formatVersion?: number;
  canonicalRecordsFound: number;
  existingCanonicalCollisions: number;
  legacySessionsFound: number;
  existingLegacyCollisions: number;
  activeStatesFound: number;
  existingActiveStates: string[];
  willOverwriteActiveStates: boolean;
}

export interface ImportReport {
  practiceRecordsImported: number;
  practiceRecordsSkipped: number;
  legacySessionsArchived: number;
  legacySessionsSkipped: number;
  legacySessionsVerifiedExisting: number;
  legacyExpectedKeysVerified: number;
  legacyExpectedKeysTotal: number;
  activeStatesImported: number;
  activeStatesSkipped: number;
  errors: string[];
}

export interface LegacyRecoveryImportMeta {
  key: 'legacyRecoveryImport';
  completedAt: string;
  backupType: string;
  legacySessionsFound: number;
  legacySessionsArchived: number;
  legacySessionsSkipped: number;
  legacySessionsVerifiedExisting: number;
  expectedArchiveKeysVerified: number;
  verifiedLegacyArchiveCountAfterImport: number;
  canonicalRecordsFound: number;
  canonicalRecordsSkipped: number;
  errors: string[];
}

export type ReleaseRefusalReason =
  | 'migration_not_safe'
  | 'canonical_invalid_records'
  | 'recovery_import_not_verified'
  | 'export_required_after_import'
  | 'indexeddb_count_mismatch'
  | 'storage_delete_failed';

export interface ReleaseResult {
  ok: boolean;
  releasedKeys?: string[];
  verifiedCanonicalCount?: number;
  verifiedLegacyArchiveCount?: number;
  reason?: ReleaseRefusalReason;
  message?: string;
}

// ──────────────────────────────────────
// Initialization state
// ──────────────────────────────────────

let repoReady = false;
let repoInitPromise: Promise<MigrationReport> | null = null;
let latestMigrationReport: MigrationReport | null = null;
let exportTriggeredThisSession = false;

export function isRepositoryReady(): boolean {
  return repoReady;
}

export function isMigrationSafe(): boolean {
  return repoReady && latestMigrationReport?.status === 'completed' && latestMigrationReport.safeToReleaseLegacyStorage === true;
}

export function getLatestMigrationReport(): MigrationReport | null {
  return latestMigrationReport;
}

export function markExportTriggered(): void {
  exportTriggeredThisSession = true;
}

export function wasExportTriggeredThisSession(): boolean {
  return exportTriggeredThisSession;
}

// ──────────────────────────────────────
// Initialization & Migration
// ──────────────────────────────────────

export async function initializePracticeRepository(): Promise<MigrationReport> {
  if (repoReady && latestMigrationReport) return latestMigrationReport;
  if (repoInitPromise) return repoInitPromise;

  repoInitPromise = (async () => {
    await getDatabase();
    const existingMeta = await storeGet(STORE_NAMES.meta, 'migrationReport');
    if (existingMeta?.status === 'completed' && existingMeta?.safeToReleaseLegacyStorage === true) {
      latestMigrationReport = existingMeta as MigrationReport;
      repoReady = true;
      return latestMigrationReport;
    }
    // If a previous incomplete/failed migration exists, re-run from scratch
    if (existingMeta) {
      try { await storeClear(STORE_NAMES.practiceRecords); } catch {}
      try { await storeClear(STORE_NAMES.legacySessionsArchive); } catch {}
      try { await storeDelete(STORE_NAMES.activeStates, 'speaking'); } catch {}
      try { await storeDelete(STORE_NAMES.activeStates, 'writing_task1'); } catch {}
      try { await storeDelete(STORE_NAMES.activeStates, 'writing_task2'); } catch {}
    }

    const report: MigrationReport = {
      status: 'incomplete',
      safeToReleaseLegacyStorage: false,
      startedAt: new Date().toISOString(),
      canonicalSourceCount: 0,
      canonicalCopiedCount: 0,
      canonicalInvalidCount: 0,
      legacySourceCount: 0,
      legacyArchivedCount: 0,
      activeStatesCopied: 0,
      verifiedCanonicalCount: 0,
      verifiedLegacyArchiveCount: 0,
      errors: [],
    };

    // Phase 1: Copy practice records from localStorage
    let canonicalRawEntries: unknown[] = [];
    try {
      const raw = localStorage.getItem('ielts_practice_records_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        canonicalRawEntries = Array.isArray(parsed) ? parsed : [];
        report.canonicalSourceCount = canonicalRawEntries.length;
        for (const rawRecord of canonicalRawEntries) {
          try {
            const sanitized = sanitizePracticeRecord(rawRecord);
            if (sanitized) {
              const sortTimestamp =
                sanitized.analyzedAt || sanitized.updatedAt || sanitized.createdAt || new Date().toISOString();
              await storePut(STORE_NAMES.practiceRecords, {
                ...sanitized,
                _provenance: 'migrated_practice_records_v1',
                sortTimestamp,
              });
              report.canonicalCopiedCount++;
            } else {
              report.canonicalInvalidCount++;
            }
          } catch (err) {
            report.errors.push(`Failed to migrate record: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      report.errors.push(`Failed to read ielts_practice_records_v1: ${err instanceof Error ? err.message : String(err)}`);
      report.status = 'failed';
    }

    // Phase 2: Copy legacy sessions into archive
    let legacyRawEntries: unknown[] = [];
    try {
      const raw = localStorage.getItem('ielts_sessions');
      if (raw) {
        const parsed = JSON.parse(raw);
        legacyRawEntries = Array.isArray(parsed) ? parsed : [];
        report.legacySourceCount = legacyRawEntries.length;
        for (let i = 0; i < legacyRawEntries.length; i++) {
          try {
            const session = legacyRawEntries[i];
            const sessionId = session && typeof session === 'object' ? (session as any).id || `legacy_${i}` : `legacy_${i}`;
            const sessionDate = (session && typeof session === 'object' ? (session as any).date || (session as any).createdAt || '' : '');
            const archiveKey = `legacy_session_${String(i).padStart(4, '0')}_${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`.slice(0, 200);
            const sortTimestamp = (session && typeof session === 'object' ? (session as any).date || (session as any).createdAt || (session as any).timestamp || new Date(0).toISOString() : new Date(0).toISOString());
            await storePut(STORE_NAMES.legacySessionsArchive, {
              archiveKey,
              source: 'ielts_sessions',
              originalIndex: i,
              rawPayload: session,
              module: session && typeof session === 'object' ? (session as any).module || 'unknown' : 'unknown',
              sortTimestamp,
            });
            report.legacyArchivedCount++;
          } catch (err) {
            report.errors.push(`Failed to archive session ${i}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      report.errors.push(`Failed to read ielts_sessions: ${err instanceof Error ? err.message : String(err)}`);
      report.status = 'failed';
    }

    // Phase 3: Copy active states
    try {
      const speakingActive = getLegacyActiveSpeaking();
      if (speakingActive) {
        const existingActive = await storeGet(STORE_NAMES.activeStates, 'speaking');
        if (!existingActive) {
          await storePut(STORE_NAMES.activeStates, {
            stateKey: 'speaking',
            data: speakingActive,
            updatedAt: new Date().toISOString(),
          });
          report.activeStatesCopied++;
        }
      }
    } catch (err) {
      report.errors.push(`Failed to migrate active speaking: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const wt1Active = getLegacyActiveWritingTask1();
      if (wt1Active) {
        const existingActive = await storeGet(STORE_NAMES.activeStates, 'writing_task1');
        if (!existingActive) {
          await storePut(STORE_NAMES.activeStates, {
            stateKey: 'writing_task1',
            data: wt1Active,
            updatedAt: new Date().toISOString(),
          });
          report.activeStatesCopied++;
        }
      }
    } catch (err) {
      report.errors.push(`Failed to migrate active writing_task1: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const wt2Active = getLegacyActiveWritingTask2();
      if (wt2Active) {
        const existingActive = await storeGet(STORE_NAMES.activeStates, 'writing_task2');
        if (!existingActive) {
          await storePut(STORE_NAMES.activeStates, {
            stateKey: 'writing_task2',
            data: wt2Active,
            updatedAt: new Date().toISOString(),
          });
          report.activeStatesCopied++;
        }
      }
    } catch (err) {
      report.errors.push(`Failed to migrate active writing_task2: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Phase 4: Verify counts
    try {
      report.verifiedCanonicalCount = await storeCount(STORE_NAMES.practiceRecords);
    } catch (err) {
      report.errors.push(`Could not verify canonical count: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      report.verifiedLegacyArchiveCount = await storeCount(STORE_NAMES.legacySessionsArchive);
    } catch (err) {
      report.errors.push(`Could not verify legacy archive count: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Determine final status
    const canonicalCountsMatch = report.verifiedCanonicalCount === report.canonicalCopiedCount;
    const legacyCountsMatch = report.verifiedLegacyArchiveCount === report.legacyArchivedCount;
    const canonicalFullyAccounted = (report.canonicalCopiedCount + report.canonicalInvalidCount) >= report.canonicalSourceCount;
    const legacyFullyAccounted = report.legacyArchivedCount >= report.legacySourceCount;

    if (
      report.errors.length === 0 &&
      canonicalCountsMatch &&
      legacyCountsMatch &&
      canonicalFullyAccounted &&
      legacyFullyAccounted
    ) {
      report.status = 'completed';
      report.safeToReleaseLegacyStorage = true;
      repoReady = true;
    } else {
      report.status = report.verifiedCanonicalCount === 0 && report.errors.length > 0 ? 'failed' : 'incomplete';
      report.safeToReleaseLegacyStorage = false;
      repoReady = false;
    }

    report.completedAt = new Date().toISOString();
    await storePut(STORE_NAMES.meta, { key: 'migrationReport', ...report });

    latestMigrationReport = report;
    return report;
  })();

  return repoInitPromise;
}

// ──────────────────────────────────────
// Practice Records
// ──────────────────────────────────────

export async function listPracticeRecords(
  filter?: { module?: string; status?: string },
): Promise<PracticeRecord[]> {
  await initializePracticeRepository();
  if (!repoReady) {
    console.warn('[ielts] Repository not ready — returning empty canonical list. Use localStorage fallback for History.');
    return [];
  }
  const all = await storeGetAll(STORE_NAMES.practiceRecords, 'byTimestamp');
  let records = all
    .map((r: unknown) => sanitizePracticeRecord(r))
    .filter((r): r is PracticeRecord => Boolean(r))
    .filter((r: any) => r.status !== 'draft')
    .sort((a: PracticeRecord, b: PracticeRecord) =>
      (b.analyzedAt || b.updatedAt || b.createdAt || '').localeCompare(a.analyzedAt || a.updatedAt || a.createdAt || ''),
    );
  if (filter?.module) {
    records = records.filter((r: PracticeRecord) => r.module === filter.module);
  }
  if (filter?.status) {
    records = records.filter((r: PracticeRecord) => r.status === filter.status);
  }
  return records;
}

export async function getPracticeRecord(id: string): Promise<PracticeRecord | null> {
  await initializePracticeRepository();
  const result = await storeGet(STORE_NAMES.practiceRecords, id);
  const sanitized = sanitizePracticeRecord(result);
  return sanitized && sanitized.status !== 'draft' ? sanitized : null;
}

export interface UpsertResult {
  ok: boolean;
  reason?: 'quota_exceeded' | 'storage_write_failed';
  message?: string;
}

export async function upsertPracticeRecord(record: PracticeRecord): Promise<UpsertResult> {
  if (record.status === 'draft') return { ok: true };
  try {
    await initializePracticeRepository();
    const existing = await storeGet(STORE_NAMES.practiceRecords, record.id);
    const sortTimestamp = record.analyzedAt || record.updatedAt || record.createdAt || new Date().toISOString();
    const nextRecord = {
      ...(existing || {}),
      ...record,
      _provenance: existing?._provenance || 'new_indexeddb',
      sortTimestamp,
      createdAt: record.createdAt || existing?.createdAt || new Date().toISOString(),
      updatedAt: record.updatedAt || existing?.updatedAt || new Date().toISOString(),
    };
    await storePut(STORE_NAMES.practiceRecords, nextRecord);
    return { ok: true };
  } catch (error) {
    console.error('[ielts] Failed to upsert practice record:', error);
    return {
      ok: false,
      reason: 'storage_write_failed',
      message: error instanceof Error ? error.message : 'Unknown IndexedDB write error',
    };
  }
}

export async function deletePracticeRecord(id: string, _module?: string): Promise<void> {
  await initializePracticeRepository();
  try {
    await storeDelete(STORE_NAMES.practiceRecords, id);
  } catch (err) {
    console.error('[ielts] Failed to delete practice record:', err);
  }
}

export async function previewPracticeHistoryDedupe(): Promise<PracticeHistoryDedupePlan> {
  const records = await listPracticeRecords();
  return buildPracticeHistoryDedupePlan(records);
}

export async function runPracticeHistoryDedupe(): Promise<PracticeHistoryDedupeRunReport> {
  const before = await previewPracticeHistoryDedupe();
  const candidates = before.groups.flatMap(group => group.remove);

  for (const candidate of candidates) {
    await deletePracticeRecord(candidate.id, candidate.module);
  }

  const afterRecords = await listPracticeRecords();
  const remainingIds = new Set(afterRecords.map(record => record.id));
  const failedIds = candidates
    .filter(candidate => remainingIds.has(candidate.id))
    .map(candidate => candidate.id);

  return {
    completedAt: new Date().toISOString(),
    before,
    after: buildPracticeHistoryDedupePlan(afterRecords),
    attemptedDeleteCount: candidates.length,
    deletedCount: candidates.length - failedIds.length,
    failedIds,
  };
}

export async function getAnalyzedPracticeRecords(): Promise<PracticeRecord[]> {
  await initializePracticeRepository();
  if (!repoReady) {
    console.warn('[ielts] Repository not ready — returning empty analyzed list.');
    return [];
  }
  const all = await storeGetAll(STORE_NAMES.practiceRecords, 'byStatus', IDBKeyRange.only('analyzed'));
  return all
    .map((r: unknown) => sanitizePracticeRecord(r))
    .filter((r): r is PracticeRecord => Boolean(r))
    .filter(r => r.status === 'analyzed');
}

// ──────────────────────────────────────
// Active States
// ──────────────────────────────────────

export async function getActiveSpeakingSession(): Promise<ActiveSpeakingPracticeSession | null> {
  await initializePracticeRepository();
  const entry = await storeGet(STORE_NAMES.activeStates, 'speaking');
  return sanitizeActiveSpeakingSession(entry?.data);
}

export async function saveActiveSpeakingSession(
  session: ActiveSpeakingPracticeSession,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await initializePracticeRepository();
    await storePut(STORE_NAMES.activeStates, {
      stateKey: 'speaking',
      data: session,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    console.error('[ielts] Failed to save active speaking session:', error);
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function clearActiveSpeakingSession(): Promise<void> {
  try {
    await initializePracticeRepository();
    await storeDelete(STORE_NAMES.activeStates, 'speaking');
  } catch (err) {
    console.error('[ielts] Failed to clear active speaking session:', err);
  }
}

export async function getActiveWritingTask1(): Promise<any | null> {
  await initializePracticeRepository();
  const entry = await storeGet(STORE_NAMES.activeStates, 'writing_task1');
  return entry?.data || null;
}

export async function saveActiveWritingTask1(record: any): Promise<{ ok: boolean; message?: string }> {
  try {
    await initializePracticeRepository();
    await storePut(STORE_NAMES.activeStates, {
      stateKey: 'writing_task1',
      data: record,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    console.error('[ielts] Failed to save active writing task 1:', error);
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteActiveWritingTask1(_id?: string): Promise<void> {
  try {
    await initializePracticeRepository();
    await storeDelete(STORE_NAMES.activeStates, 'writing_task1');
  } catch (err) {
    console.error('[ielts] Failed to delete active writing task 1:', err);
  }
}

export async function getActiveWritingTask2(): Promise<any | null> {
  await initializePracticeRepository();
  const entry = await storeGet(STORE_NAMES.activeStates, 'writing_task2');
  return entry?.data || null;
}

export async function saveActiveWritingTask2(record: any): Promise<{ ok: boolean; message?: string }> {
  try {
    await initializePracticeRepository();
    await storePut(STORE_NAMES.activeStates, {
      stateKey: 'writing_task2',
      data: record,
      updatedAt: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    console.error('[ielts] Failed to save active writing task 2:', error);
    return { ok: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deleteActiveWritingTask2(_id?: string): Promise<void> {
  try {
    await initializePracticeRepository();
    await storeDelete(STORE_NAMES.activeStates, 'writing_task2');
  } catch (err) {
    console.error('[ielts] Failed to delete active writing task 2:', err);
  }
}

// ──────────────────────────────────────
// Legacy Sessions Archive
// ──────────────────────────────────────

export async function getLegacySessionArchiveSummary(): Promise<{ count: number }> {
  try {
    await initializePracticeRepository();
    const count = await storeCount(STORE_NAMES.legacySessionsArchive);
    return { count };
  } catch {
    return { count: 0 };
  }
}

export async function listLegacySessions(
  offset = 0,
  limit = 50,
): Promise<{ items: LegacySessionSummary[]; total: number }> {
  await initializePracticeRepository();
  const all = await storeGetAll(STORE_NAMES.legacySessionsArchive, 'byTimestamp');
  const sorted = all.sort((a: any, b: any) => (b.sortTimestamp || '').localeCompare(a.sortTimestamp || ''));
  const total = sorted.length;
  const items = sorted.slice(offset, offset + limit).map((s: any) => ({
    archiveKey: s.archiveKey,
    module: s.rawPayload?.module,
    part: s.rawPayload?.part,
    date: s.rawPayload?.date || s.rawPayload?.createdAt,
    id: s.rawPayload?.id,
  }));
  return { items, total };
}

export async function getLegacySession(archiveKey: string): Promise<{ rawPayload: any; metadata: any } | null> {
  await initializePracticeRepository();
  const entry = await storeGet(STORE_NAMES.legacySessionsArchive, archiveKey);
  if (!entry) return null;
  return {
    rawPayload: entry.rawPayload || null,
    metadata: {
      archiveKey: entry.archiveKey,
      source: entry.source,
      originalIndex: entry.originalIndex,
      module: entry.module,
      sortTimestamp: entry.sortTimestamp,
    },
  };
}

// ──────────────────────────────────────
// Storage Health
// ──────────────────────────────────────

export async function getStorageHealth(): Promise<StorageHealth> {
  await initializePracticeRepository();
  const [practiceCount, legacyCount, activeCount] = await Promise.all([
    storeCount(STORE_NAMES.practiceRecords).catch(() => 0),
    storeCount(STORE_NAMES.legacySessionsArchive).catch(() => 0),
    storeCount(STORE_NAMES.activeStates).catch(() => 0),
  ]);

  let indexedDbBytes = 0;
  try {
    const allPractice = await storeGetAll(STORE_NAMES.practiceRecords);
    const allLegacy = await storeGetAll(STORE_NAMES.legacySessionsArchive);
    const allActive = await storeGetAll(STORE_NAMES.activeStates);
    indexedDbBytes = new Blob([
      JSON.stringify(allPractice),
      JSON.stringify(allLegacy),
      JSON.stringify(allActive),
    ]).size;
  } catch { /* ignore */ }

  return {
    indexedDb: {
      practiceRecords: practiceCount,
      legacySessionsArchive: legacyCount,
      activeStates: activeCount,
      estimatedBytes: indexedDbBytes,
    },
    localStorage: getStorageUsage(),
  };
}

// ──────────────────────────────────────
// Export / Import
// ──────────────────────────────────────

export async function exportCompleteLocalBackup(): Promise<ExportBackupPayload> {
  await initializePracticeRepository();
  const [practiceRecords, activeStates, legacySessionsArchive, metaEntries] = await Promise.all([
    storeGetAll(STORE_NAMES.practiceRecords).catch(() => []),
    storeGetAll(STORE_NAMES.activeStates).catch(() => []),
    storeGetAll(STORE_NAMES.legacySessionsArchive).catch(() => []),
    storeGetAll(STORE_NAMES.meta).catch(() => []),
  ]);

  const localData: Record<string, string | null> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) localData[key] = localStorage.getItem(key);
  }
  const sessionData: Record<string, string | null> = {};
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key) sessionData[key] = sessionStorage.getItem(key);
  }

  const payload: ExportBackupPayload = {
    formatVersion: 2,
    capturedAt: new Date().toISOString(),
    origin: typeof window !== 'undefined' ? window.location.origin : '',
    indexedDb: { practiceRecords, activeStates, legacySessionsArchive, meta: metaEntries },
    localStorage: localData,
    sessionStorage: sessionData,
  };

  markExportTriggered();
  return payload;
}

export function downloadBackupFile(payload: ExportBackupPayload): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ielts-scholar-full-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function isLegacyLocalStorageBackup(data: any): boolean {
  return data && typeof data === 'object' && data.localStorage && !data.indexedDb;
}

export function isFullIndexedDbBackup(data: any): data is ExportBackupPayload {
  return data && typeof data === 'object' && data.formatVersion === 2 && data.indexedDb;
}

function stableArchiveKey(prefix: string, index: number, session: any): string {
  const sessionId = (session && typeof session === 'object' ? (session as any).id || `s${index}` : `s${index}`);
  const sessionDate = (session && typeof session === 'object' ? (session as any).date || (session as any).createdAt || '' : '');
  return `${prefix}_${String(index).padStart(4, '0')}_${String(sessionId).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`.slice(0, 200);
}

export async function previewImportFromParsedJson(parsed: any): Promise<ImportPreview> {
  await initializePracticeRepository();
  const existingCanonicalIds = new Set<string>();
  const existingArchiveKeys = new Set<string>();
  const existingActiveKeys = new Set<string>();
  try {
    const records = await storeGetAll(STORE_NAMES.practiceRecords);
    records.forEach((r: any) => existingCanonicalIds.add(r.id));
  } catch {}
  try {
    const legacy = await storeGetAll(STORE_NAMES.legacySessionsArchive);
    legacy.forEach((s: any) => existingArchiveKeys.add(s.archiveKey));
  } catch {}
  try {
    const active = await storeGetAll(STORE_NAMES.activeStates);
    active.forEach((a: any) => existingActiveKeys.add(a.stateKey));
  } catch {}

  if (isLegacyLocalStorageBackup(parsed)) {
    let canonicalFound = 0;
    let canonicalCollisions = 0;
    let legacyFound = 0;
    let legacyCollisions = 0;
    try {
      const raw = parsed.localStorage?.['ielts_practice_records_v1'];
      const arr = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      if (Array.isArray(arr)) {
        for (const r of arr) {
          const sanitized = sanitizePracticeRecord(r);
          if (!sanitized) continue;
          canonicalFound++;
          if (existingCanonicalIds.has(sanitized.id)) canonicalCollisions++;
        }
      }
    } catch {}
    try {
      const raw = parsed.localStorage?.['ielts_sessions'];
      const arr = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          legacyFound++;
          const key = stableArchiveKey('import_legacy', i, arr[i]);
          if (existingArchiveKeys.has(key)) legacyCollisions++;
        }
      }
    } catch {}
    return {
      backupType: 'legacy_localstorage',
      canonicalRecordsFound: canonicalFound,
      existingCanonicalCollisions: canonicalCollisions,
      legacySessionsFound: legacyFound,
      existingLegacyCollisions: legacyCollisions,
      activeStatesFound: 0,
      existingActiveStates: [...existingActiveKeys],
      willOverwriteActiveStates: false,
    };
  }

  if (isFullIndexedDbBackup(parsed)) {
    const canonicalRecords = parsed.indexedDb.practiceRecords || [];
    const legacySessions = parsed.indexedDb.legacySessionsArchive || [];
    const activeStates = parsed.indexedDb.activeStates || [];
    let canonicalCollisions = 0;
    for (const r of canonicalRecords) {
      if (existingCanonicalIds.has(r.id)) canonicalCollisions++;
    }
    let legacyCollisions = 0;
    for (const s of legacySessions) {
      if (existingArchiveKeys.has(s.archiveKey)) legacyCollisions++;
    }
    const newActiveKeys = activeStates.map((a: any) => a.stateKey).filter(Boolean);
    const overwriteKeys = newActiveKeys.filter((k: string) => existingActiveKeys.has(k));
    return {
      backupType: 'full_indexeddb',
      formatVersion: parsed.formatVersion,
      canonicalRecordsFound: canonicalRecords.length,
      existingCanonicalCollisions: canonicalCollisions,
      legacySessionsFound: legacySessions.length,
      existingLegacyCollisions: legacyCollisions,
      activeStatesFound: activeStates.length,
      existingActiveStates: [...existingActiveKeys],
      willOverwriteActiveStates: overwriteKeys.length > 0,
    };
  }

  return {
    backupType: 'unknown',
    canonicalRecordsFound: 0,
    existingCanonicalCollisions: 0,
    legacySessionsFound: 0,
    existingLegacyCollisions: 0,
    activeStatesFound: 0,
    existingActiveStates: [...existingActiveKeys],
    willOverwriteActiveStates: false,
  };
}

export async function importFromParsedJson(
  parsed: any,
  options?: { overwriteActiveStates?: boolean },
): Promise<ImportReport> {
  await initializePracticeRepository();
  const report: ImportReport = {
    practiceRecordsImported: 0,
    practiceRecordsSkipped: 0,
    legacySessionsArchived: 0,
    legacySessionsSkipped: 0,
    legacySessionsVerifiedExisting: 0,
    legacyExpectedKeysVerified: 0,
    legacyExpectedKeysTotal: 0,
    activeStatesImported: 0,
    activeStatesSkipped: 0,
    errors: [],
  };

  const existingKeys = new Set<string>();
  try {
    const existingSessions = await storeGetAll(STORE_NAMES.legacySessionsArchive);
    existingSessions.forEach((s: any) => existingKeys.add(s.archiveKey));
  } catch { /* ignore */ }

  if (isLegacyLocalStorageBackup(parsed)) {
    try {
      const recordsRaw = parsed.localStorage?.['ielts_practice_records_v1'];
      if (recordsRaw) {
        const records = typeof recordsRaw === 'string' ? JSON.parse(recordsRaw) : recordsRaw;
        const arr = Array.isArray(records) ? records : [];
        for (const rawRecord of arr) {
          try {
            const sanitized = sanitizePracticeRecord(rawRecord);
            if (!sanitized) continue;
            const existing = await storeGet(STORE_NAMES.practiceRecords, sanitized.id);
            if (existing) { report.practiceRecordsSkipped++; continue; }
            const sortTimestamp = sanitized.analyzedAt || sanitized.updatedAt || sanitized.createdAt || new Date().toISOString();
            await storePut(STORE_NAMES.practiceRecords, { ...sanitized, _provenance: 'imported_v1_backup', sortTimestamp });
            report.practiceRecordsImported++;
          } catch (err) {
            report.errors.push(`Record import error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      report.errors.push(`Practice records import error: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const sessionsRaw = parsed.localStorage?.['ielts_sessions'];
      if (sessionsRaw) {
        const sessions = typeof sessionsRaw === 'string' ? JSON.parse(sessionsRaw) : sessionsRaw;
        const arr = Array.isArray(sessions) ? sessions : [];
        report.legacyExpectedKeysTotal = arr.length;
        const expectedKeys: string[] = [];
        for (let i = 0; i < arr.length; i++) {
          try {
            const session = arr[i];
            const archiveKey = stableArchiveKey('import_legacy', i, session);
            expectedKeys.push(archiveKey);
            if (existingKeys.has(archiveKey)) {
              report.legacySessionsSkipped++;
              report.legacySessionsVerifiedExisting++;
              continue;
            }
            existingKeys.add(archiveKey);
            const sortTimestamp = (session && typeof session === 'object' ? (session as any).date || (session as any).createdAt || '' : '') || new Date(0).toISOString();
            await storePut(STORE_NAMES.legacySessionsArchive, {
              archiveKey,
              source: 'imported_legacy_backup',
              originalIndex: i,
              rawPayload: session,
              module: session && typeof session === 'object' ? (session as any).module || 'unknown' : 'unknown',
              sortTimestamp,
            });
            report.legacySessionsArchived++;
          } catch (err) {
            report.errors.push(`Session import error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
        // Verify all expected keys are present in IndexedDB
        if (expectedKeys.length > 0) {
          try {
            let verifiedCount = 0;
            for (const key of expectedKeys) {
              const entry = await storeGet(STORE_NAMES.legacySessionsArchive, key);
              if (entry) verifiedCount++;
            }
            report.legacyExpectedKeysVerified = verifiedCount;
          } catch (err) {
            report.errors.push(`Key verification error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      report.errors.push(`Sessions import error: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (isFullIndexedDbBackup(parsed)) {
    try {
      for (const record of (parsed.indexedDb.practiceRecords || [])) {
        try {
          const existing = await storeGet(STORE_NAMES.practiceRecords, record.id);
          if (existing) { report.practiceRecordsSkipped++; continue; }
          await storePut(STORE_NAMES.practiceRecords, record);
          report.practiceRecordsImported++;
        } catch (err) {
          report.errors.push(`Record import error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      report.errors.push(`Practice records import error: ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
      const legacySessions = parsed.indexedDb.legacySessionsArchive || [];
      report.legacyExpectedKeysTotal = legacySessions.length;
      const expectedKeys: string[] = [];
      for (const session of legacySessions) {
        try {
          expectedKeys.push(session.archiveKey);
          if (existingKeys.has(session.archiveKey)) {
            report.legacySessionsSkipped++;
            report.legacySessionsVerifiedExisting++;
            continue;
          }
          await storePut(STORE_NAMES.legacySessionsArchive, session);
          existingKeys.add(session.archiveKey);
          report.legacySessionsArchived++;
        } catch (err) {
          report.errors.push(`Session import error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      // Verify all expected keys are present in IndexedDB
      if (expectedKeys.length > 0) {
        try {
          let verifiedCount = 0;
          for (const key of expectedKeys) {
            const entry = await storeGet(STORE_NAMES.legacySessionsArchive, key);
            if (entry) verifiedCount++;
          }
          report.legacyExpectedKeysVerified = verifiedCount;
        } catch (err) {
          report.errors.push(`Key verification error: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      report.errors.push(`Sessions import error: ${err instanceof Error ? err.message : String(err)}`);
    }
    if (options?.overwriteActiveStates) {
      try {
        for (const state of (parsed.indexedDb.activeStates || [])) {
          try {
            await storePut(STORE_NAMES.activeStates, state);
            report.activeStatesImported++;
          } catch (err) {
            report.errors.push(`Active state import error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        report.errors.push(`Active states import error: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      try {
        for (const state of (parsed.indexedDb.activeStates || [])) {
          try {
            const existing = await storeGet(STORE_NAMES.activeStates, state.stateKey);
            if (existing) { report.activeStatesSkipped++; continue; }
            await storePut(STORE_NAMES.activeStates, state);
            report.activeStatesImported++;
          } catch (err) {
            report.errors.push(`Active state import error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } catch (err) {
        report.errors.push(`Active states import error: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } else {
    report.errors.push('Unrecognized backup format.');
  }

  // Invalidate export gate after any successful import or verification
  const anyImportSucceeded =
    report.practiceRecordsImported > 0 ||
    report.legacySessionsArchived > 0 ||
    report.legacySessionsVerifiedExisting > 0 ||
    report.activeStatesImported > 0;
  if (anyImportSucceeded) {
    exportTriggeredThisSession = false;
  }

  // Persist recovery import metadata when legacy archive was populated OR verified
  const legacyWasActionable = report.legacySessionsArchived > 0 || report.legacySessionsVerifiedExisting > 0;
  const allExpectedKeysVerified = report.legacyExpectedKeysTotal > 0 &&
    report.legacyExpectedKeysVerified === report.legacyExpectedKeysTotal;
  const recoveryVerificationPassed = legacyWasActionable && allExpectedKeysVerified && report.errors.length === 0;

  if (recoveryVerificationPassed) {
    try {
      const currentArchiveCount = await storeCount(STORE_NAMES.legacySessionsArchive);
      const recoveryMeta: LegacyRecoveryImportMeta = {
        key: 'legacyRecoveryImport',
        completedAt: new Date().toISOString(),
        backupType: isLegacyLocalStorageBackup(parsed) ? 'legacy_localstorage' :
                     isFullIndexedDbBackup(parsed) ? 'full_indexeddb' : 'unknown',
        legacySessionsFound: report.legacySessionsArchived + report.legacySessionsSkipped + report.legacySessionsVerifiedExisting,
        legacySessionsArchived: report.legacySessionsArchived,
        legacySessionsSkipped: report.legacySessionsSkipped,
        legacySessionsVerifiedExisting: report.legacySessionsVerifiedExisting,
        expectedArchiveKeysVerified: report.legacyExpectedKeysVerified,
        verifiedLegacyArchiveCountAfterImport: currentArchiveCount,
        canonicalRecordsFound: report.practiceRecordsImported + report.practiceRecordsSkipped,
        canonicalRecordsSkipped: report.practiceRecordsSkipped,
        errors: report.errors.slice(),
      };
      await storePut(STORE_NAMES.meta, recoveryMeta);
    } catch (err) {
      console.error('[ielts] Failed to persist recovery import metadata:', err);
    }
  }

  return report;
}

// ──────────────────────────────────────
// Manual legacy localStorage release
// ──────────────────────────────────────

const LEGACY_BULK_KEYS = [
  'ielts_practice_records_v1',
  'ielts_sessions',
  'ielts_active_speaking_practice_v1',
  'ielts_active_writing_task1_practice_v1',
  'ielts_active_writing_task2_practice_v1',
];

export async function getLegacyRecoveryImportMeta(): Promise<LegacyRecoveryImportMeta | null> {
  try {
    const entry = await storeGet(STORE_NAMES.meta, 'legacyRecoveryImport');
    return entry?.completedAt ? (entry as LegacyRecoveryImportMeta) : null;
  } catch {
    return null;
  }
}

export function canReleaseLegacyStorage(): boolean {
  if (!latestMigrationReport) return false;
  if (latestMigrationReport.status !== 'completed') return false;
  if (!latestMigrationReport.safeToReleaseLegacyStorage) return false;
  if (latestMigrationReport.errors.length > 0) return false;
  if (latestMigrationReport.canonicalInvalidCount > 0) return false;
  if (!exportTriggeredThisSession) return false;
  if (latestMigrationReport.verifiedCanonicalCount !== latestMigrationReport.canonicalCopiedCount) return false;
  return true;
}

export async function releaseLegacyLocalStorage(): Promise<ReleaseResult> {
  if (!latestMigrationReport) {
    return { ok: false, reason: 'migration_not_safe', message: '迁移报告不存在。' };
  }
  if (latestMigrationReport.status !== 'completed' || !latestMigrationReport.safeToReleaseLegacyStorage) {
    return { ok: false, reason: 'migration_not_safe', message: '迁移未完成或未验证。' };
  }
  if (latestMigrationReport.errors.length > 0) {
    return { ok: false, reason: 'migration_not_safe', message: '迁移存在错误。' };
  }
  if (latestMigrationReport.canonicalInvalidCount > 0) {
    return { ok: false, reason: 'canonical_invalid_records', message: '存在未完整迁移的旧记录，不能释放旧版存储空间。' };
  }
  if (!exportTriggeredThisSession) {
    return { ok: false, reason: 'export_required_after_import', message: '已导入新数据。释放旧版存储前，请重新导出包含当前 IndexedDB 内容的完整备份。' };
  }

  // Live recount of IndexedDB canonical records
  let currentCanonicalCount = 0;
  try { currentCanonicalCount = await storeCount(STORE_NAMES.practiceRecords); } catch {}
  if (currentCanonicalCount < latestMigrationReport.verifiedCanonicalCount) {
    return { ok: false, reason: 'indexeddb_count_mismatch', message: 'IndexedDB 记录数量不匹配，释放被阻止。' };
  }

  // Legacy archive check: automatic migration path vs recovery import path
  const recoveryMeta = await getLegacyRecoveryImportMeta();
  let currentArchiveCount = 0;
  try { currentArchiveCount = await storeCount(STORE_NAMES.legacySessionsArchive); } catch {}

  const hasAutomaticLegacyArchive = latestMigrationReport.legacyArchivedCount > 0;
  const hasRecoveryVerification = recoveryMeta !== null &&
    (recoveryMeta.legacySessionsArchived > 0 || recoveryMeta.legacySessionsVerifiedExisting > 0) &&
    recoveryMeta.errors.length === 0 &&
    recoveryMeta.expectedArchiveKeysVerified === recoveryMeta.legacySessionsFound;

  if (hasAutomaticLegacyArchive) {
    // Path A: automatic migration archived legacy sessions
    if (currentArchiveCount < latestMigrationReport.verifiedLegacyArchiveCount) {
      return { ok: false, reason: 'indexeddb_count_mismatch', message: '旧版存档数量不匹配，释放被阻止。' };
    }
  } else if (hasRecoveryVerification) {
    // Path B: legacy sessions verified through recovery import
    if (currentArchiveCount < recoveryMeta.verifiedLegacyArchiveCountAfterImport) {
      return { ok: false, reason: 'indexeddb_count_mismatch', message: '恢复导入后存档数量不匹配，释放被阻止。' };
    }
    if (!exportTriggeredThisSession) {
      return { ok: false, reason: 'export_required_after_import', message: '已导入/核验恢复数据。释放旧版存储前，请重新导出包含当前 IndexedDB 内容的完整备份。' };
    }
  } else if (currentArchiveCount > 0) {
    // Unverified existing archive: block release
    return {
      ok: false,
      reason: 'recovery_import_not_verified',
      message: '检测到已恢复的旧版会话，但尚未完成备份核验。请重新导入原始备份进行核验，并重新导出完整备份后再释放旧版存储空间。',
    };
  }
  // else: currentArchiveCount === 0 — genuine no-archive, safe to release canonical-only

  // All checks passed: release
  const released: string[] = [];
  for (const key of LEGACY_BULK_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        localStorage.removeItem(key);
        released.push(key);
      }
    } catch {
      return { ok: false, reason: 'storage_delete_failed', message: `删除 ${key} 失败。` };
    }
  }
  return {
    ok: true,
    releasedKeys: released,
    verifiedCanonicalCount: currentCanonicalCount,
    verifiedLegacyArchiveCount: currentArchiveCount,
  };
}

export function getReleasedKeysList(): string[] {
  return [...LEGACY_BULK_KEYS];
}

// ──────────────────────────────────────
// Full data reset
// ──────────────────────────────────────

export async function clearAllPersonalDataExplicitly(): Promise<void> {
  await initializePracticeRepository();
  await Promise.all([
    storeClear(STORE_NAMES.practiceRecords).catch(() => {}),
    storeClear(STORE_NAMES.activeStates).catch(() => {}),
    storeClear(STORE_NAMES.legacySessionsArchive).catch(() => {}),
    storeClear(STORE_NAMES.meta).catch(() => {}),
  ]);
  for (const key of IELTS_LOCAL_STORAGE_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
  latestMigrationReport = null;
  repoReady = false;
}
