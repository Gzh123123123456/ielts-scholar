import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  History,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { getStorageUsage } from '@/src/lib/practiceRecords';
import {
  canReleaseLegacyStorage,
  downloadBackupFile,
  exportCompleteLocalBackup,
  getLegacyRecoveryImportMeta,
  getReleasedKeysList,
  getStorageHealth,
  importFromParsedJson,
  initializePracticeRepository,
  isRepositoryReady,
  listPracticeRecords,
  previewImportFromParsedJson,
  previewPracticeHistoryDedupe,
  releaseLegacyLocalStorage,
  runPracticeHistoryDedupe,
  type ImportPreview,
  type ImportReport,
  type LegacyRecoveryImportMeta,
  type MigrationReport,
  type StorageHealth,
} from '@/src/lib/practiceRepository';
import type {
  PracticeHistoryDedupePlan,
  PracticeHistoryDedupeRunReport,
} from '@/src/lib/practiceHistoryDedupe';
import { buildFeedbackHistoryReplayReport } from '@/src/lib/feedbackHistoryReplay';

type StorageUsageSnapshot = ReturnType<typeof getStorageUsage>;

const statusLabel = (status?: MigrationReport['status']) => {
  if (status === 'completed') return 'completed';
  if (status === 'incomplete') return 'incomplete';
  if (status === 'failed') return 'failed';
  return 'not started';
};

const statusTone = (status?: MigrationReport['status']) => {
  if (status === 'completed') return 'text-green-800';
  if (status === 'incomplete') return 'text-amber-800';
  if (status === 'failed') return 'text-red-800';
  return 'text-paper-ink/50';
};

export const HistoryPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingReplay, setIsExportingReplay] = useState(false);
  const [storageUsage, setStorageUsage] = useState<StorageUsageSnapshot | null>(null);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [recoveryMeta, setRecoveryMeta] = useState<LegacyRecoveryImportMeta | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportData, setPendingImportData] = useState<unknown>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [dedupePlan, setDedupePlan] = useState<PracticeHistoryDedupePlan | null>(null);
  const [dedupeReport, setDedupeReport] = useState<PracticeHistoryDedupeRunReport | null>(null);
  const [isPreviewingDedupe, setIsPreviewingDedupe] = useState(false);
  const [isRunningDedupe, setIsRunningDedupe] = useState(false);
  const [dedupeBackupConfirmed, setDedupeBackupConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const refreshMaintenance = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const report = await initializePracticeRepository();
      setMigrationReport(report);
      setStorageUsage(getStorageUsage());

      if (report.status === 'completed' && isRepositoryReady()) {
        const [health, recovery] = await Promise.all([
          getStorageHealth(),
          getLegacyRecoveryImportMeta(),
        ]);
        setStorageHealth(health);
        setRecoveryMeta(recovery);
      } else {
        setStorageHealth(null);
        setRecoveryMeta(null);
      }
    } catch (refreshError) {
      setStorageUsage(getStorageUsage());
      setError(refreshError instanceof Error ? refreshError.message : 'Storage status failed to load.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshMaintenance();
  }, [isOpen]);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    try {
      const payload = await exportCompleteLocalBackup();
      downloadBackupFile(payload);
      await refreshMaintenance();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Backup export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportFeedbackReplay = async () => {
    setIsExportingReplay(true);
    setError(null);
    try {
      const records = await listPracticeRecords();
      const report = buildFeedbackHistoryReplayReport(records, {
        limit: 24,
        modules: ['speaking'],
        speakingParts: [1, 2, 3],
        includePackets: true,
        includeTeacherJudgePrompts: false,
      });
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ielts-scholar-feedback-history-replay-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (replayError) {
      setError(replayError instanceof Error ? replayError.message : 'Feedback replay export failed.');
    } finally {
      setIsExportingReplay(false);
    }
  };

  const handleImport = () => {
    setError(null);
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async event => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const preview = await previewImportFromParsedJson(parsed);
        setImportPreview(preview);
        setPendingImportData(parsed);
        setImportReport(null);
      } catch {
        setError('Import failed: the backup file is not valid JSON or is not an IELTS Scholar backup.');
      }
    };
    input.click();
  };

  const confirmImport = async (overwriteActiveStates: boolean) => {
    if (!pendingImportData) return;
    setError(null);
    try {
      const report = await importFromParsedJson(pendingImportData, { overwriteActiveStates });
      setImportReport(report);
      setImportPreview(null);
      setPendingImportData(null);
      await refreshMaintenance();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Backup import failed.');
    }
  };

  const cancelImport = () => {
    setImportPreview(null);
    setPendingImportData(null);
  };

  const handlePreviewDedupe = async () => {
    setIsPreviewingDedupe(true);
    setError(null);
    try {
      const plan = await previewPracticeHistoryDedupe();
      setDedupePlan(plan);
      setDedupeReport(null);
    } catch (dedupeError) {
      setError(dedupeError instanceof Error ? dedupeError.message : 'History cleanup preview failed.');
    } finally {
      setIsPreviewingDedupe(false);
    }
  };

  const handleRunDedupe = async () => {
    if (!dedupePlan || dedupePlan.deleteCount === 0) return;
    if (!dedupeBackupConfirmed) {
      setError('Export a complete backup first, then confirm it here before deleting duplicate history.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${dedupePlan.deleteCount} older analyzed duplicate records?\n\nThis keeps the newest record in each duplicate topic group and does not touch drafts, failed records, active states, or legacy archive.`,
    );
    if (!confirmed) return;

    setIsRunningDedupe(true);
    setError(null);
    try {
      const report = await runPracticeHistoryDedupe();
      setDedupeReport(report);
      setDedupePlan(report.after);
      await refreshMaintenance();
    } catch (dedupeError) {
      setError(dedupeError instanceof Error ? dedupeError.message : 'History cleanup failed.');
    } finally {
      setIsRunningDedupe(false);
    }
  };

  const handleReleaseStorage = async () => {
    setError(null);
    if (!canReleaseLegacyStorage()) {
      setError('Release is locked until migration is verified and a fresh complete backup has been exported in this session.');
      return;
    }

    const releasedKeys = getReleasedKeysList();
    const confirmed = window.confirm(
      `Release legacy localStorage data?\n\nThis clears only old localStorage keys:\n${releasedKeys.join('\n')}\n\nIndexedDB records and archives will stay in place.`,
    );
    if (!confirmed) return;

    const result = await releaseLegacyLocalStorage();
    if (!result.ok) {
      setError(result.message || 'Legacy storage release was blocked.');
      return;
    }
    await refreshMaintenance();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(value => !value)}
        className={`fixed bottom-4 left-20 p-2 rounded-full transition-colors z-[60] notranslate ${
          isOpen
            ? 'bg-accent-terracotta/10 text-accent-terracotta'
            : 'bg-paper-ink/5 hover:bg-paper-ink/10 text-paper-ink/30'
        }`}
        translate="no"
        title={isOpen ? 'Close Storage & Backup' : 'Open Storage & Backup'}
      >
        <History className="w-3 h-3" />
      </button>

      {isOpen && (
        <div className="fixed inset-y-0 left-0 w-[22rem] max-w-[calc(100vw-1rem)] bg-paper-50 border-r border-paper-ink/20 shadow-2xl z-40 flex flex-col font-sans text-xs notranslate" translate="no">
          <div className="p-3 border-b border-paper-ink/10 flex justify-between items-center bg-paper-200">
            <div>
              <h3 className="font-bold uppercase tracking-widest text-accent-terracotta">Storage & Backup</h3>
              <p className="mt-1 text-[10px] text-paper-ink/45">
                {isLoading ? 'Checking local data...' : 'Local-first maintenance'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={refreshMaintenance}
                className="p-1 text-paper-ink/45 hover:text-accent-terracotta"
                title="Refresh storage status"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 hover:text-accent-terracotta"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 pb-16 space-y-5">
            <section>
              <h4 className="font-bold uppercase tracking-widest text-paper-ink/45 mb-2">Actions</h4>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="flex items-center justify-center gap-1 rounded border border-accent-terracotta/35 bg-paper-50 px-2 py-2 text-[11px] text-accent-terracotta hover:bg-accent-terracotta/10 disabled:opacity-50"
                >
                  <Download className="w-3 h-3" />
                  {isExporting ? 'Exporting' : 'Export Backup'}
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  className="flex items-center justify-center gap-1 rounded border border-paper-ink/15 bg-paper-50 px-2 py-2 text-[11px] text-paper-ink/65 hover:border-accent-terracotta/40 hover:text-accent-terracotta"
                >
                  <Upload className="w-3 h-3" />
                  Import Backup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    if (location.pathname !== '/practice-history') navigate('/practice-history');
                  }}
                  className="col-span-2 flex items-center justify-center gap-1 rounded border border-paper-ink/15 bg-paper-50 px-2 py-2 text-[11px] text-paper-ink/65 hover:border-accent-terracotta/40 hover:text-accent-terracotta"
                >
                  <Archive className="w-3 h-3" />
                  View Practice History
                </button>
                <button
                  type="button"
                  onClick={handleExportFeedbackReplay}
                  disabled={isExportingReplay}
                  className="col-span-2 flex items-center justify-center gap-1 rounded border border-paper-ink/15 bg-paper-50 px-2 py-2 text-[11px] text-paper-ink/65 hover:border-accent-terracotta/40 hover:text-accent-terracotta disabled:opacity-50"
                >
                  <History className="w-3 h-3" />
                  {isExportingReplay ? 'Exporting Replay' : 'Export Feedback Replay'}
                </button>
                {canReleaseLegacyStorage() && (
                  <button
                    type="button"
                    onClick={handleReleaseStorage}
                    className="col-span-2 flex items-center justify-center gap-1 rounded border border-amber-600/30 bg-amber-50/50 px-2 py-2 text-[11px] text-amber-800 hover:bg-amber-50"
                  >
                    <Trash2 className="w-3 h-3" />
                    Release Legacy Storage
                  </button>
                )}
              </div>
            </section>

            {error && (
              <section className="border-t border-paper-ink/10 pt-3">
                <div className="flex gap-2 text-red-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <p className="leading-5">{error}</p>
                </div>
              </section>
            )}

            <section className="border-t border-paper-ink/10 pt-3 space-y-3">
              <h4 className="font-bold uppercase tracking-widest text-paper-ink/45">History Cleanup</h4>
              <p className="text-[11px] leading-5 text-paper-ink/55">
                Keeps the latest analyzed record for each matching module, part, and topic key.
              </p>
              <button
                type="button"
                onClick={handlePreviewDedupe}
                disabled={isPreviewingDedupe || isRunningDedupe}
                className="w-full rounded border border-paper-ink/15 bg-paper-50 px-2 py-2 text-[11px] text-paper-ink/65 hover:border-accent-terracotta/40 hover:text-accent-terracotta disabled:opacity-50"
              >
                {isPreviewingDedupe ? 'Checking duplicates' : 'Preview Duplicate Topics'}
              </button>

              {dedupePlan && (
                <div className="space-y-3 rounded border border-paper-ink/10 bg-paper-100/50 p-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-mono text-sm text-paper-ink">{dedupePlan.eligibleRecords}</p>
                      <p className="text-[10px] uppercase tracking-widest text-paper-ink/40">Analyzed</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm text-paper-ink">{dedupePlan.duplicateGroupCount}</p>
                      <p className="text-[10px] uppercase tracking-widest text-paper-ink/40">Groups</p>
                    </div>
                    <div>
                      <p className="font-mono text-sm text-accent-terracotta">{dedupePlan.deleteCount}</p>
                      <p className="text-[10px] uppercase tracking-widest text-paper-ink/40">Delete</p>
                    </div>
                  </div>

                  {dedupePlan.groups.length > 0 ? (
                    <div className="space-y-2">
                      {dedupePlan.groups.slice(0, 4).map(group => (
                        <div key={group.key} className="rounded border border-paper-ink/10 bg-paper-50 px-2 py-2">
                          <p className="truncate font-bold text-paper-ink/75" title={group.label}>{group.label}</p>
                          <p className="mt-1 text-[11px] text-paper-ink/50">
                            Keep 1 latest, delete {group.remove.length} older {group.remove.length === 1 ? 'record' : 'records'}
                          </p>
                        </div>
                      ))}
                      {dedupePlan.groups.length > 4 && (
                        <p className="text-[11px] text-paper-ink/45">+ {dedupePlan.groups.length - 4} more duplicate groups</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11px] text-green-800">No analyzed duplicate topic groups found.</p>
                  )}

                  <label className="flex items-start gap-2 text-[11px] leading-5 text-paper-ink/65">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={dedupeBackupConfirmed}
                      onChange={event => setDedupeBackupConfirmed(event.target.checked)}
                    />
                    <span>I exported a complete backup from this browser.</span>
                  </label>

                  <button
                    type="button"
                    onClick={handleRunDedupe}
                    disabled={
                      isRunningDedupe ||
                      !dedupeBackupConfirmed ||
                      dedupePlan.deleteCount === 0
                    }
                    className="w-full rounded border border-red-700/25 px-2 py-2 text-[11px] text-red-800 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isRunningDedupe ? 'Deleting duplicates' : 'Delete Older Duplicate Records'}
                  </button>
                </div>
              )}

              {dedupeReport && (
                <div className="rounded border border-green-700/15 bg-green-50/40 px-3 py-2 text-[11px] leading-5 text-green-900">
                  Deleted {dedupeReport.deletedCount} of {dedupeReport.attemptedDeleteCount} selected records.
                  {dedupeReport.failedIds.length > 0 && (
                    <span className="text-red-800"> {dedupeReport.failedIds.length} records still remain.</span>
                  )}
                </div>
              )}
            </section>

            {importPreview && (
              <section className="border-t border-paper-ink/10 pt-3 space-y-3">
                <h4 className="font-bold uppercase tracking-widest text-paper-ink/45">Import Preview</h4>
                <div className="space-y-1 text-paper-ink/65 leading-5">
                  <p>Backup: {importPreview.backupType}{importPreview.formatVersion ? ` v${importPreview.formatVersion}` : ''}</p>
                  <p>Records: {importPreview.canonicalRecordsFound} found, {importPreview.existingCanonicalCollisions} duplicate IDs skipped</p>
                  <p>Legacy sessions: {importPreview.legacySessionsFound} found, {importPreview.existingLegacyCollisions} duplicates skipped</p>
                  <p>Active states: {importPreview.activeStatesFound}</p>
                  {importPreview.willOverwriteActiveStates && (
                    <p className="text-amber-800">Overwrite available for existing active states: {importPreview.existingActiveStates.join(', ') || 'none'}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => confirmImport(false)}
                    className="w-full rounded border border-green-700/25 px-2 py-2 text-[11px] text-green-800 hover:bg-green-50"
                  >
                    Confirm Import, Keep Active States
                  </button>
                  {importPreview.willOverwriteActiveStates && (
                    <button
                      type="button"
                      onClick={() => confirmImport(true)}
                      className="w-full rounded border border-amber-700/25 px-2 py-2 text-[11px] text-amber-800 hover:bg-amber-50"
                    >
                      Confirm Import, Overwrite Active States
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={cancelImport}
                    className="w-full rounded border border-paper-ink/15 px-2 py-2 text-[11px] text-paper-ink/55 hover:text-paper-ink"
                  >
                    Cancel Import
                  </button>
                </div>
              </section>
            )}

            {importReport && (
              <section className="border-t border-paper-ink/10 pt-3">
                <h4 className="font-bold uppercase tracking-widest text-paper-ink/45 mb-2">Import Result</h4>
                <div className="space-y-1 text-paper-ink/65 leading-5">
                  <p>Records imported: {importReport.practiceRecordsImported}; skipped: {importReport.practiceRecordsSkipped}</p>
                  <p>Legacy archived: {importReport.legacySessionsArchived}; skipped: {importReport.legacySessionsSkipped}</p>
                  <p>Active states imported: {importReport.activeStatesImported}; skipped: {importReport.activeStatesSkipped}</p>
                  {importReport.errors.length > 0 && <p className="text-red-800">Errors: {importReport.errors.length}</p>}
                </div>
              </section>
            )}

            <section className="border-t border-paper-ink/10 pt-3">
              <h4 className="font-bold uppercase tracking-widest text-paper-ink/45 mb-2">Storage</h4>
              <div className="space-y-1.5 text-paper-ink/65 leading-5">
                <div className="flex justify-between gap-4">
                  <span>localStorage</span>
                  <span className="font-mono text-paper-ink">{storageUsage?.totalMB ?? storageHealth?.localStorage.totalMB ?? '...'} MB</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Practice records</span>
                  <span className="font-mono text-paper-ink">{storageHealth?.indexedDb.practiceRecords ?? migrationReport?.verifiedCanonicalCount ?? '...'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Legacy archive</span>
                  <span className="font-mono text-paper-ink">{storageHealth?.indexedDb.legacySessionsArchive ?? migrationReport?.verifiedLegacyArchiveCount ?? '...'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Active states</span>
                  <span className="font-mono text-paper-ink">{storageHealth?.indexedDb.activeStates ?? migrationReport?.activeStatesCopied ?? '...'}</span>
                </div>
                {storageHealth && storageHealth.indexedDb.estimatedBytes > 0 && (
                  <div className="flex justify-between gap-4">
                    <span>IndexedDB estimate</span>
                    <span className="font-mono text-paper-ink">{(storageHealth.indexedDb.estimatedBytes / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                )}
              </div>
              {storageUsage?.isNearQuota && (
                <p className="mt-2 flex gap-2 text-amber-800 leading-5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  localStorage is near the browser quota. Export a backup before restoring or saving more work.
                </p>
              )}
              {storageUsage && storageUsage.entries.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-paper-ink/45 hover:text-paper-ink/65">Top localStorage keys</summary>
                  <div className="mt-2 space-y-1">
                    {storageUsage.entries.slice(0, 6).map(entry => (
                      <div key={entry.key} className="flex justify-between gap-3 rounded border border-paper-ink/10 px-2 py-1 text-[11px]">
                        <span className="truncate" title={entry.key}>{entry.key}</span>
                        <span className="font-mono">{entry.sizeMB} MB</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </section>

            <section className="border-t border-paper-ink/10 pt-3">
              <h4 className="font-bold uppercase tracking-widest text-paper-ink/45 mb-2">Migration</h4>
              <div className="space-y-1.5 text-paper-ink/65 leading-5">
                <div className="flex justify-between gap-4">
                  <span>Status</span>
                  <span className={`font-bold ${statusTone(migrationReport?.status)}`}>{statusLabel(migrationReport?.status)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Copied records</span>
                  <span className="font-mono text-paper-ink">{migrationReport ? `${migrationReport.canonicalCopiedCount}/${migrationReport.canonicalSourceCount}` : '...'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Archived legacy</span>
                  <span className="font-mono text-paper-ink">{migrationReport ? `${migrationReport.legacyArchivedCount}/${migrationReport.legacySourceCount}` : '...'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Validation</span>
                  <span className="font-mono text-paper-ink">{migrationReport ? `${migrationReport.verifiedCanonicalCount} records / ${migrationReport.verifiedLegacyArchiveCount} legacy` : '...'}</span>
                </div>
              </div>
              {migrationReport?.canonicalInvalidCount ? (
                <p className="mt-2 flex gap-2 text-amber-800 leading-5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  {migrationReport.canonicalInvalidCount} old records were not fully migrated, so legacy storage release stays locked.
                </p>
              ) : migrationReport?.safeToReleaseLegacyStorage ? (
                <p className="mt-2 flex gap-2 text-green-800 leading-5">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  Migration safety checks are satisfied. Export a fresh backup before releasing old storage.
                </p>
              ) : null}
            </section>

            {recoveryMeta && recoveryMeta.legacySessionsArchived > 0 && (
              <section className="border-t border-paper-ink/10 pt-3">
                <h4 className="font-bold uppercase tracking-widest text-paper-ink/45 mb-2">Recovery Import</h4>
                <div className="space-y-1 text-paper-ink/65 leading-5">
                  <p>Archived legacy sessions: {recoveryMeta.legacySessionsArchived} of {recoveryMeta.legacySessionsFound}</p>
                  <p>Verified archive count: {recoveryMeta.verifiedLegacyArchiveCountAfterImport}</p>
                  <p className="text-amber-800">Export a complete backup after recovery before releasing old storage.</p>
                  {recoveryMeta.errors.length > 0 && <p className="text-red-800">Recovery errors: {recoveryMeta.errors.length}</p>}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
};
