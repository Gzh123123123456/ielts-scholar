import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import {
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
  PracticeRecord,
} from '@/src/lib/practiceRecords';
import {
  initializePracticeRepository,
  listPracticeRecords,
  getPracticeRecord,
  upsertPracticeRecord,
  deletePracticeRecord,
  saveActiveSpeakingSession,
  saveActiveWritingTask1,
  saveActiveWritingTask2,
  deleteActiveWritingTask1,
  deleteActiveWritingTask2,
  getActiveSpeakingSession,
  getActiveWritingTask1,
  getActiveWritingTask2,
  getStorageHealth,
  getLatestMigrationReport,
  exportCompleteLocalBackup,
  downloadBackupFile,
  importFromParsedJson,
  previewImportFromParsedJson,
  listLegacySessions,
  getLegacySession,
  canReleaseLegacyStorage,
  releaseLegacyLocalStorage,
  getReleasedKeysList,
  getLegacyRecoveryImportMeta,
  isRepositoryReady,
  isMigrationSafe,
  UpsertResult,
  ImportPreview,
  StorageHealth,
} from '@/src/lib/practiceRepository';
import { getStorageUsage, exportBrowserStorageBackup } from '@/src/lib/practiceRecords';
import { ArrowRight, History, AlertTriangle, Download, Eye, Archive, Upload, Trash2 } from 'lucide-react';

const getTimestamp = (record: SpeakingPracticeRecord | WritingTask2PracticeRecord | WritingTask1PracticeRecord) =>
  record.analyzedAt || record.updatedAt || record.createdAt;

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const preview = (value: string | undefined, fallback = 'No preview available.') => {
  const normalized = (value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return fallback;
  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
};

const getWritingPreview = (record: WritingTask2PracticeRecord) =>
  preview(record.essay || record.finalFrameworkSummary || record.frameworkInput || record.frameworkChat.find(item => item.role === 'user')?.text);

const getWritingTask1Preview = (record: WritingTask1PracticeRecord) =>
  preview(record.report || record.quickPlan?.overview || record.quickPlan?.keyFeatures);

const speakingHistoryTitle = (record: SpeakingPracticeRecord) =>
  record.sessionKind === 'part1_topic_thread'
    ? record.topic || record.feedback?.topic || 'Part 1 Topic Thread'
    : preview(record.question, 'Saved Speaking question');

const speakingHistoryMeta = (record: SpeakingPracticeRecord) =>
  record.sessionKind === 'part1_topic_thread'
    ? `PART 1 · TOPIC THREAD · ${record.status}${record.threadAnswers?.length ? ` · ${record.threadAnswers.length} questions completed` : ''}`
    : `Part ${record.part} / ${record.status}`;

const speakingHistoryPreview = (record: SpeakingPracticeRecord) =>
  record.sessionKind === 'part1_topic_thread'
    ? preview(record.threadAnswers?.map((answer, index) => `Q${index + 1}: ${answer.transcript}`).join(' ') || record.transcript, 'No transcript saved yet.')
    : preview(record.transcript, 'No transcript saved yet.');

const STORAGE_FULL_MESSAGE = '本地存储空间已满，暂时无法恢复练习。你的历史记录仍保留在本机，请先导出备份或使用"只读查看"打开结果。';

export default function PracticeHistory() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<PracticeRecord[]>([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [readOnlyRecord, setReadOnlyRecord] = useState<PracticeRecord | null>(null);
  const [storageUsage, setStorageUsage] = useState(() => {
    try { return getStorageUsage(); } catch { return null; }
  });
  const [migrationReport, setMigrationReport] = useState<any>(null);
  const [legacySessions, setLegacySessions] = useState<any[]>([]);
  const [legacyTotal, setLegacyTotal] = useState(0);
  const [legacyOffset, setLegacyOffset] = useState(0);
  const [showLegacyArchive, setShowLegacyArchive] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [pendingImportData, setPendingImportData] = useState<any>(null);
  const [recoveryMeta, setRecoveryMeta] = useState<any>(null);
  const [repoReady, setRepoReady] = useState(false);
  const [useP0Fallback, setUseP0Fallback] = useState(false);
  const [storageHealth, setStorageHealth] = useState<StorageHealth | null>(null);
  const LEGACY_PAGE_SIZE = 50;

  const loadLegacyPage = async (offset: number) => {
    const result = await listLegacySessions(offset, LEGACY_PAGE_SIZE);
    setLegacySessions(prev => {
      if (offset === 0) return result.items;
      const existingKeys = new Set(prev.map(s => s.archiveKey));
      const newItems = result.items.filter(s => !existingKeys.has(s.archiveKey));
      return [...prev, ...newItems];
    });
    setLegacyTotal(result.total);
    setLegacyOffset(offset);
  };

  useEffect(() => {
    (async () => {
      try {
        const report = await initializePracticeRepository();
        setMigrationReport(report);
        const completed = report.status === 'completed' && isRepositoryReady();
        if (completed) {
          const meta = await getLegacyRecoveryImportMeta();
          setRecoveryMeta(meta);
        }
        setRepoReady(completed);
        if (completed) {
          const allRecords = await listPracticeRecords();
          setRecords(allRecords);
          const legacy = await listLegacySessions(0, LEGACY_PAGE_SIZE);
          setLegacySessions(legacy.items);
          setLegacyTotal(legacy.total);
          try {
            const health = await getStorageHealth();
            setStorageHealth(health);
          } catch { /* storage health is non-critical */ }
        } else {
          // P0 fallback: read from localStorage directly
          setUseP0Fallback(true);
          const { getAllPracticeRecords } = await import('@/src/lib/practiceRecords');
          const fallbackRecords = getAllPracticeRecords();
          setRecords(fallbackRecords);
        }
      } catch (err) {
        console.error('[ielts] History init failed:', err);
        // P0 fallback on any init error
        setUseP0Fallback(true);
        try {
          const { getAllPracticeRecords } = await import('@/src/lib/practiceRecords');
          setRecords(getAllPracticeRecords());
        } catch {}
      } finally {
        setRecordsLoaded(true);
      }
    })();
  }, []);
  const speakingAttempts = records.filter((record): record is SpeakingPracticeRecord => record.module === 'speaking');
  const writingAttempts = records.filter((record): record is WritingTask2PracticeRecord =>
    record.module === 'writing' && record.task === 'task2'
  );
  const writingTask1Attempts = records.filter((record): record is WritingTask1PracticeRecord =>
    record.module === 'writing_task1' && record.task === 'task1'
  );

  const refreshRecords = async () => {
    const allRecords = await listPracticeRecords();
    setRecords(allRecords);
    setStorageUsage(getStorageUsage());
  };

  const openSpeakingAttempt = async (record: SpeakingPracticeRecord) => {
    setStorageError(null);
    const active = await getActiveSpeakingSession();
    const result = await saveActiveSpeakingSession({
      id: active?.id || `history_speaking_${Date.now()}`,
      currentPart: record.part,
      attemptsByPart: {
        ...(active?.attemptsByPart || {}),
        [record.part]: record,
      },
      updatedAt: new Date().toISOString(),
    });
    if (!result.ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
      return;
    }
    navigate('/speaking/practice', { state: { restoreSpeakingRecordId: record.id } });
  };

  const openWritingAttempt = async (record: WritingTask2PracticeRecord) => {
    setStorageError(null);
    const result = await saveActiveWritingTask2(record);
    if (!result.ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
      return;
    }
    navigate('/writing/task2/practice');
  };

  const openWritingTask1Attempt = async (record: WritingTask1PracticeRecord) => {
    setStorageError(null);
    const result = await saveActiveWritingTask1(record);
    if (!result.ok) {
      setStorageError(STORAGE_FULL_MESSAGE);
      return;
    }
    navigate('/writing/task1');
  };

  const deleteSpeakingAttempt = async (record: SpeakingPracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    await deletePracticeRecord(record.id, 'speaking');
    const active = await getActiveSpeakingSession();
    if (active?.attemptsByPart[record.part]?.id === record.id) {
      await saveActiveSpeakingSession({
        ...active,
        attemptsByPart: {
          ...active.attemptsByPart,
          [record.part]: undefined,
        },
        updatedAt: new Date().toISOString(),
      });
    }
    refreshRecords();
  };

  const deleteWritingAttempt = async (record: WritingTask2PracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    await deletePracticeRecord(record.id, 'writing');
    await deleteActiveWritingTask2(record.id);
    refreshRecords();
  };

  const deleteWritingTask1Attempt = async (record: WritingTask1PracticeRecord) => {
    const confirmed = window.confirm('Delete this attempt? This cannot be undone.');
    if (!confirmed) return;

    await deletePracticeRecord(record.id, 'writing_task1');
    await deleteActiveWritingTask1(record.id);
    refreshRecords();
  };

  const sectionLabel = (text: string) => (
    <div className="text-sm font-bold text-paper-ink/60 mt-4 mb-2 border-t pt-3">{text}</div>
  );

  const renderSpeakingReadOnly = (record: SpeakingPracticeRecord) => {
    const fb = record.feedback;
    const isThread = record.sessionKind === 'part1_topic_thread';
    return (
    <div className="space-y-3">
      <div className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40">
        只读查看 · {speakingHistoryMeta(record)}
      </div>
      <div>
        <div className="text-sm font-bold text-paper-ink/60 mb-1">Topic / Question</div>
        <div className="text-base">{record.question}</div>
        {record.topic && record.topic !== record.question && (
          <div className="text-sm text-paper-ink/55 mt-1">Topic: {record.topic}</div>
        )}
        {isThread && record.threadQuestions && (
          <div className="mt-2 space-y-1">
            <div className="text-sm font-bold text-paper-ink/60">Thread Questions</div>
            {record.threadQuestions.map((q, i) => (
              <div key={q.id} className="text-sm text-paper-ink/70">Q{i + 1}: {q.question}</div>
            ))}
          </div>
        )}
      </div>
      {isThread && record.threadAnswers && record.threadAnswers.length > 0 ? (
        <div>
          <div className="text-sm font-bold text-paper-ink/60 mb-1">Answers</div>
          <div className="space-y-2">
            {record.threadAnswers.map((answer, i) => (
              <div key={answer.questionId} className="bg-amber-50/50 rounded p-3 border border-amber-100/50">
                <div className="text-xs text-paper-ink/40 mb-1">Q{i + 1}</div>
                <div className="text-sm leading-7">{answer.transcript || '(empty)'}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="text-sm font-bold text-paper-ink/60 mb-1">Transcript</div>
          <div className="bg-amber-50/50 rounded p-3 border border-amber-100/50 text-sm leading-7">
            {record.transcript || '(empty)'}
          </div>
        </div>
      )}
      {fb && (
        <>
          <div>
            <div className="text-sm font-bold text-paper-ink/60 mb-1">Scores & Estimate</div>
            <div className="bg-white rounded p-3 border text-sm">
              {typeof fb.bandEstimateExcludingPronunciation === 'number' && fb.bandEstimateExcludingPronunciation > 0 && (
                <div className="mb-1">
                  Estimated Band: <span className="font-bold">{fb.bandEstimateExcludingPronunciation.toFixed(1)}</span>
                  {fb.bandEstimateRange && (
                    <span className="text-paper-ink/50"> (range: {fb.bandEstimateRange.lower.toFixed(1)}–{fb.bandEstimateRange.upper.toFixed(1)})</span>
                  )}
                </div>
              )}
              {fb.scores && (
                <div className="text-xs text-paper-ink/50">
                  FC: {fb.scores.fluencyCoherence} · LR: {fb.scores.lexicalResource} · GRA: {fb.scores.grammaticalRangeAccuracy}
                </div>
              )}
              {fb.estimateRationaleZh && (
                <div className="text-sm text-paper-ink/70 leading-7 mt-2">{fb.estimateRationaleZh}</div>
              )}
            </div>
          </div>
          {fb.fatalErrors && fb.fatalErrors.length > 0 && (
            <div>
              {sectionLabel('主要错误 / Fatal Errors')}
              <div className="space-y-2">
                {fb.fatalErrors.map((err, i) => (
                  <div key={i} className="bg-red-50/50 rounded p-2 border border-red-100/50 text-sm leading-6">
                    <div className="text-red-800">{err.original || ''}</div>
                    {(err as any).explanationZh && <div className="text-paper-ink/60 text-xs mt-1">{(err as any).explanationZh}</div>}
                    {(err as any).suggestionZh && <div className="text-paper-ink/60 text-xs">{(err as any).suggestionZh}</div>}
                    {(err as any).improved && <div className="text-green-800 text-xs mt-0.5">→ {(err as any).improved}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {fb.naturalnessHints && fb.naturalnessHints.length > 0 && (
            <div>
              {sectionLabel('自然表达建议 / Naturalness Hints')}
              <div className="space-y-2">
                {fb.naturalnessHints.map((hint: any, i: number) => (
                  <div key={i} className="bg-blue-50/50 rounded p-2 border border-blue-100/50 text-sm leading-6">
                    {hint.english && <div>{hint.english}</div>}
                    {hint.explanationZh && <div className="text-paper-ink/60 text-xs mt-1">{hint.explanationZh}</div>}
                    {hint.better && <div className="text-green-800 text-xs mt-0.5">→ {hint.better}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {fb.band9Refinements && fb.band9Refinements.length > 0 && (
            <div>
              {sectionLabel('高分优化 / Band 9 Refinements')}
              <div className="space-y-1">
                {fb.band9Refinements.map((ref: any, i: number) => (
                  <div key={i} className="text-sm leading-6">
                    {ref.english && <span>{ref.english}</span>}
                    {ref.explanationZh && <span className="text-paper-ink/60 text-xs ml-2">{ref.explanationZh}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {fb.preservedStyle && fb.preservedStyle.length > 0 && (
            <div>
              {sectionLabel('保留的好表达 / Preserved Style')}
              <div className="space-y-2">
                {fb.preservedStyle.map((item: any, i: number) => (
                  <div key={i} className="bg-green-50/50 rounded p-2 border border-green-100/50 text-sm leading-6">
                    <div className="text-green-900">{item.text || ''}</div>
                    {item.reasonZh && <div className="text-paper-ink/60 text-xs mt-1">{item.reasonZh}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {fb.upgradedAnswer && (
            <div>
              {sectionLabel('升级回答 / Upgraded Answer')}
              <div className="bg-green-50/50 rounded p-3 border border-green-100/50 text-sm leading-7">{fb.upgradedAnswer}</div>
            </div>
          )}
          {isThread && fb.threadFeedback && (
            <>
              {(fb.threadFeedback.mustFix?.length > 0 || fb.threadFeedback.annotations?.length > 0) && (
                <div>
                  {sectionLabel('批注修正 / Must Fix & Annotations')}
                  <div className="space-y-2">
                    {fb.threadFeedback.mustFix?.map((item, i) => (
                      <div key={`mf-${i}`} className="bg-red-50/50 rounded p-2 border border-red-100/50 text-sm leading-6">
                        <div className="text-xs text-paper-ink/40">{item.questionRefs?.join(', ')}</div>
                        <div className="text-red-800">{item.learnerWording}</div>
                        <div className="text-green-800 text-xs">→ {item.betterVersion}</div>
                        {item.explanationZh && <div className="text-paper-ink/60 text-xs mt-1">{item.explanationZh}</div>}
                      </div>
                    ))}
                    {fb.threadFeedback.annotations?.map(ann => (
                      <div key={ann.id} className="bg-amber-50/50 rounded p-2 border border-amber-100/50 text-sm leading-6">
                        <div className="text-xs text-paper-ink/40">{ann.questionRef} &middot; {ann.sourceQuote}</div>
                        {ann.layers?.map((layer, j) => (
                          <div key={j} className="mt-1 pl-2 border-l-2 border-amber-300">
                            <div className="text-xs text-paper-ink/40">{layer.severity} &middot; {layer.issueType}</div>
                            <div className="text-red-800 text-xs">{layer.original}</div>
                            <div className="text-green-800 text-xs">→ {layer.better}</div>
                            {layer.explanationZh && <div className="text-paper-ink/60 text-xs">{layer.explanationZh}</div>}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.cleanRetryAnswers?.length > 0 && (
                <div>
                  {sectionLabel('参考答案 / Clean Retry Answers')}
                  <div className="space-y-2">
                    {fb.threadFeedback.cleanRetryAnswers.map((ans, i) => (
                      <div key={i} className="bg-green-50/50 rounded p-2 border border-green-100/50 text-sm leading-6">
                        <div className="text-xs text-paper-ink/40">{ans.questionRef}</div>
                        <div className="text-green-900">{ans.answer}</div>
                        {ans.noteZh && <div className="text-paper-ink/60 text-xs mt-1">{ans.noteZh}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.developmentTargets?.length > 0 && (
                <div>
                  {sectionLabel('发展建议 / Development Targets')}
                  <div className="space-y-2">
                    {fb.threadFeedback.developmentTargets.map((dt, i) => (
                      <div key={i} className="bg-purple-50/50 rounded p-2 border border-purple-100/50 text-sm leading-6">
                        <div className="text-xs text-paper-ink/40">{dt.questionRef}</div>
                        <div className="text-paper-ink/70 text-xs">{dt.reasonZh}</div>
                        <div className="text-paper-ink/80 text-xs font-bold mt-0.5">{dt.developmentMoveZh}</div>
                        {dt.optionalDevelopedAnswer && (
                          <div className="text-green-800 text-xs mt-1">→ {dt.optionalDevelopedAnswer}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.answerByAnswerCoaching?.length > 0 && (
                <div>
                  {sectionLabel('逐题建议 / Answer Coaching')}
                  <div className="space-y-2">
                    {fb.threadFeedback.answerByAnswerCoaching.map((ac, i) => (
                      <div key={i} className="bg-blue-50/50 rounded p-2 border border-blue-100/50 text-sm leading-6">
                        <div className="text-xs text-paper-ink/40">{ac.questionRefs?.join(', ')} &middot; {ac.issue}</div>
                        <div className="text-paper-ink/70 text-xs mt-1">{ac.coachingZh}</div>
                        {ac.exampleFrame && <div className="text-paper-ink/60 text-xs mt-0.5">e.g. {ac.exampleFrame}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.highImpactPhraseFixes?.length > 0 && (
                <div>
                  {sectionLabel('关键短语修正 / High-Impact Phrase Fixes')}
                  <div className="space-y-2">
                    {fb.threadFeedback.highImpactPhraseFixes.map((pf, i) => (
                      <div key={i} className="bg-amber-50/50 rounded p-2 border border-amber-100/50 text-sm leading-6">
                        <div className="text-xs text-paper-ink/40">{pf.questionRefs?.join(', ')}</div>
                        <div className="text-red-800 text-xs">{pf.original}</div>
                        <div className="text-green-800 text-xs">→ {pf.better}</div>
                        {pf.explanationZh && <div className="text-paper-ink/60 text-xs">{pf.explanationZh}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.optionalPolish?.length > 0 && (
                <div>
                  {sectionLabel('可选优化 / Optional Polish')}
                  <div className="space-y-1">
                    {fb.threadFeedback.optionalPolish.map((op: any, i: number) => (
                      <div key={i} className="text-sm leading-6">
                        <span className="text-red-800 text-xs">{op.original}</span>
                        <span className="text-paper-ink/40 mx-1">→</span>
                        <span className="text-green-800 text-xs">{op.better}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.materialBank?.myUsableMaterial?.length > 0 && (
                <div>
                  {sectionLabel('个人素材 / Material Bank')}
                  <div className="space-y-2">
                    {fb.threadFeedback.materialBank.myUsableMaterial.map((mat, i) => (
                      <div key={i} className="bg-green-50/50 rounded p-2 border border-green-100/50 text-sm leading-6">
                        <div className="text-green-900 font-bold text-xs">{mat.reusableVersion}</div>
                        {mat.explanationZh && <div className="text-paper-ink/60 text-xs mt-0.5">{mat.explanationZh}</div>}
                        {mat.reuseFor?.length > 0 && <div className="text-paper-ink/40 text-xs mt-0.5">适用: {mat.reuseFor.join(', ')}</div>}
                        {mat.developmentMoveZh && <div className="text-paper-ink/60 text-xs mt-0.5">{mat.developmentMoveZh}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {fb.threadFeedback.threadLevelPatterns?.length > 0 && (
                <div>
                  {sectionLabel('通用模式 / Thread-Level Patterns')}
                  <div className="space-y-2">
                    {fb.threadFeedback.threadLevelPatterns.map((pat, i) => (
                      <div key={i} className="bg-slate-50 rounded p-2 border text-sm leading-6">
                        <div className="text-paper-ink/80 text-xs">{pat.observationZh}</div>
                        <div className="text-paper-ink/60 text-xs mt-0.5">{pat.whyItMattersZh}</div>
                        <div className="text-paper-ink/70 text-xs font-bold mt-0.5">Rule: {pat.retryRule}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(fb.threadFeedback.nextRetryFocusZh || fb.threadFeedback.nextRetryPlan) && (
                <div>
                  {sectionLabel('下次重练重点 / Next Retry Plan')}
                  <div className="bg-white rounded p-3 border text-sm leading-6">
                    {fb.threadFeedback.nextRetryFocusZh && <div>{fb.threadFeedback.nextRetryFocusZh}</div>}
                    {fb.threadFeedback.nextRetryPlan?.priorityAccuracyPatternZh && (
                      <div className="text-xs text-paper-ink/60 mt-1">重点: {fb.threadFeedback.nextRetryPlan.priorityAccuracyPatternZh}</div>
                    )}
                    {fb.threadFeedback.nextRetryPlan?.answerLengthRuleZh && (
                      <div className="text-xs text-paper-ink/60 mt-0.5">时长: {fb.threadFeedback.nextRetryPlan.answerLengthRuleZh}</div>
                    )}
                    {fb.threadFeedback.nextRetryPlan?.materialToTry && (
                      <div className="text-xs text-paper-ink/60 mt-0.5">素材: {fb.threadFeedback.nextRetryPlan.materialToTry}</div>
                    )}
                    {fb.threadFeedback.nextRetryPlan?.actions?.length > 0 && (
                      <div className="text-xs text-paper-ink/60 mt-0.5">Actions: {fb.threadFeedback.nextRetryPlan.actions.join('; ')}</div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          {fb.nextStepZh && (
            <div>
              {sectionLabel('建议 / Next Step')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.nextStepZh}</div>
            </div>
          )}
          {fb.reusableExample?.example && (
            <div>
              {sectionLabel('可复用范例 / Reusable Example')}
              <div className="bg-green-50/50 rounded p-2 border border-green-100/50 text-sm leading-6">
                <div>{fb.reusableExample.example}</div>
                {fb.reusableExample.explanationZh && <div className="text-paper-ink/60 text-xs mt-1">{fb.reusableExample.explanationZh}</div>}
                {fb.reusableExample.canBeReusedFor?.length > 0 && (
                  <div className="text-paper-ink/40 text-xs mt-0.5">For: {fb.reusableExample.canBeReusedFor.join(', ')}</div>
                )}
              </div>
            </div>
          )}
        </>
      )}
      <div className="text-xs text-paper-ink/30 pt-2">
        {formatTimestamp(getTimestamp(record))} · ID: {record.id}
      </div>
    </div>
  )};

  const renderWritingTask2ReadOnly = (record: WritingTask2PracticeRecord) => (
    <div className="space-y-3">
      <div className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40">
        只读查看 · Task 2 / {record.status}
      </div>
      <div>
        <div className="text-sm font-bold text-paper-ink/60 mb-1">Question</div>
        <div className="text-base">{record.question}</div>
      </div>
      {record.essay && (
        <div>
          <div className="text-sm font-bold text-paper-ink/60 mb-1">Essay</div>
          <div className="bg-amber-50/50 rounded p-3 border border-amber-100/50 text-sm leading-7 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {record.essay}
          </div>
        </div>
      )}
      {record.feedback && (
        <>
          <div>
            <div className="text-sm font-bold text-paper-ink/60 mb-1">Scores & Estimate</div>
            <div className="bg-white rounded p-3 border text-sm">
              <div className="text-xs text-paper-ink/50 mb-1">
                TR: {record.feedback.scores.taskResponse} · CC: {record.feedback.scores.coherenceCohesion} · LR: {record.feedback.scores.lexicalResource} · GRA: {record.feedback.scores.grammaticalRangeAccuracy}
              </div>
              {record.feedback.estimateRationaleZh && (
                <div className="text-sm text-paper-ink/70 leading-7 mt-1">{record.feedback.estimateRationaleZh}</div>
              )}
            </div>
          </div>
          {record.feedback.essayLevelWarnings?.length > 0 && (
            <div>
              {sectionLabel('整体问题 / Essay-Level Warnings')}
              <div className="space-y-1">
                {record.feedback.essayLevelWarnings.map((w: any, i: number) => (
                  <div key={i} className="text-sm leading-6 text-paper-ink/70">{w.warning || w.issue || JSON.stringify(w)}</div>
                ))}
              </div>
            </div>
          )}
          {record.feedback.sentenceFeedback?.length > 0 && (
            <div>
              {sectionLabel('句子修正 / Sentence Corrections')}
              <div className="space-y-2">
                {record.feedback.sentenceFeedback.slice(0, 20).map((sf, i) => (
                  <div key={i} className="bg-red-50/50 rounded p-2 border border-red-100/50 text-sm leading-6">
                    <div className="text-xs text-paper-ink/40">#{sf.correctionNumber} · {sf.dimension} · {sf.severity} · {sf.issueType}</div>
                    {sf.sourceQuote && <div className="text-paper-ink/50 text-xs">"{sf.sourceQuote}"</div>}
                    {sf.original && <div className="text-red-800 text-xs">{sf.original}</div>}
                    {sf.correction && <div className="text-green-800 text-xs">→ {sf.correction}</div>}
                    {sf.explanationZh && <div className="text-paper-ink/60 text-xs mt-1">{sf.explanationZh}</div>}
                  </div>
                ))}
                {record.feedback.sentenceFeedback.length > 20 && (
                  <div className="text-xs text-paper-ink/40">+{record.feedback.sentenceFeedback.length - 20} more corrections</div>
                )}
              </div>
            </div>
          )}
          {record.feedback.vocabularyUpgrade?.topicVocabulary?.length > 0 && (
            <div>
              {sectionLabel('话题词汇 / Topic Vocabulary')}
              <div className="space-y-1">
                {record.feedback.vocabularyUpgrade.topicVocabulary.map((v: any, i: number) => (
                  <div key={i} className="bg-green-50/50 rounded p-2 border border-green-100/50 text-sm leading-6">
                    <div className="text-green-900 font-bold">{v.expression || ''}</div>
                    {v.meaningZh && <div className="text-paper-ink/60 text-xs">{v.meaningZh}</div>}
                    {v.usageZh && <div className="text-paper-ink/60 text-xs">{v.usageZh}</div>}
                    {v.example && <div className="text-paper-ink/50 text-xs italic mt-0.5">{v.example}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {record.feedback.vocabularyUpgrade?.expressionUpgrades?.length > 0 && (
            <div>
              {sectionLabel('表达升级 / Expression Upgrades')}
              <div className="space-y-1">
                {record.feedback.vocabularyUpgrade.expressionUpgrades.map((eu: any, i: number) => (
                  <div key={i} className="text-sm leading-6">
                    <span className="text-xs text-paper-ink/40">{eu.category} &middot; </span>
                    {eu.original && <span className="text-red-800 text-xs line-through">{eu.original} </span>}
                    <span className="text-green-800 text-xs font-bold">{eu.better}</span>
                    {eu.explanationZh && <span className="text-paper-ink/60 text-xs ml-1">{eu.explanationZh}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {record.feedback.modelAnswerAnnotations?.length > 0 && (
            <div>
              {sectionLabel('范本标注 / Model Answer Annotations')}
              <div className="space-y-1">
                {record.feedback.modelAnswerAnnotations.map((ma, i) => (
                  <div key={i} className="text-sm leading-6">
                    <span className="text-xs text-paper-ink/40">{ma.type} &middot; {ma.labelZh}</span>
                    <span className="text-paper-ink/70 ml-1">"{ma.quote}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {record.feedback.reusableArguments?.length > 0 && (
            <div>
              {sectionLabel('可复用论证 / Reusable Arguments')}
              <div className="space-y-2">
                {record.feedback.reusableArguments.map((ra: any, i: number) => (
                  <div key={i} className="bg-blue-50/50 rounded p-2 border border-blue-100/50 text-sm leading-6">
                    {ra.title && <div className="font-bold text-xs">{ra.title}</div>}
                    {ra.content && <div className="text-paper-ink/70 text-xs mt-0.5">{ra.content}</div>}
                    {ra.explanationZh && <div className="text-paper-ink/60 text-xs mt-0.5">{ra.explanationZh}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {record.feedback.frameworkFeedback?.length > 0 && (
            <div>
              {sectionLabel('结构反馈 / Framework Feedback')}
              <div className="space-y-1">
                {record.feedback.frameworkFeedback.map((ff: any, i: number) => (
                  <div key={i} className="text-sm leading-6 text-paper-ink/70">
                    {typeof ff === 'string' ? ff : ff.feedback || ff.issue || ''}
                  </div>
                ))}
              </div>
            </div>
          )}
          {record.feedback.modelAnswer && (
            <div>
              {sectionLabel('范本 / Model Answer')}
              <div className="bg-green-50/50 rounded p-3 border border-green-100/50 text-sm leading-7 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {record.feedback.modelAnswer}
              </div>
            </div>
          )}
          {record.feedback.nextStepZh && (
            <div>
              {sectionLabel('建议 / Next Step')}
              <div className="text-sm text-paper-ink/70 leading-7">{record.feedback.nextStepZh}</div>
            </div>
          )}
        </>
      )}
      <div className="text-xs text-paper-ink/30 pt-2">
        {formatTimestamp(getTimestamp(record))} · ID: {record.id}
      </div>
    </div>
  );

  const renderWritingTask1ReadOnly = (record: WritingTask1PracticeRecord) => {
    const fb = record.feedback as any;
    return (
    <div className="space-y-3">
      <div className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40">
        只读查看 · {record.taskType} / {record.status}
      </div>
      <div>
        <div className="text-sm font-bold text-paper-ink/60 mb-1">Prompt</div>
        <div className="text-base">{record.instruction || record.prompt}</div>
      </div>
      {record.report && (
        <div>
          <div className="text-sm font-bold text-paper-ink/60 mb-1">Report</div>
          <div className="bg-amber-50/50 rounded p-3 border border-amber-100/50 text-sm leading-7 whitespace-pre-wrap max-h-96 overflow-y-auto">
            {record.report}
          </div>
        </div>
      )}
      {fb && (
        <>
          <div>
            <div className="text-sm font-bold text-paper-ink/60 mb-1">Scores & Estimate</div>
            <div className="bg-white rounded p-3 border text-sm">
              {typeof fb.estimatedBand === 'number' && fb.estimatedBand > 0 && (
                <div className="mb-1">Estimated Band: <span className="font-bold">{fb.estimatedBand.toFixed(1)}</span></div>
              )}
              {fb.taskAchievement && (
                <div className="text-xs text-paper-ink/50">TA Score: {fb.taskAchievement.score}</div>
              )}
              {fb.estimateRationaleZh && (
                <div className="text-sm text-paper-ink/70 leading-7 mt-2">{fb.estimateRationaleZh}</div>
              )}
            </div>
          </div>
          {fb.taskAchievement?.feedback && (
            <div>
              {sectionLabel('任务达成反馈 / Task Achievement')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.taskAchievement.feedback}</div>
            </div>
          )}
          {fb.overviewFeedback && (
            <div>
              {sectionLabel('概览问题 / Overview')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.overviewFeedback}</div>
            </div>
          )}
          {fb.keyFeaturesFeedback && (
            <div>
              {sectionLabel('关键信息 / Key Features')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.keyFeaturesFeedback}</div>
            </div>
          )}
          {fb.comparisonFeedback && (
            <div>
              {sectionLabel('比较关系 / Comparisons')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.comparisonFeedback}</div>
            </div>
          )}
          {fb.dataAccuracyFeedback && (
            <div>
              {sectionLabel('数据准确性 / Data Accuracy')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.dataAccuracyFeedback}</div>
            </div>
          )}
          {fb.coherenceFeedback && (
            <div>
              {sectionLabel('结构连贯 / Coherence')}
              <div className="text-sm text-paper-ink/70 leading-7">{fb.coherenceFeedback}</div>
            </div>
          )}
          {fb.languageCorrections?.length > 0 && (
            <div>
              {sectionLabel('语言修正 / Language Corrections')}
              <div className="space-y-2">
                {fb.languageCorrections.map((lc: any, i: number) => (
                  <div key={i} className="bg-red-50/50 rounded p-2 border border-red-100/50 text-sm leading-6">
                    {lc.original && <div className="text-red-800 text-xs">{lc.original}</div>}
                    {lc.correction && <div className="text-green-800 text-xs">→ {lc.correction}</div>}
                    {lc.explanation && <div className="text-paper-ink/60 text-xs mt-0.5">{lc.explanation}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {fb.mustFix?.length > 0 && (
            <div>
              {sectionLabel('必须修正 / Must Fix')}
              <div className="space-y-1">
                {fb.mustFix.map((mf: string, i: number) => (
                  <div key={i} className="text-sm leading-6 text-paper-ink/70">{mf}</div>
                ))}
              </div>
            </div>
          )}
          {fb.improvedReport && (
            <div>
              {sectionLabel('改进后报告 / Improved Report')}
              <div className="bg-green-50/50 rounded p-3 border border-green-100/50 text-sm leading-7 whitespace-pre-wrap max-h-96 overflow-y-auto">
                {fb.improvedReport}
              </div>
            </div>
          )}
          {fb.reusableReportPatterns?.length > 0 && (
            <div>
              {sectionLabel('可复用句式 / Reusable Patterns')}
              <div className="space-y-1">
                {fb.reusableReportPatterns.map((rp: string, i: number) => (
                  <div key={i} className="text-sm leading-6 text-paper-ink/70">{rp}</div>
                ))}
              </div>
            </div>
          )}
          {fb.modelExcerpt && (
            <div>
              {sectionLabel('范本片段 / Model Excerpt')}
              <div className="bg-blue-50/50 rounded p-3 border border-blue-100/50 text-sm leading-7">{fb.modelExcerpt}</div>
            </div>
          )}
          {fb.obsidianMarkdown && (
            <div>
              {sectionLabel('导出文本 / Export Markdown')}
              <div className="bg-slate-50 rounded p-3 border text-xs leading-6 whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-paper-ink/60">
                {fb.obsidianMarkdown}
              </div>
            </div>
          )}
        </>
      )}
      <div className="text-xs text-paper-ink/30 pt-2">
        {formatTimestamp(getTimestamp(record))} · ID: {record.id}
      </div>
    </div>
  )};

  const renderReadOnlyDetail = () => {
    if (!readOnlyRecord) return null;
    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-serif">查看结果</h2>
          <SerifButton
            type="button"
            variant="outline"
            className="text-xs"
            onClick={() => setReadOnlyRecord(null)}
          >
            Close
          </SerifButton>
        </div>
        <PaperCard className="p-6">
          {readOnlyRecord.module === 'speaking'
            ? renderSpeakingReadOnly(readOnlyRecord as SpeakingPracticeRecord)
            : readOnlyRecord.module === 'writing_task1'
              ? renderWritingTask1ReadOnly(readOnlyRecord as WritingTask1PracticeRecord)
              : renderWritingTask2ReadOnly(readOnlyRecord as WritingTask2PracticeRecord)}
        </PaperCard>
      </div>
    );
  };

  const handleExport = async () => {
    try {
      const payload = await exportCompleteLocalBackup();
      downloadBackupFile(payload);
    } catch (err) {
      setStorageError('导出备份失败，请重试。');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const preview = await previewImportFromParsedJson(parsed);
        setImportPreview(preview);
        setPendingImportData(parsed);
      } catch (err) {
        setStorageError('导入备份失败：文件格式不正确或已损坏。');
      }
    };
    input.click();
  };

  const confirmImport = async (overwriteActiveStates: boolean) => {
    if (!pendingImportData) return;
    try {
      const report = await importFromParsedJson(pendingImportData, { overwriteActiveStates });
      setImportReport(report);
      setImportPreview(null);
      setPendingImportData(null);
      await refreshRecords();
      await loadLegacyPage(0);
      // Reload recovery metadata after import
      const meta = await getLegacyRecoveryImportMeta();
      setRecoveryMeta(meta);
    } catch (err) {
      setStorageError('导入失败：' + (err instanceof Error ? err.message : '未知错误'));
    }
  };

  const cancelImport = () => {
    setImportPreview(null);
    setPendingImportData(null);
  };

  const handleReleaseStorage = async () => {
    if (!canReleaseLegacyStorage()) {
      setStorageError('释放条件未满足：迁移必须已完成且已验证，并已导出最新备份。');
      return;
    }
    const releasedKeys = getReleasedKeysList();
    const confirmed = window.confirm(
      `释放旧版存储空间？\n\n此操作将清除以下 localStorage 键中的旧版数据：\n${releasedKeys.join('\n')}\n\nIndexedDB 中的记录、存档和设置不会被删除。\n\n请确保已导出最新备份。`,
    );
    if (!confirmed) return;
    const result = await releaseLegacyLocalStorage();
    if (result.ok) {
      setStorageUsage(getStorageUsage());
      setStorageError(null);
    } else {
      setStorageError(result.message || '释放失败：安全条件未满足。');
    }
  };

  const [legacyDetail, setLegacyDetail] = useState<any>(null);

  const renderLegacySessionItem = (session: any) => {
    const dateStr = session.date ? new Date(session.date).toLocaleDateString() : 'unknown date';
    return (
      <div key={session.archiveKey} className="text-sm py-1 border-b border-paper-ink/10 last:border-0 flex items-center justify-between">
        <span>
          <span className="text-paper-ink/40 text-xs">{dateStr}</span>
          <span className="ml-2">{session.module || 'unknown'}{session.part ? ` Part ${session.part}` : ''}</span>
        </span>
        <SerifButton
          type="button"
          variant="outline"
          className="text-xs"
          onClick={async () => {
            const result = await getLegacySession(session.archiveKey);
            if (result) {
              setLegacyDetail({ archiveKey: session.archiveKey, ...result });
            }
          }}
        >
          查看
        </SerifButton>
      </div>
    );
  };

  const renderLegacySessionDetail = () => {
    if (!legacyDetail) return null;
    const { rawPayload, metadata } = legacyDetail;
    const isSpeaking = rawPayload?.module === 'speaking';
    const isWriting = rawPayload?.module === 'writing' || rawPayload?.module === 'writing_task1';
    let questionText = '';
    let answerText = '';
    if (isSpeaking) {
      questionText = rawPayload?.question || rawPayload?.feedback?.question || '';
      answerText = rawPayload?.transcript || rawPayload?.feedback?.transcript || '';
    } else if (isWriting) {
      questionText = rawPayload?.question || rawPayload?.instruction || '';
      answerText = rawPayload?.essay || rawPayload?.report || '';
    }
    return (
      <div className="mt-2 p-3 bg-slate-50 rounded border">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-paper-ink/50">
            旧版存档 · {metadata.module || 'unknown'} · {metadata.source || 'unknown source'}
          </div>
          <SerifButton type="button" variant="outline" className="text-xs" onClick={() => setLegacyDetail(null)}>关闭</SerifButton>
        </div>
        <div className="text-xs text-paper-ink/30 mb-2">{metadata.archiveKey}</div>
        {questionText && (
          <div className="mb-2">
            <div className="text-xs font-bold text-paper-ink/60">Question</div>
            <div className="text-sm leading-6">{questionText}</div>
          </div>
        )}
        {answerText && (
          <div className="mb-2">
            <div className="text-xs font-bold text-paper-ink/60">{isSpeaking ? 'Transcript' : 'Answer'}</div>
            <div className="bg-amber-50/50 rounded p-2 border border-amber-100/50 text-sm leading-6 max-h-48 overflow-y-auto whitespace-pre-wrap">{answerText}</div>
          </div>
        )}
        {rawPayload?.feedback && typeof rawPayload.feedback === 'object' && (
          <div className="mb-2">
            <div className="text-xs font-bold text-paper-ink/60">Feedback Fields</div>
            <div className="text-xs text-paper-ink/50">
              {Object.keys(rawPayload.feedback).filter(k => k !== 'obsidianMarkdown').join(', ') || '(feedback object present)'}
            </div>
          </div>
        )}
        <details className="text-xs">
          <summary className="cursor-pointer text-paper-ink/40 hover:text-paper-ink/60">查看完整原始数据</summary>
          <pre className="mt-1 p-2 bg-slate-100 rounded text-paper-ink/60 max-h-64 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5">
            {JSON.stringify(rawPayload, null, 2)}
          </pre>
        </details>
      </div>
    );
  };

  return (
    <PageShell size="wide">
      <TopBar />

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-accent-terracotta/10 text-accent-terracotta rounded">
            <History className="w-5 h-5" />
          </div>
          <h1 className="text-3xl text-paper-ink">Practice History</h1>
        </div>
      </div>

      {storageError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-bold text-red-800 mb-1">存储空间不足</div>
            <div className="text-sm text-red-700 leading-6">{storageError}</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <SerifButton
                type="button"
                variant="outline"
                className="text-xs border-red-300 text-red-700 hover:bg-red-100"
                onClick={() => { handleExport(); setStorageError(null); }}
              >
                <Download className="w-3 h-3 mr-1" /> 导出本地数据备份
              </SerifButton>
              <SerifButton
                type="button"
                variant="outline"
                className="text-xs"
                onClick={() => setStorageError(null)}
              >
                Dismiss
              </SerifButton>
            </div>
          </div>
        </div>
      )}

      {storageUsage && (
        <div className={`mb-6 p-4 rounded-lg border ${storageUsage.isNearQuota ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold text-paper-ink/70">
              本地存储用量: {storageUsage.totalMB} MB
              {storageUsage.isNearQuota && (
                <span className="ml-2 text-amber-700 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> 接近上限
                </span>
              )}
            </div>
            <SerifButton
              type="button"
              variant="outline"
              className="text-xs flex items-center gap-1"
              onClick={handleExport}
            >
              <Download className="w-3 h-3" /> 导出本地数据备份
            </SerifButton>
          </div>
          {storageUsage.isNearQuota && (
            <div className="text-xs text-amber-700 leading-5 mb-2">
              本地存储空间接近上限，新的保存或恢复操作可能失败。你的历史记录仍在本机，建议先导出备份，修复存储前暂停新练习。
            </div>
          )}
          <div className="text-xs text-paper-ink/45 leading-5 mb-2">
            导出的备份将包含旧版会话数据；完整合并与迁移将在后续存储修复中处理。
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
            {storageUsage.entries.slice(0, 8).map(entry => (
              <div key={entry.key} className="text-xs bg-white/70 rounded px-2 py-1 border">
                <div className="text-paper-ink/60 truncate" title={entry.key}>{entry.key}</div>
                <div className="font-mono text-paper-ink/80">{entry.sizeMB} MB</div>
              </div>
            ))}
          </div>
          {storageUsage.entries.length > 8 && (
            <div className="text-xs text-paper-ink/40 mt-1">+{storageUsage.entries.length - 8} more keys</div>
          )}
        </div>
      )}

      {renderReadOnlyDetail()}

      {useP0Fallback && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 leading-6">
            新的本地数据库迁移未完成。旧记录仍保留在浏览器中，当前以只读方式显示；请先导出备份，不要释放旧版存储空间。
          </div>
        </div>
      )}

      {migrationReport && (
        <div className={`mb-6 p-4 rounded-lg border ${
          migrationReport.status === 'completed' ? 'bg-green-50 border-green-200' :
          migrationReport.status === 'incomplete' ? 'bg-amber-50 border-amber-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className={`text-sm font-bold mb-1 ${
            migrationReport.status === 'completed' ? 'text-green-800' :
            migrationReport.status === 'incomplete' ? 'text-amber-800' :
            'text-red-800'
          }`}>
            初始自动迁移
            {migrationReport.status === 'completed' ? ' — 完成' :
             migrationReport.status === 'incomplete' ? ' — 未完成' :
             migrationReport.status === 'failed' ? ' — 失败' : ' — 状态未知'}
          </div>
          <div className="text-xs leading-5 text-paper-ink/60 mb-1">
            以下为本地数据库首次创建时从 localStorage 自动迁移的结果。备份导入后的实际 IndexedDB 库存见下方「当前 IndexedDB 库存」。
          </div>
          <div className="text-xs leading-5 text-paper-ink/70">
            来源记录: {migrationReport.canonicalSourceCount} 条 · 已复制: {migrationReport.canonicalCopiedCount} 条
            {migrationReport.canonicalInvalidCount > 0 && ` · 无效: ${migrationReport.canonicalInvalidCount} 条`}
            <br />
            旧版会话: {migrationReport.legacySourceCount} 条来源 · {migrationReport.legacyArchivedCount} 条已存档
            {migrationReport.activeStatesCopied > 0 && ` · ${migrationReport.activeStatesCopied} 个活跃状态`}
            <br />
            验证: 索引 {migrationReport.verifiedCanonicalCount} 条记录 · {migrationReport.verifiedLegacyArchiveCount} 条存档
            {migrationReport.errors.length > 0 && (
              <div className="mt-1 text-red-600">{migrationReport.errors.length} 个迁移错误</div>
            )}
            {migrationReport.safeToReleaseLegacyStorage && migrationReport.status === 'completed' && (
              <div className="mt-1 text-green-700">安全释放条件已满足。</div>
            )}
            {!migrationReport.safeToReleaseLegacyStorage && migrationReport.status !== 'not_started' && (
              <div className="mt-1 text-amber-700">尚不能释放旧版存储空间。请确保迁移成功并导出最新备份。</div>
            )}
          </div>
        </div>
      )}

      {storageHealth && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-bold text-blue-800 mb-1">当前 IndexedDB 库存</div>
          <div className="text-xs text-blue-700 leading-5">
            规范练习记录: {storageHealth.indexedDb.practiceRecords} 条
            <br />
            旧版归档会话: {storageHealth.indexedDb.legacySessionsArchive} 条
            <br />
            活跃状态: {storageHealth.indexedDb.activeStates} 个
            <br />
            localStorage 用量: {storageHealth.localStorage.totalMB} MB
            {storageHealth.indexedDb.estimatedBytes > 0 && (
              <> · IndexedDB 估算: {(storageHealth.indexedDb.estimatedBytes / 1024 / 1024).toFixed(2)} MB</>
            )}
          </div>
        </div>
      )}

      {recoveryMeta && recoveryMeta.legacySessionsArchived > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-bold text-blue-800 mb-1">旧版会话已从备份恢复</div>
          <div className="text-xs text-blue-700 leading-5">
            已存档 {recoveryMeta.legacySessionsArchived} 条旧版会话（导入 {recoveryMeta.legacySessionsFound} 条，跳过 {recoveryMeta.legacySessionsSkipped} 条）。
            <br />
            已验证存档数量：{recoveryMeta.verifiedLegacyArchiveCountAfterImport} 条。
            <div className="mt-1 text-amber-700 font-bold">
              已导入新数据。释放旧版存储前，请重新导出包含当前 IndexedDB 内容的完整备份。
            </div>
            {recoveryMeta.errors.length > 0 && (
              <div className="mt-1 text-red-600">{recoveryMeta.errors.length} 个恢复导入错误</div>
            )}
          </div>
        </div>
      )}

      {migrationReport?.canonicalInvalidCount > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          存在 {migrationReport.canonicalInvalidCount} 条未完整迁移的旧记录，不能释放旧版存储空间。
        </div>
      )}

      {legacyTotal > 0 && !recoveryMeta && migrationReport?.legacyArchivedCount === 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="text-sm font-bold text-amber-800 mb-1">旧版会话档案待核验</div>
          <div className="text-xs text-amber-700 leading-5">
            已检测到 {legacyTotal} 条旧版会话档案，但尚未完成恢复核验。请重新导入迁移前备份进行核验；系统不会重复导入已有记录。
          </div>
        </div>
      )}

      {!recordsLoaded && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-paper-ink/55">
          正在加载练习记录...
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <SerifButton type="button" variant="outline" className="text-xs flex items-center gap-1" onClick={handleExport}>
          <Download className="w-3 h-3" /> 导出完整备份（含 IndexedDB）
        </SerifButton>
        <SerifButton type="button" variant="outline" className="text-xs flex items-center gap-1" onClick={handleImport}>
          <Upload className="w-3 h-3" /> 导入备份
        </SerifButton>
        {repoReady && canReleaseLegacyStorage() ? (
          <SerifButton
            type="button"
            variant="outline"
            className="text-xs flex items-center gap-1 border-amber-600/30 text-amber-800 hover:bg-amber-50"
            onClick={handleReleaseStorage}
          >
            <Trash2 className="w-3 h-3" /> 释放旧版存储空间
          </SerifButton>
        ) : repoReady && legacyTotal > 0 && !recoveryMeta ? (
          <div className="text-xs text-amber-700 leading-5">
            请重新导入迁移前备份以核验旧版会话档案，再导出完整备份后方可释放旧版存储空间。
          </div>
        ) : repoReady && recoveryMeta ? (
          <div className="text-xs text-amber-700 leading-5">
            旧版会话已从备份恢复。请重新导出完整备份，完成核验后再释放旧版存储空间。
          </div>
        ) : null}
      </div>

      {importReport && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-bold text-blue-800 mb-1 flex items-center justify-between">
            导入报告
            <SerifButton type="button" variant="outline" className="text-xs" onClick={() => setImportReport(null)}>关闭</SerifButton>
          </div>
          <div className="text-xs text-blue-700 leading-5">
            已导入 {importReport.practiceRecordsImported} 条记录 · 跳过 {importReport.practiceRecordsSkipped} 条（ID 冲突）
            <br />已存档 {importReport.legacySessionsArchived} 条会话 · 跳过 {importReport.legacySessionsSkipped} 条
            {importReport.legacySessionsVerifiedExisting > 0 && (
              <span> · 已核验 {importReport.legacySessionsVerifiedExisting} 条已存在记录</span>
            )}
            {importReport.legacyExpectedKeysTotal > 0 && (
              <span> · 密钥验证: {importReport.legacyExpectedKeysVerified}/{importReport.legacyExpectedKeysTotal}</span>
            )}
            {importReport.activeStatesImported > 0 && ` · ${importReport.activeStatesImported} 个活跃状态`}
            {importReport.errors.length > 0 && (
              <div className="mt-1 text-red-600">{importReport.errors.length} 个错误</div>
            )}
          </div>
        </div>
      )}

      {legacySessions.length > 0 && (
        <div className="mb-6">
          <button
            type="button"
            className="text-sm font-serif text-paper-ink/50 hover:text-paper-ink/70 flex items-center gap-1"
            onClick={() => { setShowLegacyArchive(!showLegacyArchive); if (!showLegacyArchive) loadLegacyPage(0); }}
          >
            <Archive className="w-3.5 h-3.5" /> 旧版会话档案 ({legacyTotal || legacySessions.length} 总计)
          </button>
          {showLegacyArchive && (
            <PaperCard className="mt-2 p-3 max-h-96 overflow-y-auto">
              <div className="text-xs text-paper-ink/40 mb-2">
                这些是旧版会话存档，不会计入当前练习统计。共 {legacyTotal} 条。
              </div>
              {renderLegacySessionDetail()}
              {legacySessions.map(session => {
                const isSelected = legacyDetail?.archiveKey === session.archiveKey;
                return (
                  <div key={session.archiveKey} className={isSelected ? 'bg-blue-50/50 -mx-1 px-1 rounded' : ''}>
                    {renderLegacySessionItem(session)}
                  </div>
                );
              })}
              {legacyTotal > (legacyOffset + LEGACY_PAGE_SIZE) && (
                <div className="mt-2 text-center">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs"
                    onClick={() => loadLegacyPage(legacyOffset + LEGACY_PAGE_SIZE)}
                  >
                    加载更多 ({legacyOffset + LEGACY_PAGE_SIZE}/{legacyTotal})
                  </SerifButton>
                </div>
              )}
            </PaperCard>
          )}
        </div>
      )}

      {importPreview && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-bold text-blue-800 mb-2">导入预览</div>
          <div className="text-xs text-blue-700 leading-5 mb-3">
            备份类型: {importPreview.backupType}{importPreview.formatVersion ? ` (v${importPreview.formatVersion})` : ''}
            <br />
            练习记录: {importPreview.canonicalRecordsFound} 条（{importPreview.existingCanonicalCollisions} 条ID冲突将跳过）
            <br />
            旧版会话: {importPreview.legacySessionsFound} 条（{importPreview.existingLegacyCollisions} 条重复将跳过）
            <br />
            活跃状态: {importPreview.activeStatesFound} 条
            {importPreview.willOverwriteActiveStates && (
              <span className="text-amber-700 font-bold"> — 将覆盖现有活跃状态 ({importPreview.existingActiveStates.join(', ') || '无'})</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <SerifButton
              type="button"
              variant="outline"
              className="text-xs bg-green-100 border-green-300 hover:bg-green-200"
              onClick={() => confirmImport(false)}
            >
              确认导入（保留现有活跃状态）
            </SerifButton>
            {importPreview.willOverwriteActiveStates && (
              <SerifButton
                type="button"
                variant="outline"
                className="text-xs bg-amber-100 border-amber-300 hover:bg-amber-200"
                onClick={() => confirmImport(true)}
              >
                确认导入（覆盖活跃状态）
              </SerifButton>
            )}
            <SerifButton type="button" variant="outline" className="text-xs" onClick={cancelImport}>
              取消
            </SerifButton>
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-8">
        <section>
          <h2 className="text-xl font-serif mb-4">Speaking Attempts</h2>
          <div className="space-y-4">
            {speakingAttempts.length === 0 ? (
              <PaperCard className="text-sm text-paper-ink/55">No saved attempts yet.</PaperCard>
            ) : speakingAttempts.map(record => (
              <PaperCard key={record.id} className="hover:border-accent-terracotta/25 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                      {speakingHistoryMeta(record)}
                    </div>
                    <h3 className="text-lg leading-snug">{speakingHistoryTitle(record)}</h3>
                  </div>
                  <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                    {formatTimestamp(getTimestamp(record))}
                  </div>
                </div>
                <p className="text-sm text-paper-ink/65 mb-4 leading-7">
                  {speakingHistoryPreview(record)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => openSpeakingAttempt(record)}
                  >
                    Open / Restore <ArrowRight className="w-3 h-3" />
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => setReadOnlyRecord(record)}
                  >
                    <Eye className="w-3 h-3" /> 查看结果
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs border-red-800/30 text-red-800 hover:bg-red-50"
                    onClick={() => deleteSpeakingAttempt(record)}
                  >
                    Delete
                  </SerifButton>
                </div>
              </PaperCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-serif mb-4">Writing Task 1 Attempts</h2>
          <div className="space-y-4">
            {writingTask1Attempts.length === 0 ? (
              <PaperCard className="text-sm text-paper-ink/55">No saved attempts yet.</PaperCard>
            ) : writingTask1Attempts.map(record => (
              <PaperCard key={record.id} className="hover:border-accent-terracotta/25 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                      {record.taskType} / {record.status}
                    </div>
                    <h3 className="text-lg leading-snug">{preview(record.instruction, 'Saved Writing Task 1 prompt')}</h3>
                  </div>
                  <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                    {formatTimestamp(getTimestamp(record))}
                  </div>
                </div>
                <p className="text-sm text-paper-ink/65 mb-4 leading-7">
                  {getWritingTask1Preview(record)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => openWritingTask1Attempt(record)}
                  >
                    Open / Restore <ArrowRight className="w-3 h-3" />
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => setReadOnlyRecord(record)}
                  >
                    <Eye className="w-3 h-3" /> 查看结果
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs border-red-800/30 text-red-800 hover:bg-red-50"
                    onClick={() => deleteWritingTask1Attempt(record)}
                  >
                    Delete
                  </SerifButton>
                </div>
              </PaperCard>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-serif mb-4">Writing Task 2 Attempts</h2>
          <div className="space-y-4">
            {writingAttempts.length === 0 ? (
              <PaperCard className="text-sm text-paper-ink/55">No saved attempts yet.</PaperCard>
            ) : writingAttempts.map(record => (
              <PaperCard key={record.id} className="hover:border-accent-terracotta/25 transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">
                      Task 2 / {record.status}
                    </div>
                    <h3 className="text-lg leading-snug">{preview(record.question, 'Saved Writing Task 2 prompt')}</h3>
                  </div>
                  <div className="text-xs text-paper-ink/40 font-sans whitespace-nowrap">
                    {formatTimestamp(getTimestamp(record))}
                  </div>
                </div>
                <p className="text-sm text-paper-ink/65 mb-4 leading-7">
                  {getWritingPreview(record)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => openWritingAttempt(record)}
                  >
                    Open / Restore <ArrowRight className="w-3 h-3" />
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs flex items-center gap-2"
                    onClick={() => setReadOnlyRecord(record)}
                  >
                    <Eye className="w-3 h-3" /> 查看结果
                  </SerifButton>
                  <SerifButton
                    type="button"
                    variant="outline"
                    className="text-xs border-red-800/30 text-red-800 hover:bg-red-50"
                    onClick={() => deleteWritingAttempt(record)}
                  >
                    Delete
                  </SerifButton>
                </div>
              </PaperCard>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}
