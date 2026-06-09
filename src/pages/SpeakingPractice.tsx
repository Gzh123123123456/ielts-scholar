import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { PageShell } from '@/src/components/ui/PageShell';
import { TopBar } from '@/src/components/ui/TopBar';
import { PaperCard } from '@/src/components/ui/PaperCard';
import { SerifButton } from '@/src/components/ui/SerifButton';
import { QuestionBankItem, QuestionBankModal } from '@/src/components/practice/QuestionBankModal';
import { useApp } from '@/src/context/AppContext';
import {
  canUseRealAudioTranscriptionProvider,
  getAIProviderName,
  routedAnalyzePart1LearningAssets,
  routedAnalyzeSpeaking,
  routedCertifyPart1CleanRetry,
  routedTranscribeSpeakingAudio,
} from '@/src/lib/ai';
import { validatePart1ThreadFeedbackIntegrity } from '@/src/lib/ai/part1ThreadIntegrity';
import { buildSpeakingTranscriptionHints } from '@/src/lib/ai/transcriptionHints';
import { formatBandEstimate, formatConservativeBandEstimate } from '@/src/lib/bands';
import {
  Part1TopicThreadSet,
  speakingPart1,
  speakingPart1TopicThreads,
  speakingPart2,
  speakingPart3,
  SpeakingQuestion,
} from '@/src/data/speaking/activeSpeakingBank';
import type {
  Part1AnswerAnnotation,
  Part1AnswerAnnotationLayer,
  Part1CleanRetryAnswer,
  Part1DevelopmentTarget,
  Part1DisplayedCleanRetryCertificationStatus,
  Part1LearningAssetsResult,
  Part1RetryReferenceContext,
  Part1SessionPriorityState,
  ProviderDiagnostic,
  Part2LanguageSignalCheck,
  SpeakingFeedback,
  SpeakingMaterialBankItem,
  SpeakingThreadAnswer,
} from '@/src/lib/ai/schemas';
import {
  buildMarkdownExportFilename,
  buildSpeakingTrainingMarkdown,
  formatPart1IssueTypeLabel,
} from '@/src/lib/markdownExport';
import {
  buildPart1LearningDisplayModel,
  evaluatePart1LearningPayloadQuality,
  findPart1AnnotationDisplaySpans,
  normalizePart1LearnerText,
  normalizePart1TranscriptDisplayText,
  part1DevelopmentChunkKey,
  part1LearningItemKey,
} from '@/src/lib/part1LearningDisplayModel';
import {
  isHighBandStableState,
  resolveSpeakingTargetState,
} from '@/src/lib/scoreLayer';
import {
  ActiveSpeakingPracticeSession,
  createRecordId,
  SpeakingPracticeRecord,
  summarizeDiagnostic,
} from '@/src/lib/practiceRecords';
import {
  listPracticeRecords,
  getActiveSpeakingSession,
  saveActiveSpeakingSession,
  upsertPracticeRecord,
  clearActiveSpeakingSession,
} from '@/src/lib/practiceRepository';
import { Mic, Square, RefreshCcw, Send, ArrowRight, FileDown, Edit3, Info, BookOpen, X } from 'lucide-react';

type TranscriptionSource = 'browser' | 'audio' | 'manual';
type LockedThreadAnswer = NonNullable<SpeakingPracticeRecord['threadAnswers']>[number];
type CaptureContext = {
  token: number;
  attemptId: string;
  part: 1 | 2 | 3;
  threadId?: string;
  questionId?: string;
  threadIndex?: number;
};
type Part1TopicBucket = {
  topicId: string;
  topic: string;
  threads: Part1TopicThreadSet[];
};
type Part2AlternativeUpgrade = NonNullable<Part2LanguageSignalCheck['alternativeUpgrades']>[number];
type Part2SignalDisplayUpgrade = {
  source: 'best' | 'alternative';
  upgrade: string;
  sourceQuote?: string;
  guidanceZh?: string;
  insertLocationZh?: string;
  sampleUpgrade?: string;
  sampleUpgradeHighlight?: string;
  kind?: 'replace' | 'add';
};

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const normalizePart1InlineTranscriptSegment = (
  text: string,
  options: { treatInitialAsSentenceStart?: boolean } = {},
) => {
  const leading = text.match(/^\s+/)?.[0]?.replace(/[^\S\r\n]+/g, ' ') || '';
  const trailing = text.match(/\s+$/)?.[0]?.replace(/[^\S\r\n]+/g, ' ') || '';
  const core = text.trim();
  const normalizedCore = core ? normalizePart1TranscriptDisplayText(core, options) : '';
  return `${leading}${normalizedCore}${trailing}`;
};

const hasLowSignalSpeakingText = (text: string) => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ').filter(Boolean);
  const uniqueWords = new Set(words);
  return normalized.replace(/\s/g, '').length < 12 || (words.length >= 4 && uniqueWords.size <= 2);
};

const hasMeaningfulBrowserTranscript = (text: string) => !hasLowSignalSpeakingText(text);

const pickRandomItem = <T,>(items: T[]) =>
  items[Math.floor(Math.random() * items.length)];

const recordTimestampValue = (record: Pick<SpeakingPracticeRecord, 'analyzedAt' | 'updatedAt' | 'createdAt'>) => {
  const timestamp = Date.parse(record.analyzedAt || record.updatedAt || record.createdAt);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',')[1] : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read audio blob.'));
    reader.readAsDataURL(blob);
  });

const isInsufficientSpeakingSample = (
  text: string,
  speakingPart: 1 | 2 | 3,
  currentFeedback?: SpeakingFeedback | null,
) => {
  const words = countWords(text);
  if (currentFeedback?.fatalErrors.some(error => error.tag === 'insufficient_sample')) return true;
  if (currentFeedback?.upgradedAnswer.toLowerCase().includes('insufficient sample')) return true;
  if (hasLowSignalSpeakingText(text)) return true;
  if (speakingPart === 1) return words <= 8;
  if (speakingPart === 2) return words < 60;
  return words < 35;
};

const isHighBandSpeakingStable = (feedback?: SpeakingFeedback | null) =>
  Boolean(
    feedback &&
    isHighBandStableState(feedback.targetState || resolveSpeakingTargetState(feedback)),
  );

const validSpeakingBandRange = (feedback: SpeakingFeedback) => {
  const range = feedback.bandEstimateRange;
  if (!range) return null;
  const lower = Number(range.lower);
  const upper = Number(range.upper);
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return null;
  if (lower <= 0 || upper <= lower) return null;
  if (Math.round(lower * 2) !== lower * 2 || Math.round(upper * 2) !== upper * 2) return null;
  if (Math.round((upper - lower) * 2) !== 1) return null;
  return { lower, upper, rationaleZh: range.rationaleZh };
};

const speakingCurrentLowerBound = (feedback: SpeakingFeedback) =>
  validSpeakingBandRange(feedback)?.lower ?? feedback.bandEstimateExcludingPronunciation;

const speakingTargetHeading = (feedback: SpeakingFeedback) => {
  if (isHighBandSpeakingStable(feedback)) return 'STANDARD ANSWER';
  if (speakingCurrentLowerBound(feedback) < 7) return 'BAND 7 TARGET ANSWER';
  return 'BAND 7+ TARGET ANSWER';
};

const answerDevelopmentPlan = (speakingPart: 1 | 2 | 3, prompt = '') => {
  const questionReference = prompt ? `Current question: ${prompt}` : 'Build around the current question first.';
  const starter = speakingPart === 1
    ? 'Starter: I would say yes, mainly because...'
    : speakingPart === 2
      ? 'Starter: I want to talk about a time when...'
      : 'Starter: In my view, this depends on the situation...';
  const items = speakingPart === 1
    ? [
      'Give a direct answer; do not only say yes or no.',
      'Add one specific personal detail, such as time, place, person, or frequency.',
      'Explain one short reason so the answer feels complete.',
    ]
    : speakingPart === 2
      ? [
        'Set the scene: person, place, time, or starting point.',
        'Develop two concrete details instead of only giving a conclusion.',
        'Explain your feeling, change, or why it mattered.',
        'End the story naturally.',
      ]
      : [
        'State a clear position first.',
        'Compare two situations or two groups of people.',
        'Add one realistic example.',
        'Explain the wider consequence behind the example.',
      ];

  return { questionReference, starter, items };
};

const starterPracticePlan = (speakingPart: 1 | 2 | 3, prompt = '') => {
  const items = speakingPart === 1
    ? [
      'Direct answer: Yes / No / It depends.',
      'Detail: what kind, when, where, or how often.',
      'Reason: why you like it, dislike it, or do it.',
      'Stop after 2-4 spoken sentences.',
    ]
    : speakingPart === 2
      ? [
        'Introduce the person, place, time, or activity.',
        'Add two concrete details instead of only giving a conclusion.',
        'Explain your feeling, change, or why it mattered.',
        'End the story naturally.',
      ]
      : [
        'State a clear position first.',
        'Compare two situations or two groups of people.',
        'Add one realistic example.',
        'Explain the wider consequence.',
      ];
  const targetAnswer = speakingPart === 1 && /^do you/i.test(prompt.trim())
    ? 'Yes, I do. I usually [specific detail] when I want to relax. It helps me [personal reason].'
    : speakingPart === 1
      ? 'I usually [direct answer]. For example, [specific detail]. I like it because [personal reason].'
      : speakingPart === 2
        ? 'I want to talk about [person/place/activity]. It happened / happens [time or place]. The main reason I remember it is [personal reason].'
        : 'In my view, [direct position]. This is because [reason]. For example, [specific example]. So I think [balanced close].';

  return {
    questionReference: prompt ? `Current question: ${prompt}` : 'Build one complete answer for the current question first.',
    items,
    targetAnswer,
  };
};

const isIncompleteSpeakingFeedback = (
  feedback: SpeakingFeedback,
  failureKind?: string,
) => {
  const placeholderAnswer = /provider returned incomplete feedback|please retry analysis|malformed or incomplete/i.test(feedback.upgradedAnswer);
  const scores = [
    feedback.bandEstimateExcludingPronunciation,
    feedback.scores.fluencyCoherence,
    feedback.scores.lexicalResource,
    feedback.scores.grammaticalRangeAccuracy,
  ];
  const allScoresMissing = scores.every(score => !Number.isFinite(score) || score <= 0);
  const hasIntentionalInsufficientGuidance = feedback.fatalErrors.some(error => error.tag === 'insufficient_sample')
    || /insufficient sample|starter outline/i.test(feedback.upgradedAnswer);
  const hasCoreFeedback = feedback.fatalErrors.length > 0
    || feedback.naturalnessHints.length > 0
    || feedback.band9Refinements.length > 0
    || feedback.preservedStyle.length > 0
    || Boolean(feedback.upgradedAnswer.trim() && !placeholderAnswer);

  if (failureKind === 'parse_or_schema' && allScoresMissing) return true;
  if (hasIntentionalInsufficientGuidance) return false;
  if (placeholderAnswer) return true;
  if (allScoresMissing && !hasCoreFeedback) return true;
  return failureKind === 'parse_or_schema' && (allScoresMissing || !hasCoreFeedback);
};

const materialExpansionFallback = (speakingPart: 1 | 2 | 3) => {
  if (speakingPart === 1) return 'Add one real detail and one short reason; keep it brief.';
  if (speakingPart === 2) return 'Build it into a story spine with scene, action, change, feeling, and meaning.';
  return 'Turn the personal material into a claim, contrast or condition, example, and consequence.';
};

const part2MaterialTypeLabel = (value?: string) => {
  if (value === 'person') return 'Person';
  if (value === 'place') return 'Place';
  if (value === 'object') return 'Object';
  if (value === 'experience_event') return 'Experience / event';
  if (value === 'abstract_or_opinion_experience') return 'Abstract / opinion-shaped';
  return 'Unclear material';
};

const part2StoryRoleLabel = (value: string) => {
  const labels: Record<string, string> = {
    what_who_where: 'What / who / where',
    background: 'Background',
    concrete_details: 'Concrete details',
    what_happened: 'What happened',
    feeling: 'How I felt',
    why_it_mattered: 'Why it mattered',
    current_or_future_influence: 'Current / future influence',
  };
  return labels[value] || value.replace(/_/g, ' ');
};

const part2StoryStatusLabel = (value: string) => {
  const labels: Record<string, string> = {
    present: 'Present',
    thin: 'Thin',
    missing: 'Missing',
    suggested_confirm: 'Confirm',
  };
  return labels[value] || value;
};

const part2LanguageSignalOrder = [
  'idiomatic_expression',
  'tense',
  'connector',
  'phrasal_verb',
  'collocation',
  'clause',
] as const;

const part2LanguageSignalRank = new Map<string, number>(
  part2LanguageSignalOrder.map((signal, index) => [signal, index]),
);

const part2LanguageSignalLabel = (value: string) => {
  const labels: Record<string, string> = {
    idiomatic_expression: 'Idiomatic expression',
    tense: 'Tense',
    connector: 'Connector',
    phrasal_verb: 'Phrasal verb',
    collocation: 'Collocation',
    clause: 'Clause',
  };
  return labels[value] || value.replace(/_/g, ' ');
};

const part2LanguageSignalStatusLabel = (value: string) => {
  const labels: Record<string, string> = {
    strong: 'Strong',
    usable: 'Usable',
    thin: 'Thin',
    missing: 'Missing',
    not_needed: 'Not needed',
  };
  return labels[value] || value;
};

const part2LanguageSignalDotClass = (status: string) =>
  status === 'strong' || status === 'usable'
    ? 'bg-accent-terracotta'
    : status === 'missing'
      ? 'bg-paper-ink/25'
      : 'bg-accent-terracotta/45';

const part2LanguageSignalEvidence = (signal: Part2LanguageSignalCheck) =>
  (signal.evidenceQuotes?.length ? signal.evidenceQuotes : signal.evidence ? [signal.evidence] : [])
    .filter(Boolean)
    .slice(0, 2);

const part2LanguageSignalSampleSentence = (signal: Part2LanguageSignalCheck) => {
  const samples = [
    signal.sampleUpgrade,
    ...(signal.sampleUpgrades || []),
    signal.usedInNextVersionQuote,
  ].filter((item): item is string => Boolean(item?.trim()));
  const highlight = (signal.sampleUpgradeHighlight || signal.bestUpgrade).trim().toLowerCase();
  const upgrade = signal.bestUpgrade.trim().toLowerCase();
  if (!samples.length) return '';
  if (!highlight && !upgrade) return samples[0];
  return samples.find(sample => highlight && sample.toLowerCase().includes(highlight))
    || samples.find(sample => upgrade && sample.toLowerCase().includes(upgrade))
    || samples[0];
};

const part2LanguageSignalSampleHighlight = (signal: Part2LanguageSignalCheck, sentence: string) => {
  const cleanSentence = sentence.trim().toLowerCase();
  const providerHighlight = signal.sampleUpgradeHighlight?.trim();
  if (providerHighlight && cleanSentence.includes(providerHighlight.toLowerCase())) return providerHighlight;
  const bestUpgrade = signal.bestUpgrade.trim();
  if (bestUpgrade && cleanSentence.includes(bestUpgrade.toLowerCase())) return bestUpgrade;
  return '';
};

const renderPart2SignalSampleSentence = (sentence: string, upgrade: string) => {
  const cleanSentence = sentence.trim();
  const cleanUpgrade = upgrade.trim();
  if (!cleanSentence) return null;
  if (!cleanUpgrade) return cleanSentence;
  const start = cleanSentence.toLowerCase().indexOf(cleanUpgrade.toLowerCase());
  if (start < 0) return cleanSentence;
  return (
    <>
      {cleanSentence.slice(0, start)}
      <span className="font-bold text-accent-terracotta">
        {cleanSentence.slice(start, start + cleanUpgrade.length)}
      </span>
      {cleanSentence.slice(start + cleanUpgrade.length)}
    </>
  );
};

const part2SignalUpgradeKey = (signal: Part2LanguageSignalCheck['signal'], upgrade: string) =>
  `${signal}:${upgrade.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`;

const part2DisplayBestUpgrade = (signal: Part2LanguageSignalCheck): Part2SignalDisplayUpgrade | null => {
  const upgrade = signal.bestUpgrade.trim();
  if (!upgrade) return null;
  return {
    source: 'best',
    upgrade,
    sampleUpgrade: signal.sampleUpgrade,
    sampleUpgradeHighlight: signal.sampleUpgradeHighlight,
  };
};

const part2DisplayAlternativeUpgrades = (signal: Part2LanguageSignalCheck): Part2SignalDisplayUpgrade[] => {
  const seen = new Set<string>();
  const append = (item: Part2SignalDisplayUpgrade | null) => {
    if (!item?.upgrade.trim()) return null;
    const key = part2SignalUpgradeKey(signal.signal, item.upgrade);
    if (seen.has(key)) return null;
    seen.add(key);
    return item;
  };

  const richAlternatives = (signal.alternativeUpgrades || [])
    .map((item: Part2AlternativeUpgrade): Part2SignalDisplayUpgrade | null => append({
      source: 'alternative',
      upgrade: item.upgrade,
      sourceQuote: item.sourceQuote,
      guidanceZh: item.guidanceZh,
      insertLocationZh: item.insertLocationZh,
      sampleUpgrade: item.sampleUpgrade,
      sampleUpgradeHighlight: item.sampleUpgradeHighlight,
      kind: item.kind,
    }))
    .filter((item): item is Part2SignalDisplayUpgrade => Boolean(item));

  const legacyAlternatives = signal.alternatives
    .map((upgrade): Part2SignalDisplayUpgrade | null => append({
      source: 'alternative',
      upgrade,
    }))
    .filter((item): item is Part2SignalDisplayUpgrade => Boolean(item));

  const bestKey = part2SignalUpgradeKey(signal.signal, signal.bestUpgrade);
  return [...richAlternatives, ...legacyAlternatives]
    .filter(item => part2SignalUpgradeKey(signal.signal, item.upgrade) !== bestKey);
};

const part2SignalDisplaySampleSentence = (
  signal: Part2LanguageSignalCheck,
  upgrade: Part2SignalDisplayUpgrade,
) => {
  if (upgrade.source === 'alternative') return upgrade.sampleUpgrade?.trim() || '';
  return part2LanguageSignalSampleSentence(signal);
};

const part2SignalDisplaySampleHighlight = (
  signal: Part2LanguageSignalCheck,
  upgrade: Part2SignalDisplayUpgrade,
  sentence: string,
) => {
  const providerHighlight = upgrade.sampleUpgradeHighlight?.trim();
  if (providerHighlight && sentence.toLowerCase().includes(providerHighlight.toLowerCase())) return providerHighlight;
  if (upgrade.upgrade && sentence.toLowerCase().includes(upgrade.upgrade.toLowerCase())) return upgrade.upgrade;
  return upgrade.source === 'best' ? part2LanguageSignalSampleHighlight(signal, sentence) : '';
};

const part1AnnotationSeverityLabel = (severity: Part1AnswerAnnotationLayer['severity']) => {
  if (severity === 'must_fix') return 'MUST FIX';
  if (severity === 'better_spoken_choice') return 'BETTER SPOKEN CHOICE';
  return 'OPTIONAL POLISH';
};

const part1AnnotationLayerLabel = (layer: Part1AnswerAnnotationLayer) =>
  layer.origin === 'previous_cleaner_answer_conflict'
    ? 'PREVIOUS CLEANER ANSWER CONFLICT'
    : part1AnnotationSeverityLabel(layer.severity);

const part1AnnotationHeaderLabel = (annotation: Part1AnswerAnnotation) =>
  annotation.layers.some(layer => layer.origin === 'previous_cleaner_answer_conflict')
    ? 'PREVIOUS CLEANER ANSWER CONFLICT'
    : part1AnnotationSeverityLabel(strongestPart1AnnotationSeverity(annotation));

const concisePart1LayerExplanation = (text: string) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  const pieces = clean.match(/[^。！？.!?]+[。！？.!?]?/g)?.map(item => item.trim()).filter(Boolean) || [clean];
  return pieces.slice(0, 2).join(' ');
};

const strongestPart1AnnotationSeverity = (annotation: Part1AnswerAnnotation) => {
  if (annotation.layers.some(layer => layer.severity === 'must_fix')) return 'must_fix';
  if (annotation.layers.some(layer => layer.severity === 'better_spoken_choice')) return 'better_spoken_choice';
  return 'optional_polish';
};

const renderTextWithBreaks = (text: string) => text.split('\n').flatMap((line, index) =>
  index === 0 ? [line] : [<br key={`br-${index}`} />, line],
);

type Part1AnnotationSpan = {
  annotation: Part1AnswerAnnotation;
  start: number;
  end: number;
  visibleText: string;
};

const severityRank: Record<Part1AnswerAnnotationLayer['severity'], number> = {
  must_fix: 0,
  better_spoken_choice: 1,
  optional_polish: 2,
};

const sortPart1AnnotationLayers = (layers: Part1AnswerAnnotationLayer[]) =>
  [...layers].sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

const normalizePart1MatchChar = (char: string) =>
  char
    .normalize('NFKC')
    .replace(/[‘’‚`]/g, "'")
    .replace(/[“”„]/g, '"')
    .toLowerCase();

const buildPart1SearchText = (text: string) => {
  let normalized = '';
  const originalIndexes: number[] = [];
  let pendingWhitespaceIndex: number | null = null;

  Array.from(text).forEach((char, arrayIndex) => {
    const originalIndex = [...text].slice(0, arrayIndex).join('').length;
    if (/\s/.test(char)) {
      pendingWhitespaceIndex = pendingWhitespaceIndex ?? originalIndex;
      return;
    }
    if (pendingWhitespaceIndex !== null && normalized) {
      normalized += ' ';
      originalIndexes.push(pendingWhitespaceIndex);
    }
    pendingWhitespaceIndex = null;
    const normalizedChar = normalizePart1MatchChar(char);
    Array.from(normalizedChar).forEach(part => {
      normalized += part;
      originalIndexes.push(originalIndex);
    });
  });

  return { normalized, originalIndexes };
};

const normalizePart1SourceQuote = (text: string) =>
  buildPart1SearchText(text).normalized.trim();

const normalizePart1LineageText = (text: string) =>
  normalizePart1SourceQuote(text).replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ').trim();

const normalizePart1ComparableAnswerText = (text: string) =>
  normalizePart1LineageText(text)
    .replace(/\b(that s|that is|it s|it is)\b/g, match => match.replace(/\s+/g, "'"))
    .trim();

const part1CertificationPassed = (status?: Part1DisplayedCleanRetryCertificationStatus) =>
  status === 'certified_first_attempt' || status === 'certified_after_rewrite';

const consolidatePart1DevelopmentTargets = (targets: Part1DevelopmentTarget[] = []): Part1DevelopmentTarget[] => {
  const byQuestion = new Map<string, Part1DevelopmentTarget>();
  targets.forEach(target => {
    const refs = target.questionRef.split('/').map(ref => ref.trim()).filter(Boolean);
    if (refs.length > 1) {
      refs.forEach(ref => {
        if (!byQuestion.has(ref)) byQuestion.set(ref, { ...target, questionRef: ref });
      });
      return;
    }
    if (!byQuestion.has(target.questionRef)) byQuestion.set(target.questionRef, target);
  });
  return Array.from(byQuestion.values()).sort(
    (left, right) => Number(left.questionRef.replace(/^Q/i, '')) - Number(right.questionRef.replace(/^Q/i, '')),
  );
};

export const derivePart1SessionPriorityState = (source: SpeakingFeedback | null | undefined): Part1SessionPriorityState | null => {
  const thread = source?.threadFeedback;
  if (!source || source.sessionKind !== 'part1_topic_thread' || !thread) return null;
  const hasOrdinaryMustFix = Boolean(
    thread.mustFix.some(item => item.origin !== 'previous_cleaner_answer_conflict') ||
    thread.annotations?.some(annotation =>
      annotation.layers.some(layer => layer.severity === 'must_fix' && layer.origin !== 'previous_cleaner_answer_conflict'),
    ) ||
    source.fatalErrors.length,
  );
  const hasPreviousCleanerConflict = Boolean(
    (thread.previousCleanerConflictCount || 0) > 0 ||
    thread.annotations?.some(annotation =>
      annotation.layers.some(layer => layer.origin === 'previous_cleaner_answer_conflict'),
    ),
  );
  if (hasOrdinaryMustFix) return 'core_repair_needed';
  if (hasPreviousCleanerConflict) return 'system_revision_conflict';
  if (part1CertificationPassed(thread.cleanRetryCertificationStatus) && thread.developmentTargets?.length) {
    return 'development_needed';
  }
  if (part1CertificationPassed(thread.cleanRetryCertificationStatus)) return 'topic_complete';
  return thread.part1SessionPriorityState || null;
};

export const derivePart1ThreadStable = (source: SpeakingFeedback | null | undefined) =>
  derivePart1SessionPriorityState(source) === 'topic_complete';

const withDerivedPart1SessionPriorityState = (source: SpeakingFeedback): SpeakingFeedback => {
  if (!source.threadFeedback) return source;
  const developmentTargets = consolidatePart1DevelopmentTargets(source.threadFeedback.developmentTargets || []);
  const state = derivePart1SessionPriorityState(source) || source.threadFeedback.part1SessionPriorityState || 'core_repair_needed';
  const next: SpeakingFeedback = {
    ...source,
    threadFeedback: {
      ...source.threadFeedback,
      part1SessionPriorityState: state,
      developmentStatus: developmentTargets.length ? 'needed' : 'sufficient',
      developmentTargets,
    },
    obsidianMarkdown: '',
  };
  return {
    ...next,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
  };
};

const withClearedPart1LearningAssets = (source: SpeakingFeedback): SpeakingFeedback => {
  if (source.sessionKind !== 'part1_topic_thread' || !source.threadFeedback) return source;
  const next: SpeakingFeedback = {
    ...source,
    threadFeedback: {
      ...source.threadFeedback,
      developmentStatus: 'sufficient',
      developmentTargets: [],
      threadLevelPatterns: [],
      answerByAnswerCoaching: [],
      highImpactPhraseFixes: [],
      materialBank: {
        myUsableMaterial: [],
        reusableSpokenLanguage: [],
      },
      optionalPolish: [],
    },
    obsidianMarkdown: '',
  };
  return {
    ...next,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
  };
};

const withPart1LearningAssets = (
  source: SpeakingFeedback,
  assets: Part1LearningAssetsResult,
): SpeakingFeedback => {
  if (source.sessionKind !== 'part1_topic_thread' || !source.threadFeedback) return source;
  const developmentTargets = consolidatePart1DevelopmentTargets(assets.developmentTargets || []);
  const next: SpeakingFeedback = {
    ...source,
    threadFeedback: {
      ...source.threadFeedback,
      developmentStatus: developmentTargets.length ? 'needed' : 'sufficient',
      developmentTargets,
      threadLevelPatterns: [],
      answerByAnswerCoaching: [],
      highImpactPhraseFixes: [],
      materialBank: {
        myUsableMaterial: assets.materialBank.myUsableMaterial || [],
        reusableSpokenLanguage: assets.materialBank.reusableSpokenLanguage || [],
      },
      optionalPolish: [],
    },
    obsidianMarkdown: '',
  };
  return {
    ...next,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
  };
};

type Part1LearningCandidateSnapshot = {
  feedback: SpeakingFeedback;
  quality: ReturnType<typeof evaluatePart1LearningPayloadQuality>;
  developmentCount: number;
  developmentChunkCount: number;
  expressionCount: number;
  materialCount: number;
  score: number;
};

const summarizePart1LearningCandidate = (
  feedback: SpeakingFeedback,
  answers: SpeakingThreadAnswer[],
): Part1LearningCandidateSnapshot => {
  const display = buildPart1LearningDisplayModel(feedback.threadFeedback, { answers });
  const quality = evaluatePart1LearningPayloadQuality(feedback.threadFeedback, answers);
  const developmentChunkCount = display.answerCoaching.reduce(
    (total, target) => total + (target.phraseChunks || []).length,
    0,
  );
  const score =
    display.answerCoaching.length * 120 +
    developmentChunkCount * 8 +
    display.expressionBank.length * 10 +
    display.userMaterials.length * 35 -
    quality.issues.length * 20;
  return {
    feedback,
    quality,
    developmentCount: display.answerCoaching.length,
    developmentChunkCount,
    expressionCount: display.expressionBank.length,
    materialCount: display.userMaterials.length,
    score,
  };
};

const part1LearningSnapshotNeedsRepair = (
  snapshot: Part1LearningCandidateSnapshot,
  answerCount: number,
) =>
  snapshot.developmentCount < answerCount ||
  snapshot.developmentChunkCount < answerCount * 5 ||
  snapshot.expressionCount < 10 ||
  snapshot.materialCount === 0;

const buildPart1LearningRepairFocus = (
  snapshot: Part1LearningCandidateSnapshot,
  answerCount: number,
) => [
  `This is a gap-fill pass for visible learner-facing Part 1 learning assets. Do not rescore or rewrite clean answers.`,
  `Development must appear for every submitted answer: visible ${snapshot.developmentCount}/${answerCount}, visible chunks ${snapshot.developmentChunkCount}. Missing refs: ${snapshot.quality.missingDevelopmentRefs.join(', ') || 'none'}. Thin refs: ${snapshot.quality.thinDevelopmentRefs.join(', ') || 'none'}.`,
  `For each answer, give 5-8 useful phraseChunks. Give alternative expressions and nearby topic language, not grammar fixes, source-to-replacement pairs, or labels such as fix/correct/replace/修正/替代. Prefer spoken corpus blocks with verbs/collocations, not one-word nouns and not mechanical labels.`,
  `Reusable spoken language must show at least 10 useful current-topic items, preferably 12-20. Visible count is ${snapshot.expressionCount}.`,
  `Reusable material visible count is ${snapshot.materialCount}. If the learner supplied a recoverable stance, preference, reason, habit, feeling, fact, or answer angle, return 2-4 paraphrased or lightly expanded material sentences with matching Chinese translations. Do not repeat the learner's original sentence or clean retry sentence unchanged, and do not start developedExample with disposable lead-ins like yes/no/absolutely/definitely/of course/not really.`,
].join(' ');

const part1MaterialStopWords = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'i', 'im', 'ive', 'id', 'me', 'my', 'mine', 'we', 'our', 'us',
  'it', 'its', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'from',
  'that', 'this', 'these', 'those', 'there', 'here', 'really', 'very', 'quite', 'usually', 'often', 'sometimes',
  'hometown', 'city', 'place', 'people', 'thing', 'topic', 'something', 'someone', 'somewhere',
]);

const part1MaterialText = (item: Pick<SpeakingMaterialBankItem, 'sourceWording' | 'reusableVersion' | 'materialCore'>) =>
  `${item.materialCore || ''} ${item.reusableVersion || ''} ${item.sourceWording || ''}`;

const part1MaterialTokens = (item: Pick<SpeakingMaterialBankItem, 'sourceWording' | 'reusableVersion'>) =>
  Array.from(new Set(normalizePart1LineageText(part1MaterialText(item).replace(/\[[^\]]+\]/g, ' '))
    .replace(/\bmy\s+\w+\b/g, ' ')
    .split(' ')
    .filter(token => token.length > 2 && !part1MaterialStopWords.has(token))));

const part1MaterialSpecificity = (item: SpeakingMaterialBankItem) => {
  const text = part1MaterialText(item);
  const properNounSignals = (text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || []).length;
  const reusableWords = normalizePart1LineageText(item.reusableVersion).split(' ').filter(Boolean).length;
  const sourceWords = normalizePart1LineageText(item.sourceWording || '').split(' ').filter(Boolean).length;
  return part1MaterialTokens(item).length + properNounSignals + Math.min(reusableWords, 18) / 10 + Math.min(sourceWords, 18) / 20;
};

const part1MaterialGenericPenalty = (item: SpeakingMaterialBankItem) => {
  const text = part1MaterialText(item);
  const bracketCount = (text.match(/\[[^\]]+\]/g) || []).length;
  const genericSignals = (normalizePart1LineageText(text).match(/\b(hometown|city|place|thing|people|something|someone|somewhere)\b/g) || []).length;
  return bracketCount * 3 + genericSignals * 0.4;
};

const isUsefulPart1DisplayMaterial = (item: SpeakingMaterialBankItem) => {
  const text = normalizePart1LineageText(part1MaterialText(item));
  if (!text) return false;
  if (/^(yes|yeah|no|sure|definitely|absolutely|of course|not really)$/i.test(text)) return false;
  if (/^my hometown is [a-z]+(?: i was born and raised here)?$/i.test(text)) return false;
  if (/^it is a [a-z-]+(?: [a-z-]+){0,2} city$/i.test(text)) return false;
  const hasPersonalSignal = /\b(i|im|ive|id|me|my|mine|we|were|weve|our|us)\b/.test(text);
  const hasValueSignal = /\b(because|so|although|though|but|rather than|instead of|prefer|like|enjoy|miss|missed|feel|felt|family|friend|friends|college|university|school|team|club|match|game|nba|e-?sports?|point guard|captain|role|years?|months?|born|raised|childhood|lived|living|grew up|moved|returned|spent|used to|usually|often)\b/.test(text);
  const hasDevelopmentField = Boolean(item.materialCore || item.developmentMoveZh || item.developedExample || item.expressionFrames?.length);
  return hasPersonalSignal && hasValueSignal && hasDevelopmentField && part1MaterialTokens(item).length >= 3;
};

const isPart1DevelopmentSeedMaterial = (item: SpeakingMaterialBankItem) =>
  item.materialKind === 'development_seed';

const isUsefulPart1DevelopmentSeed = (item: SpeakingMaterialBankItem) => {
  if (!isPart1DevelopmentSeedMaterial(item)) return false;
  const text = normalizePart1LineageText(`${item.materialCore || ''} ${item.sourceWording || ''} ${(item.expressionFrames || []).join(' ')}`);
  if (!text) return false;
  if (/^(yes|yeah|no|sure|definitely|absolutely|of course|not really)$/i.test(text)) return false;
  return Boolean(item.materialCore || item.developmentMoveZh || item.expressionFrames?.length);
};

const isUsefulPart1ReusableMaterial = (item: SpeakingMaterialBankItem) =>
  !isPart1DevelopmentSeedMaterial(item) && isUsefulPart1DisplayMaterial(item);

const isLowValuePart1ThreadPattern = (item: { observationZh: string; whyItMattersZh: string; retryRule: string }) => {
  const text = normalizePart1LineageText(`${item.observationZh} ${item.whyItMattersZh} ${item.retryRule}`);
  if (!text) return true;
  const purePraise = /\b(accurate|direct|natural|clear|stable|good|strong|complete|sufficient|no major|no obvious|well answered)\b/.test(text) &&
    !/\b(need|needs|add|repair|fix|avoid|limit|thin|short|underdeveloped|error|mistake|grammar|range|specific|detail|reason|contrast)\b/.test(text);
  return purePraise;
};

const isSamePart1MaterialSlot = (left: SpeakingMaterialBankItem, right: SpeakingMaterialBankItem) => {
  const leftCore = normalizePart1LineageText(left.materialCore || '');
  const rightCore = normalizePart1LineageText(right.materialCore || '');
  if (leftCore && rightCore && (leftCore === rightCore || leftCore.includes(rightCore) || rightCore.includes(leftCore))) return true;
  const leftTokens = part1MaterialTokens(left);
  const rightTokens = part1MaterialTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;
  const rightSet = new Set(rightTokens);
  const overlap = leftTokens.filter(token => rightSet.has(token)).length;
  const smaller = Math.min(leftTokens.length, rightTokens.length);
  const larger = Math.max(leftTokens.length, rightTokens.length);
  const leftKey = leftTokens.join(' ');
  const rightKey = rightTokens.join(' ');
  if (leftKey === rightKey) return true;
  if (smaller >= 4 && (leftKey.includes(rightKey) || rightKey.includes(leftKey))) return true;
  if (smaller >= 3 && (leftKey.includes(rightKey) || rightKey.includes(leftKey)) && (larger - smaller) <= 3) return true;
  if ((part1MaterialGenericPenalty(left) > 0 || part1MaterialGenericPenalty(right) > 0) && smaller >= 2 && overlap / smaller >= 1) return true;
  const hasRelationshipAttachmentSlot = (tokens: string[]) => {
    const relationship = tokens.some(token => /^(famil|friend|relative|parent|sibling|classmate|mate|people)$/.test(token));
    const locationOrAttachment = tokens.some(token => /^(attach|connect|stay|live|nearby|close|here|there|home|hometown|belong|support)$/.test(token));
    return relationship && locationOrAttachment;
  };
  if (hasRelationshipAttachmentSlot(leftTokens) && hasRelationshipAttachmentSlot(rightTokens)) return true;
  const socialAttachment = (tokens: string[]) =>
    tokens.some(token => /^famil/.test(token) || /^friend/.test(token)) &&
    tokens.some(token => /^(attach|connect|stay|live|there|close)/.test(token));
  const sharedFamilyOrFriends = (tokens: string[]) => tokens.some(token => /^famil/.test(token) || /^friend/.test(token));
  if (sharedFamilyOrFriends(leftTokens) && sharedFamilyOrFriends(rightTokens) && overlap >= 2) return true;
  if (socialAttachment(leftTokens) && socialAttachment(rightTokens) && overlap >= 2) return true;
  return smaller >= 4 && overlap / smaller >= 0.86 && overlap / larger >= 0.62;
};

export const mergePart1MyUsableMaterialForRetry = (
  carried: SpeakingMaterialBankItem[] = [],
  fresh: SpeakingMaterialBankItem[] = [],
) => {
  const merged: SpeakingMaterialBankItem[] = [];
  let dedupedCount = 0;

  const mergeOneMaterialItem = (item: SpeakingMaterialBankItem) => {
    if (!isUsefulPart1DisplayMaterial(item)) {
      if (part1MaterialGenericPenalty(item) > 0) dedupedCount += 1;
      return;
    }
    const existingIndex = merged.findIndex(existing => isSamePart1MaterialSlot(existing, item));
    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      const incomingWins = (part1MaterialSpecificity(item) - part1MaterialGenericPenalty(item)) >
        (part1MaterialSpecificity(existing) - part1MaterialGenericPenalty(existing)) + 0.75;
      const winner = incomingWins ? item : existing;
      const fallback = incomingWins ? existing : item;
      merged[existingIndex] = {
        ...winner,
        sourceWording: winner.sourceWording || fallback.sourceWording,
        reuseFor: Array.from(new Set([...(fallback.reuseFor || []), ...(winner.reuseFor || [])])),
        explanationZh: winner.explanationZh || fallback.explanationZh,
        materialCore: winner.materialCore || fallback.materialCore,
        part1UseCases: Array.from(new Set([...(fallback.part1UseCases || []), ...(winner.part1UseCases || [])])),
        developmentMoveZh: winner.developmentMoveZh || fallback.developmentMoveZh,
        developedExample: winner.developedExample || fallback.developedExample,
        expressionFrames: Array.from(new Set([...(fallback.expressionFrames || []), ...(winner.expressionFrames || [])])).slice(0, 2),
        materialKey: winner.materialKey || fallback.materialKey,
      };
      dedupedCount += 1;
      return;
    }
    merged.push(item);
  };

  carried.forEach(mergeOneMaterialItem);
  fresh.forEach(mergeOneMaterialItem);
  return { items: merged, dedupedCount };
};

export const isPart1CleanerAnswerEquivalent = (learnerAnswer: string, cleanerAnswer: string) => {
  const learnerKey = normalizePart1ComparableAnswerText(learnerAnswer);
  const cleanerKey = normalizePart1ComparableAnswerText(cleanerAnswer);
  if (!learnerKey || !cleanerKey) return false;
  if (learnerKey === cleanerKey) return true;
  const learnerWords = learnerKey.split(' ').filter(Boolean);
  const cleanerWords = cleanerKey.split(' ').filter(Boolean);
  if (Math.abs(learnerWords.length - cleanerWords.length) > 2) return false;
  const learnerSet = new Set(learnerWords);
  const overlap = cleanerWords.filter(word => learnerSet.has(word)).length;
  return overlap / Math.max(learnerWords.length, cleanerWords.length) >= 0.92;
};

const isPart1OptionalDevelopmentText = (text: string) =>
  /\b(reason|detail|specific|example|develop|rich|expand|one more|small|brief|personal|because|why|contrast|compare|underdeveloped|thin)\b|细节|原因|具体|丰富|补充|例子|展开|对比|偏短|单薄/.test(text);

const part1LineageTextContains = (container: string, contained: string) => {
  const containerKey = normalizePart1LineageText(container);
  const containedKey = normalizePart1LineageText(contained);
  return Boolean(containedKey && containedKey.split(' ').length >= 3 && containerKey.includes(containedKey));
};

const normalizePart1FormatOnlyText = (text: string) =>
  normalizePart1SourceQuote(text).replace(/[^a-z]/g, '');

const isPart1TranscriptFormatOnlyLayer = (layer: Part1AnswerAnnotationLayer) => {
  const original = normalizePart1SourceQuote(layer.original);
  const better = normalizePart1SourceQuote(layer.better);
  if (!original || !better) return false;
  if (original === better) return true;
  if (normalizePart1FormatOnlyText(layer.original) === normalizePart1FormatOnlyText(layer.better)) return true;
  const evidence = `${layer.issueType} ${layer.explanationZh}`.toLowerCase();
  if (/\b(capitali[sz]ation|uppercase|lowercase|punctuation|spacing|spelling|typo|transcription|asr|homophone)\b/.test(evidence)) return true;
  return new Set(['to|too', 'too|to', 'there|their', 'their|there']).has(`${original}|${better}`);
};

const renderablePart1Annotation = (annotation: Part1AnswerAnnotation): Part1AnswerAnnotation | null => {
  const layers = sortPart1AnnotationLayers(annotation.layers.filter(layer => !isPart1TranscriptFormatOnlyLayer(layer)));
  return layers.length ? { ...annotation, layers } : null;
};

const findPart1NormalizedSpan = (answer: string, sourceQuote: string) => {
  const answerSearch = buildPart1SearchText(answer);
  const quote = normalizePart1SourceQuote(sourceQuote);
  if (!quote) return null;
  const start = answerSearch.normalized.indexOf(quote);
  if (start < 0) return null;
  const end = start + quote.length;
  const originalStart = answerSearch.originalIndexes[start];
  const originalEnd = (answerSearch.originalIndexes[end - 1] ?? originalStart) + 1;
  if (!Number.isFinite(originalStart) || !Number.isFinite(originalEnd) || originalEnd <= originalStart) return null;
  return { start: originalStart, end: originalEnd };
};

const tokenizePart1SearchText = (answer: string) => {
  const search = buildPart1SearchText(answer);
  const tokens: Array<{ value: string; start: number; end: number }> = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(search.normalized))) {
    const start = search.originalIndexes[match.index];
    const end = (search.originalIndexes[match.index + match[0].length - 1] ?? start) + 1;
    tokens.push({ value: match[0], start, end });
  }
  return tokens;
};

const findPart1TokenFallbackSpan = (answer: string, sourceQuote: string) => {
  const quoteTokens = normalizePart1SourceQuote(sourceQuote).split(' ').filter(Boolean);
  if (quoteTokens.length < 3) return null;
  const answerTokens = tokenizePart1SearchText(answer);
  const matches: Array<{ start: number; end: number }> = [];
  for (let index = 0; index <= answerTokens.length - quoteTokens.length; index += 1) {
    const candidate = answerTokens.slice(index, index + quoteTokens.length).map(token => token.value);
    if (candidate.every((token, offset) => token === quoteTokens[offset])) {
      matches.push({
        start: answerTokens[index].start,
        end: answerTokens[index + quoteTokens.length - 1].end,
      });
    }
  }
  return matches.length === 1 ? matches[0] : null;
};

const findPart1AnnotationSpan = (answer: string, annotation: Part1AnswerAnnotation) =>
  findPart1NormalizedSpan(answer, annotation.sourceQuote) ||
  findPart1TokenFallbackSpan(answer, annotation.sourceQuote);

const mergePart1Annotations = (
  answer: string,
  spans: Part1AnnotationSpan[],
): Part1AnnotationSpan[] => {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: Part1AnnotationSpan[] = [];
  sorted.forEach(span => {
    const previous = merged[merged.length - 1];
    if (!previous || span.start >= previous.end) {
      merged.push(span);
      return;
    }
    const start = Math.min(previous.start, span.start);
    const end = Math.max(previous.end, span.end);
    const annotations = [previous.annotation, span.annotation];
    previous.start = start;
    previous.end = end;
    previous.visibleText = answer.slice(start, end);
    previous.annotation = {
      id: annotations.map(item => item.id).join('__'),
      questionRef: previous.annotation.questionRef,
      sourceQuote: previous.visibleText,
      combinedRepair: annotations.map(item => item.combinedRepair).find(Boolean),
      layers: sortPart1AnnotationLayers(annotations.flatMap(item => item.layers)),
    };
  });
  return merged;
};

const getPart1AnnotationRenderData = (
  answer: string,
  annotations: Part1AnswerAnnotation[],
) => {
  const { anchored, unanchored } = findPart1AnnotationDisplaySpans(answer, annotations);
  return {
    anchored: mergePart1Annotations(answer, anchored),
    unanchored,
  };
};

const part1RepairDiffTokens = (original: string, better: string) => {
  const originalTokens = normalizePart1TranscriptDisplayText(original).split(/\s+/).filter(Boolean);
  const betterTokens = normalizePart1TranscriptDisplayText(better).split(/\s+/).filter(Boolean);
  let prefix = 0;
  while (
    prefix < originalTokens.length &&
    prefix < betterTokens.length &&
    originalTokens[prefix].toLowerCase() === betterTokens[prefix].toLowerCase()
  ) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < originalTokens.length - prefix &&
    suffix < betterTokens.length - prefix &&
    originalTokens[originalTokens.length - 1 - suffix].toLowerCase() === betterTokens[betterTokens.length - 1 - suffix].toLowerCase()
  ) {
    suffix += 1;
  }

  return {
    prefix: betterTokens.slice(0, prefix).join(' '),
    removed: originalTokens.slice(prefix, originalTokens.length - suffix).join(' '),
    added: betterTokens.slice(prefix, betterTokens.length - suffix).join(' '),
    suffix: suffix ? betterTokens.slice(betterTokens.length - suffix).join(' ') : '',
  };
};

const renderPart1RepairDiff = (original: string, better: string) => {
  const diff = part1RepairDiffTokens(original, better);
  if (!diff.removed && !diff.added) return normalizePart1TranscriptDisplayText(better);
  return (
    <>
      {diff.prefix && <span>{diff.prefix} </span>}
      {diff.removed && (
        <del className="text-paper-ink/45 decoration-accent-terracotta decoration-2">
          {diff.removed}
        </del>
      )}
      {diff.removed && diff.added && <span> </span>}
      {diff.added && <span className="font-bold text-red-800">{diff.added}</span>}
      {diff.suffix && <span> {diff.suffix}</span>}
    </>
  );
};

const Part1AnnotationOverlay = ({
  annotation,
  anchorEl,
  onClose,
}: {
  annotation: Part1AnswerAnnotation;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}) => {
  const [position, setPosition] = useState({ top: 120, left: 24, width: 360, isMobile: false, x1: 0, y1: 0, x2: 0, y2: 0 });

  useEffect(() => {
    const updatePosition = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile || !anchorEl) {
        setPosition({ top: 0, left: 0, width: window.innerWidth, isMobile: true, x1: 0, y1: 0, x2: 0, y2: 0 });
        return;
      }
      const rect = anchorEl.getBoundingClientRect();
      const width = Math.min(420, Math.max(340, window.innerWidth * 0.3));
      const left = Math.min(window.innerWidth - width - 18, Math.max(18, rect.left + rect.width / 2 - width / 2));
      const preferredTop = rect.bottom + 18;
      const top = preferredTop + 260 > window.innerHeight ? Math.max(18, rect.top - 280) : preferredTop;
      setPosition({
        top,
        left,
        width,
        isMobile: false,
        x1: rect.left + rect.width / 2,
        y1: top < rect.top ? rect.top : rect.bottom,
        x2: left + width / 2,
        y2: top < rect.top ? top + 260 : top,
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorEl]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const primaryLayer = annotation.layers[0];
  const primaryRepair = annotation.combinedRepair || primaryLayer?.better || '';
  const primaryOriginal = annotation.combinedRepair ? annotation.sourceQuote : primaryLayer?.original || annotation.sourceQuote;
  const systemRevisionNote = annotation.layers.find(layer => layer.origin === 'previous_cleaner_answer_conflict')?.systemRevisionNoteZh;
  const explanationLines = Array.from(new Set(annotation.layers
    .map(layer => concisePart1LayerExplanation(layer.explanationZh))
    .filter(Boolean)));

  const content = (
    <>
      {!position.isMobile && anchorEl && (
        <svg className="annotation-tether" aria-hidden="true">
          <line x1={position.x1} y1={position.y1} x2={position.x2} y2={position.y2} />
        </svg>
      )}
      <aside
        className={position.isMobile ? 'annotation-overlay annotation-overlay--sheet part1-annotation-overlay' : 'annotation-overlay part1-annotation-overlay'}
        style={position.isMobile ? undefined : { top: position.top, left: position.left, width: position.width }}
      >
        <div className="annotation-overlay__header">
          <div>
            <p className="annotation-overlay__eyebrow">{annotation.questionRef} · {part1AnnotationHeaderLabel(annotation)}</p>
            <h4>
              Your words:{' '}
              {primaryRepair
                ? renderPart1RepairDiff(primaryOriginal, primaryRepair)
                : normalizePart1TranscriptDisplayText(annotation.sourceQuote)}
            </h4>
          </div>
          <button type="button" className="annotation-overlay__close" onClick={onClose} aria-label="Close annotation" />
        </div>
        {(explanationLines.length > 0 || systemRevisionNote) && (
          <div className="annotation-overlay__body">
            {explanationLines.map(line => <p key={line}>{line}</p>)}
            {systemRevisionNote && <p>{systemRevisionNote}</p>}
          </div>
        )}
      </aside>
    </>
  );

  return createPortal(content, document.body);
};

export default function SpeakingPractice() {
  const {
    addDebugLog,
    saveSession,
    capabilities,
    setProviderDiagnostic,
    markMasteredExpression,
    forgetMasteredExpression,
    profile,
  } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [part, setPart] = useState<1 | 2 | 3>(1);
  const [question, setQuestion] = useState<SpeakingQuestion | null>(null);
  const [part1Thread, setPart1Thread] = useState<Part1TopicThreadSet | null>(null);
  const [lockedThreadAnswers, setLockedThreadAnswers] = useState<LockedThreadAnswer[]>([]);
  const [part1RetryReference, setPart1RetryReference] = useState<Part1RetryReferenceContext | null>(null);
  const [activeThreadIndex, setActiveThreadIndex] = useState(0);
  const [step, setStep] = useState<'idle' | 'recording' | 'editing' | 'analyzing' | 'results'>('idle');
  const [transcript, setTranscript] = useState('');
  const [rawTranscript, setRawTranscript] = useState('');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioMimeType, setAudioMimeType] = useState('');
  const [isTranscribingAudio, setIsTranscribingAudio] = useState(false);
  const [audioTranscript, setAudioTranscript] = useState('');
  const [audioTranscriptNeedsAdoption, setAudioTranscriptNeedsAdoption] = useState(false);
  const [audioTranscriptionError, setAudioTranscriptionError] = useState('');
  const [audioUncertaintyNotes, setAudioUncertaintyNotes] = useState<string[]>([]);
  const [audioTranscriptionProvider, setAudioTranscriptionProvider] = useState('');
  const [audioTranscriptIsMock, setAudioTranscriptIsMock] = useState(false);
  const [transcriptionSource, setTranscriptionSource] = useState<TranscriptionSource>('manual');
  const [isRecording, setIsRecording] = useState(false);
  const [timer, setTimer] = useState(0);
  const [feedback, setFeedback] = useState<SpeakingFeedback | null>(null);
  const [, setFeedbackFallbackUsed] = useState(false);
  const [isBankOpen, setIsBankOpen] = useState(false);
  const [restoreMessage, setRestoreMessage] = useState('');
  const [providerErrorMessage, setProviderErrorMessage] = useState('');
  const [storageFullWarning, setStorageFullWarning] = useState('');
  const [transcriptCleanupNote, setTranscriptCleanupNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<'Ready' | 'Requesting microphone...' | 'Listening...' | 'No speech detected' | 'Transcription unavailable' | 'Mic denied'>('Ready');
  const [selectedThreadAnnotationId, setSelectedThreadAnnotationId] = useState<string | null>(null);
  const [selectedSpeakingAnnotationId, setSelectedSpeakingAnnotationId] = useState<string | null>(null);
  const [hiddenPart1MaterialKeys, setHiddenPart1MaterialKeys] = useState<string[]>([]);
  const [hiddenPart1DevelopmentKeys, setHiddenPart1DevelopmentKeys] = useState<string[]>([]);
  const [hiddenPart1ExpressionKeys, setHiddenPart1ExpressionKeys] = useState<string[]>([]);
  const [hiddenPart2SignalUpgradeKeys, setHiddenPart2SignalUpgradeKeys] = useState<string[]>([]);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const transcriptOriginRef = useRef<'speech' | 'manual'>('manual');
  const silenceTimeoutRef = useRef<any>(null);
  const speechRetriesRef = useRef(0);
  const hasSpeechResultRef = useRef(false);
  const fatalSpeechErrorRef = useRef(false);
  const intentionalSpeechStopRef = useRef(false);
  const recognitionRunningRef = useRef(false);
  const isRecordingRef = useRef(false);
  const retryTimeoutRef = useRef<any>(null);
  const activeSessionRef = useRef<ActiveSpeakingPracticeSession | null>(null);
  const activeAttemptIdRef = useRef(createRecordId('sp'));
  const isRestoringRecordRef = useRef(false);
  const transcriptionSourceRef = useRef<TranscriptionSource>('manual');
  const hasManualTranscriptEditRef = useRef(false);
  const autoAudioTranscriptionAttemptedRef = useRef(false);
  const captureGenerationRef = useRef(0);
  const activeCaptureContextRef = useRef<CaptureContext | null>(null);
  const audioBlobContextRef = useRef<CaptureContext | null>(null);
  const threadAnnotationRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const speakingAnnotationRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastPart1AnnotationCoverageLogRef = useRef('');

  useEffect(() => {
    setHiddenPart2SignalUpgradeKeys([]);
  }, [feedback?.part, feedback?.question, feedback?.transcript]);

  useEffect(() => {
    if (!capabilities.speechRecognition && !capabilities.webkitSpeechRecognition) {
      setStatusMessage('Transcription unavailable');
    }
  }, [capabilities]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    transcriptionSourceRef.current = transcriptionSource;
  }, [transcriptionSource]);

  const getBank = (p: 1 | 2 | 3) => p === 1 ? speakingPart1 : p === 2 ? speakingPart2 : speakingPart3;
  const part1TopicBuckets = useMemo<Part1TopicBucket[]>(() => {
    const buckets = new Map<string, Part1TopicBucket>();
    speakingPart1TopicThreads.forEach(thread => {
      const existing = buckets.get(thread.topicId);
      if (existing) {
        existing.threads.push(thread);
        return;
      }
      buckets.set(thread.topicId, {
        topicId: thread.topicId,
        topic: thread.topic,
        threads: [thread],
      });
    });
    return Array.from(buckets.values());
  }, []);
  const isPart1ThreadPractice = part === 1 && Boolean(part1Thread);
  const currentThreadQuestion = part1Thread?.questions[activeThreadIndex];
  const threadQuestionCount = part1Thread?.questions.length || 0;
  const threadCompleted = Boolean(part1Thread && lockedThreadAnswers.length >= threadQuestionCount);
  const lockedThreadRecoveryMessage = (answerCount = lockedThreadAnswers.length) =>
    `Analysis could not be completed. Your ${answerCount} locked ${answerCount === 1 ? 'answer is' : 'answers are'} preserved. Re-analyze ${answerCount === 1 ? 'it' : 'them'} without recording again.`;
  const buildPart1RetryReference = (
    source: SpeakingFeedback,
    parentAttemptId: string,
  ): Part1RetryReferenceContext | null => {
    const thread = source.threadFeedback;
    if (!thread?.cleanRetryAnswers.length) return null;
    const status = thread.cleanRetryCertificationStatus || 'legacy_or_unverified';
    const questionIdByRef = new Map<string, string>((source.threadAnswers || []).map((answer, index) => [`Q${index + 1}`, answer.questionId]));
    return {
      retryChainId: source.part1RetryReference?.retryChainId || createRecordId('p1_retry_chain'),
      parentAttemptId,
      cleanRetryAnswers: thread.cleanRetryAnswers.map(item => ({
        questionRef: item.questionRef,
        questionId: questionIdByRef.get(item.questionRef),
        answer: item.answer,
        certificationStatus: status,
      })),
      carriedMyUsableMaterial: thread.materialBank.myUsableMaterial,
    };
  };
  const withPart1ThreadFeedback = (
    source: SpeakingFeedback,
    transform: (thread: NonNullable<SpeakingFeedback['threadFeedback']>) => NonNullable<SpeakingFeedback['threadFeedback']>,
  ): SpeakingFeedback => {
    if (!source.threadFeedback) return source;
    const next: SpeakingFeedback = {
      ...source,
      threadFeedback: transform(source.threadFeedback),
      obsidianMarkdown: '',
    };
    return {
      ...next,
      obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
    };
  };
  const withPart1CertificationStatus = (
    source: SpeakingFeedback,
    status: Part1DisplayedCleanRetryCertificationStatus,
  ) => withDerivedPart1SessionPriorityState(withPart1ThreadFeedback(source, thread => ({
    ...thread,
    cleanRetryCertificationStatus: status,
  })));
  const withMergedPart1Material = (
    source: SpeakingFeedback,
    carried: SpeakingMaterialBankItem[],
  ): { feedback: SpeakingFeedback; dedupedCount: number } => {
    let dedupedCount = 0;
    const feedback = withPart1ThreadFeedback(source, thread => {
      const merged = mergePart1MyUsableMaterialForRetry(carried, thread.materialBank.myUsableMaterial);
      dedupedCount = merged.dedupedCount;
      return {
        ...thread,
        materialBank: {
          ...thread.materialBank,
          myUsableMaterial: merged.items,
        },
      };
    });
    return { feedback, dedupedCount };
  };
  const hasPreviousCleanerConflictForQuestion = (source: SpeakingFeedback, questionRef: string) =>
    Boolean(source.threadFeedback?.annotations?.some(annotation =>
      annotation.questionRef === questionRef &&
      annotation.layers.some(layer => layer.origin === 'previous_cleaner_answer_conflict'),
    ));
  const hasOrdinaryMustFixForQuestion = (source: SpeakingFeedback, questionRef: string) =>
    Boolean(source.threadFeedback?.annotations?.some(annotation =>
      annotation.questionRef === questionRef &&
      annotation.layers.some(layer => layer.severity === 'must_fix' && layer.origin !== 'previous_cleaner_answer_conflict'),
    ));
  const isPart1ThreadStableResult = (source: SpeakingFeedback | null | undefined) => {
    return derivePart1ThreadStable(source);
  };
  const stabilizeCleanRetryAnswersForRetry = (
    source: SpeakingFeedback,
    answers: LockedThreadAnswer[],
    retryReference: Part1RetryReferenceContext | null,
  ) => {
    if (!source.threadFeedback || !retryReference?.cleanRetryAnswers.length) return { feedback: source, stabilizedCount: 0 };
    const priorByRef = new Map(retryReference.cleanRetryAnswers.map(item => [item.questionRef, item] as const));
    let stabilizedCount = 0;
    const cleanRetryAnswers = source.threadFeedback.cleanRetryAnswers.map(item => {
      const prior = priorByRef.get(item.questionRef);
      const answerIndex = Number(item.questionRef.replace(/^Q/i, '')) - 1;
      const submitted = answers[answerIndex]?.transcript || '';
      const priorIsCertified = prior?.certificationStatus === 'certified_first_attempt' || prior?.certificationStatus === 'certified_after_rewrite';
      const submittedMatchesPrior = Boolean(prior && (
        part1LineageTextContains(submitted, prior.answer) ||
        part1LineageTextContains(prior.answer, submitted)
      ));
      if (
        priorIsCertified &&
        submittedMatchesPrior &&
        !hasPreviousCleanerConflictForQuestion(source, item.questionRef) &&
        !hasOrdinaryMustFixForQuestion(source, item.questionRef)
      ) {
        stabilizedCount += item.answer === submitted ? 0 : 1;
        return {
          ...item,
          answer: submitted,
          noteZh: item.noteZh,
        };
      }
      return item;
    });
    return stabilizedCount
      ? {
        feedback: replacePart1CleanRetryAnswers(source, cleanRetryAnswers),
        stabilizedCount,
      }
      : { feedback: source, stabilizedCount };
  };
  const currentCaptureIdentity = (token: number): CaptureContext => ({
    token,
    attemptId: activeAttemptIdRef.current,
    part,
    threadId: part1Thread?.id,
    questionId: question?.id,
    threadIndex: part1Thread ? activeThreadIndex : undefined,
  });
  const beginCaptureContext = () => {
    const context = currentCaptureIdentity(captureGenerationRef.current + 1);
    captureGenerationRef.current = context.token;
    activeCaptureContextRef.current = context;
    return context;
  };
  const invalidateCaptureContext = () => {
    captureGenerationRef.current += 1;
    activeCaptureContextRef.current = null;
    audioBlobContextRef.current = null;
  };
  const isCurrentCaptureContext = (context?: CaptureContext | null) => {
    if (!context) return false;
    const active = activeCaptureContextRef.current;
    return Boolean(
      active &&
      active.token === context.token &&
      active.attemptId === activeAttemptIdRef.current &&
      active.part === part &&
      active.threadId === part1Thread?.id &&
      active.questionId === question?.id &&
      active.threadIndex === (part1Thread ? activeThreadIndex : undefined),
    );
  };
  const ignoreStaleBrowserTranscript = () => addDebugLog('Ignored stale browser transcript for previous Part 1 thread question.');
  const ignoreStaleAudioTranscript = () => addDebugLog('Ignored stale audio transcription for previous Part 1 thread question.');
  const toSpeakingQuestion = (thread: Part1TopicThreadSet, index: number): SpeakingQuestion => {
    const threadQuestion = thread.questions[index] || thread.questions[0];
    return {
      id: threadQuestion.id,
      part: 1,
      topic: thread.topic,
      question: threadQuestion.question,
      topicCategory: thread.topicCategory,
      tags: thread.topicCategory ? [thread.topicCategory] : undefined,
    };
  };
  const threadQuestionsForRecord = (thread: Part1TopicThreadSet) => thread.questions.map(item => ({
    id: item.id,
    question: item.question,
    topic: item.topic,
    provenance: item.provenance,
    sourceQuestionId: item.sourceQuestionId,
    supplementId: item.supplementId,
  }));
  const findThreadById = (threadId?: string) =>
    speakingPart1TopicThreads.find(thread => thread.id === threadId) || null;
  const restoreThreadFromSnapshot = (record: SpeakingPracticeRecord) => {
    if (record.sessionKind !== 'part1_topic_thread') return null;
    if (record.threadQuestions?.length) {
      const snapshotTopic = record.threadQuestions[0]?.topic || record.questionData?.topic || record.topic || 'Saved Topic';
      const snapshotThread: Part1TopicThreadSet = {
        id: record.threadId || `saved_thread_${record.id}`,
        topicId: record.topicId || record.threadId || `saved_topic_${record.id}`,
        topic: snapshotTopic,
        title: snapshotTopic,
        topicCategory: record.questionData?.topicCategory,
        tags: record.questionData?.tags || [],
        questions: record.threadQuestions.map(item => ({
          id: item.id,
          question: item.question,
          topic: item.topic,
          topicCategory: record.questionData?.topicCategory,
          tags: record.questionData?.tags,
          provenance: item.provenance || 'active_bank_source',
          sourceQuestionId: item.sourceQuestionId,
          supplementId: item.supplementId,
        })),
      };
      return snapshotThread;
    }
    return findThreadById(record.threadId);
  };
  const startPart1Thread = (
    thread: Part1TopicThreadSet,
    initialAnswers: LockedThreadAnswer[] = [],
    startIndex = initialAnswers.length,
    retryReference: Part1RetryReferenceContext | null = null,
  ) => {
    const safeIndex = Math.min(Math.max(startIndex, 0), Math.max(thread.questions.length - 1, 0));
    invalidateCaptureContext();
    activeAttemptIdRef.current = createRecordId('sp');
    setPart(1);
    setPart1Thread(thread);
    setPart1RetryReference(retryReference);
    setLockedThreadAnswers(initialAnswers);
    setActiveThreadIndex(safeIndex);
    setQuestion(toSpeakingQuestion(thread, safeIndex));
    setStep(initialAnswers.length >= thread.questions.length ? 'analyzing' : 'idle');
    setTranscript('');
    setRawTranscript('');
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource('manual');
    transcriptionSourceRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setTimer(0);
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog(`Loaded Part 1 topic thread: ${thread.id}`);
  };
  const buildCurrentSpeakingRecord = (
    status: 'draft' | 'analyzed' | 'provider_failed' = feedback ? 'analyzed' : 'draft',
    feedbackOverride: SpeakingFeedback | null = feedback,
    transcriptOverride = transcript,
  ): SpeakingPracticeRecord | null => {
    if (!question) return null;
    const timestamp = new Date().toISOString();
    const existing = activeSessionRef.current?.attemptsByPart[part]?.id === activeAttemptIdRef.current
      ? activeSessionRef.current.attemptsByPart[part]
      : undefined;
    return {
      id: activeAttemptIdRef.current,
      module: 'speaking',
      mode: 'practice',
      status,
      part,
      sessionKind: isPart1ThreadPractice ? 'part1_topic_thread' : 'single_question',
      topicId: part1Thread?.topicId,
      threadId: part1Thread?.id,
      threadQuestions: part1Thread ? threadQuestionsForRecord(part1Thread) : undefined,
      threadAnswers: part1Thread ? lockedThreadAnswers : undefined,
      activeThreadIndex: part1Thread ? activeThreadIndex : undefined,
      threadCompleted: part1Thread ? (status === 'analyzed' || lockedThreadAnswers.length >= threadQuestionCount) : undefined,
      retryChainId: part1Thread ? part1RetryReference?.retryChainId : undefined,
      parentAttemptId: part1Thread ? part1RetryReference?.parentAttemptId : undefined,
      priorCleanRetryAnswers: part1Thread ? part1RetryReference?.cleanRetryAnswers : undefined,
      carriedMyUsableMaterial: part1Thread ? part1RetryReference?.carriedMyUsableMaterial : undefined,
      question: question.question,
      questionId: question.id,
      topic: question.topicCategory || question.topic,
      tags: question.tags || (question.topicCategory ? [question.topicCategory] : undefined),
      questionData: question,
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
      analyzedAt: status === 'analyzed' ? existing?.analyzedAt || timestamp : existing?.analyzedAt,
      transcript: transcriptOverride,
      rawTranscript: rawTranscript || undefined,
      audioTranscript: audioTranscript || undefined,
      transcriptOrigin: transcriptOriginRef.current,
      transcriptSource: transcriptionSource === 'browser' ? 'speech' : transcriptionSource,
      feedback: status === 'provider_failed' ? undefined : feedbackOverride || undefined,
      obsidianMarkdown: status === 'provider_failed' ? undefined : feedbackOverride?.obsidianMarkdown,
    };
  };

  const isUnfinishedSpeakingAttempt = (record?: SpeakingPracticeRecord | null) => {
    if (!record) return false;
    if (record.status === 'analyzed' || record.feedback) return false;
    if (record.status === 'draft' || record.status === 'provider_failed') return true;
    return Boolean(record.transcript.trim() && !record.feedback);
  };

  const pruneCompletedActiveAttempts = (session: ActiveSpeakingPracticeSession) => {
    let pruned = false;
    const attemptsByPart: ActiveSpeakingPracticeSession['attemptsByPart'] = {};
    ([1, 2, 3] as const).forEach(sessionPart => {
      const record = session.attemptsByPart[sessionPart];
      if (!record) return;
      if (isUnfinishedSpeakingAttempt(record)) {
        attemptsByPart[sessionPart] = record;
      } else {
        pruned = true;
      }
    });
    return {
      pruned,
      session: {
        ...session,
        attemptsByPart,
      },
    };
  };

  const logSkippedCompletedAutoRestore = () => {
    console.debug('Skipped auto-restore for completed Speaking attempt; loaded a fresh question instead.');
  };

  const clearActiveSpeakingAttempt = (sessionPart: 1 | 2 | 3) => {
    if (!activeSessionRef.current) return;
    activeSessionRef.current = {
      ...activeSessionRef.current,
      attemptsByPart: {
        ...activeSessionRef.current.attemptsByPart,
        [sessionPart]: undefined,
      },
      updatedAt: new Date().toISOString(),
    };
    saveActiveSpeakingSession(activeSessionRef.current);
  };

  const cleanupAudioCapture = () => {
    audioStreamRef.current?.getTracks().forEach(track => track.stop());
    audioStreamRef.current = null;
    mediaRecorderRef.current = null;
  };

  const hasMeaningfulAttemptContent = (status?: 'draft' | 'analyzed' | 'provider_failed') =>
    Boolean(transcript.trim() || lockedThreadAnswers.length > 0 || feedback || status === 'analyzed' || status === 'provider_failed');

  const persistCurrentSpeakingAttempt = async (status?: 'draft' | 'analyzed' | 'provider_failed') => {
    if (feedback || status === 'analyzed') return;
    if (!hasMeaningfulAttemptContent(status)) return;
    const record = buildCurrentSpeakingRecord(status);
    if (!record) return;

    const session = activeSessionRef.current || {
      id: createRecordId('speaking_session'),
      currentPart: part,
      attemptsByPart: {},
      updatedAt: new Date().toISOString(),
    };
    activeSessionRef.current = {
      ...session,
      currentPart: part,
      attemptsByPart: {
        ...session.attemptsByPart,
        [part]: record,
      },
      updatedAt: new Date().toISOString(),
    };
    const [sessionResult, recordResult] = await Promise.all([
      saveActiveSpeakingSession(activeSessionRef.current),
      upsertPracticeRecord(record),
    ]);
    if (!sessionResult.ok || !recordResult.ok) {
      setStorageFullWarning('本地存储空间已满，当前练习状态未能保存。请先导出数据备份，修复存储前建议暂停新练习。');
    }
  };

  const restoreSpeakingRecord = (record: SpeakingPracticeRecord, message = '') => {
    invalidateCaptureContext();
    isRestoringRecordRef.current = true;
    activeAttemptIdRef.current = record.id;
    setPart(record.part);
    const restoredThread = restoreThreadFromSnapshot(record);
    const restoredThreadAnswers = record.threadAnswers || [];
    setPart1Thread(restoredThread);
    setPart1RetryReference(restoredThread && record.retryChainId && record.priorCleanRetryAnswers?.length
      ? {
        retryChainId: record.retryChainId,
        parentAttemptId: record.parentAttemptId,
        cleanRetryAnswers: record.priorCleanRetryAnswers,
        carriedMyUsableMaterial: record.carriedMyUsableMaterial,
      }
      : record.feedback?.part1RetryReference || null);
    setLockedThreadAnswers(restoredThread ? restoredThreadAnswers : []);
    setActiveThreadIndex(restoredThread ? Math.min(record.activeThreadIndex ?? restoredThreadAnswers.length, Math.max(restoredThread.questions.length - 1, 0)) : 0);
    setQuestion(restoredThread
      ? toSpeakingQuestion(restoredThread, Math.min(record.activeThreadIndex ?? restoredThreadAnswers.length, Math.max(restoredThread.questions.length - 1, 0)))
      : record.questionData || getBank(record.part).find(item => item.id === record.questionId) || {
      id: record.questionId || record.id,
      topic: 'Saved Attempt',
      part: record.part,
      question: record.question,
    });
    setTranscript(record.transcript);
    setRawTranscript(record.rawTranscript || '');
    setAudioTranscript(record.audioTranscript || '');
    setAudioTranscriptNeedsAdoption(false);
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource(record.transcriptSource === 'audio' ? 'audio' : record.transcriptSource === 'speech' ? 'browser' : 'manual');
    transcriptionSourceRef.current = record.transcriptSource === 'audio' ? 'audio' : record.transcriptSource === 'speech' ? 'browser' : 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    transcriptOriginRef.current = record.transcriptOrigin;
    setFeedback(record.feedback || null);
    setFeedbackFallbackUsed(Boolean(record.providerDiagnostic?.fallbackUsed));
    setStep(record.feedback ? 'results' : record.transcript.trim() ? 'editing' : 'idle');
    setTimer(0);
    setProviderErrorMessage(record.status === 'provider_failed'
      ? restoredThread && restoredThreadAnswers.length >= restoredThread.questions.length
        ? `Analysis could not be completed. Your ${restoredThreadAnswers.length} locked ${restoredThreadAnswers.length === 1 ? 'answer is' : 'answers are'} preserved. Re-analyze ${restoredThreadAnswers.length === 1 ? 'it' : 'them'} without recording again.`
        : 'AI provider temporarily unavailable. Please retry later.'
      : '');
    setTranscriptCleanupNote('');
    setRestoreMessage(message);
  };

  useEffect(() => {
    (async () => {
      const active = await getActiveSpeakingSession();
      if (active) {
        activeSessionRef.current = active;
        const explicitRestoreId = typeof location.state === 'object' && location.state && 'restoreSpeakingRecordId' in location.state
          ? String(location.state.restoreSpeakingRecordId || '')
          : '';
        if (explicitRestoreId) {
          const explicitRecord = Object.values(active.attemptsByPart).find(record => record?.id === explicitRestoreId);
          if (explicitRecord) {
            restoreSpeakingRecord(explicitRecord);
            navigate(location.pathname, { replace: true, state: null });
            return;
          }
        }

        const currentPart = active.currentPart;
        const candidate = active.attemptsByPart[currentPart];
        if (isUnfinishedSpeakingAttempt(candidate)) {
          restoreSpeakingRecord(candidate);
          return;
        }

        const { pruned, session } = pruneCompletedActiveAttempts(active);
        activeSessionRef.current = session;
        if (candidate && !isUnfinishedSpeakingAttempt(candidate)) {
          logSkippedCompletedAutoRestore();
        }
        if (pruned) await saveActiveSpeakingSession(session);
        loadRandomQuestion(currentPart);
        return;
      }
      loadRandomQuestion(1);
    })();
  }, []);

  useEffect(() => {
    if (isRestoringRecordRef.current) {
      isRestoringRecordRef.current = false;
      return;
    }
    if (!question || step === 'recording' || step === 'analyzing') return;
    persistCurrentSpeakingAttempt(providerErrorMessage ? 'provider_failed' : undefined);
  }, [part, question, part1Thread, part1RetryReference, activeThreadIndex, lockedThreadAnswers, step, transcript, rawTranscript, audioTranscript, transcriptionSource, feedback, providerErrorMessage]);

  const getQuestionTopicKey = (item: SpeakingQuestion) => item.topicCategory || item.topic;
  const analyzedPart1ThreadRecords = async () => {
    const all = await listPracticeRecords({ module: 'speaking' });
    return all.filter((record): record is SpeakingPracticeRecord =>
      record.module === 'speaking' &&
      record.part === 1 &&
      record.sessionKind === 'part1_topic_thread' &&
      record.status === 'analyzed' &&
      Boolean(record.feedback)
    );
  };

  const chooseLeastRecentlyAnalyzedThread = (
    threads: Part1TopicThreadSet[],
    records: SpeakingPracticeRecord[],
    avoidThreadId?: string,
  ) => {
    if (!threads.length) return null;
    const latestByThreadId = new Map<string, number>();
    records.forEach(record => {
      if (!record.threadId) return;
      const timestamp = recordTimestampValue(record);
      const existing = latestByThreadId.get(record.threadId) || 0;
      if (timestamp > existing) latestByThreadId.set(record.threadId, timestamp);
    });
    const sorted = [...threads].sort((a, b) => {
      const aTime = latestByThreadId.get(a.id) || 0;
      const bTime = latestByThreadId.get(b.id) || 0;
      if (aTime !== bTime) return aTime - bTime;
      return a.id.localeCompare(b.id);
    });
    const filtered = avoidThreadId && sorted.some(thread => thread.id !== avoidThreadId)
      ? sorted.filter(thread => thread.id !== avoidThreadId)
      : sorted;
    return filtered[0] || sorted[0] || null;
  };

  const selectThreadForTopic = async (
    topicId: string,
    options?: {
      avoidThreadId?: string;
      reuseAfterCoverage?: boolean;
    },
  ) => {
    const topic = part1TopicBuckets.find(item => item.topicId === topicId);
    if (!topic) return null;
    const allRecords = await analyzedPart1ThreadRecords();
    const records = allRecords.filter(record => record.topicId === topicId);
    const practicedIds = new Set(records.map(record => record.threadId).filter(Boolean));
    const eligibleThreads = options?.avoidThreadId && topic.threads.some(thread => thread.id !== options.avoidThreadId)
      ? topic.threads.filter(thread => thread.id !== options.avoidThreadId)
      : topic.threads;
    const unpracticed = eligibleThreads.filter(thread => !practicedIds.has(thread.id));
    if (unpracticed.length) return pickRandomItem(unpracticed);
    if (options?.reuseAfterCoverage) {
      return chooseLeastRecentlyAnalyzedThread(eligibleThreads, records, options.avoidThreadId);
    }
    return pickRandomItem(eligibleThreads);
  };

  const pickTopicForFreshPart1Thread = async (avoidTopicId?: string) => {
    if (!part1TopicBuckets.length) return null;
    const records = await analyzedPart1ThreadRecords();
    const analyzedThreadIds = new Set(records.map(record => record.threadId).filter(Boolean));
    const analyzedTopicIds = new Set(records.map(record => record.topicId).filter(Boolean));
    const mostRecentTopicId = records[0]?.topicId;
    const withUnanalyzedThreads = part1TopicBuckets.filter(topic =>
      topic.threads.some(thread => !analyzedThreadIds.has(thread.id)),
    );
    const topicPool = withUnanalyzedThreads.length
      ? withUnanalyzedThreads.filter(topic => !analyzedTopicIds.has(topic.topicId)).length
        ? withUnanalyzedThreads.filter(topic => !analyzedTopicIds.has(topic.topicId))
        : withUnanalyzedThreads
      : part1TopicBuckets;

    let eligibleTopics = topicPool;
    if (avoidTopicId && eligibleTopics.some(topic => topic.topicId !== avoidTopicId)) {
      eligibleTopics = eligibleTopics.filter(topic => topic.topicId !== avoidTopicId);
    }
    if (mostRecentTopicId && eligibleTopics.some(topic => topic.topicId !== mostRecentTopicId)) {
      eligibleTopics = eligibleTopics.filter(topic => topic.topicId !== mostRecentTopicId);
    }

    const allCovered = withUnanalyzedThreads.length === 0;
    if (allCovered) {
      const latestByTopicId = new Map<string, number>();
      records.forEach(record => {
        if (!record.topicId) return;
        const timestamp = recordTimestampValue(record);
        const existing = latestByTopicId.get(record.topicId) || 0;
        if (timestamp > existing) latestByTopicId.set(record.topicId, timestamp);
      });
      const sortedTopics = [...eligibleTopics].sort((a, b) => {
        const aTime = latestByTopicId.get(a.topicId) || 0;
        const bTime = latestByTopicId.get(b.topicId) || 0;
        if (aTime !== bTime) return aTime - bTime;
        return a.topicId.localeCompare(b.topicId);
      });
      return {
        topic: sortedTopics[0] || part1TopicBuckets[0],
        reason: 'reused least recently analyzed topic after full coverage',
      };
    }

    return {
      topic: pickRandomItem(eligibleTopics.length ? eligibleTopics : topicPool),
      reason: withUnanalyzedThreads.length ? 'selected topic with unanalysed thread coverage' : 'selected topic from available pool',
    };
  };

  const loadRandomQuestion = async (p: 1 | 2 | 3, excludeQuestionId?: string, avoidTopicKey?: string) => {
    invalidateCaptureContext();
    if (p === 1) {
      const topicSelection = await pickTopicForFreshPart1Thread(avoidTopicKey);
      const thread = topicSelection?.topic
        ? await selectThreadForTopic(topicSelection.topic.topicId, { reuseAfterCoverage: true })
        : null;
      if (thread) {
        addDebugLog(`Part 1 selector chose ${thread.topicId}/${thread.id} (${topicSelection?.reason || 'default selection'}).`);
        startPart1Thread(thread);
        return;
      }
    }
    const bank = p === 1 ? speakingPart1 : p === 2 ? speakingPart2 : speakingPart3;
    const available = excludeQuestionId
      ? bank.filter(item => item.id !== excludeQuestionId)
      : bank;
    const differentTopicAvailable = avoidTopicKey
      ? available.filter(item => getQuestionTopicKey(item) !== avoidTopicKey)
      : [];
    const candidates = differentTopicAvailable.length ? differentTopicAvailable : available.length ? available : bank;
    const random = candidates[Math.floor(Math.random() * candidates.length)];
    invalidateCaptureContext();
    activeAttemptIdRef.current = createRecordId('sp');
    setPart1Thread(null);
    setPart1RetryReference(null);
    setLockedThreadAnswers([]);
    setActiveThreadIndex(0);
    setQuestion(random);
    setPart(p);
    setStep('idle');
    setTranscript('');
    setRawTranscript('');
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource('manual');
    transcriptionSourceRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setTimer(0);
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog(`Loaded question: ${random.id}`);
  };

  const switchPart = (p: 1 | 2 | 3) => {
    persistCurrentSpeakingAttempt();
    const existing = activeSessionRef.current?.attemptsByPart[p];
    if (isUnfinishedSpeakingAttempt(existing)) {
      restoreSpeakingRecord(existing);
      activeSessionRef.current = {
        ...activeSessionRef.current,
        currentPart: p,
        updatedAt: new Date().toISOString(),
      };
      saveActiveSpeakingSession(activeSessionRef.current);
      return;
    }
    if (existing) {
      logSkippedCompletedAutoRestore();
      clearActiveSpeakingAttempt(p);
    }
    loadRandomQuestion(p);
  };

  const changeQuestion = () => {
    if (part === 1) {
      const hasCurrentWork = Boolean(transcript.trim() || lockedThreadAnswers.length || feedback);
      if (hasCurrentWork) {
        const confirmed = window.confirm('Change topic? Your current unsaved transcript or feedback will be cleared.');
        if (!confirmed) return;
      }
      clearActiveSpeakingAttempt(1);
      loadRandomQuestion(1, undefined, part1Thread?.topicId);
      return;
    }
    const bank = getBank(part);
    const alternatives = question ? bank.filter(item => item.id !== question.id) : bank;
    if (alternatives.length === 0) {
      setRestoreMessage('No other questions available yet.');
      return;
    }

    const hasCurrentWork = Boolean(transcript.trim() || feedback);
    if (hasCurrentWork) {
      const confirmed = window.confirm('Change question? Your current unsaved transcript or feedback will be cleared.');
      if (!confirmed) return;
    }

    if (activeSessionRef.current) {
      activeSessionRef.current = {
        ...activeSessionRef.current,
        attemptsByPart: {
          ...activeSessionRef.current.attemptsByPart,
          [part]: undefined,
        },
        updatedAt: new Date().toISOString(),
      };
      saveActiveSpeakingSession(activeSessionRef.current);
    }

    loadRandomQuestion(part, question?.id, question ? getQuestionTopicKey(question) : undefined);
  };

  const practiceThisQuestionAgain = () => {
    if (!question) return;
    invalidateCaptureContext();
    if (part === 1 && part1Thread) {
      const retryReference = feedback ? buildPart1RetryReference(feedback, activeAttemptIdRef.current) : null;
      startPart1Thread(part1Thread, [], 0, retryReference);
      setProviderDiagnostic(null);
      addDebugLog(`Retrying exact Part 1 thread: ${part1Thread.id}`);
      if (retryReference) {
        addDebugLog('part1RetryChain:continued');
        addDebugLog(`part1RetryReferenceAnswers:${retryReference.cleanRetryAnswers.length}`);
        addDebugLog(`part1MaterialContinuityCarried:${retryReference.carriedMyUsableMaterial?.length || 0}`);
      }
      addDebugLog('Started a fresh Part 1 topic-thread attempt.');
      return;
    }
    activeAttemptIdRef.current = createRecordId('sp');
    setTranscript('');
    setRawTranscript('');
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource('manual');
    transcriptionSourceRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    setFeedback(null);
    setPart1RetryReference(null);
    setFeedbackFallbackUsed(false);
    setProviderDiagnostic(null);
    setTimer(0);
    setStep('idle');
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    addDebugLog('Started a fresh attempt for the same speaking question.');
  };


  const selectBankQuestion = (selected: SpeakingQuestion) => {
    invalidateCaptureContext();
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      intentionalSpeechStopRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
      recognitionRef.current = null;
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* may already be stopped */ }
    }
    cleanupAudioCapture();
    audioChunksRef.current = [];
    clearActiveSpeakingAttempt(part);
    activeAttemptIdRef.current = createRecordId('sp');
    setPart1Thread(null);
    setPart1RetryReference(null);
    setLockedThreadAnswers([]);
    setActiveThreadIndex(0);
    setQuestion(selected);
    setStep('idle');
    setTranscript('');
    setRawTranscript('');
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource('manual');
    transcriptionSourceRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    setFeedback(null);
    setFeedbackFallbackUsed(false);
    setProviderDiagnostic(null);
    setTimer(0);
    setIsRecording(false);
    setStatusMessage('Ready');
    setProviderErrorMessage('');
    setTranscriptCleanupNote('');
    setRestoreMessage('');
    transcriptOriginRef.current = 'manual';
    setIsBankOpen(false);
    addDebugLog(`Selected speaking bank question: ${selected.id}`);
  };

  const selectBankThread = (selected: Part1TopicThreadSet) => {
    invalidateCaptureContext();
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      intentionalSpeechStopRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { /* already stopped */ }
      recognitionRef.current = null;
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { /* may already be stopped */ }
    }
    cleanupAudioCapture();
    audioChunksRef.current = [];
    clearActiveSpeakingAttempt(1);
    startPart1Thread(selected);
    setIsBankOpen(false);
  };

  const startRecording = async () => {
    setStatusMessage('Requesting microphone...');
    const captureContext = beginCaptureContext();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!isCurrentCaptureContext(captureContext)) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      audioStreamRef.current = stream;
      audioChunksRef.current = [];
      setAudioBlob(null);
      audioBlobContextRef.current = null;
      setAudioMimeType('');
      setAudioTranscript('');
      setAudioTranscriptNeedsAdoption(false);
      setAudioTranscriptionError('');
      setAudioUncertaintyNotes([]);
      setAudioTranscriptionProvider('');
      setAudioTranscriptIsMock(false);
      hasManualTranscriptEditRef.current = false;
      autoAudioTranscriptionAttemptedRef.current = false;

      if (window.MediaRecorder) {
        const preferredMimeType = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/ogg;codecs=opus',
        ].find(type => MediaRecorder.isTypeSupported(type));
        const recorder = preferredMimeType
          ? new MediaRecorder(stream, { mimeType: preferredMimeType })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = event => {
          if (!isCurrentCaptureContext(captureContext)) return;
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };
        recorder.onstop = () => {
          if (!isCurrentCaptureContext(captureContext)) {
            ignoreStaleAudioTranscript();
            cleanupAudioCapture();
            audioChunksRef.current = [];
            return;
          }
          const mimeType = recorder.mimeType || preferredMimeType || 'audio/webm';
          const chunks = audioChunksRef.current;
          if (chunks.length) {
            audioBlobContextRef.current = captureContext;
            setAudioBlob(new Blob(chunks, { type: mimeType }));
            setAudioMimeType(mimeType);
          }
          cleanupAudioCapture();
        };
        recorder.onerror = event => {
          if (!isCurrentCaptureContext(captureContext)) return;
          addDebugLog(`MediaRecorder error: ${event}`);
          setAudioTranscriptionError('Audio recording failed. Browser transcript and manual editing are still available.');
          cleanupAudioCapture();
        };
        recorder.start();
        addDebugLog('MediaRecorder audio capture started.');
      } else {
        if (!isCurrentCaptureContext(captureContext)) return;
        setAudioTranscriptionError('MediaRecorder is unavailable in this browser. Browser transcript and manual editing are still available.');
        addDebugLog('MediaRecorder unavailable; continuing with browser transcript only.');
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setStatusMessage('Transcription unavailable');
      } else {
        const attachRecognitionHandlers = (recognition: any) => {
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        recognition.maxAlternatives = 3;

        recognition.onstart = () => {
        if (!isCurrentCaptureContext(captureContext)) return;
        recognitionRunningRef.current = true;
        setStatusMessage('Listening...');
        // Set a timeout to warn if no speech is detected after 5 seconds
        silenceTimeoutRef.current = setTimeout(() => {
          if (!transcript) setStatusMessage('No speech detected');
        }, 5000);
      };

        recognition.onresult = (event: any) => {
        if (!isCurrentCaptureContext(captureContext)) {
          ignoreStaleBrowserTranscript();
          return;
        }
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        setStatusMessage('Listening...');
        
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          hasSpeechResultRef.current = true;
          transcriptOriginRef.current = 'speech';
          setTranscriptionSource(prev => {
            const next = prev === 'manual' ? 'browser' : prev;
            transcriptionSourceRef.current = next;
            return next;
          });
          setTranscript(prev => (prev + ' ' + finalTranscript).trim());
          setRawTranscript(prev => (prev + ' ' + finalTranscript).trim());
          addDebugLog('Browser transcript captured');
        }
      };

        recognition.onerror = (event: any) => {
        if (!isCurrentCaptureContext(captureContext)) return;
        addDebugLog(`Speech error: ${event.error}`);
        addDebugLog(`lastSpeechError = "${event.error}"`);

        if (event.error === 'not-allowed') {
          fatalSpeechErrorRef.current = true;
          setStatusMessage('Mic denied');
        } else if (event.error === 'no-speech') {
          // Not fatal — will retry in onend
        } else {
          // service-not-allowed, audio-capture, network, aborted, etc. — fatal, stop retrying
          fatalSpeechErrorRef.current = true;
          setStatusMessage('Transcription unavailable');
        }
      };

        recognition.onend = () => {
        recognitionRunningRef.current = false;
        if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
        if (!isCurrentCaptureContext(captureContext)) {
          ignoreStaleBrowserTranscript();
          return;
        }

        if (intentionalSpeechStopRef.current || !isRecordingRef.current) {
          addDebugLog('Speech recognition stopped intentionally.');
          return;
        }

        if (fatalSpeechErrorRef.current) {
          addDebugLog('Auto-resume skipped because fatal error occurred.');
          return;
        }

        if (retryTimeoutRef.current) return;

        if (isRecordingRef.current) {
          speechRetriesRef.current += 1;
          addDebugLog('Speech recognition auto-ended during active recording; restarting.');

          retryTimeoutRef.current = setTimeout(() => {
            retryTimeoutRef.current = null;
            if (!isCurrentCaptureContext(captureContext)) {
              ignoreStaleBrowserTranscript();
              return;
            }
            if (intentionalSpeechStopRef.current || !isRecordingRef.current) return;
            if (fatalSpeechErrorRef.current) {
              addDebugLog('Auto-resume skipped because fatal error occurred.');
              return;
            }
            if (recognitionRunningRef.current) return;
            const retry = new SpeechRecognition();
            attachRecognitionHandlers(retry);
            recognitionRef.current = retry;
            try {
              retry.start();
            } catch (e: any) {
              if (e?.name === 'InvalidStateError') {
                addDebugLog('Speech recognition restart skipped because it is already running.');
                return;
              }
              addDebugLog(`Retry start error: ${e.message}`);
            }
          }, 500);
        } else {
          addDebugLog(`Speech recognition ended (retries: ${speechRetriesRef.current}, fatal: ${fatalSpeechErrorRef.current})`);
        }
      };
      };

      speechRetriesRef.current = 0;
      hasSpeechResultRef.current = false;
      fatalSpeechErrorRef.current = false;
      intentionalSpeechStopRef.current = false;
      isRecordingRef.current = true;
      recognitionRef.current = new SpeechRecognition();
      attachRecognitionHandlers(recognitionRef.current);
      try {
        recognitionRef.current.start();
      } catch (e: any) {
        if (e?.name === 'InvalidStateError') {
          addDebugLog('Speech recognition start skipped because it is already running.');
        } else {
          throw e;
        }
      }
      }
      setIsRecording(true);
      setStep('recording');
      setTimer(0);
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
      addDebugLog("Recording started");
    } catch (err) {
      if (!isCurrentCaptureContext(captureContext)) return;
      addDebugLog(`Mic Access Error: ${err}`);
      fatalSpeechErrorRef.current = true;
      intentionalSpeechStopRef.current = true;
      recognitionRunningRef.current = false;
      cleanupAudioCapture();
      setStatusMessage('Mic denied');
      setStep('editing');
    }
  };

  const resetCurrentAttempt = () => {
    invalidateCaptureContext();
    // Stop any pending retry timeout
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // Stop any running recognition
    if (recognitionRef.current) {
      intentionalSpeechStopRef.current = true;
      try { recognitionRef.current.stop(); } catch (e) { /* may already be stopped */ }
      recognitionRef.current = null;
    }
    // Clear refs
    fatalSpeechErrorRef.current = true;
    intentionalSpeechStopRef.current = true;
    recognitionRunningRef.current = false;
    isRecordingRef.current = false;
    speechRetriesRef.current = 0;
    hasSpeechResultRef.current = false;
    transcriptOriginRef.current = 'manual';
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    if (timerRef.current) clearInterval(timerRef.current);

    // Clear state
    setTranscript('');
    setRawTranscript('');
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource('manual');
    transcriptionSourceRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    setFeedback(null);
    setTimer(0);
    setIsRecording(false);
    setStatusMessage('Ready');
    setStep('idle');
    setTranscriptCleanupNote('');
    addDebugLog('Attempt reset (Retry) — transcript, feedback, timer cleared');
  };

  const stopRecording = () => {
    intentionalSpeechStopRef.current = true;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* may already be stopped */ }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) { cleanupAudioCapture(); }
    } else {
      cleanupAudioCapture();
    }
    if (silenceTimeoutRef.current) clearTimeout(silenceTimeoutRef.current);
    clearInterval(timerRef.current);
    setIsRecording(false);
    setStep('editing');
    setStatusMessage('Ready');
    if (!audioBlob && !mediaRecorderRef.current) {
      setTranscriptCleanupNote('Browser transcription used.');
    }
    addDebugLog("Recording stopped");
  };

  const transcribeAudio = async (captureContext = audioBlobContextRef.current) => {
    if (!audioBlob || isTranscribingAudio) return;
    if (!isCurrentCaptureContext(captureContext)) {
      ignoreStaleAudioTranscript();
      return;
    }
    if (!realAudioTranscriptionAvailable) {
      const message = getAIProviderName().startsWith('mock')
        ? 'Mock transcription is for development only; browser transcript is used.'
        : 'Audio transcription unavailable; browser transcript used. Please check before analysis.';
      setAudioTranscriptionError(message);
      setTranscriptCleanupNote(message);
      addDebugLog('Audio transcription unavailable');
      return;
    }
    setIsTranscribingAudio(true);
    setAudioTranscriptionError('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setProviderDiagnostic(null);
    setTranscriptCleanupNote('Improving transcript from audio...');
    addDebugLog('Audio transcript requested');
    try {
      const audioBase64 = await blobToBase64(audioBlob);
      if (!isCurrentCaptureContext(captureContext)) {
        ignoreStaleAudioTranscript();
        return;
      }
      const transcriptionHints = buildSpeakingTranscriptionHints({
        part,
        question: question?.question || '',
        topic: question?.topicCategory || question?.topic,
        tags: question?.tags,
        cueCard: question?.cueCard,
      });
      const { feedback: result, diagnostic, route } = await routedTranscribeSpeakingAudio({
        part,
        question: question?.question || '',
        audioBase64,
        mimeType: audioMimeType || audioBlob.type || 'audio/webm',
        topic: question?.topicCategory || question?.topic,
        tags: question?.tags,
        cueCard: question?.cueCard,
        roughBrowserTranscript: rawTranscript,
        transcriptionHints,
      });
      if (!isCurrentCaptureContext(captureContext)) {
        ignoreStaleAudioTranscript();
        return;
      }
      setProviderDiagnostic(diagnostic);
      setAudioTranscriptionProvider(route.providerName);

      if (diagnostic.failureKind || !result.transcript.trim()) {
        const message = route.providerName === 'mock'
          ? 'Mock transcription is for development only; browser transcript is used.'
          : 'Audio transcription unavailable; browser transcript used. Please check before analysis.';
        setAudioTranscriptionError(message);
        setTranscriptCleanupNote('Audio transcription unavailable; browser transcript used. Please check before analysis.');
        addDebugLog('Audio transcription unavailable');
        return;
      }

      const cleanedAudioTranscript = result.transcript.trim();
      const isMockAudioTranscript = route.providerName === 'mock' || /\[mock audio transcript\]/i.test(cleanedAudioTranscript);
      setAudioTranscript(cleanedAudioTranscript);
      setAudioUncertaintyNotes(result.uncertaintyNotes || []);
      addDebugLog('Audio transcript received');
      setAudioTranscriptIsMock(isMockAudioTranscript);
      const browserTranscriptIsMeaningful = hasMeaningfulBrowserTranscript(rawTranscript);

      if (isMockAudioTranscript) {
        const message = 'Mock transcription is for development only; browser transcript is used.';
        setAudioTranscriptionError(message);
        setTranscriptCleanupNote(message);
        return;
      }

      if (hasManualTranscriptEditRef.current) {
        setAudioTranscriptNeedsAdoption(true);
        setTranscriptCleanupNote('Audio transcript is ready, but your manual edits were preserved.');
        return;
      }

      if (!browserTranscriptIsMeaningful) {
        setAudioTranscriptNeedsAdoption(true);
        setTranscriptCleanupNote('Audio transcript is ready in the details area. Use it only if it matches what you said.');
        addDebugLog('Held audio transcript as candidate because browser transcript was not meaningful.');
        return;
      }

      setTranscript(cleanedAudioTranscript);
      setAudioTranscriptNeedsAdoption(false);
      setTranscriptCleanupNote('Audio transcription used. Please quickly check before analysis.');
      setTranscriptionSource('audio');
      transcriptionSourceRef.current = 'audio';
      transcriptOriginRef.current = 'manual';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Audio transcription unavailable; browser transcript used. Please check before analysis.';
      setAudioTranscriptionError(message);
      setTranscriptCleanupNote('Audio transcription unavailable; browser transcript used. Please check before analysis.');
      addDebugLog('Audio transcription unavailable');
    } finally {
      setIsTranscribingAudio(false);
    }
  };

  const adoptAudioTranscriptCandidate = () => {
    if (!audioTranscript.trim() || !audioTranscriptNeedsAdoption) return;
    setTranscript(audioTranscript);
    setAudioTranscriptNeedsAdoption(false);
    setTranscriptCleanupNote('Audio transcript copied into your answer. Please quickly check before analysis.');
    setTranscriptionSource('audio');
    transcriptionSourceRef.current = 'audio';
    transcriptOriginRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    addDebugLog('Audio transcript adopted manually for current Part 1 question.');
  };

  useEffect(() => {
    if (step !== 'editing' || !audioBlob || autoAudioTranscriptionAttemptedRef.current) return;
    const captureContext = audioBlobContextRef.current;
    if (!isCurrentCaptureContext(captureContext)) {
      ignoreStaleAudioTranscript();
      return;
    }
    autoAudioTranscriptionAttemptedRef.current = true;
    if (!canUseRealAudioTranscriptionProvider()) {
      const message = getAIProviderName().startsWith('mock')
        ? 'Mock transcription is for development only; browser transcript is used.'
        : 'Audio transcription unavailable; browser transcript used. Please check before analysis.';
      setTranscriptCleanupNote(message);
      setAudioTranscriptionError(message);
      addDebugLog('Audio transcription unavailable');
      return;
    }
    void transcribeAudio(captureContext);
  }, [audioBlob, step]);

  const lockThreadAnswer = () => {
    if (!part1Thread || !currentThreadQuestion || !transcript.trim()) return;
    invalidateCaptureContext();
    const now = new Date().toISOString();
    const locked: LockedThreadAnswer = {
      questionId: currentThreadQuestion.id,
      question: currentThreadQuestion.question,
      transcript: transcript.trim(),
      rawTranscript: rawTranscript || undefined,
      audioTranscript: audioTranscript || undefined,
      transcriptOrigin: transcriptOriginRef.current,
      transcriptSource: transcriptionSource === 'browser' ? 'speech' : transcriptionSource,
      lockedAt: now,
    };
    const nextAnswers = [...lockedThreadAnswers, locked];
    setLockedThreadAnswers(nextAnswers);
    setTranscript('');
    setRawTranscript('');
    setAudioBlob(null);
    setAudioMimeType('');
    setAudioTranscript('');
    setAudioTranscriptNeedsAdoption(false);
    setAudioTranscriptionError('');
    setAudioUncertaintyNotes([]);
    setAudioTranscriptionProvider('');
    setAudioTranscriptIsMock(false);
    setTranscriptionSource('manual');
    transcriptionSourceRef.current = 'manual';
    hasManualTranscriptEditRef.current = false;
    autoAudioTranscriptionAttemptedRef.current = false;
    transcriptOriginRef.current = 'manual';
    setTimer(0);
    setStatusMessage('Ready');
    setTranscriptCleanupNote('');
    setProviderErrorMessage('');

    if (nextAnswers.length >= part1Thread.questions.length) {
      setActiveThreadIndex(part1Thread.questions.length - 1);
      setStep('analyzing');
      void analyzePart1Thread(nextAnswers);
      return;
    }

    const nextIndex = nextAnswers.length;
    setActiveThreadIndex(nextIndex);
    setQuestion(toSpeakingQuestion(part1Thread, nextIndex));
    setStep('idle');
  };

  const replacePart1CleanRetryAnswers = (
    source: SpeakingFeedback,
    cleanRetryAnswers: Part1CleanRetryAnswer[],
  ): SpeakingFeedback => {
    if (!source.threadFeedback) return source;
    const next: SpeakingFeedback = {
      ...source,
      threadFeedback: {
        ...source.threadFeedback,
        cleanRetryAnswers,
      },
      obsidianMarkdown: '',
    };
    return {
      ...next,
      obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
    };
  };

  const mergePart1CertificationDiagnostics = (
    generationDiagnostic: ProviderDiagnostic,
    certificationDiagnostics: ProviderDiagnostic[],
    status: 'passed_first_attempt' | 'rewritten_then_passed' | 'failed_after_rewrite',
    violationCount: number,
  ): ProviderDiagnostic => ({
    ...generationDiagnostic,
    fallbackUsed: generationDiagnostic.fallbackUsed || certificationDiagnostics.some(item => item.fallbackUsed),
    failureKind: certificationDiagnostics.find(item => item.failureKind)?.failureKind || generationDiagnostic.failureKind,
    validationErrors: [
      ...generationDiagnostic.validationErrors,
      ...certificationDiagnostics.flatMap(item => item.validationErrors.map(error => `part1CleanRetryCertification:${error}`)),
    ],
    normalizedFields: [
      ...(generationDiagnostic.normalizedFields || []),
      ...certificationDiagnostics.flatMap((item, index) => [
        `part1CleanRetryCertificationAttempt:${index + 1}`,
        `part1CleanRetryCertificationProvider:${item.providerName}`,
        `part1CleanRetryCertificationOperation:${item.operation}`,
        ...(item.failureKind ? [`part1CleanRetryCertificationFailure:${item.failureKind}`] : []),
        ...(item.normalizedFields || []).map(field => `part1CleanRetryCertification:${field}`),
      ]),
      `part1CleanRetryCertification:${status}`,
      `part1CleanRetryCertificationViolationCount:${violationCount}`,
    ],
    timestamp: certificationDiagnostics.at(-1)?.timestamp || generationDiagnostic.timestamp,
  });

  const analyzePart1Thread = async (
    answers: LockedThreadAnswer[] = lockedThreadAnswers,
    options: { preserveCurrentResultOnFailure?: boolean } = {},
  ) => {
    if (!part1Thread || answers.length < part1Thread.questions.length) return;
    const previousFeedback = feedback;
    const combinedTranscript = answers
      .map((answer, index) => `Q${index + 1}: ${answer.question}\nA${index + 1}: ${answer.transcript}`)
      .join('\n\n');
    setStep('analyzing');
    setProviderErrorMessage('');
    setProviderDiagnostic(null);
    addDebugLog('Starting Part 1 topic-thread AI analysis flow...');
    const restorePreviousResultAfterReanalysisFailure = () => {
      if (!options.preserveCurrentResultOnFailure || !previousFeedback) return false;
      setFeedback(previousFeedback);
      setProviderErrorMessage('Re-analysis could not be completed. The current result is still shown and the locked answers are preserved.');
      setStep('results');
      addDebugLog('Part 1 result-page re-analysis failed; previous result kept visible.');
      return true;
    };
    try {
      const analysisRequest = {
        part: 1,
        sessionKind: 'part1_topic_thread',
        topic: part1Thread.topic,
        threadId: part1Thread.id,
        question: part1Thread.questions.map((item, index) => `Q${index + 1}. ${item.question}`).join('\n'),
        transcript: combinedTranscript,
        threadAnswers: answers.map(answer => ({
          questionId: answer.questionId,
          question: answer.question,
          answer: answer.transcript,
        })),
        retryReference: part1RetryReference || undefined,
      } as const;
      let { feedback: result, diagnostic } = await routedAnalyzeSpeaking(analysisRequest, false);
      const expectedThreadAnswers = answers.map(answer => ({
        questionId: answer.questionId,
        question: answer.question,
        transcript: answer.transcript,
      }));
      const qualityThreadAnswers = answers.map(answer => ({
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.transcript,
      }));
      const integrity = validatePart1ThreadFeedbackIntegrity(result, expectedThreadAnswers);
      const diagnosticWithIntegrity = {
        ...diagnostic,
        normalizedFields: [
          ...(diagnostic.normalizedFields || []),
          `part1CleanRetryExpected:${integrity.expectedCount}`,
          `part1CleanRetryValid:${integrity.validCleanRetryCount}`,
          ...(integrity.missingCleanRetryRefs.length ? [`part1CleanRetryMissing:${integrity.missingCleanRetryRefs.join(',')}`] : []),
          ...(integrity.duplicateCleanRetryRefs.length ? [`part1CleanRetryDuplicate:${integrity.duplicateCleanRetryRefs.join(',')}`] : []),
          ...(integrity.unknownCleanRetryRefs.length ? [`part1CleanRetryUnknown:${integrity.unknownCleanRetryRefs.join(',')}`] : []),
          ...(integrity.missingContainers.length ? [`part1ThreadMissingContainers:${integrity.missingContainers.join(',')}`] : []),
          ...(integrity.threadAnswerMismatch.length ? [`part1ThreadAnswerMismatch:${integrity.threadAnswerMismatch.join(',')}`] : []),
          ...(part1RetryReference ? [
            'part1RetryChain:continued',
            `part1RetryReferenceAnswers:${part1RetryReference.cleanRetryAnswers.length}`,
            `part1MaterialContinuityCarried:${part1RetryReference.carriedMyUsableMaterial?.length || 0}`,
          ] : []),
        ],
      };
      setProviderDiagnostic(diagnosticWithIntegrity);

      if (diagnostic.failureKind === 'provider_unavailable') {
        if (restorePreviousResultAfterReanalysisFailure()) return;
        setProviderErrorMessage(lockedThreadRecoveryMessage(answers.length));
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, combinedTranscript);
        if (failedBase) {
          const failedRecord = {
            ...failedBase,
            threadAnswers: answers,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          };
          const session = activeSessionRef.current || {
            id: createRecordId('speaking_session'),
            currentPart: 1,
            attemptsByPart: {},
            updatedAt: new Date().toISOString(),
          };
          activeSessionRef.current = {
            ...session,
            currentPart: 1,
            attemptsByPart: {
              ...session.attemptsByPart,
              1: failedRecord,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          upsertPracticeRecord(failedRecord);
        }
        addDebugLog('Provider unavailable for Part 1 topic-thread feedback.');
        return;
      }

      addDebugLog(`Part 1 clean retry answers expected: ${integrity.expectedCount}`);
      addDebugLog(`Part 1 clean retry answers valid: ${integrity.validCleanRetryCount}`);
      if (integrity.missingCleanRetryRefs.length) addDebugLog(`Missing clean retry answer refs: ${integrity.missingCleanRetryRefs.join(', ')}`);
      if (integrity.duplicateCleanRetryRefs.length) addDebugLog(`Duplicate clean retry answer refs: ${integrity.duplicateCleanRetryRefs.join(', ')}`);
      if (integrity.unknownCleanRetryRefs.length) addDebugLog(`Unknown clean retry answer refs: ${integrity.unknownCleanRetryRefs.join(', ')}`);

      if (diagnostic.failureKind === 'parse_or_schema' || !integrity.ok) {
        if (restorePreviousResultAfterReanalysisFailure()) return;
        setFeedbackFallbackUsed(diagnostic.fallbackUsed);
        setFeedback(null);
        setProviderErrorMessage(lockedThreadRecoveryMessage(answers.length));
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, combinedTranscript);
        if (failedBase) {
          const failedRecord = {
            ...failedBase,
            threadAnswers: answers,
            providerDiagnostic: summarizeDiagnostic(diagnosticWithIntegrity),
          };
          const session = activeSessionRef.current || {
            id: createRecordId('speaking_session'),
            currentPart: 1,
            attemptsByPart: {},
            updatedAt: new Date().toISOString(),
          };
          activeSessionRef.current = {
            ...session,
            currentPart: 1,
            attemptsByPart: {
              ...session.attemptsByPart,
              1: failedRecord,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          upsertPracticeRecord(failedRecord);
        }
        addDebugLog(`Part 1 topic-thread core feedback incomplete: ${integrity.summary}`);
        return;
      }

      const stabilized = stabilizeCleanRetryAnswersForRetry(result, answers, part1RetryReference);
      const candidateResult = stabilized.feedback;
      if (stabilized.stabilizedCount) {
        addDebugLog(`Part 1 clean retry answers kept from submitted certified retry: ${stabilized.stabilizedCount}`);
      }

      const certificationThreadAnswers = answers.map(answer => ({
        questionId: answer.questionId,
        question: answer.question,
        answer: answer.transcript,
      }));
      const certificationDiagnostics: ProviderDiagnostic[] = [];
      const saveCertificationFailure = (finalDiagnostic: ProviderDiagnostic, message: string) => {
        if (restorePreviousResultAfterReanalysisFailure()) return;
        setFeedbackFallbackUsed(finalDiagnostic.fallbackUsed);
        setFeedback(null);
        setProviderErrorMessage(message);
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, combinedTranscript);
        if (failedBase) {
          const failedRecord = {
            ...failedBase,
            threadAnswers: answers,
            providerDiagnostic: summarizeDiagnostic(finalDiagnostic),
          };
          const session = activeSessionRef.current || {
            id: createRecordId('speaking_session'),
            currentPart: 1,
            attemptsByPart: {},
            updatedAt: new Date().toISOString(),
          };
          activeSessionRef.current = {
            ...session,
            currentPart: 1,
            attemptsByPart: {
              ...session.attemptsByPart,
              1: failedRecord,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          upsertPracticeRecord(failedRecord);
        }
      };

      const attempt1 = await routedCertifyPart1CleanRetry({
        topic: part1Thread.topic,
        threadId: part1Thread.id,
        threadAnswers: certificationThreadAnswers,
        cleanRetryAnswers: candidateResult.threadFeedback?.cleanRetryAnswers || [],
        attempt: 1,
      });
      certificationDiagnostics.push(attempt1.diagnostic);
      setProviderDiagnostic(attempt1.diagnostic);
      addDebugLog(`Part 1 clean retry certification attempt 1: ${attempt1.feedback.status}`);
      addDebugLog(`Part 1 clean retry certification attempt 1 violations: ${attempt1.feedback.violations.length}`);

      let finalResult = candidateResult;
      let finalDiagnostic = mergePart1CertificationDiagnostics(
        diagnosticWithIntegrity,
        certificationDiagnostics,
        attempt1.feedback.status === 'passed' && !attempt1.diagnostic.failureKind
          ? 'passed_first_attempt'
          : 'failed_after_rewrite',
        attempt1.feedback.violations.length,
      );

      if (attempt1.diagnostic.failureKind) {
        setProviderDiagnostic(finalDiagnostic);
        if (options.preserveCurrentResultOnFailure) {
          finalResult = withPart1CertificationStatus(candidateResult, 'legacy_or_unverified');
          addDebugLog(`Part 1 clean retry certification provider failure during re-analysis; displaying core feedback and continuing to learning assets: ${attempt1.diagnostic.failureKind}`);
        } else {
          saveCertificationFailure(finalDiagnostic, lockedThreadRecoveryMessage(answers.length));
          addDebugLog(`Part 1 clean retry certification provider failure: ${attempt1.diagnostic.failureKind}`);
          return;
        }
      } else if (attempt1.feedback.status === 'failed') {
        const revisedResult = replacePart1CleanRetryAnswers(candidateResult, attempt1.feedback.revisedCleanRetryAnswers || []);
        const revisedIntegrity = validatePart1ThreadFeedbackIntegrity(revisedResult, expectedThreadAnswers);
        if (!revisedIntegrity.ok) {
          finalDiagnostic = mergePart1CertificationDiagnostics(
            diagnosticWithIntegrity,
            certificationDiagnostics,
            'failed_after_rewrite',
            attempt1.feedback.violations.length,
          );
          setProviderDiagnostic(finalDiagnostic);
          if (options.preserveCurrentResultOnFailure) {
            finalResult = withPart1CertificationStatus(candidateResult, 'legacy_or_unverified');
            addDebugLog(`Part 1 clean retry certification rewrite incomplete during re-analysis; displaying original core feedback and continuing to learning assets: ${revisedIntegrity.summary}`);
          } else {
            saveCertificationFailure(finalDiagnostic, lockedThreadRecoveryMessage(answers.length));
            addDebugLog(`Part 1 clean retry certification failed without a complete rewrite: ${revisedIntegrity.summary}`);
            return;
          }
        } else {
          const attempt2 = await routedCertifyPart1CleanRetry({
            topic: part1Thread.topic,
            threadId: part1Thread.id,
            threadAnswers: certificationThreadAnswers,
            cleanRetryAnswers: revisedResult.threadFeedback?.cleanRetryAnswers || [],
            attempt: 2,
          });
          certificationDiagnostics.push(attempt2.diagnostic);
          setProviderDiagnostic(attempt2.diagnostic);
          addDebugLog(`Part 1 clean retry certification attempt 2: ${attempt2.feedback.status}`);
          addDebugLog(`Part 1 clean retry certification attempt 2 violations: ${attempt2.feedback.violations.length}`);

          finalDiagnostic = mergePart1CertificationDiagnostics(
            diagnosticWithIntegrity,
            certificationDiagnostics,
            attempt2.feedback.status === 'passed' && !attempt2.diagnostic.failureKind
              ? 'rewritten_then_passed'
              : 'failed_after_rewrite',
            attempt1.feedback.violations.length + attempt2.feedback.violations.length,
          );

          if (attempt2.diagnostic.failureKind || attempt2.feedback.status !== 'passed') {
            setProviderDiagnostic(finalDiagnostic);
            if (options.preserveCurrentResultOnFailure) {
              finalResult = withPart1CertificationStatus(revisedResult, 'legacy_or_unverified');
              addDebugLog('Part 1 clean retry certification did not pass during re-analysis; displaying rewritten core feedback and continuing to learning assets.');
            } else {
              saveCertificationFailure(finalDiagnostic, lockedThreadRecoveryMessage(answers.length));
              addDebugLog('Part 1 clean retry certification failed after one automatic rewrite.');
              return;
            }
          } else {
            finalResult = withPart1CertificationStatus(revisedResult, 'certified_after_rewrite');
            addDebugLog('Part 1 clean retry answers required one automatic rewrite before certification.');
          }
        }
      } else {
        finalResult = withPart1CertificationStatus(finalResult, 'certified_first_attempt');
      }

      finalResult = withClearedPart1LearningAssets(finalResult);
      const learningAssetsBaseRequest = {
        topic: part1Thread.topic,
        threadId: part1Thread.id,
        threadAnswers: certificationThreadAnswers,
        cleanRetryAnswers: finalResult.threadFeedback?.cleanRetryAnswers || [],
        annotations: finalResult.threadFeedback?.annotations || [],
        retryReference: part1RetryReference || undefined,
        carriedMyUsableMaterial: part1RetryReference?.carriedMyUsableMaterial || [],
      };
      const learningDiagnostics: ProviderDiagnostic[] = [];
      let carriedMaterial = part1RetryReference?.carriedMyUsableMaterial || [];
      try {
        addDebugLog('Generating Part 1 learning assets in a separate pass...');
        const learningRun = await routedAnalyzePart1LearningAssets({
          ...learningAssetsBaseRequest,
          attempt: 1,
        });
        learningDiagnostics.push(learningRun.diagnostic);
        setProviderDiagnostic(learningRun.diagnostic);
        let selectedLearningDiagnostic = learningRun.diagnostic;
        let selectedLearningSnapshot = summarizePart1LearningCandidate(
          withPart1LearningAssets(finalResult, learningRun.feedback),
          qualityThreadAnswers,
        );
        addDebugLog(
          `Part 1 learning-assets attempt 1 visible counts: development ${selectedLearningSnapshot.developmentCount}/${qualityThreadAnswers.length}, chunks ${selectedLearningSnapshot.developmentChunkCount}, expressions ${selectedLearningSnapshot.expressionCount}, materials ${selectedLearningSnapshot.materialCount}`,
        );
        if (!learningRun.diagnostic.failureKind && part1LearningSnapshotNeedsRepair(selectedLearningSnapshot, qualityThreadAnswers.length)) {
          const repairFocus = buildPart1LearningRepairFocus(selectedLearningSnapshot, qualityThreadAnswers.length);
          addDebugLog(`Part 1 learning-assets attempt 1 underfilled; asking provider for a gap-fill pass: ${repairFocus}`);
          const repairRun = await routedAnalyzePart1LearningAssets({
            ...learningAssetsBaseRequest,
            attempt: 2,
            repairFocus,
          });
          learningDiagnostics.push(repairRun.diagnostic);
          setProviderDiagnostic(repairRun.diagnostic);
          const repairSnapshot = summarizePart1LearningCandidate(
            withPart1LearningAssets(finalResult, repairRun.feedback),
            qualityThreadAnswers,
          );
          addDebugLog(
            `Part 1 learning-assets attempt 2 visible counts: development ${repairSnapshot.developmentCount}/${qualityThreadAnswers.length}, chunks ${repairSnapshot.developmentChunkCount}, expressions ${repairSnapshot.expressionCount}, materials ${repairSnapshot.materialCount}`,
          );
          if (!repairRun.diagnostic.failureKind && repairSnapshot.score >= selectedLearningSnapshot.score) {
            selectedLearningDiagnostic = repairRun.diagnostic;
            selectedLearningSnapshot = repairSnapshot;
            addDebugLog('Part 1 learning-assets gap-fill pass selected for display.');
          } else {
            addDebugLog('Part 1 learning-assets gap-fill pass was not better; keeping attempt 1 for display.');
          }
        }
        const learningQuality = selectedLearningSnapshot.quality;
        finalResult = selectedLearningSnapshot.feedback;
        carriedMaterial = selectedLearningDiagnostic.failureKind ? [] : carriedMaterial;
        addDebugLog(
          learningQuality.ok
            ? 'Part 1 learning-assets diagnostic quality: ok'
            : `Part 1 learning-assets diagnostic quality warning only; displaying provider feedback as returned: ${learningQuality.summary}`,
        );
        finalDiagnostic = {
          ...finalDiagnostic,
          fallbackUsed: finalDiagnostic.fallbackUsed || learningDiagnostics.some(item => item.fallbackUsed),
          validationErrors: [
            ...finalDiagnostic.validationErrors,
            ...learningDiagnostics.flatMap(item => item.validationErrors.map(error => `part1LearningAssets:${error}`)),
          ],
          normalizedFields: [
            ...(finalDiagnostic.normalizedFields || []),
            ...learningDiagnostics.flatMap((item, index) => [
              `part1LearningAssetsAttempt:${index + 1}`,
              `part1LearningAssetsProvider:${item.providerName}`,
              `part1LearningAssetsOperation:${item.operation}`,
              ...(item.failureKind ? [`part1LearningAssetsFailure:${item.failureKind}`] : []),
              ...(item.normalizedFields || []).map(field => `part1LearningAssets:${field}`),
            ]),
            `part1LearningPayloadQuality:${learningQuality.ok ? 'ok' : 'warning_only'}`,
            `part1LearningPayloadDevelopmentTargets:${selectedLearningSnapshot.developmentCount}`,
            `part1LearningPayloadDevelopmentChunks:${selectedLearningSnapshot.developmentChunkCount}`,
            `part1LearningPayloadExpressions:${selectedLearningSnapshot.expressionCount}`,
            `part1LearningPayloadMaterials:${selectedLearningSnapshot.materialCount}`,
            ...(learningQuality.issues.length ? [`part1LearningPayloadIssues:${learningQuality.issues.join('|')}`] : []),
          ],
          timestamp: learningDiagnostics.at(-1)?.timestamp || finalDiagnostic.timestamp,
        };
      } catch (learningError) {
        carriedMaterial = [];
        addDebugLog(`Part 1 learning-assets generation error during re-analysis; displaying core feedback: ${learningError}`);
        finalDiagnostic = {
          ...finalDiagnostic,
          validationErrors: [
            ...finalDiagnostic.validationErrors,
            `part1LearningAssetsException:${learningError instanceof Error ? learningError.message : String(learningError)}`,
          ],
          normalizedFields: [
            ...(finalDiagnostic.normalizedFields || []),
            'part1LearningAssetsException',
          ],
        };
      }
      const freshMaterialCount = finalResult.threadFeedback?.materialBank.myUsableMaterial.length || 0;
      const materialMerge = withMergedPart1Material(finalResult, carriedMaterial);
      finalResult = withDerivedPart1SessionPriorityState(materialMerge.feedback);
      const mergedMaterialCount = finalResult.threadFeedback?.materialBank.myUsableMaterial.length || 0;
      const threadStable = isPart1ThreadStableResult(finalResult);
      const priorityState = derivePart1SessionPriorityState(finalResult) || 'core_repair_needed';
      const optionalDevelopmentAvailable = Boolean([
        finalResult.threadFeedback?.nextRetryPlan?.priorityAccuracyPatternZh,
        finalResult.threadFeedback?.nextRetryPlan?.answerLengthRuleZh,
        finalResult.threadFeedback?.nextRetryPlan?.materialToTry,
        ...(finalResult.threadFeedback?.nextRetryPlan?.actions || []),
        ...(finalResult.threadFeedback?.threadLevelPatterns || []).flatMap(item => [item.observationZh, item.whyItMattersZh, item.retryRule]),
      ].filter((item): item is string => Boolean(item?.trim())).some(isPart1OptionalDevelopmentText));
      addDebugLog(`part1PreviousCleanerConflicts:${finalResult.threadFeedback?.previousCleanerConflictCount || 0}`);
      addDebugLog(`part1MaterialFreshAccepted:${freshMaterialCount}`);
      addDebugLog(`part1MaterialContinuityMerged:${mergedMaterialCount}`);
      addDebugLog(`part1MaterialContinuityDeduped:${materialMerge.dedupedCount}`);
      addDebugLog(`part1ThreadStable:${threadStable}`);
      addDebugLog(`part1SessionPriorityState:${priorityState}`);
      addDebugLog(`part1DevelopmentTargets:${finalResult.threadFeedback?.developmentTargets?.length || 0}`);
      addDebugLog(`part1OptionalDevelopmentAvailable:${optionalDevelopmentAvailable}`);
      finalDiagnostic = {
        ...finalDiagnostic,
        normalizedFields: [
          ...(finalDiagnostic.normalizedFields || []),
          `part1PreviousCleanerConflicts:${finalResult.threadFeedback?.previousCleanerConflictCount || 0}`,
          `part1MaterialFreshAccepted:${freshMaterialCount}`,
          `part1MaterialContinuityCarried:${carriedMaterial.length}`,
          `part1MaterialContinuityMerged:${mergedMaterialCount}`,
          `part1MaterialContinuityDeduped:${materialMerge.dedupedCount}`,
          `part1ThreadStable:${threadStable}`,
          `part1SessionPriorityState:${priorityState}`,
          `part1DevelopmentTargets:${finalResult.threadFeedback?.developmentTargets?.length || 0}`,
          `part1OptionalDevelopmentAvailable:${optionalDevelopmentAvailable}`,
        ],
      };

      setProviderDiagnostic(finalDiagnostic);
      setFeedbackFallbackUsed(finalDiagnostic.fallbackUsed);
      setFeedback(finalResult);
      setStep('results');
      const analyzedBase = buildCurrentSpeakingRecord('analyzed', finalResult, combinedTranscript);
      if (analyzedBase) {
        const saveResult = await upsertPracticeRecord({
          ...analyzedBase,
          threadAnswers: answers,
          feedback: finalResult,
          obsidianMarkdown: finalResult.obsidianMarkdown,
          analyzedAt: finalDiagnostic.timestamp,
          providerDiagnostic: summarizeDiagnostic(finalDiagnostic),
        });
        if (!saveResult.ok) setStorageFullWarning('本地存储空间已满，分析结果未能保存。请先导出数据备份，修复存储前建议暂停新练习。');
      }
      clearActiveSpeakingAttempt(1);
      saveSession({
        id: `sp_${Date.now()}`,
        module: 'speaking',
        part: 1,
        band: finalResult.bandEstimateExcludingPronunciation || undefined,
      });
      addDebugLog(
        finalDiagnostic.normalizedFields?.includes('part1CleanRetryCertification:rewritten_then_passed')
          ? 'Part 1 topic-thread analysis complete; certified rewritten clean retry answers displayed.'
          : 'Part 1 topic-thread analysis complete; clean retry answers certified on first pass.',
      );
    } catch (error) {
      addDebugLog(`Part 1 topic-thread analysis error: ${error}`);
      if (restorePreviousResultAfterReanalysisFailure()) return;
      setProviderErrorMessage(lockedThreadRecoveryMessage(answers.length));
      setStep('editing');
    }
  };

  const analyze = async (options: { preserveCurrentResultOnFailure?: boolean } = {}) => {
    if (!transcript.trim()) return;
    const previousFeedback = feedback;
    const shouldRestorePreviousResult = () => Boolean(options.preserveCurrentResultOnFailure && previousFeedback);
    const restorePreviousResultAfterSpeakingReanalysisFailure = (message: string) => {
      if (!shouldRestorePreviousResult()) return false;
      setFeedback(previousFeedback);
      setProviderErrorMessage(message);
      setStep('results');
      addDebugLog('Speaking result-page re-analysis failed; previous result kept visible.');
      return true;
    };
    if (feedback) {
      activeAttemptIdRef.current = createRecordId('sp');
      if (!options.preserveCurrentResultOnFailure) {
        setFeedback(null);
        setFeedbackFallbackUsed(false);
      }
    }
    const cleanedTranscript = transcript.trim();
    if (cleanedTranscript !== transcript) setTranscript(cleanedTranscript);
    setTranscriptCleanupNote('');
    setStep('analyzing');
    setProviderErrorMessage('');
    setProviderDiagnostic(null);
    addDebugLog("Starting AI analysis flow...");
    addDebugLog("Analyzing final reviewed transcript");
    if (rawTranscript.trim()) addDebugLog("Raw browser transcript preserved separately.");
    try {
      const { feedback: result, diagnostic } = await routedAnalyzeSpeaking({
        part,
        question: question?.question || '',
        transcript: cleanedTranscript,
        masteredExpressions: part === 2 && part2MasteredExpressionHints.length
          ? part2MasteredExpressionHints
          : undefined,
      }, isInsufficientSpeakingSample(cleanedTranscript, part));
      setProviderDiagnostic(diagnostic);

      if (diagnostic.failureKind === 'provider_unavailable') {
        if (restorePreviousResultAfterSpeakingReanalysisFailure('回测失败：AI provider 暂时不可用，当前结果已保留。')) return;
        setFeedbackFallbackUsed(false);
        setProviderErrorMessage('AI provider temporarily unavailable. Please retry later. Your transcript is preserved.');
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, cleanedTranscript);
        if (failedBase) {
          const session = activeSessionRef.current || {
            id: createRecordId('speaking_session'),
            currentPart: part,
            attemptsByPart: {},
            updatedAt: new Date().toISOString(),
          };
          activeSessionRef.current = {
            ...session,
            currentPart: part,
            attemptsByPart: {
              ...session.attemptsByPart,
              [part]: failedBase,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          const saveResult = await upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          });
          if (!saveResult.ok) setStorageFullWarning('本地存储空间已满，未能保存当前状态。请先导出数据备份，修复存储前建议暂停新练习。');
        }
        addDebugLog("Provider unavailable for speaking feedback.");
        return;
      }

      if (isIncompleteSpeakingFeedback(result, diagnostic.failureKind)) {
        if (restorePreviousResultAfterSpeakingReanalysisFailure('回测失败：AI feedback 不完整，当前结果已保留。')) return;
        setFeedbackFallbackUsed(diagnostic.fallbackUsed);
        setFeedback(null);
        setProviderErrorMessage('AI feedback was incomplete. Your transcript is preserved; please retry analysis.');
        setStep('editing');
        const failedBase = buildCurrentSpeakingRecord('provider_failed', null, cleanedTranscript);
        if (failedBase) {
          const session = activeSessionRef.current || {
            id: createRecordId('speaking_session'),
            currentPart: part,
            attemptsByPart: {},
            updatedAt: new Date().toISOString(),
          };
          activeSessionRef.current = {
            ...session,
            currentPart: part,
            attemptsByPart: {
              ...session.attemptsByPart,
              [part]: failedBase,
            },
            updatedAt: new Date().toISOString(),
          };
          saveActiveSpeakingSession(activeSessionRef.current);
          const saveResult = await upsertPracticeRecord({
            ...failedBase,
            providerDiagnostic: summarizeDiagnostic(diagnostic),
          });
          if (!saveResult.ok) setStorageFullWarning('本地存储空间已满，未能保存当前状态。请先导出数据备份，修复存储前建议暂停新练习。');
        }
        addDebugLog("Incomplete speaking feedback preserved as retryable state.");
        return;
      }

      const resultFeedback = result;
      const finalDiagnostic = diagnostic;

      setFeedbackFallbackUsed(diagnostic.fallbackUsed || finalDiagnostic.fallbackUsed);
      setFeedback(resultFeedback);
      setStep('results');
      const analyzedBase = buildCurrentSpeakingRecord('analyzed', resultFeedback, cleanedTranscript);
      if (analyzedBase) {
        const saveResult = await upsertPracticeRecord({
          ...analyzedBase,
          feedback: resultFeedback,
          obsidianMarkdown: resultFeedback.obsidianMarkdown,
          analyzedAt: finalDiagnostic.timestamp,
          providerDiagnostic: summarizeDiagnostic(finalDiagnostic),
        });
        if (!saveResult.ok) setStorageFullWarning('本地存储空间已满，分析结果未能保存。请先导出数据备份，修复存储前建议暂停新练习。');
      }
      clearActiveSpeakingAttempt(part);

      saveSession({
        id: `sp_${Date.now()}`,
        module: 'speaking',
        part,
        band: resultFeedback.bandEstimateExcludingPronunciation || undefined,
      });
      
      addDebugLog("Analysis complete and results displayed.");
      if (diagnostic.fallbackUsed || finalDiagnostic.fallbackUsed) {
        addDebugLog("Provider fallback used for speaking feedback.");
      }
    } catch (error) {
      addDebugLog(`Analysis Error: ${error}`);
      if (restorePreviousResultAfterSpeakingReanalysisFailure('回测失败：当前结果已保留。')) return;
      setFeedbackFallbackUsed(false);
      setStep('editing');
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const exportMarkdown = () => {
    if (!feedback) return;
    const markdown = buildSpeakingTrainingMarkdown(feedback, undefined, {
      hiddenPart1DevelopmentKeys,
      hiddenPart1ExpressionKeys,
      hiddenPart1MaterialKeys,
    });
    const blob = new Blob([markdown || feedback.obsidianMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildMarkdownExportFilename({
      module: 'speaking',
      taskOrPart: `p${part}`,
      topic: feedback.sessionKind === 'part1_topic_thread'
        ? feedback.threadFeedback?.topic || feedback.topic || part1Thread?.topic
        : question?.topicCategory || question?.topic,
      prompt: feedback.question || question?.question,
      sessionKind: feedback.sessionKind,
    });
    a.click();
    URL.revokeObjectURL(url);
  };

  const isMock = getAIProviderName() !== 'gemini';
  const realAudioTranscriptionAvailable = canUseRealAudioTranscriptionProvider();
  const canRetryAudioTranscription = Boolean(audioBlob) && realAudioTranscriptionAvailable && !isTranscribingAudio;
  const canAdoptAudioTranscriptCandidate = step === 'editing' && audioTranscriptNeedsAdoption && Boolean(audioTranscript.trim());
  const transcriptStatus = transcriptCleanupNote || (
    transcriptionSource === 'audio'
      ? 'Audio transcription used. Please quickly check before analysis.'
      : transcriptionSource === 'browser'
        ? 'Browser transcription used.'
        : 'Edited manually.'
  );
  const shouldShowDevelopmentPlan = step === 'results' && isInsufficientSpeakingSample(transcript, part, feedback);
  const isHighBandStable = isHighBandSpeakingStable(feedback);
  const isPart1ThreadResult = feedback?.sessionKind === 'part1_topic_thread' && Boolean(feedback.threadFeedback);
  const threadFeedback = feedback?.threadFeedback;
  const threadAnswersForReview = feedback?.threadAnswers || lockedThreadAnswers.map(answer => ({
    questionId: answer.questionId,
    question: answer.question,
    answer: answer.transcript,
  }));
  const threadAnnotations = threadFeedback?.annotations || [];
  const cleanRetryByQuestion = useMemo(() => {
    const entries = (threadFeedback?.cleanRetryAnswers || []).map(item => [item.questionRef, item] as const);
    return new Map(entries);
  }, [threadFeedback?.cleanRetryAnswers]);
  const part1DisplayModel = buildPart1LearningDisplayModel(threadFeedback, { answers: threadAnswersForReview });
  useEffect(() => {
    setHiddenPart1MaterialKeys([]);
    setHiddenPart1DevelopmentKeys([]);
    setHiddenPart1ExpressionKeys([]);
  }, [feedback?.threadId, feedback?.transcript]);
  const hasCleanRetryAnswers = (threadFeedback?.cleanRetryAnswers?.length || 0) > 0;
  const answerLocalDevelopmentCount = part1DisplayModel.answerCoaching.length;
  const hasNoErrorDevelopmentThread = Boolean(answerLocalDevelopmentCount && !threadAnnotations.length);
  const threadLevelPatterns = part1DisplayModel.sessionPatterns
    .filter(item => !isLowValuePart1ThreadPattern(item))
    .filter(() => !hasNoErrorDevelopmentThread);
  const legacyCoachingFallback = !hasCleanRetryAnswers ? threadFeedback?.answerByAnswerCoaching || [] : [];
  const previousCleanerConflictCount = threadFeedback?.previousCleanerConflictCount || 0;
  const part1SessionPriorityState = step === 'results' && !providerErrorMessage
    ? derivePart1SessionPriorityState(feedback)
    : null;
  const part1ThreadStable = part1SessionPriorityState === 'topic_complete';
  const part1DevelopmentNeeded = part1SessionPriorityState === 'development_needed';
  const part1CoreRepairNeeded = part1SessionPriorityState === 'core_repair_needed';
  const part1SystemRevisionConflict = part1SessionPriorityState === 'system_revision_conflict';
  const part1DevelopmentTargets = consolidatePart1DevelopmentTargets(part1DisplayModel.answerCoaching);
  const part1DevelopmentTargetByQuestion = useMemo(() => new Map(
    part1DevelopmentTargets.map(target => [target.questionRef, target] as const),
  ), [part1DevelopmentTargets]);
  const displayPart1ReusableMaterials = part1DisplayModel.userMaterials.filter(
    item => !hiddenPart1MaterialKeys.includes(part1LearningItemKey(item)),
  );
  const displayPart1ExpressionBank = part1DisplayModel.expressionBank.filter(
    item => !hiddenPart1ExpressionKeys.includes(part1LearningItemKey(item)),
  );
  const hasPart1MaterialBank = Boolean(
    displayPart1ReusableMaterials.length || displayPart1ExpressionBank.length,
  );
  const shouldShowPart1SessionBank = Boolean(
    hasPart1MaterialBank,
  );
  const part1AnswerActionByQuestion = useMemo(() => new Map(
    part1DisplayModel.answerActions.map(action => [action.questionRef, action] as const),
  ), [part1DisplayModel.answerActions]);
  const part1AnnotationRenderByQuestion = useMemo(() => {
    const entries = threadAnswersForReview.map((answer, index) => {
      const questionRef = `Q${index + 1}`;
      const annotations = threadAnnotations.filter(annotation => annotation.questionRef === questionRef);
      return [questionRef, getPart1AnnotationRenderData(answer.answer, annotations)] as const;
    });
    return new Map(entries);
  }, [threadAnswersForReview, threadAnnotations]);
  const part1AnnotationCoverage = useMemo(() => {
    const anchoredCount = Array.from(part1AnnotationRenderByQuestion.values())
      .reduce((count, item) => count + item.anchored.length, 0);
    const unanchoredCount = Array.from(part1AnnotationRenderByQuestion.values())
      .reduce((count, item) => count + item.unanchored.length, 0);
    const unanchoredSignature = Array.from(part1AnnotationRenderByQuestion.entries())
      .flatMap(([questionRef, item]) => item.unanchored.map(annotation => `${questionRef}:${annotation.id}:${annotation.sourceQuote}`))
      .join('|');
    const signature = isPart1ThreadResult && threadFeedback
      ? [
        activeAttemptIdRef.current,
        feedback?.threadId || threadFeedback.threadId,
        feedback?.transcript.length || 0,
        threadAnnotations.length,
        anchoredCount,
        unanchoredCount,
        unanchoredSignature,
      ].join('::')
      : '';
    return { anchoredCount, unanchoredCount, unanchoredSignature, signature };
  }, [feedback?.threadId, feedback?.transcript.length, isPart1ThreadResult, part1AnnotationRenderByQuestion, threadAnnotations.length, threadFeedback]);
  useEffect(() => {
    if (!part1AnnotationCoverage.signature || lastPart1AnnotationCoverageLogRef.current === part1AnnotationCoverage.signature) return;
    lastPart1AnnotationCoverageLogRef.current = part1AnnotationCoverage.signature;
    addDebugLog(`Part 1 annotations received: ${threadAnnotations.length}`);
    addDebugLog(`Anchored annotations: ${part1AnnotationCoverage.anchoredCount}`);
    addDebugLog(`Unanchored annotations: ${part1AnnotationCoverage.unanchoredCount}`);
    if (part1AnnotationCoverage.unanchoredCount > 0) {
      Array.from(part1AnnotationRenderByQuestion.entries()).forEach(([questionRef, item]) => {
        item.unanchored.forEach(annotation => {
          addDebugLog(`Unanchored Part 1 annotation ${questionRef}: ${annotation.sourceQuote}`);
        });
      });
    }
  }, [addDebugLog, part1AnnotationCoverage, part1AnnotationRenderByQuestion, threadAnnotations.length]);
  const selectedThreadAnnotation = selectedThreadAnnotationId
    ? Array.from(part1AnnotationRenderByQuestion.values())
      .flatMap(item => item.anchored.map(span => span.annotation).concat(item.unanchored))
      .find(annotation => annotation.id === selectedThreadAnnotationId) || null
    : null;
  const selectedThreadAnnotationAnchor = selectedThreadAnnotationId
    ? threadAnnotationRefs.current[selectedThreadAnnotationId] || null
    : null;
  const isCompletedPart1ThreadRecovery = Boolean(isPart1ThreadPractice && threadCompleted && step === 'editing' && providerErrorMessage);
  const part1RecoveryLockedAnswerCount = isCompletedPart1ThreadRecovery ? lockedThreadAnswers.length : 0;
  const currentPart1ThreadAnswersForReanalysis: LockedThreadAnswer[] = threadAnswersForReview.map((answer, index) => {
    const lockedAnswer = lockedThreadAnswers[index];
    return {
      questionId: answer.questionId,
      question: answer.question,
      transcript: answer.answer,
      rawTranscript: lockedAnswer?.rawTranscript,
      audioTranscript: lockedAnswer?.audioTranscript,
      transcriptOrigin: lockedAnswer?.transcriptOrigin || 'manual',
      transcriptSource: lockedAnswer?.transcriptSource || 'reviewed',
      lockedAt: lockedAnswer?.lockedAt || new Date().toISOString(),
    };
  });
  const canReanalyzeCurrentPart1Thread = Boolean(
    isPart1ThreadResult &&
    step === 'results' &&
    part1Thread &&
    currentPart1ThreadAnswersForReanalysis.length >= part1Thread.questions.length,
  );
  const reanalyzeCurrentPart1Thread = () => {
    if (!canReanalyzeCurrentPart1Thread) return;
    addDebugLog('Re-analyzing current locked Part 1 topic-thread answers from result page.');
    void analyzePart1Thread(currentPart1ThreadAnswersForReanalysis, { preserveCurrentResultOnFailure: true });
  };
  const canRetestCurrentAnswer = Boolean(
    step === 'results' &&
    ((isPart1ThreadResult && canReanalyzeCurrentPart1Thread) || (!isPart1ThreadResult && transcript.trim())),
  );
  const retestCurrentAnswer = () => {
    if (!canRetestCurrentAnswer) return;
    if (isPart1ThreadResult) {
      reanalyzeCurrentPart1Thread();
      return;
    }
    addDebugLog('Re-analyzing current single-question answer from result page.');
    void analyze({ preserveCurrentResultOnFailure: true });
  };
  const shouldShowTranscriptCard = (step !== 'idle' && step !== 'analyzing' && step !== 'results');
  const shouldShowPracticePromptCard = !(step === 'results' && isPart1ThreadResult);
  const renderAnnotatedPart1Answer = (answer: string, questionRef: string) => {
    const spans = part1AnnotationRenderByQuestion.get(questionRef)?.anchored || [];
    if (!spans.length) {
      return <p className="whitespace-pre-wrap font-serif text-base leading-8 text-paper-ink/75">{normalizePart1TranscriptDisplayText(answer)}</p>;
    }
    const needsVisualWordBreak = (left = '', right = '') =>
      /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    spans.forEach(span => {
      if (span.start > cursor) {
        nodes.push(
          <React.Fragment key={`text-${cursor}`}>
            {renderTextWithBreaks(normalizePart1InlineTranscriptSegment(answer.slice(cursor, span.start), { treatInitialAsSentenceStart: cursor === 0 }))}
          </React.Fragment>,
        );
      }
      const previousChar = answer.slice(Math.max(0, span.start - 1), span.start);
      if (needsVisualWordBreak(previousChar, span.visibleText)) {
        nodes.push(<React.Fragment key={`space-before-${span.start}`}> </React.Fragment>);
      }
      const severity = span.annotation.layers.some(layer => layer.origin === 'previous_cleaner_answer_conflict')
        ? 'better_spoken_choice'
        : strongestPart1AnnotationSeverity(span.annotation);
      nodes.push(
        <button
          key={span.annotation.id}
          type="button"
          ref={element => {
            threadAnnotationRefs.current[span.annotation.id] = element;
          }}
          data-severity={severity}
          className={`part1-answer-mark ${selectedThreadAnnotationId === span.annotation.id ? 'part1-answer-mark--active' : ''}`}
          onClick={() => setSelectedThreadAnnotationId(span.annotation.id)}
      >
          {normalizePart1InlineTranscriptSegment(span.visibleText, { treatInitialAsSentenceStart: span.start === 0 })}
        </button>,
      );
      const nextChar = answer.slice(span.end, span.end + 1);
      if (needsVisualWordBreak(span.visibleText, nextChar)) {
        nodes.push(<React.Fragment key={`space-after-${span.end}`}> </React.Fragment>);
      }
      cursor = span.end;
    });
    if (cursor < answer.length) {
      nodes.push(
        <React.Fragment key={`text-${cursor}`}>
          {renderTextWithBreaks(normalizePart1InlineTranscriptSegment(answer.slice(cursor), { treatInitialAsSentenceStart: cursor === 0 }))}
        </React.Fragment>,
      );
    }
    return <p className="whitespace-pre-wrap font-serif text-base leading-8 text-paper-ink/75">{nodes}</p>;
  };
  const renderAnnotatedSpeakingTranscript = () => {
    const answer = feedback?.transcript || transcript;
    const spans = speakingAnnotationRenderData.anchored;
    if (!spans.length) {
      return <p className="whitespace-pre-wrap font-serif text-base leading-8 text-paper-ink/75">{normalizePart1TranscriptDisplayText(answer)}</p>;
    }
    const needsVisualWordBreak = (left = '', right = '') =>
      /[A-Za-z0-9]$/.test(left) && /^[A-Za-z0-9]/.test(right);
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    spans.forEach(span => {
      if (span.start > cursor) {
        nodes.push(
          <React.Fragment key={`speaking-text-${cursor}`}>
            {renderTextWithBreaks(normalizePart1InlineTranscriptSegment(answer.slice(cursor, span.start), { treatInitialAsSentenceStart: cursor === 0 }))}
          </React.Fragment>,
        );
      }
      const previousChar = answer.slice(Math.max(0, span.start - 1), span.start);
      if (needsVisualWordBreak(previousChar, span.visibleText)) {
        nodes.push(<React.Fragment key={`speaking-space-before-${span.start}`}> </React.Fragment>);
      }
      const severity = strongestPart1AnnotationSeverity(span.annotation);
      nodes.push(
        <button
          key={span.annotation.id}
          type="button"
          ref={element => {
            speakingAnnotationRefs.current[span.annotation.id] = element;
          }}
          data-severity={severity}
          className={`part1-answer-mark ${selectedSpeakingAnnotationId === span.annotation.id ? 'part1-answer-mark--active' : ''}`}
          onClick={() => setSelectedSpeakingAnnotationId(span.annotation.id)}
        >
          {normalizePart1InlineTranscriptSegment(span.visibleText, { treatInitialAsSentenceStart: span.start === 0 })}
        </button>,
      );
      const nextChar = answer.slice(span.end, span.end + 1);
      if (needsVisualWordBreak(span.visibleText, nextChar)) {
        nodes.push(<React.Fragment key={`speaking-space-after-${span.end}`}> </React.Fragment>);
      }
      cursor = span.end;
    });
    if (cursor < answer.length) {
      nodes.push(
        <React.Fragment key={`speaking-text-${cursor}`}>
          {renderTextWithBreaks(normalizePart1InlineTranscriptSegment(answer.slice(cursor), { treatInitialAsSentenceStart: cursor === 0 }))}
        </React.Fragment>,
      );
    }
    return <p className="whitespace-pre-wrap font-serif text-base leading-8 text-paper-ink/75">{nodes}</p>;
  };
  const speakingRange = feedback ? validSpeakingBandRange(feedback) : null;
  const scoreDisplayLabel = speakingRange ? 'Estimated Range' : 'Estimated Band';
  const scoreDisplayValue = speakingRange
    ? `${formatBandEstimate(speakingRange.lower)}–${formatBandEstimate(speakingRange.upper)}`
    : formatConservativeBandEstimate(feedback?.bandEstimateExcludingPronunciation);
  const currentLowerBound = feedback ? speakingCurrentLowerBound(feedback) : 0;
  const criticalErrors = feedback && isHighBandStable ? [] : feedback?.fatalErrors || [];
  const optionalPolish = feedback && isHighBandStable
    ? feedback.naturalnessHints.slice(0, 2)
    : feedback?.naturalnessHints || [];
  const shouldUsePart2InlineAnnotations = Boolean(step === 'results' && feedback?.part === 2 && !isPart1ThreadResult);
  const part2Feedback = feedback?.part === 2 ? feedback.part2Feedback : undefined;
  const speakingInlineAnnotations = useMemo(() => {
    if (!part2Feedback) return [];
    return part2Feedback.annotations || [];
  }, [part2Feedback]);
  const speakingAnnotationRenderData = useMemo(
    () => getPart1AnnotationRenderData(feedback?.transcript || '', speakingInlineAnnotations),
    [feedback?.transcript, speakingInlineAnnotations],
  );
  const selectedSpeakingAnnotation = selectedSpeakingAnnotationId
    ? speakingAnnotationRenderData.anchored
      .map(span => span.annotation)
      .find(annotation => annotation.id === selectedSpeakingAnnotationId) || null
    : null;
  const selectedSpeakingAnnotationAnchor = selectedSpeakingAnnotationId
    ? speakingAnnotationRefs.current[selectedSpeakingAnnotationId] || null
    : null;
  const phraseFixSectionLabel = currentLowerBound < 7
    ? 'HIGH-IMPACT PHRASE FIXES'
    : 'OPTIONAL POLISH';
  const part2StoryModules = part2Feedback?.storyModules || [];
  const part2LanguageSignals = [...(part2Feedback?.languageSignals || [])].sort((left, right) => (
    (part2LanguageSignalRank.get(left.signal) ?? 99) - (part2LanguageSignalRank.get(right.signal) ?? 99)
  ));
  const part2MasteredExpressionHints = useMemo(() => (
    (profile.masteredExpressions || [])
      .filter(item => (
        item.source === 'part2_signal' &&
        (!item.module || item.module === 'speaking') &&
        (!item.part || item.part === 2) &&
        item.expression.trim()
      ))
      .map(item => ({
        expression: item.expression,
        signal: item.signal,
        count: item.count,
      }))
      .slice(0, 30)
  ), [profile.masteredExpressions]);
  const masteredPart2SignalUpgradeKeys = useMemo(() => new Set(
    part2MasteredExpressionHints
      .map(item => part2SignalUpgradeKey(
        item.signal as Part2LanguageSignalCheck['signal'],
        item.expression,
      )),
  ), [part2MasteredExpressionHints]);
  const markPart2BestUpgradeMastered = (signal: Part2LanguageSignalCheck) => {
    const bestUpgrade = part2DisplayBestUpgrade(signal);
    if (!bestUpgrade) return;
    const confirmed = window.confirm(
      `确认你已经掌握 "${bestUpgrade.upgrade}" 吗？\n\n确认后会保存到 Progress 记忆，并隐藏本次这个表达。`,
    );
    if (!confirmed) return;
    markMasteredExpression({
      expression: bestUpgrade.upgrade,
      source: 'part2_signal',
      signal: signal.signal,
      module: 'speaking',
      part: 2,
    });
    const key = part2SignalUpgradeKey(signal.signal, bestUpgrade.upgrade);
    setHiddenPart2SignalUpgradeKeys(prev => prev.includes(key) ? prev : [...prev, key]);
    addDebugLog(`Part 2 signal best upgrade marked mastered for this result: ${signal.signal} / ${bestUpgrade.upgrade}`);
  };
  const restorePart2BestUpgrade = (signal: Part2LanguageSignalCheck) => {
    const bestUpgrade = part2DisplayBestUpgrade(signal);
    if (!bestUpgrade) return;
    const key = part2SignalUpgradeKey(signal.signal, bestUpgrade.upgrade);
    setHiddenPart2SignalUpgradeKeys(prev => prev.filter(item => item !== key));
    forgetMasteredExpression({
      expression: bestUpgrade.upgrade,
      signal: signal.signal,
    });
    addDebugLog(`Part 2 signal mastered expression restored: ${signal.signal} / ${bestUpgrade.upgrade}`);
  };
  const shouldShowPart2StoryTrainer = Boolean(part2Feedback && (
    part2StoryModules.length > 0 ||
    part2LanguageSignals.length > 0 ||
    part2Feedback.priorityFocusZh
  ));
  const part2NextSpeakableAnswer = part2Feedback?.nextSpeakableVersion.trim() || '';
  const visibleSpeakingTargetAnswer = feedback?.part === 2
    ? part2NextSpeakableAnswer || feedback.upgradedAnswer.trim() || feedback.transcript
    : feedback?.upgradedAnswer.trim() || feedback?.transcript || '';
  const canShowSpeakingTargetAnswer = Boolean(visibleSpeakingTargetAnswer || isHighBandStable);
  const renderPart2NextSpeakableAnswer = () => {
    if (!feedback) return null;
    const answer = visibleSpeakingTargetAnswer;
    const highlights = (part2Feedback?.nextSpeakableVersionHighlights || [])
      .map((highlight, index) => {
        const quote = highlight.quote.trim();
        const start = answer.toLowerCase().indexOf(quote.toLowerCase());
        if (!quote || start < 0) return null;
        return {
          ...highlight,
          id: `${highlight.signal || highlight.storyRole || 'highlight'}-${index}`,
          start,
          end: start + quote.length,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((left, right) => left.start - right.start)
      .filter((item, index, items) => index === 0 || item.start >= items[index - 1].end);
    if (!highlights.length) return renderTextWithBreaks(answer);

    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    highlights.forEach(highlight => {
      if (highlight.start > cursor) {
        nodes.push(<React.Fragment key={`p2-next-text-${cursor}`}>{renderTextWithBreaks(answer.slice(cursor, highlight.start))}</React.Fragment>);
      }
      const label = highlight.signal ? part2LanguageSignalLabel(highlight.signal) : highlight.storyRole ? part2StoryRoleLabel(highlight.storyRole) : 'Part 2 upgrade';
      nodes.push(
        <span
          key={highlight.id}
          className="border-b-2 border-accent-terracotta/60 bg-accent-terracotta/10 px-1 text-paper-ink"
          title={`${highlight.labelZh || label}: ${highlight.whyItWorksZh}`}
        >
          {answer.slice(highlight.start, highlight.end)}
        </span>,
      );
      cursor = highlight.end;
    });
    if (cursor < answer.length) {
      nodes.push(<React.Fragment key={`p2-next-text-${cursor}`}>{renderTextWithBreaks(answer.slice(cursor))}</React.Fragment>);
    }
    return nodes;
  };
  const groundedIdeaUpgrades = feedback?.band9Refinements.filter(item => {
    const transcriptSource = feedback.transcript.toLowerCase();
    const quotedPhrases = Array.from(item.observation.matchAll(/["“](.+?)["”]/g)).map(match => match[1].toLowerCase());
    const citesNaturalnessSource = feedback.naturalnessHints.some(hint =>
      item.observation.includes(hint.original) || item.explanationZh.includes(hint.original),
    );
    return quotedPhrases.some(phrase => transcriptSource.includes(phrase)) || citesNaturalnessSource;
  }) || [];
  const starterPlan = starterPracticePlan(part, question?.question);
  const speakingBankCounts = {
    1: speakingPart1.length,
    2: speakingPart2.length,
    3: speakingPart3.length,
  };
  const currentPartBankCount = speakingBankCounts[part];
  const speakingBankItems: QuestionBankItem[] = part === 1
    ? Array.from(new Map(speakingPart1TopicThreads.map(thread => [thread.topicId, thread])).values()).map(thread => {
      const threadSetCount = speakingPart1TopicThreads.filter(item => item.topicId === thread.topicId).length;
      return {
      id: thread.topicId,
      title: thread.title,
      metadata: [
        `${threadSetCount} thread set${threadSetCount === 1 ? '' : 's'}`,
        thread.topicCategory,
      ],
      tags: thread.tags,
      questionText: thread.title,
      module: 'speaking',
      part: 1,
      matchKey: thread.topicId,
    };
    })
    : getBank(part).map(item => ({
      id: item.id,
      title: item.question,
      metadata: [item.topic, item.topicCategory],
      tags: item.tags || [item.topicCategory, item.topic].filter((value): value is string => Boolean(value)),
      questionText: item.question,
      module: 'speaking',
      part,
    }));

  return (
    <PageShell size="wide">
      <TopBar />
      <QuestionBankModal
        isOpen={isBankOpen}
        title={`Speaking Part ${part} Bank`}
        items={speakingBankItems}
        itemLabel={part === 1 ? 'topic practice entry' : 'question'}
        onClose={() => setIsBankOpen(false)}
        onSelect={async (item) => {
          if (part === 1) {
            const selected = item.id
              ? await selectThreadForTopic(item.id, { avoidThreadId: part1Thread?.topicId === item.id ? part1Thread?.id : undefined, reuseAfterCoverage: true })
              : null;
            if (selected) selectBankThread(selected);
            return;
          }
          const selected = getBank(part).find(questionItem => questionItem.id === item.id);
          if (selected) selectBankQuestion(selected);
        }}
      />
      
      <div className="flex flex-col gap-3 mb-8 sm:flex-row sm:items-center sm:justify-center">
        <div className="flex gap-3 p-1.5 bg-paper-ink/5 rounded-sm self-start sm:self-auto font-sans text-sm uppercase tracking-widest font-bold">
          {[1, 2, 3].map((p) => (
            <button
              key={p}
              onClick={() => switchPart(p as 1 | 2 | 3)}
              className={`min-w-28 px-5 py-3 rounded-sm transition-all duration-200 ${
                part === p
                  ? 'bg-accent-terracotta text-paper-50'
                  : 'text-paper-ink/40 hover:text-paper-ink hover:bg-paper-ink/5 cursor-pointer'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              disabled={step === 'recording' || step === 'analyzing'}
            >
              Part {p}
            </button>
          ))}
        </div>
      </div>

      {providerErrorMessage && (
        <div className="mb-6 space-y-2">
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-sm font-sans">
            {providerErrorMessage}
          </div>
        </div>
      )}
      {storageFullWarning && (
        <div className="mb-6 space-y-2">
          <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-sm rounded-sm font-sans">
            {storageFullWarning}
          </div>
        </div>
      )}
      <div className="practice-workspace grid lg:grid-cols-12 gap-8 items-start mb-12">
        <div className={`lg:col-span-12 ${step === 'results' ? 'xl:col-span-12 space-y-6' : 'xl:col-span-12 xl:grid xl:grid-cols-[minmax(360px,0.9fr)_minmax(460px,1.1fr)] xl:gap-6 xl:items-start space-y-6 xl:space-y-0'}`}>
          {shouldShowPracticePromptCard && (
          <PaperCard className="relative overflow-hidden">
            <div className="flex justify-between items-start mb-6">
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/35">
                {part1Thread ? `PART 1 · ${part1Thread.title}` : `${question?.topic} • Part ${part}`}
              </span>
              <div className="flex items-center gap-3">
                {isRecording && (
                   <span className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-accent-terracotta font-bold animate-pulse">
                     <span className="w-1.5 h-1.5 rounded-full bg-accent-terracotta" /> Listening...
                   </span>
                )}
                <span className="font-mono text-sm text-paper-ink/40">{formatTime(timer)}</span>
              </div>
            </div>

            {part1Thread && (
              <p className="mb-3 text-xs font-sans font-bold uppercase tracking-widest text-accent-terracotta">
                Question {activeThreadIndex + 1} of {threadQuestionCount}
              </p>
            )}
            <h2 className="text-2xl mb-8 leading-tight text-paper-ink">{question?.question}</h2>
            
            <div className="flex flex-wrap gap-4 pt-4 border-t border-paper-ink/5">
              {step === 'idle' && (
                <>
                  <SerifButton onClick={() => setIsBankOpen(true)} variant="outline" className="flex items-center gap-2 group">
                    <BookOpen className="w-4 h-4" /> Browse Bank
                  </SerifButton>
                  <SerifButton onClick={changeQuestion} variant="outline" className="flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" /> {part === 1 ? 'Change Topic' : 'Change Question'}
                  </SerifButton>
                  <SerifButton onClick={startRecording} className="flex items-center gap-2">
                    <Mic className="w-4 h-4" /> Start Recording
                  </SerifButton>
                </>
              )}
              {step === 'recording' && (
                <SerifButton onClick={stopRecording} variant="secondary" className="flex items-center gap-2 bg-red-800 text-white hover:bg-red-900">
                  <Square className="w-4 h-4" /> Stop & Review
                </SerifButton>
              )}
              {step === 'editing' && (
                <>
                  <SerifButton onClick={resetCurrentAttempt} variant="outline" className="flex items-center gap-2">
                    <RefreshCcw className="w-4 h-4" /> Retry
                  </SerifButton>
                  <SerifButton onClick={changeQuestion} variant="outline" className="flex items-center gap-2">
                    {part === 1 ? 'Change Topic' : 'Change Question'}
                  </SerifButton>
                </>
              )}
              {step === 'results' && (
                <>
                  <SerifButton onClick={practiceThisQuestionAgain} className="flex items-center gap-2">
                    {part === 1 ? 'Retry This Thread' : 'Practice This Question Again'}
                  </SerifButton>
                  <SerifButton onClick={() => loadRandomQuestion(part)} variant="outline" className="flex items-center gap-2">
                    Continue Training <ArrowRight className="w-4 h-4" />
                  </SerifButton>
                  {canRetestCurrentAnswer && (
                    <SerifButton onClick={retestCurrentAnswer} variant="outline" className="flex items-center gap-2">
                      <RefreshCcw className="w-4 h-4" /> 回测当前回答
                    </SerifButton>
                  )}
                </>
              )}
            </div>
            <p className="mt-4 text-sm font-sans text-paper-ink/55">
              {part === 1
                ? `Part 1 Topic Threads · ${speakingPart1TopicThreads.length} entries`
                : `Part ${part} Bank · ${currentPartBankCount} ${currentPartBankCount === 1 ? 'question' : 'questions'}`}
            </p>
          </PaperCard>
          )}

          {shouldShowTranscriptCard && (
            <PaperCard>
              <div className="flex items-center justify-between mb-4 border-b border-paper-ink/5 pb-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/50 flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> TRANSCRIPT
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {statusMessage === 'No speech detected' && (
                    <span className="text-[10px] text-accent-terracotta font-sans flex items-center gap-1">
                      <Info className="w-3 h-3" /> No speech detected. Try speaking clearly.
                    </span>
                  )}
                  {statusMessage === 'Mic denied' && (
                    <span className="text-[10px] text-red-800 flex items-center gap-1 font-sans">
                      <Info className="w-3 h-3" /> Mic denied. Manual typing only.
                    </span>
                  )}
                  {statusMessage === 'Transcription unavailable' && (
                    <span className="text-[10px] text-paper-ink/40 font-sans">Recognition unavailable in this browser.</span>
                  )}
                </div>
              </div>
              <div className="mb-3 font-sans">
                <p className="text-xs leading-5 text-paper-ink/55">
                  {isCompletedPart1ThreadRecovery
                    ? `Your ${part1RecoveryLockedAnswerCount} locked ${part1RecoveryLockedAnswerCount === 1 ? 'answer is' : 'answers are'} already saved for this topic thread.`
                    : 'Please quickly check the transcript before analysis.'}
                </p>
              </div>
              {isCompletedPart1ThreadRecovery ? (
                <div className="min-h-[180px] xl:min-h-[260px] border border-paper-ink/10 bg-paper-ink/[0.025] p-5 font-sans text-sm leading-7 text-paper-ink/65">
                  <p>
                    No re-recording or retyping is needed. The completed topic-thread answers are locked and will be sent again exactly as saved.
                  </p>
                </div>
              ) : (
                <textarea
                  value={transcript}
                  onChange={(e) => {
                    setTranscript(e.target.value);
                    setTranscriptCleanupNote('');
                    setTranscriptionSource('manual');
                    transcriptionSourceRef.current = 'manual';
                    hasManualTranscriptEditRef.current = true;
                    transcriptOriginRef.current = 'manual';
                  }}
                  disabled={step === 'recording'}
                  placeholder={statusMessage === 'Mic denied' || statusMessage === 'Transcription unavailable' ? "Type your answer manually here..." : "Recognition will appear here..."}
                  className="w-full min-h-[300px] xl:min-h-[420px] bg-transparent border border-transparent rounded-sm font-serif text-lg leading-relaxed placeholder:opacity-40 resize-y focus:border-accent-terracotta focus:shadow-[0_0_0_1px_rgba(166,77,50,0.2)]"
                />
              )}
              {step === 'editing' && (
                <div className="mt-4 space-y-3 border-t border-paper-ink/10 pt-4 font-sans">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs leading-5 text-paper-ink/55">
                      {isCompletedPart1ThreadRecovery ? 'Locked answers are ready for re-analysis.' : transcriptStatus}
                    </p>
                    {canRetryAudioTranscription && (
                      <button
                        type="button"
                        onClick={() => transcribeAudio()}
                        className="text-xs font-bold uppercase tracking-widest text-accent-terracotta hover:text-paper-ink"
                      >
                        Retry transcription
                      </button>
                    )}
                  </div>

                  <SerifButton
                    onClick={part1Thread && threadCompleted ? () => analyzePart1Thread(lockedThreadAnswers) : part1Thread ? lockThreadAnswer : () => analyze()}
                    disabled={part1Thread && threadCompleted ? false : !transcript.trim()}
                    className="flex items-center gap-2 px-8"
                  >
                    <Send className="w-4 h-4" /> {part1Thread
                      ? threadCompleted
                        ? isCompletedPart1ThreadRecovery
                          ? 'Re-analyze Locked Answers'
                          : 'Analyze Topic Session'
                        : activeThreadIndex + 1 >= threadQuestionCount
                        ? 'Lock Final Answer & Analyze'
                        : 'Lock Answer & Continue'
                      : 'Analyze'}
                  </SerifButton>

                  {(rawTranscript.trim() || audioTranscript.trim() || audioUncertaintyNotes.length > 0 || audioTranscriptionError) && (
                    <details className="border border-paper-ink/10 bg-paper-ink/[0.02] p-3 text-xs leading-5 text-paper-ink/55">
                      <summary className="cursor-pointer font-bold text-paper-ink/60">
                        Transcription details
                      </summary>
                      {rawTranscript.trim() && (
                        <div className="mt-3">
                          <p className="font-bold uppercase tracking-widest text-paper-ink/40">Browser</p>
                          <p className="mt-1 whitespace-pre-wrap font-serif text-sm leading-7 text-paper-ink/70">
                            {rawTranscript}
                          </p>
                        </div>
                      )}
                      {audioTranscript.trim() && (
                        <div className="mt-3">
                          <p className="font-bold uppercase tracking-widest text-paper-ink/40">
                            Audio {audioTranscriptionProvider ? `(${audioTranscriptionProvider})` : ''}{audioTranscriptNeedsAdoption ? ' Candidate' : ''}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap font-serif text-sm leading-7 text-paper-ink/70">
                            {audioTranscript}
                          </p>
                          {canAdoptAudioTranscriptCandidate && (
                            <button
                              type="button"
                              onClick={adoptAudioTranscriptCandidate}
                              className="mt-2 text-xs font-bold uppercase tracking-widest text-accent-terracotta hover:text-paper-ink"
                            >
                              Use Audio Transcript
                            </button>
                          )}
                        </div>
                      )}
                      {audioUncertaintyNotes.length > 0 && (
                        <ul className="mt-3 list-disc pl-5 text-paper-ink/50">
                          {audioUncertaintyNotes.map((note, index) => (
                            <li key={`${note}-${index}`}>{note}</li>
                          ))}
                        </ul>
                      )}
                      {audioTranscriptionError && (
                        <p className={`mt-3 ${audioTranscriptIsMock ? 'text-amber-900' : 'text-red-800'}`}>
                          {audioTranscriptionError}
                        </p>
                      )}
                    </details>
                  )}
                </div>
              )}
            </PaperCard>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <RefreshCcw className="w-6 h-6 animate-spin text-accent-terracotta/40" />
              <p className="font-serif text-paper-ink/45 text-sm">Checking your training estimate and feedback...</p>
            </div>
          )}
        </div>

        {step === 'results' && feedback && (
        <div className="lg:col-span-12">
          
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {isPart1ThreadResult && threadFeedback && (
                <>
                  <PaperCard className="bg-paper-200 border-none relative">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                      <div>
                        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">
                          PART 1 · TOPIC THREAD · {part1ThreadStable ? 'COMPLETE' : part1DevelopmentNeeded ? 'DEVELOPMENT NEEDED' : part1SystemRevisionConflict ? 'SYSTEM REVISION' : 'REPAIR NEEDED'}
                        </p>
                        <h3 className="text-2xl text-paper-ink">{threadFeedback.topic}</h3>
                      </div>
                      <div className="text-left md:text-right">
                        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-paper-ink/45">TOPIC PRACTICE ESTIMATE</p>
                        <p className="text-4xl font-bold text-accent-terracotta">{scoreDisplayValue}</p>
                      </div>
                    </div>
                    {(speakingRange?.rationaleZh || feedback.estimateRationaleZh) && (
                      <p className="mt-5 text-sm leading-7 text-paper-ink/60">
                        {speakingRange?.rationaleZh || feedback.estimateRationaleZh}
                      </p>
                    )}
                    {part1CoreRepairNeeded && (
                      <div className="mt-5 border-l-2 border-l-red-800/60 bg-red-50/50 px-4 py-3">
                        <p className="text-sm leading-7 text-red-950">
                          先修正影响准确性的错误，同时把重点题目补充到自然的 Part 1 长度。
                        </p>
                      </div>
                    )}
                    {part1SystemRevisionConflict && (
                      <div className="mt-5 border-l-2 border-l-amber-700/60 bg-amber-50/70 px-4 py-3">
                        <p className="text-sm leading-7 text-amber-950">
                          上一轮系统给出的 cleaner answer 里有需要修订的表达。这不是你新引入的错误；请练习本轮修正后的版本。
                        </p>
                      </div>
                    )}
                    {part1DevelopmentNeeded && (
                      <div className="mt-5 border-l-2 border-l-amber-700/60 bg-amber-50/70 px-4 py-3">
                        <p className="text-sm leading-7 text-amber-950">
                          核心语言已经稳定，但这一组回答还不够充分。下一步请在重点题目中补充一个真实细节或理由。
                        </p>
                      </div>
                    )}
                    {part1ThreadStable && (
                      <div className="mt-5 border-l-2 border-l-emerald-700/45 bg-emerald-50/60 px-4 py-3">
                        <p className="text-sm leading-7 text-emerald-950">
                          本组回答准确性和展开都已经稳定。建议切换到新话题继续训练。
                        </p>
                      </div>
                    )}
                    {previousCleanerConflictCount > 0 && (
                      <p className="mt-3 text-xs leading-6 text-paper-ink/55">
                        Estimate note: one correction came from a previous cleaner answer supplied by the system, so it should not be read as a new learner-introduced error.
                      </p>
                    )}
                    {(part1ThreadStable || part1DevelopmentNeeded || part1SystemRevisionConflict || part1CoreRepairNeeded) && (
                      <div className="mt-5 flex flex-wrap gap-3 border-t border-paper-ink/10 pt-4">
                        {part1ThreadStable ? (
                          <>
                            <SerifButton onClick={changeQuestion} className="text-xs flex items-center gap-2">
                              Change Topic <ArrowRight className="w-4 h-4" />
                            </SerifButton>
                            <SerifButton onClick={practiceThisQuestionAgain} variant="outline" className="text-xs flex items-center gap-2">
                              <RefreshCcw className="w-4 h-4" /> Retry This Thread
                            </SerifButton>
                            {canRetestCurrentAnswer && (
                              <SerifButton onClick={retestCurrentAnswer} variant="outline" className="text-xs flex items-center gap-2">
                                <RefreshCcw className="w-4 h-4" /> 回测当前回答
                              </SerifButton>
                            )}
                          </>
                        ) : (
                          <>
                            <SerifButton onClick={practiceThisQuestionAgain} className="text-xs flex items-center gap-2">
                              <RefreshCcw className="w-4 h-4" /> {part1DevelopmentNeeded ? 'Practise Developed Answers' : 'Retry Corrected Answers'}
                            </SerifButton>
                            <SerifButton onClick={changeQuestion} variant="outline" className="text-xs flex items-center gap-2">
                              Change Topic <ArrowRight className="w-4 h-4" />
                            </SerifButton>
                            {canRetestCurrentAnswer && (
                              <SerifButton onClick={retestCurrentAnswer} variant="outline" className="text-xs flex items-center gap-2">
                                <RefreshCcw className="w-4 h-4" /> 回测当前回答
                              </SerifButton>
                            )}
                          </>
                        )}
                        <SerifButton onClick={exportMarkdown} variant="outline" className="text-xs flex items-center gap-2">
                          <FileDown className="w-4 h-4" /> Export Markdown
                        </SerifButton>
                      </div>
                    )}
                  </PaperCard>

                  <PaperCard className="border-l-2 border-l-red-800/70">
                    <div className="mb-5 border-b border-paper-ink/10 pb-4">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-red-800/70">PART 1</p>
                      <h4 className="mt-1 text-xl font-bold tracking-wide text-paper-ink">ANNOTATED ANSWERS</h4>
                      {threadAnnotations.length > 0 && (
                        <p className="mt-2 text-sm leading-7 text-paper-ink/60">点击原回答中的标记，查看具体错误和修改方式。</p>
                      )}
                    </div>
                    <div className="space-y-5">
                      {threadAnswersForReview.map((answer, index) => {
                        const questionRef = `Q${index + 1}`;
                        const renderData = part1AnnotationRenderByQuestion.get(questionRef) || { anchored: [], unanchored: [] };
                        const cleanRetry = cleanRetryByQuestion.get(questionRef);
                        const developmentTarget = part1DevelopmentTargetByQuestion.get(questionRef);
                        const answerAction = part1AnswerActionByQuestion.get(questionRef);
                        const developmentChunks = [
                          ...(developmentTarget?.phraseChunks || []),
                          ...(answerAction?.examples || []),
                        ]
                          .map(chunk => {
                            const text = normalizePart1TranscriptDisplayText(chunk.text);
                            const purposeZh = normalizePart1LearnerText(chunk.purposeZh || '');
                            return text ? { text, purposeZh } : null;
                          })
                          .filter((chunk): chunk is { text: string; purposeZh: string } => Boolean(chunk))
                          .filter((chunk, chunkIndex, chunks) => chunks.findIndex(candidate => candidate.text === chunk.text) === chunkIndex)
                          .filter(chunk => !hiddenPart1DevelopmentKeys.includes(part1DevelopmentChunkKey(questionRef, chunk)))
                          .slice(0, 12);
                        const shouldRenderDevelopmentCoaching = Boolean(developmentChunks.length);
                        const cleanRetryRepeatsCurrentAnswer = Boolean(
                          cleanRetry &&
                          isPart1CleanerAnswerEquivalent(answer.answer, cleanRetry.answer),
                        );
                        const shouldRenderCleanRetry = Boolean(cleanRetry && !cleanRetryRepeatsCurrentAnswer);
                        return (
                          <section key={`${answer.questionId}-${index}`} className="border border-paper-ink/10 bg-paper-ink/[0.02] p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40">{questionRef}</p>
                              {(renderData.anchored.length > 0 || shouldRenderDevelopmentCoaching) && (
                                <p className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/35">
                                  {renderData.anchored.length
                                    ? `${renderData.anchored.length} marked ${renderData.anchored.length === 1 ? 'span' : 'spans'}`
                                    : 'Development coaching'}
                                </p>
                              )}
                            </div>
                            <p className="mb-3 text-lg leading-8 text-paper-ink">{answer.question}</p>
                            {renderAnnotatedPart1Answer(answer.answer, questionRef)}
                            {shouldRenderCleanRetry && cleanRetry && (
                              <div className="mt-4 border border-accent-terracotta/15 bg-paper-50/80 p-4">
                                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta/70">
                                  A CLEANER ANSWER FOR YOUR NEXT TRY
                                </p>
                                <p className="mt-2 text-lg leading-8 text-paper-ink">{cleanRetry.answer}</p>
                              </div>
                            )}
                            {shouldRenderDevelopmentCoaching && (
                              <div className="mt-4 border-l-2 border-l-accent-terracotta/35 bg-paper-50/70 px-4 py-3">
                                <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta/70">DEVELOPMENT</p>
                                {developmentChunks.length ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {developmentChunks.map(frame => (
                                      <span key={frame.text} className="inline-flex items-start gap-2 border border-accent-terracotta/15 bg-paper-ink/[0.02] px-2 py-1 text-xs leading-5 text-paper-ink/70">
                                        <span>
                                          {frame.purposeZh && <span className="mr-1 text-paper-ink/45">{frame.purposeZh}:</span>}
                                          <span className="font-bold">{frame.text}</span>
                                        </span>
                                        <button
                                          type="button"
                                          aria-label="Remove development expression"
                                          className="-mr-1 shrink-0 px-1 text-xs font-bold leading-5 text-paper-ink/35 hover:text-accent-terracotta"
                                          onClick={() => {
                                            const key = part1DevelopmentChunkKey(questionRef, frame);
                                            setHiddenPart1DevelopmentKeys(keys => keys.includes(key) ? keys : [...keys, key]);
                                          }}
                                        >
                                          ×
                                        </button>
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  </PaperCard>

                  {shouldShowPart1SessionBank && (
                  <PaperCard className="border-l-2 border-l-accent-terracotta/45">
                    <div className="mb-5 border-b border-paper-ink/10 pb-4">
                      <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-accent-terracotta/70">PART 1 · SESSION REVIEW</p>
                      <h4 className="mt-1 text-xl font-bold tracking-wide text-paper-ink">MATERIAL DEVELOPMENT</h4>
                    </div>

                    {hasPart1MaterialBank && (
                    <section className="border border-paper-ink/10 bg-paper-ink/[0.02] p-5">
                      {displayPart1ReusableMaterials.length > 0 && (
                        <div>
                          <h5 className="text-sm font-bold leading-7 text-paper-ink">可积累素材</h5>
                          <div className="mt-3 grid gap-4 lg:grid-cols-2">
                            {displayPart1ReusableMaterials.map((item, index) => {
                              const materialKey = part1LearningItemKey(item) || `${item.reusableVersion}-${index}`;
                              const materialEnglish = normalizePart1TranscriptDisplayText(item.developedExample || item.reusableVersion || item.materialCore || item.sourceWording);
                              const materialChinese = normalizePart1LearnerText(item.explanationZh || '');
                              return (
                                <div key={materialKey} className="border-l-2 border-l-accent-terracotta/30 bg-paper-50/60 py-3 pl-4 pr-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <p className="text-base font-bold leading-7 text-paper-ink">{materialEnglish}</p>
                                    <button
                                      type="button"
                                      aria-label="Remove material from this export"
                                      className="shrink-0 px-2 py-1 text-xs font-bold leading-none text-paper-ink/35 hover:text-accent-terracotta"
                                      onClick={() => setHiddenPart1MaterialKeys(keys => keys.includes(materialKey) ? keys : [...keys, materialKey])}
                                    >
                                      ×
                                    </button>
                                  </div>
                                  {materialChinese && (
                                    <p className="mt-1 text-sm leading-7 text-paper-ink/60">{materialChinese}</p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {displayPart1ExpressionBank.length > 0 && (
                        <div className={displayPart1ReusableMaterials.length > 0 ? 'mt-6 border-t border-paper-ink/10 pt-5' : ''}>
                          <h5 className="text-sm font-bold leading-7 text-paper-ink">可积累表达</h5>
                          <div className="mt-3 grid gap-4 lg:grid-cols-2">
                            {displayPart1ExpressionBank.map((item, index) => {
                              const expressionKey = part1LearningItemKey(item) || `${item.reusableVersion}-${index}`;
                              return (
                              <div key={expressionKey} className="border-l-2 border-l-accent-terracotta/30 bg-paper-50/60 py-3 pl-4 pr-3">
                                <div className="flex items-start justify-between gap-3">
                                  <p className="text-base font-bold leading-7 text-paper-ink">{normalizePart1TranscriptDisplayText(item.reusableVersion)}</p>
                                  <button
                                    type="button"
                                    aria-label="Remove expression from this export"
                                    className="shrink-0 px-2 py-1 text-xs font-bold leading-none text-paper-ink/35 hover:text-accent-terracotta"
                                    onClick={() => setHiddenPart1ExpressionKeys(keys => keys.includes(expressionKey) ? keys : [...keys, expressionKey])}
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            );})}
                          </div>
                        </div>
                      )}
                    </section>
                    )}

                  </PaperCard>
                  )}
                  <PaperCard className="border-l-2 border-l-accent-terracotta/30">
                    <div className="flex flex-wrap gap-3">
                      <SerifButton onClick={exportMarkdown} className="text-xs flex items-center justify-center gap-2 py-3" variant="outline">
                        <FileDown className="w-4 h-4" /> Export Markdown
                      </SerifButton>
                      {canRetestCurrentAnswer && (
                        <SerifButton onClick={retestCurrentAnswer} variant="outline" className="text-xs flex items-center gap-2">
                          <RefreshCcw className="w-4 h-4" /> 回测当前回答
                        </SerifButton>
                      )}
                      {part1ThreadStable ? (
                        <>
                          <SerifButton onClick={changeQuestion} className="text-xs">Practise a New Topic</SerifButton>
                          <SerifButton onClick={practiceThisQuestionAgain} variant="outline" className="text-xs">Retry This Thread</SerifButton>
                        </>
                      ) : (
                        <>
                          <SerifButton onClick={practiceThisQuestionAgain} className="text-xs">
                            {part1DevelopmentNeeded ? 'Practise Developed Answers' : 'Retry This Thread'}
                          </SerifButton>
                          <SerifButton onClick={changeQuestion} variant="outline" className="text-xs">Change Topic</SerifButton>
                        </>
                      )}
                    </div>
                  </PaperCard>
                </>
              )}

              {!isPart1ThreadResult && (
              <>
              <PaperCard className="bg-paper-200 border-none relative">
                <h3 className="text-sm font-bold tracking-wide mb-6 text-paper-ink/50 border-b border-paper-ink/10 pb-2">LANGUAGE PERFORMANCE</h3>
                <div className="flex flex-wrap items-end gap-4 mb-8">
                  <span className="text-7xl font-bold text-accent-terracotta leading-none">{scoreDisplayValue}</span>
                  <div className="flex flex-col pb-2">
                    <span className="text-sm text-paper-ink/60 font-bold uppercase tracking-widest">{scoreDisplayLabel}</span>
                    <span className="text-xs text-paper-ink/45">Single-question Speaking training estimate; pronunciation is not formally scored.</span>
                  </div>
                </div>
                
                {(speakingRange?.rationaleZh || feedback.scoreConsistencyNoteZh || feedback.estimateRationaleZh) && (
                  <p className="mb-5 text-sm leading-7 text-paper-ink/60">
                    {speakingRange?.rationaleZh || feedback.scoreConsistencyNoteZh || feedback.estimateRationaleZh}
                  </p>
                )}

                <div className="grid gap-3 md:grid-cols-3 mb-4">
                  {[
                    { label: 'Fluency & Coherence', score: feedback.scores.fluencyCoherence },
                    { label: 'Lexical Resource', score: feedback.scores.lexicalResource },
                    { label: 'Grammatical Range', score: feedback.scores.grammaticalRangeAccuracy },
                  ].map((s) => (
                    <div key={s.label} className="border border-paper-ink/10 bg-paper-50/50 p-4">
                      <span className="block text-xs font-sans uppercase tracking-widest text-paper-ink/50 mb-2">{s.label}</span>
                      <span className="text-2xl font-bold text-paper-ink">{formatBandEstimate(s.score)}</span>
                    </div>
                  ))}
                </div>

                {false && isMock && (
                  <div className="mt-6 flex items-center gap-2 p-2 bg-paper-ink/5 rounded text-xs text-paper-ink/45">
                    <Info className="w-3 h-3" /> Mock provider active.
                  </div>
                )}
              </PaperCard>

              <PaperCard className={shouldUsePart2InlineAnnotations ? '' : 'opacity-60 grayscale-[0.5]'}>
                <div className="flex items-center justify-between mb-4 border-b border-paper-ink/5 pb-2">
                  <h3 className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/50 flex items-center gap-2">
                    <Edit3 className="w-3 h-3" /> TRANSCRIPT
                  </h3>
                  {shouldUsePart2InlineAnnotations && (
                    <span className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/35">
                      Provider-native anchored annotations
                    </span>
                  )}
                </div>
                <div className="border border-paper-ink/10 bg-paper-ink/[0.025] p-5">
                  {shouldUsePart2InlineAnnotations
                    ? renderAnnotatedSpeakingTranscript()
                    : <p className="whitespace-pre-wrap font-serif text-base leading-8 text-paper-ink/75">{normalizePart1TranscriptDisplayText(feedback.transcript)}</p>}
                </div>
              </PaperCard>

              {isHighBandStable && (
                <PaperCard className="p-5 border-l-2 border-l-green-700/50 bg-green-50/30">
                  <h4 className="text-sm font-bold tracking-wide text-green-800 mb-3 border-b border-paper-ink/10 pb-2">HIGH-BAND STABILITY CHECK</h4>
                  <p className="text-base leading-8 text-paper-ink/75">
                    当前回答已达到目标层级。下一步重点是自然输出、时间控制和迁移练习。
                  </p>
                  <div className="mt-3 grid gap-2 text-sm leading-7 text-paper-ink/60 sm:grid-cols-2">
                    <p>本次没有必须修改的问题。</p>
                    <p>本次没有必要的可选微调。</p>
                  </div>
                </PaperCard>
              )}

              {shouldShowPart2StoryTrainer && (
                <section className="space-y-3">
                  <h4 className="text-sm font-bold tracking-wide text-paper-ink/65 ml-1 border-b border-paper-ink/10 pb-2">
                    PART 2 STORY TRAINER
                  </h4>
                  <PaperCard className="border-l-2 border-l-accent-terracotta/35 bg-paper-50">
                    <div className="grid gap-5">
                      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
                        <div className="self-start border border-paper-ink/10 bg-paper-ink/[0.03] p-3">
                          <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Material type</p>
                          <p className="text-lg leading-7 text-paper-ink">{part2MaterialTypeLabel(part2Feedback?.materialType)}</p>
                          {part2Feedback?.materialTypeRationaleZh && (
                            <p className="mt-1 text-sm leading-6 text-paper-ink/65">{part2Feedback.materialTypeRationaleZh}</p>
                          )}
                        </div>
                        {part2Feedback?.priorityFocusZh && (
                          <div className="self-start border border-paper-ink/10 bg-paper-ink/[0.03] p-3">
                            <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Priority focus</p>
                            <p className="text-sm leading-6 text-paper-ink/75">{part2Feedback.priorityFocusZh}</p>
                          </div>
                        )}
                      </div>

                      {part2StoryModules.length > 0 && (
                        <div>
                          <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-3">Story modules</p>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {part2StoryModules.map((module, index) => (
                              <div key={`${module.role}-${index}`} className="border border-paper-ink/10 bg-paper-ink/[0.025] p-4">
                                <div className="mb-3 flex items-start justify-between gap-3">
                                  <p className="text-sm font-bold text-paper-ink">{part2StoryRoleLabel(module.role)}</p>
                                  <span className="shrink-0 border border-paper-ink/10 px-2 py-1 text-[10px] font-sans uppercase tracking-widest text-paper-ink/45">
                                    {part2StoryStatusLabel(module.status)}
                                  </span>
                                </div>
                                {module.sourceWording && (
                                  <p className="text-sm leading-7 text-paper-ink/60 mb-2">"{module.sourceWording}"</p>
                                )}
                                {module.improvedVersion && (
                                  <p className="text-base leading-7 text-paper-ink border-l-2 border-l-accent-terracotta/30 pl-3 mb-2">
                                    {module.improvedVersion}
                                  </p>
                                )}
                                <p className="text-sm leading-7 text-paper-ink/65">{module.coachingZh}</p>
                                {module.confirmationNeeded && (
                                  <p className="mt-2 text-xs leading-5 text-paper-ink/45">Confirm before using this as personal memory.</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {part2LanguageSignals.length > 0 && (
                        <div>
                          <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-3">Six language signals</p>
                          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                            {part2LanguageSignals.map(signal => {
                              const evidence = part2LanguageSignalEvidence(signal);
                              const bestUpgrade = part2DisplayBestUpgrade(signal);
                              const bestUpgradeHidden = Boolean(
                                bestUpgrade &&
                                (
                                  hiddenPart2SignalUpgradeKeys.includes(part2SignalUpgradeKey(signal.signal, bestUpgrade.upgrade)) ||
                                  masteredPart2SignalUpgradeKeys.has(part2SignalUpgradeKey(signal.signal, bestUpgrade.upgrade))
                                ),
                              );
                              const displayAlternatives = part2DisplayAlternativeUpgrades(signal);
                              const promotedUpgrade = bestUpgradeHidden ? displayAlternatives[0] : null;
                              const visibleBestUpgrade = promotedUpgrade || (bestUpgradeHidden ? null : bestUpgrade);
                              const visibleAlternatives = (bestUpgradeHidden ? displayAlternatives.slice(1, 2) : displayAlternatives.slice(0, 1));
                              const sampleSentence = visibleBestUpgrade
                                ? part2SignalDisplaySampleSentence(signal, visibleBestUpgrade)
                                : '';
                              const sampleHighlight = visibleBestUpgrade
                                ? part2SignalDisplaySampleHighlight(signal, visibleBestUpgrade, sampleSentence)
                                : '';
                              const shouldShowSampleSentence = Boolean(sampleSentence) && (
                                visibleBestUpgrade?.source === 'alternative' ||
                                signal.signal !== 'collocation'
                              );
                              return (
                                <div key={signal.signal} className="min-h-full border border-paper-ink/10 bg-paper-100/35 p-4">
                                  <div className="mb-3 flex items-center gap-2">
                                    <span className={`h-2 w-2 shrink-0 rounded-full ${part2LanguageSignalDotClass(signal.status)}`} aria-hidden="true" />
                                    <p className="text-sm font-bold leading-6 text-paper-ink">{part2LanguageSignalLabel(signal.signal)}</p>
                                  </div>

                                  {evidence.length > 0 && (
                                    <div className="mb-3 space-y-1">
                                      {evidence.map(item => (
                                        <p key={item} className="text-sm leading-7 text-paper-ink/50">"{item}"</p>
                                      ))}
                                    </div>
                                  )}

                                  {(signal.qualityZh || signal.nextMoveZh) && (
                                    <div className="mb-3 space-y-1">
                                      {signal.qualityZh && (
                                        <p className="text-sm leading-7 text-paper-ink/55">{signal.qualityZh}</p>
                                      )}
                                      {signal.nextMoveZh && (
                                        <p className="text-sm leading-7 text-paper-ink/55">{signal.nextMoveZh}</p>
                                      )}
                                    </div>
                                  )}

                                  {visibleBestUpgrade && (
                                    <div
                                      key={`${signal.signal}-${visibleBestUpgrade.source}-${visibleBestUpgrade.upgrade}`}
                                      className={`border-l-2 border-l-accent-terracotta/35 pl-3 transition-all duration-300 ${
                                        visibleBestUpgrade.source === 'alternative' ? 'animate-in fade-in slide-in-from-bottom-1' : ''
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="text-xs font-sans uppercase tracking-widest text-paper-ink/40">
                                          {visibleBestUpgrade.source === 'alternative' ? 'Promoted upgrade' : 'Best upgrade'}
                                        </p>
                                        {visibleBestUpgrade.source === 'best' && (
                                          <button
                                            type="button"
                                            onClick={() => markPart2BestUpgradeMastered(signal)}
                                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center border border-paper-ink/10 text-paper-ink/45 transition-colors hover:border-accent-terracotta/35 hover:text-accent-terracotta"
                                            aria-label={`Mark ${visibleBestUpgrade.upgrade} as mastered`}
                                            title="Mark as mastered for this result"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                        {visibleBestUpgrade.source === 'alternative' && bestUpgradeHidden && (
                                          <button
                                            type="button"
                                            onClick={() => restorePart2BestUpgrade(signal)}
                                            className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/35 transition-colors hover:text-accent-terracotta"
                                          >
                                            Restore
                                          </button>
                                        )}
                                      </div>
                                      <p className="mt-1 text-sm font-bold leading-7 text-paper-ink">{visibleBestUpgrade.upgrade}</p>
                                      {visibleBestUpgrade.source === 'alternative' && bestUpgradeHidden && (
                                        <p className="mt-1 text-xs leading-5 text-paper-ink/45">已隐藏原 best，本条由 alternative 顺延。</p>
                                      )}
                                      {shouldShowSampleSentence && (
                                        <p className="mt-2 text-sm leading-7 text-paper-ink">
                                          {renderPart2SignalSampleSentence(sampleSentence, sampleHighlight)}
                                        </p>
                                      )}
                                    </div>
                                  )}

                                  {!visibleBestUpgrade && bestUpgradeHidden && bestUpgrade && (
                                    <div className="border-l-2 border-l-paper-ink/15 pl-3 text-sm leading-6 text-paper-ink/55">
                                      <div className="flex items-center justify-between gap-3">
                                        <p>已隐藏：{bestUpgrade.upgrade}</p>
                                        <button
                                          type="button"
                                          onClick={() => restorePart2BestUpgrade(signal)}
                                          className="text-[10px] font-sans uppercase tracking-widest text-paper-ink/35 transition-colors hover:text-accent-terracotta"
                                        >
                                          Restore
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {visibleAlternatives.length > 0 && (
                                    <div className="mt-3">
                                      <p className="text-xs font-sans uppercase tracking-widest text-paper-ink/40">Alternatives</p>
                                      <div className="mt-2 space-y-2">
                                        {visibleAlternatives.map((item, index) => (
                                          <div key={`${item.sourceQuote || item.upgrade}-${index}`} className="border border-paper-ink/10 bg-paper-50 px-2.5 py-2 transition-all duration-300">
                                            {item.sourceQuote && (
                                              <p className="text-xs leading-5 text-paper-ink/45">替换："{item.sourceQuote}"</p>
                                            )}
                                            {!item.sourceQuote && (item.guidanceZh || item.insertLocationZh) && (
                                              <p className="text-xs leading-5 text-paper-ink/45">
                                                {item.kind === 'add' ? '加入' : '可用表达'}
                                                {item.insertLocationZh ? `：${item.insertLocationZh}` : ''}
                                              </p>
                                            )}
                                            <p className="text-sm font-bold leading-6 text-paper-ink">{item.upgrade}</p>
                                            {item.guidanceZh && (
                                              <p className="text-xs leading-5 text-paper-ink/55">{item.guidanceZh}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </PaperCard>
                </section>
              )}

              {!shouldUsePart2InlineAnnotations && !isHighBandStable && (criticalErrors.length > 0 || optionalPolish.length > 0 || shouldShowDevelopmentPlan) && (
              <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
                {(criticalErrors.length > 0 || shouldShowDevelopmentPlan) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold tracking-wide text-red-800 ml-1 border-b border-paper-ink/10 pb-2">MUST FIX</h4>
                  {criticalErrors.length === 0 ? (
                    <PaperCard className="p-5 border-l-2 border-l-green-700/50">
                      <p className="text-lg leading-8 text-paper-ink/85 bg-paper-ink/[0.04] border border-paper-ink/10 p-4 rounded-sm">
                        {shouldShowDevelopmentPlan
                          ? 'Starter development needed: give a complete answer first, then review language accuracy.'
                          : isHighBandStable
                            ? '本次没有必须修改的问题。'
                            : '本次没有必须修改的问题。下一步把回答说得更具体、更自然。'}
                      </p>
                    </PaperCard>
                  ) : (
                    <div className="space-y-4">
                      {criticalErrors.map((err, i) => (
                        <PaperCard key={i} className="p-5 border-l-2 border-l-red-800">
                          <div className="text-base line-through text-paper-ink/60 mb-2 leading-7">{err.original}</div>
                          <div className="text-xl font-bold text-red-800 mb-3 leading-8">{err.correction}</div>
                          <p className="text-[17px] leading-8 text-paper-ink/90 bg-paper-ink/[0.05] border border-paper-ink/10 p-4 rounded-sm">{err.explanationZh}</p>
                        </PaperCard>
                      ))}
                    </div>
                  )}
                </div>
                )}

                {optionalPolish.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-bold tracking-wide text-paper-ink/65 ml-1 border-b border-paper-ink/10 pb-2">{phraseFixSectionLabel}</h4>
                  {optionalPolish.length === 0 ? (
                    <PaperCard className="p-5 border-l-2 border-l-paper-ink/20">
                      <p className="text-lg leading-8 text-paper-ink/75 bg-paper-ink/[0.04] border border-paper-ink/10 p-4 rounded-sm">
                        {isHighBandStable ? '本次没有必要的可选微调。' : '本次没有返回稳定的可选微调。'}
                      </p>
                    </PaperCard>
                  ) : (
                    <div className="space-y-4">
                      {optionalPolish.map((hint, i) => (
                        <PaperCard key={i} className="p-5 border-l-2 border-l-[#a64d32]/40">
                          <div className="text-base text-paper-ink/65 mb-2 leading-7">"{hint.original}" </div>
                          <div className="text-xl font-bold text-[#a64d32] mb-3 leading-8">Better: {hint.better}</div>
                          <p className="text-[17px] leading-8 text-paper-ink/90 bg-paper-ink/[0.05] border border-paper-ink/10 p-4 rounded-sm">{hint.explanationZh}</p>
                        </PaperCard>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </div>
              )}

              {feedback.part !== 2 && !shouldShowDevelopmentPlan && groundedIdeaUpgrades.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-xs font-bold tracking-wide text-paper-ink/55 ml-1">
                    IDEA & EXPRESSION UPGRADE
                  </h4>
                  <PaperCard className="border-l-2 border-l-paper-ink/30 bg-paper-50">
                    <div className="grid gap-4 lg:grid-cols-2">
                      {groundedIdeaUpgrades.map((item, index) => (
                        <div key={index} className="border border-paper-ink/10 bg-paper-ink/[0.03] p-4 rounded-sm">
                          <p className="text-xs font-sans font-bold tracking-wide text-paper-ink/40 mb-2">Focus</p>
                          <p className="text-base leading-8 text-paper-ink/85 mb-4">{item.explanationZh || item.observation}</p>
                          <p className="text-xs font-sans font-bold tracking-wide text-paper-ink/40 mb-2">Suggested wording</p>
                          <ul className="space-y-1 mb-4">
                            {[item.refinement, item.observation]
                              .filter(Boolean)
                              .slice(0, 2)
                              .map(expression => (
                                <li key={expression} className="text-base leading-7 text-paper-ink border-l-2 border-l-accent-terracotta/25 pl-3">
                                  {expression}
                                </li>
                              ))}
                          </ul>
                          <p className="text-xs font-sans font-bold tracking-wide text-paper-ink/40 mb-2">Why this works</p>
                          <p className="text-sm leading-7 text-paper-ink/70">
                            {feedback.part === 3
                              ? 'Part 3 需要从观点推进到原因、例子或影响。'
                              : feedback.part === 2
                                ? 'Part 2 需要把素材串成有细节和感受变化的长回答。'
                                : 'Part 1 需要短而自然的个人细节。'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </PaperCard>
                </section>
              )}

              {feedback.part !== 2 && feedback.preservedStyle.length > 0 && (
                <section className="border border-paper-ink/10 bg-paper-ink/[0.02] p-5">
                  <h4 className="text-sm font-sans font-bold uppercase tracking-widest text-paper-ink/50 mb-4">
                    <span>PERSONAL MATERIAL & IDEA EXPANSION</span>
                  </h4>
                  <div className="grid gap-3 md:grid-cols-2">
                    {feedback.preservedStyle.slice(0, 4).map((style, i) => (
                      <div key={i} className="border-l-2 border-l-accent-terracotta/30 pl-4 py-1">
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40">Your material</p>
                        <p className="text-lg text-paper-ink leading-8">"{style.text}"</p>
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mt-3">Why keep it</p>
                        <div className="text-base leading-8 text-paper-ink/75">{style.reasonZh}</div>
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mt-3">How to expand</p>
                        <div className="text-base leading-8 text-paper-ink/75">
                          {style.expansionZh || materialExpansionFallback(feedback.part)}
                        </div>
                        {style.sampleNextStep && (
                          <div className="mt-2 text-base leading-7 text-paper-ink border-l-2 border-l-paper-ink/15 pl-3">
                            <span className="block text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-1">Sample sentence</span>
                            {style.sampleNextStep}
                          </div>
                        )}
                        {style.transferQuestions?.length ? (
                          <div className="mt-2">
                            <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/40 mb-2">Transfer to</p>
                            <div className="flex flex-wrap gap-2">
                            {style.transferQuestions.slice(0, 2).map(item => (
                              <span key={item} className="rounded-sm border border-paper-ink/10 bg-paper-50 px-2 py-1 text-[10px] font-sans uppercase tracking-widest text-paper-ink/45">
                                {item}
                              </span>
                            ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <PaperCard className={`bg-paper-50 !p-8 md:!p-10 border-l-2 ${
                isHighBandStable ? 'border-l-green-700' : 'border-l-paper-ink/20'
              }`}>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-widest text-paper-ink/45 mb-6 border-b border-paper-ink/10 pb-3">
                    {shouldShowDevelopmentPlan
                      ? feedback.part === 2 ? 'NEXT SPEAKABLE STARTER' : 'Band 7.0+ Starter Target'
                      : feedback.part === 2 ? 'NEXT SPEAKABLE VERSION' : speakingTargetHeading(feedback)}
                  </h4>
                  {shouldShowDevelopmentPlan ? (
                    <div className="w-full max-w-none space-y-5 text-paper-ink">
                      <p className="text-lg leading-9">
                        样本太短或信息量不足，不能可靠生成完整高分改写。{starterPlan.questionReference}
                      </p>
                      <ul className="space-y-3">
                        {starterPlan.items.map(item => (
                          <li key={item} className="text-base leading-8 border-l-2 border-l-accent-terracotta/35 pl-4">
                            {item}
                          </li>
                        ))}
                      </ul>
                      <div className="border border-paper-ink/10 bg-paper-ink/[0.03] p-4 rounded-sm">
                        <p className="text-xs font-sans font-bold uppercase tracking-widest text-paper-ink/45 mb-2">
                          {feedback.part === 2 ? 'Next Speakable Starter' : 'Starter Target Answer'}
                        </p>
                        <p className="text-lg leading-8 text-paper-ink">{starterPlan.targetAnswer}</p>
                        <p className="text-sm leading-7 text-paper-ink/60 mt-3">
                          This is a starter frame, not a fully personalized upgraded answer. Replace the brackets with your real details.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-none space-y-4">
                      {isHighBandStable && (
                        <p className="text-lg leading-8 text-paper-ink/75">
                          {feedback.nextStepZh || '目标层级已达到。下一步重点是自然输出、时间控制和迁移练习。'}
                        </p>
                      )}
                      {canShowSpeakingTargetAnswer ? (
                        <p className="w-full text-lg md:text-xl leading-9 md:leading-10 text-paper-ink font-serif whitespace-pre-wrap">
                          {feedback.part === 2 ? renderPart2NextSpeakableAnswer() : visibleSpeakingTargetAnswer}
                        </p>
                      ) : (
                        <p className="text-base leading-8 text-paper-ink/65">
                          Unable to generate a target answer. Please retry.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="mt-8 flex justify-start border-t border-paper-ink/10 pt-6">
                  <SerifButton onClick={exportMarkdown} className="w-full sm:w-auto text-xs flex items-center justify-center gap-2 py-3" variant="outline">
                    <FileDown className="w-4 h-4" /> Export Markdown
                  </SerifButton>
                </div>
              </PaperCard>
              </>
              )}
            </div>
        </div>
        )}
      </div>
      {selectedThreadAnnotation && (
        <Part1AnnotationOverlay
          annotation={selectedThreadAnnotation}
          anchorEl={selectedThreadAnnotationAnchor}
          onClose={() => setSelectedThreadAnnotationId(null)}
        />
      )}
      {selectedSpeakingAnnotation && (
        <Part1AnnotationOverlay
          annotation={selectedSpeakingAnnotation}
          anchorEl={selectedSpeakingAnnotationAnchor}
          onClose={() => setSelectedSpeakingAnnotationId(null)}
        />
      )}
    </PageShell>
  );
}
