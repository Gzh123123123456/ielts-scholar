import {
  AIProvider,
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
  Part1AnnotationSeverity,
  Part1CleanRetryAnswer,
  SpeakingAudioTranscriptionResult,
  SpeakingFeedback,
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
  `样本太短，无法形成可靠的 ${moduleLabel} 训练估计。先扩展到接近 ${minimumWords} 词，并补充完整观点、细节和例子后再看语言问题。`;

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
    ? value.match(/(\d(?:\.\d)?)\s*[-–]\s*(\d(?:\.\d)?)/)
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

const calibrateSpeakingUpgradedAnswer = (
  value: string,
  part: SpeakingPart,
  transcript: string,
  limitTransformation: boolean,
): string => {
  if (limitTransformation || part !== 1 || isProviderIncompleteSpeakingAnswer(value)) return value;
  const words = countWords(value);
  const sentences = splitSentences(value);
  if (words <= 80 && sentences.length <= 4) return value;

  const trimmed = sentences.slice(0, 4).join(' ');
  if (countWords(trimmed) >= 25 && countWords(trimmed) <= 85) return trimmed;
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

const PROMPT_MISMATCH_ZH = '这段回答似乎没有回答当前题目，请确认是否选错题目。';

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
    'networkerror',
    'failed to fetch',
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
  const headline = normalizeHalfBandScore(applySpeakingLengthCap(
    asNumber(source.bandEstimateExcludingPronunciation, 'bandEstimateExcludingPronunciation', validationErrors),
    transcriptWords,
    part,
  ));
  const minimumVisibleScore = Math.min(
    visibleScores.fluencyCoherence,
    visibleScores.lexicalResource,
    visibleScores.grammaticalRangeAccuracy,
  );
  const normalizedHeadline = headline > 0 && minimumVisibleScore > 0 && headline < minimumVisibleScore
    ? minimumVisibleScore
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
) => asArray(value, path, validationErrors).map((item, index) => {
  const record = isRecord(item) ? item : {};
  if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
  const questionRefs = normalizeQuestionRefs(record.questionRefs ?? record.affectedQuestions, answers);
  const original = safeLearningText(asString(record.original ?? record.learnerWording, FALLBACK_TEXT, `${path}[${index}].original`, validationErrors));
  const better = safeLearningText(asString(record.better ?? record.betterVersion, FALLBACK_TEXT, `${path}[${index}].better`, validationErrors));
  const explanationZh = safeLearningText(asString(record.explanationZh, 'Provider feedback was incomplete; this item was normalized safely.', `${path}[${index}].explanationZh`, validationErrors));
  const answerIndex = Number((questionRefs[0] || 'Q1').replace(/^Q/i, '')) - 1;
  const repair = normalizePart1RepairLayer(original, better, path, explanationZh, answers[answerIndex]?.answer || '');
  if (!repair) return null;
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

const calibratePart1AnnotationSeverity = (
  severity: Part1AnnotationSeverity,
  issueType: string,
  explanationZh: string,
): Part1AnnotationSeverity => {
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  if (!/article|determiner|pronoun|plural|singular|countability|preposition|fixed collocation|wrong collocation|tense|agreement|subject-verb|verb|word form|missing|grammar|accuracy|demonstrative|reference|this\/that|these\/those/.test(evidence)) {
    return severity;
  }
  return severity === 'optional_polish' || severity === 'better_spoken_choice'
    ? 'must_fix'
    : severity;
};

const normalizeTranscriptFormatText = (text: string) =>
  safeLearningText(text)
    .normalize('NFKC')
    .replace(/[‘’‚`]/g, "'")
    .replace(/[“”„]/g, '"')
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
  const hasFormatOnlyEvidence = /\b(capitali[sz]ation|uppercase|lowercase|punctuation|spacing|spelling|spell|typo|orthograph|transcription|asr|homophone|pronunciation|pronounce)\b|拼写|大小写|标点|空格|转写|同音|发音/.test(evidence);
  const hasSpokenLanguageEvidence = /\b(article|determiner|pronoun|plural|singular|countability|preposition|collocation|tense|agreement|verb|word form|missing|grammar|accuracy|structure|word choice|natural|phrasing|spoken|reference)\b/.test(evidence);
  const originalWords = originalText.split(/\s+/).filter(Boolean);
  const betterWords = betterText.split(/\s+/).filter(Boolean);
  if (hasFormatOnlyEvidence && (!hasSpokenLanguageEvidence || (originalWords.length === 1 && betterWords.length === 1))) return true;
  const homophonePairs = new Set(['to|too', 'too|to', 'there|their', 'their|there', 'its|it s', 'it s|its']);
  return homophonePairs.has(`${originalText}|${betterText}`);
};

const hasExplicitPart1SpokenIssue = (issueType: string, explanationZh: string) =>
  /\b(article|determiner|pronoun|plural|singular|countability|preposition|collocation|tense|agreement|subject-verb|verb|word form|missing|grammar|structure|word choice|reference)\b|冠词|代词|单复数|时态|一致|介词|搭配|缺少|语法/.test(`${issueType} ${explanationZh}`.toLowerCase());

const part1IssueExplanation = (issueType: string, explanationZh: string) => {
  const evidence = `${issueType} ${explanationZh}`.toLowerCase();
  if (/\b(article|determiner)\b|冠词/.test(evidence)) return 'Article or determiner use changes the spoken grammar of this phrase.';
  if (/\b(pronoun|reference)\b|代词/.test(evidence)) return 'Pronoun/reference choice needs to match the thing you mean.';
  if (/\b(plural|singular|countability)\b|单复数/.test(evidence)) return 'Singular/plural or countability needs to match the noun meaning.';
  if (/\b(tense)\b|时态/.test(evidence)) return 'Tense needs to match the time meaning of the answer.';
  if (/\b(agreement|subject-verb)\b|一致/.test(evidence)) return 'Subject and verb need to agree in this phrase.';
  if (/\b(preposition)\b|介词/.test(evidence)) return 'Preposition choice changes the natural spoken structure.';
  if (/\b(collocation|word choice)\b|搭配/.test(evidence)) return 'This is a more natural spoken collocation or word choice.';
  if (/\b(missing|verb|component|word form)\b|缺少/.test(evidence)) return 'A needed spoken-language component is missing or has the wrong form.';
  if (/\b(grammar|structure)\b|语法/.test(evidence)) return 'This is a grounded spoken-grammar repair.';
  return undefined;
};

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
      explanationZh: part1IssueExplanation(issueType, explanationZh) || 'Article or determiner use changes the spoken grammar of this phrase.',
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
      explanationZh: part1IssueExplanation(issueType, explanationZh) || 'Preposition choice changes the natural spoken structure.',
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
  if (!/\b(article|determiner)\b|冠词/.test(evidence)) return null;

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
      explanationZh: part1IssueExplanation(issueType, explanationZh) || 'Article or determiner use changes the spoken grammar of this phrase.',
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
  if (isLikelyTranscriptFormatOnlyLayer(original, polishedBetter, issueType, explanationZh)) return null;
  const narrowed = safeNarrowUnsupportedPart1Repair(original, polishedBetter, issueType, explanationZh, answerText);
  if (narrowed === null) return null;
  if (narrowed) return narrowed;
  const mixedNarrowed = safeNarrowMixedPart1Repair(original, polishedBetter, issueType, explanationZh, answerText);
  if (mixedNarrowed === null) return null;
  if (mixedNarrowed) return mixedNarrowed;
  if (containsUnsupportedSpeakingBoundaryClaim(explanationZh)) return null;
  return {
    original,
    better: polishedBetter,
    explanationZh,
  };
};

const containsUnsupportedSpeakingBoundaryClaim = (text: string | undefined) => {
  const normalized = normalizeTranscriptFormatText(text || '');
  if (!normalized) return false;
  const unsupportedArea = /\b(spelling|spell|capitalization|uppercase|lowercase|punctuation|spacing|orthography|transcription|asr|homophone)\b|拼写|大小写|标点|空格|转写|同音/.test(normalized);
  const hasPronunciationMention = /\b(pronunciation|pronounce|pronouncing)\b/.test(normalized);
  const allowedPronunciationNote = /\b(not formally assessed|not assessed|excluding pronunciation)\b/.test(normalized);
  const unsupportedPronunciation = hasPronunciationMention && !allowedPronunciationNote;
  const unsupportedPronunciationZh = /发音/.test(normalized) && !/不正式评估|未评估|不评估/.test(normalized);
  return unsupportedArea || unsupportedPronunciation || unsupportedPronunciationZh;
};

const sanitizePart1FeedbackText = (text: string | undefined, fallback = '') => {
  const clean = optionalSafeString(text);
  if (!clean) return fallback || undefined;
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

const isLowValueReusableSpokenLanguage = (text: string) => {
  const normalized = normalizeTranscriptFormatText(text);
  const compact = normalized.replace(/['.?!,;]/g, '');
  const wordCount = compact.split(/\s+/).filter(Boolean).length;
  if (!normalized) return true;
  if (isBarePart1Starter(normalized)) return true;
  if (/^(yes|yeah|no|sure|maybe|probably|absolutely|definitely)$/i.test(compact)) return true;
  if (/^\[[^\]]+\]$/.test(normalized)) return true;
  if (wordCount > 12) return true;
  const hasTransferableFrame = /\[[^\]]+\]|\b(keen on|switch off|tend to|used to|prefer to|one of the reasons|the main reason|when i want to|im into|i am into|a big fan of|end up|depends on|from time to time|every now and then|as long as|rather than)\b/.test(compact);
  if (/^(i|im|i am|ive|i have|id|i would|my|we|were|we are|weve|we have|our)\b/.test(compact) && !hasTransferableFrame) return true;
  if (/^(it is|this is|there is|there are)\b/.test(compact) && wordCount > 6) return true;
  return false;
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

const mergePart1AnswerAnnotations = (
  providerAnnotations: Part1AnswerAnnotation[],
  fallbackAnnotations: Part1AnswerAnnotation[],
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
        return;
      }
      existing.layers.push(layer);
      representedLayers.set(part1LayerRepairKey(annotation.questionRef, layer), layer);
    });
    existing.combinedRepair = existing.combinedRepair || annotation.combinedRepair;
  };
  providerAnnotations.forEach(addAnnotation);
  fallbackAnnotations.forEach(addAnnotation);
  return merged.filter(item => item.layers.length);
};

const normalizePart1AnswerAnnotations = (
  value: unknown,
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  validationErrors: string[],
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
      const severity = normalizePart1AnnotationSeverity(layerRecord.severity);
      const original = safeLearningText(asString(layerRecord.original ?? sourceQuote, sourceQuote || FALLBACK_TEXT, `threadFeedback.annotations[${index}].layers[${layerIndex}].original`, validationErrors));
      const better = safeLearningText(asString(layerRecord.better ?? layerRecord.correction, FALLBACK_TEXT, `threadFeedback.annotations[${index}].layers[${layerIndex}].better`, validationErrors));
      const explanationZh = safeLearningText(asString(layerRecord.explanationZh, 'Provider feedback was incomplete; this item was normalized safely.', `threadFeedback.annotations[${index}].layers[${layerIndex}].explanationZh`, validationErrors));
      const issueType = safeLearningText(asString(layerRecord.issueType ?? severity, severity, `threadFeedback.annotations[${index}].layers[${layerIndex}].issueType`, validationErrors));
      const repair = normalizePart1RepairLayer(original, better, issueType, explanationZh, answerText);
      if (!repair) return null;
      return {
        severity: calibratePart1AnnotationSeverity(severity, issueType, repair.explanationZh),
        issueType,
        original: repair.original,
        better: repair.better,
        explanationZh: repair.explanationZh,
        reuseGuidanceZh: optionalSafeString(layerRecord.reuseGuidanceZh),
      };
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

const normalizeThreadLevelPatterns = (
  value: unknown,
  validationErrors: string[],
): NonNullable<SpeakingFeedback['threadFeedback']>['threadLevelPatterns'] =>
  asArray(value, 'threadFeedback.threadLevelPatterns', validationErrors)
    .map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`threadFeedback.threadLevelPatterns[${index}] missing or invalid object`);
      return {
        observationZh: sanitizePart1FeedbackText(safeLearningText(asString(record.observationZh ?? record.observation, '', `threadFeedback.threadLevelPatterns[${index}].observationZh`, validationErrors))) || '',
        whyItMattersZh: sanitizePart1FeedbackText(safeLearningText(asString(record.whyItMattersZh ?? record.whyItMatters, '', `threadFeedback.threadLevelPatterns[${index}].whyItMattersZh`, validationErrors))) || '',
        retryRule: sanitizePart1FeedbackText(polishPart1RepairText(asString(record.retryRule ?? record.rule, '', `threadFeedback.threadLevelPatterns[${index}].retryRule`, validationErrors))) || '',
      };
    })
    .filter(item => item.observationZh && item.whyItMattersZh && item.retryRule)
    .slice(0, 4);

const normalizeNextRetryPlan = (
  value: unknown,
  validationErrors: string[],
): SpeakingNextRetryPlan | undefined => {
  if (!isRecord(value)) return undefined;
  const actions = optionalSafeStringArray(value.actions)
    ?.map(action => safeLearningText(action))
    .map(action => sanitizePart1FeedbackText(action) || '')
    .filter(Boolean)
    .slice(0, 4);
  const plan = {
    priorityAccuracyPatternZh: sanitizePart1FeedbackText(optionalSafeString(value.priorityAccuracyPatternZh)),
    answerLengthRuleZh: sanitizePart1FeedbackText(optionalSafeString(value.answerLengthRuleZh)),
    materialToTry: sanitizePart1FeedbackText(optionalSafeString(value.materialToTry)),
    actions,
  };
  if (!plan.priorityAccuracyPatternZh && !plan.answerLengthRuleZh && !plan.materialToTry && !plan.actions?.length) {
    validationErrors.push('threadFeedback.nextRetryPlan missing usable fields');
    return undefined;
  }
  return plan;
};

const annotationsFromThreadItems = (
  answers: NonNullable<SpeakingRequest['threadAnswers']>,
  mustFix: Array<{ questionRefs: string[]; learnerWording: string; betterVersion: string; explanationZh: string; recurring?: boolean }>,
  phraseFixes: Array<{ questionRefs: string[]; original: string; better: string; explanationZh: string }>,
  optionalPolish: Array<{ questionRefs: string[]; original: string; better: string; explanationZh: string }>,
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
  mustFix.forEach(item => item.questionRefs.forEach(questionRef => pushItem(questionRef, item.learnerWording, {
    severity: 'must_fix',
    issueType: item.recurring ? 'recurring must-fix' : 'must-fix',
    original: item.learnerWording,
    better: item.betterVersion,
    explanationZh: item.explanationZh,
  }, item.betterVersion)));
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
  const rawHeadline = asNumber(source.bandEstimateExcludingPronunciation, 'bandEstimateExcludingPronunciation', validationErrors, 5);
  const headline = normalizeHalfBandScore(applyLengthCap(rawHeadline, transcriptWords, Math.max(45, answers.length * 14)));
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
    return {
      questionRefs,
      learnerWording: repair.original,
      betterVersion: repair.better,
      explanationZh: repair.explanationZh,
      recurring: Boolean(record.recurring),
    };
  }).filter((item): item is { questionRefs: string[]; learnerWording: string; betterVersion: string; explanationZh: string; recurring: boolean } => Boolean(item && (
    item.questionRefs.length &&
    item.learnerWording &&
    item.betterVersion &&
    item.explanationZh
  )));
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
  const materialItems = (
    value: unknown,
    path: string,
    kind: 'personal' | 'language',
  ) => asArray(value, path, validationErrors).map((item, index) => {
    const record = isRecord(item) ? item : {};
    if (!isRecord(item)) validationErrors.push(`${path}[${index}] missing or invalid object`);
    return {
      sourceWording: optionalSafeString(record.sourceWording ?? record.originalIdea),
      reusableVersion: polishPart1RepairText(asString(record.reusableVersion ?? record.naturalReusableVersion, FALLBACK_TEXT, `${path}[${index}].reusableVersion`, validationErrors)),
      reuseFor: optionalSafeStringArray(record.reuseFor ?? record.whereItMayBeReused) || [],
      explanationZh: sanitizePart1FeedbackText(optionalSafeString(record.explanationZh)),
    };
  }).filter(item => {
    if (!item.reusableVersion || !item.reuseFor.length || containsUnsupportedSpeakingBoundaryClaim(item.reusableVersion)) return false;
    if (kind === 'personal') {
      return !isLowValuePart1Material(item.reusableVersion) &&
        isGroundedInPart1Answers(item.sourceWording || item.reusableVersion, answers);
    }
    return !isLowValueReusableSpokenLanguage(item.reusableVersion);
  });
  const highImpactPhraseFixes = normalizeThreadPhraseItems(threadSource.highImpactPhraseFixes, answers, validationErrors, 'threadFeedback.highImpactPhraseFixes');
  const optionalPolish = normalizeThreadPhraseItems(threadSource.optionalPolish, answers, validationErrors, 'threadFeedback.optionalPolish');
  const providerAnnotations = normalizePart1AnswerAnnotations(threadSource.annotations ?? [], answers, validationErrors);
  const fallbackAnnotations = annotationsFromThreadItems(answers, mustFix, highImpactPhraseFixes, optionalPolish);
  const annotations = mergePart1AnswerAnnotations(providerAnnotations, fallbackAnnotations);
  normalizedFields.push(`part1ProviderAnnotations:${providerAnnotations.length}`);
  normalizedFields.push(`part1FallbackAnnotationCandidates:${fallbackAnnotations.length}`);
  normalizedFields.push(`part1RenderedAnnotations:${annotations.length}`);
  normalizedFields.push(`part1RenderedAnnotationLayers:${annotations.reduce((total, annotation) => total + annotation.layers.length, 0)}`);
  const cleanRetryAnswers = normalizePart1CleanRetryAnswers(threadSource.cleanRetryAnswers ?? [], answers, validationErrors);
  const threadLevelPatterns = normalizeThreadLevelPatterns(threadSource.threadLevelPatterns ?? [], validationErrors);
  const nextRetryPlan = normalizeNextRetryPlan(threadSource.nextRetryPlan, validationErrors);
  const myUsableMaterial = materialItems(materialSource.myUsableMaterial, 'threadFeedback.materialBank.myUsableMaterial', 'personal');
  const personalMaterialKeys = new Set(myUsableMaterial.flatMap(item => [
    part1AnnotationKeyText(item.sourceWording || ''),
    part1AnnotationKeyText(item.reusableVersion),
  ]).filter(Boolean));
  const reusableSpokenLanguage = materialItems(materialSource.reusableSpokenLanguage, 'threadFeedback.materialBank.reusableSpokenLanguage', 'language')
    .filter(item => {
      const sourceKey = part1AnnotationKeyText(item.sourceWording || '');
      const reusableKey = part1AnnotationKeyText(item.reusableVersion);
      return !personalMaterialKeys.has(sourceKey) && !personalMaterialKeys.has(reusableKey);
    });
  const rationaleFallback = 'Transcript-based estimate: grammar, vocabulary, answer focus and Part 1 control were considered; pronunciation is not formally assessed.';
  const bandEstimateRange = normalizeSpeakingBandEstimateRange(source.bandEstimateRange, headline, false, normalizedFields);
  const safeBandEstimateRange = bandEstimateRange && containsUnsupportedSpeakingBoundaryClaim(bandEstimateRange.rationaleZh)
    ? { ...bandEstimateRange, rationaleZh: rationaleFallback }
    : bandEstimateRange;
  const nextRetryFocusZh = sanitizePart1FeedbackText(
    safeLearningText(asString(threadSource.nextRetryFocusZh ?? source.nextStepZh, 'Next time, answer directly, add one real detail, then stop.', 'threadFeedback.nextRetryFocusZh', validationErrors)),
    'Next time, answer directly, add one real detail, then stop.',
  );

  const feedbackWithoutMarkdown: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'speaking',
    part: 1,
    sessionKind: 'part1_topic_thread',
    topic: request.topic || optionalSafeString(source.topic),
    threadId: request.threadId,
    threadAnswers: answers,
    threadFeedback: {
      topic: request.topic || optionalSafeString(threadSource.topic) || 'Part 1 Topic',
      threadId: request.threadId || optionalSafeString(threadSource.threadId) || 'part1_thread',
      questionCount: answers.length,
      mustFix,
      annotations,
      cleanRetryAnswers,
      threadLevelPatterns,
      answerByAnswerCoaching,
      highImpactPhraseFixes,
      materialBank: {
        myUsableMaterial,
        reusableSpokenLanguage,
      },
      optionalPolish,
      nextRetryPlan,
      nextRetryFocusZh: nextRetryFocusZh || 'Next time, answer directly, add one real detail, then stop.',
    },
    question: answers.map((answer, index) => `Q${index + 1}. ${answer.question}`).join('\n'),
    transcript: combinedTranscript,
    bandEstimateExcludingPronunciation: headline,
    bandEstimateRange: safeBandEstimateRange,
    estimateRationaleZh: sanitizePart1FeedbackText(optionalSafeString(source.estimateRationaleZh), rationaleFallback),
    targetAnswerStatus: 'not_applicable',
    scores: {
      ...visibleScores,
      pronunciation: null,
      pronunciationNote: 'Pronunciation is not formally assessed in Part 1 topic-thread transcript practice.',
    },
    fatalErrors: mustFix.map(item => ({
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
    preservedStyle: myUsableMaterial.map(item => ({
      text: item.sourceWording || item.reusableVersion,
      reasonZh: item.explanationZh || '这是来自你自己答案的可复用素材。',
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
  const cappedHeadline = normalizeHalfBandScore(applySpeakingLengthCap(
    asNumber(
      source.bandEstimateExcludingPronunciation,
      'bandEstimateExcludingPronunciation',
      validationErrors,
    ),
    transcriptWords,
    part,
  ));
  const promptAwareHeadline = promptMismatchWarning ? Math.min(cappedHeadline, 5.5) : cappedHeadline;
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
  const sourceFatalErrors = Array.isArray(source.fatalErrors) ? source.fatalErrors : [];
  const hasQualityCap = Boolean(lengthMustFix || limitTransformation || hasLowSignalSpeakingText(request.transcript || ''));
  const hasProviderFatalIssue = sourceFatalErrors.length > 0 || Boolean(promptMismatchWarning);
  const minimumVisibleScore = Math.min(
    visibleScores.fluencyCoherence,
    visibleScores.lexicalResource,
    visibleScores.grammaticalRangeAccuracy,
  );
  const shouldNormalizeSpeakingScore =
    promptAwareHeadline > 0 &&
    minimumVisibleScore > 0 &&
    promptAwareHeadline < minimumVisibleScore &&
    !hasQualityCap &&
    !hasProviderFatalIssue;
  const normalizedHeadline = shouldNormalizeSpeakingScore ? minimumVisibleScore : promptAwareHeadline;
  if (shouldNormalizeSpeakingScore) {
    normalizedFields.push('speakingScoreConsistency');
  }
  const bandEstimateRange = normalizeSpeakingBandEstimateRange(
    source.bandEstimateRange,
    normalizedHeadline,
    hasQualityCap || Boolean(promptMismatchWarning),
    normalizedFields,
  );
  const expectedSpeakingTargetLayer = speakingTargetLayerForEstimate(normalizedHeadline);
  const providerSpeakingTargetLayer = normalizeTargetAnswerLayer(source.targetAnswerLayer);
  const speakingTargetAnswerLayer = expectedSpeakingTargetLayer;
  if (providerSpeakingTargetLayer && providerSpeakingTargetLayer !== expectedSpeakingTargetLayer) {
    normalizedFields.push('targetLayerConsistency');
  }
  const speakingTargetFloor = targetFloorForLayer(speakingTargetAnswerLayer);
  const speakingTargetLayer = getTargetLabel(normalizedHeadline, 'answer');
  const targetAnswerSelfScores = normalizeSpeakingTargetSelfScores(source.targetAnswerSelfScores);
  const providerTargetAnswerStatus = normalizeTargetAnswerStatus(source.targetAnswerStatus);
  const currentAnswerIsHighBand = normalizedHeadline >= 8 && !hasQualityCap && !hasProviderFatalIssue;
  const rawUpgradedAnswer = currentAnswerIsHighBand
    ? ''
    : limitTransformation
      ? buildInsufficientSpeakingTransformation(part)
      : asString(
          source.upgradedAnswer,
          'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
          'upgradedAnswer',
          validationErrors,
        );
  const hasTargetAnswer = Boolean(rawUpgradedAnswer.trim()) && !isProviderIncompleteSpeakingAnswer(rawUpgradedAnswer);
  const targetAnswerStatus: TargetAnswerStatus = (() => {
    if (currentAnswerIsHighBand) return 'meets_target';
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
  const scoreConsistencyNoteZh = shouldNormalizeSpeakingScore
    ? `分数已按可见语言维度校准：发音未评估，且没有样本/跑题/严重质量上限时，总分不应低于三个可见维度的最低分 ${formatConservativeBandEstimate(minimumVisibleScore)}。`
    : providerScoreConsistencyNote;

  const defaultTargetValidationZh = currentAnswerIsHighBand
    ? '目标层级已达到。下一步重点是自然输出、时间控制和迁移练习。'
    : targetAnswerStatus === 'meets_target'
      ? `目标答案自检已达到 ${speakingTargetLayer} 的可见文本标准。`
      : targetAnswerStatus === 'not_generated'
        ? '当前样本不足，暂时不能生成可靠的目标答案。'
        : '这版目标答案还没有稳定达到目标层级，需要继续强化。';

  const feedbackWithoutMarkdown: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'speaking',
    part,
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    transcript: asString(source.transcript, request.transcript || FALLBACK_TEXT, 'transcript', validationErrors),
    bandEstimateExcludingPronunciation: normalizedHeadline,
    bandEstimateRange,
    estimateRationaleZh: optionalSafeString(source.estimateRationaleZh),
    targetBandFloor: speakingTargetFloor,
    targetLayer: currentAnswerIsHighBand
      ? '高分稳定检查'
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
        ? '继续加强答案的内容推进、具体例子、自然口语组织和语法稳定度；不要只替换高级词。'
        : undefined),
    highBandStabilityZh: optionalSafeString(source.highBandStabilityZh) ||
      (currentAnswerIsHighBand
        ? '本次已经进入高分稳定层，重点是保持自然、清晰、限时输出和跨题迁移。'
        : undefined),
    nextStepZh: optionalSafeString(source.nextStepZh) ||
      (currentAnswerIsHighBand
        ? '用同一素材换一道相近题再说一遍，检查是否还能自然稳定输出。'
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
    naturalnessHints: asArray(source.naturalnessHints, 'naturalnessHints', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`naturalnessHints[${index}] missing or invalid object`);
      return {
        original: asString(record.original, FALLBACK_TEXT, `naturalnessHints[${index}].original`, validationErrors),
        better: asString(record.better, FALLBACK_TEXT, `naturalnessHints[${index}].better`, validationErrors),
        tag: asString(record.tag, 'provider_safety', `naturalnessHints[${index}].tag`, validationErrors),
        explanationZh: asString(
          record.explanationZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `naturalnessHints[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
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
    upgradedAnswer: calibrateSpeakingUpgradedAnswer(rawUpgradedAnswer, part, request.transcript || '', limitTransformation),
    reusableExample: isRecord(source.reusableExample)
      ? {
          example: asString(source.reusableExample.example, FALLBACK_TEXT, 'reusableExample.example', validationErrors),
          canBeReusedFor: normalizeStringArray(
            source.reusableExample.canBeReusedFor,
            'reusableExample.canBeReusedFor',
            validationErrors,
          ),
          explanationZh: asString(
            source.reusableExample.explanationZh,
            'Provider feedback was incomplete; this item was normalized safely.',
            'reusableExample.explanationZh',
            validationErrors,
          ),
        }
      : null,
  };

  const resolvedSpeakingTargetState = resolveSpeakingTargetState(feedbackWithoutMarkdown);
  normalizedFields.push(`targetState:${resolvedSpeakingTargetState}`);
  const feedbackWithTargetState: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    ...feedbackWithoutMarkdown,
    targetState: resolvedSpeakingTargetState,
    targetLayer: resolvedSpeakingTargetState === 'high_band_stable'
      ? feedbackWithoutMarkdown.targetLayer
      : normalizedHeadline >= 7
        ? 'Band 7+ Target Answer'
        : 'Band 7 Target Answer',
    targetValidationZh: resolvedSpeakingTargetState === 'high_band_stable'
      ? feedbackWithoutMarkdown.targetValidationZh
      : '',
    highBandStabilityZh: resolvedSpeakingTargetState === 'high_band_stable'
      ? feedbackWithoutMarkdown.highBandStabilityZh || HIGH_BAND_STABLE_ZH
      : feedbackWithoutMarkdown.highBandStabilityZh,
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
    .filter(item => item.original && item.correction && item.explanationZh);
  const sanitizedNaturalnessHints = feedbackWithTargetState.naturalnessHints
    .map(item => ({
      ...item,
      original: safeLearningText(item.original),
      better: safeLearningText(item.better),
      tag: safeLearningText(item.tag, 'naturalness'),
      explanationZh: safeLearningText(item.explanationZh),
    }))
    .filter(item => item.original && item.better && item.explanationZh);
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
        : '这个短语比原表达更准确，适合在同类作文中整块复用。';
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
  `先重写${logicLocationZh(location)}的段落功能：用一句清楚的中心句回答题目，再补一个原因和一个具体例子，最后检查该段是否回扣你的总立场。`;

const defaultLogicTransfer = (): string =>
  '下次先判断这一部分的作用：提出立场、承认反方，还是证明主观点。';

const defaultSentenceTransfer = (dimension: WritingFeedback['sentenceFeedback'][number]['dimension'], tag: string): string => {
  const normalized = tag.toLowerCase();
  if (/spelling|capital/.test(normalized)) return '下次交卷前最后 30 秒专门扫一遍大小写和拼写，尤其是句首、专有名词和高频抽象词。';
  if (/article|singular|plural|noun/.test(normalized)) return '下次写名词短语时，先问自己：可数吗？单数还是复数？前面需不需要 a / the / zero article。';
  if (/punctuation|sentence_boundary/.test(normalized)) return '下次遇到两个完整分句时，不要只用逗号硬连；改用句号、分号，或 because / although / which 等连接。';
  if (/preposition|collocation|word_choice|lexical/.test(normalized) || dimension === 'LR') return '下次不要只背单词，要按“动词 + 名词 / 形容词 + 名词”的搭配整块复用。';
  if (dimension === 'TR') return '下次每写一句都回看题目关键词，确认这句话是在推进立场、回应任务，而不是只提供背景。';
  if (dimension === 'CC') return '下次段落内按“主题句 -> 原因 -> 例子 -> 回扣立场”检查，避免句子之间只是并列堆放。';
  return '下次写完这一类句子后，把主谓、时态、单复数和搭配一起检查，不要只看大意是否通顺。';
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
  'Whole Essay': '整篇文章',
  Introduction: '开头段',
  'Body Paragraph 1': '主体段一',
  'Body Paragraph 2': '主体段二',
  Conclusion: '结尾段',
  'Unknown / General': '相关部分',
};

const logicLocationZh = (location?: string): string =>
  location && location in logicLocationLabels ? logicLocationLabels[location as LogicLocation] : '相关部分';

const normalizeLearnerChineseText = (text?: string): string =>
  (text || '')
    .replace(/\bWhole Essay\b/g, '整篇文章')
    .replace(/\bIntroduction\b/g, '开头段')
    .replace(/\bBody Paragraph 1\b/g, '主体段一')
    .replace(/\bBody Paragraph 2\b/g, '主体段二')
    .replace(/\bConclusion\b/g, '结尾段')
    .replace(/\bUnknown \/ General\b/g, '相关部分')
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
      meaningZh: '本题语境中的可复用话题词。',
      usageZh: '用于讨论题目中的具体对象或影响，不要当成万能作文套话。',
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
    meaningZh: asString(record.meaningZh ?? record.meaning, '本题语境中的可复用话题词。', `vocabularyUpgrade.topicVocabulary[${index}].meaningZh`, validationErrors),
    usageZh: asString(record.usageZh ?? record.explanationZh ?? record.usage, '用于讨论题目中的具体对象或影响，不要当成万能作文套话。', `vocabularyUpgrade.topicVocabulary[${index}].usageZh`, validationErrors),
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
    ? '重写最关键的一个主体段：先完成段落任务，再自然使用 2-3 个上方表达。'
    : '优先修正上方 Logic Review 指出的主要问题，再检查句子是否清晰。';
  const firstFix = normalizeLearnerChineseText(feedback.frameworkFeedback[0]?.paragraphFixZh);
  return sameGuidanceText(mission, firstFix) ? [] : [mission];
};

const getLanguageBankHighlightTerms = (vocabulary: WritingFeedback['vocabularyUpgrade']): string[] => {
  const terms = [
    ...vocabulary.topicVocabulary.map(item => item.expression),
    ...vocabulary.expressionUpgrades.map(item => item.better),
  ]
    .map(item => item.trim())
    .filter(item => item.length >= 6 && !/\.{3}|…/.test(item));
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
  item.explanationZh ? `  - 为什么这样改: ${item.explanationZh}` : '',
  item.reuseWhenZh ? `  - 什么时候复用: ${item.reuseWhenZh}` : '',
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
    suggestionZh: '这个维度低于 7.0 时，反馈必须说明具体任务回应卡点：可能是题目某一部分没有处理、立场不够稳定、论证停留在判断句，或例子没有支撑结论。',
    paragraphFixZh: '先回到题目关键词，补清楚立场、每个主体段的任务角色，以及至少一个能支撑判断的具体例子；如果原来的论点方向限制分数，应换成更能回应题目的方向。',
    transferGuidanceZh: '下次写前先问自己：我有没有回应题目所有部分？每段是在证明一个明确判断，还是只在列观点？',
    issueType: 'task_response',
    dimension: 'TR' as const,
  },
  coherenceCohesion: {
    field: 'coherenceCohesion',
    issue: 'Coherence blocker: paragraph progression is not yet Band 7',
    suggestionZh: '这个维度低于 7.0 时，需要指出段落功能或推进问题：例如段落只堆叠想法、转折关系不清，或例子没有把主题句往前推进。',
    paragraphFixZh: '把每个主体段改成“主题句 -> 原因/机制 -> 例子 -> 回扣立场”的链条；删掉和段落任务无关的旁支。',
    transferGuidanceZh: '下次每写完一段，检查读者能否看出这一段和总立场的关系。',
    issueType: 'coherence',
    dimension: 'CC' as const,
  },
  lexicalResource: {
    field: 'lexicalResource',
    issue: 'Lexical Resource blocker',
    suggestionZh: '词汇低于 7.0 时，反馈需要说明真实卡点：可能是搭配不自然、话题词不够精确、重复基础词，或为了显得正式而使用不自然表达。',
    paragraphFixZh: '优先替换会影响意思精度的短语，而不是堆高级词；每个主体段至少使用 2-3 个和题目直接相关的自然搭配。',
    transferGuidanceZh: '下次检查 want / good / bad / thing / people 这类泛词，并换成更贴合话题的表达。',
    issueType: 'lexical_precision',
    dimension: 'LR' as const,
  },
  grammaticalRangeAccuracy: {
    field: 'grammaticalRangeAccuracy',
    issue: 'Grammar blocker',
    suggestionZh: '语法低于 7.0 时，反馈需要说明句子控制问题：可能是从句逻辑、标点连接、主谓一致、冠词/复数，或复杂句一长就失控。',
    paragraphFixZh: '先保证每个句子边界清楚，再使用原因、让步和结果从句；不要为了复杂而写失控长句。',
    transferGuidanceZh: '下次修改时单独扫一遍句子边界、连接词、冠词、复数和从句主语。',
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
        : '示范修改';
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
      ? vocabulary.topicVocabulary.map(item => `- ${item.expression}\n  - 含义: ${item.meaningZh}\n  - 用于: ${item.usageZh.replace(/^用于[:：]?/, '')}${item.example ? `\n  - Example: ${item.example}` : ''}`)
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
- 这篇怎么改: ${normalizeLearnerChineseText(item.paragraphFixZh) || defaultParagraphFix(item.issue, item.location)}
- 下次自查: ${normalizeLearnerChineseText(item.transferGuidanceZh) || defaultLogicTransfer()}
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
- 为什么要改: ${item.explanationZh}
- 下次自查: ${item.transferGuidanceZh || defaultSentenceTransfer(item.dimension, item.tag)}
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
${missionItems.length ? missionItems.map(item => `- ${item}`).join('\n') : '- 下次修改时至少主动使用两个 Language Bank 表达。'}

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
        '这处表达需要修改，因为它会影响句子的准确度或论证清晰度。',
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
        '这个问题会影响 Task Response 或 Coherence，因为考官看不到清楚的任务回应和段落推进。',
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
    ? '高分稳定检查'
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
    ? '目标层级已达到。下一步重点是限时稳定、复盘表达和迁移到新题。'
    : targetAnswerStatus === 'meets_target'
      ? `目标范文自检已达到 ${targetLevel} 的四项标准。`
      : targetAnswerStatus === 'not_generated'
        ? '当前样本不足或模型答案缺失，暂时不能证明目标范文层级。'
        : '这版目标答案还没有稳定达到目标层级，需要进一步强化逻辑或表达。';

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
        ? '继续加强任务回应深度、段落推进、例子具体性和自然准确表达；不要只把措辞改得更正式。'
        : undefined),
    highBandStabilityZh: optionalSafeString(source.highBandStabilityZh) ||
      (currentEssayIsHighBand
        ? '本篇已经进入高分稳定层，重点是保持清晰立场、段落功能、限时完成和新题迁移。'
        : undefined),
    nextStepZh: optionalSafeString(source.nextStepZh) ||
      (currentEssayIsHighBand
        ? '保存这版结构，限时重写一次或换一道同类型题迁移。'
        : undefined),
    scoreConsistencyNoteZh: consistencyBlockers.normalized
      ? '已补充低于 7.0 维度对应的真实卡点说明，避免分数和反馈内容不一致。'
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
          '这个论点可以迁移到相近题目，但需要配合具体例子使用。',
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
      '总览反馈缺失：请检查是否有清楚的 overview，用一句话概括全图主要趋势、最高/最低项或流程结果。',
      'overviewFeedback',
      validationErrors,
    ),
    keyFeaturesFeedback: asString(
      source.keyFeaturesFeedback,
      '关键信息反馈缺失：请优先选择最大变化、最高/最低值、主要阶段或最明显差异，避免逐项罗列。',
      'keyFeaturesFeedback',
      validationErrors,
    ),
    comparisonFeedback: asString(
      source.comparisonFeedback,
      '比较关系反馈缺失：请加入 higher than, whereas, in contrast 等比较表达，并说明关键差异。',
      'comparisonFeedback',
      validationErrors,
    ),
    dataAccuracyFeedback: asString(
      source.dataAccuracyFeedback,
      '数据准确性反馈缺失：请核对数字、单位、排名和时间点是否与题目一致。',
      'dataAccuracyFeedback',
      validationErrors,
    ),
    coherenceFeedback: asString(
      source.coherenceFeedback,
      '结构连贯反馈缺失：建议按 introduction、overview、主体段 1、主体段 2 组织，并按趋势、类别或阶段分组。',
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
      'Not decided yet / 需要继续补充',
      'position',
      validationErrors,
    ),
    viewA: asString(
      source.viewA,
      'Not decided yet / 需要继续补充',
      'viewA',
      validationErrors,
    ),
    viewB: asString(
      source.viewB,
      'Not decided yet / 需要继续补充',
      'viewB',
      validationErrors,
    ),
    myOpinion: asString(
      source.myOpinion,
      'Not decided yet / 需要继续补充',
      'myOpinion',
      validationErrors,
    ),
    paragraphPlan: asString(
      source.paragraphPlan,
      'Not decided yet / 需要继续补充',
      'paragraphPlan',
      validationErrors,
    ),
    possibleExample: asString(
      source.possibleExample,
      'Suggested example, please confirm: Not decided yet / 需要继续补充',
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
        : '这版目标答案还没有稳定达到目标层级，需要继续强化。'),
  };
};

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
        : '这版目标答案还没有稳定达到目标层级，需要继续强化。'),
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
