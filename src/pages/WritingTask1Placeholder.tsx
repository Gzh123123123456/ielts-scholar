import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { writingTask1Academic, WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import { getAIProvider, getAIProviderName, safeAnalyzeWritingTask1 } from '@/src/lib/ai';
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
      'Rewrite the overview so it summarizes the whole visual in one clear sentence.',
      'Group the body paragraphs by trend, size, stage, or category instead of listing points one by one.',
      'Add direct comparisons between the most important figures, periods, groups, or locations.',
      'Check every number, unit, and ranking against the visual information before resubmitting.',
    ];

  return Array.from(new Set(actions));
};

const buildTask1ObsidianNote = (
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
- 概览: ${feedback.overviewFeedback}
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
  const activeRecord = useMemo(() => getActiveWritingTask1(), []);
  const initialActiveRecordRef = useRef(activeRecord);
  const initialPrompt = writingTask1Academic.find(prompt => prompt.id === activeRecord?.questionId) || writingTask1Academic[0];

  const [recordId, setRecordId] = useState(activeRecord?.id || createRecordId('writing_task1'));
  const [createdAt, setCreatedAt] = useState(activeRecord?.createdAt || new Date().toISOString());
  const [prompt, setPrompt] = useState<WritingTask1AcademicPrompt>(initialPrompt);
  const [quickPlan, setQuickPlan] = useState<WritingTask1QuickPlan>(activeRecord?.quickPlan || emptyPlan);
  const [report, setReport] = useState(activeRecord?.report || '');
  const [feedback, setFeedback] = useState<WritingTask1Feedback | undefined>(activeRecord?.feedback);
  const [diagnostic, setDiagnostic] = useState<ProviderDiagnostic | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [providerErrorMessage, setProviderErrorMessage] = useState(
    activeRecord?.status === 'provider_failed' ? 'AI provider temporarily unavailable. Please retry later. Your report is preserved.' : '',
  );

  const words = countWords(report);
  const status = providerErrorMessage ? 'provider_failed' : feedback ? 'analyzed' : 'draft';
  const currentObsidianNote = feedback ? buildTask1ObsidianNote(prompt, quickPlan, feedback) : '';

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
          ? buildTask1ObsidianNote(prompt, quickPlan, nextFeedback)
          : initialActiveRecordRef.current?.obsidianMarkdown,
    };
  };

  useEffect(() => {
    const record = buildRecord();
    saveActiveWritingTask1(record);
    upsertPracticeRecord(record);
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
    initialActiveRecordRef.current = null;
  };

  const analyzeReport = async () => {
    if (!report.trim()) return;
    setIsAnalyzing(true);
    setProviderErrorMessage('');
    try {
      const result = await safeAnalyzeWritingTask1(getAIProvider(), getAIProviderName(), {
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
      });
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
        obsidianMarkdown: buildTask1ObsidianNote(prompt, quickPlan, result.feedback),
      });
      saveActiveWritingTask1({
        ...analyzedRecord,
        providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        obsidianMarkdown: buildTask1ObsidianNote(prompt, quickPlan, result.feedback),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportMarkdown = () => {
    if (!currentObsidianNote) return;
    navigator.clipboard.writeText(currentObsidianNote).catch(() => undefined);
  };

  const rewriteThisTask = () => {
    setRecordId(createRecordId('writing_task1'));
    setCreatedAt(new Date().toISOString());
    setQuickPlan(emptyPlan);
    setReport('');
    setFeedback(undefined);
    setDiagnostic(null);
    setProviderErrorMessage('');
    initialActiveRecordRef.current = null;
  };

  return (
    <PageShell>
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
            <p className="text-xs italic text-paper-ink/45 mb-4">Optional scratchpad. Feedback diagnoses My Report below.</p>
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
              <p className="text-xs italic text-paper-ink/45 mt-3">
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
            <p className="whitespace-pre-wrap text-sm leading-7 text-paper-ink/75">{feedback.report}</p>
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
                <div className="grid md:grid-cols-2 gap-3">
                  {feedbackItems(feedback).map(([label, text]) => (
                    <div key={label} className="border-l-2 border-l-accent-terracotta/35 pl-4 py-1">
                      <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-1">{label}</p>
                      <p className="text-sm leading-7 text-paper-ink/70">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PaperCard>

          <div className="grid lg:grid-cols-2 gap-6">
            <FeedbackList title="Must Fix" items={feedback.mustFix} empty="No critical Task 1 issue returned." />
            <FeedbackList title="Reusable Report Patterns" items={feedback.reusableReportPatterns} empty="No reusable patterns returned." />
          </div>

          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Rewrite Task</h3>
            <ul className="space-y-3">
              {getRewriteActions(feedback).map((item, index) => (
                <li key={`${item}-${index}`} className="text-sm leading-7 text-paper-ink/75 border-l-2 border-l-accent-terracotta/30 pl-4">
                  {item}
                </li>
              ))}
            </ul>
          </PaperCard>

          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Improved Report / Model Excerpt</h3>
            <p className="whitespace-pre-wrap text-sm leading-7 text-paper-ink/75">{feedback.improvedReport || feedback.modelExcerpt}</p>
            <div className="flex flex-wrap gap-3 mt-5">
              <SerifButton onClick={rewriteThisTask} variant="outline" className="text-xs">
                Rewrite This Task
              </SerifButton>
              <SerifButton onClick={exportMarkdown} variant="outline" className="text-xs">
                Copy Obsidian Note
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
          <li key={`${item}-${index}`} className="text-sm leading-7 text-paper-ink/75 border-l-2 border-l-accent-terracotta/30 pl-4">
            {item}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-sm italic text-paper-ink/45">{empty}</p>
    )}
  </PaperCard>
);
