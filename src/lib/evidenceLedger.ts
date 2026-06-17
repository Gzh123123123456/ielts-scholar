import type {
  Part1AnswerAnnotation,
  Part1AnswerAnnotationLayer,
  SpeakingFeedback,
  SpeakingThreadAnswer,
  WritingFeedback,
  WritingTask1Feedback,
} from './ai/schemas';

export type EvidenceLedgerModule = 'speaking' | 'writing_task2' | 'writing_task1';

export type EvidenceLedgerSourceKind =
  | 'speaking_part1_thread_annotation'
  | 'speaking_generic_repair'
  | 'speaking_generic_spoken_choice'
  | 'speaking_part2_annotation'
  | 'writing_task2_sentence'
  | 'writing_task2_expression'
  | 'writing_task1_language';

export type EvidenceLedgerSeverity =
  | 'priority_repair'
  | 'better_spoken_choice'
  | 'optional_polish'
  | 'development';

export type EvidenceAnchorStatus = 'anchored' | 'unanchored';

export interface EvidenceAnchor {
  status: EvidenceAnchorStatus;
  start?: number;
  end?: number;
  matchedText?: string;
  reason?: 'missing_source' | 'missing_quote' | 'not_found' | 'ambiguous';
}

export interface EvidenceLedgerItem {
  id: string;
  module: EvidenceLedgerModule;
  sourceKind: EvidenceLedgerSourceKind;
  sourceRef: string;
  prompt?: string;
  sourceText?: string;
  sourceQuote: string;
  issueType: string;
  severity: EvidenceLedgerSeverity;
  original?: string;
  better?: string;
  explanationZh?: string;
  anchor: EvidenceAnchor;
  displayRequired?: boolean;
}

export interface EvidenceLedgerSummary {
  total: number;
  anchored: number;
  unanchored: number;
  displayRequired: number;
  missingDisplayRequired: number;
}

const compactText = (value = '') => value.replace(/\s+/g, ' ').trim();
const stripEvidenceQuestionRefPrefix = (value = '') =>
  value.replace(/^\s*(?:q(?:uestion)?\s*)?\d+\s*[:.)-]\s*/i, '').trim();

const makeEvidenceId = (...parts: Array<string | number | undefined>) =>
  parts
    .map(part => String(part ?? '').trim())
    .filter(Boolean)
    .join('__')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const isWordLikeChar = (char: string) => /[\p{L}\p{N}]/u.test(char);
const isApostropheLike = (char: string) => /['’‘`]/.test(char);

const buildEvidenceSearchText = (text: string) => {
  const normalizedChars: string[] = [];
  const originalIndexes: number[] = [];
  const normalized = text.normalize('NFKC').toLowerCase();
  const appendSpace = (index: number) => {
    if (!normalizedChars.length || normalizedChars[normalizedChars.length - 1] === ' ') return;
    normalizedChars.push(' ');
    originalIndexes.push(index);
  };

  Array.from(normalized).forEach((char, index) => {
    if (isWordLikeChar(char)) {
      normalizedChars.push(char);
      originalIndexes.push(index);
      return;
    }
    if (isApostropheLike(char)) return;
    appendSpace(index);
  });

  while (normalizedChars[0] === ' ') {
    normalizedChars.shift();
    originalIndexes.shift();
  }
  while (normalizedChars[normalizedChars.length - 1] === ' ') {
    normalizedChars.pop();
    originalIndexes.pop();
  }

  return {
    normalized: normalizedChars.join(''),
    originalIndexes,
  };
};

export const normalizeEvidenceText = (text: string) =>
  buildEvidenceSearchText(text).normalized;

const normalizedIndexMatches = (text: string, quote: string) => {
  const search = buildEvidenceSearchText(text);
  const normalizedQuote = normalizeEvidenceText(quote);
  if (!normalizedQuote) return { matches: [], reason: 'missing_quote' as const };

  const matches: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor <= search.normalized.length) {
    const matchIndex = search.normalized.indexOf(normalizedQuote, cursor);
    if (matchIndex < 0) break;
    const normalizedEnd = matchIndex + normalizedQuote.length;
    const originalStart = search.originalIndexes[matchIndex];
    const originalEnd = (search.originalIndexes[normalizedEnd - 1] ?? originalStart) + 1;
    if (Number.isFinite(originalStart) && Number.isFinite(originalEnd) && originalEnd > originalStart) {
      matches.push({ start: originalStart, end: originalEnd });
    }
    cursor = matchIndex + Math.max(normalizedQuote.length, 1);
  }

  return { matches, reason: undefined };
};

export const findEvidenceQuoteSpan = (sourceText = '', sourceQuote = ''): EvidenceAnchor => {
  if (!sourceText.trim()) return { status: 'unanchored', reason: 'missing_source' };
  if (!sourceQuote.trim()) return { status: 'unanchored', reason: 'missing_quote' };

  const { matches, reason } = normalizedIndexMatches(sourceText, sourceQuote);
  if (reason) return { status: 'unanchored', reason };
  if (matches.length === 1) {
    const [match] = matches;
    return {
      status: 'anchored',
      start: match.start,
      end: match.end,
      matchedText: sourceText.slice(match.start, match.end),
    };
  }
  if (matches.length > 1) return { status: 'unanchored', reason: 'ambiguous' };
  return { status: 'unanchored', reason: 'not_found' };
};

const withAnchor = (item: Omit<EvidenceLedgerItem, 'anchor'>): EvidenceLedgerItem => ({
  ...item,
  sourceQuote: compactText(item.sourceQuote),
  original: compactText(item.original),
  better: compactText(item.better),
  explanationZh: compactText(item.explanationZh),
  anchor: (() => {
    const directAnchor = findEvidenceQuoteSpan(item.sourceText || '', item.sourceQuote);
    if (directAnchor.status === 'anchored') return directAnchor;
    const strippedQuote = stripEvidenceQuestionRefPrefix(item.sourceQuote);
    if (strippedQuote && strippedQuote !== item.sourceQuote) {
      const strippedAnchor = findEvidenceQuoteSpan(item.sourceText || '', strippedQuote);
      if (strippedAnchor.status === 'anchored') return strippedAnchor;
    }
    return directAnchor;
  })(),
});

const severityFromPart1Layer = (severity: Part1AnswerAnnotationLayer['severity']): EvidenceLedgerSeverity => {
  if (severity === 'must_fix') return 'priority_repair';
  return severity;
};

const severityFromWriting = (
  severity?: WritingFeedback['sentenceFeedback'][number]['severity'],
): EvidenceLedgerSeverity => {
  if (severity === 'major' || severity === 'medium') return 'priority_repair';
  if (severity === 'minor') return 'better_spoken_choice';
  return 'optional_polish';
};

const threadAnswerSourceMap = (
  feedback: SpeakingFeedback,
  threadAnswers?: SpeakingThreadAnswer[],
) => {
  const answers = threadAnswers?.length ? threadAnswers : feedback.threadAnswers || [];
  return new Map<string, SpeakingThreadAnswer>(answers.map((answer, index) => [`Q${index + 1}`, answer]));
};

const findBestThreadAnswerForQuote = (
  answers: Map<string, SpeakingThreadAnswer>,
  sourceQuote: string,
) => {
  for (const [questionRef, answer] of answers.entries()) {
    if (findEvidenceQuoteSpan(answer.answer, sourceQuote).status === 'anchored') {
      return { questionRef, answer };
    }
  }
  return null;
};

export const buildSpeakingEvidenceLedger = (
  feedback: SpeakingFeedback,
  options: { threadAnswers?: SpeakingThreadAnswer[] } = {},
): EvidenceLedgerItem[] => {
  const items: EvidenceLedgerItem[] = [];
  const answerByQuestionRef = threadAnswerSourceMap(feedback, options.threadAnswers);

  (feedback.threadFeedback?.annotations || []).forEach((annotation, annotationIndex) => {
    const answer = answerByQuestionRef.get(annotation.questionRef);
    annotation.layers.forEach((layer, layerIndex) => {
      items.push(withAnchor({
        id: makeEvidenceId('speaking', 'part1-thread', annotation.questionRef, annotation.id, layerIndex),
        module: 'speaking',
        sourceKind: 'speaking_part1_thread_annotation',
        sourceRef: annotation.questionRef,
        prompt: answer?.question,
        sourceText: answer?.answer || '',
        sourceQuote: annotation.sourceQuote || layer.original,
        issueType: layer.issueType || 'speaking_repair',
        severity: severityFromPart1Layer(layer.severity),
        original: layer.original,
        better: layer.better || annotation.combinedRepair,
        explanationZh: layer.explanationZh,
        displayRequired: layer.severity === 'must_fix',
      }));
    });
  });

  (feedback.part2Feedback?.annotations || []).forEach((annotation, annotationIndex) => {
    annotation.layers.forEach((layer, layerIndex) => {
      items.push(withAnchor({
        id: makeEvidenceId('speaking', 'part2', annotation.id || annotationIndex, layerIndex),
        module: 'speaking',
        sourceKind: 'speaking_part2_annotation',
        sourceRef: 'PART 2',
        prompt: feedback.question,
        sourceText: feedback.transcript,
        sourceQuote: annotation.sourceQuote || layer.original,
        issueType: layer.issueType || 'part2_repair',
        severity: severityFromPart1Layer(layer.severity),
        original: layer.original,
        better: layer.better || annotation.combinedRepair,
        explanationZh: layer.explanationZh,
        displayRequired: layer.severity === 'must_fix',
      }));
    });
  });

  feedback.fatalErrors.forEach((error, index) => {
    const matchedAnswer = feedback.part === 3 ? findBestThreadAnswerForQuote(answerByQuestionRef, error.original) : null;
    items.push(withAnchor({
      id: makeEvidenceId('speaking', 'generic-repair', index, error.tag),
      module: 'speaking',
      sourceKind: 'speaking_generic_repair',
      sourceRef: matchedAnswer?.questionRef || '',
      prompt: matchedAnswer?.answer.question || feedback.question,
      sourceText: matchedAnswer?.answer.answer || feedback.transcript,
      sourceQuote: error.original,
      issueType: error.tag || 'accuracy',
      severity: 'priority_repair',
      original: error.original,
      better: error.correction,
      explanationZh: error.explanationZh,
      displayRequired: true,
    }));
  });

  feedback.naturalnessHints.forEach((hint, index) => {
    const matchedAnswer = feedback.part === 3 ? findBestThreadAnswerForQuote(answerByQuestionRef, hint.original) : null;
    items.push(withAnchor({
      id: makeEvidenceId('speaking', 'spoken-choice', index, hint.tag),
      module: 'speaking',
      sourceKind: 'speaking_generic_spoken_choice',
      sourceRef: matchedAnswer?.questionRef || '',
      prompt: matchedAnswer?.answer.question || feedback.question,
      sourceText: matchedAnswer?.answer.answer || feedback.transcript,
      sourceQuote: hint.original,
      issueType: hint.tag || 'naturalness',
      severity: 'better_spoken_choice',
      original: hint.original,
      better: hint.better,
      explanationZh: hint.explanationZh,
      displayRequired: false,
    }));
  });

  return items;
};

export const buildWritingTask2EvidenceLedger = (feedback: WritingFeedback): EvidenceLedgerItem[] => {
  const items: EvidenceLedgerItem[] = [];
  feedback.sentenceFeedback.forEach((item, index) => {
    const sourceQuote = item.sourceQuote || item.microUpgrades?.[0]?.original || item.original;
    items.push(withAnchor({
      id: makeEvidenceId('writing-task2', 'sentence', item.id || item.correctionNumber || index + 1),
      module: 'writing_task2',
      sourceKind: 'writing_task2_sentence',
      sourceRef: item.paragraph || `C${item.correctionNumber || index + 1}`,
      prompt: feedback.question,
      sourceText: feedback.essay,
      sourceQuote,
      issueType: item.issueType || item.tag || item.dimension,
      severity: severityFromWriting(item.severity),
      original: item.original,
      better: item.correction,
      explanationZh: item.explanationZh,
      displayRequired: item.severity === 'major' || item.severity === 'medium',
    }));
  });

  feedback.vocabularyUpgrade.expressionUpgrades.forEach((item, index) => {
    if (!item.original?.trim()) return;
    items.push(withAnchor({
      id: makeEvidenceId('writing-task2', 'expression', index, item.original),
      module: 'writing_task2',
      sourceKind: 'writing_task2_expression',
      sourceRef: 'language_bank',
      prompt: feedback.question,
      sourceText: feedback.essay,
      sourceQuote: item.original,
      issueType: item.category || 'expression_upgrade',
      severity: 'optional_polish',
      original: item.original,
      better: item.better,
      explanationZh: item.explanationZh,
      displayRequired: false,
    }));
  });

  return items;
};

export const buildWritingTask1EvidenceLedger = (feedback: WritingTask1Feedback): EvidenceLedgerItem[] =>
  feedback.languageCorrections.map((item, index) => withAnchor({
    id: makeEvidenceId('writing-task1', 'language', index, item.original),
    module: 'writing_task1',
    sourceKind: 'writing_task1_language',
    sourceRef: `L${index + 1}`,
    prompt: feedback.instruction,
    sourceText: feedback.report,
    sourceQuote: item.original,
    issueType: 'language_correction',
    severity: 'priority_repair',
    original: item.original,
    better: item.correction,
    explanationZh: item.explanation,
    displayRequired: true,
  }));

export const filterAnchoredEvidence = (items: EvidenceLedgerItem[]) =>
  items.filter(item => item.anchor.status === 'anchored');

export const summarizeEvidenceLedger = (items: EvidenceLedgerItem[]): EvidenceLedgerSummary => {
  const anchored = items.filter(item => item.anchor.status === 'anchored').length;
  const displayRequired = items.filter(item => item.displayRequired).length;
  const missingDisplayRequired = items.filter(item => item.displayRequired && item.anchor.status !== 'anchored').length;
  return {
    total: items.length,
    anchored,
    unanchored: items.length - anchored,
    displayRequired,
    missingDisplayRequired,
  };
};

const annotationSeverityFromEvidence = (severity: EvidenceLedgerSeverity): Part1AnswerAnnotationLayer['severity'] => {
  if (severity === 'priority_repair') return 'must_fix';
  if (severity === 'better_spoken_choice') return 'better_spoken_choice';
  return 'optional_polish';
};

export const evidenceLedgerItemsToPart1Annotations = (
  items: EvidenceLedgerItem[],
  options: { sourceKinds?: EvidenceLedgerSourceKind[] } = {},
): Part1AnswerAnnotation[] => {
  const allowed = options.sourceKinds ? new Set(options.sourceKinds) : null;
  return filterAnchoredEvidence(items)
    .filter(item => !allowed || allowed.has(item.sourceKind))
    .filter(item => item.original && item.better)
    .map((item): Part1AnswerAnnotation => ({
      id: item.id,
      questionRef: item.sourceRef,
      sourceQuote: item.anchor.matchedText || item.sourceQuote,
      combinedRepair: item.better,
      layers: [{
        severity: annotationSeverityFromEvidence(item.severity),
        issueType: item.issueType,
        original: item.original || item.sourceQuote,
        better: item.better || '',
        explanationZh: item.explanationZh || '',
      }],
    }));
};
