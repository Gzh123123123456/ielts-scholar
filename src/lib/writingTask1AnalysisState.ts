import type { WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import type { WritingTask1Feedback } from '@/src/lib/ai/schemas';

export type Task1AnalysisRenderState =
  | {
      kind: 'success';
    }
  | {
      kind: 'incomplete';
      reasons: string[];
    };

export type Task1TargetReportValidation =
  | {
      kind: 'valid';
    }
  | {
      kind: 'invalid';
      reasons: string[];
    };

const providerIncompletePattern =
  /incomplete feedback|feedback was incomplete|provider returned incomplete|please retry analysis|target report needs repair|provider did not generate|malformed or incomplete/i;

const normalize = (value: string | undefined) =>
  (value || '').replace(/\s+/g, ' ').trim().toLowerCase();

const genericTaskTerms = new Set([
  'chart',
  'table',
  'graph',
  'line',
  'bar',
  'pie',
  'mixed',
  'process',
  'diagram',
  'map',
  'shows',
  'show',
  'summarize',
  'summarise',
  'information',
  'selecting',
  'reporting',
  'features',
  'feature',
  'comparisons',
  'comparison',
  'relevant',
  'percentage',
  'percent',
  'average',
  'figure',
  'figures',
  'period',
  'years',
  'year',
  'from',
  'with',
  'between',
  'using',
  'used',
  'uses',
  'use',
  'should',
  'would',
  'could',
  'three',
  'four',
  'forms',
  'most',
  'least',
  'while',
  'whereas',
  'contrast',
  'overall',
  'highest',
  'lowest',
  'largest',
  'smallest',
  'increased',
  'decreased',
  'declined',
  'rose',
  'fell',
  'remained',
  'ranked',
  'recorded',
  'respectively',
  'grouped',
  'group',
  'category',
  'categories',
  'numbers',
  'number',
  'point',
  'points',
  'less',
  'important',
  'change',
  'changes',
  'changed',
  'pattern',
  'patterns',
  'into',
  'such',
  'structure',
  'dropped',
  'dropping',
  'drop',
  'reduced',
  'reduction',
  'reduce',
  'rise',
  'rising',
  'falling',
  'smaller',
  'larger',
  'longest',
  'shortest',
  'followed',
  'similar',
  'data',
  'support',
  'accuracy',
  'overview',
  'coherence',
  'body',
  'paragraph',
  'paragraphs',
  'rewrite',
  'target',
  'report',
  'task',
  'visual',
  'brief',
  'selects',
  'selected',
  'compares',
  'compared',
]);

const tokenizeEntityTerms = (text: string) =>
  Array.from(new Set(
    (text.toLowerCase().match(/[a-z][a-z+%-]*/g) || [])
      .filter(token => token.length >= 4)
      .filter(token => !genericTaskTerms.has(token)),
  ));

const promptEntityText = (prompt: WritingTask1AcademicPrompt) =>
  [
    prompt.taskType,
    prompt.topic,
    prompt.instruction,
    prompt.visualBrief,
    ...prompt.data,
  ].join(' ');

const promptEvidenceText = (prompt: WritingTask1AcademicPrompt) =>
  [
    promptEntityText(prompt),
    prompt.expectedOverview,
    ...prompt.expectedKeyFeatures,
    ...(prompt.expectedComparisons || []),
  ].join(' ');

const feedbackEvidenceText = (feedback: WritingTask1Feedback) =>
  [
    feedback.taskType,
    feedback.instruction,
    feedback.visualBrief,
    feedback.overviewFeedback,
    feedback.keyFeaturesFeedback,
    feedback.comparisonFeedback,
    feedback.dataAccuracyFeedback,
    feedback.coherenceFeedback,
    feedback.rewriteTask,
    feedback.improvedReport,
    feedback.modelExcerpt || '',
    ...feedback.mustFix,
    ...feedback.reusableReportPatterns,
  ].join(' ');

const parseComparableRows = (prompt: WritingTask1AcademicPrompt) =>
  prompt.data
    .map(item => {
      const label = item.match(/^\s*([^:]+):/)?.[1]?.trim();
      const metricValues = Array.from(item.matchAll(/(-?\d+(?:\.\d+)?)\s*(?:%|minutes?|million|thousand|dollars?|units?|km|tonnes?)/gi))
        .map(match => Number(match[1]));
      const values = metricValues.length >= 2
        ? metricValues
        : Array.from(item.matchAll(/(-?\d+(?:\.\d+)?)/g)).map(match => Number(match[1]));
      if (!label || values.length < 2 || values.some(value => !Number.isFinite(value))) return null;
      return {
        label,
        start: values[0],
        end: values[values.length - 1],
        delta: values[values.length - 1] - values[0],
      };
    })
    .filter((row): row is { label: string; start: number; end: number; delta: number } => Boolean(row));

const uniqueByValue = <T extends { value: number; label: string }>(items: T[]) => {
  const bestValue = items[0]?.value;
  return items.filter(item => item.value === bestValue).map(item => item.label.toLowerCase());
};

const sentenceContains = (sentence: string, labels: string[]) =>
  labels.some(label => new RegExp(`\\b${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(sentence));

const targetReportAccuracyReasons = (
  prompt: WritingTask1AcademicPrompt,
  reportText: string,
) => {
  const rows = parseComparableRows(prompt);
  if (rows.length < 2 || !reportText.trim()) return [];

  const text = reportText.replace(/\s+/g, ' ').trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  const labels = rows.map(row => row.label.toLowerCase());
  const largestDecreaseLabels = uniqueByValue(
    rows
      .filter(row => row.delta < 0)
      .map(row => ({ label: row.label, value: Math.abs(row.delta) }))
      .sort((a, b) => b.value - a.value),
  );
  const largestIncreaseLabels = uniqueByValue(
    rows
      .filter(row => row.delta > 0)
      .map(row => ({ label: row.label, value: row.delta }))
      .sort((a, b) => b.value - a.value),
  );

  const reasons: string[] = [];

  sentences.forEach(sentence => {
    const lower = sentence.toLowerCase();
    const mentionedLabels = labels.filter(label => sentenceContains(sentence, [label]));
    if (!mentionedLabels.length) return;

    const hasDecreaseSuperlative =
      /\b(largest|biggest|greatest|steepest|sharpest|most substantial|most significant)\b/.test(lower) &&
      /\b(decrease|decline|drop|fall|fell|reduction|reduced|improvement|improved)\b/.test(lower);
    if (hasDecreaseSuperlative && largestDecreaseLabels.length) {
      const wrongLabels = mentionedLabels.filter(label => !largestDecreaseLabels.includes(label));
      if (wrongLabels.length) {
        reasons.push(`The optimized report names ${wrongLabels.join(', ')} as the largest decrease, but the source data supports ${largestDecreaseLabels.join(', ')}.`);
      }
    }

    const hasIncreaseSuperlative =
      /\b(largest|biggest|greatest|steepest|sharpest|most substantial|most significant)\b/.test(lower) &&
      /\b(increase|rise|rose|growth|grew|gain|gained)\b/.test(lower);
    if (hasIncreaseSuperlative && largestIncreaseLabels.length) {
      const wrongLabels = mentionedLabels.filter(label => !largestIncreaseLabels.includes(label));
      if (wrongLabels.length) {
        reasons.push(`The optimized report names ${wrongLabels.join(', ')} as the largest increase, but the source data supports ${largestIncreaseLabels.join(', ')}.`);
      }
    }
  });

  return Array.from(new Set(reasons));
};

const bankDerivedForeignTerms = (
  currentPrompt: WritingTask1AcademicPrompt,
  promptBank: WritingTask1AcademicPrompt[],
) => {
  const currentTerms = new Set(tokenizeEntityTerms(promptEntityText(currentPrompt)));
  const foreignTerms = new Map<string, string>();

  promptBank
    .filter(prompt => prompt.id !== currentPrompt.id)
    .forEach(prompt => {
      tokenizeEntityTerms(promptEntityText(prompt)).forEach(term => {
        if (!currentTerms.has(term)) {
          foreignTerms.set(term, prompt.id);
        }
      });
    });

  return foreignTerms;
};

export const validateTask1AnalysisForRender = ({
  currentPrompt,
  feedback,
  feedbackPromptId,
  promptBank,
}: {
  currentPrompt: WritingTask1AcademicPrompt;
  feedback?: WritingTask1Feedback;
  feedbackPromptId?: string;
  promptBank: WritingTask1AcademicPrompt[];
}): Task1AnalysisRenderState => {
  if (!feedback) return { kind: 'incomplete', reasons: ['No feedback was returned.'] };

  const reasons: string[] = [];

  if (feedbackPromptId && feedbackPromptId !== currentPrompt.id) {
    reasons.push('The returned feedback belongs to a different Task 1 prompt.');
  }

  if (normalize(feedback.taskType) !== normalize(currentPrompt.taskType)) {
    reasons.push('The returned feedback task type does not match the current task.');
  }

  if (normalize(feedback.instruction) !== normalize(currentPrompt.instruction)) {
    reasons.push('The returned feedback instruction does not match the current task.');
  }

  if (!Number.isFinite(feedback.estimatedBand) || feedback.estimatedBand < 1 || feedback.estimatedBand > 9) {
    reasons.push('The analysis did not return a valid IELTS band estimate.');
  }

  const requiredFields = [
    feedback.overviewFeedback,
    feedback.keyFeaturesFeedback,
    feedback.comparisonFeedback,
    feedback.dataAccuracyFeedback,
    feedback.coherenceFeedback,
  ];

  if (requiredFields.some(field => !field.trim() || providerIncompletePattern.test(field))) {
    reasons.push('The provider returned incomplete diagnosis fields.');
  }

  if (providerIncompletePattern.test(feedback.rewriteTask) || providerIncompletePattern.test(feedback.improvedReport || feedback.modelExcerpt || '')) {
    reasons.push('The provider returned an incomplete rewrite or target report.');
  }

  if ((feedback.targetState === 'needs_repair' || feedback.targetState === 'target_failed_or_borderline') && feedback.mustFix.length === 0) {
    reasons.push('The target report state conflicts with the empty must-fix list.');
  }

  const foreignTerms = bankDerivedForeignTerms(currentPrompt, promptBank);
  const currentEvidence = normalize(promptEntityText(currentPrompt));
  const feedbackText = normalize(feedbackEvidenceText(feedback));
  const contaminatedTerms = Array.from(foreignTerms.keys())
    .filter(term => !currentEvidence.includes(term) && new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(feedbackText))
    .slice(0, 6);

  if (contaminatedTerms.length) {
    reasons.push(`The feedback contains off-task entities: ${contaminatedTerms.join(', ')}.`);
  }

  return reasons.length ? { kind: 'incomplete', reasons } : { kind: 'success' };
};

export const validateTask1TargetReportForDisplay = ({
  currentPrompt,
  feedback,
}: {
  currentPrompt: WritingTask1AcademicPrompt;
  feedback?: WritingTask1Feedback;
}): Task1TargetReportValidation => {
  if (!feedback) return { kind: 'invalid', reasons: ['No feedback was returned.'] };
  const targetText = feedback.improvedReport || feedback.modelExcerpt || '';
  if (!targetText.trim()) return { kind: 'invalid', reasons: ['No optimized report was returned.'] };

  const reasons = targetReportAccuracyReasons(currentPrompt, targetText);
  return reasons.length ? { kind: 'invalid', reasons } : { kind: 'valid' };
};
