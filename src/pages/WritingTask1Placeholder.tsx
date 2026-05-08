import React, { useEffect, useMemo, useState } from 'react';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { writingTask1Academic, WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import { getAIProvider, getAIProviderName, safeAnalyzeWritingTask1 } from '@/src/lib/ai';
import { ProviderDiagnostic, WritingTask1Feedback } from '@/src/lib/ai/schemas';
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

const hasMeaningfulContent = (report: string, quickPlan: WritingTask1QuickPlan, feedback?: WritingTask1Feedback) =>
  Boolean(
    report.trim() ||
    quickPlan.overview.trim() ||
    quickPlan.keyFeatures.trim() ||
    quickPlan.comparisons.trim() ||
    quickPlan.paragraphPlan.trim() ||
    feedback,
  );

const feedbackItems = (feedback: WritingTask1Feedback) => [
  ['Overview', feedback.overviewFeedback],
  ['Key Features', feedback.keyFeaturesFeedback],
  ['Comparisons', feedback.comparisonFeedback],
  ['Data Accuracy', feedback.dataAccuracyFeedback],
  ['Coherence', feedback.coherenceFeedback],
];

export default function WritingTask1Placeholder() {
  const activeRecord = useMemo(() => getActiveWritingTask1(), []);
  const initialPrompt = writingTask1Academic.find(prompt => prompt.id === activeRecord?.questionId) || writingTask1Academic[0];

  const [recordId, setRecordId] = useState(activeRecord?.id || createRecordId('writing_task1'));
  const [createdAt, setCreatedAt] = useState(activeRecord?.createdAt || new Date().toISOString());
  const [prompt, setPrompt] = useState<WritingTask1AcademicPrompt>(initialPrompt);
  const [quickPlan, setQuickPlan] = useState<WritingTask1QuickPlan>(activeRecord?.quickPlan || emptyPlan);
  const [report, setReport] = useState(activeRecord?.report || '');
  const [feedback, setFeedback] = useState<WritingTask1Feedback | undefined>(activeRecord?.feedback);
  const [diagnostic, setDiagnostic] = useState<ProviderDiagnostic | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const words = countWords(report);
  const status = feedback ? 'analyzed' : 'draft';

  const buildRecord = (nextFeedback = feedback): WritingTask1PracticeRecord => {
    const now = new Date().toISOString();
    return {
      id: recordId,
      module: 'writing_task1',
      mode: 'practice',
      status: nextFeedback ? 'analyzed' : 'draft',
      task: 'task1',
      question: prompt.instruction,
      questionId: prompt.id,
      topic: prompt.topic,
      tags: prompt.tags,
      taskType: prompt.taskType,
      createdAt,
      updatedAt: now,
      analyzedAt: nextFeedback ? now : activeRecord?.analyzedAt,
      questionData: prompt,
      instruction: prompt.instruction,
      visualBrief: prompt.visualBrief,
      dataSummary: prompt.data,
      quickPlan,
      report,
      feedback: nextFeedback,
      providerDiagnostic: diagnostic ? summarizeDiagnostic(diagnostic) : activeRecord?.providerDiagnostic,
      obsidianMarkdown: nextFeedback?.obsidianMarkdown || activeRecord?.obsidianMarkdown,
    };
  };

  useEffect(() => {
    const record = buildRecord();
    saveActiveWritingTask1(record);
    if (hasMeaningfulContent(report, quickPlan, feedback)) {
      upsertPracticeRecord(record);
    }
  }, [recordId, createdAt, prompt, quickPlan, report, feedback]);

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
  };

  const analyzeReport = async () => {
    if (!report.trim()) return;
    setIsAnalyzing(true);
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
      setFeedback(result.feedback);
      setDiagnostic(result.diagnostic);
      const analyzedRecord = buildRecord(result.feedback);
      upsertPracticeRecord({
        ...analyzedRecord,
        providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        obsidianMarkdown: result.feedback.obsidianMarkdown,
      });
      saveActiveWritingTask1({
        ...analyzedRecord,
        providerDiagnostic: summarizeDiagnostic(result.diagnostic),
        obsidianMarkdown: result.feedback.obsidianMarkdown,
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const exportMarkdown = () => {
    if (!feedback?.obsidianMarkdown) return;
    navigator.clipboard.writeText(feedback.obsidianMarkdown).catch(() => undefined);
  };

  return (
    <PageShell>
      <TopBar />

      <div className="mb-8 max-w-3xl">
        <p className="text-xs font-sans font-bold uppercase tracking-widest text-accent-terracotta mb-2">
          Academic Writing Task 1
        </p>
        <h2 className="text-3xl mb-2">Describe the Visual Brief</h2>
        <p className="text-sm italic text-paper-ink/60">
          Local-first basic practice. Text briefs now, interactive charts later.
        </p>
      </div>

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
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Quick Plan</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <PlanBox label="Overview" value={quickPlan.overview} onChange={value => updatePlan('overview', value)} placeholder="Main trend, pattern, or sequence." />
              <PlanBox label="Key features" value={quickPlan.keyFeatures} onChange={value => updatePlan('keyFeatures', value)} placeholder="Largest changes, standout values, stages." />
              <PlanBox label="Comparisons" value={quickPlan.comparisons} onChange={value => updatePlan('comparisons', value)} placeholder="Higher/lower, before/after, rank changes." />
              <PlanBox label="Paragraph plan" value={quickPlan.paragraphPlan} onChange={value => updatePlan('paragraphPlan', value)} placeholder="Intro / overview / details 1 / details 2." />
            </div>
          </PaperCard>

          <PaperCard>
            <div className="flex items-center justify-between gap-4 mb-3">
              <h3 className="text-sm font-bold uppercase tracking-widest">Report Editor</h3>
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
                New Prompt
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
                  Estimated Band
                </p>
                <p className="text-4xl font-bold text-accent-terracotta">{feedback.estimatedBand.toFixed(1)}</p>
              </div>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Task 1 Diagnosis</h3>
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
            <p className="text-sm leading-7 text-paper-ink/75">{feedback.rewriteTask}</p>
          </PaperCard>

          <PaperCard>
            <h3 className="text-sm font-bold uppercase tracking-widest mb-4">Improved Report / Model Excerpt</h3>
            <p className="whitespace-pre-wrap text-sm leading-7 text-paper-ink/75">{feedback.improvedReport || feedback.modelExcerpt}</p>
            {feedback.obsidianMarkdown && (
              <SerifButton onClick={exportMarkdown} variant="outline" className="mt-5 text-xs">
                Copy Markdown
              </SerifButton>
            )}
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
