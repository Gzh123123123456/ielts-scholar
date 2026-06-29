import {
  AIProvider,
  Part1CleanRetryCertificationRequest,
  Part1LearningAssetsRequest,
  SpeakingAudioTranscriptionRequest,
  SpeakingAnalysisRequest,
  SpeakingScoreOnlyRequest,
  SpeakingTargetValidationRequest,
  WritingAnalysisRequest,
  WritingFrameworkCoachRequest,
  WritingTask1AnalysisRequest,
  WritingFrameworkRequest,
  WritingTargetValidationRequest,
} from './providers/base';
import {
  ProviderDiagnostic,
  FatalError,
  NaturalnessHint,
  Part1AnswerAnnotation,
  Part1AnswerAnnotationLayer,
  Part1AnnotationOrigin,
  Part1AnnotationSeverity,
  Part1CleanRetryAnswer,
  Part1CleanRetryCertificationResult,
  Part1CleanRetryCertificationViolation,
  Part1DevelopmentStatus,
  Part1DevelopmentTarget,
  Part1DisplayedCleanRetryCertificationStatus,
  Part1LearningAssetsResult,
  Part1RetryReferenceContext,
  Part1SessionPriorityState,
  Part3CriticalThinkingChain,
  Part3FeedbackMode,
  Part3MicroUpgrade,
  Part3QuestionFrame,
  Part3TargetAnswerHighlightRole,
  Part3ThinkingDiagnosis,
  Part3TopicLanguageSection,
  SpeakingAudioTranscriptionResult,
  SpeakingCeilingDiagnosis,
  SpeakingCeilingTag,
  SpeakingFeedback,
  SpeakingMaterialBankItem,
  SpeakingNextRetryPlan,
  SpeakingPart,
  SpeakingScoreOnlyResult,
  SpeakingTargetAnswerSelfScores,
  SpeakingTargetValidationResult,
  TargetAnswerLayer,
  TargetAnswerStatus,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
  WritingFrameworkSummary,
  WritingTargetAnswerSelfScores,
  WritingTargetValidationResult,
  WritingTask1Feedback,
  WritingTask,
} from './schemas';
import { capBand, floorToHalfBand, formatConservativeBandEstimate, getTargetLabel, roundToHalfBand } from '../bands';
import {
  buildSpeakingTrainingMarkdown,
  buildWritingTask1TrainingMarkdown,
  buildWritingTask2TrainingMarkdown,
} from '../markdownExport';
import {
  HIGH_BAND_BOUNDARY_ZH,
  HIGH_BAND_STABLE_ZH,
  resolveSpeakingTargetState,
  resolveTask1TargetState,
  resolveWritingTargetState,
} from '../scoreLayer';

type SpeakingRequest = SpeakingAnalysisRequest;
type Part1CertificationRequest = Part1CleanRetryCertificationRequest;
type Part1LearningAssetsSafeRequest = Part1LearningAssetsRequest;
type SpeakingTranscriptionRequest = SpeakingAudioTranscriptionRequest;
type SpeakingScoreRequest = SpeakingScoreOnlyRequest;
type WritingRequest = WritingAnalysisRequest;
type WritingTask1Request = WritingTask1AnalysisRequest;
type FrameworkCoachRequest = WritingFrameworkCoachRequest;
type FrameworkRequest = WritingFrameworkRequest;
type SpeakingValidationRequest = SpeakingTargetValidationRequest;
type WritingValidationRequest = WritingTargetValidationRequest;

interface SafeAnalyzeResult<T> {
  feedback: T;
  diagnostic: ProviderDiagnostic;
}

const FALLBACK_SCORE = 0;
const FALLBACK_TEXT = 'Provider output was malformed or incomplete.';
const BLOCKED_LEARNING_CONTENT =
  /provider output was malformed or incomplete|please retry analysis after checking the debug panel|provider_safety|raw parse|validation failure|parse_or_schema|incomplete feedback|debug panel|\[remove or rephrase sentence\]/i;

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

const safeLearningText = (value: string, fallback = ''): string => {
  const cleaned = value.replace(/"{3,}/g, '').replace(/\s+/g, ' ').trim();
  return cleaned && !BLOCKED_LEARNING_CONTENT.test(cleaned) ? cleaned : fallback;
};

const SPEAKING_GRAMMAR_TAG_PATTERN =
  /\b(grammar|tense|article|determiner|subject.?verb|sva|clause|clause.?form|sentence.?structure|word.?order|verb.?form|noun.?phrase)\b/i;

const speakingIssueKey = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isExplicitSpeakingGrammarHint = (hint: NaturalnessHint): boolean =>
  SPEAKING_GRAMMAR_TAG_PATTERN.test(`${hint.tag} ${hint.explanationZh}`);

const fatalErrorCoversPhrase = (fatalErrors: FatalError[], phrase: string): boolean => {
  const key = speakingIssueKey(phrase);
  if (!key) return false;
  return fatalErrors.some(error => {
    const original = speakingIssueKey(error.original);
    return original === key || original.includes(key) || key.includes(original);
  });
};

const promoteGrammarTaggedSpeakingHints = (
  fatalErrors: FatalError[],
  naturalnessHints: NaturalnessHint[],
  normalizedFields: string[],
) => {
  const promoted: FatalError[] = [];
  const remainingHints: NaturalnessHint[] = [];

  naturalnessHints.forEach(hint => {
    if (!isExplicitSpeakingGrammarHint(hint) || fatalErrorCoversPhrase([...fatalErrors, ...promoted], hint.original)) {
      remainingHints.push(hint);
      return;
    }

    promoted.push({
      original: hint.original,
      correction: hint.better,
      tag: hint.tag || 'grammar',
      explanationZh: hint.explanationZh,
    });
  });

  if (promoted.length > 0) {
    normalizedFields.push('speakingGrammarHintRouting');
  }

  return {
    fatalErrors: [...fatalErrors, ...promoted],
    naturalnessHints: remainingHints,
  };
};

const insufficientSampleMessageZh = (moduleLabel: string, minimumWords: number) =>
  `Sample is too short for a reliable ${moduleLabel} training estimate. Expand to about ${minimumWords} words with a complete point, detail, and example before treating language issues as score evidence.`;

const applyLengthCap = (score: number, words: number, minimumWords: number): number => {
  if (!Number.isFinite(score) || score <= 0) return score;
  if (words <= 20) return floorToHalfBand(capBand(score, 3.0));
  if (words < minimumWords * 0.5) return floorToHalfBand(capBand(score, 4.0));
  if (words < minimumWords) return floorToHalfBand(capBand(score, 5.0));
  return roundToHalfBand(score);
};

const speakingMinimumWords = (part: SpeakingPart): number =>
  part === 1 ? 18 : part === 2 ? 90 : 45;

const hasLowSignalSpeakingText = (text: string): boolean => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ').filter(Boolean);
  const uniqueWords = new Set(words);
  const letterCount = normalized.replace(/\s/g, '').length;
  return letterCount < 12 || (words.length >= 4 && uniqueWords.size <= 2);
};

const shouldLimitSpeakingTransformation = (text: string, words: number, part: SpeakingPart): boolean => {
  if (hasLowSignalSpeakingText(text)) return true;
  if (part === 1) return words <= 8;
  if (part === 2) return words < 60;
  return words < 35;
};

const buildInsufficientSpeakingTransformation = (part: SpeakingPart): string => {
  if (part === 1) {
    return 'Insufficient sample for a full high-band transformation. Starter: give a direct answer, add one personal detail, and close with a natural reason.';
  }

  if (part === 2) {
    return 'Insufficient sample for a full Part 2 model answer. Starter outline: introduce the person/place/event, describe two concrete details, explain why it mattered, and finish with one personal reflection.';
  }

  return 'Insufficient sample for a full Part 3 model answer. Starter outline: state a clear opinion, compare two sides, add one real-world example, and explain the wider consequence.';
};

const isProviderIncompleteSpeakingAnswer = (text: string): boolean =>
  /provider returned incomplete feedback|please retry analysis|malformed or incomplete/i.test(text);

const normalizeSpeakingBandEstimateRange = (
  value: unknown,
  headline: number,
  hasQualityCap: boolean,
  normalizedFields: string[],
) => {
  if (hasQualityCap) return undefined;
  const stringRange = typeof value === 'string'
    ? value.match(/(\d(?:\.\d)?)\s*-\s*(\d(?:\.\d)?)/)
    : null;
  const source = isRecord(value)
    ? value
    : stringRange
      ? {
        lower: Number(stringRange[1]),
        upper: Number(stringRange[2]),
      }
      : null;
  if (!source) return undefined;
  const lower = roundToHalfBand(typeof source.lower === 'number' ? source.lower : 0);
  const upper = roundToHalfBand(typeof source.upper === 'number' ? source.upper : 0);
  if (
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    lower <= 0 ||
    upper <= lower ||
    Math.round((upper - lower) * 2) !== 1 ||
    lower < 1 ||
    upper > 9
  ) {
    normalizedFields.push('bandEstimateRange');
    return undefined;
  }
  const roundedHeadline = roundToHalfBand(headline);
  if (roundedHeadline !== lower && roundedHeadline !== upper) {
    normalizedFields.push('bandEstimateRange');
    return undefined;
  }
  if (stringRange) {
    normalizedFields.push('bandEstimateRange:string');
  }
  return {
    lower,
    upper,
    rationaleZh: isRecord(value) ? optionalSafeString(value.rationaleZh) : undefined,
  };
};

const normalizeValidSpeakingBandEstimateRange = (value: unknown) => {
  const stringRange = typeof value === 'string'
    ? value.match(/(\d(?:\.\d)?)\s*-\s*(\d(?:\.\d)?)/)
    : null;
  const source = isRecord(value)
    ? value
    : stringRange
      ? {
        lower: Number(stringRange[1]),
        upper: Number(stringRange[2]),
      }
      : null;
  if (!source) return undefined;
  const lower = roundToHalfBand(typeof source.lower === 'number' ? source.lower : 0);
  const upper = roundToHalfBand(typeof source.upper === 'number' ? source.upper : 0);
  if (
    !Number.isFinite(lower) ||
    !Number.isFinite(upper) ||
    lower <= 0 ||
    upper <= lower ||
    Math.round((upper - lower) * 2) !== 1 ||
    lower < 1 ||
    upper > 9
  ) {
    return undefined;
  }
  return {
    lower,
    upper,
    rationaleZh: isRecord(value) ? optionalSafeString(value.rationaleZh) : undefined,
  };
};

const isValidSpeakingScalarEstimate = (value: unknown) =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 1 &&
  value <= 9;

const splitSentences = (text: string): string[] =>
  text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map(sentence => sentence.trim())
    .filter(Boolean) || [];

const buildPart1TargetStarter = (transcript: string): string => {
  const cleaned = transcript.replace(/\s+/g, ' ').trim();
  if (!cleaned || hasLowSignalSpeakingText(cleaned)) {
    return "Usually, I like spending time with my friends in a relaxed way. We might grab a coffee or just walk around and chat. I enjoy it because it helps me switch off after a busy day.";
  }
  const firstSentence = splitSentences(cleaned)[0] || cleaned;
  return `${firstSentence.replace(/[.!?]+$/, '')}. Usually I would add one specific detail, like where we go or what we talk about. That makes the answer sound more natural and personal.`;
};

const scrubUnsupportedPart1TargetSpecifics = (
  value: string,
  transcript: string,
  normalizedFields?: string[],
) => {
  const replacement = /\bearly\b/i.test(transcript) ? 'early' : 'at a natural time';
  let scrubbedUnsupportedSpecific = false;
  const scrubbed = value.replace(
    /\b(?:around|at|by|before|after)\s+(\d{1,2}(?::\d{2})?)\s*(?:a\.?m\.?|p\.?m\.?|o'clock)?\b/gi,
    (match, clockNumber: string) => {
      const escapedNumber = clockNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escapedNumber}\\b`).test(transcript)) return match;
      scrubbedUnsupportedSpecific = true;
      return replacement;
    },
  );
  if (scrubbedUnsupportedSpecific) {
    normalizedFields?.push('part1UnsupportedTargetSpecificsScrubbed');
  }
  return scrubbed;
};

const calibrateSpeakingUpgradedAnswer = (
  value: string,
  part: SpeakingPart,
  transcript: string,
  limitTransformation: boolean,
  normalizedFields?: string[],
): string => {
  if (limitTransformation || part !== 1 || isProviderIncompleteSpeakingAnswer(value)) return value;
  const words = countWords(value);
  const sentences = splitSentences(value);
  if (words <= 80 && sentences.length <= 4) {
    return scrubUnsupportedPart1TargetSpecifics(value, transcript, normalizedFields);
  }

  const trimmed = sentences.slice(0, 4).join(' ');
  if (countWords(trimmed) >= 25 && countWords(trimmed) <= 85) {
    return scrubUnsupportedPart1TargetSpecifics(trimmed, transcript, normalizedFields);
  }
  return buildPart1TargetStarter(transcript);
};

const applySpeakingLengthCap = (score: number, words: number, part: SpeakingPart): number => {
  if (!Number.isFinite(score) || score <= 0) return score;
  if (words <= 6) return floorToHalfBand(capBand(score, 3.0));
  if (part === 1 && words < speakingMinimumWords(part)) return floorToHalfBand(capBand(score, 5.0));
  if (part === 2 && words < 45) return floorToHalfBand(capBand(score, 4.0));
  if (part === 2 && words < speakingMinimumWords(part)) return floorToHalfBand(capBand(score, 5.0));
  if (part === 3 && words < 25) return floorToHalfBand(capBand(score, 4.0));
  if (part === 3 && words < speakingMinimumWords(part)) return floorToHalfBand(capBand(score, 5.0));
  return floorToHalfBand(score);
};

const normalizeHalfBandScore = (score: number): number =>
  Math.max(0, Math.min(9, roundToHalfBand(score)));

const isPositiveFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const speakingCriteriaAverage = (scores: {
  fluencyCoherence: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
}): number | undefined => {
  const values = [
    scores.fluencyCoherence,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ].filter(isPositiveFiniteNumber);
  if (values.length !== 3) return undefined;
  return normalizeHalfBandScore(values.reduce((sum, score) => sum + score, 0) / values.length);
};

const buildSpeakingLengthMustFix = (words: number, part: SpeakingPart): FatalError | null => {
  const minimum = speakingMinimumWords(part);
  if (words >= minimum) return null;
  const partLabel = `Speaking Part ${part}`;
  const guidance = part === 1
    ? 'Part 1 can be concise, but one-word or one-sentence answers do not show enough range for a high estimate.'
    : part === 2
      ? 'Part 2 is a long-turn response, so the sample needs sustained development before a higher estimate is possible.'
      : 'Part 3 needs developed reasoning, examples, or contrast; very short answers are capped conservatively.';
  return {
    original: words <= 6 ? 'Very short answer' : 'Under-developed answer',
    correction: 'Expand the answer before treating this as score evidence.',
    tag: 'insufficient_sample',
    explanationZh: `${insufficientSampleMessageZh(partLabel, minimum)} ${guidance}`,
  };
};

const buildWritingLengthWarning = (
  words: number,
  task: WritingTask,
): WritingFeedback['essayLevelWarnings'][number] | null => {
  const minimum = task === 'task1' ? 150 : 250;
  const label = task === 'task1' ? 'Writing Task 1' : 'Writing Task 2';
  if (words >= minimum) return null;
  return {
    title: words <= 20 ? 'Insufficient sample warning' : 'Under-length response',
    messageZh: words <= 20
      ? `${insufficientSampleMessageZh(label, minimum)} Expand this into a complete response before treating the estimate as reliable.`
      : `${label} is under ${minimum} words, so the training estimate is capped. Expand body paragraphs before treating the estimate as reliable.`,
  };
};

const PROMPT_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'because', 'before', 'being', 'between', 'could', 'describe', 'does',
  'doing', 'during', 'example', 'explain', 'first', 'from', 'have', 'their', 'there', 'these', 'thing',
  'think', 'this', 'those', 'time', 'what', 'when', 'where', 'which', 'while', 'with', 'would', 'your',
  'some', 'many', 'people', 'person', 'place', 'event', 'important', 'reason', 'question', 'answer',
]);

const tokenizeForPromptMatch = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map(word => word.replace(/(?:ing|ed|es|s)$/i, ''))
    .filter(word => word.length >= 4 && !PROMPT_STOP_WORDS.has(word));

const containsAny = (text: string, pattern: RegExp) => pattern.test(text.toLowerCase());

const detectLikelyPromptMismatch = (question: string, answer: string, minWords: number): boolean => {
  if (countWords(answer) < minWords) return false;
  const questionLower = question.toLowerCase();
  const answerLower = answer.toLowerCase();
  const techQuestion = containsAny(questionLower, /\b(technology|internet|computer|computers|online|digital|device|devices|apps?|ai|robot|coding|software)\b/);
  const techAnswer = containsAny(answerLower, /\b(technology|internet|computer|computers|online|digital|device|devices|apps?|ai|robot|coding|software|programming|vibe coding)\b/);
  const unrelatedEventAnswer = containsAny(answerLower, /\b(tajikistan|interpreter|translation event|ceremony|conference|tour guide|foreign guest)\b/);
  if (techQuestion && !techAnswer && unrelatedEventAnswer) return true;

  const questionKeywords = Array.from(new Set(tokenizeForPromptMatch(question))).slice(0, 12);
  if (questionKeywords.length < 3) return false;
  const answerKeywords = new Set(tokenizeForPromptMatch(answer));
  const overlap = questionKeywords.filter(keyword => answerKeywords.has(keyword)).length;
  const overlapRatio = overlap / questionKeywords.length;
  const strongWrongPromptMarkers = containsAny(answerLower, /\b(i want to talk about|the event happened|it happened in|i was asked to|as an interpreter)\b/);
  return overlap === 0 && overlapRatio < 0.12 && strongWrongPromptMarkers;
};

const PROMPT_MISMATCH_ZH = 'This answer may not be responding to the current question. Please check whether the selected prompt is correct.';

const buildSpeakingPromptMismatchWarning = (
  question: string,
  transcript: string,
  part: SpeakingPart,
): FatalError | null => {
  const minWords = part === 1 ? 35 : part === 2 ? 70 : 45;
  if (!detectLikelyPromptMismatch(question, transcript, minWords)) return null;
  return {
    original: 'Answer may belong to another prompt',
    correction: 'Check the selected question before judging language details.',
    tag: 'prompt_mismatch',
    explanationZh: PROMPT_MISMATCH_ZH,
  };
};

const buildWritingPromptMismatchWarning = (
  question: string,
  essay: string,
): WritingFeedback['essayLevelWarnings'][number] | null => {
  if (!detectLikelyPromptMismatch(question, essay, 80)) return null;
  return {
    title: 'Prompt mismatch warning',
    messageZh: PROMPT_MISMATCH_ZH,
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (
  value: unknown,
  fallback: string,
  path: string,
  errors: string[],
): string => {
  if (typeof value === 'string' && value.trim()) {
    const cleaned = value.trim();
    if (!BLOCKED_LEARNING_CONTENT.test(cleaned)) return cleaned;
    errors.push(`${path} contained blocked provider/fallback text`);
    return fallback === FALLBACK_TEXT ? '' : fallback;
  }
  errors.push(`${path} missing or invalid string`);
  return fallback;
};

const asNumber = (
  value: unknown,
  path: string,
  errors: string[],
  fallback = FALLBACK_SCORE,
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  errors.push(`${path} missing or invalid number`);
  return fallback;
};

const asArray = (value: unknown, path: string, errors: string[]): unknown[] => {
  if (Array.isArray(value)) return value;
  errors.push(`${path} missing or invalid array`);
  return [];
};

const asSpeakingPart = (value: unknown, fallback: number, errors: string[]): SpeakingPart => {
  const candidate = typeof value === 'number' ? value : fallback;
  if (candidate === 1 || candidate === 2 || candidate === 3) return candidate;
  errors.push('part missing or invalid SpeakingPart');
  return 1;
};

const asWritingTask = (value: unknown, fallback: string, errors: string[]): WritingTask => {
  const candidate = typeof value === 'string' ? value : fallback;
  if (candidate === 'task1' || candidate === 'task2') return candidate;
  errors.push('task missing or invalid WritingTask');
  return 'task2';
};

const normalizeStringArray = (
  value: unknown,
  path: string,
  errors: string[],
): string[] =>
  asArray(value, path, errors)
    .map((item, index) => asString(item, FALLBACK_TEXT, `${path}[${index}]`, errors))
    .filter(Boolean);

const optionalSafeString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  return safeLearningText(value) || undefined;
};

const optionalSafeStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map(item => optionalSafeString(item))
    .filter((item): item is string => Boolean(item));
  return items.length ? items : undefined;
};

const normalizeSpeakingReusableExample = (
  value: unknown,
  normalizedFields: string[],
): SpeakingFeedback['reusableExample'] => {
  if (!isRecord(value)) return null;

  const example = optionalSafeString(value.example);
  const explanationZh = optionalSafeString(value.explanationZh);
  if (!example || !explanationZh) {
    normalizedFields.push('reusableExampleDroppedIncomplete');
    return null;
  }

  return {
    example,
    canBeReusedFor: optionalSafeStringArray(value.canBeReusedFor) || [],
    explanationZh,
  };
};

const normalizeSpeakingNaturalnessHints = (
  value: unknown,
  validationErrors: string[],
  normalizedFields: string[],
): NaturalnessHint[] => {
  if (!Array.isArray(value)) {
    validationErrors.push('naturalnessHints missing or invalid array');
    return [];
  }
  return value
    .map((item, index): NaturalnessHint | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) {
        validationErrors.push(`naturalnessHints[${index}] missing or invalid object`);
        return null;
      }
      const original = optionalSafeString(record.original);
      const better = optionalSafeString(record.better);
      const explanationZh = optionalSafeString(record.explanationZh);
      if (!original || !better || !explanationZh) {
        normalizedFields.push(`naturalnessHintDroppedIncomplete:${index}`);
        return null;
      }
      return {
        original,
        better,
        tag: optionalSafeString(record.tag) || 'provider_safety',
        explanationZh,
      };
    })
    .filter((item): item is NaturalnessHint => Boolean(item));
};

const SPEAKING_CEILING_TAGS: SpeakingCeilingTag[] = [
  'too_written',
  'not_precise_enough',
  'limited_paraphrase_flexibility',
  'over_explained',
  'not_spontaneous_enough',
  'weak_nuance',
  'generic_reasoning',
  'insufficient_part3_abstraction',
  'minor_collocation_inaccuracy',
  'grammar_errors_still_persistent',
  'under_developed',
  'part_inappropriate_development',
  'delivery_unknown',
];

const normalizeSpeakingCeilingTags = (value: unknown): SpeakingCeilingTag[] | undefined => {
  const rawTags = Array.isArray(value)
    ? optionalSafeStringArray(value)
    : optionalSafeString(value)
      ? [optionalSafeString(value) as string]
      : undefined;
  const tags = rawTags
    ?.filter((item): item is SpeakingCeilingTag =>
      SPEAKING_CEILING_TAGS.includes(item as SpeakingCeilingTag))
    .slice(0, 2);
  return tags?.length ? tags : undefined;
};

const normalizeSpeakingCeilingDiagnosis = (
  value: unknown,
): SpeakingCeilingDiagnosis | undefined => {
  if (!isRecord(value)) return undefined;
  const source = value;
  const diagnosis: SpeakingCeilingDiagnosis = {
    whyNotLowerZh: optionalSafeString(source.whyNotLowerZh ?? source.whyNotLower),
    whyNotHigherZh: optionalSafeString(source.whyNotHigherZh ?? source.whyNotHigher ?? source.ceilingZh),
    nextBandTriggerZh: optionalSafeString(source.nextBandTriggerZh ?? source.nextTriggerZh ?? source.nextMoveZh),
    textOnlyNoteZh: optionalSafeString(source.textOnlyNoteZh ?? source.textOnlyNote) ||
      '默认按当前答案能自然、清楚、流畅地说出时估计。',
    partSpecificCeilingZh: optionalSafeString(source.partSpecificCeilingZh ?? source.partCeilingZh),
    ceilingTags: normalizeSpeakingCeilingTags(source.ceilingTags ?? source.highBandCeiling),
  };
  return Object.values(diagnosis).some(Boolean) ? diagnosis : undefined;
};

const asOptionalHalfBand = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return undefined;
  return normalizeHalfBandScore(value);
};

const normalizeTargetAnswerLayer = (value: unknown): TargetAnswerLayer | undefined => {
  if (value === 'band_7_to_7_5' || value === 'band_8_plus' || value === 'high_band_stability') return value;
  return undefined;
};

const normalizeTargetAnswerStatus = (value: unknown): TargetAnswerStatus | undefined => {
  if (
    value === 'meets_target' ||
    value === 'borderline' ||
    value === 'failed' ||
    value === 'not_generated' ||
    value === 'not_applicable'
  ) {
    return value;
  }
  return undefined;
};

const speakingTargetLayerForEstimate = (estimate: number): TargetAnswerLayer =>
  estimate >= 8 ? 'high_band_stability' : estimate >= 7 ? 'band_8_plus' : 'band_7_to_7_5';

const writingTargetLayerForEstimate = (estimate: number): TargetAnswerLayer =>
  estimate >= 8 ? 'high_band_stability' : estimate >= 7 ? 'band_8_plus' : 'band_7_to_7_5';

const targetFloorForLayer = (layer: TargetAnswerLayer): number =>
  layer === 'band_7_to_7_5' ? 7 : 8;

const normalizeSpeakingTargetSelfScores = (value: unknown): SpeakingTargetAnswerSelfScores | undefined => {
  if (!isRecord(value)) return undefined;
  const normalized: SpeakingTargetAnswerSelfScores = {
    fluencyCoherence: asOptionalHalfBand(value.fluencyCoherence),
    lexicalResource: asOptionalHalfBand(value.lexicalResource),
    grammaticalRangeAccuracy: asOptionalHalfBand(value.grammaticalRangeAccuracy),
    pronunciation: null,
  };
  return normalized.fluencyCoherence || normalized.lexicalResource || normalized.grammaticalRangeAccuracy
    ? normalized
    : undefined;
};

const normalizeWritingTargetSelfScores = (value: unknown): WritingTargetAnswerSelfScores | undefined => {
  if (!isRecord(value)) return undefined;
  const normalized: WritingTargetAnswerSelfScores = {
    taskResponse: asOptionalHalfBand(value.taskResponse),
    coherenceCohesion: asOptionalHalfBand(value.coherenceCohesion),
    lexicalResource: asOptionalHalfBand(value.lexicalResource),
    grammaticalRangeAccuracy: asOptionalHalfBand(value.grammaticalRangeAccuracy),
  };
  return normalized.taskResponse ||
    normalized.coherenceCohesion ||
    normalized.lexicalResource ||
    normalized.grammaticalRangeAccuracy
    ? normalized
    : undefined;
};

const speakingTargetScoresMeetFloor = (
  scores: SpeakingTargetAnswerSelfScores | undefined,
  floor: number,
) =>
  Boolean(
    scores?.fluencyCoherence &&
    scores.lexicalResource &&
    scores.grammaticalRangeAccuracy &&
    scores.fluencyCoherence >= floor &&
    scores.lexicalResource >= floor &&
    scores.grammaticalRangeAccuracy >= floor,
  );

const writingTargetScoresMeetFloor = (
  scores: WritingTargetAnswerSelfScores | undefined,
  floor: number,
) =>
  Boolean(
    scores?.taskResponse &&
    scores.coherenceCohesion &&
    scores.lexicalResource &&
    scores.grammaticalRangeAccuracy &&
    scores.taskResponse >= floor &&
    scores.coherenceCohesion >= floor &&
    scores.lexicalResource >= floor &&
    scores.grammaticalRangeAccuracy >= floor,
  );

const speakingTargetScoresBelowFloor = (
  scores: SpeakingTargetAnswerSelfScores | undefined,
  floor: number,
) =>
  Boolean(scores && [
    scores.fluencyCoherence,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ].some(score => typeof score === 'number' && score < floor));

const writingTargetScoresBelowFloor = (
  scores: WritingTargetAnswerSelfScores | undefined,
  floor: number,
) =>
  Boolean(scores && [
    scores.taskResponse,
    scores.coherenceCohesion,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ].some(score => typeof score === 'number' && score < floor));

const tryParseJson = (source: string): { parsedJson: unknown; parseError?: string } => {
  try {
    return { parsedJson: JSON.parse(source) };
  } catch (error) {
    return {
      parsedJson: null,
      parseError: error instanceof Error ? error.message : String(error),
    };
  }
};

const extractFencedJson = (source: string): string | null => {
  const match = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = match?.[1]?.trim();
  return candidate || null;
};

const extractFirstJsonObject = (source: string): string | null => {
  const start = source.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];

    if (escaping) {
      escaping = false;
      continue;
    }

    if (character === '\\') {
      escaping = inString;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;

    if (depth === 0) return source.slice(start, index + 1);
  }

  return null;
};

const parseRawResponse = (rawResponse: unknown): { parsedJson: unknown; parseError?: string } => {
  if (typeof rawResponse !== 'string') return { parsedJson: rawResponse };

  const trimmedResponse = rawResponse.trim();
  const directParse = tryParseJson(trimmedResponse);
  if (!directParse.parseError) return directParse;

  const parseErrors = [`direct JSON parse failed: ${directParse.parseError}`];

  const fencedJson = extractFencedJson(trimmedResponse);
  if (fencedJson) {
    const fencedParse = tryParseJson(fencedJson);
    if (!fencedParse.parseError) return fencedParse;
    parseErrors.push(`fenced JSON parse failed: ${fencedParse.parseError}`);
  }

  const jsonObject = extractFirstJsonObject(trimmedResponse);
  if (jsonObject) {
    const objectParse = tryParseJson(jsonObject);
    if (!objectParse.parseError) return objectParse;
    parseErrors.push(`embedded JSON object parse failed: ${objectParse.parseError}`);
  }

  return {
    parsedJson: null,
    parseError: parseErrors.join(' | '),
  };
};

const isProviderUnavailableError = (parseError?: string): boolean => {
  if (!parseError) return false;
  const normalized = parseError.toLowerCase();
  return [
    '402',
    '429',
    '500',
    '503',
    'insufficient balance',
    'resource_exhausted',
    'quota',
    'unavailable',
    'high demand',
    'try again later',
    'fetch failed',
    'networkerror',
    'failed to fetch',
    'connect timeout',
    'connecttimeouterror',
    'und_err_connect_timeout',
    'operation was aborted',
    'econnrefused',
    'econnreset',
    'etimedout',
    'enotfound',
    'timeout',
    'rate limit',
  ].some(marker => normalized.includes(marker));
};

const isProviderUnsupportedError = (parseError?: string): boolean => {
  if (!parseError) return false;
  const normalized = parseError.toLowerCase();
  return [
    'unsupported',
    'does not implement',
    'does not support',
    'audio transcription is not supported',
  ].some(marker => normalized.includes(marker));
};

const getFailureKind = (parseError: string | undefined, validationErrors: string[]) => {
  if (isProviderUnsupportedError(parseError)) return 'unsupported' as const;
  if (isProviderUnavailableError(parseError)) return 'provider_unavailable' as const;
  if (parseError || validationErrors.length > 0) return 'parse_or_schema' as const;
  return undefined;
};

const redactSecrets = (value: unknown): unknown => {
  if (typeof value === 'string') {
    return value
      .replace(/(api[_-]?key|authorization|bearer)\s*[:=]\s*["']?[^"',\s]+/gi, '$1: [REDACTED]')
      .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[REDACTED_GEMINI_KEY]')
      .replace(/sk-[0-9A-Za-z_-]{16,}/g, '[REDACTED_API_KEY]');
  }
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      /key|secret|token|authorization/i.test(key)
        ? '[REDACTED]'
        : /audioBase64|base64Audio|audioData/i.test(key)
          ? '[AUDIO_BASE64_REDACTED]'
          : redactSecrets(item),
    ]));
  }
  return value;
};

const buildDiagnostic = (diagnostic: ProviderDiagnostic): ProviderDiagnostic => ({
  ...diagnostic,
  requestPayload: redactSecrets(diagnostic.requestPayload),
  rawResponse: redactSecrets(diagnostic.rawResponse),
  parsedJson: redactSecrets(diagnostic.parsedJson),
  parseError: typeof diagnostic.parseError === 'string'
    ? redactSecrets(diagnostic.parseError) as string
    : diagnostic.parseError,
  validationErrors: diagnostic.validationErrors.map(error => redactSecrets(error) as string),
});

const buildSpeakingObsidianMarkdown = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>): string =>
  buildSpeakingTrainingMarkdown(feedback);

const normalizeSpeakingAudioTranscription = (
  value: unknown,
  validationErrors: string[],
): SpeakingAudioTranscriptionResult => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  const transcript = optionalSafeString(source.transcript) || '';
  if (!transcript) validationErrors.push('transcript missing or invalid string');

  return {
    module: 'speaking',
    operation: 'speaking_audio_transcription',
    transcript,
    uncertaintyNotes: optionalSafeStringArray(source.uncertaintyNotes) || [],
    providerDiagnostic: optionalSafeString(source.providerDiagnostic),
  };
};

const normalizeSpeakingScoreOnly = (
  value: unknown,
  request: SpeakingScoreRequest,
  validationErrors: string[],
): SpeakingScoreOnlyResult => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  const scoresSource = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const part = asSpeakingPart(source.part, request.part, validationErrors);
  const transcriptWords = countWords(request.transcript || '');
  const visibleScores = {
    fluencyCoherence: normalizeHalfBandScore(applySpeakingLengthCap(
      asNumber(scoresSource.fluencyCoherence, 'scores.fluencyCoherence', validationErrors),
      transcriptWords,
      part,
    )),
    lexicalResource: normalizeHalfBandScore(applySpeakingLengthCap(
      asNumber(scoresSource.lexicalResource, 'scores.lexicalResource', validationErrors),
      transcriptWords,
      part,
    )),
    grammaticalRangeAccuracy: normalizeHalfBandScore(applySpeakingLengthCap(
      asNumber(scoresSource.grammaticalRangeAccuracy, 'scores.grammaticalRangeAccuracy', validationErrors),
      transcriptWords,
      part,
    )),
  };
  const headlineSource =
    source.bandEstimateExcludingPronunciation ??
    source.bandEstimate ??
    source.estimatedBand ??
    source.overallBand;
  const hasExplicitHeadline = isPositiveFiniteNumber(headlineSource);
  const criteriaHeadline = speakingCriteriaAverage(visibleScores);
  const headline = normalizeHalfBandScore(applySpeakingLengthCap(
    hasExplicitHeadline
      ? headlineSource
      : criteriaHeadline ?? asNumber(headlineSource, 'bandEstimateExcludingPronunciation', validationErrors, FALLBACK_SCORE),
    transcriptWords,
    part,
  ));
  const minimumVisibleScore = Math.min(
    visibleScores.fluencyCoherence,
    visibleScores.lexicalResource,
    visibleScores.grammaticalRangeAccuracy,
  );
  const maximumVisibleScore = Math.max(
    visibleScores.fluencyCoherence,
    visibleScores.lexicalResource,
    visibleScores.grammaticalRangeAccuracy,
  );
  const normalizedHeadline = headline > 0 && minimumVisibleScore > 0 && headline < minimumVisibleScore
    ? minimumVisibleScore
    : headline > 0 && maximumVisibleScore > 0 && headline > maximumVisibleScore
      ? maximumVisibleScore
    : headline;
  const boundary = source.boundaryStatus === 'borderline_7' ||
    source.boundaryStatus === 'borderline_8' ||
    source.boundaryStatus === 'insufficient_sample' ||
    source.boundaryStatus === 'clear'
    ? source.boundaryStatus
    : undefined;

  return {
    module: 'speaking',
    operation: 'speaking_score_only',
    part,
    scores: {
      ...visibleScores,
      pronunciation: null,
    },
    bandEstimateExcludingPronunciation: normalizedHeadline,
    rationaleZh: optionalSafeString(source.rationaleZh) || 'Authoritative blind score-only pass completed.',
    boundaryStatus: boundary,
  };
};

const normalizeQuestionRefs = (
  value: unknown,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
): string[] => {
  const refs = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  const cleaned = refs.map(item => item.trim()).filter(Boolean);
  return cleaned.length ? cleaned : answers.length ? ['Q1'] : [];
};

const normalizeThreadPhraseItems = (
  value: unknown,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  validationErrors: string[],
  path: string,
  normalizedFields?: string[],
) => asArray(value, path, validationErrors).map((item, index) => {
  const record = isRecord(item) ? item : {};
  if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
  const questionRefs = normalizeQuestionRefs(record.questionRefs ?? record.affectedQuestions, answers);
  const rawOriginal = record.original ?? record.learnerWording;
  const rawBetter = record.better ?? record.betterVersion;
  if (!optionalSafeString(rawOriginal) || !optionalSafeString(rawBetter)) {
    normalizedFields?.push(`part1ThreadPhraseItemDroppedIncomplete:${path}[${index}]`);
    return null;
  }
  const original = safeLearningText(asString(rawOriginal, FALLBACK_TEXT, `${path}[${index}].original`, validationErrors));
  const better = safeLearningText(asString(rawBetter, FALLBACK_TEXT, `${path}[${index}].better`, validationErrors));
  const explanationZh = safeLearningText(asString(record.explanationZh, 'Provider feedback was incomplete; this item was normalized safely.', `${path}[${index}].explanationZh`, validationErrors));
  const answerIndex = Number((questionRefs[0] || 'Q1').replace(/^Q/i, '')) - 1;
  const repair = normalizePart1RepairLayer(original, better, path, explanationZh, answers[answerIndex]?.answer || '');
  if (!repair) return null;
  if (isAcceptablePart1RegionalOrStyleVariant(repair.original, repair.better, path, repair.explanationZh)) return null;
  return {
    questionRefs,
    original: repair.original,
    better: repair.better,
    explanationZh: repair.explanationZh,
  };
}).filter((item): item is { questionRefs: string[]; original: string; better: string; explanationZh: string } => Boolean(item && item.questionRefs.length));

const normalizePart1AnnotationSeverity = (value: unknown): Part1AnnotationSeverity => {
  if (value === 'must_fix' || value === 'better_spoken_choice' || value === 'optional_polish') return value;
  if (value === 'high_impact_phrase_fix' || value === 'phrase_fix') return 'better_spoken_choice';
  return 'optional_polish';
};

const PREVIOUS_CLEANER_CONFLICT_NOTE_ZH =
  'This wording came from a previous system-provided cleaner answer; this correction is treated as a system revision, not a new learner error.';

const normalizePart1AnnotationOrigin = (value: unknown): Part1AnnotationOrigin | undefined =>
  value === 'previous_cleaner_answer_conflict'
    ? 'previous_cleaner_answer_conflict'
    : value === 'learner'
      ? 'learner'
      : undefined;

const normalizePart1DisplayedCertificationStatus = (
  value: unknown,
): Part1DisplayedCleanRetryCertificationStatus | undefined =>
  value === 'certified_first_attempt' ||
  value === 'certified_after_rewrite' ||
  value === 'legacy_or_unverified'
    ? value
    : undefined;

const calibratePart1AnnotationSeverity = (
  severity: Part1AnnotationSeverity,
  issueType: string,
  explanationZh: string,
  original = '',
  better = '',
): Part1AnnotationSeverity => {
  if (severity !== 'must_fix') return severity;
  const originalKey = original.toLowerCase();
  const betterKey = better.toLowerCase();
  const evidence = `${issueType} ${explanationZh} ${original} ${better}`.toLowerCase();
  const reportedSpeechPresentState = /\b(knew|thought|said|told|realized|realised|learned|found out|remembered|mentioned|noticed|felt)\s+that\s+(?:i|he|she|they|we)\s+(?:am|is|are)\b/.test(originalKey);
  const reportedSpeechPastState = /\b(knew|thought|said|told|realized|realised|learned|found out|remembered|mentioned|noticed|felt)\s+(?:that\s+)?(?:i|he|she|they|we)\s+(?:was|were)\b/.test(betterKey);
  if (
    /\b(tense|backshift|reported speech|sequence of tenses)\b/.test(evidence) &&
    reportedSpeechPresentState &&
    reportedSpeechPastState &&
    !/\b(dead|ended|finished|over|no longer|used to)\b/.test(originalKey)
  ) {
    return 'optional_polish';
  }
  const hardGrammarEvidence = /\b(article|determiner|plural|singular|countability|agreement|subject-verb|tense|verb form|word form|missing verb|missing article|grammar|grammatical)\b/.test(evidence) ||
    /\b(this kind of opportunities|this kind of opportunity|those opportunities|someone invite|someone invites|team i support win|team i support wins)\b/.test(evidence);
  const naturalnessEvidence = /\b(natural|more natural|better spoken|spoken choice|optional|polish|wordy|wordiness|restructur|awkward|verbose|concise|clearer|clarity|style|preference)\b/.test(evidence) ||
    /\b(such a motivation|full of energy and passion|enjoyed the time when|enjoyed having|point guard|pg|in a team|on a team)\b/.test(evidence);
  if (naturalnessEvidence && !hardGrammarEvidence) return 'better_spoken_choice';
  if (/\b(point guard|pg|in a team|on a team)\b/.test(evidence) && !/\b(subject-verb|agreement|missing article|article)\b/.test(evidence)) {
    return 'better_spoken_choice';
  }
  return severity;
};

type Part1DevelopmentDiagnostics = {
  accepted: number;
  replacedForGrounding: number;
  fullSentenceScaffoldsFiltered: number;
  ungroundedScaffoldsFiltered: number;
};

const MAX_PART1_DEVELOPMENT_CHUNK_WORDS = 12;

type Part1AnnotationDiagnostics = {
  severityDowngradedFromMustFix: number;
  cleanerConflictsFound: number;
  cleanerConflictsResolved: number;
  incompleteLayersDropped: number;
};

const isPart1FullSentenceScaffold = (text: string) => {
  const clean = safeLearningText(text);
  const words = part1Words(clean);
  if (words.length > MAX_PART1_DEVELOPMENT_CHUNK_WORDS) return true;
  if (/[.!?]\s*$/.test(clean) && words.length > MAX_PART1_DEVELOPMENT_CHUNK_WORDS) return true;
  return /^(i|my|we|our|it|there|this|that)\b/i.test(clean) &&
    words.length > MAX_PART1_DEVELOPMENT_CHUNK_WORDS &&
    /\b(am|is|are|was|were|have|has|had|feel|felt|like|liked|prefer|preferred|live|lived|spent|grew|enjoy|enjoyed|miss|missed)\b/i.test(clean) &&
    !/\.\.\./.test(clean);
};

const isUngroundedPart1Scaffold = (scaffold: string, answer: string) => {
  const clean = safeLearningText(scaffold);
  if (!clean || /\.\.\./.test(clean)) return false;
  const answerKey = normalizeTranscriptFormatText(answer);
  const concreteWords = part1Words(clean)
    .map(word => word.toLowerCase())
    .filter(word => word.length > 4 && !PART1_LOW_INFORMATION_WORDS.has(word));
  const riskyConcrete = /\b(province|population|climate|beach|beaches|tourist|tourists|weather|fujian|island|seafood|university|company|downtown|metro|subway|mountain|museum)\b/i.test(clean);
  if (riskyConcrete && concreteWords.some(word => !answerKey.includes(word))) return true;
  const properNouns = (clean.match(/\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})*\b/g) || []) as string[];
  return properNouns.some(noun => !answerKey.includes(noun.toLowerCase()));
};

const part1DevelopmentClaimContradictsAnswer = (reasonZh: string, developmentMoveZh: string, answer: string) => {
  if (!hasPart1GroundedAnswerDetail(answer)) return false;
  const evidence = `${reasonZh} ${developmentMoveZh}`.toLowerCase();
  return /\b(no detail|without detail|only (?:gave|provided|answered|mentions?)|only a place name|only the name|just says?|just names?|bare answer)\b/.test(evidence);
};

const normalizeTranscriptFormatText = (text: string) =>
  safeLearningText(text)
    .normalize('NFKC')
    .replace(/[\u2018\u2019]/g, "\'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const normalizeLettersOnly = (text: string) =>
  normalizeTranscriptFormatText(text).replace(/[^a-z]/g, '');

const isLikelyTranscriptFormatOnlyLayer = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
) => {
  const originalText = normalizeTranscriptFormatText(original);
  const betterText = normalizeTranscriptFormatText(better);
  if (!originalText || !betterText) return false;
  if (originalText === betterText) return true;
  if (normalizeLettersOnly(original) === normalizeLettersOnly(better)) return true;
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  const hasFormatOnlyEvidence = /\b(capitali[sz]ation|uppercase|lowercase|punctuation|spacing|spelling|spell|typo|orthograph|transcription|asr|homophone|pronunciation|pronounce)\b/.test(evidence);
  const hasSpokenLanguageEvidence = /\b(article|determiner|pronoun|plural|singular|countability|preposition|collocation|tense|agreement|verb|word form|missing|grammar|accuracy|structure|word choice|natural|phrasing|spoken|reference)\b/.test(evidence);
  const originalWords = originalText.split(/\s+/).filter(Boolean);
  const betterWords = betterText.split(/\s+/).filter(Boolean);
  if (hasFormatOnlyEvidence && (!hasSpokenLanguageEvidence || (originalWords.length === 1 && betterWords.length === 1))) return true;
  const homophonePairs = new Set(['to|too', 'too|to', 'there|their', 'their|there', 'its|it s', 'it s|its']);
  return homophonePairs.has(`${originalText}|${betterText}`);
};

const stripUnsupportedTranscriptTeaching = (text: string) => {
  if (!containsUnsupportedSpeakingBoundaryClaim(text)) return text;
  const pieces = text
    .split(/(?<=[.!?;])\s+|[,]\s+/)
    .map(piece => piece.trim())
    .filter(Boolean);
  const kept = pieces.filter(piece => !containsUnsupportedSpeakingBoundaryClaim(piece));
  return kept.length ? kept.join(' ') : '';
};

const hasOverAbsoluteContextDependentClaim = (text: string) => {
  const normalized = normalizeTranscriptFormatText(text);
  return (
    /\b(always|never|cannot|can't|can not|must always|is uncountable|are uncountable|cannot be countable|can't be countable|never countable)\b/.test(normalized) &&
    /\b(countable|uncountable|collocation|word choice|preposition|natural|context|meaning|usage|motivation)\b/.test(normalized)
  ) || (
    /cannot|can not|never|always|uncountable|cannot be countable|never countable/.test(text) &&
    /article|countable|uncountable|collocation|context|meaning|motivation|energy|a\s+\w+/.test(text)
  );
};

const hasExplicitPart1SpokenIssue = (issueType: string, explanationZh: string) =>
  /\b(article|determiner|pronoun|plural|singular|countability|preposition|collocation|tense|agreement|subject-verb|verb|word form|missing|grammar|structure|word choice|reference)\b/.test(`${issueType} ${explanationZh}`.toLowerCase());

const part1IssueExplanation = (issueType: string, explanationZh: string) => {
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  if (/\b(article|determiner)\b/.test(evidence)) return 'Article or determiner use changes the spoken grammar of this phrase.';
  if (/\b(pronoun|reference)\b/.test(evidence)) return 'Pronoun/reference choice needs to match the thing you mean.';
  if (/\b(plural|singular|countability)\b/.test(evidence)) return 'Singular/plural or countability needs to match the noun meaning.';
  if (/\b(tense)\b/.test(evidence)) return 'Tense needs to match the time meaning of the answer.';
  if (/\b(agreement|subject-verb)\b/.test(evidence)) return 'Subject and verb need to agree in this phrase.';
  if (/\b(preposition)\b/.test(evidence)) return 'Preposition choice changes the natural spoken structure.';
  if (/\b(collocation|word choice)\b/.test(evidence)) return 'This is a more natural spoken collocation or word choice.';
  if (/\b(missing|verb|component|word form)\b/.test(evidence)) return 'A needed spoken-language component is missing or has the wrong form.';
  if (/\b(grammar|structure)\b/.test(evidence)) return 'This is a grounded spoken-grammar repair.';
  return undefined;
};

const contextSafePart1Explanation = (issueType: string, explanationZh: string, better?: string) =>
  hasOverAbsoluteContextDependentClaim(explanationZh)
    ? better
      ? `In this context, "${better}" is more natural. Treat it as a context-specific spoken choice, not an absolute grammar rule.`
      : 'This wording is more natural for this answer. Treat it as a context-specific spoken choice, not an absolute grammar rule.'
    : part1IssueExplanation(issueType, explanationZh);

const part1Words = (text: string) =>
  safeLearningText(text).match(/[A-Za-z']+|[0-9]+/g) || [];

const normalizePart1Word = (text: string) =>
  text.toLowerCase().replace(/[^a-z0-9]/g, '');

const part1WordEditDistance = (a: string, b: string) => {
  const left = normalizePart1Word(a);
  const right = normalizePart1Word(b);
  if (!left || !right) return 99;
  const rows = Array.from({ length: left.length + 1 }, (_, row) => [row, ...Array(right.length).fill(0)]);
  for (let col = 1; col <= right.length; col += 1) rows[0][col] = col;
  for (let row = 1; row <= left.length; row += 1) {
    for (let col = 1; col <= right.length; col += 1) {
      rows[row][col] = Math.min(
        rows[row - 1][col] + 1,
        rows[row][col - 1] + 1,
        rows[row - 1][col - 1] + (left[row - 1] === right[col - 1] ? 0 : 1),
      );
    }
  }
  return rows[left.length][right.length];
};

const isLikelyTranscriptSpellingTokenChange = (originalWord: string, betterWord: string) => {
  const original = normalizePart1Word(originalWord);
  const better = normalizePart1Word(betterWord);
  if (!original || !better || original === better) return false;
  if (Math.abs(original.length - better.length) > 2) return false;
  if (original.length < 5 || better.length < 5) return false;
  return part1WordEditDistance(original, better) <= 2;
};

const localPart1RepairContext = (
  originalWords: string[],
  betterWords: string[],
  originalIndex: number,
  betterIndex: number,
  originalCount: number,
  betterCount: number,
) => {
  const originalStart = Math.max(0, originalIndex - 1);
  const originalEnd = Math.min(originalWords.length, originalIndex + originalCount + 1);
  const betterStart = Math.max(0, betterIndex - 1);
  const betterEnd = Math.min(betterWords.length, betterIndex + betterCount + 1);
  return {
    original: originalWords.slice(originalStart, originalEnd).join(' '),
    better: betterWords.slice(betterStart, betterEnd).join(' '),
  };
};

const safelyNarrowPart1ArticleRepair = (
  originalWords: string[],
  betterWords: string[],
  answerText: string,
  issueType: string,
  explanationZh: string,
) => {
  for (let betterIndex = 0; betterIndex < betterWords.length; betterIndex += 1) {
    const inserted = normalizePart1Word(betterWords[betterIndex]);
    if (!['a', 'an', 'the'].includes(inserted)) continue;
    const nextOriginalIndex = originalWords.findIndex((word, index) =>
      index <= betterIndex + 1 &&
      normalizePart1Word(word) === normalizePart1Word(betterWords[betterIndex + 1] || ''),
    );
    if (nextOriginalIndex < 0) continue;
    const hasPreviousContext = nextOriginalIndex > 0 && betterIndex > 0;
    const context = {
      original: originalWords
        .slice(hasPreviousContext ? nextOriginalIndex - 1 : nextOriginalIndex, nextOriginalIndex + 1)
        .join(' '),
      better: betterWords
        .slice(hasPreviousContext ? betterIndex - 1 : betterIndex, betterIndex + 2)
        .join(' '),
    };
    if (!context.original || !context.better) return null;
    if (!normalizeTranscriptFormatText(answerText).includes(normalizeTranscriptFormatText(context.original))) return null;
    return {
      original: context.original,
      better: context.better,
      explanationZh: contextSafePart1Explanation(issueType, explanationZh) || 'Article or determiner use changes the spoken grammar of this phrase.',
    };
  }
  return null;
};

const safelyNarrowPart1PrepositionRepair = (
  originalWords: string[],
  betterWords: string[],
  answerText: string,
  issueType: string,
  explanationZh: string,
) => {
  const prepositions = new Set(['at', 'in', 'on', 'to', 'for', 'from', 'with', 'by', 'of', 'about', 'into', 'around']);
  for (let betterIndex = 1; betterIndex < betterWords.length; betterIndex += 1) {
    const inserted = normalizePart1Word(betterWords[betterIndex]);
    if (!prepositions.has(inserted)) continue;
    const previousOriginal = originalWords[betterIndex - 1];
    const previousBetter = betterWords[betterIndex - 1];
    if (!previousOriginal || !previousBetter || normalizePart1Word(previousOriginal) !== normalizePart1Word(previousBetter)) continue;
    const nextOriginal = originalWords[betterIndex];
    const nextBetter = betterWords[betterIndex + 1];
    if (nextOriginal && nextBetter) {
      const sameNext = normalizePart1Word(nextOriginal) === normalizePart1Word(nextBetter);
      const transcriptTypoNext = isLikelyTranscriptSpellingTokenChange(nextOriginal, nextBetter);
      if (!sameNext && !transcriptTypoNext) continue;
    }
    const context = {
      original: previousOriginal,
      better: `${previousBetter} ${betterWords[betterIndex]}`,
    };
    if (!normalizeTranscriptFormatText(answerText).includes(normalizeTranscriptFormatText(context.original))) return null;
    return {
      original: context.original,
      better: context.better,
      explanationZh: contextSafePart1Explanation(issueType, explanationZh) || 'Preposition choice changes the natural spoken structure.',
    };
  }
  for (let index = 0; index < Math.min(originalWords.length, betterWords.length); index += 1) {
    const original = normalizePart1Word(originalWords[index]);
    const better = normalizePart1Word(betterWords[index]);
    if (!prepositions.has(original) || !prepositions.has(better) || original === better) continue;
    const context = localPart1RepairContext(originalWords, betterWords, index, index, 1, 1);
    if (!context.original || !context.better) return null;
    if (!normalizeTranscriptFormatText(answerText).includes(normalizeTranscriptFormatText(context.original))) return null;
    return {
      original: context.original,
      better: context.better,
      explanationZh: contextSafePart1Explanation(issueType, explanationZh) || 'Preposition choice changes the natural spoken structure.',
    };
  }
  return null;
};

const safeNarrowMixedPart1Repair = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
  answerText: string,
) => {
  if (!hasExplicitPart1SpokenIssue(issueType, explanationZh)) return undefined;
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  if (!/\b(article|determiner|preposition)\b/.test(evidence)) return undefined;
  const originalWords = part1Words(original);
  const betterWords = part1Words(better);
  if (originalWords.length < 2 || betterWords.length < 2) return undefined;

  if (/\bthis\s+kind\s+of\s+opportunit/i.test(original) && normalizeTranscriptFormatText(answerText).includes('this kind of opportunities')) {
    const betterOpportunity = /\bthis\s+kind\s+of\s+opportunity\b/i.test(better)
      ? 'this kind of opportunity'
      : 'those opportunities';
    return {
      original: 'this kind of opportunities',
      better: betterOpportunity,
      explanationZh: 'Keep kind and opportunity consistent: use those opportunities or this kind of opportunity.',
    };
  }

  const hasLikelySpellingToken = originalWords.some(originalWord =>
    betterWords.some(betterWord => isLikelyTranscriptSpellingTokenChange(originalWord, betterWord)),
  );
  if (!hasLikelySpellingToken) return undefined;

  if (/\b(article|determiner)\b/.test(evidence)) {
    return safelyNarrowPart1ArticleRepair(originalWords, betterWords, answerText, issueType, explanationZh);
  }
  if (/\b(preposition)\b/.test(evidence)) {
    return safelyNarrowPart1PrepositionRepair(originalWords, betterWords, answerText, issueType, explanationZh);
  }
  return null;
};

const safeNarrowUnsupportedPart1Repair = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
  answerText: string,
) => {
  if (!containsUnsupportedSpeakingBoundaryClaim(explanationZh)) return undefined;
  if (!hasExplicitPart1SpokenIssue(issueType, explanationZh)) return null;
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  if (!/\b(article|determiner)\b/.test(evidence)) return null;

  const originalWords = part1Words(original);
  const betterWords = part1Words(better);
  if (betterWords.length < originalWords.length + 1) return null;

  for (let insertIndex = 0; insertIndex < betterWords.length; insertIndex += 1) {
    const inserted = normalizePart1Word(betterWords[insertIndex]);
    if (!['a', 'an', 'the'].includes(inserted)) continue;
    const nextOriginal = originalWords[insertIndex];
    const nextBetter = betterWords[insertIndex + 1];
    if (!nextOriginal || !nextBetter || normalizePart1Word(nextOriginal) !== normalizePart1Word(nextBetter)) continue;
    const previousOriginal = originalWords[insertIndex - 1];
    const previousBetter = betterWords[insertIndex - 1];
    if (previousOriginal && previousBetter && normalizePart1Word(previousOriginal) !== normalizePart1Word(previousBetter)) continue;
    const start = Math.max(0, insertIndex - 1);
    const end = Math.min(originalWords.length, insertIndex + 1);
    const narrowedOriginal = originalWords.slice(start, end).join(' ');
    const narrowedBetter = betterWords.slice(start, end + 1).join(' ');
    if (!narrowedOriginal || !narrowedBetter) return null;
    if (!normalizeTranscriptFormatText(answerText).includes(normalizeTranscriptFormatText(narrowedOriginal))) return null;
    return {
      original: narrowedOriginal,
      better: narrowedBetter,
      explanationZh: contextSafePart1Explanation(issueType, explanationZh) || 'Article or determiner use changes the spoken grammar of this phrase.',
    };
  }

  return null;
};

const normalizePart1RepairLayer = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
  answerText: string,
) => {
  const polishedBetter = polishPart1RepairText(better);
  if (!original || !polishedBetter || !explanationZh) return null;
  if (isInvalidPart1Repair(original, polishedBetter)) return null;
  if (isStateDependentPart1PresentRepair(original, polishedBetter, issueType, explanationZh)) return null;
  if (isAcceptablePart1RegionalOrStyleVariant(original, polishedBetter, issueType, explanationZh)) {
    return {
      original,
      better: polishedBetter,
      explanationZh: 'This is an optional spoken preference, not a hard grammar error.',
    };
  }
  if (isLikelyTranscriptFormatOnlyLayer(original, polishedBetter, issueType, explanationZh)) return null;
  const originalMixedNarrowed = safeNarrowMixedPart1Repair(original, polishedBetter, issueType, explanationZh, answerText);
  if (originalMixedNarrowed === null) return null;
  if (originalMixedNarrowed) return originalMixedNarrowed;
  const strippedExplanation = stripUnsupportedTranscriptTeaching(explanationZh);
  const safeExplanation = strippedExplanation ||
    (hasExplicitPart1SpokenIssue(issueType, explanationZh)
      ? contextSafePart1Explanation(issueType, explanationZh)
      : '');
  if (!original || !polishedBetter || !safeExplanation) return null;
  if (isInvalidPart1Repair(original, polishedBetter)) return null;
  if (isStateDependentPart1PresentRepair(original, polishedBetter, issueType, safeExplanation)) return null;
  if (isLikelyTranscriptFormatOnlyLayer(original, polishedBetter, issueType, safeExplanation)) return null;
  const narrowed = safeNarrowUnsupportedPart1Repair(original, polishedBetter, issueType, safeExplanation, answerText);
  if (narrowed === null) return null;
  if (narrowed) return narrowed;
  const mixedNarrowed = safeNarrowMixedPart1Repair(original, polishedBetter, issueType, safeExplanation, answerText);
  if (mixedNarrowed === null) return null;
  if (mixedNarrowed) return mixedNarrowed;
  if (containsUnsupportedSpeakingBoundaryClaim(safeExplanation)) return null;
  return {
    original,
    better: polishedBetter,
    explanationZh: hasOverAbsoluteContextDependentClaim(safeExplanation)
      ? contextSafePart1Explanation(issueType, safeExplanation, polishedBetter) || safeExplanation
    : safeExplanation,
  };
};

const normalizeSharedSpeakingRepairLayer = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
  transcriptOrAnswer: string,
) => normalizePart1RepairLayer(original, better, issueType, explanationZh, transcriptOrAnswer);

const isSystemSpeakingFatalIssue = (tag: string) =>
  /\b(prompt_mismatch|insufficient_sample|sample|length|under.?developed|off.?task)\b/i.test(tag);

const normalizeSharedSpeakingFatalError = (
  item: FatalError,
  transcript: string,
): FatalError | null => {
  if (isSystemSpeakingFatalIssue(item.tag)) return item;
  const repair = normalizeSharedSpeakingRepairLayer(
    item.original,
    item.correction,
    item.tag || 'speaking_issue',
    item.explanationZh,
    transcript,
  );
  if (!repair) return null;
  return {
    ...item,
    original: repair.original,
    correction: repair.better,
    explanationZh: repair.explanationZh,
  };
};

const normalizeSharedSpeakingNaturalnessHint = (
  item: NaturalnessHint,
  transcript: string,
): NaturalnessHint | null => {
  const repair = normalizeSharedSpeakingRepairLayer(
    item.original,
    item.better,
    item.tag || 'naturalness',
    item.explanationZh,
    transcript,
  );
  if (!repair) return null;
  return {
    ...item,
    original: repair.original,
    better: repair.better,
    explanationZh: repair.explanationZh,
  };
};

const isInvalidPart1Repair = (original: string, better: string) => {
  const source = normalizeTranscriptFormatText(original);
  const repair = normalizeTranscriptFormatText(better);
  if (!source || !repair || source === repair) return true;
  if (/\bconsider as\b/.test(source) && /\bconsider is\b/.test(repair)) return true;
  if ((/\bhand make\b|\bhandmake\b/.test(source)) && !(/\bby hand\b|\bhandmade\b/.test(repair))) return true;
  if (/\bplaces?\s+where\b/.test(repair) && /\bthere\b/.test(repair)) return true;
  if (/\bwhere i enjoy eating there\b/.test(repair)) return true;
  if (/\bhand make\b|\bhandmake\b/.test(repair)) return true;
  if (/\bkeen on eating\b/.test(repair) && !/\bkeen on eating (?:at|in)\b/.test(repair)) return true;
  return false;
};

const isStateDependentPart1PresentRepair = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
) => {
  const source = normalizeTranscriptFormatText(original);
  const repair = normalizeTranscriptFormatText(better);
  const evidence = normalizeTranscriptFormatText(`${issueType} ${explanationZh}`);
  const reportedSpeech = /\b(knew|thought|said|told|mentioned|realized|noticed|found|felt)\s+that\b/.test(source);
  const presentState = /\b(i|he|she|they|we)\s+(am|is|are)\b/.test(source);
  const backshift = /\b(i|he|she|they|we)\s+(was|were)\b/.test(repair);
  const tenseClaim = /\b(reported speech|tense|backshift|sequence of tense)\b/.test(evidence);
  const endedState = /\b(dead|ended|finished|over|no longer|used to)\b/.test(source);
  return reportedSpeech && presentState && backshift && tenseClaim && !endedState;
};

const containsUnsupportedSpeakingBoundaryClaim = (text: string | undefined) => {
  const normalized = normalizeTranscriptFormatText(text || '');
  if (!normalized) return false;
  const unsupportedArea = /\b(spelling|spell|capitalization|uppercase|lowercase|punctuation|spacing|orthography|transcription|asr|homophone)\b/.test(normalized);
  const hasPronunciationMention = /\b(pronunciation|pronounce|pronouncing)\b/.test(normalized);
  const allowedPronunciationNote = /\b(not formally assessed|not assessed|excluding pronunciation)\b/.test(normalized);
  const unsupportedPronunciation = hasPronunciationMention && !allowedPronunciationNote;
  const unsupportedPronunciationZh = false;
  return unsupportedArea || unsupportedPronunciation || unsupportedPronunciationZh;
};

const sanitizePart1FeedbackText = (text: string | undefined, fallback = '') => {
  const clean = optionalSafeString(text);
  if (!clean) return fallback || undefined;
  const stripped = stripUnsupportedTranscriptTeaching(clean);
  if (stripped) return hasOverAbsoluteContextDependentClaim(stripped)
    ? 'This wording is more natural in this answer; the rule depends on meaning and context.'
    : stripped;
  return containsUnsupportedSpeakingBoundaryClaim(clean) ? (fallback || undefined) : clean;
};

const polishPart1RepairText = (text: string) =>
  safeLearningText(text)
    .replace(/\brecommend you to\b/gi, 'recommend that you')
    .replace(/\bmiddle-sized\b/gi, 'medium-sized')
    .trim();

const exactQuoteInAnswer = (quote: string) => {
  const cleanQuote = safeLearningText(quote).trim();
  return cleanQuote;
};

const isBarePart1Starter = (text: string) => {
  const compact = normalizeTranscriptFormatText(text).replace(/['.?!,;]/g, '');
  return /^(yes of course|of course|it depends|i think|i would say|in my opinion|for example|actually|basically|well|thats an interesting question|that is an interesting question|thats a good question|that is a good question)$/.test(compact);
};

const isLowValuePart1Material = (text: string) => {
  const normalized = normalizeTranscriptFormatText(text);
  const compact = normalized.replace(/['.?!,;]/g, '');
  const wordCount = compact.split(/\s+/).filter(Boolean).length;
  if (!normalized) return true;
  if (isBarePart1Starter(normalized)) return true;
  if (/^(yes|yeah|no|sure|definitely|absolutely|of course|not really)$/i.test(compact)) return true;
  if (/^my hometown is [a-z]+$/i.test(compact)) return true;
  if (/^i (am|'m) from [a-z]+$/i.test(compact)) return true;
  if (/^it is a (small|medium|large|big|coastal|modern|beautiful|nice|old|new)( sized)? city$/i.test(compact)) return true;
  if (/^it is a [a-z-]+ [a-z-]+ city$/i.test(compact)) return true;
  if (wordCount < 3) return true;
  const hasPersonalSignal = /\b(i|im|ive|id|me|my|mine|we|were|weve|our|us)\b/.test(compact);
  if (!hasPersonalSignal) return true;
  if (/^(it is|this is|there is|there are|people|many people|some people)\b/.test(compact) && !/\b(my|our|where i|when i|i usually|i often|i grew|i live|i study|i work|i prefer|i like|i enjoy|we usually|we often)\b/.test(compact)) return true;
  return false;
};

const isGroundedInPart1Answers = (
  text: string | undefined,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
) => {
  const normalized = normalizeTranscriptFormatText(text || '');
  if (!normalized) return false;
  return answers.some(answer => normalizeTranscriptFormatText(answer.answer).includes(normalized));
};

const PART1_MATERIAL_OVERLAP_STOP_WORDS = new Set([
  'about', 'after', 'again', 'also', 'answer', 'because', 'before', 'being', 'could', 'every', 'from',
  'have', 'just', 'like', 'more', 'most', 'much', 'really', 'should', 'some', 'than', 'that', 'their',
  'there', 'these', 'they', 'this', 'those', 'through', 'usually', 'very', 'where', 'which', 'with',
  'would', 'your',
]);

const part1MaterialOverlapWords = (text = '') =>
  Array.from(new Set(
    (normalizeTranscriptFormatText(text).match(/[a-z]+(?:'[a-z]+)?|[0-9]+/g) || [])
      .map(word => word.toLowerCase())
      .filter(word => word.length > 3 && !PART1_MATERIAL_OVERLAP_STOP_WORDS.has(word)),
  ));

const hasPart1CurrentThreadMaterialOverlap = (
  text: string,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
) => {
  const materialText = normalizeTranscriptFormatText(text);
  if (!materialText) return false;
  const threadWords = part1MaterialOverlapWords(answers.map(answer => `${answer.question} ${answer.answer}`).join(' '));
  if (!threadWords.length) return false;
  return threadWords.some(word => materialText.includes(word));
};

const hasPart1PersonalMaterialSignal = (text: string) => {
  const normalized = normalizeTranscriptFormatText(text);
  const compact = normalized.replace(/['.?!,;]/g, '');
  const wordCount = compact.split(/\s+/).filter(Boolean).length;
  if (!compact) return false;
  const hasPersonalSignal = /\b(i|im|ive|id|me|my|mine|we|were|weve|our|us|where i|when i)\b/.test(compact);
  const hasRecoverableIdea =
    /\b(because|so|although|though|but|rather than|instead of|prefer|like|enjoy|miss|missed|feel|felt|reason|mainly|what i|why i|helps me|want|need|usually|often|sometimes|always|never|used to|would|personally|taste|style|habit|routine|family|friend|girlfriend|boyfriend|partner)\b/.test(compact) ||
    /\b(years?|months?|weeks?|college|university|school|childhood|team|club|competition|match|game|trip|visit|moved|returned|grew up|born|raised|lived|studied|worked|learned|gift|present|album|photo|photos|polaroid|anniversary|birthday|handmade|souvenir|point guard|captain|member|teammate|classmate|roommate|teacher|coach|project|exam|event|practice|training|nba|e-?sports?)\b/.test(compact);
  return hasPersonalSignal && wordCount >= 3 && (hasRecoverableIdea || wordCount >= 5);
};

const isOrdinaryPart1FactMaterial = (item: SpeakingMaterialBankItem) => {
  const text = normalizeTranscriptFormatText(`${item.materialCore || ''} ${item.sourceWording || ''} ${item.reusableVersion || ''}`);
  const compact = text.replace(/['.?!,;]/g, '').replace(/\s+/g, ' ').trim();
  if (!compact) return true;
  if (/^(yes|yeah|no|sure|definitely|absolutely|of course|not really)$/i.test(compact)) return true;
  if (/^my hometown is [a-z]+(?: i was born and raised here)?$/i.test(compact)) return true;
  if (/^it is a [a-z-]+(?: [a-z-]+){0,2} city$/i.test(compact)) return true;
  if (/^(xiamen|beijing|shanghai|guangzhou|shenzhen)$/i.test(compact)) return true;
  return false;
};

const isValidGroundedPart1PersonalMaterial = (
  item: SpeakingMaterialBankItem,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
) => {
  const source = item.sourceWording || '';
  const reusable = item.reusableVersion || '';
  const displayText = `${source} ${reusable} ${item.developedExample || ''} ${item.materialCore || ''}`;
  if (!reusable || !item.reuseFor.length || containsUnsupportedSpeakingBoundaryClaim(reusable)) return false;
  const hasGroundedAnchor = [source, item.materialCore, reusable].some(candidate => isGroundedInPart1Answers(candidate, answers));
  if (!hasGroundedAnchor && !hasPart1CurrentThreadMaterialOverlap(displayText, answers)) return false;
  if (isOrdinaryPart1FactMaterial(item)) return false;
  if (isLowValuePart1Material(source || reusable) && !hasPart1PersonalMaterialSignal(displayText)) return false;
  return hasPart1PersonalMaterialSignal(displayText);
};

const normalizePart1MaterialKind = (
  value: unknown,
  item: Pick<SpeakingMaterialBankItem, 'sourceWording' | 'reusableVersion' | 'developedExample' | 'developmentMoveZh' | 'expressionFrames'>,
): SpeakingMaterialBankItem['materialKind'] => {
  if (value === 'development_seed' || value === 'reusable_personal_material') return value;
  const text = `${item.sourceWording || ''} ${item.reusableVersion || ''} ${item.developedExample || ''}`;
  if (!item.developedExample && item.developmentMoveZh && item.expressionFrames?.length) return 'development_seed';
  return hasPart1PersonalMaterialSignal(text)
    ? 'reusable_personal_material'
    : 'development_seed';
};

const isValidPart1DevelopmentSeed = (
  item: SpeakingMaterialBankItem,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
) => {
  const source = item.sourceWording || item.reusableVersion;
  if (!source || containsUnsupportedSpeakingBoundaryClaim(source)) return false;
  if (!isGroundedInPart1Answers(source, answers)) return false;
  if (!item.developmentMoveZh && !item.expressionFrames?.length) return false;
  return Boolean(item.materialCore || item.expressionFrames?.length);
};

const part1MaterialValueRank = (item: SpeakingMaterialBankItem) => {
  if (item.materialKind === 'development_seed') return 0;
  const text = normalizeTranscriptFormatText(`${item.materialCore || ''} ${item.sourceWording || ''} ${item.reusableVersion || ''} ${item.developedExample || ''}`);
  let score = 0;
  if (/\b(school|college|university|team|club|competition|match|game|practice|training|experience|used to|joined|played)\b/.test(text)) score += 30;
  if (/\b(role|captain|member|point guard|teammate|coach|position)\b/.test(text)) score += 24;
  if (/\b(nba|cs2|dota|esports?|watch|viewing|stream)\b/.test(text)) score += 20;
  if (/\b(prefer|rather than|instead of|depends|when i|if i|as long as|condition)\b/.test(text)) score += 16;
  if (/\b(family|friend|friends|support network|belonging|close to)\b/.test(text)) score += 12;
  if (/\b(energy|passion|motivation|excited|happy|relaxed)\b/.test(text)) score += 4;
  if (!hasPart1PersonalMaterialSignal(text)) score -= 20;
  if (isOrdinaryPart1FactMaterial(item)) score -= 30;
  return score;
};

const isLowValueReusableSpokenLanguage = (text: string) => {
  const normalized = normalizeTranscriptFormatText(text);
  const compact = normalized.replace(/['.?!,;]/g, '');
  const wordCount = compact.split(/\s+/).filter(Boolean).length;
  const hasSlot = /\[[^\]]+\]/.test(normalized);
  const expressiveFrame = /\b(?:interested|keen|fond|drawn|open|attached|suited)\s+(?:to|on|of|for)\b|\b(?:matters?|comes?|fits?|suits?|depends?|changes?|evolves?|lasts?)\b|\b(?:comfort|taste|style|routine|habit|priority|preference|budget|quality|function|design)\b/i.test(compact);
  if (!normalized) return true;
  if (isBarePart1Starter(normalized)) return true;
  if (/^(yes|yeah|no|sure|maybe|probably|absolutely|definitely)$/i.test(compact)) return true;
  if (/^(because|for example|a specific reason|one reason|one example|one detail|some detail|a concrete personal reason|a clearer personal feeling|a simple but useful contrast|one memorable supporting detail|comfortable to wear|good for me|nice place|big mall|quiet place|relaxed place|quiet and relaxed place|that is one reason|a great way|said good vocabulary|find a peaceful spot|a popular tourist destination|commute during rush hour|heavy traffic congestion|overwhelming numbers of people visiting|for college for university|for university for college|for college|for university)$/i.test(compact)) return true;
  if (/^(which|that|where|when|because|for example)\b/i.test(compact)) return true;
  if (/\b(?:because|after|before|when|where|which|that|if|so|and|but|to|for|with|about|said|required)\s*$/i.test(compact)) return true;
  if (/^\[[^\]]+\]$/.test(normalized)) return true;
  if (wordCount > 12) return true;
  if (/^(it|this|that|there)\s+(?:is|was|are|were|required|helps?)\b/i.test(compact) && !hasSlot && !expressiveFrame) return true;
  if (/^(?:do|did|doing|done) a good job$|^play as a team$|^encourage someone$|^encourage teammates$|^(?:win|won) a scholarship(?: at university)?$|^presentation went well$|^went well$|^prepare a final presentation in english$|^learn vocabulary about\b/i.test(compact)) return true;
  const hasTransferableFrame = hasSlot ||
    /\b(be|being|been|have|having|had|get|make|take|give|keep|hold|come|go|feel|look|sound|turn|end|tend|put|choose|spend|buy|purchase|send|receive|watch|play|practice|use|visit|shop|wear|invest|used to|keen on|into|look forward to|rather than|instead of|compared with|compared to|in contrast|in terms of|when it comes to|as long as|from time to time|every now and then|a [a-z]+ (?:of|for|with|to)|the [a-z]+ (?:of|for|with|to))\b/.test(compact);
  if (/^(i|im|i am|ive|i have|id|i would|my|we|were|we are|weve|we have|our)\b/.test(compact) && !hasTransferableFrame && !expressiveFrame) return true;
  if (/^(it is|this is|there is|there are)\b/.test(compact) && wordCount > 6) return true;
  if (!hasTransferableFrame && !expressiveFrame && wordCount < 2) return true;
  return false;
};

const isCorrectionLikePart1DevelopmentPurpose = (text = '') =>
  /修正|改正|纠正|错误|错|语法|单复数|冠词|介词|时态|替代|替换|换掉|改为|改成|correct|correction|fix|repair|replace|instead of|grammar|plural|singular|article|preposition|tense|mistake|error/i.test(text);

const sanitizePart1DevelopmentPurpose = (text: string | undefined) => {
  const clean = sanitizePart1FeedbackText(text);
  return clean && !isCorrectionLikePart1DevelopmentPurpose(clean) ? clean : undefined;
};

const part1AnnotationKeyText = (text: string) =>
  normalizeTranscriptFormatText(text).replace(/[^a-z0-9]+/g, ' ').trim();

const part1SeverityRank: Record<Part1AnnotationSeverity, number> = {
  must_fix: 3,
  better_spoken_choice: 2,
  optional_polish: 1,
};

const strongestPart1Severity = (a: Part1AnnotationSeverity, b: Part1AnnotationSeverity) =>
  part1SeverityRank[a] >= part1SeverityRank[b] ? a : b;

const part1LayerRepairKey = (questionRef: string, layer: Part1AnswerAnnotationLayer) =>
  `${questionRef}::${part1AnnotationKeyText(layer.original)}::${part1AnnotationKeyText(layer.better)}`;

const textKeyContains = (container: string, contained: string) => {
  const containerKey = part1AnnotationKeyText(container);
  const containedKey = part1AnnotationKeyText(contained);
  return Boolean(containerKey && containedKey && containerKey.includes(containedKey));
};

const isAcceptablePart1RegionalOrStyleVariant = (
  original: string,
  better: string,
  issueType: string,
  explanationZh: string,
) => {
  const originalText = normalizeTranscriptFormatText(original);
  const betterText = normalizeTranscriptFormatText(better);
  const teamVariant = /\b(in|on)\s+(a\s+|the\s+|my\s+|our\s+|their\s+)?team\b/;
  if (teamVariant.test(originalText) && teamVariant.test(betterText)) {
    const withoutPrep = (text: string) => text.replace(/\b(in|on)\s+((?:a|the|my|our|their)\s+)?team\b/g, '$2team');
    return withoutPrep(originalText) === withoutPrep(betterText);
  }
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  if (!/\b(preposition|collocation|word choice|natural|regional|variant|style)\b/.test(evidence)) return false;
  return false;
};

const isPart1TeamVariantAdviceText = (text: string | undefined) => {
  const normalized = normalizeTranscriptFormatText(text || '');
  if (!normalized) return false;
  const hasInTeam = /\bin\s+(?:a\s+|the\s+|my\s+|our\s+|their\s+)?team\b/.test(normalized);
  const hasOnTeam = /\bon\s+(?:a\s+|the\s+|my\s+|our\s+|their\s+)?team\b/.test(normalized);
  const hasSlashTeam = /\bin\s*\/\s*on\s+(?:a\s+|the\s+|my\s+|our\s+|their\s+)?team\b/.test(normalized);
  const adviceText = `${normalized} ${text || ''}`;
  const hasHardAdvice =
    /\b(preposition|collocation|correct|wrong|must|fix|instead|use|better|vs|hard error)\b/.test(adviceText) ||
    /->|preposition|collocation|correct|wrong|must|fix|instead|use|better|vs|hard error/.test(adviceText) ||
    /\?{2,}.*\b(?:in|on)\s+(?:a\s+|the\s+|my\s+|our\s+|their\s+)?team\b|\b(?:in|on)\s+(?:a\s+|the\s+|my\s+|our\s+|their\s+)?team\b.*\?{2,}/.test(adviceText);
  if ((hasInTeam && hasOnTeam) || ((hasInTeam || hasOnTeam || hasSlashTeam) && hasHardAdvice)) return true;
  if (!hasInTeam || !hasOnTeam) return false;
  return /\b(preposition|collocation|correct|wrong|must|fix|instead|use|better|vs)\b|->/.test(`${normalized} ${text || ''}`);
};

const sanitizePart1TeamVariantAdviceText = (text: string | undefined) =>
  isPart1TeamVariantAdviceText(text) ? undefined : text;

const part1RetryReferenceByQuestion = (retryReference?: Part1RetryReferenceContext) =>
  new Map((retryReference?.cleanRetryAnswers || []).map(item => [item.questionRef, item] as const));

const isGroundedPreviousCleanerConflict = (
  questionRef: string,
  sourceQuote: string,
  layerOriginal: string,
  layerBetter: string,
  answerText: string,
  retryReference?: Part1RetryReferenceContext,
) => {
  const prior = part1RetryReferenceByQuestion(retryReference).get(questionRef);
  if (!prior) return false;
  const source = sourceQuote || layerOriginal;
  const sourceKey = part1AnnotationKeyText(source);
  const originalKey = part1AnnotationKeyText(layerOriginal);
  const betterKey = part1AnnotationKeyText(layerBetter);
  const answerKey = part1AnnotationKeyText(answerText);
  const priorKey = part1AnnotationKeyText(prior.answer);
  const includesTokenPhrase = (container: string, phrase: string) =>
    new RegExp(`(?:^| )${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?: |$)`).test(container);
  if (
    betterKey &&
    betterKey !== originalKey &&
    betterKey.split(' ').filter(Boolean).length >= 3 &&
    includesTokenPhrase(priorKey, betterKey)
  ) {
    return false;
  }
  const candidateKeys = [sourceKey, originalKey].filter(Boolean);
  return candidateKeys.some(key =>
    key.split(' ').filter(Boolean).length >= 3 &&
    includesTokenPhrase(answerKey, key) &&
    includesTokenPhrase(priorKey, key),
  );
};

const withPart1PreviousCleanerConflictAttribution = (
  layer: Part1AnswerAnnotationLayer,
  questionRef: string,
  sourceQuote: string,
  answerText: string,
  retryReference?: Part1RetryReferenceContext,
): Part1AnswerAnnotationLayer => {
  if (layer.severity !== 'must_fix') return layer;
  const isConflict = isGroundedPreviousCleanerConflict(questionRef, sourceQuote, layer.original, layer.better, answerText, retryReference);
  if (!isConflict) {
    return layer.origin === 'previous_cleaner_answer_conflict'
      ? {
        ...layer,
        origin: 'learner',
        priorCertificationStatus: undefined,
        systemRevisionNoteZh: undefined,
      }
      : layer;
  }
  const prior = part1RetryReferenceByQuestion(retryReference).get(questionRef);
  return {
    ...layer,
    origin: 'previous_cleaner_answer_conflict',
    priorCertificationStatus: layer.priorCertificationStatus || prior?.certificationStatus,
    systemRevisionNoteZh: layer.systemRevisionNoteZh || PREVIOUS_CLEANER_CONFLICT_NOTE_ZH,
  };
};

const mergePart1AnswerAnnotations = (
  providerAnnotations: Part1AnswerAnnotation[],
  fallbackAnnotations: Part1AnswerAnnotation[],
  ...extraAnnotationGroups: Part1AnswerAnnotation[][]
) => {
  const merged: Part1AnswerAnnotation[] = [];
  const representedLayers = new Map<string, Part1AnswerAnnotationLayer>();
  const dedupeLayers = (questionRef: string, layers: Part1AnswerAnnotationLayer[]) => {
    const byRepair = new Map<string, Part1AnswerAnnotationLayer>();
    layers.forEach(layer => {
      const key = part1LayerRepairKey(questionRef, layer);
      const existing = byRepair.get(key);
      if (!existing) {
        byRepair.set(key, { ...layer });
        return;
      }
      existing.severity = strongestPart1Severity(existing.severity, layer.severity);
      existing.explanationZh = existing.explanationZh || layer.explanationZh;
      existing.reuseGuidanceZh = existing.reuseGuidanceZh || layer.reuseGuidanceZh;
      existing.origin = existing.origin === 'previous_cleaner_answer_conflict' || layer.origin === 'previous_cleaner_answer_conflict'
        ? 'previous_cleaner_answer_conflict'
        : existing.origin || layer.origin;
      existing.priorCertificationStatus = existing.priorCertificationStatus || layer.priorCertificationStatus;
      existing.systemRevisionNoteZh = existing.systemRevisionNoteZh || layer.systemRevisionNoteZh;
    });
    return Array.from(byRepair.values());
  };
  const findRepresentedLayer = (
    questionRef: string,
    layer: Part1AnswerAnnotationLayer,
    sourceQuote: string,
    combinedRepair?: string,
  ) => {
    const exact = representedLayers.get(part1LayerRepairKey(questionRef, layer));
    if (exact) return exact;
    const originalKey = part1AnnotationKeyText(layer.original);
    const betterKey = part1AnnotationKeyText(layer.better);
    if (!originalKey || !betterKey) return undefined;
    return merged
      .filter(annotation => annotation.questionRef === questionRef)
      .flatMap(annotation => annotation.layers.map(existingLayer => ({ annotation, existingLayer })))
      .find(({ annotation, existingLayer }) => {
        const existingOriginalKey = part1AnnotationKeyText(existingLayer.original);
        const existingBetterKey = part1AnnotationKeyText(existingLayer.better);
        const sameRepair = existingOriginalKey === originalKey && existingBetterKey === betterKey;
        if (sameRepair) return true;
        const sourceIsCovered = textKeyContains(annotation.sourceQuote, layer.original) ||
          textKeyContains(sourceQuote, existingLayer.original);
        const repairIsCovered = existingBetterKey === betterKey ||
          textKeyContains(existingLayer.better, layer.better) ||
          textKeyContains(annotation.combinedRepair || '', layer.better) ||
          textKeyContains(combinedRepair || '', existingLayer.better);
        return sourceIsCovered && repairIsCovered;
      })?.existingLayer;
  };
  const addAnnotation = (annotation: Part1AnswerAnnotation) => {
    const sourceKey = `${annotation.questionRef}::${part1AnnotationKeyText(annotation.sourceQuote)}`;
    if (!part1AnnotationKeyText(annotation.sourceQuote)) return;
    const incomingLayers = dedupeLayers(annotation.questionRef, annotation.layers)
      .filter(layer => {
        const represented = findRepresentedLayer(annotation.questionRef, layer, annotation.sourceQuote, annotation.combinedRepair);
        if (!represented) return true;
        represented.severity = strongestPart1Severity(represented.severity, layer.severity);
        represented.origin = represented.origin === 'previous_cleaner_answer_conflict' || layer.origin === 'previous_cleaner_answer_conflict'
          ? 'previous_cleaner_answer_conflict'
          : represented.origin || layer.origin;
        represented.priorCertificationStatus = represented.priorCertificationStatus || layer.priorCertificationStatus;
        represented.systemRevisionNoteZh = represented.systemRevisionNoteZh || layer.systemRevisionNoteZh;
        return false;
      });
    if (!incomingLayers.length) return;
    const existing = merged.find(item => `${item.questionRef}::${part1AnnotationKeyText(item.sourceQuote)}` === sourceKey);
    if (!existing) {
      merged.push({
        ...annotation,
        layers: incomingLayers,
      });
      incomingLayers.forEach(layer => representedLayers.set(part1LayerRepairKey(annotation.questionRef, layer), layer));
      return;
    }
    incomingLayers.forEach(layer => {
      const represented = findRepresentedLayer(annotation.questionRef, layer, annotation.sourceQuote, annotation.combinedRepair);
      if (represented) {
        represented.severity = strongestPart1Severity(represented.severity, layer.severity);
        represented.origin = represented.origin === 'previous_cleaner_answer_conflict' || layer.origin === 'previous_cleaner_answer_conflict'
          ? 'previous_cleaner_answer_conflict'
          : represented.origin || layer.origin;
        represented.priorCertificationStatus = represented.priorCertificationStatus || layer.priorCertificationStatus;
        represented.systemRevisionNoteZh = represented.systemRevisionNoteZh || layer.systemRevisionNoteZh;
        return;
      }
      existing.layers.push(layer);
      representedLayers.set(part1LayerRepairKey(annotation.questionRef, layer), layer);
    });
    existing.combinedRepair = existing.combinedRepair || annotation.combinedRepair;
  };
  providerAnnotations.forEach(addAnnotation);
  fallbackAnnotations.forEach(addAnnotation);
  extraAnnotationGroups.flat().forEach(addAnnotation);
  return merged.filter(item => item.layers.length);
};

const isPart1PointGuardAbbreviationRepair = (original: string, better: string) => {
  const originalKey = normalizeTranscriptFormatText(original);
  const betterKey = normalizeTranscriptFormatText(better);
  return /\bpg\b/.test(originalKey) && /\bpoint guard\b/.test(betterKey);
};

const normalizePointGuardAbbreviationLayer = (
  layer: Part1AnswerAnnotationLayer,
): Part1AnswerAnnotationLayer => ({
  ...layer,
  severity: 'better_spoken_choice',
  issueType: 'abbreviation clarity',
  original: 'pg',
  better: 'point guard',
  explanationZh: 'In spoken practice, saying point guard directly is clearer.',
  reuseGuidanceZh: undefined,
});

const isLikelyOptionalCleanerConflict = (
  layer: Part1AnswerAnnotationLayer,
  cleanerAnswer: string | undefined,
) => {
  if (!cleanerAnswer || layer.severity === 'must_fix') return false;
  const cleanerKey = normalizeTranscriptFormatText(cleanerAnswer);
  const betterKey = normalizeTranscriptFormatText(layer.better);
  if (!betterKey || cleanerKey.includes(betterKey)) return false;
  const evidence = `${layer.issueType} ${layer.explanationZh} ${layer.original} ${layer.better}`.toLowerCase();
  return /\b(optional|polish|natural|spoken choice|preposition|article|point guard|team)\b/.test(evidence);
};

const resolvePart1AnnotationCleanerConsistency = (
  annotations: Part1AnswerAnnotation[],
  cleanRetryAnswers: Part1CleanRetryAnswer[],
  diagnostics?: Part1AnnotationDiagnostics,
) => {
  const cleanerByQuestion = new Map(cleanRetryAnswers.map(answer => [answer.questionRef, answer.answer] as const));
  return annotations
    .map(annotation => {
      const cleanerAnswer = cleanerByQuestion.get(annotation.questionRef);
      const layers = annotation.layers
        .map(layer => {
          if (isPart1PointGuardAbbreviationRepair(layer.original, layer.better) ||
            (/\bpoint guard|pg\b/i.test(`${layer.original} ${layer.better}`) && /\bas a point guard\b/i.test(cleanerAnswer || ''))) {
            diagnostics && (diagnostics.cleanerConflictsResolved += 1);
            return normalizePointGuardAbbreviationLayer(layer);
          }
          if (isLikelyOptionalCleanerConflict(layer, cleanerAnswer)) {
            diagnostics && (diagnostics.cleanerConflictsFound += 1);
            diagnostics && (diagnostics.cleanerConflictsResolved += 1);
            return null;
          }
          return layer;
        })
        .filter((layer): layer is Part1AnswerAnnotationLayer => Boolean(layer));
      return {
        ...annotation,
        layers,
        combinedRepair: annotation.combinedRepair && cleanerAnswer
          ? annotation.combinedRepair
          : annotation.combinedRepair,
      };
    })
    .filter(annotation => annotation.layers.length);
};

const normalizePart1AnswerAnnotations = (
  value: unknown,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  validationErrors: string[],
  retryReference?: Part1RetryReferenceContext,
  diagnostics?: Part1AnnotationDiagnostics,
): Part1AnswerAnnotation[] => asArray(value, 'threadFeedback.annotations', validationErrors).map((item, index) => {
  const record = isRecord(item) ? item : {};
  if (!isRecord(item)) validationErrors.push(`threadFeedback.annotations[${index}] missing or invalid object`);
  const questionRef = normalizeQuestionRefs(record.questionRef ? [record.questionRef] : record.questionRefs, answers)[0] || 'Q1';
  const sourceQuote = exactQuoteInAnswer(asString(record.sourceQuote ?? record.original, '', `threadFeedback.annotations[${index}].sourceQuote`, validationErrors));
  const answerIndex = Number(questionRef.replace(/^Q/i, '')) - 1;
  const answerText = answers[answerIndex]?.answer || '';
  const rawLayers = asArray(record.layers, `threadFeedback.annotations[${index}].layers`, validationErrors);
  const layers = rawLayers
    .map((layer, layerIndex): Part1AnswerAnnotationLayer | null => {
      const layerRecord = isRecord(layer) ? layer : {};
      if (!isRecord(layer)) validationErrors.push(`threadFeedback.annotations[${index}].layers[${layerIndex}] missing or invalid object`);
      if (!optionalSafeString(layerRecord.better ?? layerRecord.correction)) {
        diagnostics && (diagnostics.incompleteLayersDropped += 1);
        return null;
      }
      const severity = normalizePart1AnnotationSeverity(layerRecord.severity);
      const original = safeLearningText(asString(layerRecord.original ?? sourceQuote, sourceQuote || FALLBACK_TEXT, `threadFeedback.annotations[${index}].layers[${layerIndex}].original`, validationErrors));
      const better = safeLearningText(asString(layerRecord.better ?? layerRecord.correction, FALLBACK_TEXT, `threadFeedback.annotations[${index}].layers[${layerIndex}].better`, validationErrors));
      const explanationZh = safeLearningText(asString(layerRecord.explanationZh, 'Provider feedback was incomplete; this item was normalized safely.', `threadFeedback.annotations[${index}].layers[${layerIndex}].explanationZh`, validationErrors));
      const issueType = safeLearningText(asString(layerRecord.issueType ?? severity, severity, `threadFeedback.annotations[${index}].layers[${layerIndex}].issueType`, validationErrors));
      const repair = normalizePart1RepairLayer(original, better, issueType, explanationZh, answerText);
      if (!repair) return null;
      const layerGroundedInAnswer = textKeyContains(answerText, repair.original);
      const sourceGroundedInAnswer = textKeyContains(answerText, sourceQuote);
      if (!layerGroundedInAnswer && !sourceGroundedInAnswer) return null;
      const unsafeContextDependentTeaching = severity === 'must_fix' &&
        hasOverAbsoluteContextDependentClaim(explanationZh) &&
        /\b(collocation|word choice|natural|countability|article)\b/.test(`${issueType} ${explanationZh}`.toLowerCase());
      const calibratedSeverity = calibratePart1AnnotationSeverity(severity, issueType, repair.explanationZh, repair.original, repair.better);
      if (severity === 'must_fix' && calibratedSeverity !== 'must_fix') {
        diagnostics && (diagnostics.severityDowngradedFromMustFix += 1);
      }
      const safeSeverity = (severity === 'must_fix' && isAcceptablePart1RegionalOrStyleVariant(repair.original, repair.better, issueType, repair.explanationZh)) ||
        unsafeContextDependentTeaching
        ? 'better_spoken_choice'
        : calibratedSeverity;
      const builtLayer: Part1AnswerAnnotationLayer = isPart1PointGuardAbbreviationRepair(repair.original, repair.better)
        ? normalizePointGuardAbbreviationLayer({
          severity: safeSeverity,
          issueType,
          original: repair.original,
          better: repair.better,
          explanationZh: repair.explanationZh,
        })
        : {
        severity: safeSeverity,
        issueType,
        original: repair.original,
        better: repair.better,
        explanationZh: repair.explanationZh,
        reuseGuidanceZh: sanitizePart1FeedbackText(optionalSafeString(layerRecord.reuseGuidanceZh)),
        origin: normalizePart1AnnotationOrigin(layerRecord.origin),
        priorCertificationStatus: normalizePart1DisplayedCertificationStatus(layerRecord.priorCertificationStatus),
        systemRevisionNoteZh: sanitizePart1FeedbackText(optionalSafeString(layerRecord.systemRevisionNoteZh)),
      };
      return withPart1PreviousCleanerConflictAttribution(builtLayer, questionRef, sourceQuote, answerText, retryReference);
    })
    .filter((layer): layer is Part1AnswerAnnotationLayer => Boolean(layer));
  const safeSourceQuote = rawLayers.length > layers.length && layers.length === 1 && textKeyContains(sourceQuote, layers[0].original)
    ? layers[0].original
    : sourceQuote;
  return {
    id: optionalSafeString(record.id) || `p1_ann_${questionRef}_${index + 1}`,
    questionRef,
    sourceQuote: safeSourceQuote,
    layers,
    combinedRepair: optionalSafeString(record.combinedRepair) ? polishPart1RepairText(String(record.combinedRepair)) : undefined,
  };
}).filter(item => item.sourceQuote && item.layers.length);

type NormalizedPart2Feedback = NonNullable<SpeakingFeedback['part2Feedback']>;
type NormalizedPart2LanguageSignal = NormalizedPart2Feedback['languageSignals'][number];
type NormalizedPart2AlternativeUpgrade = NonNullable<NormalizedPart2LanguageSignal['alternativeUpgrades']>[number];

const normalizePart2MaterialType = (value: unknown): NormalizedPart2Feedback['materialType'] => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase().replace(/[\s/-]+/g, '_')
    : '';
  if (normalized === 'person') return 'person';
  if (normalized === 'place') return 'place';
  if (normalized === 'object') return 'object';
  if (normalized === 'event' || normalized === 'experience' || normalized === 'experience_event') return 'experience_event';
  if (
    normalized === 'abstract' ||
    normalized === 'opinion' ||
    normalized === 'abstract_experience' ||
    normalized === 'opinion_shaped_experience' ||
    normalized === 'abstract_or_opinion_experience'
  ) return 'abstract_or_opinion_experience';
  return 'unclear';
};

const normalizePart2StoryModuleRole = (value: unknown): NormalizedPart2Feedback['storyModules'][number]['role'] | null => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase().replace(/[\s/-]+/g, '_')
    : '';
  if (normalized === 'what' || normalized === 'who' || normalized === 'where' || normalized === 'what_who_where') return 'what_who_where';
  if (normalized === 'background') return 'background';
  if (normalized === 'details' || normalized === 'concrete_detail' || normalized === 'concrete_details') return 'concrete_details';
  if (normalized === 'event' || normalized === 'action' || normalized === 'what_happened') return 'what_happened';
  if (normalized === 'feeling' || normalized === 'feelings' || normalized === 'how_i_felt') return 'feeling';
  if (normalized === 'meaning' || normalized === 'why_it_matters' || normalized === 'why_it_mattered') return 'why_it_mattered';
  if (normalized === 'influence' || normalized === 'current_influence' || normalized === 'future_influence' || normalized === 'current_or_future_influence') return 'current_or_future_influence';
  return null;
};

const normalizePart2StoryModuleStatus = (value: unknown): NormalizedPart2Feedback['storyModules'][number]['status'] => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase().replace(/[\s/-]+/g, '_')
    : '';
  if (normalized === 'present' || normalized === 'strong') return 'present';
  if (normalized === 'thin' || normalized === 'weak') return 'thin';
  if (normalized === 'missing' || normalized === 'absent') return 'missing';
  if (normalized === 'suggested' || normalized === 'suggested_confirm' || normalized === 'needs_confirmation') return 'suggested_confirm';
  return 'thin';
};

const normalizePart2LanguageSignal = (value: unknown): NormalizedPart2Feedback['languageSignals'][number]['signal'] | null => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase().replace(/[\s/-]+/g, '_')
    : '';
  if (normalized === 'idiom' || normalized === 'idiomatic' || normalized === 'idiomatic_expression') return 'idiomatic_expression';
  if (normalized === 'tense' || normalized === 'timeline') return 'tense';
  if (normalized === 'connector' || normalized === 'transition' || normalized === 'cohesion') return 'connector';
  if (normalized === 'phrasal_verb' || normalized === 'phrasal_verbs') return 'phrasal_verb';
  if (normalized === 'collocation' || normalized === 'collocations') return 'collocation';
  if (normalized === 'clause' || normalized === 'complex_clause' || normalized === 'subordinate_clause') return 'clause';
  return null;
};

const normalizePart2LanguageSignalStatus = (value: unknown): NormalizedPart2Feedback['languageSignals'][number]['status'] => {
  const normalized = typeof value === 'string'
    ? value.toLowerCase().replace(/[\s/-]+/g, '_')
    : '';
  if (normalized === 'strong') return 'strong';
  if (normalized === 'usable' || normalized === 'present') return 'usable';
  if (normalized === 'thin' || normalized === 'weak') return 'thin';
  if (normalized === 'missing' || normalized === 'absent') return 'missing';
  if (normalized === 'not_needed' || normalized === 'not_necessary') return 'not_needed';
  return 'thin';
};

const LOW_VALUE_PART2_CONNECTOR_KEYS = new Set(['and', 'but', 'so', 'also', 'then', 'and then']);

const part2SignalUpgradeKey = (text: string | undefined): string =>
  part1AnnotationKeyText(text || '');

const part2MasteredUpgradeKeys = (items: SpeakingRequest['masteredExpressions'] | undefined): Set<string> =>
  new Set((items || [])
    .map(item => part2SignalUpgradeKey(item.expression))
    .filter(Boolean));

const notePart2SignalRepair = (normalizedFields: string[], field: string) => {
  if (!normalizedFields.includes(field)) normalizedFields.push(field);
};

const hasCjkText = (text: string): boolean =>
  /[\u3400-\u9fff]/.test(text);

const isPart2MetaUpgradeText = (text: string): boolean => {
  const cleaned = safeLearningText(text);
  if (!cleaned) return false;
  if (hasCjkText(cleaned)) return true;

  const lower = cleaned.toLowerCase().trim();
  const grammarLabelPattern =
    /\b(?:connector|transition|tense|timeline|clause|collocation|idiom(?:atic expression)?|phrasal verb|adverb\s*\+\s*adjective|adv\s*\+\s*adj|future influence|past event|present reflection|grammar signal|language signal)\b/i;
  const instructionPattern =
    /^(?:use|add|insert|include|show|demonstrate|provide|create|write|mention|put|try)\b/i;
  const bareLabelPattern =
    /^(?:a\s+|an\s+|the\s+)?(?:connector|transition|tense|timeline|clause|collocation|idiom(?:atic expression)?|phrasal verb|future influence|present reflection|adverb\s*\+\s*adjective|adv\s*\+\s*adj)(?:\b|$)/i;

  return (
    (instructionPattern.test(lower) && grammarLabelPattern.test(lower)) ||
    bareLabelPattern.test(lower) ||
    /\b(?:future|past|present)\s+(?:tense|influence|reflection)\s+(?:clause|frame|with)\b/i.test(lower) ||
    /\b(?:adverb\s*\+\s*adjective|adv\s*\+\s*adj)\s+collocation\b/i.test(lower)
  );
};

const isLowValuePart2ConnectorUpgrade = (
  signal: NormalizedPart2LanguageSignal['signal'],
  upgrade: string,
): boolean =>
  signal === 'connector' && LOW_VALUE_PART2_CONNECTOR_KEYS.has(part2SignalUpgradeKey(upgrade));

const LIKELY_PART2_PHRASAL_PARTICLE_PATTERN =
  /\b(?:about|across|after|along|around|away|back|by|down|for|forward|in|into|off|on|out|over|through|to|together|up|with)\b/i;
const LEADING_LY_MODIFIER_PATTERN =
  /^(?:(?:[A-Za-z][A-Za-z'-]*ly)\s+)+([A-Za-z][A-Za-z'-]*(?:\s+[A-Za-z][A-Za-z'-]*)+)$/;

const narrowPart2PhrasalVerbCore = (
  signal: NormalizedPart2LanguageSignal['signal'],
  value: string,
  normalizedFields: string[],
  field: string,
): string => {
  const cleaned = safeLearningText(value);
  if (signal !== 'phrasal_verb' || !cleaned) return cleaned;
  const match = cleaned.match(LEADING_LY_MODIFIER_PATTERN);
  if (!match) return cleaned;
  const candidate = safeLearningText(match[1]);
  if (
    !candidate ||
    candidate === cleaned ||
    candidate.split(/\s+/).length < 2 ||
    !LIKELY_PART2_PHRASAL_PARTICLE_PATTERN.test(candidate)
  ) {
    return cleaned;
  }
  notePart2SignalRepair(normalizedFields, field);
  return candidate;
};

const SEMANTIC_DEDUPE_PART2_SIGNAL_KEYS = new Set<NormalizedPart2LanguageSignal['signal']>([
  'connector',
  'tense',
  'clause',
]);

const isSamePart2TeachingFrame = (
  signal: NormalizedPart2LanguageSignal['signal'],
  left: string,
  right: string,
): boolean => {
  const leftKey = part2SignalUpgradeKey(left);
  const rightKey = part2SignalUpgradeKey(right);
  if (!leftKey || !rightKey) return false;
  if (leftKey === rightKey) return true;
  if (!SEMANTIC_DEDUPE_PART2_SIGNAL_KEYS.has(signal)) return false;
  if (leftKey.length < 10 || rightKey.length < 10) return false;
  return leftKey.startsWith(rightKey) || rightKey.startsWith(leftKey);
};

const isInvalidPart2SignalUpgrade = (
  signal: NormalizedPart2LanguageSignal['signal'],
  upgrade: string,
): 'lowValueConnector' | 'metaUpgrade' | null => {
  if (!upgrade.trim()) return null;
  if (isLowValuePart2ConnectorUpgrade(signal, upgrade)) return 'lowValueConnector';
  if (isPart2MetaUpgradeText(upgrade)) return 'metaUpgrade';
  return null;
};

const repairPart2SignalTextList = (
  signal: NormalizedPart2LanguageSignal['signal'],
  values: string[],
  blockedKeys: Set<string>,
  blockedUpgradeTexts: string[],
  masteredUpgradeKeys: Set<string>,
  normalizedFields: string[],
): string[] => {
  const seen = new Set(blockedKeys);
  const acceptedUpgradeTexts = [...blockedUpgradeTexts];
  return values
    .map(value => narrowPart2PhrasalVerbCore(
      signal,
      value,
      normalizedFields,
      'part2SignalAlternativeNarrowed:phrasalVerbCore',
    ))
    .filter(Boolean)
    .filter(value => {
      const invalidReason = isInvalidPart2SignalUpgrade(signal, value);
      if (invalidReason) {
        notePart2SignalRepair(normalizedFields, `part2SignalAlternativeRemoved:${invalidReason}`);
        return false;
      }
      const key = part2SignalUpgradeKey(value);
      if (acceptedUpgradeTexts.some(item => isSamePart2TeachingFrame(signal, item, value))) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeRemoved:sameTeachingFrame');
        return false;
      }
      if (masteredUpgradeKeys.has(key)) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeRemoved:masteredExpression');
        return false;
      }
      if (!key || seen.has(key)) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativesDeduped');
        return false;
      }
      seen.add(key);
      acceptedUpgradeTexts.push(value);
      return true;
    })
    .slice(0, 3);
};

const repairPart2AlternativeSampleHighlight = (
  signal: NormalizedPart2LanguageSignal['signal'],
  sampleUpgrade: string | undefined,
  sampleUpgradeHighlight: string | undefined,
  upgrade: string,
  normalizedFields: string[],
): string | undefined => {
  if (!sampleUpgrade) return undefined;
  if (signal === 'phrasal_verb' && upgrade && textKeyContains(sampleUpgrade, upgrade)) {
    if (sampleUpgradeHighlight && part2SignalUpgradeKey(sampleUpgradeHighlight) !== part2SignalUpgradeKey(upgrade)) {
      notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeSampleHighlightNarrowed:phrasalVerbCore');
    }
    return upgrade;
  }
  if (!sampleUpgradeHighlight) return undefined;
  if (textKeyContains(sampleUpgrade, sampleUpgradeHighlight)) return sampleUpgradeHighlight;
  if (upgrade && textKeyContains(sampleUpgrade, upgrade)) {
    notePart2SignalRepair(normalizedFields, 'part2SignalSampleHighlightRepaired');
    return upgrade;
  }
  notePart2SignalRepair(normalizedFields, 'part2SignalSampleHighlightRemoved');
  return undefined;
};

const repairPart2AlternativeUpgrades = (
  signal: NormalizedPart2LanguageSignal['signal'],
  values: NormalizedPart2AlternativeUpgrade[],
  transcript: string,
  blockedKeys: Set<string>,
  blockedUpgradeTexts: string[],
  masteredUpgradeKeys: Set<string>,
  normalizedFields: string[],
): NormalizedPart2AlternativeUpgrade[] => {
  const seen = new Set(blockedKeys);
  const acceptedUpgradeTexts = [...blockedUpgradeTexts];
  return values
    .map((item): NormalizedPart2AlternativeUpgrade | null => {
      const upgrade = narrowPart2PhrasalVerbCore(
        signal,
        item.upgrade,
        normalizedFields,
        'part2SignalAlternativeUpgradeNarrowed:phrasalVerbCore',
      );
      const invalidReason = isInvalidPart2SignalUpgrade(signal, upgrade);
      if (invalidReason) {
        notePart2SignalRepair(normalizedFields, `part2SignalAlternativeUpgradeRemoved:${invalidReason}`);
        return null;
      }

      const upgradeKey = part2SignalUpgradeKey(upgrade);
      if (acceptedUpgradeTexts.some(item => isSamePart2TeachingFrame(signal, item, upgrade))) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeUpgradeRemoved:sameTeachingFrame');
        return null;
      }
      if (masteredUpgradeKeys.has(upgradeKey)) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeUpgradeRemoved:masteredExpression');
        return null;
      }
      if (!upgradeKey || seen.has(upgradeKey)) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeUpgradesDeduped');
        return null;
      }
      seen.add(upgradeKey);

      const sourceQuote = item.sourceQuote && transcript && textKeyContains(transcript, item.sourceQuote)
        ? item.sourceQuote
        : undefined;
      if (item.sourceQuote && !sourceQuote) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeSourceRemoved');
      }

      const kind: NormalizedPart2AlternativeUpgrade['kind'] = sourceQuote ? 'replace' : 'add';
      if (item.kind !== kind) {
        notePart2SignalRepair(normalizedFields, 'part2SignalAlternativeKindRepaired');
      }
      acceptedUpgradeTexts.push(upgrade);

      return {
        ...item,
        upgrade,
        kind,
        sourceQuote,
        sampleUpgradeHighlight: repairPart2AlternativeSampleHighlight(
          signal,
          item.sampleUpgrade,
          item.sampleUpgradeHighlight,
          upgrade,
          normalizedFields,
        ),
      };
    })
    .filter((item): item is NormalizedPart2AlternativeUpgrade => Boolean(item))
    .slice(0, 3);
};

const repairPart2SignalSampleHighlight = (
  signal: NormalizedPart2LanguageSignal,
  normalizedFields: string[],
): string | undefined => {
  if (!signal.sampleUpgrade) return undefined;
  if (signal.signal === 'phrasal_verb' && signal.bestUpgrade && textKeyContains(signal.sampleUpgrade, signal.bestUpgrade)) {
    if (
      signal.sampleUpgradeHighlight &&
      part2SignalUpgradeKey(signal.sampleUpgradeHighlight) !== part2SignalUpgradeKey(signal.bestUpgrade)
    ) {
      notePart2SignalRepair(normalizedFields, 'part2SignalSampleHighlightNarrowed:phrasalVerbCore');
    }
    return signal.bestUpgrade;
  }
  if (!signal.sampleUpgradeHighlight) return undefined;
  if (textKeyContains(signal.sampleUpgrade, signal.sampleUpgradeHighlight)) return signal.sampleUpgradeHighlight;
  if (signal.bestUpgrade && textKeyContains(signal.sampleUpgrade, signal.bestUpgrade)) {
    notePart2SignalRepair(normalizedFields, 'part2SignalSampleHighlightRepaired');
    return signal.bestUpgrade;
  }
  notePart2SignalRepair(normalizedFields, 'part2SignalSampleHighlightRemoved');
  return undefined;
};

const repairPart2LanguageSignalOutput = (
  signals: NormalizedPart2LanguageSignal[],
  transcript: string,
  nextSpeakableVersion: string,
  masteredUpgradeKeys: Set<string>,
  normalizedFields: string[],
): NormalizedPart2LanguageSignal[] => {
  const claimedUpgradeKeys = new Set<string>();
  const claimedUpgradeTexts: string[] = [];

  return signals.map((signal): NormalizedPart2LanguageSignal => {
    let bestUpgrade = narrowPart2PhrasalVerbCore(
      signal.signal,
      signal.bestUpgrade,
      normalizedFields,
      'part2SignalBestUpgradeNarrowed:phrasalVerbCore',
    );
    const invalidBestReason = bestUpgrade
      ? isInvalidPart2SignalUpgrade(signal.signal, bestUpgrade)
      : null;

    if (invalidBestReason) {
      notePart2SignalRepair(normalizedFields, `part2SignalBestUpgradeRemoved:${invalidBestReason}`);
      bestUpgrade = '';
    }

    let bestUpgradeKey = part2SignalUpgradeKey(bestUpgrade);
    if (bestUpgradeKey && masteredUpgradeKeys.has(bestUpgradeKey)) {
      notePart2SignalRepair(normalizedFields, 'part2SignalBestUpgradeRemoved:masteredExpression');
      bestUpgrade = '';
      bestUpgradeKey = '';
    }

    if (bestUpgradeKey && claimedUpgradeKeys.has(bestUpgradeKey)) {
      notePart2SignalRepair(normalizedFields, 'part2SignalDuplicateOwnershipRemoved');
      bestUpgrade = '';
      bestUpgradeKey = '';
    }

    if (bestUpgradeKey) {
      claimedUpgradeKeys.add(bestUpgradeKey);
      claimedUpgradeTexts.push(bestUpgrade);
    }

    const blockedKeys = new Set(claimedUpgradeKeys);
    const blockedUpgradeTexts = [...claimedUpgradeTexts];
    const alternativeUpgrades = repairPart2AlternativeUpgrades(
      signal.signal,
      signal.alternativeUpgrades || [],
      transcript,
      blockedKeys,
      blockedUpgradeTexts,
      masteredUpgradeKeys,
      normalizedFields,
    );
    alternativeUpgrades.forEach(item => {
      const key = part2SignalUpgradeKey(item.upgrade);
      if (key) blockedKeys.add(key);
      blockedUpgradeTexts.push(item.upgrade);
    });

    const alternatives = repairPart2SignalTextList(
      signal.signal,
      signal.alternatives,
      blockedKeys,
      blockedUpgradeTexts,
      masteredUpgradeKeys,
      normalizedFields,
    );
    alternatives.forEach(item => {
      const key = part2SignalUpgradeKey(item);
      if (key) blockedKeys.add(key);
      blockedUpgradeTexts.push(item);
    });

    let usedInNextVersionQuote = signal.usedInNextVersionQuote && nextSpeakableVersion
      ? textKeyContains(nextSpeakableVersion, signal.usedInNextVersionQuote)
        ? signal.usedInNextVersionQuote
        : undefined
      : signal.usedInNextVersionQuote;
    if (signal.usedInNextVersionQuote && !usedInNextVersionQuote) {
      notePart2SignalRepair(normalizedFields, 'part2SignalNextVersionQuoteRemoved');
    }
    if (usedInNextVersionQuote) {
      usedInNextVersionQuote = narrowPart2PhrasalVerbCore(
        signal.signal,
        usedInNextVersionQuote,
        normalizedFields,
        'part2SignalNextVersionQuoteNarrowed:phrasalVerbCore',
      );
    }
    if (usedInNextVersionQuote && masteredUpgradeKeys.has(part2SignalUpgradeKey(usedInNextVersionQuote))) {
      notePart2SignalRepair(normalizedFields, 'part2SignalNextVersionQuoteRemoved:masteredExpression');
      usedInNextVersionQuote = undefined;
    }

    [...alternativeUpgrades.map(item => item.upgrade), ...alternatives].forEach(item => {
      const key = part2SignalUpgradeKey(item);
      if (key) claimedUpgradeKeys.add(key);
      claimedUpgradeTexts.push(item);
    });

    return {
      ...signal,
      bestUpgrade,
      alternatives,
      alternativeUpgrades,
      sampleUpgradeHighlight: repairPart2SignalSampleHighlight(
        { ...signal, bestUpgrade },
        normalizedFields,
      ),
      usedInNextVersionQuote,
    };
  });
};

const normalizePart2AlternativeUpgrades = (
  value: unknown,
  validationErrors: string[],
  path: string,
): NonNullable<NormalizedPart2Feedback['languageSignals'][number]['alternativeUpgrades']> => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    validationErrors.push(`${path} missing or invalid array`);
    return [];
  }
  return value
    .map((item, index): NonNullable<NormalizedPart2Feedback['languageSignals'][number]['alternativeUpgrades']>[number] | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
      const upgrade = safeLearningText(asString(record.upgrade ?? record.bestUpgrade ?? record.better, '', `${path}[${index}].upgrade`, validationErrors));
      const guidanceZh = safeLearningText(asString(record.guidanceZh ?? record.explanationZh ?? record.replaceZh, '', `${path}[${index}].guidanceZh`, validationErrors));
      if (!upgrade && !guidanceZh) return null;
      const kind = record.kind === 'replace' || record.kind === 'add'
        ? record.kind
        : optionalSafeString(record.sourceQuote ?? record.original ?? record.replace)
          ? 'replace'
          : 'add';
      return {
        kind,
        sourceQuote: optionalSafeString(record.sourceQuote ?? record.original ?? record.replace),
        upgrade,
        guidanceZh,
        insertLocationZh: optionalSafeString(record.insertLocationZh ?? record.whereZh ?? record.locationZh),
        sampleUpgrade: optionalSafeString(record.sampleUpgrade ?? record.example),
        sampleUpgradeHighlight: optionalSafeString(record.sampleUpgradeHighlight ?? record.sampleHighlight ?? record.highlightQuote),
      };
    })
    .filter((item): item is NonNullable<NormalizedPart2Feedback['languageSignals'][number]['alternativeUpgrades']>[number] => Boolean(item))
    .slice(0, 3);
};

const part2AnnotationLayerPriority = (layer: Part1AnswerAnnotationLayer) => {
  const evidence = `${layer.issueType} ${layer.explanationZh} ${layer.original} ${layer.better}`.toLowerCase();
  if (/\b(timeline|tense|verb form|missing verb|sentence structure|clause|word order|agreement|subject-verb|article|determiner|plural|singular|meaning|clarity|story clarity)\b/.test(evidence)) return 0;
  if (/\b(lexical precision|word choice|collocation|preposition|word form|countability)\b/.test(evidence)) return 1;
  if (/\b(connector|cohesion|sequence|linking)\b/.test(evidence)) return 2;
  if (/\b(optional|polish|natural|spoken choice|style|concise)\b/.test(evidence)) return 4;
  return 3;
};

const part2AnnotationPosition = (transcript: string, sourceQuote: string) => {
  const transcriptKey = part1AnnotationKeyText(transcript);
  const quoteKey = part1AnnotationKeyText(sourceQuote);
  const index = quoteKey ? transcriptKey.indexOf(quoteKey) : -1;
  return index >= 0 ? index : Number.MAX_SAFE_INTEGER;
};

const part2AnnotationSortKey = (annotation: Part1AnswerAnnotation, transcript: string) => {
  const strongestSeverity = annotation.layers.reduce(
    (current, layer) => strongestPart1Severity(current, layer.severity),
    'optional_polish' as Part1AnnotationSeverity,
  );
  const severityRank = strongestSeverity === 'must_fix' ? 0 : strongestSeverity === 'better_spoken_choice' ? 1 : 2;
  const issueRank = Math.min(...annotation.layers.map(part2AnnotationLayerPriority));
  const position = part2AnnotationPosition(transcript, annotation.sourceQuote);
  const widthPenalty = Math.min(annotation.sourceQuote.split(/\s+/).filter(Boolean).length, 20);
  return { severityRank, issueRank, position, widthPenalty };
};

const normalizePart2Annotations = (
  value: unknown,
  transcript: string,
  validationErrors: string[],
): Part1AnswerAnnotation[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    validationErrors.push('part2Feedback.annotations missing or invalid array');
    return [];
  }

  return value
    .map((item, index): Part1AnswerAnnotation | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`part2Feedback.annotations[${index}] missing or invalid object`);
      const sourceQuote = exactQuoteInAnswer(asString(record.sourceQuote ?? record.original, '', `part2Feedback.annotations[${index}].sourceQuote`, validationErrors));
      if (!sourceQuote || !textKeyContains(transcript, sourceQuote)) return null;
      const rawLayers = Array.isArray(record.layers) && record.layers.length ? record.layers : [record];
      const layers = rawLayers
        .map((layer, layerIndex): Part1AnswerAnnotationLayer | null => {
          const layerRecord = isRecord(layer) ? layer : {};
          if (!isRecord(layer)) validationErrors.push(`part2Feedback.annotations[${index}].layers[${layerIndex}] missing or invalid object`);
          const original = safeLearningText(asString(layerRecord.original ?? sourceQuote, sourceQuote, `part2Feedback.annotations[${index}].layers[${layerIndex}].original`, validationErrors));
          const better = safeLearningText(asString(layerRecord.better ?? layerRecord.correction ?? record.combinedRepair ?? sourceQuote, sourceQuote, `part2Feedback.annotations[${index}].layers[${layerIndex}].better`, validationErrors));
          const explanationZh = safeLearningText(asString(layerRecord.explanationZh, '', `part2Feedback.annotations[${index}].layers[${layerIndex}].explanationZh`, validationErrors));
          const issueType = safeLearningText(asString(layerRecord.issueType ?? layerRecord.tag ?? 'part2_feedback', 'part2_feedback', `part2Feedback.annotations[${index}].layers[${layerIndex}].issueType`, validationErrors));
          if (!original || !better || !explanationZh) return null;
          const repair = normalizeSharedSpeakingRepairLayer(original, better, issueType, explanationZh, transcript || sourceQuote);
          if (!repair) return null;
          if (!textKeyContains(transcript, repair.original) && !textKeyContains(sourceQuote, repair.original)) return null;
          const severity = calibratePart1AnnotationSeverity(
            normalizePart1AnnotationSeverity(layerRecord.severity),
            issueType,
            repair.explanationZh,
            repair.original,
            repair.better,
          );
          const builtLayer: Part1AnswerAnnotationLayer = {
            severity,
            issueType,
            original: repair.original,
            better: repair.better,
            explanationZh: repair.explanationZh,
            reuseGuidanceZh: optionalSafeString(layerRecord.reuseGuidanceZh),
          };
          return builtLayer;
        })
        .filter((layer): layer is Part1AnswerAnnotationLayer => Boolean(layer));
      if (!layers.length) return null;
      return {
        id: optionalSafeString(record.id) || `p2_ann_${index + 1}`,
        questionRef: 'PART 2',
        sourceQuote,
        layers,
        combinedRepair: optionalSafeString(record.combinedRepair),
      };
    })
    .filter((item): item is Part1AnswerAnnotation => Boolean(item))
    .filter((item, index, items) =>
      items.findIndex(candidate =>
        textKeyContains(candidate.sourceQuote, item.sourceQuote) &&
        candidate.layers.some(layer => item.layers.some(other => textKeyContains(layer.better, other.better)))
      ) === index)
    .map(item => ({
      ...item,
      layers: [...item.layers].sort((left, right) => {
        const severityDelta = part1SeverityRank[right.severity] - part1SeverityRank[left.severity];
        return severityDelta || part2AnnotationLayerPriority(left) - part2AnnotationLayerPriority(right);
      }),
    }))
    .sort((left, right) => {
      const a = part2AnnotationSortKey(left, transcript);
      const b = part2AnnotationSortKey(right, transcript);
      return a.severityRank - b.severityRank ||
        a.issueRank - b.issueRank ||
        a.position - b.position ||
        b.widthPenalty - a.widthPenalty ||
        left.sourceQuote.localeCompare(right.sourceQuote);
    })
    .slice(0, 6)
    .sort((left, right) => part2AnnotationPosition(transcript, left.sourceQuote) - part2AnnotationPosition(transcript, right.sourceQuote));
};

const normalizePart2StoryModules = (
  value: unknown,
  validationErrors: string[],
): NormalizedPart2Feedback['storyModules'] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    validationErrors.push('part2Feedback.storyModules missing or invalid array');
    return [];
  }
  return value
    .map((item, index): NormalizedPart2Feedback['storyModules'][number] | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`part2Feedback.storyModules[${index}] missing or invalid object`);
      const role = normalizePart2StoryModuleRole(record.role ?? record.module);
      if (!role) return null;
      const sourceWording = optionalSafeString(record.sourceWording ?? record.source ?? record.learnerWording);
      const improvedVersion = optionalSafeString(record.improvedVersion ?? record.speakableVersion ?? record.nextVersion);
      const coachingZh = safeLearningText(asString(record.coachingZh ?? record.coaching ?? record.nextMoveZh, '', `part2Feedback.storyModules[${index}].coachingZh`, validationErrors));
      if (!coachingZh && !sourceWording && !improvedVersion) return null;
      return {
        role,
        status: normalizePart2StoryModuleStatus(record.status),
        sourceWording,
        improvedVersion,
        coachingZh,
        confirmationNeeded: Boolean(record.confirmationNeeded),
      };
    })
    .filter((item): item is NormalizedPart2Feedback['storyModules'][number] => Boolean(item))
    .slice(0, 7);
};

const normalizePart2LanguageSignals = (
  value: unknown,
  validationErrors: string[],
  normalizedFields: string[],
  transcript: string,
  nextSpeakableVersion: string,
  masteredUpgradeKeys: Set<string>,
): NormalizedPart2Feedback['languageSignals'] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    validationErrors.push('part2Feedback.languageSignals missing or invalid array');
    return [];
  }
  const signals = value
    .map((item, index): NormalizedPart2Feedback['languageSignals'][number] | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`part2Feedback.languageSignals[${index}] missing or invalid object`);
      const signal = normalizePart2LanguageSignal(record.signal ?? record.name);
      if (!signal) return null;
      const nextMoveZh = safeLearningText(asString(record.nextMoveZh ?? record.coachingZh ?? record.actionZh, '', `part2Feedback.languageSignals[${index}].nextMoveZh`, validationErrors));
      return {
        signal,
        status: normalizePart2LanguageSignalStatus(record.status),
        requirementZh: safeLearningText(asString(record.requirementZh, '', `part2Feedback.languageSignals[${index}].requirementZh`, validationErrors)),
        foundInTranscript: Boolean(record.foundInTranscript),
        evidence: optionalSafeString(record.evidence),
        evidenceQuotes: optionalSafeStringArray(record.evidenceQuotes),
        qualityZh: safeLearningText(asString(record.qualityZh, '', `part2Feedback.languageSignals[${index}].qualityZh`, validationErrors)),
        nextMoveZh,
        bestUpgrade: safeLearningText(asString(record.bestUpgrade, '', `part2Feedback.languageSignals[${index}].bestUpgrade`, validationErrors)),
        alternatives: optionalSafeStringArray(record.alternatives) || [],
        alternativeUpgrades: normalizePart2AlternativeUpgrades(record.alternativeUpgrades, validationErrors, `part2Feedback.languageSignals[${index}].alternativeUpgrades`),
        insertLocationZh: safeLearningText(asString(record.insertLocationZh, '', `part2Feedback.languageSignals[${index}].insertLocationZh`, validationErrors)),
        sampleUpgrade: optionalSafeString(record.sampleUpgrade ?? record.example),
        sampleUpgradeHighlight: optionalSafeString(record.sampleUpgradeHighlight ?? record.sampleHighlight ?? record.highlightQuote),
        sampleUpgrades: optionalSafeStringArray(record.sampleUpgrades),
        usedInNextVersionQuote: optionalSafeString(record.usedInNextVersionQuote),
        profileSignalZh: optionalSafeString(record.profileSignalZh),
      };
    })
    .filter((item): item is NormalizedPart2Feedback['languageSignals'][number] => Boolean(
      item.requirementZh ||
      item.qualityZh ||
      item.nextMoveZh ||
      item.bestUpgrade ||
      item.alternatives.length ||
      item.alternativeUpgrades?.length ||
      item.insertLocationZh ||
      item.usedInNextVersionQuote ||
      item.evidence ||
      item.evidenceQuotes?.length,
    ))
    .slice(0, 6);

  return repairPart2LanguageSignalOutput(
    signals,
    transcript,
    nextSpeakableVersion,
    masteredUpgradeKeys,
    normalizedFields,
  );
};

const normalizePart2NextSpeakableHighlights = (
  value: unknown,
  nextSpeakableVersion: string,
  validationErrors: string[],
  normalizedFields: string[],
  masteredUpgradeKeys: Set<string>,
): NormalizedPart2Feedback['nextSpeakableVersionHighlights'] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    validationErrors.push('part2Feedback.nextSpeakableVersionHighlights missing or invalid array');
    return [];
  }
  return value
    .map((item, index): NormalizedPart2Feedback['nextSpeakableVersionHighlights'][number] | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`part2Feedback.nextSpeakableVersionHighlights[${index}] missing or invalid object`);
      const signal = normalizePart2LanguageSignal(record.signal);
      const quote = narrowPart2PhrasalVerbCore(
        signal || 'idiomatic_expression',
        asString(record.quote, '', `part2Feedback.nextSpeakableVersionHighlights[${index}].quote`, validationErrors),
        normalizedFields,
        'part2NextSpeakableHighlightNarrowed:phrasalVerbCore',
      );
      if (!quote || !textKeyContains(nextSpeakableVersion, quote)) return null;
      if (masteredUpgradeKeys.has(part2SignalUpgradeKey(quote))) {
        notePart2SignalRepair(normalizedFields, 'part2NextSpeakableHighlightRemoved:masteredExpression');
        return null;
      }
      const storyRole = normalizePart2StoryModuleRole(record.storyRole);
      const labelZh = safeLearningText(asString(record.labelZh, '', `part2Feedback.nextSpeakableVersionHighlights[${index}].labelZh`, validationErrors));
      const whyItWorksZh = safeLearningText(asString(record.whyItWorksZh, '', `part2Feedback.nextSpeakableVersionHighlights[${index}].whyItWorksZh`, validationErrors));
      if (!labelZh && !whyItWorksZh) return null;
      return {
        quote,
        signal: signal || undefined,
        storyRole: storyRole || undefined,
        labelZh,
        whyItWorksZh,
      };
    })
    .filter((item): item is NormalizedPart2Feedback['nextSpeakableVersionHighlights'][number] => Boolean(item))
    .slice(0, 10);
};

const normalizePart2Feedback = (
  value: unknown,
  request: SpeakingRequest,
  validationErrors: string[],
  normalizedFields: string[],
): NormalizedPart2Feedback | undefined => {
  if (request.part !== 2) return undefined;
  if (!isRecord(value)) {
    normalizedFields.push('part2FeedbackMissing');
    return undefined;
  }
  const annotations = normalizePart2Annotations(value.annotations, request.transcript || '', validationErrors);
  const storyModules = normalizePart2StoryModules(value.storyModules, validationErrors);
  const nextSpeakableVersion = safeLearningText(asString(value.nextSpeakableVersion, '', 'part2Feedback.nextSpeakableVersion', validationErrors));
  const masteredUpgradeKeys = part2MasteredUpgradeKeys(request.masteredExpressions);
  const languageSignals = normalizePart2LanguageSignals(
    value.languageSignals,
    validationErrors,
    normalizedFields,
    request.transcript || '',
    nextSpeakableVersion,
    masteredUpgradeKeys,
  );
  const nextSpeakableVersionHighlights = normalizePart2NextSpeakableHighlights(
    value.nextSpeakableVersionHighlights,
    nextSpeakableVersion,
    validationErrors,
    normalizedFields,
    masteredUpgradeKeys,
  );
  normalizedFields.push(`part2Annotations:${annotations.length}`);
  normalizedFields.push(`part2StoryModules:${storyModules.length}`);
  normalizedFields.push(`part2LanguageSignals:${languageSignals.length}`);
  normalizedFields.push(`part2NextSpeakableHighlights:${nextSpeakableVersionHighlights.length}`);
  return {
    materialType: normalizePart2MaterialType(value.materialType),
    materialTypeRationaleZh: optionalSafeString(value.materialTypeRationaleZh),
    annotations,
    storyModules,
    languageSignals,
    priorityFocusZh: safeLearningText(asString(value.priorityFocusZh, '', 'part2Feedback.priorityFocusZh', validationErrors)),
    nextSpeakableVersion,
    nextSpeakableVersionHighlights,
  };
};

const part2AnnotationDuplicate = (left: Part1AnswerAnnotation, right: Part1AnswerAnnotation) => {
  const leftQuote = part1AnnotationKeyText(left.sourceQuote);
  const rightQuote = part1AnnotationKeyText(right.sourceQuote);
  if (!leftQuote || !rightQuote) return false;
  if (leftQuote === rightQuote || leftQuote.includes(rightQuote) || rightQuote.includes(leftQuote)) return true;
  return left.layers.some(leftLayer =>
    right.layers.some(rightLayer =>
      part1AnnotationKeyText(leftLayer.original) === part1AnnotationKeyText(rightLayer.original) ||
      part1AnnotationKeyText(leftLayer.better) === part1AnnotationKeyText(rightLayer.better),
    ),
  );
};

const backfillPart2AnnotationsFromGenericRepairs = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  normalizedFields: string[],
): Omit<SpeakingFeedback, 'obsidianMarkdown'> => {
  if (feedback.part !== 2 || !feedback.part2Feedback) return feedback;
  const transcript = feedback.transcript || '';
  const existing = feedback.part2Feedback.annotations || [];
  const candidates: Part1AnswerAnnotation[] = [];
  const pushCandidate = (
    original: string,
    better: string,
    issueType: string,
    explanationZh: string,
    severity: Part1AnnotationSeverity,
    index: number,
  ) => {
    if (!original || !better || !explanationZh || !textKeyContains(transcript, original)) return;
    const layer: Part1AnswerAnnotationLayer = {
      severity,
      issueType,
      original,
      better,
      explanationZh,
    };
    const candidate: Part1AnswerAnnotation = {
      id: `part2_generic_${index + 1}`,
      questionRef: 'PART 2',
      sourceQuote: original,
      layers: [layer],
      combinedRepair: better,
    };
    if (existing.some(item => part2AnnotationDuplicate(item, candidate))) return;
    if (candidates.some(item => part2AnnotationDuplicate(item, candidate))) return;
    candidates.push(candidate);
  };

  feedback.fatalErrors.forEach((item, index) => {
    pushCandidate(item.original, item.correction, item.tag || 'accuracy', item.explanationZh, 'must_fix', index);
  });
  feedback.naturalnessHints.forEach((item, index) => {
    pushCandidate(item.original, item.better, item.tag || 'naturalness', item.explanationZh, 'better_spoken_choice', feedback.fatalErrors.length + index);
  });

  if (!candidates.length) return feedback;
  const annotations = [...existing, ...candidates]
    .sort((left, right) => {
      const a = part2AnnotationSortKey(left, transcript);
      const b = part2AnnotationSortKey(right, transcript);
      return a.severityRank - b.severityRank ||
        a.issueRank - b.issueRank ||
        a.position - b.position ||
        b.widthPenalty - a.widthPenalty ||
        left.sourceQuote.localeCompare(right.sourceQuote);
    })
    .slice(0, 6)
    .sort((left, right) => part2AnnotationPosition(transcript, left.sourceQuote) - part2AnnotationPosition(transcript, right.sourceQuote));
  normalizedFields.push(`part2AnnotationsBackfilled:${annotations.length - existing.length}`);
  return {
    ...feedback,
    part2Feedback: {
      ...feedback.part2Feedback,
      annotations,
    },
  };
};

const stripGenericPart1CleanRetryOpener = (answer: string) => {
  const stripped = answer
    .replace(/^\s*(?:well,\s*)?(?:that's|that is)\s+(?:an interesting|a good)\s+question(?:[.!?,;:]|\s|-)*\s*/i, '')
    .trim();
  return stripped && stripped.split(/\s+/).length >= 4 ? stripped : answer;
};

const normalizePart1CleanRetryAnswers = (
  value: unknown,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  validationErrors: string[],
): Part1CleanRetryAnswer[] => {
  const validQuestionRefs = new Set(answers.map((_, index) => `Q${index + 1}`));
  return asArray(value, 'threadFeedback.cleanRetryAnswers', validationErrors)
    .map((item, index): Part1CleanRetryAnswer | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`threadFeedback.cleanRetryAnswers[${index}] missing or invalid object`);
      const questionRef = normalizeQuestionRefs(record.questionRef ? [record.questionRef] : record.questionRefs, answers)[0];
      const answer = stripGenericPart1CleanRetryOpener(polishPart1RepairText(asString(record.answer ?? record.cleanAnswer ?? record.retryAnswer, '', `threadFeedback.cleanRetryAnswers[${index}].answer`, validationErrors)));
      if (!questionRef || !validQuestionRefs.has(questionRef) || !answer) return null;
      return {
        questionRef,
        answer,
        noteZh: optionalSafeString(record.noteZh),
      };
    })
    .filter((item): item is Part1CleanRetryAnswer => Boolean(item))
    .filter((item, index, items) => items.findIndex(candidate => candidate.questionRef === item.questionRef) === index);
};

const replaceFirstPart1CleanRetryQuote = (text: string, original: string, better: string) => {
  const cleanOriginal = safeLearningText(original).trim();
  const cleanBetter = safeLearningText(better).trim();
  if (!cleanOriginal || !cleanBetter) return text;
  const index = text.toLowerCase().indexOf(cleanOriginal.toLowerCase());
  if (index < 0) return text;
  return `${text.slice(0, index)}${cleanBetter}${text.slice(index + cleanOriginal.length)}`;
};

const selectPart1CleanRetryLayer = (annotation: Part1AnswerAnnotation) =>
  annotation.layers
    .filter(layer =>
      safeLearningText(layer.original).trim() &&
      safeLearningText(layer.better).trim() &&
      part1AnnotationKeyText(layer.original) !== part1AnnotationKeyText(layer.better),
    )
    .sort((a, b) => part1SeverityRank[b.severity] - part1SeverityRank[a.severity] || b.original.length - a.original.length)[0];

const part1CleanRetryTokenOverlap = (left: string, right: string) => {
  const leftTokens = new Set(normalizeTranscriptFormatText(left).split(/\s+/).filter(token => token.length >= 4));
  const rightTokens = normalizeTranscriptFormatText(right).split(/\s+/).filter(token => token.length >= 4);
  if (!leftTokens.size || !rightTokens.length) return 0;
  const shared = rightTokens.filter(token => leftTokens.has(token)).length;
  return shared / Math.max(leftTokens.size, rightTokens.length);
};

const isReusablePart1RetryReferenceAnswer = (currentAnswer: string, priorAnswer: string) => {
  const currentKey = normalizeTranscriptFormatText(currentAnswer);
  const priorKey = normalizeTranscriptFormatText(priorAnswer);
  if (!currentKey || !priorKey) return false;
  if (currentKey === priorKey) return true;
  return part1CleanRetryTokenOverlap(currentAnswer, priorAnswer) >= 0.65;
};

const buildPart1CleanRetryFallbackFromAnnotations = (
  answerText: string,
  annotations: Part1AnswerAnnotation[],
) => {
  let repaired = answerText.trim();
  let changed = false;
  const seen = new Set<string>();
  const candidates = annotations
    .flatMap(annotation => {
      const layer = selectPart1CleanRetryLayer(annotation);
      if (!layer) return [];
      const layerCandidate = {
        original: layer.original,
        better: layer.better,
        severity: layer.severity,
      };
      const combinedCandidate = annotation.combinedRepair
        ? {
          original: annotation.sourceQuote,
          better: annotation.combinedRepair,
          severity: layer.severity,
        }
        : null;
      return [layerCandidate, combinedCandidate].filter((item): item is typeof layerCandidate => Boolean(item));
    })
    .filter(candidate => textKeyContains(answerText, candidate.original))
    .sort((a, b) => b.original.length - a.original.length || part1SeverityRank[b.severity] - part1SeverityRank[a.severity]);

  candidates.forEach(candidate => {
    const key = `${part1AnnotationKeyText(candidate.original)}::${part1AnnotationKeyText(candidate.better)}`;
    if (seen.has(key)) return;
    seen.add(key);
    const next = replaceFirstPart1CleanRetryQuote(repaired, candidate.original, candidate.better);
    if (next !== repaired) {
      repaired = next;
      changed = true;
    }
  });

  const answer = stripGenericPart1CleanRetryOpener(polishPart1RepairText(repaired));
  return {
    answer: answer || answerText.trim(),
    changed,
  };
};

const completePart1CleanRetryAnswers = (
  providerAnswers: Part1CleanRetryAnswer[],
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  annotations: Part1AnswerAnnotation[],
  retryReference?: Part1RetryReferenceContext,
) => {
  const providerByRef = new Map(providerAnswers.map(answer => [answer.questionRef, answer] as const));
  const priorByRef = part1RetryReferenceByQuestion(retryReference);
  const filledRefs: string[] = [];
  const fallbackSources: string[] = [];
  const cleanRetryAnswers = answers.map((answer, index): Part1CleanRetryAnswer => {
    const questionRef = `Q${index + 1}`;
    const providerAnswer = providerByRef.get(questionRef);
    if (providerAnswer?.answer.trim()) return providerAnswer;
    const answerAnnotations = annotations.filter(annotation => annotation.questionRef === questionRef);
    const annotationFallback = buildPart1CleanRetryFallbackFromAnnotations(answer.answer, answerAnnotations);
    if (annotationFallback.changed && annotationFallback.answer.trim()) {
      filledRefs.push(questionRef);
      fallbackSources.push(`${questionRef}:annotation`);
      return {
        questionRef,
        answer: annotationFallback.answer,
        noteZh: 'Filled from grounded transcript repairs because the provider omitted this clean answer.',
      };
    }
    const prior = priorByRef.get(questionRef);
    if (prior?.answer && isReusablePart1RetryReferenceAnswer(answer.answer, prior.answer)) {
      filledRefs.push(questionRef);
      fallbackSources.push(`${questionRef}:retry_reference`);
      return {
        questionRef,
        answer: stripGenericPart1CleanRetryOpener(polishPart1RepairText(prior.answer)),
        noteZh: 'Filled from the previous certified retry answer because the provider omitted this clean answer.',
      };
    }
    filledRefs.push(questionRef);
    fallbackSources.push(`${questionRef}:original`);
    return {
      questionRef,
      answer: stripGenericPart1CleanRetryOpener(polishPart1RepairText(answer.answer)),
      noteZh: 'Provider omitted this clean answer; learner wording was preserved for certification instead of blocking the report.',
    };
  });
  return {
    answers: cleanRetryAnswers,
    filledRefs,
    fallbackSources,
  };
};

const extractPart1CleanRetryExampleFromNote = (noteZh?: string) => {
  const note = safeLearningText(noteZh || '');
  if (!note) return '';
  const quoted = Array.from(note.matchAll(/['"“”‘’]([^'"“”‘’]{8,160})['"“”‘’]/g))
    .map(match => match[1])
    .map(example => stripGenericPart1CleanRetryOpener(polishPart1RepairText(example)))
    .filter(example =>
      example &&
      !containsUnsupportedSpeakingBoundaryClaim(example) &&
      !/\[[^\]]+\]/.test(example) &&
      countWords(example) >= 5 &&
      countWords(example) <= 35,
    );
  return quoted[0] || '';
};

const repairUnderresponsivePart1CleanRetryAnswer = (
  answer: NonNullable<SpeakingRequest['threadAnswers']>[number],
  cleanRetry: Part1CleanRetryAnswer,
) => {
  const questionEvidence = `${answer.question} ${cleanRetry.noteZh || ''}`;
  const questionAsksForDescription = /\bdescribe\b|\bwhat(?:'s| is).{0,40}\blike\b|\btell me about\b|\u63cf\u8ff0|\u4ec0\u4e48\u6837|\u600e\u4e48\u6837/i.test(questionEvidence);
  const providerAdmitsMissingDescription = /\u53ea\u56de\u7b54|\u6ca1\u6709\u63cf\u8ff0|\u672a\u63cf\u8ff0|\u7f3a\u5c11\u63cf\u8ff0|add (?:a )?description|missing (?:a )?description|does not describe|only answer/i.test(questionEvidence);
  if (!questionAsksForDescription || !providerAdmitsMissingDescription) return cleanRetry;
  const example = extractPart1CleanRetryExampleFromNote(cleanRetry.noteZh);
  if (!example || textKeyContains(cleanRetry.answer, example)) return cleanRetry;
  const answerText = stripGenericPart1CleanRetryOpener(polishPart1RepairText(cleanRetry.answer));
  if (!answerText) return cleanRetry;
  return {
    ...cleanRetry,
    answer: `${example.replace(/[.!?]+$/, '')}. ${answerText}`.replace(/\s+/g, ' ').trim(),
    noteZh: [cleanRetry.noteZh, 'System recovery: the provider note supplied a concrete description, so it was integrated into the clean retry answer.']
      .filter(Boolean)
      .join(' '),
  };
};

const normalizePart1CertificationAnswerSet = (
  value: unknown,
  request: Part1CertificationRequest,
  validationErrors: string[],
  path: string,
): Part1CleanRetryAnswer[] => {
  const validQuestionRefs = new Set(request.threadAnswers.map((_, index) => `Q${index + 1}`));
  const seen = new Set<string>();
  return asArray(value, path, validationErrors)
    .map((item, index): Part1CleanRetryAnswer | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
      const questionRef = normalizeQuestionRefs(record.questionRef ? [record.questionRef] : record.questionRefs, request.threadAnswers)[0];
      const answer = stripGenericPart1CleanRetryOpener(polishPart1RepairText(asString(record.answer ?? record.cleanAnswer ?? record.retryAnswer, '', `${path}[${index}].answer`, validationErrors)));
      if (!questionRef || !validQuestionRefs.has(questionRef) || !answer) return null;
      if (seen.has(questionRef)) {
        validationErrors.push(`${path} duplicate ${questionRef}`);
        return null;
      }
      seen.add(questionRef);
      return {
        questionRef,
        answer,
        noteZh: optionalSafeString(record.noteZh),
      };
    })
    .filter((item): item is Part1CleanRetryAnswer => Boolean(item));
};

const assertPart1CertificationCoverage = (
  answers: Part1CleanRetryAnswer[],
  request: Part1CertificationRequest,
  validationErrors: string[],
  path: string,
) => {
  const expectedRefs = request.threadAnswers.map((_, index) => `Q${index + 1}`);
  const refs = answers.map(item => item.questionRef);
  const missing = expectedRefs.filter(ref => !refs.includes(ref));
  const unknown = refs.filter(ref => !expectedRefs.includes(ref));
  if (missing.length) validationErrors.push(`${path} missing ${missing.join(',')}`);
  if (unknown.length) validationErrors.push(`${path} unknown ${unknown.join(',')}`);
  if (answers.length !== expectedRefs.length) validationErrors.push(`${path} expected ${expectedRefs.length} answers, received ${answers.length}`);
};

const isUnsupportedPart1CertificationViolation = (
  issueType: string,
  reasonZh: string,
  candidateWording: string,
  saferVersion?: string,
) => {
  const evidence = `${issueType} ${reasonZh}`.toLowerCase();
  if (containsUnsupportedSpeakingBoundaryClaim(evidence)) return true;
  if (saferVersion && isLikelyTranscriptFormatOnlyLayer(candidateWording, saferVersion, issueType, reasonZh)) return true;
  return false;
};

const normalizePart1CertificationViolation = (
  value: unknown,
  request: Part1CertificationRequest,
  index: number,
  validationErrors: string[],
): Part1CleanRetryCertificationViolation | null => {
  const record = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push(`violations[${index}] missing or invalid object`);
  const questionRef = normalizeQuestionRefs(record.questionRef ? [record.questionRef] : record.questionRefs, request.threadAnswers)[0];
  const expectedRefs = request.threadAnswers.map((_, answerIndex) => `Q${answerIndex + 1}`);
  const issueType = safeLearningText(asString(record.issueType ?? record.type, 'hard_problem', `violations[${index}].issueType`, validationErrors));
  const candidateWording = safeLearningText(asString(record.candidateWording ?? record.candidate ?? record.original, '', `violations[${index}].candidateWording`, validationErrors));
  const saferVersion = optionalSafeString(record.saferVersion ?? record.correctedVersion ?? record.correction);
  const reasonZh = sanitizePart1FeedbackText(
    safeLearningText(asString(record.reasonZh ?? record.explanationZh, 'Cleaner answer still contains a hard Part 1 issue.', `violations[${index}].reasonZh`, validationErrors)),
    'Cleaner answer still contains a hard Part 1 issue.',
  ) || 'Cleaner answer still contains a hard Part 1 issue.';
  if (!questionRef || !expectedRefs.includes(questionRef)) {
    validationErrors.push(`violations[${index}].questionRef invalid`);
    return null;
  }
  if (!candidateWording || !issueType || !reasonZh) return null;
  if (isUnsupportedPart1CertificationViolation(issueType, reasonZh, candidateWording, saferVersion)) return null;
  return {
    questionRef,
    issueType,
    severity: 'must_fix',
    candidateWording,
    saferVersion: saferVersion ? polishPart1RepairText(saferVersion) : undefined,
    reasonZh,
  };
};

const normalizeThreadLevelPatterns = (
  value: unknown,
  validationErrors: string[],
): NonNullable<SpeakingFeedback['threadFeedback']>['threadLevelPatterns'] =>
  asArray(value, 'threadFeedback.threadLevelPatterns', validationErrors)
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`threadFeedback.threadLevelPatterns[${index}] missing or invalid object`);
      const pattern = {
        observationZh: sanitizePart1FeedbackText(safeLearningText(asString(record.observationZh ?? record.observation, '', `threadFeedback.threadLevelPatterns[${index}].observationZh`, validationErrors))) || '',
        whyItMattersZh: sanitizePart1FeedbackText(safeLearningText(asString(record.whyItMattersZh ?? record.whyItMatters, '', `threadFeedback.threadLevelPatterns[${index}].whyItMattersZh`, validationErrors))) || '',
        retryRule: sanitizePart1FeedbackText(polishPart1RepairText(asString(record.retryRule ?? record.rule, '', `threadFeedback.threadLevelPatterns[${index}].retryRule`, validationErrors))) || '',
      };
      return isPart1TeamVariantAdviceText(`${pattern.observationZh} ${pattern.whyItMattersZh} ${pattern.retryRule}`)
        ? null
        : pattern;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item && item.observationZh && item.whyItMattersZh && item.retryRule))
    .slice(0, 4);

const normalizeNextRetryPlan = (
  value: unknown,
  validationErrors: string[],
): SpeakingNextRetryPlan | undefined => {
  if (!isRecord(value)) return undefined;
  const sanitizePlanText = (text: string | undefined) => {
    if (!text || isPart1TeamVariantAdviceText(text)) return undefined;
    const sanitized = sanitizePart1FeedbackText(text);
    return sanitizePart1TeamVariantAdviceText(sanitized);
  };
  const actions = optionalSafeStringArray(value.actions)
    ?.map(action => safeLearningText(action))
    .map(action => sanitizePlanText(action) || '')
    .filter(Boolean)
    .slice(0, 4);
  const plan = {
    priorityAccuracyPatternZh: sanitizePlanText(optionalSafeString(value.priorityAccuracyPatternZh)),
    answerLengthRuleZh: sanitizePlanText(optionalSafeString(value.answerLengthRuleZh)),
    materialToTry: sanitizePlanText(optionalSafeString(value.materialToTry)),
    actions,
  };
  if (!plan.priorityAccuracyPatternZh && !plan.answerLengthRuleZh && !plan.materialToTry && !plan.actions?.length) {
    validationErrors.push('threadFeedback.nextRetryPlan missing usable fields');
    return undefined;
  }
  return plan;
};

const part1OptionalDevelopmentSuggestion = (
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
): SpeakingNextRetryPlan | undefined => {
  const candidates = answers
    .map((answer, index) => ({
      questionRef: `Q${index + 1}`,
      answer: answer.answer.trim(),
      words: countWords(answer.answer),
    }))
    .filter(item => item.answer && item.words <= 18)
    .sort((a, b) => a.words - b.words);
  const target = candidates[0] || answers.map((answer, index) => ({
    questionRef: `Q${index + 1}`,
    answer: answer.answer.trim(),
    words: countWords(answer.answer),
  })).filter(item => item.answer).sort((a, b) => a.words - b.words)[0];
  if (!target) return undefined;
  const sourceWords = target.answer.split(/\s+/).slice(0, 8).join(' ');
  return {
    priorityAccuracyPatternZh: `${target.questionRef} is understandable, but it still needs one real detail or reason to support a fuller Part 1 answer.`,
    answerLengthRuleZh: 'Keep the original meaning and add only one real reason, example, feeling, or contrast; do not expand into a Part 2 mini-speech.',
    materialToTry: sourceWords ? `${sourceWords} + after moving back / what I missed most was ...` : undefined,
    actions: [`Start with ${target.questionRef} and add one detail from your real experience.`],
  };
};

const isPart1DevelopmentText = (text: string) =>
  /\b(reason|detail|specific|example|develop|rich|expand|one more|small|brief|personal|because|why|contrast|compare|underdeveloped|thin|too short|basic|bare answer)\b/.test(text);

const hasNegativePart1DevelopmentEvidence = (text: string) =>
  /\b(lack|lacks|lacking|need|needs|needed|should add|too short|underdeveloped|not developed|insufficient|limited|thin|bare|basic|only a direct answer|no detail|without detail)\b/.test(text) &&
  isPart1DevelopmentText(text);

const hasPositivePart1DevelopmentEvidence = (text: string) =>
  /\b(sufficient|adequate|appropriate|enough|well developed|well-developed|natural|direct|relevant detail|appropriate detail|provide appropriate detail|provides appropriate detail|do not over expand|does not over expand)\b/.test(text) &&
  /\b(detail|develop|answer|response|natural|direct|sufficient|adequate|appropriate)\b/.test(text);

const normalizePart1DevelopmentStatus = (value: unknown): Part1DevelopmentStatus | undefined =>
  value === 'needed' || value === 'sufficient' ? value : undefined;

const normalizePart1DevelopmentMode = (value: unknown): Part1DevelopmentTarget['developmentMode'] | undefined =>
  value === 'needs_content' || value === 'expression_upgrade' || value === 'no_extra_content' ? value : undefined;

const normalizePart1OptionalDevelopedAnswer = (
  value: unknown,
  learnerAnswer: string,
  diagnostics?: Part1DevelopmentDiagnostics,
) => {
  const raw = safeLearningText(optionalSafeString(value) || '');
  const cleaned = sanitizePart1FeedbackText(polishPart1RepairText(raw)) || '';
  if (!cleaned) return undefined;
  if (containsUnsupportedSpeakingBoundaryClaim(cleaned)) return undefined;
  const words = part1AnswerWords(cleaned);
  if (words.length < 5 || words.length > 45) return undefined;
  if (isUngroundedPart1Scaffold(cleaned, learnerAnswer)) {
    diagnostics && (diagnostics.ungroundedScaffoldsFiltered += 1);
    return undefined;
  }
  return cleaned;
};

const normalizePart1DevelopmentTargets = (
  value: unknown,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  validationErrors: string[],
  diagnostics?: Part1DevelopmentDiagnostics,
): Part1DevelopmentTarget[] => {
  const expectedRefs = answers.map((_, answerIndex) => `Q${answerIndex + 1}`);
  return asArray(value, 'threadFeedback.developmentTargets', validationErrors)
    .map((item, index): Part1DevelopmentTarget | null => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`threadFeedback.developmentTargets[${index}] missing or invalid object`);
      const questionRef = normalizeQuestionRefs(record.questionRef ? [record.questionRef] : record.questionRefs, answers)[0];
      const answerIndex = Number((questionRef || 'Q0').replace(/^Q/i, '')) - 1;
      const learnerAnswer = answers[answerIndex]?.answer || '';
      const reasonZh = sanitizePart1FeedbackText(
        safeLearningText(optionalSafeString(record.reasonZh ?? record.reason) || ''),
      ) || '';
      const developmentMoveZh = sanitizePart1FeedbackText(
        safeLearningText(asString(record.developmentMoveZh ?? record.developmentMove, '', `threadFeedback.developmentTargets[${index}].developmentMoveZh`, validationErrors)),
      ) || '';
      const developmentMode = normalizePart1DevelopmentMode(record.developmentMode ?? record.mode);
      const topicFrameZh = sanitizePart1FeedbackText(optionalSafeString(record.topicFrameZh ?? record.topicFrame));
      const optionalDevelopedAnswer = normalizePart1OptionalDevelopedAnswer(
        record.optionalDevelopedAnswer ?? record.developedAnswer ?? record.exampleAnswer,
        learnerAnswer,
        diagnostics,
      );
      const phraseScaffolds = optionalSafeStringArray(record.phraseScaffolds ?? record.expressionFrames ?? record.scaffolds)
        ?.map(item => safeLearningText(item))
        .filter(item => {
          if (!item || containsUnsupportedSpeakingBoundaryClaim(item)) return false;
          if (part1AnswerWords(item).length > MAX_PART1_DEVELOPMENT_CHUNK_WORDS || isPart1FullSentenceScaffold(item)) {
            diagnostics && (diagnostics.fullSentenceScaffoldsFiltered += 1);
            return false;
          }
          if (isUngroundedPart1Scaffold(item, learnerAnswer)) {
            diagnostics && (diagnostics.ungroundedScaffoldsFiltered += 1);
            return false;
          }
          return true;
        })
        .slice(0, 12);
      const providerPhraseChunks = (Array.isArray(record.phraseChunks) ? record.phraseChunks : [])
        .map((chunk): NonNullable<Part1DevelopmentTarget['phraseChunks']>[number] | null => {
          const chunkRecord = isRecord(chunk) ? chunk : {};
          const text = safeLearningText(isRecord(chunk) ? asString(chunkRecord.text ?? chunkRecord.phrase, '', `threadFeedback.developmentTargets[${index}].phraseChunks.text`, validationErrors) : '');
          if (!text || containsUnsupportedSpeakingBoundaryClaim(text) || isPart1FullSentenceScaffold(text) || isLowValueReusableSpokenLanguage(text)) return null;
          if (part1AnswerWords(text).length > MAX_PART1_DEVELOPMENT_CHUNK_WORDS) return null;
          const purposeZh = sanitizePart1DevelopmentPurpose(optionalSafeString(chunkRecord.purposeZh ?? chunkRecord.purpose));
          return purposeZh ? { text, purposeZh } : { text };
        })
        .filter((item): item is NonNullable<Part1DevelopmentTarget['phraseChunks']>[number] => Boolean(item))
        .slice(0, 12);
      const phraseChunks = providerPhraseChunks.length
        ? providerPhraseChunks
        : (phraseScaffolds || []).map(text => ({ text })).slice(0, 12);
      const hasVisibleDevelopmentPayload = Boolean(phraseChunks.length || optionalDevelopedAnswer);
      if (!questionRef || !expectedRefs.includes(questionRef)) return null;
      if (!hasVisibleDevelopmentPayload) return null;
      if (part1DevelopmentClaimContradictsAnswer(reasonZh, developmentMoveZh, learnerAnswer)) {
        diagnostics && (diagnostics.replacedForGrounding += 1);
        return null;
      }
      diagnostics && (diagnostics.accepted += 1);
      return {
        questionRef,
        ...(developmentMode ? { developmentMode } : {}),
        ...(topicFrameZh ? { topicFrameZh } : {}),
        reasonZh,
        developmentMoveZh,
        ...(phraseScaffolds?.length ? { phraseScaffolds: phraseScaffolds.slice(0, 12) } : {}),
        ...(phraseChunks.length ? { phraseChunks } : {}),
        ...(optionalDevelopedAnswer ? { optionalDevelopedAnswer } : {}),
      };
    })
    .filter((item): item is Part1DevelopmentTarget => Boolean(item))
    .filter((item, index, items) => items.findIndex(candidate => candidate.questionRef === item.questionRef) === index);
};

const normalizePart1MaterialItems = (
  value: unknown,
  path: string,
  kind: 'personal' | 'language',
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  validationErrors: string[],
): SpeakingMaterialBankItem[] => asArray(value, path, validationErrors).map((item, index) => {
  const record = isRecord(item) ? item : {};
  if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
  const built: SpeakingMaterialBankItem = {
    sourceWording: optionalSafeString(record.sourceWording ?? record.originalIdea),
    reusableVersion: polishPart1RepairText(asString(record.reusableVersion ?? record.naturalReusableVersion, FALLBACK_TEXT, `${path}[${index}].reusableVersion`, validationErrors)),
    reuseFor: optionalSafeStringArray(record.reuseFor ?? record.whereItMayBeReused) || [],
    explanationZh: sanitizePart1FeedbackText(optionalSafeString(record.explanationZh)),
    translationZh: sanitizePart1FeedbackText(optionalSafeString(record.translationZh ?? record.translation)),
    materialCore: optionalSafeString(record.materialCore ?? record.personalMaterialCore),
    part1UseCases: optionalSafeStringArray(record.part1UseCases ?? record.part1UseCase),
    developmentMoveZh: sanitizePart1FeedbackText(optionalSafeString(record.developmentMoveZh ?? record.developmentMove)),
    developedExample: optionalSafeString(record.developedExample),
    expressionFrames: optionalSafeStringArray(record.expressionFrames)
      ?.map(frame => safeLearningText(frame))
      .filter(frame => frame && !containsUnsupportedSpeakingBoundaryClaim(frame) && !isPart1FullSentenceScaffold(frame) && !isLowValueReusableSpokenLanguage(frame))
      .slice(0, 3),
    materialKey: optionalSafeString(record.materialKey ?? record.identityKey),
  };
  built.materialKind = kind === 'personal'
    ? normalizePart1MaterialKind(record.materialKind ?? record.kind, built)
    : undefined;
  if (built.materialKind === 'development_seed') {
    built.developedExample = undefined;
  }
  return built;
}).filter(item => {
  if (!item.reusableVersion || !item.reuseFor.length || containsUnsupportedSpeakingBoundaryClaim(item.reusableVersion)) return false;
  if (kind === 'personal') {
    return item.materialKind === 'development_seed'
      ? isValidPart1DevelopmentSeed(item, answers)
      : isValidGroundedPart1PersonalMaterial(item, answers);
  }
  return !isLowValueReusableSpokenLanguage(item.reusableVersion);
});

const consolidatePart1DevelopmentTargets = (targets: Part1DevelopmentTarget[]): Part1DevelopmentTarget[] => {
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

const PART1_LOW_INFORMATION_WORDS = new Set([
  'yes', 'no', 'yeah', 'yep', 'nope', 'definitely', 'sure', 'maybe', 'sometimes', 'usually', 'often',
  'i', 'me', 'my', 'mine', 'we', 'our', 'it', 'its', 'this', 'that', 'there', 'here',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am', 'do', 'does', 'did',
  'a', 'an', 'the', 'and', 'or', 'but', 'so', 'because', 'to', 'of', 'for', 'with', 'in', 'on', 'at', 'from',
  'thing', 'place', 'city', 'people', 'person', 'one', 'something', 'someone', 'somewhere', 'kind', 'type',
  'good', 'nice', 'great', 'bad', 'interesting', 'important',
]);

const part1AnswerWords = (text: string): string[] =>
  safeLearningText(text).toLowerCase().match(/[a-z]+(?:'[a-z]+)?|[0-9]+/g) || [];

const part1AnswerContentWords = (text: string) =>
  part1AnswerWords(text).filter(word => word.length > 2 && !PART1_LOW_INFORMATION_WORDS.has(word));

const hasPart1GroundedAnswerDetail = (answer: string) => {
  const clean = safeLearningText(answer);
  const words = part1AnswerWords(clean);
  const contentWords = part1AnswerContentWords(clean);
  if (words.length >= 11 && contentWords.length >= 3) return true;
  if (splitSentences(clean).length >= 2 && contentWords.length >= 3) return true;
  if (/\b(because|so|although|though|but|when|where|which|that|while|apart from|instead of|compared with|rather than)\b/i.test(clean) && contentWords.length >= 3) return true;
  if (/\b\d+(?:\.\d+)?\b/.test(clean) && contentWords.length >= 2) return true;
  if (/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/.test(clean) && contentWords.length >= 2) return true;
  if (/\b[a-z]+-[a-z]+\b/i.test(clean) && contentWords.length >= 2) return true;
  if (/\b(born|raised|grew|grown|live|lived|living|study|studied|work|worked|family|friend|friends|parents|classmates|colleagues|teammates|favorite|favourite|prefer|enjoy|relax|attached|experience|habit)\b/i.test(clean) && contentWords.length >= 2) return true;
  return false;
};

const hasPart1RangeOrDevelopmentEvidence = (answer: string) => {
  const clean = safeLearningText(answer);
  const contentWords = part1AnswerContentWords(clean);
  const words = part1AnswerWords(clean);
  if (contentWords.length < 3) return false;
  return /\b(because|so|although|though|but|when|where|which|while|rather than|instead of|after|before|since|the reason|what i|what mattered|what i missed|i missed|i prefer|i enjoy|i felt|it helps|that is why)\b/i.test(clean) ||
    (words.length >= 14 && /\b(college|university|school|team|work|job|moved|returned|spent|years?|months?|usually|often|prefer|enjoy|missed|felt)\b/i.test(clean));
};

const isPart1EvidenceLimitedAccurateThread = (
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  hasOrdinaryMustFix: boolean,
) => {
  if (hasOrdinaryMustFix || answers.length < 3) return false;
  const answerWords = answers.map(answer => countWords(answer.answer));
  const totalWords = answerWords.reduce((total, words) => total + words, 0);
  const allAnswersConcise = answerWords.every(words => words <= 22);
  const developedRangeCount = answers.filter(answer => hasPart1RangeOrDevelopmentEvidence(answer.answer)).length;
  const bareCount = answers.filter(answer => isBarePart1Answer(answer.answer)).length;
  return bareCount > 0 || (allAnswersConcise && totalWords <= Math.max(56, answers.length * 14) && developedRangeCount < 2);
};

const PART1_EVIDENCE_LIMITED_ESTIMATE_NOTE_ZH =
  '语言基本准确，但这一组回答还没有展示足够真实细节和语言范围；先补一个高价值细节，再判断是否能稳定到更高区间。';

const isBarePart1Answer = (answer: string) => {
  const clean = safeLearningText(answer).trim();
  const normalized = clean.toLowerCase().replace(/[^\p{L}\p{N}\s'-]+/gu, ' ').replace(/\s+/g, ' ').trim();
  const words = part1AnswerWords(clean);
  if (!normalized) return true;
  if (/^(yes|no|yeah|yep|nope|sure|of course|not really|maybe|sometimes|usually|definitely)$/.test(normalized)) return true;
  if (/^(it'?s|it is|this is|that is|there is)?\s*(a\s+)?(city|place|thing|sport|hobby|subject|person|one)$/.test(normalized)) return true;
  if (words.length <= 3 && part1AnswerContentWords(clean).length <= 1) return true;
  return false;
};

const derivePart1SessionPriorityState = (
  certificationStatus: Part1DisplayedCleanRetryCertificationStatus | undefined,
  hasOrdinaryMustFix: boolean,
  previousCleanerConflictCount: number,
  developmentTargets: Part1DevelopmentTarget[],
): Part1SessionPriorityState => {
  if (hasOrdinaryMustFix) return 'core_repair_needed';
  if (previousCleanerConflictCount > 0) return 'system_revision_conflict';
  const certificationPassed = certificationStatus === 'certified_first_attempt' || certificationStatus === 'certified_after_rewrite';
  if (certificationPassed && developmentTargets.length > 0) return 'development_needed';
  if (certificationPassed) return 'topic_complete';
  return developmentTargets.length > 0 ? 'development_needed' : 'core_repair_needed';
};

const annotationsFromThreadItems = (
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  mustFix: Array<{
    questionRefs: string[];
    learnerWording: string;
    betterVersion: string;
    explanationZh: string;
    recurring?: boolean;
    origin?: Part1AnnotationOrigin;
    priorCertificationStatus?: Part1DisplayedCleanRetryCertificationStatus;
  }>,
  phraseFixes: Array<{ questionRefs: string[]; original: string; better: string; explanationZh: string }>,
  optionalPolish: Array<{ questionRefs: string[]; original: string; better: string; explanationZh: string }>,
  retryReference?: Part1RetryReferenceContext,
): Part1AnswerAnnotation[] => {
  const built: Part1AnswerAnnotation[] = [];
  const pushItem = (
    questionRef: string,
    sourceQuote: string,
    layer: Part1AnswerAnnotationLayer,
    combinedRepair?: string,
  ) => {
    const quote = exactQuoteInAnswer(sourceQuote);
    if (!quote) return;
    const answerIndex = Number(questionRef.replace(/^Q/i, '')) - 1;
    const answer = answers[answerIndex]?.answer || '';
    if (!normalizeTranscriptFormatText(answer).includes(normalizeTranscriptFormatText(quote))) return;
    const existing = built.find(item => item.questionRef === questionRef && item.sourceQuote === quote);
    if (existing) {
      existing.layers.push(layer);
      existing.combinedRepair = existing.combinedRepair || combinedRepair;
      return;
    }
    built.push({
      id: `p1_ann_${questionRef}_${built.length + 1}`,
      questionRef,
      sourceQuote: quote,
      layers: [layer],
      combinedRepair,
    });
  };
  mustFix.forEach(item => item.questionRefs.forEach(questionRef => {
    const answerIndex = Number(questionRef.replace(/^Q/i, '')) - 1;
    const baseLayer: Part1AnswerAnnotationLayer = {
    severity: 'must_fix',
    issueType: item.recurring ? 'recurring must-fix' : 'must-fix',
    original: item.learnerWording,
    better: item.betterVersion,
    explanationZh: item.explanationZh,
    origin: item.origin,
    priorCertificationStatus: item.priorCertificationStatus,
  };
    pushItem(
      questionRef,
      item.learnerWording,
      withPart1PreviousCleanerConflictAttribution(
        baseLayer,
        questionRef,
        item.learnerWording,
        answers[answerIndex]?.answer || '',
        retryReference,
      ),
      item.betterVersion,
    );
  }));
  phraseFixes.forEach(item => item.questionRefs.forEach(questionRef => pushItem(questionRef, item.original, {
    severity: 'better_spoken_choice',
    issueType: 'better spoken choice',
    original: item.original,
    better: item.better,
    explanationZh: item.explanationZh,
  }, item.better)));
  optionalPolish.forEach(item => item.questionRefs.forEach(questionRef => pushItem(questionRef, item.original, {
    severity: 'optional_polish',
    issueType: 'optional polish',
    original: item.original,
    better: item.better,
    explanationZh: item.explanationZh,
  }, item.better)));
  return built;
};

const normalizePart1TopicThreadFeedback = (
  source: Record<string, unknown>,
  request: SpeakingRequest,
  validationErrors: string[],
  normalizedFields: string[],
): SpeakingFeedback => {
  normalizedFields.push('part1TopicThread');
  const answers = (request.threadAnswers || []).filter(answer => answer.answer.trim());
  const combinedTranscript = answers
    .map((answer, index) => `Q${index + 1}: ${answer.question}\nA${index + 1}: ${answer.answer}`)
    .join('\n\n');
  const transcriptWords = countWords(combinedTranscript);
  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const structurallyValidRange = normalizeValidSpeakingBandEstimateRange(source.bandEstimateRange);
  const scalarValid = isValidSpeakingScalarEstimate(source.bandEstimateExcludingPronunciation);
  const recoveredScoreFromRange = !scalarValid && Boolean(structurallyValidRange);
  if (!scalarValid) normalizedFields.push('part1ScoreScalarInvalid:true');
  if (recoveredScoreFromRange) normalizedFields.push('part1ScoreRecoveredFromRange:true');
  if (!scalarValid && !structurallyValidRange) {
    normalizedFields.push('part1ScoreRangeInvalid:true');
    validationErrors.push('part1 score estimate missing or invalid and no usable estimate range was supplied');
  }
  const rawHeadline = scalarValid
    ? source.bandEstimateExcludingPronunciation as number
    : structurallyValidRange?.lower ?? 0;
  const headline = recoveredScoreFromRange
    ? normalizeHalfBandScore(rawHeadline)
    : normalizeHalfBandScore(applyLengthCap(rawHeadline, transcriptWords, Math.max(45, answers.length * 14)));
  const visibleScores = {
    fluencyCoherence: normalizeHalfBandScore(asNumber(scores.fluencyCoherence, 'scores.fluencyCoherence', validationErrors, headline)),
    lexicalResource: normalizeHalfBandScore(asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors, headline)),
    grammaticalRangeAccuracy: normalizeHalfBandScore(asNumber(scores.grammaticalRangeAccuracy, 'scores.grammaticalRangeAccuracy', validationErrors, headline)),
  };
  const threadSource = isRecord(source.threadFeedback) ? source.threadFeedback : source;
  const mustFix = asArray(threadSource.mustFix, 'threadFeedback.mustFix', validationErrors).map((item, index) => {
    const record = isRecord(item) ? item : {};
    if (!isRecord(item)) validationErrors.push(`threadFeedback.mustFix[${index}] missing or invalid object`);
    const questionRefs = normalizeQuestionRefs(record.questionRefs ?? record.affectedQuestions, answers);
    const learnerWording = safeLearningText(asString(record.learnerWording ?? record.original, FALLBACK_TEXT, `threadFeedback.mustFix[${index}].learnerWording`, validationErrors));
    const betterVersion = safeLearningText(asString(record.betterVersion ?? record.correction, FALLBACK_TEXT, `threadFeedback.mustFix[${index}].betterVersion`, validationErrors));
    const explanationZh = safeLearningText(asString(record.explanationZh, 'Provider feedback was incomplete; this item was normalized safely.', `threadFeedback.mustFix[${index}].explanationZh`, validationErrors));
    const answerIndex = Number((questionRefs[0] || 'Q1').replace(/^Q/i, '')) - 1;
    const repair = normalizePart1RepairLayer(learnerWording, betterVersion, 'threadFeedback.mustFix', explanationZh, answers[answerIndex]?.answer || '');
    if (!repair) return null;
    if (isAcceptablePart1RegionalOrStyleVariant(repair.original, repair.better, 'threadFeedback.mustFix', repair.explanationZh)) return null;
    // Learner-safety guard: do not preserve a provider MUST FIX whose only support is an unsafe absolute rule for context-dependent usage.
    if (hasOverAbsoluteContextDependentClaim(explanationZh) && /\b(collocation|word choice|natural|countability|countable|uncountable|article)\b/.test(`threadFeedback.mustFix ${explanationZh}`.toLowerCase())) return null;
    return {
      questionRefs,
      learnerWording: repair.original,
      betterVersion: repair.better,
      explanationZh: repair.explanationZh,
      recurring: Boolean(record.recurring),
      origin: normalizePart1AnnotationOrigin(record.origin),
      priorCertificationStatus: normalizePart1DisplayedCertificationStatus(record.priorCertificationStatus),
    };
  }).filter((item): item is {
    questionRefs: string[];
    learnerWording: string;
    betterVersion: string;
    explanationZh: string;
    recurring: boolean;
    origin: Part1AnnotationOrigin | undefined;
    priorCertificationStatus: Part1DisplayedCleanRetryCertificationStatus | undefined;
  } => Boolean(item && (
    item.questionRefs.length &&
    item.learnerWording &&
    item.betterVersion &&
    item.explanationZh
  )));
  const mustFixWithAttribution = mustFix.map(item => {
    const conflictRef = item.questionRefs.find(questionRef => {
      const answerIndex = Number(questionRef.replace(/^Q/i, '')) - 1;
      return isGroundedPreviousCleanerConflict(
        questionRef,
        item.learnerWording,
        item.learnerWording,
        item.betterVersion,
        answers[answerIndex]?.answer || '',
        request.retryReference,
      );
    });
    if (!conflictRef) return { ...item, origin: item.origin === 'previous_cleaner_answer_conflict' ? 'learner' as const : item.origin };
    const prior = part1RetryReferenceByQuestion(request.retryReference).get(conflictRef);
    return {
      ...item,
      origin: 'previous_cleaner_answer_conflict' as const,
      priorCertificationStatus: item.priorCertificationStatus || prior?.certificationStatus,
    };
  });

  const answerByAnswerCoaching = asArray(threadSource.answerByAnswerCoaching, 'threadFeedback.answerByAnswerCoaching', validationErrors).map((item, index) => {
    const record = isRecord(item) ? item : {};
    if (!isRecord(item)) validationErrors.push(`threadFeedback.answerByAnswerCoaching[${index}] missing or invalid object`);
    return {
      questionRefs: normalizeQuestionRefs(record.questionRefs, answers),
      issue: sanitizePart1FeedbackText(safeLearningText(asString(record.issue, FALLBACK_TEXT, `threadFeedback.answerByAnswerCoaching[${index}].issue`, validationErrors))) || '',
      coachingZh: sanitizePart1FeedbackText(safeLearningText(asString(record.coachingZh, 'Provider feedback was incomplete; this item was normalized safely.', `threadFeedback.answerByAnswerCoaching[${index}].coachingZh`, validationErrors))) || '',
      exampleFrame: optionalSafeString(record.exampleFrame),
    };
  }).filter(item => item.questionRefs.length && item.issue && item.coachingZh);
  const materialSource = isRecord(threadSource.materialBank) ? threadSource.materialBank : {};
  const highImpactPhraseFixes = normalizeThreadPhraseItems(threadSource.highImpactPhraseFixes, answers, validationErrors, 'threadFeedback.highImpactPhraseFixes', normalizedFields);
  const optionalPolish = normalizeThreadPhraseItems(threadSource.optionalPolish, answers, validationErrors, 'threadFeedback.optionalPolish', normalizedFields);
  const cleanRetryValidationWarnings: string[] = [];
  const providerCleanRetryAnswers = normalizePart1CleanRetryAnswers(threadSource.cleanRetryAnswers ?? [], answers, cleanRetryValidationWarnings);
  if (cleanRetryValidationWarnings.length) {
    normalizedFields.push(`part1CleanRetryProviderWarnings:${cleanRetryValidationWarnings.length}`);
  }
  const annotationDiagnostics: Part1AnnotationDiagnostics = {
    severityDowngradedFromMustFix: 0,
    cleanerConflictsFound: 0,
    cleanerConflictsResolved: 0,
    incompleteLayersDropped: 0,
  };
  const providerAnnotations = normalizePart1AnswerAnnotations(threadSource.annotations ?? [], answers, validationErrors, request.retryReference, annotationDiagnostics);
  const fallbackAnnotations = annotationsFromThreadItems(answers, mustFixWithAttribution, highImpactPhraseFixes, optionalPolish, request.retryReference);
  const mergedAnnotationCandidates = mergePart1AnswerAnnotations(providerAnnotations, fallbackAnnotations);
  const cleanRetryCompletion = completePart1CleanRetryAnswers(
    providerCleanRetryAnswers,
    answers,
    mergedAnnotationCandidates,
    request.retryReference,
  );
  const cleanRetryRecoveryRefs: string[] = [];
  const cleanRetryAnswers = cleanRetryCompletion.answers.map((cleanRetry, index) => {
    const sourceAnswer = answers[index];
    if (!sourceAnswer) return cleanRetry;
    const recovered = repairUnderresponsivePart1CleanRetryAnswer(sourceAnswer, cleanRetry);
    if (recovered.answer !== cleanRetry.answer) cleanRetryRecoveryRefs.push(recovered.questionRef);
    return recovered;
  });
  if (cleanRetryRecoveryRefs.length) {
    normalizedFields.push(`part1CleanRetryDescriptionIntegrated:${cleanRetryRecoveryRefs.join(',')}`);
  }
  if (cleanRetryCompletion.filledRefs.length) {
    normalizedFields.push(`part1CleanRetryFilled:${cleanRetryCompletion.filledRefs.join(',')}`);
    normalizedFields.push(`part1CleanRetryFallbackSources:${cleanRetryCompletion.fallbackSources.join(',')}`);
  }
  const annotations = resolvePart1AnnotationCleanerConsistency(
    mergedAnnotationCandidates,
    cleanRetryAnswers,
    annotationDiagnostics,
  );
  const previousCleanerConflictCount = annotations.reduce(
    (count, annotation) => count + annotation.layers.filter(layer => layer.origin === 'previous_cleaner_answer_conflict').length,
    0,
  );
  normalizedFields.push(`part1ProviderAnnotations:${providerAnnotations.length}`);
  normalizedFields.push(`part1FallbackAnnotationCandidates:${fallbackAnnotations.length}`);
  normalizedFields.push(`part1RenderedAnnotations:${annotations.length}`);
  normalizedFields.push(`part1RenderedAnnotationLayers:${annotations.reduce((total, annotation) => total + annotation.layers.length, 0)}`);
  normalizedFields.push(`part1PreviousCleanerConflicts:${previousCleanerConflictCount}`);
  normalizedFields.push(`part1SeverityDowngradedFromMustFix:${annotationDiagnostics.severityDowngradedFromMustFix}`);
  normalizedFields.push(`part1AnnotationCleanerConflictsFound:${annotationDiagnostics.cleanerConflictsFound}`);
  normalizedFields.push(`part1AnnotationCleanerConflictsResolved:${annotationDiagnostics.cleanerConflictsResolved}`);
  if (annotationDiagnostics.incompleteLayersDropped) {
    normalizedFields.push(`part1AnnotationLayersDroppedIncomplete:${annotationDiagnostics.incompleteLayersDropped}`);
  }
  const threadLevelPatterns = normalizeThreadLevelPatterns(threadSource.threadLevelPatterns ?? [], validationErrors);
  const nextRetryPlan = normalizeNextRetryPlan(threadSource.nextRetryPlan, validationErrors);
  const hasOrdinaryMustFix = mustFixWithAttribution.some(item => item.origin !== 'previous_cleaner_answer_conflict');
  const evidenceLimitedAccurateThread = isPart1EvidenceLimitedAccurateThread(answers, hasOrdinaryMustFix);
  const developmentEvidenceText = [
    nextRetryPlan?.priorityAccuracyPatternZh,
    nextRetryPlan?.answerLengthRuleZh,
    nextRetryPlan?.materialToTry,
    ...(nextRetryPlan?.actions || []),
    ...threadLevelPatterns.flatMap(item => [item.observationZh, item.whyItMattersZh, item.retryRule]),
    ...answerByAnswerCoaching.flatMap(item => [item.issue, item.coachingZh, item.exampleFrame || '']),
  ].join(' ').toLowerCase();
  const hasOptionalDevelopmentGuidance = hasNegativePart1DevelopmentEvidence(developmentEvidenceText);
  const rationaleText = `${optionalSafeString(source.estimateRationaleZh) || ''} ${isRecord(source.bandEstimateRange) ? optionalSafeString(source.bandEstimateRange.rationaleZh) || '' : ''}`;
  const normalizedRationaleText = rationaleText.toLowerCase();
  const thinAnswerCount = answers.filter(answer => countWords(answer.answer) <= 18).length;
  const providerDevelopmentStatus = normalizePart1DevelopmentStatus(threadSource.developmentStatus);
  const developmentDiagnostics: Part1DevelopmentDiagnostics = {
    accepted: 0,
    replacedForGrounding: 0,
    fullSentenceScaffoldsFiltered: 0,
    ungroundedScaffoldsFiltered: 0,
  };
  const providerDevelopmentTargets = normalizePart1DevelopmentTargets(threadSource.developmentTargets, answers, validationErrors, developmentDiagnostics);
  const providerSaysDevelopmentSufficient = providerDevelopmentStatus === 'sufficient' &&
    providerDevelopmentTargets.length === 0 &&
    hasPositivePart1DevelopmentEvidence(normalizedRationaleText) &&
    !evidenceLimitedAccurateThread;
  const limitedByThinDevelopment = (
    evidenceLimitedAccurateThread ||
    hasNegativePart1DevelopmentEvidence(normalizedRationaleText) ||
    (
      !providerSaysDevelopmentSufficient &&
      providerDevelopmentStatus !== 'sufficient' &&
      headline <= 7 &&
      thinAnswerCount >= Math.max(1, Math.ceil(answers.length / 2))
    )
  );
  const rawDevelopmentTargets = providerDevelopmentTargets;
  const developmentTargets = consolidatePart1DevelopmentTargets(rawDevelopmentTargets);
  normalizedFields.push(`part1DevelopmentTargetsAccepted:${developmentDiagnostics.accepted}`);
  normalizedFields.push(`part1DevelopmentTargetsReplacedForGrounding:${developmentDiagnostics.replacedForGrounding}`);
  normalizedFields.push(`part1FullSentenceScaffoldsFiltered:${developmentDiagnostics.fullSentenceScaffoldsFiltered}`);
  normalizedFields.push(`part1UngroundedScaffoldsFiltered:${developmentDiagnostics.ungroundedScaffoldsFiltered}`);
  normalizedFields.push(`part1DevelopmentTargets:${developmentTargets.length}`);
  if (rawDevelopmentTargets.length !== developmentTargets.length) {
    normalizedFields.push(`part1DevelopmentTargetsConsolidated:${rawDevelopmentTargets.length}->${developmentTargets.length}`);
  }
  const developmentStatus: Part1DevelopmentStatus = developmentTargets.length ? 'needed' : 'sufficient';
  const evidenceLimitedEstimate = evidenceLimitedAccurateThread &&
    developmentTargets.length > 0 &&
    !hasOrdinaryMustFix &&
    previousCleanerConflictCount === 0;
  const evidenceAwareHeadline = evidenceLimitedEstimate && headline >= 6.5
    ? 6.0
    : headline;
  const evidenceAwareScores = evidenceLimitedEstimate
    ? {
      fluencyCoherence: Math.min(visibleScores.fluencyCoherence, evidenceAwareHeadline),
      lexicalResource: Math.min(visibleScores.lexicalResource, evidenceAwareHeadline),
      grammaticalRangeAccuracy: Math.min(visibleScores.grammaticalRangeAccuracy, evidenceAwareHeadline),
    }
    : visibleScores;
  if (evidenceAwareHeadline !== headline) {
    normalizedFields.push(`part1EvidenceLimitedEstimate:${headline}->${evidenceAwareHeadline}`);
  }
  const coherentNextRetryPlan = !hasOptionalDevelopmentGuidance && limitedByThinDevelopment
    ? part1OptionalDevelopmentSuggestion(answers)
    : nextRetryPlan;
  if (coherentNextRetryPlan && coherentNextRetryPlan !== nextRetryPlan) {
    normalizedFields.push('part1OptionalDevelopmentGuidanceAdded');
  }
  const providerMyUsableMaterial = normalizePart1MaterialItems(materialSource.myUsableMaterial, 'threadFeedback.materialBank.myUsableMaterial', 'personal', answers, validationErrors);
  const myUsableMaterial: SpeakingMaterialBankItem[] = [...providerMyUsableMaterial];
  myUsableMaterial.sort((left, right) => part1MaterialValueRank(right) - part1MaterialValueRank(left));
  normalizedFields.push(`part1MaterialSeedsDisplayed:${myUsableMaterial.filter(item => item.materialKind === 'development_seed').length}`);
  normalizedFields.push(`part1ReusableMaterialsDisplayed:${myUsableMaterial.filter(item => item.materialKind !== 'development_seed').length}`);
  normalizedFields.push('part1MaterialSemanticDuplicatesRemoved:0');
  const personalMaterialKeys = new Set(myUsableMaterial.flatMap(item => [
    part1AnnotationKeyText(item.sourceWording || ''),
    part1AnnotationKeyText(item.reusableVersion),
  ]).filter(Boolean));
  const reusableSpokenLanguage = normalizePart1MaterialItems(materialSource.reusableSpokenLanguage, 'threadFeedback.materialBank.reusableSpokenLanguage', 'language', answers, validationErrors)
    .filter(item => {
      const sourceKey = part1AnnotationKeyText(item.sourceWording || '');
      const reusableKey = part1AnnotationKeyText(item.reusableVersion);
      return !personalMaterialKeys.has(sourceKey) && !personalMaterialKeys.has(reusableKey);
    });
  const rationaleFallback = 'Ideal-delivery estimate: grammar, vocabulary, answer focus and Part 1 control were considered.';
  const bandEstimateRange = recoveredScoreFromRange
    ? structurallyValidRange
    : normalizeSpeakingBandEstimateRange(source.bandEstimateRange, headline, false, normalizedFields);
  const evidenceAwareBandEstimateRange = evidenceLimitedEstimate && bandEstimateRange && bandEstimateRange.lower >= 6.5
    ? {
      lower: 5.5,
      upper: 6.0,
      rationaleZh: PART1_EVIDENCE_LIMITED_ESTIMATE_NOTE_ZH,
    }
    : bandEstimateRange;
  if (evidenceAwareBandEstimateRange !== bandEstimateRange) {
    normalizedFields.push('part1EvidenceLimitedRangeAdjusted');
  }
  const safeBandEstimateRange = evidenceAwareBandEstimateRange && (
    containsUnsupportedSpeakingBoundaryClaim(evidenceAwareBandEstimateRange.rationaleZh) ||
    isPart1TeamVariantAdviceText(evidenceAwareBandEstimateRange.rationaleZh)
  )
    ? { ...evidenceAwareBandEstimateRange, rationaleZh: evidenceLimitedEstimate ? PART1_EVIDENCE_LIMITED_ESTIMATE_NOTE_ZH : rationaleFallback }
    : evidenceAwareBandEstimateRange;
  const rawNextRetryFocusZh = safeLearningText(asString(threadSource.nextRetryFocusZh ?? source.nextStepZh, 'Next time, answer directly, add one real detail, then stop.', 'threadFeedback.nextRetryFocusZh', validationErrors));
  const nextRetryFocusZh = sanitizePart1TeamVariantAdviceText(sanitizePart1FeedbackText(
    sanitizePart1TeamVariantAdviceText(rawNextRetryFocusZh) || 'Next time, answer directly, add one real detail, then stop.',
    'Next time, answer directly, add one real detail, then stop.',
  ));

  const feedbackWithoutMarkdown: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'speaking',
    part: 1,
    sessionKind: 'part1_topic_thread',
    topic: request.topic || optionalSafeString(source.topic),
    threadId: request.threadId,
    threadAnswers: answers,
    part1RetryReference: request.retryReference,
    threadFeedback: {
      topic: request.topic || optionalSafeString(threadSource.topic) || 'Part 1 Topic',
      threadId: request.threadId || optionalSafeString(threadSource.threadId) || 'part1_thread',
      questionCount: answers.length,
      mustFix: mustFixWithAttribution,
      annotations,
      cleanRetryAnswers,
      cleanRetryCertificationStatus: normalizePart1DisplayedCertificationStatus(threadSource.cleanRetryCertificationStatus),
      part1SessionPriorityState: derivePart1SessionPriorityState(
        normalizePart1DisplayedCertificationStatus(threadSource.cleanRetryCertificationStatus),
        hasOrdinaryMustFix,
        previousCleanerConflictCount,
        developmentTargets,
      ),
      developmentStatus,
      developmentTargets,
      threadLevelPatterns,
      answerByAnswerCoaching,
      highImpactPhraseFixes,
      materialBank: {
        myUsableMaterial,
        reusableSpokenLanguage,
      },
      optionalPolish,
      nextRetryPlan: coherentNextRetryPlan,
      nextRetryFocusZh: nextRetryFocusZh || 'Next time, answer directly, add one real detail, then stop.',
      previousCleanerConflictCount,
    },
    question: answers.map((answer, index) => `Q${index + 1}. ${answer.question}`).join('\n'),
    transcript: combinedTranscript,
    bandEstimateExcludingPronunciation: evidenceAwareHeadline,
    bandEstimateRange: safeBandEstimateRange,
    estimateRationaleZh: evidenceLimitedEstimate
      ? PART1_EVIDENCE_LIMITED_ESTIMATE_NOTE_ZH
      : sanitizePart1TeamVariantAdviceText(sanitizePart1FeedbackText(optionalSafeString(source.estimateRationaleZh), rationaleFallback)) || rationaleFallback,
    speakingCeilingDiagnosis: normalizeSpeakingCeilingDiagnosis(source.speakingCeilingDiagnosis),
    targetAnswerStatus: 'not_applicable',
    scores: {
      ...evidenceAwareScores,
      pronunciation: null,
      pronunciationNote: 'Pronunciation is not formally assessed in Part 1 topic-thread transcript practice.',
    },
    fatalErrors: mustFixWithAttribution.filter(item => item.origin !== 'previous_cleaner_answer_conflict').map(item => ({
      original: `${item.questionRefs.join(' / ')}: ${item.learnerWording}`,
      correction: item.betterVersion,
      tag: item.recurring ? 'recurring_must_fix' : 'must_fix',
      explanationZh: item.explanationZh,
    })),
    naturalnessHints: highImpactPhraseFixes.map(item => ({
      original: `${item.questionRefs.join(' / ')}: ${item.original}`,
      better: item.better,
      tag: 'high_impact_phrase_fix',
      explanationZh: item.explanationZh,
    })),
    band9Refinements: [],
    preservedStyle: myUsableMaterial.filter(item => item.materialKind !== 'development_seed').map(item => ({
      text: item.sourceWording || item.reusableVersion,
      reasonZh: item.explanationZh || 'This is grounded personal material that can support future answers.',
      sampleNextStep: item.reusableVersion,
      transferQuestions: item.reuseFor,
    })),
    upgradedAnswer: '',
    reusableExample: null,
  };

  return {
    ...feedbackWithoutMarkdown,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(feedbackWithoutMarkdown),
  };
};

const PART3_QUESTION_FRAMES: Part3QuestionFrame[] = [
  'cause_reason',
  'change_trend',
  'evaluation_stance',
  'comparison_contrast',
  'advantages_disadvantages',
  'solution_suggestion',
  'category_criteria',
  'consequence_impact',
];

const part3QuestionFrameFallback = (question: string): Part3QuestionFrame => {
  const normalized = question.toLowerCase().replace(/[’‘`]/g, "'");
  if (/advantage|disadvantage|benefit|drawback|pros and cons/.test(normalized)) return 'advantages_disadvantages';
  if (/difference|different|compare|which .*more important|which .*better|prefer|rather|than|young .* old|older .* young/.test(normalized)) return 'comparison_contrast';
  if (/change|changed|in recent years|nowadays|in the past|these days/.test(normalized)) return 'change_trend';
  if (/impact|effect|influence|affect|result|consequence/.test(normalized)) return 'consequence_impact';
  if (/what kind|what kinds|what type|what types|qualities|features|characteristics|criteria|what makes/.test(normalized)) return 'category_criteria';
  if (/how can|how could|what can .*do|what should .*do|ways? to|solve|reduce|encourage|protect|improve/.test(normalized)) return 'solution_suggestion';
  if (/why|causes?|reasons?|motivates?|leads to|makes people/.test(normalized)) return 'cause_reason';
  return 'evaluation_stance';
};

const part3QuestionFrameLabelZh = (frame: Part3QuestionFrame): string => {
  if (frame === 'cause_reason') return '原因分析题';
  if (frame === 'change_trend') return '变化趋势题';
  if (frame === 'comparison_contrast') return '比较对照题';
  if (frame === 'advantages_disadvantages') return '利弊权衡题';
  if (frame === 'solution_suggestion') return '解决方案题';
  if (frame === 'category_criteria') return '分类标准题';
  if (frame === 'consequence_impact') return '影响结果题';
  return '观点判断题';
};

const part3QuestionFrameGuidanceZh = (frame: Part3QuestionFrame): string => {
  if (frame === 'cause_reason') return '这是原因题。先给一个直接原因，再补一层现实、心理或社会原因。';
  if (frame === 'change_trend') return '这是变化题。先说变化方向，再解释背后的驱动因素和影响。';
  if (frame === 'comparison_contrast') return '这是比较题。重点不是简单 yes/no，而是比较两类人、两个时代或两种场景。';
  if (frame === 'advantages_disadvantages') return '这是利弊题。先承认一边，再指出另一边的代价或边界。';
  if (frame === 'solution_suggestion') return '这是 solution 题。不要只给一个措施，最好按两个方向拆开，再补具体动作。';
  if (frame === 'category_criteria') return '这是分类题。不要只讲一个例子，最好给 2-3 类，并说明为什么重要。';
  if (frame === 'consequence_impact') return '这是影响题。先说直接影响，再推进到长期或更广泛的结果。';
  return '这是评价题。先给有边界的立场，再用原因、例子或条件支撑，避免绝对化。';
};

const normalizePart3QuestionFrame = (value: unknown, fallback: Part3QuestionFrame): Part3QuestionFrame =>
  typeof value === 'string' && PART3_QUESTION_FRAMES.includes(value as Part3QuestionFrame)
    ? value as Part3QuestionFrame
    : fallback;

const PART3_FEEDBACK_MODES: Part3FeedbackMode[] = [
  'language_repair',
  'reasoning_upgrade',
  'part3_generalisation',
  'answer_scope',
  'precision_upgrade',
  'compression_upgrade',
  'nuance_upgrade',
  'micro_upgrade',
];

const normalizePart3FeedbackMode = (
  value: unknown,
  microUpgrade?: Part3MicroUpgrade,
  ctChain?: Part3CriticalThinkingChain,
  questionFrame?: Part3QuestionFrame,
): Part3FeedbackMode => {
  if (typeof value === 'string' && PART3_FEEDBACK_MODES.includes(value as Part3FeedbackMode)) {
    return value as Part3FeedbackMode;
  }
  if (questionFrame === 'category_criteria') return 'answer_scope';
  if (microUpgrade?.focusZh && !ctChain?.missingLinkZh && !ctChain?.nextMoveZh) return 'micro_upgrade';
  if (ctChain?.missingLinkZh || ctChain?.nextMoveZh) return 'reasoning_upgrade';
  return 'reasoning_upgrade';
};

const normalizePart3HighlightRole = (value: unknown): Part3TargetAnswerHighlightRole | undefined => {
  if (
    value === 'claim' ||
    value === 'reason' ||
    value === 'example' ||
    value === 'contrast' ||
    value === 'consequence' ||
    value === 'language'
  ) {
    return value;
  }
  return undefined;
};

const normalizePart3CtChain = (
  value: unknown,
  frame: Part3QuestionFrame,
): Part3CriticalThinkingChain => {
  const source = isRecord(value) ? value : {};
  const chain = {
    claim: optionalSafeString(source.claim),
    reason: optionalSafeString(source.reason),
    exampleOrEvidence: optionalSafeString(source.exampleOrEvidence ?? source.example ?? source.evidence),
    contrastOrCondition: optionalSafeString(source.contrastOrCondition ?? source.contrast ?? source.condition),
    consequence: optionalSafeString(source.consequence ?? source.impact),
    missingLinkZh: optionalSafeString(source.missingLinkZh),
    nextMoveZh: optionalSafeString(source.nextMoveZh) || part3QuestionFrameGuidanceZh(frame),
  };
  return Object.fromEntries(
    Object.entries(chain)
      .map(([key, item]) => [key, typeof item === 'string' ? safeLearningText(item) : item] as const)
      .filter(([, item]) => Boolean(item)),
) as Part3CriticalThinkingChain;
};

const safePart3ReusableFrame = (value: unknown): string | undefined => {
  const frame = optionalSafeString(value);
  if (!frame) return undefined;
  if (/[\[\]{}]/.test(frame) || /\bplaceholder\b/i.test(frame)) return undefined;
  return safeLearningText(frame);
};

const normalizePart3ThinkingDiagnosis = (
  value: unknown,
  frame: Part3QuestionFrame,
  ctChain: Part3CriticalThinkingChain,
): Part3ThinkingDiagnosis | undefined => {
  const source = isRecord(value) ? value : {};
  const mainCeiling = optionalSafeString(
    source.mainCeilingZh ??
    source.growthEdgeZh ??
    source.currentCeilingZh ??
    source.limitZh ??
    source.whyNotHigherZh ??
    ctChain.missingLinkZh,
  );
  const bestNextMove = optionalSafeString(
    source.bestNextMoveZh ??
    source.nextMoveZh ??
    source.trainingMoveZh ??
    ctChain.nextMoveZh ??
    part3QuestionFrameGuidanceZh(frame),
  );
  const diagnosis = {
    questionThinkingZh: optionalSafeString(
      source.questionThinkingZh ??
      source.howToThinkZh ??
      source.questionTaskZh ??
      source.thinkingTaskZh ??
      source.frameThinkingZh ??
      source.questionFrameGuidanceZh,
    ) || part3QuestionFrameGuidanceZh(frame),
    retainedIdeaZh: optionalSafeString(
      source.retainedIdeaZh ??
      source.keepIdeaZh ??
      source.keepZh ??
      source.whatCanKeepZh ??
      source.whatWorksZh ??
      source.worksZh ??
      source.strengthZh,
    ),
    upgradeRuleZh: optionalSafeString(
      source.upgradeRuleZh ??
      source.upgradeStepZh ??
      source.ruleZh ??
      source.mainUpgradeZh ??
      mainCeiling ??
      bestNextMove,
    ),
    reusableFrameZh: optionalSafeString(
      source.reusableFrameZh ??
      source.frameNoteZh ??
      source.transferFrameZh ??
      source.sentenceFrameZh,
    ),
    reusableFrame: safePart3ReusableFrame(
      source.reusableFrame ??
      source.frame ??
      source.englishFrame ??
      source.sentenceFrame,
    ),
    whatWorksZh: optionalSafeString(source.whatWorksZh ?? source.worksZh ?? source.strengthZh),
    mainCeilingZh: mainCeiling,
    bestNextMoveZh: bestNextMove,
    answerControlZh: optionalSafeString(source.answerControlZh),
    generalisationZh: optionalSafeString(source.generalisationZh ?? source.generalizationZh),
    nuanceZh: optionalSafeString(source.nuanceZh),
    supportZh: optionalSafeString(source.supportZh),
    speakabilityZh: optionalSafeString(source.speakabilityZh ?? source.spokenNaturalnessZh),
    examinerReadinessZh: optionalSafeString(source.examinerReadinessZh ?? source.followUpReadinessZh),
  };
  const cleaned = Object.fromEntries(
    Object.entries(diagnosis)
      .map(([key, item]) => [key, typeof item === 'string' ? safeLearningText(item) : item] as const)
      .filter(([, item]) => Boolean(item)),
  );
  return Object.keys(cleaned).length ? cleaned as Part3ThinkingDiagnosis : undefined;
};

const normalizePart3MicroUpgrade = (
  value: unknown,
): Part3MicroUpgrade | undefined => {
  if (!isRecord(value)) return undefined;
  const upgradedLine = safeLearningText(optionalSafeString(
    value.upgradedLine ?? value.upgrade ?? value.line ?? value.sentence,
  ) || '');
  if (!upgradedLine) return undefined;
  return {
    focusZh: safeLearningText(optionalSafeString(value.focusZh) || '把同一逻辑说得更自然、更适合口语输出。'),
    upgradedLine,
    whyItHelpsZh: safeLearningText(optionalSafeString(value.whyItHelpsZh ?? value.whyZh) || '这是一处微调，不是推倒重写；它让答案更清楚、更好说。'),
  };
};

const normalizePart3TargetAnswerHighlights = (
  value: unknown,
  targetAnswer: string,
  path: string,
  validationErrors: string[],
  normalizedFields: string[],
) => {
  const lowerTarget = targetAnswer.toLowerCase();
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    validationErrors.push(`${path} missing or invalid array`);
    return [];
  }
  const highlights = value
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
      const quote = safeLearningText(asString(record.quote, '', `${path}[${index}].quote`, validationErrors));
      const labelZh = safeLearningText(asString(record.labelZh, '', `${path}[${index}].labelZh`, validationErrors));
      const whyItWorksZh = safeLearningText(asString(record.whyItWorksZh, '', `${path}[${index}].whyItWorksZh`, validationErrors));
      if (!quote || !labelZh || !whyItWorksZh) return null;
      if (!lowerTarget.includes(quote.toLowerCase())) {
        normalizedFields.push('part3TargetHighlightDropped');
        return null;
      }
      return {
        quote,
        role: normalizePart3HighlightRole(record.role),
        labelZh,
        whyItWorksZh,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return highlights.slice(0, 6);
};

const repairPart3TopicLanguageExpression = (expression: string) => {
  const normalized = expression.replace(/\s+/g, ' ').trim();
  const replacements: Record<string, string> = {
    'traditional fictions': 'traditional Chinese fiction',
    'chinese traditional fictions': 'classic Chinese novels',
    'be based on tv series': 'be adapted into TV dramas',
    'hardware facilities': 'library facilities',
    'hardware facility': 'library facilities',
    'software aspects': 'library services',
    'software aspects / overall environment': 'services and overall environment',
    'widespread electronic devices': 'digital devices are everywhere',
    'primary form of indoor relaxation': 'a common way to relax at home',
    'attention is often diverted by': 'get distracted by',
    'leisure time is divided among many options': 'have many ways to spend their free time',
    'update and purchase new books': 'update book collections regularly',
    'improve library conditions': 'improve library facilities and services',
    'conducive atmosphere': 'a pleasant reading environment',
  };
  return replacements[normalized.toLowerCase()] || normalized;
};

const normalizePart3TopicLanguageItem = (
  value: unknown,
): Part3TopicLanguageSection['items'][number] | null => {
  const record = isRecord(value) ? value : null;
  const expression = safeLearningText(
    repairPart3TopicLanguageExpression(typeof value === 'string'
      ? value
      : optionalSafeString(record?.expression ?? record?.phrase ?? record?.item ?? record?.text) || ''
    ),
  );
  if (!expression) return null;

  const meaningZh = record
    ? safeLearningText(optionalSafeString(
      record.meaningZh ??
      record.zh ??
      record.chinese ??
      record.translationZh ??
      record.explanationZh,
    ) || '')
    : '';
  const role = record
    ? safeLearningText(optionalSafeString(record.role ?? record.type ?? record.use) || '')
    : '';
  const sourceQuestionRef = record
    ? safeLearningText(optionalSafeString(record.sourceQuestionRef ?? record.questionRef) || '')
    : '';

  return {
    expression,
    ...(meaningZh ? { meaningZh } : {}),
    ...(role ? { role } : {}),
    ...(sourceQuestionRef ? { sourceQuestionRef } : {}),
  };
};

const normalizePart3TopicLanguage = (value: unknown): Part3TopicLanguageSection[] => {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  return source
    .map((item, index): Part3TopicLanguageSection | null => {
      const record = isRecord(item) ? item : {};
      const rawItems = Array.isArray(record.items)
        ? record.items
        : Array.isArray(record.expressions)
          ? record.expressions
          : Array.isArray(record.phrases)
            ? record.phrases
            : [];
      const items = rawItems
        .map(normalizePart3TopicLanguageItem)
        .filter((entry): entry is Part3TopicLanguageSection['items'][number] => Boolean(entry))
        .filter(item => {
          const key = item.expression.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 6);
      if (!items.length) return null;
      const title = safeLearningText(
        optionalSafeString(record.title ?? record.sectionTitle) || `Topic-bound language ${index + 1}`,
      );
      const noteZh = optionalSafeString(record.noteZh ?? record.whyZh ?? record.rationaleZh);
      return {
        title,
        noteZh: noteZh ? safeLearningText(noteZh) : undefined,
        items,
      };
    })
    .filter((item): item is Part3TopicLanguageSection => Boolean(item))
    .slice(0, 3);
};

const normalizePart3DiscussionFeedback = (
  value: unknown,
  request: SpeakingRequest,
  validationErrors: string[],
  normalizedFields: string[],
): SpeakingFeedback['part3Feedback'] => {
  if (request.sessionKind !== 'part3_discussion_thread') return undefined;

  const answers = request.threadAnswers || [];
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) normalizedFields.push('part3FeedbackMissing');
  const rawAnswers = Array.isArray(source.answers) ? source.answers : [];
  const rawByQuestionRef = new Map(
    rawAnswers
      .map((item, index) => {
        const record = isRecord(item) ? item : {};
        const questionRef = safeLearningText(typeof record.questionRef === 'string' ? record.questionRef : `Q${index + 1}`).toUpperCase();
        return [questionRef, record] as const;
      }),
  );

  const normalizedAnswers = answers.map((answer, index) => {
    const questionRef = `Q${index + 1}`;
    const record = rawByQuestionRef.get(questionRef) || (isRecord(rawAnswers[index]) ? rawAnswers[index] as Record<string, unknown> : {});
    const fallbackFrame = part3QuestionFrameFallback(answer.question);
    const questionFrame = normalizePart3QuestionFrame(record.questionFrame, fallbackFrame);
    const targetAnswer = safeLearningText(
      typeof record.targetAnswer === 'string'
        ? record.targetAnswer
        : typeof record.nextSpeakableVersion === 'string'
          ? record.nextSpeakableVersion
          : '',
    );
    const ctChain = normalizePart3CtChain(record.ctChain, questionFrame);
    const microUpgrade = normalizePart3MicroUpgrade(record.microUpgrade ?? record.band8Move ?? record.nextMove);
    const thinkingDiagnosis = normalizePart3ThinkingDiagnosis(record.thinkingDiagnosis ?? record.diagnosis, questionFrame, ctChain);
    const feedbackMode = normalizePart3FeedbackMode(record.feedbackMode, microUpgrade, ctChain, questionFrame);
    const targetAnswerHighlights = targetAnswer
      ? normalizePart3TargetAnswerHighlights(
        record.targetAnswerHighlights,
        targetAnswer,
        `part3Feedback.answers[${index}].targetAnswerHighlights`,
        validationErrors,
        normalizedFields,
      ).slice(0, feedbackMode === 'micro_upgrade' ? 2 : 3)
      : [];
    return {
      questionRef,
      question: safeLearningText(optionalSafeString(record.question) || answer.question),
      answer: safeLearningText(optionalSafeString(record.answer) || answer.answer),
      questionFrame,
      questionFrameLabelZh: safeLearningText(optionalSafeString(record.questionFrameLabelZh) || part3QuestionFrameLabelZh(questionFrame)),
      questionFrameGuidanceZh: safeLearningText(optionalSafeString(record.questionFrameGuidanceZh) || part3QuestionFrameGuidanceZh(questionFrame)),
      ctChain,
      feedbackMode,
      thinkingDiagnosis,
      microUpgrade,
      likelyExaminerFollowUp: safeLearningText(optionalSafeString(record.likelyExaminerFollowUp ?? record.followUpQuestion) || ''),
      targetAnswer,
      targetAnswerHighlights,
    };
  });

  normalizedFields.push(`part3Answers:${normalizedAnswers.length}`);
  normalizedFields.push(`part3TargetAnswers:${normalizedAnswers.filter(item => item.targetAnswer).length}`);
  normalizedFields.push(`part3MicroUpgrades:${normalizedAnswers.filter(item => item.microUpgrade).length}`);
  const topicLanguage = normalizePart3TopicLanguage(source.topicLanguage ?? source.languageBank ?? source.topicVocabulary);
  if (topicLanguage.length) normalizedFields.push(`part3TopicLanguage:${topicLanguage.flatMap(item => item.items).length}`);

  return {
    topic: safeLearningText(optionalSafeString(source.topic) || request.topic || 'Part 3 Discussion'),
    threadId: safeLearningText(optionalSafeString(source.threadId) || request.threadId || 'part3_discussion_thread'),
    answers: normalizedAnswers,
    topicLanguage,
    sessionPriorityZh: optionalSafeString(source.sessionPriorityZh),
  };
};

const normalizeSpeakingFeedback = (
  value: unknown,
  request: SpeakingRequest,
  validationErrors: string[],
  normalizedFields: string[],
): SpeakingFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  if (request.sessionKind === 'part1_topic_thread') {
    return normalizePart1TopicThreadFeedback(source, request, validationErrors, normalizedFields);
  }

  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const part = asSpeakingPart(source.part, request.part, validationErrors);
  const transcriptWords = countWords(request.transcript || '');
  const lengthMustFix = buildSpeakingLengthMustFix(transcriptWords, part);
  const limitTransformation = shouldLimitSpeakingTransformation(request.transcript || '', transcriptWords, part);
  const promptMismatchWarning = buildSpeakingPromptMismatchWarning(request.question || '', request.transcript || '', part);
  const visibleScores = {
    fluencyCoherence: normalizeHalfBandScore(applySpeakingLengthCap(
      asNumber(scores.fluencyCoherence, 'scores.fluencyCoherence', validationErrors),
      transcriptWords,
      part,
    )),
    lexicalResource: normalizeHalfBandScore(applySpeakingLengthCap(
      asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors),
      transcriptWords,
      part,
    )),
    grammaticalRangeAccuracy: normalizeHalfBandScore(applySpeakingLengthCap(
      asNumber(
        scores.grammaticalRangeAccuracy,
        'scores.grammaticalRangeAccuracy',
        validationErrors,
      ),
      transcriptWords,
      part,
    )),
  };
  const headlineSource =
    source.bandEstimateExcludingPronunciation ??
    source.bandEstimate ??
    source.estimatedBand ??
    source.overallBand;
  const hasExplicitHeadline = isPositiveFiniteNumber(headlineSource);
  const criteriaHeadline = speakingCriteriaAverage(visibleScores);
  if (!hasExplicitHeadline && criteriaHeadline !== undefined) {
    normalizedFields.push('speakingHeadlineFromCriteriaAverage');
  }
  const cappedHeadline = normalizeHalfBandScore(applySpeakingLengthCap(
    hasExplicitHeadline
      ? headlineSource
      : criteriaHeadline ?? asNumber(
        headlineSource,
        'bandEstimateExcludingPronunciation',
        validationErrors,
        FALLBACK_SCORE,
      ),
    transcriptWords,
    part,
  ));
  const promptAwareHeadline = promptMismatchWarning ? Math.min(cappedHeadline, 5.5) : cappedHeadline;
  const sourceFatalErrors = Array.isArray(source.fatalErrors) ? source.fatalErrors : [];
  const sourceNaturalnessHints = Array.isArray(source.naturalnessHints) ? source.naturalnessHints : [];
  const hasQualityCap = Boolean(lengthMustFix || limitTransformation || hasLowSignalSpeakingText(request.transcript || ''));
  const hasProviderFatalIssue = sourceFatalErrors.length > 0 || Boolean(promptMismatchWarning);
  const minimumVisibleScore = Math.min(
    visibleScores.fluencyCoherence,
    visibleScores.lexicalResource,
    visibleScores.grammaticalRangeAccuracy,
  );
  const maximumVisibleScore = Math.max(
    visibleScores.fluencyCoherence,
    visibleScores.lexicalResource,
    visibleScores.grammaticalRangeAccuracy,
  );
  const shouldRaiseSpeakingScoreToVisibleCriteria =
    promptAwareHeadline > 0 &&
    minimumVisibleScore > 0 &&
    promptAwareHeadline < minimumVisibleScore &&
    !hasQualityCap &&
    !hasProviderFatalIssue;
  const shouldLowerSpeakingScoreToVisibleCriteria =
    promptAwareHeadline > 0 &&
    maximumVisibleScore > 0 &&
    promptAwareHeadline > maximumVisibleScore &&
    !hasQualityCap &&
    !hasProviderFatalIssue;
  const normalizedHeadline = shouldRaiseSpeakingScoreToVisibleCriteria
    ? minimumVisibleScore
    : shouldLowerSpeakingScoreToVisibleCriteria
      ? maximumVisibleScore
      : promptAwareHeadline;
  if (shouldRaiseSpeakingScoreToVisibleCriteria || shouldLowerSpeakingScoreToVisibleCriteria) {
    normalizedFields.push('speakingScoreConsistency');
  }
  const bandEstimateRange = hasExplicitHeadline
    ? normalizeSpeakingBandEstimateRange(
      source.bandEstimateRange,
      normalizedHeadline,
      hasQualityCap || Boolean(promptMismatchWarning),
      normalizedFields,
    )
    : normalizeValidSpeakingBandEstimateRange(source.bandEstimateRange);
  const criterionConsistentBandEstimateRange = bandEstimateRange &&
    minimumVisibleScore > 0 &&
    maximumVisibleScore > 0 &&
    !hasQualityCap &&
    !hasProviderFatalIssue &&
    bandEstimateRange.lower > maximumVisibleScore
      ? undefined
      : bandEstimateRange;
  if (bandEstimateRange && !criterionConsistentBandEstimateRange) {
    normalizedFields.push('speakingBandRangeCriterionConsistency');
  }
  const layerEstimate = normalizedHeadline > 0 ? normalizedHeadline : criterionConsistentBandEstimateRange?.lower || 0;
  const expectedSpeakingTargetLayer = speakingTargetLayerForEstimate(layerEstimate);
  const providerSpeakingTargetLayer = normalizeTargetAnswerLayer(source.targetAnswerLayer);
  const speakingTargetAnswerLayer = expectedSpeakingTargetLayer;
  if (providerSpeakingTargetLayer && providerSpeakingTargetLayer !== expectedSpeakingTargetLayer) {
    normalizedFields.push('targetLayerConsistency');
  }
  const speakingTargetFloor = targetFloorForLayer(speakingTargetAnswerLayer);
  const speakingTargetLayer = getTargetLabel(layerEstimate, 'answer');
  const targetAnswerSelfScores = normalizeSpeakingTargetSelfScores(source.targetAnswerSelfScores);
  const providerTargetAnswerStatus = normalizeTargetAnswerStatus(source.targetAnswerStatus);
  const currentAnswerIsHighBand = layerEstimate >= 8 && !hasQualityCap && !hasProviderFatalIssue;
  const rootUpgradedAnswer = optionalSafeString(source.upgradedAnswer);
  const strongPart3AnswerTargetOptional =
    part === 3 &&
    layerEstimate >= 7 &&
    !rootUpgradedAnswer &&
    sourceFatalErrors.length === 0 &&
    sourceNaturalnessHints.length === 0 &&
    !hasQualityCap &&
    !hasProviderFatalIssue;
  const part3ThreadRootTargetOptional =
    request.sessionKind === 'part3_discussion_thread' && !rootUpgradedAnswer;
  let rawUpgradedAnswer = '';
  if (currentAnswerIsHighBand) {
    rawUpgradedAnswer = '';
  } else if (strongPart3AnswerTargetOptional) {
    rawUpgradedAnswer = '';
  } else if (limitTransformation) {
    rawUpgradedAnswer = buildInsufficientSpeakingTransformation(part);
  } else if (!part3ThreadRootTargetOptional) {
    rawUpgradedAnswer = asString(
      rootUpgradedAnswer,
      'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
      'upgradedAnswer',
      validationErrors,
    );
  }
  if (part3ThreadRootTargetOptional) {
    normalizedFields.push('part3RootUpgradedAnswerOptional');
  }
  if (strongPart3AnswerTargetOptional) {
    normalizedFields.push('part3StrongAnswerTargetOptional');
  }
  const hasTargetAnswer = Boolean(rawUpgradedAnswer.trim()) && !isProviderIncompleteSpeakingAnswer(rawUpgradedAnswer);
  const targetAnswerStatus: TargetAnswerStatus = (() => {
    if (currentAnswerIsHighBand || strongPart3AnswerTargetOptional) return 'meets_target';
    if (!hasTargetAnswer || limitTransformation) return 'not_generated';
    return 'meets_target';
  })();
  if (
    providerTargetAnswerStatus &&
    providerTargetAnswerStatus !== targetAnswerStatus &&
    targetAnswerStatus !== 'meets_target'
  ) {
    normalizedFields.push('targetAnswerIntegrity');
  }
  const providerScoreConsistencyNote = optionalSafeString(source.scoreConsistencyNoteZh);
  const scoreConsistencyNoteZh = shouldRaiseSpeakingScoreToVisibleCriteria
    ? `Score normalized: without a quality cap, the visible estimate should not fall below the minimum visible language score ${formatConservativeBandEstimate(minimumVisibleScore)}.`
    : shouldLowerSpeakingScoreToVisibleCriteria
      ? `Score normalized: without a quality cap, the visible estimate should not exceed the strongest visible language score ${formatConservativeBandEstimate(maximumVisibleScore)}.`
    : providerScoreConsistencyNote;

  const defaultTargetValidationZh = currentAnswerIsHighBand
    ? 'This answer is already stable for the current target layer.'
    : targetAnswerStatus === 'meets_target'
      ? `This answer meets the target layer ${speakingTargetLayer}.`
      : targetAnswerStatus === 'not_generated'
        ? 'The provider did not generate a usable target answer.'
        : 'This answer still needs revision before it can be treated as stable at the target layer.';

  const feedbackWithoutMarkdown: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'speaking',
    part,
    sessionKind: request.sessionKind,
    topic: request.topic || optionalSafeString(source.topic),
    threadId: request.threadId || optionalSafeString(source.threadId),
    threadAnswers: request.threadAnswers,
    part2Feedback: normalizePart2Feedback(source.part2Feedback, request, validationErrors, normalizedFields),
    part3Feedback: normalizePart3DiscussionFeedback(source.part3Feedback, request, validationErrors, normalizedFields),
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    transcript: asString(source.transcript, request.transcript || FALLBACK_TEXT, 'transcript', validationErrors),
    bandEstimateExcludingPronunciation: normalizedHeadline,
    bandEstimateRange: criterionConsistentBandEstimateRange,
    estimateRationaleZh: optionalSafeString(source.estimateRationaleZh),
    speakingCeilingDiagnosis: normalizeSpeakingCeilingDiagnosis(source.speakingCeilingDiagnosis),
    targetBandFloor: speakingTargetFloor,
    targetLayer: currentAnswerIsHighBand
      ? 'High-band stability'
      : optionalSafeString(source.targetLayer) || speakingTargetLayer,
    targetValidationZh: targetAnswerStatus === 'meets_target'
      ? optionalSafeString(source.targetValidationZh) || defaultTargetValidationZh
      : defaultTargetValidationZh,
    targetUpgradeFocusZh: optionalSafeString(source.targetUpgradeFocusZh),
    targetAnswerFloor: speakingTargetFloor,
    targetAnswerLayer: speakingTargetAnswerLayer,
    targetAnswerStatus,
    targetAnswerSelfScores,
    targetAnswerValidationScores: normalizeSpeakingTargetSelfScores(source.targetAnswerValidationScores),
    targetAnswerValidationRationaleZh: optionalSafeString(source.targetAnswerValidationRationaleZh),
    targetAnswerRationaleZh: optionalSafeString(source.targetAnswerRationaleZh),
    targetAnswerRepairFocusZh: optionalSafeString(source.targetAnswerRepairFocusZh) ||
      (false
        ? 'Strengthen the answer while preserving the learner meaning.'
        : undefined),
    highBandStabilityZh: optionalSafeString(source.highBandStabilityZh) ||
      (currentAnswerIsHighBand || strongPart3AnswerTargetOptional
        ? 'This answer is already stable enough to keep: it gives a clear Part 3 position, useful contrast, concrete examples, and natural generalisation. Next, refine with one sharper nuance or condition if needed.'
        : undefined),
    nextStepZh: optionalSafeString(source.nextStepZh) ||
      (currentAnswerIsHighBand
        ? 'Keep practising with the target answer and repair the remaining blockers.'
        : undefined),
    scoreConsistencyNoteZh,
    scores: {
      fluencyCoherence: visibleScores.fluencyCoherence,
      lexicalResource: visibleScores.lexicalResource,
      grammaticalRangeAccuracy: visibleScores.grammaticalRangeAccuracy,
      pronunciation: null,
      pronunciationNote: asString(
        scores.pronunciationNote,
        'Pronunciation is not formally assessed in V1.',
        'scores.pronunciationNote',
        validationErrors,
      ),
    },
    fatalErrors: [
      ...(promptMismatchWarning ? [promptMismatchWarning] : []),
      ...(lengthMustFix ? [lengthMustFix] : []),
      ...asArray(source.fatalErrors, 'fatalErrors', validationErrors).map((item, index) => {
        const record = isRecord(item) ? item : {};
        if (!isRecord(item)) validationErrors.push(`fatalErrors[${index}] missing or invalid object`);
        return {
          original: asString(record.original, FALLBACK_TEXT, `fatalErrors[${index}].original`, validationErrors),
          correction: asString(record.correction, FALLBACK_TEXT, `fatalErrors[${index}].correction`, validationErrors),
          tag: asString(record.tag, 'provider_safety', `fatalErrors[${index}].tag`, validationErrors),
          explanationZh: asString(
            record.explanationZh,
            'Provider feedback was incomplete; this item was normalized safely.',
            `fatalErrors[${index}].explanationZh`,
            validationErrors,
          ),
        };
      }),
    ],
    naturalnessHints: normalizeSpeakingNaturalnessHints(source.naturalnessHints, validationErrors, normalizedFields),
    band9Refinements: Array.isArray(source.band9Refinements)
      ? source.band9Refinements.map((item, index) => {
          const record = isRecord(item) ? item : {};
          return {
            observation: asString(
              record.observation,
              FALLBACK_TEXT,
              `band9Refinements[${index}].observation`,
              validationErrors,
            ),
            refinement: asString(
              record.refinement,
              FALLBACK_TEXT,
              `band9Refinements[${index}].refinement`,
              validationErrors,
            ),
            explanationZh: asString(
              record.explanationZh,
              'Provider feedback was incomplete; this item was normalized safely.',
              `band9Refinements[${index}].explanationZh`,
              validationErrors,
            ),
          };
        })
      : [],
    preservedStyle: asArray(source.preservedStyle, 'preservedStyle', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`preservedStyle[${index}] missing or invalid object`);
      return {
        text: asString(record.text, FALLBACK_TEXT, `preservedStyle[${index}].text`, validationErrors),
        reasonZh: asString(
          record.reasonZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `preservedStyle[${index}].reasonZh`,
          validationErrors,
        ),
        expansionZh: typeof record.expansionZh === 'string' ? record.expansionZh : undefined,
        sampleNextStep: typeof record.sampleNextStep === 'string' ? record.sampleNextStep : undefined,
        transferQuestions: Array.isArray(record.transferQuestions)
          ? record.transferQuestions.filter((question): question is string => typeof question === 'string')
          : undefined,
        partUseZh: typeof record.partUseZh === 'string' ? record.partUseZh : undefined,
        riskNoteZh: typeof record.riskNoteZh === 'string' ? record.riskNoteZh : undefined,
      };
    }),
    upgradedAnswer: calibrateSpeakingUpgradedAnswer(
      rawUpgradedAnswer,
      part,
      request.transcript || '',
      limitTransformation,
      normalizedFields,
    ),
    reusableExample: normalizeSpeakingReusableExample(source.reusableExample, normalizedFields),
  };

  const feedbackWithPart2AnnotationBackfill = backfillPart2AnnotationsFromGenericRepairs(
    feedbackWithoutMarkdown,
    normalizedFields,
  );
  const resolvedSpeakingTargetState = resolveSpeakingTargetState(feedbackWithPart2AnnotationBackfill);
  normalizedFields.push(`targetState:${resolvedSpeakingTargetState}`);
  const feedbackWithTargetState: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    ...feedbackWithPart2AnnotationBackfill,
    targetState: resolvedSpeakingTargetState,
    targetLayer: resolvedSpeakingTargetState === 'high_band_stable'
      ? feedbackWithPart2AnnotationBackfill.targetLayer
      : layerEstimate >= 7
        ? 'Band 7+ Target Answer'
        : 'Band 7 Target Answer',
    targetValidationZh: resolvedSpeakingTargetState === 'high_band_stable'
      ? feedbackWithPart2AnnotationBackfill.targetValidationZh
      : '',
    highBandStabilityZh: resolvedSpeakingTargetState === 'high_band_stable'
      ? feedbackWithPart2AnnotationBackfill.highBandStabilityZh || HIGH_BAND_STABLE_ZH
      : feedbackWithPart2AnnotationBackfill.highBandStabilityZh,
    targetAnswerRepairFocusZh: undefined,
  };

  const sanitizedFatalErrors = feedbackWithTargetState.fatalErrors
    .map(item => ({
      ...item,
      original: safeLearningText(item.original),
      correction: safeLearningText(item.correction),
      tag: safeLearningText(item.tag, 'speaking_issue'),
      explanationZh: safeLearningText(item.explanationZh),
    }))
    .filter(item => item.original && item.correction && item.explanationZh)
    .map(item => normalizeSharedSpeakingFatalError(item, request.transcript || ''))
    .filter((item): item is FatalError => Boolean(item));
  const sanitizedNaturalnessHints = feedbackWithTargetState.naturalnessHints
    .map(item => ({
      ...item,
      original: safeLearningText(item.original),
      better: safeLearningText(item.better),
      tag: safeLearningText(item.tag, 'naturalness'),
      explanationZh: safeLearningText(item.explanationZh),
    }))
    .filter(item => item.original && item.better && item.explanationZh)
    .map(item => normalizeSharedSpeakingNaturalnessHint(item, request.transcript || ''))
    .filter((item): item is NaturalnessHint => Boolean(item));
  const routedSpeakingIssues = promoteGrammarTaggedSpeakingHints(
    sanitizedFatalErrors,
    sanitizedNaturalnessHints,
    normalizedFields,
  );

  const sanitizedFeedback: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    ...feedbackWithTargetState,
    fatalErrors: routedSpeakingIssues.fatalErrors,
    naturalnessHints: routedSpeakingIssues.naturalnessHints,
    band9Refinements: feedbackWithTargetState.band9Refinements
      .map(item => ({
        observation: safeLearningText(item.observation),
        refinement: safeLearningText(item.refinement),
        explanationZh: safeLearningText(item.explanationZh),
      }))
      .filter(item => item.observation && item.refinement && item.explanationZh),
    preservedStyle: feedbackWithTargetState.preservedStyle
      .map(item => ({
        text: safeLearningText(item.text),
        reasonZh: safeLearningText(item.reasonZh),
        expansionZh: optionalSafeString(item.expansionZh),
        sampleNextStep: optionalSafeString(item.sampleNextStep),
        transferQuestions: optionalSafeStringArray(item.transferQuestions),
        partUseZh: optionalSafeString(item.partUseZh),
        riskNoteZh: optionalSafeString(item.riskNoteZh),
      }))
      .filter(item => item.text && item.reasonZh),
    upgradedAnswer: safeLearningText(feedbackWithTargetState.upgradedAnswer),
    reusableExample: feedbackWithTargetState.reusableExample
      ? {
          example: safeLearningText(feedbackWithTargetState.reusableExample.example),
          canBeReusedFor: feedbackWithTargetState.reusableExample.canBeReusedFor
            .map(item => safeLearningText(item))
            .filter(Boolean),
          explanationZh: safeLearningText(feedbackWithTargetState.reusableExample.explanationZh),
        }
      : null,
  };

  return {
    ...sanitizedFeedback,
    obsidianMarkdown: (() => {
      if (typeof source.obsidianMarkdown === 'string' && source.obsidianMarkdown.trim()) {
        normalizedFields.push('obsidianMarkdown');
      }
      return buildSpeakingObsidianMarkdown(sanitizedFeedback);
    })(),
  };
};

const normalizeFrameworkSeverity = (
  value: unknown,
  path: string,
  errors: string[],
): WritingFeedback['frameworkFeedback'][number]['severity'] => {
  if (value === 'fatal' || value === 'naturalness' || value === 'preserved') return value;
  if (value === 'major') return 'fatal';
  if (value === 'medium' || value === 'minor' || value === 'polish') return 'naturalness';
  errors.push(`${path} missing or invalid severity`);
  return 'naturalness';
};

const normalizeSentenceSeverity = (
  value: unknown,
  dimension: WritingFeedback['sentenceFeedback'][number]['dimension'],
  tag: string,
): WritingFeedback['sentenceFeedback'][number]['severity'] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === 'major' || value === 'medium' || value === 'minor' || value === 'polish') return value;
  if (value === 'fatal') return 'major';
  if (value === 'preserved') return 'polish';
  if (value === 'naturalness') {
    return dimension === 'TR' || dimension === 'CC' || /task|coherence|structure|paragraph/i.test(tag)
      ? 'medium'
      : 'polish';
  }
  return undefined;
};

const normalizeDimension = (
  value: unknown,
  path: string,
  errors: string[],
): WritingFeedback['sentenceFeedback'][number]['dimension'] => {
  if (value === 'TR' || value === 'CC' || value === 'LR' || value === 'GRA') return value;
  errors.push(`${path} missing or invalid dimension`);
  return 'TR';
};

const normalizeCorrectionId = (value: unknown, index: number): string => {
  if (typeof value === 'string' && /^C\d+$/i.test(value.trim())) return value.trim().toUpperCase();
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return `C${Math.floor(value)}`;
  return `C${index + 1}`;
};

const normalizeIssueLabel = (value: unknown, dimension: WritingFeedback['sentenceFeedback'][number]['dimension'], tag: string): string => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  const tagLabel = tag.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
  if (tagLabel && tag !== 'provider_safety') return tagLabel;
  return dimension === 'TR'
    ? 'Task response'
    : dimension === 'CC'
      ? 'Coherence and cohesion'
      : dimension === 'LR'
        ? 'Lexical precision'
        : 'Grammar accuracy';
};

const normalizeSecondaryIssues = (
  value: unknown,
  primaryIssue: string,
): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map(item => item.trim())
    .filter(item => item.toLowerCase() !== primaryIssue.toLowerCase())
    .slice(0, 3);

const normalizeTransferGuidance = (
  value: unknown,
  fallback: string,
): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const normalizeMicroUpgrades = (
  value: unknown,
): WritingFeedback['sentenceFeedback'][number]['microUpgrades'] =>
  (Array.isArray(value) ? value : [])
    .map(item => {
      const record = isRecord(item) ? item : {};
      const original = typeof record.original === 'string' ? record.original.trim() : '';
      const better = typeof record.better === 'string' ? record.better.trim() : '';
      const explanationZh = typeof record.explanationZh === 'string' && record.explanationZh.trim()
        ? record.explanationZh.trim()
        : 'This phrase can be improved for clearer academic English.';
      return { original, better, explanationZh };
    })
    .filter(item => item.original && item.better)
    .slice(0, 3);

const normalizeLocation = (
  value: unknown,
  fallbackText = '',
): WritingFeedback['frameworkFeedback'][number]['location'] => {
  if (
    value === 'Whole Essay' ||
    value === 'Introduction' ||
    value === 'Body Paragraph 1' ||
    value === 'Body Paragraph 2' ||
    value === 'Conclusion' ||
    value === 'Unknown / General'
  ) return value;

  const text = `${typeof value === 'string' ? value : ''} ${fallbackText}`.toLowerCase();
  if (/introduction|opening|intro/.test(text)) return 'Introduction';
  if (/body\s*(paragraph)?\s*1|first body|bp1/.test(text)) return 'Body Paragraph 1';
  if (/body\s*(paragraph)?\s*2|second body|bp2/.test(text)) return 'Body Paragraph 2';
  if (/conclusion|closing/.test(text)) return 'Conclusion';
  if (/whole|overall|essay|task response|position|under-length|insufficient/.test(text)) return 'Whole Essay';
  return 'Unknown / General';
};

const normalizeRelatedCorrectionIds = (value: unknown, validIds: Set<string>): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(
    value
      .map(item => normalizeCorrectionId(item, -1))
      .filter(id => validIds.has(id)),
  ));
};

const inferRelatedCorrectionIds = (
  issue: string,
  suggestionZh: string,
  location: WritingFeedback['frameworkFeedback'][number]['location'],
  sentenceFeedback: WritingFeedback['sentenceFeedback'],
): string[] => {
  const haystack = `${issue} ${suggestionZh} ${location || ''}`.toLowerCase();
  const scored = sentenceFeedback.map(item => {
    const itemText = `${item.original} ${item.correction} ${item.tag} ${item.issueType || ''} ${item.paragraph || ''} ${item.primaryIssue || ''} ${(item.secondaryIssues || []).join(' ')}`.toLowerCase();
    let score = 0;
    if (/introduction|opening|off-topic|irrelevant/.test(haystack) && /introduction|opening|off-topic|irrelevant|task_response/.test(itemText)) score += 4;
    if (/disadvantage|advantage|both views|concession|counter|balance/.test(haystack) && /concession|balance|task_response|develop|paragraph|body|advantage|disadvantage/.test(itemText)) score += 4;
    if (/weak position|position|thesis|stance/.test(haystack) && /thesis|position|stance|conclusion|introduction|task_response/.test(itemText)) score += 4;
    if (location && location !== 'Whole Essay' && location !== 'Unknown / General' && itemText.includes(location.toLowerCase())) score += 3;
    if (item.dimension === 'TR' && /task|response|position|argument|logic|example|support|develop|off-topic|irrelevant/.test(haystack)) score += 2;
    if (item.dimension === 'CC' && /coherence|cohesion|paragraph|structure|link|transition|flow|develop|order/.test(haystack)) score += 2;
    return { item, score };
  }).filter(entry => entry.score >= 3);
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(entry => entry.item.id || `C${entry.item.correctionNumber || 1}`);
};

const isFrameworkLevelIssue = (issue: string, suggestionZh: string, issueType?: string): boolean => {
  const text = `${issue} ${suggestionZh} ${issueType || ''}`.toLowerCase();
  if (/lexical|vocab|word choice|collocation|grammar|tense|article|punctuation|spelling|local wording/.test(text)) {
    return /task response|off-topic|irrelevant|position|paragraph|structure|development|support|example|advantage|disadvantage|concession|coherence/.test(text);
  }
  return !/provider output was malformed/i.test(text);
};

const isGlobalEssayWarning = (title: string, message: string): boolean => {
  const text = `${title} ${message}`.toLowerCase();
  return /under[- ]?length|under\s*\d+\s*words?|word count|insufficient sample|very low[- ]signal|low[- ]signal|prompt mismatch|off[- ]task|not an essay|only notes|outline|unreliable training estimate|copied prompt|no original answer|fragmented|too fragmented|too short/.test(text);
};

const defaultParagraphFix = (issue: string, location?: string): string =>
  `For ${logicLocationZh(location)}, develop the logic more clearly: make the claim explicit, add support, and connect it back to the question.`;

const defaultLogicTransfer = (): string =>
  'Reuse this correction pattern in another paragraph where the same logic problem appears.';

const defaultSentenceTransfer = (dimension: WritingFeedback['sentenceFeedback'][number]['dimension'], tag: string): string => {
  const normalized = tag.toLowerCase();
  if (/spelling|capital/.test(normalized)) return 'Check spelling and capitalization only after the sentence meaning is clear.';
  if (/article|singular|plural|noun/.test(normalized)) return 'Check noun form, articles, and singular/plural control in this phrase.';
  if (/punctuation|sentence_boundary/.test(normalized)) return 'Use punctuation to separate clauses clearly.';
  if (/preposition|collocation|word_choice|lexical/.test(normalized) || dimension === 'LR') return 'Use a more precise collocation or lexical pattern.';
  if (dimension === 'TR') return 'Make the idea answer the task more directly and support it with a clear reason.';
  if (dimension === 'CC') return 'Make the logic sequence clearer: claim, reason, example, result.';
  return 'Use this correction pattern in a new sentence so the structure becomes automatic.';
};

const defaultExampleFrame = (issue: string): string => {
  const text = issue.toLowerCase();
  if (/introduction|opening|position|thesis/.test(text)) return 'While this view has some merit, I would argue that...';
  if (/advantage|disadvantage|concession|balance/.test(text)) return 'This is not to suggest that ..., but the stronger concern is...';
  if (/example|support|develop/.test(text)) return 'For example, this can be seen when...';
  return 'A more balanced way to develop this point is to...';
};

const normalizeLimitedStringArray = (
  value: unknown,
  path: string,
  errors: string[],
  maxItems: number,
): string[] =>
  normalizeStringArray(value, path, errors)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, maxItems);

const sameGuidanceText = (a?: string, b?: string): boolean =>
  Boolean(a && b && a.replace(/\s+/g, '').trim() === b.replace(/\s+/g, '').trim());

type LogicLocation = NonNullable<WritingFeedback['frameworkFeedback'][number]['location']>;

const logicLocationLabels: Record<LogicLocation, string> = {
  'Whole Essay': 'Whole Essay',
  Introduction: 'Introduction',
  'Body Paragraph 1': 'Body Paragraph 1',
  'Body Paragraph 2': 'Body Paragraph 2',
  Conclusion: 'Conclusion',
  'Unknown / General': 'Unknown / General',
};

const logicLocationZh = (location?: string): string =>
  location && location in logicLocationLabels ? logicLocationLabels[location as LogicLocation] : 'Unknown / General';

const normalizeLearnerChineseText = (text?: string): string =>
  (text || '')
    .replace(/\bWhole Essay\b/g, 'Whole Essay')
    .replace(/\bIntroduction\b/g, 'Introduction')
    .replace(/\bBody Paragraph 1\b/g, 'Body Paragraph 1')
    .replace(/\bBody Paragraph 2\b/g, 'Body Paragraph 2')
    .replace(/\bConclusion\b/g, 'Conclusion')
    .replace(/\bUnknown \/ General\b/g, 'Unknown / General')
    .replace(/Paragraph-level issue: no single sentence correction fully solves this\.?/gi, '')
    .trim();

const phraseLevel = (text: string, maxWords = 7): string => {
  const cleaned = text
    .replace(/[.!?;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const words = cleaned.split(' ').filter(Boolean);
  return words.length <= maxWords ? cleaned : words.slice(0, maxWords).join(' ');
};

const isWritingStrategyExpression = (expression: string): boolean =>
  /balanced approach|clear position|support (the )?argument|concrete evidence|paragraph development|topic sentence|task response|coherence|cohesion|rewrite|develop an argument|long-term consequences|public resources/i.test(expression);

const normalizeTopicVocabularyItem = (
  item: unknown,
  index: number,
  validationErrors: string[],
): WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] | null => {
  if (typeof item === 'string') {
    const expression = item.trim();
    if (!expression || isWritingStrategyExpression(expression)) return null;
    return {
      expression,
      meaningZh: 'Use this topic word with a clear meaning in context.',
      usageZh: 'Use it only when it fits the sentence meaning and argument.',
    };
  }

  const record = isRecord(item) ? item : {};
  if (!isRecord(item)) {
    validationErrors.push(`vocabularyUpgrade.topicVocabulary[${index}] missing or invalid object`);
    return null;
  }
  const expression = asString(record.expression ?? record.term ?? record.phrase, '', `vocabularyUpgrade.topicVocabulary[${index}].expression`, validationErrors);
  if (!expression || isWritingStrategyExpression(expression)) return null;
  return {
    expression: phraseLevel(expression, 8),
    meaningZh: asString(record.meaningZh ?? record.meaning, 'Use this topic word with a clear meaning in context.', `vocabularyUpgrade.topicVocabulary[${index}].meaningZh`, validationErrors),
    usageZh: asString(record.usageZh ?? record.explanationZh ?? record.usage, 'Use it only when it fits the sentence meaning and argument.', `vocabularyUpgrade.topicVocabulary[${index}].usageZh`, validationErrors),
    example: typeof record.example === 'string' && record.example.trim() ? record.example.trim() : undefined,
  };
};

const normalizeExpressionUpgradeItem = (
  item: unknown,
  index: number,
  validationErrors: string[],
): WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] | null => {
  const record = isRecord(item) ? item : {};
  if (!isRecord(item)) {
    validationErrors.push(`vocabularyUpgrade.expressionUpgrades[${index}] missing or invalid object`);
    return null;
  }
  const original = typeof record.original === 'string' && record.original.trim()
    ? phraseLevel(record.original)
    : undefined;
  const better = asString(
    record.better ?? record.frame ?? record.expression,
    '',
    `vocabularyUpgrade.expressionUpgrades[${index}].better`,
    validationErrors,
  );
  if (!better) return null;
  return {
    category: record.category === 'from_essay' || record.type === 'from_essay' || original
      ? 'from_essay'
      : 'argument_frame',
    original,
    better: phraseLevel(better, 14),
    explanationZh: asString(
      record.explanationZh,
      '',
      `vocabularyUpgrade.expressionUpgrades[${index}].explanationZh`,
      validationErrors,
    ),
    reuseWhenZh: asString(
      record.reuseWhenZh,
      '',
      `vocabularyUpgrade.expressionUpgrades[${index}].reuseWhenZh`,
      validationErrors,
    ),
    example: typeof record.example === 'string' && record.example.trim() ? record.example.trim() : undefined,
  };
};

const languageBankMissionItems = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>): string[] => {
  const mission = feedback.vocabularyUpgrade.expressionUpgrades.length
    ? 'Choose two or three useful Language Bank expressions and reuse them in the next rewrite.'
    : 'Use the Logic Review first, then add language-bank expressions where they fit naturally.';
  const firstFix = normalizeLearnerChineseText(feedback.frameworkFeedback[0]?.paragraphFixZh);
  return sameGuidanceText(mission, firstFix) ? [] : [mission];
};

const getLanguageBankHighlightTerms = (vocabulary: WritingFeedback['vocabularyUpgrade']): string[] => {
  const terms = [
    ...vocabulary.topicVocabulary.map(item => item.expression),
    ...vocabulary.expressionUpgrades.map(item => item.better),
  ]
    .map(item => item.trim())
    .filter(item => item.length >= 6 && !/.../.test(item));
  return Array.from(new Set(terms.map(item => item.toLowerCase())))
    .map(lower => terms.find(item => item.toLowerCase() === lower) || lower)
    .sort((a, b) => b.length - a.length)
    .slice(0, 12);
};

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const markLanguageBankTerms = (text: string, terms: string[]): string => {
  let marked = text;
  terms.forEach(term => {
    const pattern = new RegExp(`\\b(${escapeRegExp(term)})\\b`, 'gi');
    marked = marked.replace(pattern, '**$1**');
  });
  return marked;
};

const expressionDetailLines = (
  item: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number],
): string => [
  item.explanationZh ? `  - 娑撹桨绮堟稊鍫ｇ箹閺嶉攱鏁? ${item.explanationZh}` : '',
  item.reuseWhenZh ? `  - 娴犫偓娑斿牊妞傞崐娆忣槻閻? ${item.reuseWhenZh}` : '',
  item.example ? `  - Example: ${item.example}` : '',
].filter(Boolean).join('\n');

const buildLocalVocabularyUpgrade = (
  source: Record<string, unknown>,
  request: WritingRequest,
  sentenceFeedback: WritingFeedback['sentenceFeedback'],
  validationErrors: string[],
): WritingFeedback['vocabularyUpgrade'] => {
  const vocabSource = isRecord(source.vocabularyUpgrade) ? source.vocabularyUpgrade : {};
  const expressionFromProvider = (Array.isArray(vocabSource.expressionUpgrades) ? vocabSource.expressionUpgrades : [])
    .map((item, index) => normalizeExpressionUpgradeItem(item, index, validationErrors))
    .filter((item): item is WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] => Boolean(item));
  const legacyWording = (Array.isArray(vocabSource.userWordingUpgrades) ? vocabSource.userWordingUpgrades : [])
    .map((item, index) => normalizeExpressionUpgradeItem(item, index, validationErrors))
    .filter((item): item is WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number] => Boolean(item))
    .map(item => ({ ...item, category: 'from_essay' as const, reuseWhenZh: item.reuseWhenZh || '' }));
  const legacyCollocations = (Array.isArray(vocabSource.collocationUpgrades)
    ? normalizeLimitedStringArray(vocabSource.collocationUpgrades, 'vocabularyUpgrade.collocationUpgrades', validationErrors, 2)
    : [])
    .filter(item => !isWritingStrategyExpression(item))
    .map(item => ({
      category: 'argument_frame' as const,
      better: item,
      explanationZh: '',
      reuseWhenZh: '',
    }));
  const legacyFrames = (Array.isArray(vocabSource.reusableSentenceFrames)
    ? normalizeLimitedStringArray(vocabSource.reusableSentenceFrames, 'vocabularyUpgrade.reusableSentenceFrames', validationErrors, 2)
    : [])
    .map(item => ({
      category: 'argument_frame' as const,
      better: item,
      explanationZh: '',
      reuseWhenZh: '',
    }));
  const microFromCorrections = sentenceFeedback
    .flatMap(item => item.microUpgrades || [])
    .map(item => ({
      category: 'from_essay' as const,
      original: phraseLevel(item.original),
      better: phraseLevel(item.better),
      explanationZh: item.explanationZh || '',
      reuseWhenZh: '',
    }))
    .slice(0, 3);
  const topicWords = (Array.isArray(vocabSource.topicVocabulary) ? vocabSource.topicVocabulary : [])
    .map((item, index) => normalizeTopicVocabularyItem(item, index, validationErrors))
    .filter((item): item is WritingFeedback['vocabularyUpgrade']['topicVocabulary'][number] => Boolean(item))
    .slice(0, 8);
  const topicVocabulary = topicWords;
  const expressionUpgrades = [
    ...expressionFromProvider,
    ...legacyWording,
    ...microFromCorrections,
    ...legacyCollocations,
    ...legacyFrames,
  ]
    .filter((item, index, items) => items.findIndex(candidate => candidate.better.toLowerCase() === item.better.toLowerCase()) === index)
    .slice(0, 8);

  return {
    topicVocabulary,
    expressionUpgrades,
  };
};

const averageWritingScore = (scores: WritingFeedback['scores']): number =>
  roundToHalfBand((
    scores.taskResponse +
    scores.coherenceCohesion +
    scores.lexicalResource +
    scores.grammaticalRangeAccuracy
  ) / 4);

const getWritingTargetLevel = (estimate: number): string => {
  return getTargetLabel(estimate, 'modelAnswer');
};

const dimensionBlockerConfigs = {
  taskResponse: {
    field: 'taskResponse',
    issue: 'Task Response blocker: answer direction or development is not yet Band 7',
    suggestionZh: 'Make the answer direction and development clearly reach the target standard.',
    paragraphFixZh: 'Answer the task directly, then support the point with a specific reason or example.',
    transferGuidanceZh: 'Use the same answer-direction check in the next body paragraph.',
    issueType: 'task_response',
    dimension: 'TR' as const,
  },
  coherenceCohesion: {
    field: 'coherenceCohesion',
    issue: 'Coherence blocker: paragraph progression is not yet Band 7',
    suggestionZh: 'Make paragraph progression easier to follow.',
    paragraphFixZh: 'Build the paragraph as claim, reason, example, and result.',
    transferGuidanceZh: 'Reuse the same logic order in another paragraph.',
    issueType: 'coherence',
    dimension: 'CC' as const,
  },
  lexicalResource: {
    field: 'lexicalResource',
    issue: 'Lexical Resource blocker',
    suggestionZh: 'Use more precise topic language instead of broad basic words.',
    paragraphFixZh: 'Replace vague wording with a specific phrase that fits the idea.',
    transferGuidanceZh: 'Check broad words such as want, good, bad, thing, and people.',
    issueType: 'lexical_precision',
    dimension: 'LR' as const,
  },
  grammaticalRangeAccuracy: {
    field: 'grammaticalRangeAccuracy',
    issue: 'Grammar blocker',
    suggestionZh: 'Improve grammar control at sentence level.',
    paragraphFixZh: 'Repair the sentence structure while preserving the intended meaning.',
    transferGuidanceZh: 'Apply the same grammar pattern in a new sentence.',
    issueType: 'grammar_control',
    dimension: 'GRA' as const,
  },
} as const;

const hasWritingBlockerForDimension = (
  dimension: keyof WritingFeedback['scores'],
  frameworkFeedback: WritingFeedback['frameworkFeedback'],
  sentenceFeedback: WritingFeedback['sentenceFeedback'],
  vocabularyUpgrade: WritingFeedback['vocabularyUpgrade'],
): boolean => {
  const text = frameworkFeedback
    .map(item => `${item.issue} ${item.issueType || ''} ${item.suggestionZh} ${item.paragraphFixZh || ''}`)
    .join(' ')
    .toLowerCase();
  if (dimension === 'taskResponse') {
    return /task_response|task response|task command|position|off.?task|development|support|example/.test(text)
      || sentenceFeedback.some(item => item.dimension === 'TR');
  }
  if (dimension === 'coherenceCohesion') {
    return /coherence|cohesion|paragraph|progression|structure|logical|transition/.test(text)
      || sentenceFeedback.some(item => item.dimension === 'CC');
  }
  if (dimension === 'lexicalResource') {
    return sentenceFeedback.some(item => item.dimension === 'LR')
      || vocabularyUpgrade.expressionUpgrades.some(item => item.original || item.category === 'from_essay');
  }
  return sentenceFeedback.some(item => item.dimension === 'GRA');
};

const buildWritingDimensionBlockers = (
  scores: WritingFeedback['scores'],
  frameworkFeedback: WritingFeedback['frameworkFeedback'],
  sentenceFeedback: WritingFeedback['sentenceFeedback'],
  vocabularyUpgrade: WritingFeedback['vocabularyUpgrade'],
  essay: string,
): {
  frameworkAdditions: WritingFeedback['frameworkFeedback'];
  sentenceAdditions: WritingFeedback['sentenceFeedback'];
  normalized: boolean;
} => {
  const frameworkAdditions: WritingFeedback['frameworkFeedback'] = [];
  const sentenceAdditions: WritingFeedback['sentenceFeedback'] = [];
  const sourceQuote = splitSentences(essay)[0] || essay.split(/\r?\n/).find(Boolean) || 'Essay excerpt';

  (Object.keys(dimensionBlockerConfigs) as (keyof typeof dimensionBlockerConfigs)[]).forEach(key => {
    const config = dimensionBlockerConfigs[key];
    const dimension = config.field as keyof WritingFeedback['scores'];
    if (scores[dimension] >= 7 || hasWritingBlockerForDimension(dimension, frameworkFeedback, sentenceFeedback, vocabularyUpgrade)) {
      return;
    }
    if (dimension === 'taskResponse' || dimension === 'coherenceCohesion') {
      frameworkAdditions.push({
        issue: config.issue,
        suggestionZh: config.suggestionZh,
        severity: 'fatal',
        location: 'Whole Essay',
        issueType: config.issueType,
        relatedCorrectionIds: [],
        paragraphFixZh: config.paragraphFixZh,
        exampleFrame: defaultExampleFrame(config.issue),
        transferGuidanceZh: config.transferGuidanceZh,
      });
    } else {
      const correctionNumber = sentenceFeedback.length + sentenceAdditions.length + 1;
      sentenceAdditions.push({
        id: `C${correctionNumber}`,
        correctionNumber,
        paragraph: 'Whole Essay',
        sourceQuote,
        issueType: config.issueType,
        severity: 'medium',
        primaryIssue: config.issue,
        secondaryIssues: [],
        microUpgrades: [],
        transferGuidanceZh: config.transferGuidanceZh,
        original: sourceQuote,
        correction: sourceQuote,
        dimension: config.dimension,
        tag: config.issueType,
        explanationZh: config.suggestionZh,
      });
    }
  });

  return {
    frameworkAdditions,
    sentenceAdditions,
    normalized: Boolean(frameworkAdditions.length || sentenceAdditions.length),
  };
};

const normalizeModelAnswerAnnotations = (
  value: unknown,
  modelAnswer: string,
): WritingFeedback['modelAnswerAnnotations'] =>
  (Array.isArray(value) ? value : [])
    .map(item => {
      const record = isRecord(item) ? item : {};
      const quote = typeof record.quote === 'string' ? record.quote.trim() : '';
      const type = record.type;
      const labelZh = typeof record.labelZh === 'string' && record.labelZh.trim()
        ? record.labelZh.trim()
        : 'model phrase';
      if (
        !quote ||
        !modelAnswer.includes(quote) ||
        (
          type !== 'topic_vocabulary' &&
          type !== 'expression_upgrade' &&
          type !== 'sentence_repair' &&
          type !== 'logic_repair'
        )
      ) {
        return null;
      }
      return { quote, type, labelZh };
    })
    .filter((item): item is NonNullable<WritingFeedback['modelAnswerAnnotations']>[number] => Boolean(item))
    .filter((item, index, items) => items.findIndex(candidate => candidate.quote === item.quote) === index)
    .slice(0, 14);

const buildWritingTask2Markdown = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>): string => {
  const warnings = feedback.essayLevelWarnings.length
    ? feedback.essayLevelWarnings.map(item => `- ${item.title}: ${item.messageZh}`).join('\n')
    : '- No essay-level warning.';
  const vocabulary = feedback.vocabularyUpgrade;
  const fromEssayUpgrades = vocabulary.expressionUpgrades.filter(item => item.category === 'from_essay' || item.original);
  const argumentFrames = vocabulary.expressionUpgrades.filter(item => item.category === 'argument_frame' || !item.original);
  const vocabularyItems = [
    '### Topic Vocabulary',
    ...(vocabulary.topicVocabulary.length
      ? vocabulary.topicVocabulary.map(item => `- ${item.expression}\n  - Meaning: ${item.meaningZh}\n  - Usage: ${item.usageZh.replace(/^Usage:\s*/, '')}${item.example ? `\n  - Example: ${item.example}` : ''}`)
      : ['- No topic vocabulary returned.']),
    '',
    '### Expression Upgrade',
    '',
    '#### From Your Essay',
    ...(fromEssayUpgrades.length
      ? fromEssayUpgrades.map(item => `- ${item.original ? `${item.original} -> ` : ''}${item.better}${expressionDetailLines(item) ? `\n${expressionDetailLines(item)}` : ''}`)
      : ['- No phrase-level upgrade from this essay.']),
    '',
    '#### Reusable Argument Frames',
    ...(argumentFrames.length
      ? argumentFrames.map(item => `- ${item.better}${expressionDetailLines(item) ? `\n${expressionDetailLines(item)}` : ''}`)
      : ['- No expression upgrade returned.']),
  ].join('\n');
  const missionItems = languageBankMissionItems(feedback);
  const highlightedModelAnswer = markLanguageBankTerms(feedback.modelAnswer, getLanguageBankHighlightTerms(vocabulary));
  const logicItems = feedback.frameworkFeedback.length
    ? feedback.frameworkFeedback.map((item, index) => {
        const related = item.relatedCorrectionIds?.length
          ? item.relatedCorrectionIds.map(id => `Correction #${id.replace(/^C/i, '')}`).join(', ')
          : 'Paragraph-level revision';
        return `### ${index + 1}. ${logicLocationZh(item.location)} - ${item.issue}
- Paragraph fix: ${normalizeLearnerChineseText(item.paragraphFixZh) || defaultParagraphFix(item.issue, item.location)}
- Transfer: ${normalizeLearnerChineseText(item.transferGuidanceZh) || defaultLogicTransfer()}
- Related: ${related}${item.exampleFrame ? `\n- Example frame: ${item.exampleFrame}` : ''}`;
      }).join('\n\n')
    : '- No logic-level issue returned.';
  const sentenceItems = feedback.sentenceFeedback.length
    ? feedback.sentenceFeedback.map((item, index) => {
        const issueList = [item.primaryIssue, ...(item.secondaryIssues || [])]
          .filter((issue): issue is string => Boolean(issue?.trim()));
        return `### Correction #${item.correctionNumber || index + 1}
- Issues: ${issueList.length ? issueList.join(' / ') : item.tag}
- Original: ${item.original}
- Suggested revision: ${item.correction}
- Explanation: ${item.explanationZh}
- Transfer: ${item.transferGuidanceZh || defaultSentenceTransfer(item.dimension, item.tag)}
${item.microUpgrades?.length ? `- Micro upgrades:\n${item.microUpgrades.map(upgrade => `  - ${upgrade.original} -> ${upgrade.better}: ${upgrade.explanationZh}`).join('\n')}` : ''}`;
      }).join('\n\n')
    : '- No sentence-level correction returned.';
  const estimate = averageWritingScore(feedback.scores);

  return `# IELTS Writing Task 2 Note

## Prompt
${feedback.question}

## My Essay
${feedback.essay}

## Essay-level Warnings
${warnings}

## Language Bank
${vocabularyItems}

## Logic & Structure Review
${logicItems}

## Sentence Corrections
${sentenceItems}

## Target Model Answer
- Training estimate: ${formatConservativeBandEstimate(estimate)}
- Target level: ${feedback.modelAnswerTargetLevel || getWritingTargetLevel(estimate)}

### Next Rewrite Focus
${missionItems.length ? missionItems.map(item => `- ${item}`).join('\n') : '- Reuse one Language Bank item in the next rewrite.'}

${feedback.modelAnswerPersonalized ? 'Highlighted phrases come from the Language Bank above.' : 'Provider did not mark this answer as personalized.'}

${highlightedModelAnswer}`;
};

const normalizeWritingFeedback = (
  value: unknown,
  request: WritingRequest,
  validationErrors: string[],
  normalizedFields: string[],
): WritingFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const essayWords = countWords(request.essay || '');
  const task = asWritingTask(source.task, request.task, validationErrors);
  const lengthWarning = buildWritingLengthWarning(essayWords, task);
  const promptMismatchWarning = task === 'task2'
    ? buildWritingPromptMismatchWarning(request.question || '', request.essay || '')
    : null;
  const sentenceFeedback = asArray(source.sentenceFeedback, 'sentenceFeedback', validationErrors).map((item, index) => {
    const record = isRecord(item) ? item : {};
    if (!isRecord(item)) validationErrors.push(`sentenceFeedback[${index}] missing or invalid object`);
    const dimension = normalizeDimension(record.dimension, `sentenceFeedback[${index}].dimension`, validationErrors);
    const tag = asString(record.tag, 'provider_safety', `sentenceFeedback[${index}].tag`, validationErrors);
    const primaryIssue = normalizeIssueLabel(record.primaryIssue, dimension, tag);
    return {
      id: normalizeCorrectionId(record.id ?? record.correctionNumber, index),
      correctionNumber: index + 1,
      paragraph: typeof record.paragraph === 'string' && record.paragraph.trim() ? record.paragraph.trim() : undefined,
      sourceQuote: typeof record.sourceQuote === 'string' && record.sourceQuote.trim()
        ? record.sourceQuote.trim()
        : typeof record.original === 'string' && record.original.trim()
          ? record.original.trim()
          : undefined,
      issueType: typeof record.issueType === 'string' && record.issueType.trim() ? record.issueType.trim() : undefined,
      severity: normalizeSentenceSeverity(record.severity, dimension, tag),
      primaryIssue,
      secondaryIssues: normalizeSecondaryIssues(record.secondaryIssues, primaryIssue),
      microUpgrades: normalizeMicroUpgrades(record.microUpgrades),
      transferGuidanceZh: normalizeTransferGuidance(
        record.transferGuidanceZh,
        defaultSentenceTransfer(dimension, tag),
      ),
      original: asString(record.original, FALLBACK_TEXT, `sentenceFeedback[${index}].original`, validationErrors),
      correction: asString(record.correction, FALLBACK_TEXT, `sentenceFeedback[${index}].correction`, validationErrors),
      dimension,
      tag,
      explanationZh: asString(
        record.explanationZh,
        'This sentence needs a clearer correction and explanation.',
        `sentenceFeedback[${index}].explanationZh`,
        validationErrors,
      ),
    };
  });
  const validCorrectionIds = new Set(sentenceFeedback.map(item => item.id || `C${item.correctionNumber || 1}`));
  const sourceWarnings = (Array.isArray(source.essayLevelWarnings) ? source.essayLevelWarnings : [])
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      return {
        title: asString(record.title, 'Essay-level warning', `essayLevelWarnings[${index}].title`, validationErrors),
        messageZh: asString(record.messageZh ?? record.message, FALLBACK_TEXT, `essayLevelWarnings[${index}].messageZh`, validationErrors),
      };
    })
    .filter(item => item.messageZh !== FALLBACK_TEXT)
    .filter(item => isGlobalEssayWarning(item.title, item.messageZh));
  const frameworkFeedback = asArray(source.frameworkFeedback, 'frameworkFeedback', validationErrors)
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`frameworkFeedback[${index}] missing or invalid object`);
      const issue = asString(record.issue, FALLBACK_TEXT, `frameworkFeedback[${index}].issue`, validationErrors);
      const suggestionZh = asString(
        record.suggestionZh,
        'Improve this paragraph by connecting task response and coherence more clearly.',
        `frameworkFeedback[${index}].suggestionZh`,
        validationErrors,
      );
      const issueType = typeof record.issueType === 'string' && record.issueType.trim() ? record.issueType.trim() : undefined;
      const location = normalizeLocation(record.location, `${issue} ${suggestionZh}`);
      const relatedCorrectionIds = (() => {
        const explicit = normalizeRelatedCorrectionIds(record.relatedCorrectionIds, validCorrectionIds);
        return explicit.length ? explicit : inferRelatedCorrectionIds(issue, suggestionZh, location, sentenceFeedback);
      })();
      const rawParagraphFix = typeof record.paragraphFixZh === 'string' && record.paragraphFixZh.trim()
        ? record.paragraphFixZh.trim()
        : '';
      const rawTransferGuidance = typeof record.transferGuidanceZh === 'string' && record.transferGuidanceZh.trim()
        ? record.transferGuidanceZh.trim()
        : '';
      const paragraphFixZh = rawParagraphFix && !sameGuidanceText(rawParagraphFix, suggestionZh)
        ? rawParagraphFix
        : defaultParagraphFix(issue, location);
      const transferGuidanceZh = rawTransferGuidance
        && !sameGuidanceText(rawTransferGuidance, suggestionZh)
        && !sameGuidanceText(rawTransferGuidance, paragraphFixZh)
        ? rawTransferGuidance
        : defaultLogicTransfer();
      return {
        issue,
        suggestionZh,
        severity: normalizeFrameworkSeverity(record.severity, `frameworkFeedback[${index}].severity`, validationErrors),
        location,
        issueType,
        relatedCorrectionIds,
        paragraphFixZh,
        exampleFrame: typeof record.exampleFrame === 'string' && record.exampleFrame.trim()
          ? record.exampleFrame.trim()
          : defaultExampleFrame(issue),
        transferGuidanceZh: normalizeTransferGuidance(transferGuidanceZh, defaultLogicTransfer()),
      };
    })
    .filter(item => !/under-length|insufficient sample|extremely insufficient/i.test(item.issue))
    .filter(item => isFrameworkLevelIssue(item.issue, item.suggestionZh, item.issueType));

  const baseScoresNormalized = {
    taskResponse: applyLengthCap(asNumber(scores.taskResponse, 'scores.taskResponse', validationErrors), essayWords, 250),
    coherenceCohesion: applyLengthCap(asNumber(scores.coherenceCohesion, 'scores.coherenceCohesion', validationErrors), essayWords, 250),
    lexicalResource: applyLengthCap(asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors), essayWords, 250),
    grammaticalRangeAccuracy: applyLengthCap(
      asNumber(scores.grammaticalRangeAccuracy, 'scores.grammaticalRangeAccuracy', validationErrors),
      essayWords,
      250,
    ),
  };
  const scoresNormalized = promptMismatchWarning
    ? {
        ...baseScoresNormalized,
        taskResponse: Math.min(baseScoresNormalized.taskResponse, 5.0),
        coherenceCohesion: Math.min(baseScoresNormalized.coherenceCohesion, 5.5),
      }
    : baseScoresNormalized;
  const vocabularyUpgrade = buildLocalVocabularyUpgrade(source, request, sentenceFeedback, validationErrors);
  const consistencyBlockers = buildWritingDimensionBlockers(
    scoresNormalized,
    frameworkFeedback,
    sentenceFeedback,
    vocabularyUpgrade,
    request.essay || '',
  );
  if (consistencyBlockers.normalized) {
    normalizedFields.push('writingScoreFeedbackConsistency');
  }
  const finalFrameworkFeedback = [
    ...frameworkFeedback,
    ...consistencyBlockers.frameworkAdditions,
  ];
  const finalSentenceFeedback = [
    ...sentenceFeedback,
    ...consistencyBlockers.sentenceAdditions,
  ];
  const estimate = averageWritingScore(scoresNormalized);
  const expectedWritingTargetLayer = writingTargetLayerForEstimate(estimate);
  const providerWritingTargetLayer = normalizeTargetAnswerLayer(source.targetAnswerLayer);
  const writingTargetAnswerLayer = expectedWritingTargetLayer;
  if (providerWritingTargetLayer && providerWritingTargetLayer !== expectedWritingTargetLayer) {
    normalizedFields.push('targetLayerConsistency');
  }
  const targetLevel = expectedWritingTargetLayer === 'high_band_stability'
    ? 'High-band stability'
    : getWritingTargetLevel(estimate);
  const providerTargetLevel = optionalSafeString(source.modelAnswerTargetLevel);
  if (providerTargetLevel && expectedWritingTargetLayer !== 'high_band_stability' && providerTargetLevel !== targetLevel) {
    normalizedFields.push('targetLayerConsistency');
  }
  const targetFloor = targetFloorForLayer(writingTargetAnswerLayer);
  const firstTopicExpression = vocabularyUpgrade.topicVocabulary[0]?.expression || 'topic-specific language';
  const firstExpressionUpgrade = vocabularyUpgrade.expressionUpgrades[0]?.better || 'a clearer argument frame';
  const targetAnswerSelfScores = normalizeWritingTargetSelfScores(source.targetAnswerSelfScores);
  const providerTargetAnswerStatus = normalizeTargetAnswerStatus(source.targetAnswerStatus);
  const hasFatalWritingCap = Boolean(lengthWarning) ||
    Boolean(promptMismatchWarning) ||
    finalFrameworkFeedback.some(item => item.severity === 'fatal') ||
    finalSentenceFeedback.some(item => item.severity === 'major');
  const currentEssayIsHighBand = estimate >= 8 && !hasFatalWritingCap;
  const normalizedModelAnswer = currentEssayIsHighBand
    ? ''
    : asString(
        source.modelAnswer,
        `A stronger revision should keep your main position, use topic language such as "${firstTopicExpression}", and apply "${firstExpressionUpgrade}" where it helps the argument sound clearer.`,
        'modelAnswer',
        validationErrors,
      );
  const hasTargetAnswer = Boolean(normalizedModelAnswer.trim());
  const targetAnswerStatus: TargetAnswerStatus = (() => {
    if (currentEssayIsHighBand) return 'meets_target';
    if (!hasTargetAnswer) return 'not_generated';
    if (writingTargetScoresBelowFloor(targetAnswerSelfScores, targetFloor)) {
      return providerTargetAnswerStatus === 'failed' ? 'failed' : 'borderline';
    }
    if (providerTargetAnswerStatus === 'failed' || providerTargetAnswerStatus === 'borderline') {
      return providerTargetAnswerStatus;
    }
    if (writingTargetScoresMeetFloor(targetAnswerSelfScores, targetFloor)) return 'borderline';
    return 'borderline';
  })();
  if (
    providerTargetAnswerStatus !== targetAnswerStatus ||
    (writingTargetAnswerLayer !== 'high_band_stability' && !targetAnswerSelfScores) ||
    writingTargetScoresBelowFloor(targetAnswerSelfScores, targetFloor) ||
    (writingTargetAnswerLayer === 'band_8_plus' && targetAnswerStatus === 'borderline')
  ) {
    normalizedFields.push('targetAnswerIntegrity');
  }
  const defaultTargetValidationZh = currentEssayIsHighBand
    ? 'This model answer is already stable for the current high-band target.'
    : targetAnswerStatus === 'meets_target'
      ? `The model answer reaches the target level ${targetLevel}.`
      : targetAnswerStatus === 'not_generated'
        ? 'The provider did not generate a usable model answer.'
        : 'The model answer still needs revision before it can be treated as target-stable.';

  const feedbackWithoutMarkdown: Omit<WritingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'writing',
    task,
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    essay: asString(source.essay, request.essay || FALLBACK_TEXT, 'essay', validationErrors),
    scores: scoresNormalized,
    essayLevelWarnings: [
      ...(promptMismatchWarning ? [promptMismatchWarning] : []),
      ...sourceWarnings,
      ...(lengthWarning ? [lengthWarning] : []),
    ],
    frameworkFeedback: finalFrameworkFeedback,
    sentenceFeedback: finalSentenceFeedback,
    vocabularyUpgrade,
    modelAnswer: normalizedModelAnswer,
    modelAnswerAnnotations: normalizeModelAnswerAnnotations(source.modelAnswerAnnotations, normalizedModelAnswer),
    modelAnswerPersonalized: source.modelAnswerPersonalized === true,
    modelAnswerTargetLevel: targetLevel,
    estimateRationaleZh: optionalSafeString(source.estimateRationaleZh),
    targetBandFloor: targetFloor,
    targetLayer: targetLevel,
    targetValidationZh: targetAnswerStatus === 'meets_target'
      ? optionalSafeString(source.targetValidationZh) || defaultTargetValidationZh
      : defaultTargetValidationZh,
    targetUpgradeFocusZh: optionalSafeString(source.targetUpgradeFocusZh),
    targetAnswerFloor: targetFloor,
    targetAnswerLayer: writingTargetAnswerLayer,
    targetAnswerStatus,
    targetAnswerSelfScores,
    targetAnswerValidationScores: normalizeWritingTargetSelfScores(source.targetAnswerValidationScores),
    targetAnswerValidationRationaleZh: optionalSafeString(source.targetAnswerValidationRationaleZh),
    targetAnswerRationaleZh: optionalSafeString(source.targetAnswerRationaleZh),
    targetAnswerRepairFocusZh: optionalSafeString(source.targetAnswerRepairFocusZh) ||
      (targetAnswerStatus === 'borderline' || targetAnswerStatus === 'failed'
        ? 'Revise the model answer using the Language Bank and paragraph feedback.'
        : undefined),
    highBandStabilityZh: optionalSafeString(source.highBandStabilityZh) ||
      (currentEssayIsHighBand
        ? 'This model answer is stable enough for high-band practice.'
        : undefined),
    nextStepZh: optionalSafeString(source.nextStepZh) ||
      (currentEssayIsHighBand
        ? 'Practise applying this model structure to a new prompt.'
        : undefined),
    scoreConsistencyNoteZh: consistencyBlockers.normalized
      ? 'Target answer is below the desired floor and needs another rewrite.'
      : optionalSafeString(source.scoreConsistencyNoteZh),
    reusableArguments: asArray(source.reusableArguments, 'reusableArguments', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`reusableArguments[${index}] missing or invalid object`);
      return {
        argument: asString(record.argument, FALLBACK_TEXT, `reusableArguments[${index}].argument`, validationErrors),
        canBeReusedFor: normalizeStringArray(
          record.canBeReusedFor,
          `reusableArguments[${index}].canBeReusedFor`,
          validationErrors,
        ),
        explanationZh: asString(
          record.explanationZh,
          'Use topic-specific language and keep the argument clear.',
          `reusableArguments[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
  };

  const resolvedWritingTargetState = resolveWritingTargetState(feedbackWithoutMarkdown);
  normalizedFields.push(`targetState:${resolvedWritingTargetState}`);
  const feedbackWithTargetState: Omit<WritingFeedback, 'obsidianMarkdown'> = {
    ...feedbackWithoutMarkdown,
    targetState: resolvedWritingTargetState,
    targetValidationZh: resolvedWritingTargetState === 'high_band_boundary'
      ? HIGH_BAND_BOUNDARY_ZH
      : feedbackWithoutMarkdown.targetValidationZh,
    highBandStabilityZh: resolvedWritingTargetState === 'high_band_stable'
      ? feedbackWithoutMarkdown.highBandStabilityZh || HIGH_BAND_STABLE_ZH
      : feedbackWithoutMarkdown.highBandStabilityZh,
    targetAnswerRepairFocusZh: resolvedWritingTargetState === 'high_band_boundary'
      ? undefined
      : feedbackWithoutMarkdown.targetAnswerRepairFocusZh,
  };

  return {
    ...feedbackWithTargetState,
    obsidianMarkdown: buildWritingTask2TrainingMarkdown(feedbackWithTargetState),
  };
};

const buildWritingTask1Markdown = (feedback: Omit<WritingTask1Feedback, 'obsidianMarkdown'>): string =>
  `# IELTS Writing Task 1 Note

## Prompt
${feedback.instruction}

## Visual Brief
${feedback.visualBrief}

## Training Estimate
${formatConservativeBandEstimate(feedback.estimatedBand)}

## Must Fix
${feedback.mustFix.length ? feedback.mustFix.map(item => `- ${item}`).join('\n') : '- No critical Task 1 issue returned.'}

## Rewrite Task
${feedback.rewriteTask}

## Reusable Report Patterns
${feedback.reusableReportPatterns.length ? feedback.reusableReportPatterns.map(item => `- ${item}`).join('\n') : '- No reusable pattern returned.'}

## ${getTargetLabel(feedback.estimatedBand, 'report')}
${feedback.improvedReport || feedback.modelExcerpt || FALLBACK_TEXT}`;

const normalizeTaskAchievement = (
  value: unknown,
  estimatedBand: number,
  errors: string[],
): WritingTask1Feedback['taskAchievement'] => {
  const record = isRecord(value) ? value : {};
  if (!isRecord(value)) errors.push('taskAchievement missing or invalid object');
  return {
    score: asNumber(record.score, 'taskAchievement.score', errors, estimatedBand),
    feedback: asString(
      record.feedback,
      'Task Achievement feedback was incomplete and normalized safely.',
      'taskAchievement.feedback',
      errors,
    ),
  };
};

const normalizeLanguageCorrections = (
  value: unknown,
  errors: string[],
): WritingTask1Feedback['languageCorrections'] =>
  asArray(value, 'languageCorrections', errors).map((item, index) => {
    const record = isRecord(item) ? item : {};
    if (!isRecord(item)) errors.push(`languageCorrections[${index}] missing or invalid object`);
    return {
      original: asString(record.original, FALLBACK_TEXT, `languageCorrections[${index}].original`, errors),
      correction: asString(record.correction, FALLBACK_TEXT, `languageCorrections[${index}].correction`, errors),
      explanation: asString(
        record.explanation,
        'Provider feedback was incomplete; this item was normalized safely.',
        `languageCorrections[${index}].explanation`,
        errors,
      ),
    };
  });

const normalizeWritingTask1Feedback = (
  value: unknown,
  request: WritingTask1Request,
  validationErrors: string[],
  normalizedFields: string[],
): WritingTask1Feedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  const reportWords = countWords(request.report || '');
  const estimatedBand = applyLengthCap(asNumber(source.estimatedBand, 'estimatedBand', validationErrors), reportWords, 150);
  const lengthMustFix = reportWords < 150 ? insufficientSampleMessageZh('Writing Task 1', 150) : null;
  const improvedReportFallback = typeof source.modelExcerpt === 'string' && source.modelExcerpt.trim()
    ? source.modelExcerpt
    : 'The provider returned incomplete feedback. Please retry analysis.';

  const feedbackWithoutMarkdown: Omit<WritingTask1Feedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'writing_task1',
    task: 'task1',
    taskType: asString(source.taskType, request.taskType || 'Academic Task 1', 'taskType', validationErrors),
    instruction: asString(source.instruction, request.instruction || FALLBACK_TEXT, 'instruction', validationErrors),
    visualBrief: asString(source.visualBrief, request.visualBrief || FALLBACK_TEXT, 'visualBrief', validationErrors),
    report: asString(source.report, request.report || FALLBACK_TEXT, 'report', validationErrors),
    estimatedBand,
    taskAchievement: normalizeTaskAchievement(source.taskAchievement, estimatedBand, validationErrors),
    overviewFeedback: asString(
      source.overviewFeedback,
      'Overview feedback was incomplete; check whether the overview summarizes the key trends clearly.',
      'overviewFeedback',
      validationErrors,
    ),
    keyFeaturesFeedback: asString(
      source.keyFeaturesFeedback,
      'Key feature feedback was incomplete; check whether the report selects and compares the main features.',
      'keyFeaturesFeedback',
      validationErrors,
    ),
    comparisonFeedback: asString(
      source.comparisonFeedback,
      'Comparison feedback was incomplete; add clear comparative language where useful.',
      'comparisonFeedback',
      validationErrors,
    ),
    dataAccuracyFeedback: asString(
      source.dataAccuracyFeedback,
      'Data support feedback was incomplete; add accurate figures only when they support the trend.',
      'dataAccuracyFeedback',
      validationErrors,
    ),
    coherenceFeedback: asString(
      source.coherenceFeedback,
      'Structure feedback was incomplete; organize the report into overview and body paragraphs.',
      'coherenceFeedback',
      validationErrors,
    ),
    languageCorrections: normalizeLanguageCorrections(source.languageCorrections, validationErrors),
    mustFix: [
      ...(lengthMustFix ? [lengthMustFix] : []),
      ...normalizeStringArray(source.mustFix, 'mustFix', validationErrors),
    ],
    rewriteTask: asString(
      source.rewriteTask,
      'Rewrite the report with a clear overview, grouped key features, and accurate data references.',
      'rewriteTask',
      validationErrors,
    ),
    reusableReportPatterns: normalizeStringArray(
      source.reusableReportPatterns,
      'reusableReportPatterns',
      validationErrors,
    ),
    improvedReport: asString(
      source.improvedReport,
      improvedReportFallback,
      'improvedReport',
      validationErrors,
    ),
    modelExcerpt: typeof source.modelExcerpt === 'string' && source.modelExcerpt.trim()
      ? source.modelExcerpt
      : undefined,
  };

  const task1TargetState = resolveTask1TargetState(feedbackWithoutMarkdown);
  normalizedFields.push(`targetState:${task1TargetState}`);
  const feedbackWithTargetState: Omit<WritingTask1Feedback, 'obsidianMarkdown'> = {
    ...feedbackWithoutMarkdown,
    targetState: task1TargetState,
  };

  return {
    ...feedbackWithTargetState,
    obsidianMarkdown: (() => {
      if (typeof source.obsidianMarkdown === 'string' && source.obsidianMarkdown.trim()) {
        normalizedFields.push('obsidianMarkdown');
      }
      return buildWritingTask1TrainingMarkdown(feedbackWithTargetState);
    })(),
  };
};

type Task2FrameworkType =
  | 'causes-solutions'
  | 'discuss-both'
  | 'agree-disagree'
  | 'advantages-disadvantages'
  | 'general';

const detectTask2FrameworkType = (question: string): Task2FrameworkType => {
  const lower = question.toLowerCase();
  if (/(why|cause|reason|happen|happening).*(what can be done|solution|solve|measure|address|tackle)|problem.*solution|cause.*solution|causes.*solutions/.test(lower)) {
    return 'causes-solutions';
  }
  if (/discuss both|both views|discuss the two views/.test(lower)) return 'discuss-both';
  if (/agree or disagree|to what extent do you agree|do you agree/.test(lower)) return 'agree-disagree';
  if (/advantages and disadvantages|benefits and drawbacks|outweigh/.test(lower)) return 'advantages-disadvantages';
  return 'general';
};

const normalizeTask2ParagraphPlanLabel = (text: string): string =>
  text.replace(/\boverview\b/gi, 'thesis / position');

const buildEditableFrameworkSummary = (summary: Omit<WritingFrameworkSummary, 'editableSummary'>): string => {
  const paragraphPlan = normalizeTask2ParagraphPlanLabel(summary.paragraphPlan);
  const taskType = detectTask2FrameworkType(summary.question);

  if (taskType === 'causes-solutions') {
    return `Position:\n${summary.position}\n\nCause Analysis:\n${summary.viewA}\n\nSolution Plan:\n${summary.viewB}\n\nMy Position:\n${summary.myOpinion}\n\nParagraph Plan:\n${paragraphPlan}\n\nTopic-specific argument frames:\n${summary.possibleExample}`;
  }

  if (taskType === 'agree-disagree') {
    return `Core Position:\n${summary.position || summary.myOpinion}\n\nSupporting Reason 1:\n${summary.viewA}\n\nSupporting Reason 2:\n${summary.viewB}\n\nCounterpoint / Limit:\n${summary.myOpinion}\n\nParagraph Plan:\n${paragraphPlan}\n\nTopic-specific argument frames:\n${summary.possibleExample}`;
  }

  if (taskType === 'advantages-disadvantages') {
    return `Position:\n${summary.position}\n\nAdvantage Analysis:\n${summary.viewA}\n\nDisadvantage Analysis:\n${summary.viewB}\n\nMy Judgement:\n${summary.myOpinion}\n\nParagraph Plan:\n${paragraphPlan}\n\nTopic-specific argument frames:\n${summary.possibleExample}`;
  }

  return `Position:\n${summary.position}\n\nView A:\n${summary.viewA}\n\nView B:\n${summary.viewB}\n\nMy opinion:\n${summary.myOpinion}\n\nParagraph plan:\n${paragraphPlan}\n\nPossible example:\n${summary.possibleExample}`;
};

const normalizeWritingFrameworkSummary = (
  value: unknown,
  request: FrameworkRequest,
  validationErrors: string[],
): WritingFrameworkSummary => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  const normalizedWithoutEditable = {
    mode: source.mode === 'mock' ? 'mock' as const : 'practice' as const,
    module: 'writing' as const,
    task: 'task2' as const,
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    sourceNotes: asString(source.sourceNotes, request.notes || FALLBACK_TEXT, 'sourceNotes', validationErrors),
    position: asString(
      source.position,
      'Not decided yet.',
      'position',
      validationErrors,
    ),
    viewA: asString(
      source.viewA,
      'Not decided yet.',
      'viewA',
      validationErrors,
    ),
    viewB: asString(
      source.viewB,
      'Not decided yet.',
      'viewB',
      validationErrors,
    ),
    myOpinion: asString(
      source.myOpinion,
      'Not decided yet.',
      'myOpinion',
      validationErrors,
    ),
    paragraphPlan: asString(
      source.paragraphPlan,
      'Not decided yet.',
      'paragraphPlan',
      validationErrors,
    ),
    possibleExample: asString(
      source.possibleExample,
      'Suggested example, please confirm: Not decided yet.',
      'possibleExample',
      validationErrors,
    ),
  };

  return {
    ...normalizedWithoutEditable,
    editableSummary: (() => {
      const taskType = detectTask2FrameworkType(normalizedWithoutEditable.question);
      const providerEditable = optionalSafeString(source.editableSummary);
      if (providerEditable && taskType === 'discuss-both') {
        return normalizeTask2ParagraphPlanLabel(providerEditable);
      }
      return buildEditableFrameworkSummary(normalizedWithoutEditable);
    })(),
  };
};

const normalizeReadiness = (
  value: unknown,
  validationErrors: string[],
): WritingFrameworkReadiness => {
  if (value === 'not_ready' || value === 'almost_ready' || value === 'ready_to_write') {
    return value;
  }
  validationErrors.push('readiness missing or invalid');
  return 'not_ready';
};

const asBoolean = (value: unknown, field: string, validationErrors: string[]): boolean => {
  if (typeof value === 'boolean') return value;
  validationErrors.push(`${field} missing or invalid boolean`);
  return false;
};

const normalizeCoachList = (
  value: unknown,
  field: string,
  validationErrors: string[],
  maxItems: number,
): string[] => {
  if (!Array.isArray(value)) {
    validationErrors.push(`${field} missing or invalid array`);
    return [];
  }
  return value
    .filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    .map(item => item.trim())
    .slice(0, maxItems);
};

const normalizeFrameworkCoach = (
  value: unknown,
  request: FrameworkCoachRequest,
  validationErrors: string[],
): WritingFrameworkCoachFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  const checklist = isRecord(source.checklist) ? source.checklist : {};
  if (!isRecord(source.checklist)) validationErrors.push('checklist missing or invalid object');
  const readiness = normalizeReadiness(source.readiness, validationErrors);
  const comments = normalizeCoachList(source.comments, 'comments', validationErrors, 4);
  const mainGaps = normalizeCoachList(source.mainGaps, 'mainGaps', validationErrors, 4);
  const nextQuestions = normalizeCoachList(source.nextQuestions, 'nextQuestions', validationErrors, 3);
  const finalFixes = normalizeCoachList(source.finalFixes, 'finalFixes', validationErrors, 3);
  const readySummary = asString(
    source.readySummary,
    readiness === 'ready_to_write' ? 'Framework is ready enough to write.' : '',
    'readySummary',
    validationErrors,
  );
  const fallbackMessage = comments.length
    ? comments.join('\n')
    : readiness === 'ready_to_write'
      ? 'Framework is ready. Generate the summary or start writing.'
      : 'Please clarify your final position, two body ideas, and one supporting example.';

  return {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'writing',
    task: 'task2',
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    sourceNotes: asString(source.sourceNotes, request.notes || FALLBACK_TEXT, 'sourceNotes', validationErrors),
    readiness,
    checklist: {
      taskTypeAnswered: asBoolean(checklist.taskTypeAnswered, 'checklist.taskTypeAnswered', validationErrors),
      clearPosition: asBoolean(checklist.clearPosition, 'checklist.clearPosition', validationErrors),
      bothViewsCovered: asBoolean(checklist.bothViewsCovered, 'checklist.bothViewsCovered', validationErrors),
      supportExists: asBoolean(checklist.supportExists, 'checklist.supportExists', validationErrors),
      paragraphPlanClear: asBoolean(checklist.paragraphPlanClear, 'checklist.paragraphPlanClear', validationErrors),
    },
    mainGaps,
    nextQuestions: readiness === 'ready_to_write' ? [] : nextQuestions,
    finalFixes,
    readySummary,
    message: asString(source.message, fallbackMessage, 'message', validationErrors),
    comments,
  };
};

const validationStatusFromScores = (scores: (number | undefined)[], floor: number): TargetAnswerStatus => {
  const numericScores = scores.filter((score): score is number => typeof score === 'number' && Number.isFinite(score));
  if (numericScores.length !== scores.length) return 'failed';
  if (numericScores.every(score => score >= floor)) return 'meets_target';
  return numericScores.some(score => score < floor - 0.5) ? 'failed' : 'borderline';
};

const normalizeSpeakingTargetValidation = (
  value: unknown,
  request: SpeakingValidationRequest,
  validationErrors: string[],
  normalizedFields: string[],
): SpeakingTargetValidationResult => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  const scoresSource = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const targetFloor = normalizeHalfBandScore(request.targetFloor);
  const providerTargetFloor = asOptionalHalfBand(source.targetFloor);
  if (providerTargetFloor !== undefined && providerTargetFloor !== targetFloor) {
    normalizedFields.push(`targetFloorOverride:${providerTargetFloor.toFixed(1)}->${targetFloor.toFixed(1)}`);
  }
  const scores: SpeakingTargetAnswerSelfScores = {
    fluencyCoherence: asOptionalHalfBand(scoresSource.fluencyCoherence),
    lexicalResource: asOptionalHalfBand(scoresSource.lexicalResource),
    grammaticalRangeAccuracy: asOptionalHalfBand(scoresSource.grammaticalRangeAccuracy),
    pronunciation: null,
  };
  const status = validationStatusFromScores([
    scores.fluencyCoherence,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ], targetFloor);
  const providerStatus = normalizeTargetAnswerStatus(source.status);
  if (providerStatus !== status || status !== 'meets_target') normalizedFields.push('targetValidationFailed');

  return {
    module: 'speaking',
    operation: 'speaking_target_validation',
    targetFloor,
    status,
    scores,
    rationaleZh: optionalSafeString(source.rationaleZh) ||
      (status === 'meets_target'
        ? 'Independent validator judged this target answer at or above the target floor.'
        : 'Independent validator did not judge this target answer as stable at the target floor.'),
    repairFocusZh: optionalSafeString(source.repairFocusZh) ||
      (status === 'meets_target'
        ? ''
        : 'This target answer still needs repair before it can be validated.'),
  };
};

export const normalizePart1CleanRetryCertificationResult = (
  value: unknown,
  request: Part1CertificationRequest,
  validationErrors: string[] = [],
  normalizedFields: string[] = [],
): Part1CleanRetryCertificationResult => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  if (source.operation !== undefined && source.operation !== 'part1_clean_retry_certification') {
    validationErrors.push('operation mismatch for part1_clean_retry_certification');
  }
  const providerAttempt = source.attempt === 1 || source.attempt === 2 ? source.attempt : undefined;
  if (providerAttempt !== undefined && providerAttempt !== request.attempt) {
    normalizedFields.push(`part1CleanRetryCertificationAttempt:${providerAttempt}->${request.attempt}`);
  }
  const rawViolations = asArray(source.violations, 'violations', validationErrors);
  const violations = rawViolations
    .map((item, index) => normalizePart1CertificationViolation(item, request, index, validationErrors))
    .filter((item): item is Part1CleanRetryCertificationViolation => Boolean(item));
  if (rawViolations.length > violations.length) {
    normalizedFields.push(`part1CleanRetryUnsupportedViolationsRemoved:${rawViolations.length - violations.length}`);
  }

  const providerStatus = source.status === 'passed' || source.status === 'failed' ? source.status : undefined;
  if (!providerStatus) validationErrors.push('status missing or invalid');
  const status = violations.length ? 'failed' : 'passed';
  if (providerStatus && providerStatus !== status) {
    normalizedFields.push(`part1CleanRetryCertificationStatus:${providerStatus}->${status}`);
  }

  const revisedCleanRetryAnswers = request.attempt === 1 && status === 'failed'
    ? normalizePart1CertificationAnswerSet(source.revisedCleanRetryAnswers, request, validationErrors, 'revisedCleanRetryAnswers')
    : [];
  if (request.attempt === 1 && status === 'failed') {
    assertPart1CertificationCoverage(revisedCleanRetryAnswers, request, validationErrors, 'revisedCleanRetryAnswers');
  }
  if (request.attempt === 2 && Array.isArray(source.revisedCleanRetryAnswers) && source.revisedCleanRetryAnswers.length) {
    normalizedFields.push('part1CleanRetrySecondAttemptRewriteIgnored');
  }

  return {
    module: 'speaking',
    operation: 'part1_clean_retry_certification',
    topic: request.topic,
    threadId: request.threadId,
    attempt: request.attempt,
    status,
    violations,
    revisedCleanRetryAnswers,
    rationaleZh: sanitizePart1FeedbackText(optionalSafeString(source.rationaleZh)) ||
      (status === 'passed'
        ? 'Part 1 clean retry answers passed internal certification.'
        : 'Part 1 clean retry answers still contain hard issues.'),
  };
};

const normalizePart1CleanRetryCertification = normalizePart1CleanRetryCertificationResult;

export const normalizePart1LearningAssetsResult = (
  value: unknown,
  request: Part1LearningAssetsSafeRequest,
  validationErrors: string[] = [],
  normalizedFields: string[] = [],
): Part1LearningAssetsResult => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  if (source.operation !== undefined && source.operation !== 'part1_learning_assets') {
    validationErrors.push('operation mismatch for part1_learning_assets');
  }
  const answers = request.threadAnswers || [];
  const materialSource = isRecord(source.materialBank) ? source.materialBank : {};
  const developmentDiagnostics: Part1DevelopmentDiagnostics = {
    accepted: 0,
    replacedForGrounding: 0,
    fullSentenceScaffoldsFiltered: 0,
    ungroundedScaffoldsFiltered: 0,
  };
  const rawDevelopmentTargets = normalizePart1DevelopmentTargets(source.developmentTargets, answers, validationErrors, developmentDiagnostics);
  const developmentTargets = consolidatePart1DevelopmentTargets(rawDevelopmentTargets);
  normalizedFields.push(`part1LearningAssetsDevelopmentTargetsAccepted:${developmentDiagnostics.accepted}`);
  normalizedFields.push(`part1LearningAssetsDevelopmentTargets:${developmentTargets.length}`);
  normalizedFields.push(`part1LearningAssetsFullSentenceScaffoldsFiltered:${developmentDiagnostics.fullSentenceScaffoldsFiltered}`);
  normalizedFields.push(`part1LearningAssetsUngroundedScaffoldsFiltered:${developmentDiagnostics.ungroundedScaffoldsFiltered}`);
  if (rawDevelopmentTargets.length !== developmentTargets.length) {
    normalizedFields.push(`part1LearningAssetsDevelopmentTargetsConsolidated:${rawDevelopmentTargets.length}->${developmentTargets.length}`);
  }

  const myUsableMaterial = normalizePart1MaterialItems(
    materialSource.myUsableMaterial,
    'materialBank.myUsableMaterial',
    'personal',
    answers,
    validationErrors,
  ).sort((left, right) => part1MaterialValueRank(right) - part1MaterialValueRank(left));
  const personalMaterialKeys = new Set(myUsableMaterial.flatMap(item => [
    part1AnnotationKeyText(item.sourceWording || ''),
    part1AnnotationKeyText(item.reusableVersion),
  ]).filter(Boolean));
  const reusableSpokenLanguage = normalizePart1MaterialItems(
    materialSource.reusableSpokenLanguage,
    'materialBank.reusableSpokenLanguage',
    'language',
    answers,
    validationErrors,
  ).filter(item => {
    const sourceKey = part1AnnotationKeyText(item.sourceWording || '');
    const reusableKey = part1AnnotationKeyText(item.reusableVersion);
    return !personalMaterialKeys.has(sourceKey) && !personalMaterialKeys.has(reusableKey);
  });
  normalizedFields.push(`part1LearningAssetsMaterials:${myUsableMaterial.length}`);
  normalizedFields.push(`part1LearningAssetsExpressions:${reusableSpokenLanguage.length}`);

  return {
    module: 'speaking',
    operation: 'part1_learning_assets',
    topic: request.topic || optionalSafeString(source.topic) || 'Part 1 Topic',
    threadId: request.threadId || optionalSafeString(source.threadId) || 'part1_thread',
    questionCount: answers.length,
    developmentTargets,
    materialBank: {
      myUsableMaterial,
      reusableSpokenLanguage,
    },
    rationaleZh: sanitizePart1FeedbackText(optionalSafeString(source.rationaleZh)),
  };
};

const normalizePart1LearningAssets = normalizePart1LearningAssetsResult;

const normalizeWritingTargetValidation = (
  value: unknown,
  request: WritingValidationRequest,
  validationErrors: string[],
  normalizedFields: string[],
): WritingTargetValidationResult => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');
  const scoresSource = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const targetFloor = normalizeHalfBandScore(request.targetFloor);
  const providerTargetFloor = asOptionalHalfBand(source.targetFloor);
  if (providerTargetFloor !== undefined && providerTargetFloor !== targetFloor) {
    normalizedFields.push(`targetFloorOverride:${providerTargetFloor.toFixed(1)}->${targetFloor.toFixed(1)}`);
  }
  const scores: WritingTargetAnswerSelfScores = {
    taskResponse: asOptionalHalfBand(scoresSource.taskResponse),
    coherenceCohesion: asOptionalHalfBand(scoresSource.coherenceCohesion),
    lexicalResource: asOptionalHalfBand(scoresSource.lexicalResource),
    grammaticalRangeAccuracy: asOptionalHalfBand(scoresSource.grammaticalRangeAccuracy),
  };
  const status = validationStatusFromScores([
    scores.taskResponse,
    scores.coherenceCohesion,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
  ], targetFloor);
  const providerStatus = normalizeTargetAnswerStatus(source.status);
  if (providerStatus !== status || status !== 'meets_target') normalizedFields.push('targetValidationFailed');

  return {
    module: 'writing',
    operation: 'writing_target_validation',
    targetFloor,
    status,
    scores,
    rationaleZh: optionalSafeString(source.rationaleZh) ||
      (status === 'meets_target'
        ? 'Independent validator judged this model answer at or above the target floor.'
        : 'Independent validator did not judge this model answer as stable at the target floor.'),
    repairFocusZh: optionalSafeString(source.repairFocusZh) ||
      (status === 'meets_target'
        ? ''
        : 'This model answer still needs repair before it can be validated.'),
  };
};

export const safeAnalyzeSpeaking = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: SpeakingRequest,
): Promise<SafeAnalyzeResult<SpeakingFeedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    rawResponse = await provider.analyzeSpeaking(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeSpeakingFeedback(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'speaking',
      operation: 'speaking_analysis',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeTranscribeSpeakingAudio = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: SpeakingTranscriptionRequest,
): Promise<SafeAnalyzeResult<SpeakingAudioTranscriptionResult>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    if (!provider.transcribeSpeakingAudio) {
      throw new Error('Provider does not implement speaking audio transcription');
    }

    rawResponse = await provider.transcribeSpeakingAudio(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeSpeakingAudioTranscription(parsedJson, validationErrors);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'speaking',
      operation: 'speaking_audio_transcription',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeScoreSpeakingOnly = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: SpeakingScoreRequest,
): Promise<SafeAnalyzeResult<SpeakingScoreOnlyResult>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    if (!provider.scoreSpeakingOnly) {
      throw new Error('Provider does not implement scoreSpeakingOnly');
    }

    rawResponse = await provider.scoreSpeakingOnly(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeSpeakingScoreOnly(parsedJson, requestPayload, validationErrors);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'speaking',
      operation: 'speaking_score_only',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeValidateSpeakingTarget = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: SpeakingValidationRequest,
): Promise<SafeAnalyzeResult<SpeakingTargetValidationResult>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    if (!provider.validateSpeakingTarget) {
      throw new Error('Provider does not implement validateSpeakingTarget');
    }

    rawResponse = await provider.validateSpeakingTarget(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeSpeakingTargetValidation(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'speaking',
      operation: 'speaking_target_validation',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeCertifyPart1CleanRetry = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: Part1CertificationRequest,
): Promise<SafeAnalyzeResult<Part1CleanRetryCertificationResult>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    if (!provider.certifyPart1CleanRetry) {
      throw new Error('Provider does not implement certifyPart1CleanRetry');
    }

    rawResponse = await provider.certifyPart1CleanRetry(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizePart1CleanRetryCertification(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'speaking',
      operation: 'part1_clean_retry_certification',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeAnalyzePart1LearningAssets = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: Part1LearningAssetsSafeRequest,
): Promise<SafeAnalyzeResult<Part1LearningAssetsResult>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    if (!provider.generatePart1LearningAssets) {
      throw new Error('Provider does not implement generatePart1LearningAssets');
    }

    rawResponse = await provider.generatePart1LearningAssets(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizePart1LearningAssets(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'speaking',
      operation: 'part1_learning_assets',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeAnalyzeWriting = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: WritingRequest,
): Promise<SafeAnalyzeResult<WritingFeedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    rawResponse = await provider.analyzeWriting(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeWritingFeedback(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'writing',
      operation: 'writing_analysis',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeValidateWritingTarget = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: WritingValidationRequest,
): Promise<SafeAnalyzeResult<WritingTargetValidationResult>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    if (!provider.validateWritingTarget) {
      throw new Error('Provider does not implement validateWritingTarget');
    }

    rawResponse = await provider.validateWritingTarget(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeWritingTargetValidation(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'writing',
      operation: 'writing_target_validation',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeAnalyzeWritingTask1 = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: WritingTask1Request,
): Promise<SafeAnalyzeResult<WritingTask1Feedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];
  const normalizedFields: string[] = [];

  try {
    if (!provider.analyzeWritingTask1) {
      throw new Error('Provider does not implement analyzeWritingTask1');
    }

    rawResponse = await provider.analyzeWritingTask1(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeWritingTask1Feedback(parsedJson, requestPayload, validationErrors, normalizedFields);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'writing_task1',
      operation: 'writing_task1_analysis',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      normalizedFields,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeCoachWritingFramework = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: FrameworkCoachRequest,
): Promise<SafeAnalyzeResult<WritingFrameworkCoachFeedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    if (!provider.coachWritingFramework) {
      throw new Error('Provider does not implement coachWritingFramework');
    }

    rawResponse = await provider.coachWritingFramework(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeFrameworkCoach(parsedJson, requestPayload, validationErrors);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'writing',
      operation: 'writing_framework_coach',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      timestamp: new Date().toISOString(),
    }),
  };
};

export const safeExtractWritingFramework = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: FrameworkRequest,
): Promise<SafeAnalyzeResult<WritingFrameworkSummary>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    if (!provider.extractWritingFramework) {
      throw new Error('Provider does not implement extractWritingFramework');
    }

    rawResponse = await provider.extractWritingFramework(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeWritingFrameworkSummary(parsedJson, requestPayload, validationErrors);
  const fallbackUsed = Boolean(parseError) || validationErrors.length > 0;
  const failureKind = getFailureKind(parseError, validationErrors);

  return {
    feedback,
    diagnostic: buildDiagnostic({
      module: 'writing',
      operation: 'writing_framework_extraction',
      providerName,
      requestPayload,
      rawResponse,
      parsedJson,
      parseError,
      validationErrors,
      fallbackUsed,
      failureKind,
      timestamp: new Date().toISOString(),
    }),
  };
};
