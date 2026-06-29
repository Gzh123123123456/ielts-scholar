import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { Task1VisualRenderer } from '@/src/components/writing/Task1VisualRenderer';
import { writingTask1Academic, WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import { routedAnalyzeWritingTask1 } from '@/src/lib/ai';
import { useApp } from '@/src/context/AppContext';
import { ProviderDiagnostic, WritingTask1Feedback } from '@/src/lib/ai/schemas';
import { formatConservativeBandEstimate, getTargetLabelZh } from '@/src/lib/bands';
import { resolveTask1TargetState } from '@/src/lib/scoreLayer';
import {
  createRecordId,
  StorageWriteResult,
  summarizeDiagnostic,
  WritingTask1PracticeRecord,
  WritingTask1QuickPlan,
} from '@/src/lib/practiceRecords';
import {
  getActiveWritingTask1,
  getPracticeRecord,
  saveActiveWritingTask1,
  upsertPracticeRecord,
  deleteActiveWritingTask1,
} from '@/src/lib/practiceRepository';
import {
  buildMarkdownExportFilename,
  buildWritingTask1TrainingMarkdown,
} from '@/src/lib/markdownExport';
import {
  buildWritingTask1EvidenceLedger,
  summarizeEvidenceLedger,
} from '@/src/lib/evidenceLedger';
import {
  evaluateTask1SubmissionQuality,
  findLikelyTask1PromptMismatch,
  routeTask1FeedbackLevel,
  Task1SubmissionQuality,
} from '@/src/lib/writingTask1SubmissionQuality';
import {
  buildTask1FeedbackDisplayModel,
  Task1CoverageStatus,
  Task1FeedbackDisplayModel,
} from '@/src/lib/writingTask1DisplayModel';
import {
  validateTask1AnalysisForRender,
  validateTask1TargetReportForDisplay,
  Task1AnalysisRenderState,
  Task1TargetReportValidation,
} from '@/src/lib/writingTask1AnalysisState';

const emptyPlan: WritingTask1QuickPlan = {
  overview: '',
  keyFeatures: '',
  comparisons: '',
  paragraphPlan: '',
};

const writingTask1TaskTypes: WritingTask1AcademicPrompt['taskType'][] = [
  'line graph',
  'bar chart',
  'table',
  'pie chart',
  'mixed chart',
  'process',
  'map',
];

const promptFromSavedTask1Record = (record: WritingTask1PracticeRecord): WritingTask1AcademicPrompt => {
  const taskType = writingTask1TaskTypes.includes(record.taskType as WritingTask1AcademicPrompt['taskType'])
    ? record.taskType as WritingTask1AcademicPrompt['taskType']
    : 'line graph';
  return {
    id: record.questionId || record.id,
    taskType,
    topic: record.topic || 'Saved Task 1',
    tags: [],
    instruction: record.instruction || record.question,
    visualBrief: record.visualBrief || '',
    data: record.dataSummary || [],
    expectedOverview: record.quickPlan?.overview || '',
    expectedKeyFeatures: record.quickPlan?.keyFeatures ? [record.quickPlan.keyFeatures] : [],
    expectedComparisons: record.quickPlan?.comparisons ? [record.quickPlan.comparisons] : [],
    commonTraps: [],
    reusablePatterns: [],
  };
};

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const buildTask1SourceText = (prompt: WritingTask1AcademicPrompt) =>
  [prompt.instruction, prompt.visualBrief, ...prompt.data].join(' ');

const promptMatchCandidate = (prompt: WritingTask1AcademicPrompt) => ({
  id: prompt.id,
  taskType: prompt.taskType,
  topic: prompt.topic,
  sourceText: buildTask1SourceText(prompt),
});

const buildTask1DataSummary = (prompt: WritingTask1AcademicPrompt) =>
  [
    ...prompt.data,
    prompt.visualSpec ? `Structured visual data: ${JSON.stringify(prompt.visualSpec)}` : '',
  ].filter(Boolean).join('\n');

const taskTypeGuide = (taskType: WritingTask1AcademicPrompt['taskType']) => {
  if (taskType === 'process') {
    return [
      'Identify the start point, end point, and number of stages.',
      'Group the middle stages instead of listing every action separately.',
      'Use passive forms where natural: is collected, is sorted, is melted.',
    ];
  }
  if (taskType === 'map') {
    return [
      'Compare before and after: added, removed, expanded, replaced, or relocated.',
      'Use location language: north, south-east, central area, around the site.',
      'Avoid trend language such as rose or fell unless the map includes numbers.',
    ];
  }
  if (taskType === 'pie chart') {
    return [
      'Look for the largest share, the smallest share, and any change in ranking.',
      'Use proportions carefully: share, accounted for, percentage points.',
      'Group rising slices and falling slices where there are two pie charts.',
    ];
  }
  if (taskType === 'mixed chart') {
    return [
      'Find the shared story across both visuals before writing details.',
      'Use one body paragraph for the main trend and one for supporting comparison.',
      'Do not describe the two visuals as unrelated lists.',
    ];
  }
  return [
    'Find the overall pattern before choosing details.',
    'Select the highest, lowest, biggest change, exception, or rank change.',
    'Group details by trend or category instead of describing every number in order.',
  ];
};

const pickPrompt = (excludeId?: string) => {
  const candidates = writingTask1Academic.filter(prompt => prompt.id !== excludeId);
  const bank = candidates.length ? candidates : writingTask1Academic;
  return bank[Math.floor(Math.random() * bank.length)];
};

const feedbackItems = (feedback: WritingTask1Feedback) => [
  ['概览问题 / Overview', feedback.overviewFeedback],
  ['关键信息 / Key Features', feedback.keyFeaturesFeedback],
  ['比较关系 / Comparisons', feedback.comparisonFeedback],
  ['数据准确性 / Data Accuracy', feedback.dataAccuracyFeedback],
  ['结构连贯 / Coherence', feedback.coherenceFeedback],
];

const hasPlanContent = (plan: WritingTask1QuickPlan) =>
  Object.values(plan).some(value => value.trim());

const hasCjk = (text: string) => /[\u3400-\u9fff]/.test(text);

const readableText = (text: string | undefined, fallback: string) => {
  const normalized = (text || '').replace(/\s+/g, ' ').trim();
  if (!normalized || /Provider feedback was incomplete|normalized safely|incomplete feedback|锛|銆|€|绛|閲|鏍|姒|鍏|琛|涓/i.test(normalized)) {
    return fallback;
  }
  return normalized;
};

const chineseFirst = (text: string | undefined, fallback: string) => {
  const normalized = readableText(text, fallback);
  return hasCjk(normalized) ? normalized : `${fallback} 原始反馈：${normalized}`;
};

const task1DiagnosisItems = (feedback: WritingTask1Feedback) => [
  {
    label: '总览 / Overview',
    text: feedback.overviewFeedback,
    fallback: '检查是否有清楚的 overview：用一句话概括全图的主要趋势、最高/最低项或流程结果，不要只重复某个数据点。',
  },
  {
    label: '关键信息 / Key Features',
    text: feedback.keyFeaturesFeedback,
    fallback: '优先选择最重要的数据：最大变化、最高/最低值、主要阶段或最明显差异，避免逐项流水账。',
  },
  {
    label: '比较关系 / Comparisons',
    text: feedback.comparisonFeedback,
    fallback: '需要把数据放在一起比较，例如 higher than, whereas, in contrast，并说明差异为什么重要。',
  },
  {
    label: '数据准确性 / Data Accuracy',
    text: feedback.dataAccuracyFeedback,
    fallback: '核对数字、单位、排名和时间点是否与题目一致；Task 1 的分数很依赖准确引用数据。',
  },
  {
    label: '结构连贯 / Coherence',
    text: feedback.coherenceFeedback,
    fallback: '建议保持 introduction、overview、主体段 1、主体段 2 的清晰结构，并按趋势、类别或阶段分组。',
  },
];

const bulletList = (items: string[], empty: string) =>
  items.length ? items.map(item => `- ${item}`).join('\n') : `- ${empty}`;

const getRewriteActions = (feedback: WritingTask1Feedback): string[] => {
  const providerActions = feedback.rewriteTask
    .split(/\r?\n/)
    .map(item => item.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  const actions = providerActions.length > 1
    ? providerActions
    : [
      '重写 overview：用一句话概括全图最大趋势、最高/最低项或流程终点。',
      '重组主体段：按趋势、大小、阶段或类别分组，不要逐项流水账。',
      '补充比较：加入 higher than, whereas, in contrast 等表达说明关键差异。',
      '核对数据：检查每个数字、单位和排名是否与题目视觉信息一致。',
    ];

  return Array.from(new Set(actions));
};

const task1HasRequiredFixes = (feedback: WritingTask1Feedback) =>
  feedback.mustFix.some(item => item.trim());

const getTask1TargetHeading = (feedback: WritingTask1Feedback) => {
  const state = feedback.targetState || resolveTask1TargetState(feedback);
  if (state === 'high_band_stable') return 'Examiner-Friendly Version';
  if (state === 'needs_repair' || state === 'target_failed_or_borderline') return 'Optimized Report Hidden';
  return 'Optimized Report';
};

const getTask1TargetNote = (feedback: WritingTask1Feedback) => {
  const state = feedback.targetState || resolveTask1TargetState(feedback);
  if (state === 'needs_repair' || state === 'target_failed_or_borderline') {
    return 'Hidden until the report passes the required-fix check.';
  }
  if (state === 'high_band_stable') {
    return 'A concise reference version for comparison, not a new band claim.';
  }
  return 'AI-optimized version after diagnosis; expand only after reviewing your own fixes.';
};

const task1RewriteActions = (feedback: WritingTask1Feedback): string[] =>
  getRewriteActions(feedback).map((item, index) => chineseFirst(
    item,
    [
      '重写 overview：用一句话概括全图主要趋势或最突出差异。',
      '重组主体段：按趋势、大小、阶段或类别分组，不要逐项罗列。',
      '补充比较：加入 higher than, whereas, in contrast 等比较表达。',
      '核对数据：检查数字、单位、排名和时间点是否准确。',
    ][index] || '把这一项改成具体、可执行的 Task 1 修改动作。',
  ));

const buildTask1Markdown = (
  prompt: WritingTask1AcademicPrompt,
  quickPlan: WritingTask1QuickPlan,
  feedback: WritingTask1Feedback,
) => {
  const date = new Date().toLocaleString();
  const task1TargetHeading = getTask1TargetHeading(feedback);
  const task1TargetNote = (feedback.targetState || resolveTask1TargetState(feedback)) === 'generated_target'
    ? 'generated, not independently validated'
    : getTargetLabelZh(feedback.estimatedBand, 'report');
  const languageCorrections = feedback.languageCorrections.length
    ? feedback.languageCorrections
        .map(item => `- Original: ${item.original}\n  - Correction: ${item.correction}\n  - 说明: ${item.explanation}`)
        .join('\n')
    : '- No focused language correction returned.';
  const plan = hasPlanContent(quickPlan)
    ? [
      quickPlan.overview && `- Overview: ${quickPlan.overview}`,
      quickPlan.keyFeatures && `- Key features: ${quickPlan.keyFeatures}`,
      quickPlan.comparisons && `- Comparisons: ${quickPlan.comparisons}`,
      quickPlan.paragraphPlan && `- Paragraph plan: ${quickPlan.paragraphPlan}`,
    ].filter(Boolean).join('\n')
    : '- No quick plan written.';

  return `# IELTS Writing Task 1 Practice Note

## Metadata
- Date: ${date}
- Module: Writing Task 1 Academic
- Task type: ${prompt.taskType}
- Topic: ${prompt.topic}
- Training Estimate: ${formatConservativeBandEstimate(feedback.estimatedBand)}
- Target Layer: ${task1TargetHeading} / ${task1TargetNote}

## Task Instruction
${feedback.instruction}

## Visual Information
${feedback.visualBrief}

${bulletList(prompt.data, 'No visual data stored.')}

## Quick Plan
${plan}

## My Report
${feedback.report}

## Chinese Diagnosis
- 概览问题: ${feedback.overviewFeedback}
- 关键信息: ${feedback.keyFeaturesFeedback}
- 比较关系: ${feedback.comparisonFeedback}
- 数据准确性: ${feedback.dataAccuracyFeedback}
- 结构连贯: ${feedback.coherenceFeedback}

## English Corrections / Examples
${languageCorrections}

## Must Fix
${bulletList(feedback.mustFix, 'No critical Task 1 issue returned.')}

## Rewrite Task
${bulletList(getRewriteActions(feedback), 'Rewrite with a clearer overview and grouped details.')}

## Reusable Report Patterns
${bulletList(feedback.reusableReportPatterns, 'No reusable pattern returned.')}

## ${task1TargetHeading}
${feedback.improvedReport || feedback.modelExcerpt || 'No improved report returned.'}
`;
};

export default function WritingTask1Placeholder() {
  const { addDebugLog, setProviderDiagnostic } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as {
    selectedWritingTask1PromptId?: string;
    restoreWritingTask1RecordId?: string;
  } | null;
  const selectedWritingTask1PromptId = routeState?.selectedWritingTask1PromptId;
  const restoreWritingTask1RecordId = routeState?.restoreWritingTask1RecordId;
  const selectedPrompt = selectedWritingTask1PromptId
    ? writingTask1Academic.find(item => item.id === selectedWritingTask1PromptId)
    : undefined;
  const [activeRecord, setActiveRecord] = useState<any>(null);
  const [activeLoaded, setActiveLoaded] = useState(false);
  const initialActiveRecordRef = useRef<any>(null);
  const isInitialRestoreRef = useRef(false);
  const lastTask1EvidenceLedgerLogRef = useRef('');
  const initialPrompt = selectedPrompt || writingTask1Academic[0];

  useEffect(() => {
    if (selectedPrompt) { setActiveLoaded(true); return; }
    let cancelled = false;
    (async () => {
      try {
        let record = await getActiveWritingTask1();
        if (restoreWritingTask1RecordId) {
          const restoredRecord = await getPracticeRecord(restoreWritingTask1RecordId);
          if (restoredRecord?.module === 'writing_task1') {
            record = restoredRecord;
          }
        }
        if (cancelled) return;
        if (record) {
          setActiveRecord(record);
          initialActiveRecordRef.current = record;
          isInitialRestoreRef.current = true;
        }
        setActiveLoaded(true);
      } catch {
        if (!cancelled) setActiveLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [restoreWritingTask1RecordId, selectedPrompt]);

  const [recordId, setRecordId] = useState(selectedPrompt ? createRecordId('writing_task1') : '');
  const [createdAt, setCreatedAt] = useState(selectedPrompt ? new Date().toISOString() : '');
  const [prompt, setPrompt] = useState<WritingTask1AcademicPrompt>(initialPrompt);
  const [quickPlan, setQuickPlan] = useState<WritingTask1QuickPlan>(emptyPlan);
  const [report, setReport] = useState('');
  const [feedback, setFeedback] = useState<WritingTask1Feedback | undefined>(undefined);
  const [feedbackPromptId, setFeedbackPromptId] = useState<string | undefined>(undefined);
  const [diagnostic, setDiagnostic] = useState<ProviderDiagnostic | null>(null);
  const [qualityGateSubmitted, setQualityGateSubmitted] = useState(false);

  useEffect(() => {
    if (!activeRecord) return;
    setRecordId(activeRecord.id || createRecordId('writing_task1'));
    setCreatedAt(activeRecord.createdAt || new Date().toISOString());
    setQuickPlan(activeRecord.quickPlan || emptyPlan);
    setReport(activeRecord.report || '');
    setFeedback(activeRecord.feedback);
    setFeedbackPromptId(activeRecord.feedback ? activeRecord.questionId : undefined);
    const matchedPrompt = writingTask1Academic.find(p => p.id === activeRecord.questionId);
    setPrompt(matchedPrompt || promptFromSavedTask1Record(activeRecord));
  }, [activeRecord]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [providerErrorMessage, setProviderErrorMessage] = useState(
    !selectedPrompt && activeRecord?.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later. Your report is preserved.' : '',
  );
  const [apiStatusMessage, setApiStatusMessage] = useState('');
  const [storageFullWarning, setStorageFullWarning] = useState('');

  const words = countWords(report);
  const task1SourceText = useMemo(() => buildTask1SourceText(prompt), [prompt]);
  const submissionQuality = useMemo(
    () => evaluateTask1SubmissionQuality(report, task1SourceText),
    [report, task1SourceText],
  );
  const promptMismatch = useMemo(
    () => report.trim()
      ? findLikelyTask1PromptMismatch(
        report,
        promptMatchCandidate(prompt),
        writingTask1Academic.map(promptMatchCandidate),
      )
      : null,
    [report, prompt],
  );
  const analysisState = useMemo(
    () => validateTask1AnalysisForRender({
      currentPrompt: prompt,
      feedback,
      feedbackPromptId,
      promptBank: writingTask1Academic,
    }),
    [feedback, feedbackPromptId, prompt],
  );
  const canRenderFullFeedback = Boolean(feedback && analysisState.kind === 'success');
  const targetReportValidation = useMemo(
    () => canRenderFullFeedback && feedback
      ? validateTask1TargetReportForDisplay({ currentPrompt: prompt, feedback })
      : undefined,
    [canRenderFullFeedback, feedback, prompt],
  );
  const status = providerErrorMessage
    ? 'provider_failed'
    : feedback
      ? canRenderFullFeedback ? 'analyzed' : 'analysis_incomplete'
      : 'draft';
  const feedbackRoute = useMemo(
    () => canRenderFullFeedback && feedback ? routeTask1FeedbackLevel(feedback.estimatedBand, submissionQuality) : submissionQuality.route,
    [canRenderFullFeedback, feedback, submissionQuality],
  );
  const task1DisplayModel = useMemo(
    () => canRenderFullFeedback && feedback
      ? buildTask1FeedbackDisplayModel({ prompt, feedback, route: feedbackRoute })
      : undefined,
    [canRenderFullFeedback, feedback, feedbackRoute, prompt],
  );
  const currentMarkdown = canRenderFullFeedback && feedback ? buildWritingTask1TrainingMarkdown(feedback, prompt, quickPlan) : '';
  const task1EvidenceLedger = useMemo(
    () => canRenderFullFeedback && feedback ? buildWritingTask1EvidenceLedger(feedback) : [],
    [canRenderFullFeedback, feedback],
  );
  const task1EvidenceSummary = useMemo(
    () => summarizeEvidenceLedger(task1EvidenceLedger),
    [task1EvidenceLedger],
  );

  useEffect(() => {
    if (!feedback || !task1EvidenceSummary.total) return;
    const signature = [
      recordId,
      feedback.report.length,
      task1EvidenceSummary.total,
      task1EvidenceSummary.anchored,
      task1EvidenceSummary.missingDisplayRequired,
    ].join('::');
    if (lastTask1EvidenceLedgerLogRef.current === signature) return;
    lastTask1EvidenceLedgerLogRef.current = signature;
    addDebugLog(
      `Task 1 evidence ledger: ${task1EvidenceSummary.anchored}/${task1EvidenceSummary.total} anchored; ${task1EvidenceSummary.missingDisplayRequired} required missing.`,
    );
  }, [addDebugLog, feedback, recordId, task1EvidenceSummary]);

  const buildRecord = (
    nextFeedback = feedback,
    statusOverride?: WritingTask1PracticeRecord['status'],
  ): WritingTask1PracticeRecord => {
    const now = new Date().toISOString();
    const nextStatus = statusOverride || (nextFeedback ? 'analyzed' : 'draft');
    return {
      id: recordId,
      module: 'writing_task1',
      mode: 'practice',
      status: nextStatus,
      task: 'task1',
      question: prompt.instruction,
      questionId: prompt.id,
      topic: prompt.topic,
      tags: prompt.tags,
      taskType: prompt.taskType,
      prompt: prompt.instruction,
      createdAt,
      updatedAt: now,
      analyzedAt: nextStatus === 'analyzed' ? now : undefined,
      questionData: prompt,
      instruction: prompt.instruction,
      visualBrief: prompt.visualBrief,
      dataSummary: prompt.data,
      quickPlan,
      report,
      feedback: nextStatus === 'provider_failed' ? undefined : nextFeedback,
      providerDiagnostic: diagnostic ? summarizeDiagnostic(diagnostic) : initialActiveRecordRef.current?.providerDiagnostic,
      obsidianMarkdown: nextStatus === 'provider_failed'
        ? undefined
        : nextFeedback
          ? buildWritingTask1TrainingMarkdown(nextFeedback, prompt, quickPlan)
          : initialActiveRecordRef.current?.obsidianMarkdown,
    };
  };

  useEffect(() => {
    if (selectedWritingTask1PromptId) {
      navigate('/writing/task1', { replace: true, state: null });
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (isInitialRestoreRef.current) {
        isInitialRestoreRef.current = false;
        return;
      }
      const record = feedback && analysisState.kind !== 'success'
        ? buildRecord(undefined, 'provider_failed')
        : buildRecord();
      const [activeResult, upsertResult] = await Promise.all([
        saveActiveWritingTask1(record),
        record.status !== 'draft' ? upsertPracticeRecord(record) : Promise.resolve({ ok: true }),
      ]);
      if (!activeResult.ok || !upsertResult.ok) {
        setStorageFullWarning('本地存储空间已满，当前写作状态未能保存。请先导出数据备份，修复存储前建议暂停新练习。');
      }
    })();
  }, [recordId, createdAt, prompt, quickPlan, report, feedback, providerErrorMessage, analysisState]);

  const updatePlan = (field: keyof WritingTask1QuickPlan, value: string) => {
    setQuickPlan(current => ({ ...current, [field]: value }));
  };

  const loadNewPrompt = () => {
    const nextPrompt = pickPrompt(prompt.id);
    setRecordId(createRecordId('writing_task1'));
    setCreatedAt(new Date().toISOString());
    setPrompt(nextPrompt);
    setQuickPlan(emptyPlan);
    setReport('');
    setFeedback(undefined);
    setFeedbackPromptId(undefined);
    setDiagnostic(null);
    setQualityGateSubmitted(false);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    initialActiveRecordRef.current = null;
  };

  const analyzeReport = async () => {
    if (!report.trim()) return;
    if (promptMismatch) {
      setQualityGateSubmitted(true);
      setFeedback(undefined);
      setFeedbackPromptId(undefined);
      return;
    }
    if (submissionQuality.kind === 'not_analyzable') {
      setQualityGateSubmitted(true);
      setFeedback(undefined);
      setFeedbackPromptId(undefined);
      return;
    }
    setQualityGateSubmitted(false);
    setIsAnalyzing(true);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    try {
      const result = await routedAnalyzeWritingTask1({
        task: 'task1',
        taskType: prompt.taskType,
        instruction: prompt.instruction,
        visualBrief: prompt.visualBrief,
        dataSummary: buildTask1DataSummary(prompt),
        report,
        expectedOverview: prompt.expectedOverview,
        expectedKeyFeatures: prompt.expectedKeyFeatures,
        expectedComparisons: prompt.expectedComparisons,
        commonTraps: prompt.commonTraps,
        reusablePatterns: prompt.reusablePatterns,
      }, words < 80 || submissionQuality.route === 'rescue');
      setApiStatusMessage(result.route.fallbackReason || result.route.learnerReason);
      setProviderDiagnostic(result.diagnostic);
      if (result.diagnostic.failureKind === 'provider_unavailable') {
        setDiagnostic(result.diagnostic);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your report is preserved.');
        const failedRecord = buildRecord(undefined, 'provider_failed');
        const [failedUpsertResult, failedActiveResult] = await Promise.all([
          upsertPracticeRecord({
            ...failedRecord,
            providerDiagnostic: summarizeDiagnostic(result.diagnostic),
          }),
          saveActiveWritingTask1({
            ...failedRecord,
            providerDiagnostic: summarizeDiagnostic(result.diagnostic),
          }),
        ]);
        if (!failedUpsertResult.ok || !failedActiveResult.ok) {
          setStorageFullWarning('本地存储空间已满，当前状态未能保存。请先导出数据备份，修复存储前建议暂停新练习。');
        }
        return;
      }
      const nextAnalysisState = validateTask1AnalysisForRender({
        currentPrompt: prompt,
        feedback: result.feedback,
        feedbackPromptId: prompt.id,
        promptBank: writingTask1Academic,
      });
      setFeedback(result.feedback);
      setFeedbackPromptId(prompt.id);
      setDiagnostic(result.diagnostic);
      const shouldPersistFeedback = nextAnalysisState.kind === 'success';
      const analyzedRecord = buildRecord(
        shouldPersistFeedback ? result.feedback : undefined,
        shouldPersistFeedback ? undefined : 'provider_failed',
      );
      const [analyzedUpsertResult, analyzedActiveResult] = await Promise.all([
        upsertPracticeRecord({
          ...analyzedRecord,
          providerDiagnostic: summarizeDiagnostic(result.diagnostic),
          obsidianMarkdown: shouldPersistFeedback
            ? buildWritingTask1TrainingMarkdown(result.feedback, prompt, quickPlan)
            : undefined,
        }),
        saveActiveWritingTask1({
          ...analyzedRecord,
          providerDiagnostic: summarizeDiagnostic(result.diagnostic),
          obsidianMarkdown: shouldPersistFeedback
            ? buildWritingTask1TrainingMarkdown(result.feedback, prompt, quickPlan)
            : undefined,
        }),
      ]);
      if (!analyzedUpsertResult.ok || !analyzedActiveResult.ok) {
        setStorageFullWarning('本地存储空间已满，分析结果未能保存。请先导出数据备份，修复存储前建议暂停新练习。');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportMarkdown = () => {
    if (!currentMarkdown) return;
    const blob = new Blob([currentMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildMarkdownExportFilename({
      module: 'writing',
      taskOrPart: 'task1',
      topic: prompt.topic || prompt.taskType,
      prompt: feedback?.instruction || prompt.instruction,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const rewriteThisTask = () => {
    setRecordId(createRecordId('writing_task1'));
    setCreatedAt(new Date().toISOString());
    setQuickPlan(emptyPlan);
    setReport('');
    setFeedback(undefined);
    setFeedbackPromptId(undefined);
    setDiagnostic(null);
    setQualityGateSubmitted(false);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    initialActiveRecordRef.current = null;
  };

  const returnToReport = () => {
    setFeedback(undefined);
    setFeedbackPromptId(undefined);
    setDiagnostic(null);
    setApiStatusMessage('');
  };

  const switchToSuggestedPrompt = () => {
    if (!promptMismatch) return;
    const nextPrompt = writingTask1Academic.find(item => item.id === promptMismatch.suggestedPrompt.id);
    if (!nextPrompt) return;
    setRecordId(createRecordId('writing_task1'));
    setCreatedAt(new Date().toISOString());
    setPrompt(nextPrompt);
    setQuickPlan(emptyPlan);
    setFeedback(undefined);
    setFeedbackPromptId(undefined);
    setDiagnostic(null);
    setQualityGateSubmitted(false);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    initialActiveRecordRef.current = null;
  };

  return (
    <PageShell size="wide">
      <TopBar />

      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-sans font-bold uppercase tracking-widest text-accent-terracotta mb-2">
          Academic Writing Task 1
        </p>
        <h2 className="text-3xl mb-2">Describe the Visual Brief</h2>
      </div>

      {providerErrorMessage && (
        <div className="mb-6 p-3 border border-accent-terracotta/20 bg-accent-terracotta/5 text-sm text-paper-ink/70">
          {providerErrorMessage}
        </div>
      )}
      {apiStatusMessage && (
        <div className="mb-6 p-3 bg-paper-ink/5 border border-paper-ink/10 text-paper-ink/65 text-sm rounded-sm font-sans">
          {apiStatusMessage}
        </div>
      )}
      {storageFullWarning && (
        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-sm font-sans">
          {storageFullWarning}
        </div>
      )}

      {!feedback && (
      <div className="grid xl:grid-cols-[1.15fr_0.85fr] gap-8 items-start">
        <div className="space-y-6">
          <PaperCard>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/40">
                {prompt.taskType}
              </span>
              <span className="text-[10px] font-sans uppercase tracking-widest text-accent-terracotta">
                {prompt.topic}
              </span>
              <span className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/35">
                {status}
              </span>
            </div>
            <h3 className="text-xl leading-8 mb-4">{prompt.instruction}</h3>
            <p className="text-sm leading-7 text-paper-ink/70 border-t border-paper-ink/10 pt-4">
              {prompt.visualBrief}
            </p>
          </PaperCard>

          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Visual Data</h3>
            <Task1VisualRenderer spec={prompt.visualSpec} fallbackData={prompt.data} />
          </PaperCard>

          <Task1GuidedCoach prompt={prompt} />
        </div>

        <div className="space-y-6">
          <PaperCard>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="text-sm font-bold uppercase tracking-widest">My Report</h3>
              <span className="text-xs font-sans text-paper-ink/45">{words} words</span>
            </div>
            <textarea
              value={report}
              onChange={event => {
                setReport(event.target.value);
                setFeedback(undefined);
                setFeedbackPromptId(undefined);
                setQualityGateSubmitted(false);
              }}
              placeholder="Write at least 150 words. Start with a paraphrase, add one clear overview, then group key details with accurate data."
              className="w-full min-h-[320px] bg-transparent border border-paper-ink/15 p-4 text-base leading-8 resize-y focus:outline-none focus:border-accent-terracotta/70"
            />
            {report.trim() && words < 150 && (
              <p className="text-xs text-paper-ink/55 mt-3">
                Task 1 reports are expected to be at least 150 words.
              </p>
            )}
            {report.trim() && promptMismatch && (
              <TaskMismatchPanel
                mismatch={promptMismatch}
                onSwitch={switchToSuggestedPrompt}
              />
            )}
            {report.trim() && !promptMismatch && (qualityGateSubmitted || submissionQuality.kind === 'weak_analyzable') && (
              <SubmissionQualityPanel quality={submissionQuality} />
            )}
            <div className="flex flex-wrap gap-3 mt-5">
              <SerifButton onClick={analyzeReport} disabled={isAnalyzing || !report.trim()}>
                {isAnalyzing
                  ? 'Analyzing...'
                  : promptMismatch
                    ? 'Check Task Match'
                    : submissionQuality.kind === 'not_analyzable'
                      ? 'Check Readiness'
                      : 'Submit for Feedback'}
              </SerifButton>
              <SerifButton onClick={loadNewPrompt} variant="outline" disabled={isAnalyzing}>
                Change Task
              </SerifButton>
            </div>
          </PaperCard>
        </div>
      </div>
      )}

      {feedback && (
        <div className="space-y-6">
          <Task1ResultContext prompt={prompt} />

          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">My Report</h3>
            <p className="whitespace-pre-wrap text-base leading-8 text-paper-ink/80">{feedback.report}</p>
          </PaperCard>

          {analysisState.kind === 'incomplete' ? (
            <Task1AnalysisIncompletePanel
              analysisState={analysisState}
              diagnostic={diagnostic}
              mismatch={promptMismatch}
              onRetry={analyzeReport}
              onBack={returnToReport}
              onSwitch={switchToSuggestedPrompt}
              isRetrying={isAnalyzing}
            />
          ) : (
            <>
          {task1DisplayModel && (
            <Task1FeedbackRoutePanel
              prompt={prompt}
              feedback={feedback}
              displayModel={task1DisplayModel}
            />
          )}

          {task1DisplayModel && (
            <Task1CoverageMap prompt={prompt} displayModel={task1DisplayModel} />
          )}

          {task1DisplayModel?.mustFixItems.length ? (
            <FeedbackList title="Must Fix" items={task1DisplayModel.mustFixItems} empty="" />
          ) : null}

          {task1DisplayModel && (
            <FeedbackList title="Optional Upgrades" items={task1DisplayModel.optionalUpgrades} empty="No optional upgrade returned." />
          )}

          {task1DisplayModel && (
            <FeedbackList title="Reusable Report Patterns" items={task1DisplayModel.reusablePatterns} empty="No reusable pattern returned." />
          )}

          {task1HasRequiredFixes(feedback) && (
            <PaperCard>
              <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Rewrite Task</h3>
              <ul className="space-y-3">
                {task1RewriteActions(feedback).map((item, index) => (
                  <li key={`${item}-${index}`} className="text-base leading-8 text-paper-ink/80 border-l-2 border-l-accent-terracotta/30 pl-4">
                    {item}
                  </li>
                ))}
              </ul>
            </PaperCard>
          )}

          <Task1OptimizedReportPanel
            feedback={feedback}
            validation={targetReportValidation}
            displayModel={task1DisplayModel}
            onRewrite={rewriteThisTask}
            onExport={exportMarkdown}
          />
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}

const Task1ResultContext: React.FC<{ prompt: WritingTask1AcademicPrompt }> = ({ prompt }) => (
  <PaperCard>
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/40">
        {prompt.taskType}
      </span>
      <span className="text-[10px] font-sans uppercase tracking-widest text-accent-terracotta">
        {prompt.topic}
      </span>
    </div>
    <h3 className="text-xl leading-8 mb-3">{prompt.instruction}</h3>
    <p className="text-sm leading-7 text-paper-ink/65">{prompt.visualBrief}</p>
  </PaperCard>
);

const Task1AnalysisIncompletePanel: React.FC<{
  analysisState: Extract<Task1AnalysisRenderState, { kind: 'incomplete' }>;
  diagnostic: ProviderDiagnostic | null;
  mismatch: NonNullable<ReturnType<typeof findLikelyTask1PromptMismatch>> | null;
  onRetry: () => void;
  onBack: () => void;
  onSwitch: () => void;
  isRetrying: boolean;
}> = ({ analysisState, diagnostic, mismatch, onRetry, onBack, onSwitch, isRetrying }) => (
  <PaperCard>
    <p className="mb-2 text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta">
      Analysis Incomplete
    </p>
    <h3 className="text-xl leading-8 mb-3">本次深度分析未完成</h3>
    <p className="text-base leading-8 text-paper-ink/75">
      你的文章已保留，但这次 provider 结果没有通过一致性校验。为避免把系统失败误当成学习反馈，诊断、rewrite、patterns、coverage map 和 target report 已被隐藏。
    </p>
    {diagnostic?.failureKind === 'parse_or_schema' && (
      <p className="mt-3 border-l-2 border-l-accent-terracotta/35 pl-4 text-sm leading-7 text-paper-ink/70">
        这不是文章内容失败，而是 Gemini 返回的 JSON 或字段结构不符合 Task 1 反馈契约。Retry 可能继续失败，直到 provider 返回完整 schema，或切换到可用 fallback provider。
      </p>
    )}
    <div className="mt-5 grid gap-3 md:grid-cols-2">
      <div className="border border-paper-ink/10 bg-paper-ink/[0.02] px-4 py-3">
        <p className="mb-2 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45">Blocked Because</p>
        <ul className="space-y-2 text-sm leading-6 text-paper-ink/75">
          {analysisState.reasons.map(reason => (
            <li key={reason}>- {reason}</li>
          ))}
        </ul>
      </div>
      <div className="border border-paper-ink/10 bg-paper-ink/[0.02] px-4 py-3">
        <p className="mb-2 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45">Status</p>
        <p className="text-sm leading-6 text-paper-ink/75">
          Provider: {diagnostic?.providerName || 'not recorded'}
        </p>
        <p className="text-sm leading-6 text-paper-ink/75">
          Failure: {diagnostic?.failureKind || 'schema/context validation'}
        </p>
      </div>
    </div>
    {mismatch && (
      <div className="mt-4 border border-accent-terracotta/25 bg-accent-terracotta/5 px-4 py-3">
        <p className="mb-1 text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta">
          Likely Cause
        </p>
        <p className="text-sm leading-6 text-paper-ink/75">
          This report appears to answer {mismatch.suggestedPrompt.taskType} / {mismatch.suggestedPrompt.topic}, not the current prompt.
        </p>
      </div>
    )}
    <div className="mt-5 flex flex-wrap gap-3">
      {mismatch && (
        <SerifButton onClick={onSwitch}>
          Switch to Matching Task
        </SerifButton>
      )}
      <SerifButton onClick={onRetry} disabled={isRetrying}>
        {isRetrying ? 'Retrying...' : 'Retry Analysis'}
      </SerifButton>
      <SerifButton onClick={onBack} variant="outline">
        Back to Report
      </SerifButton>
    </div>
  </PaperCard>
);

const Task1GuidedCoach: React.FC<{ prompt: WritingTask1AcademicPrompt }> = ({ prompt }) => (
  <PaperCard>
    <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Task 1 Plan Check</h3>
    <div className="grid gap-4 md:grid-cols-3">
      {taskTypeGuide(prompt.taskType).map((item, index) => (
        <div key={item} className="border-l-2 border-l-accent-terracotta/30 pl-4">
          <p className="mb-1 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40">
            Step {index + 1}
          </p>
          <p className="text-sm leading-6 text-paper-ink/75">{item}</p>
        </div>
      ))}
    </div>
  </PaperCard>
);

const SubmissionQualityPanel: React.FC<{ quality: Task1SubmissionQuality }> = ({ quality }) => {
  const isBlocked = quality.kind === 'not_analyzable';
  return (
    <div className={`mt-4 border px-4 py-3 text-sm ${isBlocked ? 'border-red-200 bg-red-50 text-red-900' : 'border-accent-terracotta/20 bg-accent-terracotta/5 text-paper-ink/75'}`}>
      <p className="mb-2 font-sans text-xs font-bold uppercase tracking-widest">
        {isBlocked ? 'Report Not Ready' : 'Rescue Check'}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-widest opacity-70">Why</p>
          <ul className="space-y-1">
            {quality.reasons.map(reason => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 font-sans text-[10px] font-bold uppercase tracking-widest opacity-70">Next</p>
          <ul className="space-y-1">
            {quality.nextSteps.map(step => (
              <li key={step}>- {step}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

const TaskMismatchPanel: React.FC<{
  mismatch: NonNullable<ReturnType<typeof findLikelyTask1PromptMismatch>>;
  onSwitch: () => void;
}> = ({ mismatch, onSwitch }) => (
  <div className="mt-4 border border-accent-terracotta/25 bg-accent-terracotta/5 px-4 py-3 text-sm text-paper-ink/75">
    <p className="mb-2 font-sans text-xs font-bold uppercase tracking-widest text-accent-terracotta">
      Task Match Warning
    </p>
    <p className="leading-7">
      This report appears to match another Task 1 prompt: {mismatch.suggestedPrompt.taskType} / {mismatch.suggestedPrompt.topic}.
      Current prompt and report should be aligned before analysis.
    </p>
    <p className="mt-2 text-xs font-sans text-paper-ink/55">
      Matched terms: {mismatch.matchedTerms.join(', ')}
    </p>
    <div className="mt-3">
      <SerifButton type="button" variant="outline" className="text-xs" onClick={onSwitch}>
        Switch to Matching Task
      </SerifButton>
    </div>
  </div>
);

const Task1FeedbackRoutePanel: React.FC<{
  prompt: WritingTask1AcademicPrompt;
  feedback: WritingTask1Feedback;
  displayModel: Task1FeedbackDisplayModel;
}> = ({ prompt, feedback, displayModel }) => (
  <PaperCard>
    <div className="grid gap-5 md:grid-cols-[auto_1fr] md:items-center">
      <div>
        <p className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/40 mb-2">
          Training Estimate
        </p>
        <p className="text-4xl font-bold text-accent-terracotta">
          {formatConservativeBandEstimate(feedback.estimatedBand)}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta">
          {displayModel.verdictLabel}
        </p>
        <p className="text-lg leading-8 text-paper-ink/85">
          {displayModel.verdictText}
        </p>
        <p className="mt-2 text-xs font-sans text-paper-ink/50">
          {prompt.taskType} / {prompt.topic}
        </p>
      </div>
    </div>
  </PaperCard>
);

const task1CoverageTone: Record<Task1CoverageStatus, string> = {
  covered: 'text-green-700 border-green-700/30 bg-green-50',
  passed: 'text-green-700 border-green-700/30 bg-green-50',
  thin: 'text-amber-700 border-amber-700/30 bg-amber-50',
  check: 'text-amber-700 border-amber-700/30 bg-amber-50',
  missing: 'text-red-700 border-red-700/30 bg-red-50',
};

const Task1CoverageMap: React.FC<{
  prompt: WritingTask1AcademicPrompt;
  displayModel: Task1FeedbackDisplayModel;
}> = ({ prompt, displayModel }) => {
  const rows = displayModel.coverageRows;
  return (
    <PaperCard>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-widest">Task Coverage Map</h3>
          <p className="mt-2 text-sm leading-6 text-paper-ink/60">
            Checks the current report against the main requirements for this {prompt.taskType}.
          </p>
        </div>
        <span className="border border-paper-ink/10 px-3 py-1 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45">
          {prompt.topic}
        </span>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {rows.map(item => (
          <div key={item.label} className="border border-paper-ink/10 bg-paper-ink/[0.02] px-4 py-3">
            <p className="mb-2 text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45">
              {item.label}
            </p>
            <span className={`inline-block border px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-widest ${task1CoverageTone[item.status]}`}>
              {item.status}
            </span>
          </div>
        ))}
      </div>
    </PaperCard>
  );
};

const Task1OptimizedReportPanel: React.FC<{
  feedback: WritingTask1Feedback;
  validation: Task1TargetReportValidation | undefined;
  displayModel: Task1FeedbackDisplayModel | undefined;
  onRewrite: () => void;
  onExport: () => void;
}> = ({ feedback, validation, displayModel, onRewrite, onExport }) => {
  const isBlocked = validation?.kind === 'invalid';

  return (
    <PaperCard>
      <h3 className="text-sm font-bold uppercase tracking-widest mb-1">
        {displayModel?.sampleHeading || getTask1TargetHeading(feedback)}
      </h3>
      <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-4">
        {displayModel?.sampleNote || getTask1TargetNote(feedback)}
      </p>
      {isBlocked ? (
        <div className="border border-amber-700/25 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
          <p className="mb-2 font-sans text-[10px] font-bold uppercase tracking-widest">
            Hidden by Data Check
          </p>
          <ul className="space-y-2">
            {validation.reasons.map(reason => (
              <li key={reason}>- {reason}</li>
            ))}
          </ul>
        </div>
      ) : (
        <details>
          <summary className="cursor-pointer border border-paper-ink/15 px-4 py-3 text-sm font-bold uppercase tracking-widest text-paper-ink/65">
            Open sample answer
          </summary>
          <p className="mt-4 whitespace-pre-wrap text-base leading-8 text-paper-ink/80">
            {feedback.improvedReport || feedback.modelExcerpt}
          </p>
        </details>
      )}
      <div className="flex flex-wrap gap-3 mt-5">
        <SerifButton onClick={onRewrite} variant="outline" className="text-xs">
          Practice This Task Again
        </SerifButton>
        <SerifButton onClick={onExport} variant="outline" className="text-xs flex items-center gap-2">
          <FileDown className="w-4 h-4" /> Export Markdown
        </SerifButton>
      </div>
    </PaperCard>
  );
};

interface PlanBoxProps {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}

const PlanBox: React.FC<PlanBoxProps> = ({ label, value, placeholder, onChange }) => (
  <label className="block">
    <span className="block text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-2">
      {label}
    </span>
    <textarea
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full min-h-[92px] bg-transparent border border-paper-ink/15 p-3 text-sm leading-6 resize-y focus:outline-none focus:border-accent-terracotta/70"
    />
  </label>
);

interface FeedbackListProps {
  title: string;
  items: string[];
  empty: string;
}

const FeedbackList: React.FC<FeedbackListProps> = ({ title, items, empty }) => (
  <PaperCard>
    <h3 className="text-sm font-bold uppercase tracking-widest mb-4">{title}</h3>
    {items.length ? (
      <ul className="space-y-3">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="text-base leading-8 text-paper-ink/80 border-l-2 border-l-accent-terracotta/30 pl-4">
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm text-paper-ink/55">{empty}</p>
    )}
  </PaperCard>
);
