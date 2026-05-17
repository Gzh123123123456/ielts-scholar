import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { writingTask1Academic, WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import { routedAnalyzeWritingTask1 } from '@/src/lib/ai';
import { useApp } from '@/src/context/AppContext';
import { ProviderDiagnostic, WritingTask1Feedback } from '@/src/lib/ai/schemas';
import { formatBandEstimate } from '@/src/lib/bands';
import {
  createRecordId,
  getActiveWritingTask1,
  saveActiveWritingTask1,
  summarizeDiagnostic,
  upsertPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask1QuickPlan,
} from '@/src/lib/practiceRecords';

const emptyPlan: WritingTask1QuickPlan = {
  overview: '',
  keyFeatures: '',
  comparisons: '',
  paragraphPlan: '',
};

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

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

const task1MustFixItems = (feedback: WritingTask1Feedback): string[] =>
  feedback.mustFix.length
    ? feedback.mustFix.map(item => chineseFirst(item, '优先修复这个 Task 1 问题：检查 overview、关键数据、比较关系或结构是否缺失。'))
    : ['没有返回必须修复项。请继续检查 overview 是否概括全图、主体段是否分组、数据是否准确。'];

const buildTask1Markdown = (
  prompt: WritingTask1AcademicPrompt,
  quickPlan: WritingTask1QuickPlan,
  feedback: WritingTask1Feedback,
) => {
  const date = new Date().toLocaleString();
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
- Training Estimate: ${formatBandEstimate(feedback.estimatedBand)}

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

## Improved Report / Model Excerpt
${feedback.improvedReport || feedback.modelExcerpt || 'No improved report returned.'}
`;
};

export default function WritingTask1Placeholder() {
  const { setProviderDiagnostic } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const selectedWritingTask1PromptId = (location.state as { selectedWritingTask1PromptId?: string } | null)?.selectedWritingTask1PromptId;
  const selectedPrompt = selectedWritingTask1PromptId
    ? writingTask1Academic.find(item => item.id === selectedWritingTask1PromptId)
    : undefined;
  const activeRecord = useMemo(
    () => selectedPrompt ? null : getActiveWritingTask1(),
    [selectedPrompt],
  );
  const initialActiveRecordRef = useRef(activeRecord);
  const isInitialRestoreRef = useRef(Boolean(activeRecord));
  const initialPrompt = selectedPrompt || writingTask1Academic.find(prompt => prompt.id === activeRecord?.questionId) || writingTask1Academic[0];

  const [recordId, setRecordId] = useState(selectedPrompt ? createRecordId('writing_task1') : activeRecord?.id || createRecordId('writing_task1'));
  const [createdAt, setCreatedAt] = useState(selectedPrompt ? new Date().toISOString() : activeRecord?.createdAt || new Date().toISOString());
  const [prompt, setPrompt] = useState<WritingTask1AcademicPrompt>(initialPrompt);
  const [quickPlan, setQuickPlan] = useState<WritingTask1QuickPlan>(selectedPrompt ? emptyPlan : activeRecord?.quickPlan || emptyPlan);
  const [report, setReport] = useState(selectedPrompt ? '' : activeRecord?.report || '');
  const [feedback, setFeedback] = useState<WritingTask1Feedback | undefined>(selectedPrompt ? undefined : activeRecord?.feedback);
  const [diagnostic, setDiagnostic] = useState<ProviderDiagnostic | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [providerErrorMessage, setProviderErrorMessage] = useState(
    !selectedPrompt && activeRecord?.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later. Your report is preserved.' : '',
  );
  const [apiStatusMessage, setApiStatusMessage] = useState('');

  const words = countWords(report);
  const status = providerErrorMessage ? 'provider_failed' : feedback ? 'analyzed' : 'draft';
  const currentMarkdown = feedback ? buildTask1Markdown(prompt, quickPlan, feedback) : '';

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
          ? buildTask1Markdown(prompt, quickPlan, nextFeedback)
          : initialActiveRecordRef.current?.obsidianMarkdown,
    };
  };

  useEffect(() => {
    if (selectedWritingTask1PromptId) {
      navigate('/writing/task1', { replace: true, state: null });
    }
  }, []);

  useEffect(() => {
    if (isInitialRestoreRef.current) {
      isInitialRestoreRef.current = false;
      return;
    }
    const record = buildRecord();
    saveActiveWritingTask1(record);
    if (record.status !== 'draft') {
      upsertPracticeRecord(record);
    }
  }, [recordId, createdAt, prompt, quickPlan, report, feedback, providerErrorMessage]);

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
    setDiagnostic(null);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    initialActiveRecordRef.current = null;
  };

  const analyzeReport = async () => {
    if (!report.trim()) return;
    setIsAnalyzing(true);
    setProviderErrorMessage('');
    setApiStatusMessage('');
    try {
      const result = await routedAnalyzeWritingTask1({
        task: 'task1',
        taskType: prompt.taskType,
        instruction: prompt.instruction,
        visualBrief: prompt.visualBrief,
        dataSummary: prompt.data.join('\n'),
        report,
        expectedOverview: prompt.expectedOverview,
        expectedKeyFeatures: prompt.expectedKeyFeatures,
        expectedComparisons: prompt.expectedComparisons,
        commonTraps: prompt.commonTraps,
        reusablePatterns: prompt.reusablePatterns,
      }, words < 80);
      setApiStatusMessage(result.route.fallbackReason || result.route.learnerReason);
      setProviderDiagnostic(result.diagnostic);
      if (result.diagnostic.failureKind === 'provider_unavailable') {
        setDiagnostic(result.diagnostic);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your report is preserved.');
        const failedRecord = buildRecord(undefined, 'provider_failed');
        upsertPracticeRecord({
          ...failedRecord,
          providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        });
        saveActiveWritingTask1({
          ...failedRecord,
          providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        });
        return;
      }
      setFeedback(result.feedback);
      setDiagnostic(result.diagnostic);
      const analyzedRecord = buildRecord(result.feedback);
      upsertPracticeRecord({
        ...analyzedRecord,
        providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        obsidianMarkdown: buildTask1Markdown(prompt, quickPlan, result.feedback),
      });
      saveActiveWritingTask1({
        ...analyzedRecord,
        providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        obsidianMarkdown: buildTask1Markdown(prompt, quickPlan, result.feedback),
      });
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
    a.download = `ielts-writing-task1-${new Date().toISOString().split('T')[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const rewriteThisTask = () => {
    setRecordId(createRecordId('writing_task1'));
    setCreatedAt(new Date().toISOString());
    setQuickPlan(emptyPlan);
    setReport('');
    setFeedback(undefined);
    setDiagnostic(null);
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

      <div className="grid xl:grid-cols-[0.9fr_1.1fr] gap-8 items-start">
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
            <div className="space-y-3">
              {prompt.data.map((item, index) => (
                <div key={`${prompt.id}-${index}`} className="border border-paper-ink/10 bg-paper-ink/[0.02] px-4 py-3">
                  <p className="text-sm leading-7 text-paper-ink/75">{item}</p>
                </div>
              ))}
            </div>
          </PaperCard>
        </div>

        <div className="space-y-6">
          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-1">Quick Plan</h3>
            <p className="text-xs text-paper-ink/55 mb-4">Optional scratchpad. Feedback diagnoses My Report below.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <PlanBox label="Overview" value={quickPlan.overview} onChange={value => updatePlan('overview', value)} placeholder="Main trend, pattern, or sequence." />
              <PlanBox label="Key features" value={quickPlan.keyFeatures} onChange={value => updatePlan('keyFeatures', value)} placeholder="Largest changes, standout values, stages." />
              <PlanBox label="Comparisons" value={quickPlan.comparisons} onChange={value => updatePlan('comparisons', value)} placeholder="Higher/lower, before/after, rank changes." />
              <PlanBox label="Paragraph plan" value={quickPlan.paragraphPlan} onChange={value => updatePlan('paragraphPlan', value)} placeholder="Intro / overview / details 1 / details 2." />
            </div>
          </PaperCard>

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
              }}
              placeholder="Write at least 150 words. Start with a paraphrase, add one clear overview, then group key details with accurate data."
              className="w-full min-h-[320px] bg-transparent border border-paper-ink/15 p-4 text-base leading-8 resize-y focus:outline-none focus:border-accent-terracotta/70"
            />
            {report.trim() && words < 150 && (
              <p className="text-xs text-paper-ink/55 mt-3">
                Task 1 reports are expected to be at least 150 words.
              </p>
            )}
            <div className="flex flex-wrap gap-3 mt-5">
              <SerifButton onClick={analyzeReport} disabled={isAnalyzing || !report.trim()}>
                {isAnalyzing ? 'Analyzing...' : 'Submit for Feedback'}
              </SerifButton>
              <SerifButton onClick={loadNewPrompt} variant="outline" disabled={isAnalyzing}>
                Change Task
              </SerifButton>
            </div>
          </PaperCard>
        </div>
      </div>

      {feedback && (
        <div className="mt-8 space-y-6">
          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">My Report</h3>
            <p className="whitespace-pre-wrap text-base leading-8 text-paper-ink/80">{feedback.report}</p>
          </PaperCard>

          <PaperCard>
            <div className="grid lg:grid-cols-[auto_1fr] gap-6">
              <div className="text-center">
                <p className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/40 mb-2">
                  Training Estimate
                </p>
                <p className="text-4xl font-bold text-accent-terracotta">{formatBandEstimate(feedback.estimatedBand)}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Diagnosis of My Report</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {task1DiagnosisItems(feedback).map(({ label, text, fallback }) => (
                    <div key={label} className="border-l-2 border-l-accent-terracotta/35 pl-4 py-1">
                      <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-1">{label}</p>
                      <p className="text-base leading-8 text-paper-ink/80">{chineseFirst(text, fallback)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PaperCard>

          <div className="grid lg:grid-cols-2 gap-6">
            <FeedbackList title="Must Fix" items={task1MustFixItems(feedback)} empty="没有返回必须修复项。请继续检查 overview、关键数据和分组结构。" />
            <FeedbackList title="Reusable Report Patterns" items={feedback.reusableReportPatterns} empty="No reusable patterns returned." />
          </div>

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

          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Improved Report / Model Excerpt</h3>
            <p className="whitespace-pre-wrap text-base leading-8 text-paper-ink/80">{feedback.improvedReport || feedback.modelExcerpt}</p>
            <div className="flex flex-wrap gap-3 mt-5">
              <SerifButton onClick={rewriteThisTask} variant="outline" className="text-xs">
                Rewrite This Task
              </SerifButton>
              <SerifButton onClick={exportMarkdown} variant="outline" className="text-xs flex items-center gap-2">
                <FileDown className="w-4 h-4" /> Export Markdown
              </SerifButton>
            </div>
          </PaperCard>
        </div>
      )}
    </PageShell>
  );
}

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
