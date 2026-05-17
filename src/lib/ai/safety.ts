import {
  AIProvider,
  SpeakingAnalysisRequest,
  WritingAnalysisRequest,
  WritingFrameworkCoachRequest,
  WritingTask1AnalysisRequest,
  WritingFrameworkRequest,
} from './providers/base';
import {
  ProviderDiagnostic,
  FatalError,
  SpeakingFeedback,
  SpeakingPart,
  WritingFeedback,
  WritingFrameworkCoachFeedback,
  WritingFrameworkReadiness,
  WritingFrameworkSummary,
  WritingTask1Feedback,
  WritingTask,
} from './schemas';
import { capBand, floorToHalfBand, formatConservativeBandEstimate, getTargetLabel, roundToHalfBand } from '../bands';
import {
  buildSpeakingTrainingMarkdown,
  buildWritingTask1TrainingMarkdown,
  buildWritingTask2TrainingMarkdown,
} from '../markdownExport';

type SpeakingRequest = SpeakingAnalysisRequest;
type WritingRequest = WritingAnalysisRequest;
type WritingTask1Request = WritingTask1AnalysisRequest;
type FrameworkCoachRequest = WritingFrameworkCoachRequest;
type FrameworkRequest = WritingFrameworkRequest;

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
  const cleaned = value.replace(/\s+/g, ' ').trim();
  return cleaned && !BLOCKED_LEARNING_CONTENT.test(cleaned) ? cleaned : fallback;
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

const getFailureKind = (parseError: string | undefined, validationErrors: string[]) => {
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
      /key|secret|token|authorization/i.test(key) ? '[REDACTED]' : redactSecrets(item),
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

const normalizeSpeakingFeedback = (
  value: unknown,
  request: SpeakingRequest,
  validationErrors: string[],
  normalizedFields: string[],
): SpeakingFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const part = asSpeakingPart(source.part, request.part, validationErrors);
  const transcriptWords = countWords(request.transcript || '');
  const lengthMustFix = buildSpeakingLengthMustFix(transcriptWords, part);
  const limitTransformation = shouldLimitSpeakingTransformation(request.transcript || '', transcriptWords, part);

  const rawUpgradedAnswer = limitTransformation
    ? buildInsufficientSpeakingTransformation(part)
    : asString(
        source.upgradedAnswer,
        'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
        'upgradedAnswer',
        validationErrors,
      );

  const feedbackWithoutMarkdown: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'speaking',
    part,
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    transcript: asString(source.transcript, request.transcript || FALLBACK_TEXT, 'transcript', validationErrors),
    bandEstimateExcludingPronunciation: applySpeakingLengthCap(
      asNumber(
        source.bandEstimateExcludingPronunciation,
        'bandEstimateExcludingPronunciation',
        validationErrors,
      ),
      transcriptWords,
      part,
    ),
    scores: {
      fluencyCoherence: applySpeakingLengthCap(
        asNumber(scores.fluencyCoherence, 'scores.fluencyCoherence', validationErrors),
        transcriptWords,
        part,
      ),
      lexicalResource: applySpeakingLengthCap(
        asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors),
        transcriptWords,
        part,
      ),
      grammaticalRangeAccuracy: applySpeakingLengthCap(
        asNumber(
          scores.grammaticalRangeAccuracy,
          'scores.grammaticalRangeAccuracy',
          validationErrors,
        ),
        transcriptWords,
        part,
      ),
      pronunciation: null,
      pronunciationNote: asString(
        scores.pronunciationNote,
        'Pronunciation is not formally assessed in V1.',
        'scores.pronunciationNote',
        validationErrors,
      ),
    },
    fatalErrors: [
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

  const sanitizedFeedback: Omit<SpeakingFeedback, 'obsidianMarkdown'> = {
    ...feedbackWithoutMarkdown,
    fatalErrors: feedbackWithoutMarkdown.fatalErrors
      .map(item => ({
        ...item,
        original: safeLearningText(item.original),
        correction: safeLearningText(item.correction),
        tag: safeLearningText(item.tag, 'speaking_issue'),
        explanationZh: safeLearningText(item.explanationZh),
      }))
      .filter(item => item.original && item.correction && item.explanationZh),
    naturalnessHints: feedbackWithoutMarkdown.naturalnessHints
      .map(item => ({
        ...item,
        original: safeLearningText(item.original),
        better: safeLearningText(item.better),
        tag: safeLearningText(item.tag, 'naturalness'),
        explanationZh: safeLearningText(item.explanationZh),
      }))
      .filter(item => item.original && item.better && item.explanationZh),
    band9Refinements: feedbackWithoutMarkdown.band9Refinements
      .map(item => ({
        observation: safeLearningText(item.observation),
        refinement: safeLearningText(item.refinement),
        explanationZh: safeLearningText(item.explanationZh),
      }))
      .filter(item => item.observation && item.refinement && item.explanationZh),
    preservedStyle: feedbackWithoutMarkdown.preservedStyle
      .map(item => ({
        text: safeLearningText(item.text),
        reasonZh: safeLearningText(item.reasonZh),
      }))
      .filter(item => item.text && item.reasonZh),
    upgradedAnswer: safeLearningText(feedbackWithoutMarkdown.upgradedAnswer),
    reusableExample: feedbackWithoutMarkdown.reusableExample
      ? {
          example: safeLearningText(feedbackWithoutMarkdown.reusableExample.example),
          canBeReusedFor: feedbackWithoutMarkdown.reusableExample.canBeReusedFor
            .map(item => safeLearningText(item))
            .filter(Boolean),
          explanationZh: safeLearningText(feedbackWithoutMarkdown.reusableExample.explanationZh),
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
): WritingFeedback => {
  const source = isRecord(value) ? value : {};
  if (!isRecord(value)) validationErrors.push('response root missing or invalid object');

  const scores = isRecord(source.scores) ? source.scores : {};
  if (!isRecord(source.scores)) validationErrors.push('scores missing or invalid object');
  const essayWords = countWords(request.essay || '');
  const task = asWritingTask(source.task, request.task, validationErrors);
  const lengthWarning = buildWritingLengthWarning(essayWords, task);
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

  const scoresNormalized = {
    taskResponse: applyLengthCap(asNumber(scores.taskResponse, 'scores.taskResponse', validationErrors), essayWords, 250),
    coherenceCohesion: applyLengthCap(asNumber(scores.coherenceCohesion, 'scores.coherenceCohesion', validationErrors), essayWords, 250),
    lexicalResource: applyLengthCap(asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors), essayWords, 250),
    grammaticalRangeAccuracy: applyLengthCap(
      asNumber(scores.grammaticalRangeAccuracy, 'scores.grammaticalRangeAccuracy', validationErrors),
      essayWords,
      250,
    ),
  };
  const targetLevel = getWritingTargetLevel(averageWritingScore(scoresNormalized));
  const vocabularyUpgrade = buildLocalVocabularyUpgrade(source, request, sentenceFeedback, validationErrors);
  const firstTopicExpression = vocabularyUpgrade.topicVocabulary[0]?.expression || 'topic-specific language';
  const firstExpressionUpgrade = vocabularyUpgrade.expressionUpgrades[0]?.better || 'a clearer argument frame';
  const normalizedModelAnswer = asString(
    source.modelAnswer,
    `A stronger revision should keep your main position, use topic language such as "${firstTopicExpression}", and apply "${firstExpressionUpgrade}" where it helps the argument sound clearer.`,
    'modelAnswer',
    validationErrors,
  );

  const feedbackWithoutMarkdown: Omit<WritingFeedback, 'obsidianMarkdown'> = {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'writing',
    task,
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    essay: asString(source.essay, request.essay || FALLBACK_TEXT, 'essay', validationErrors),
    scores: scoresNormalized,
    frameworkFeedback,
    essayLevelWarnings: [
      ...sourceWarnings,
      ...(lengthWarning ? [lengthWarning] : []),
    ],
    sentenceFeedback,
    vocabularyUpgrade,
    modelAnswer: normalizedModelAnswer,
    modelAnswerAnnotations: normalizeModelAnswerAnnotations(source.modelAnswerAnnotations, normalizedModelAnswer),
    modelAnswerPersonalized: source.modelAnswerPersonalized === true,
    modelAnswerTargetLevel: targetLevel,
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

  return {
    ...feedbackWithoutMarkdown,
    obsidianMarkdown: buildWritingTask2TrainingMarkdown(feedbackWithoutMarkdown),
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

  return {
    ...feedbackWithoutMarkdown,
    obsidianMarkdown: (() => {
      if (typeof source.obsidianMarkdown === 'string' && source.obsidianMarkdown.trim()) {
        normalizedFields.push('obsidianMarkdown');
      }
      return buildWritingTask1TrainingMarkdown(feedbackWithoutMarkdown);
    })(),
  };
};

const buildEditableFrameworkSummary = (summary: Omit<WritingFrameworkSummary, 'editableSummary'>): string =>
  `Position:\n${summary.position}\n\nView A:\n${summary.viewA}\n\nView B:\n${summary.viewB}\n\nMy opinion:\n${summary.myOpinion}\n\nParagraph plan:\n${summary.paragraphPlan}\n\nPossible example:\n${summary.possibleExample}`;

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
    editableSummary: asString(
      source.editableSummary,
      buildEditableFrameworkSummary(normalizedWithoutEditable),
      'editableSummary',
      validationErrors,
    ),
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

export const safeAnalyzeWriting = async (
  provider: AIProvider,
  providerName: string,
  requestPayload: WritingRequest,
): Promise<SafeAnalyzeResult<WritingFeedback>> => {
  let rawResponse: unknown = null;
  let parsedJson: unknown = null;
  let parseError: string | undefined;
  const validationErrors: string[] = [];

  try {
    rawResponse = await provider.analyzeWriting(requestPayload);
    const parsed = parseRawResponse(rawResponse);
    parsedJson = parsed.parsedJson;
    parseError = parsed.parseError;
  } catch (error) {
    parseError = error instanceof Error ? error.message : String(error);
  }

  const feedback = normalizeWritingFeedback(parsedJson, requestPayload, validationErrors);
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
