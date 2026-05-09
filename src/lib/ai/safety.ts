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
import { capBand, floorToHalfBand, formatBandEstimate, roundToHalfBand } from '../bands';

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

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

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

const applySpeakingLengthCap = (score: number, words: number, part: SpeakingPart): number => {
  if (!Number.isFinite(score) || score <= 0) return score;
  if (words <= 6) return floorToHalfBand(capBand(score, 3.0));
  if (part === 1 && words < speakingMinimumWords(part)) return floorToHalfBand(capBand(score, 5.0));
  if (part === 2 && words < 45) return floorToHalfBand(capBand(score, 4.0));
  if (part === 2 && words < speakingMinimumWords(part)) return floorToHalfBand(capBand(score, 5.0));
  if (part === 3 && words < 25) return floorToHalfBand(capBand(score, 4.0));
  if (part === 3 && words < speakingMinimumWords(part)) return floorToHalfBand(capBand(score, 5.0));
  return roundToHalfBand(score);
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

const buildWritingLengthFeedback = (
  words: number,
  task: WritingTask,
): WritingFeedback['frameworkFeedback'][number] | null => {
  const minimum = task === 'task1' ? 150 : 250;
  const label = task === 'task1' ? 'Writing Task 1' : 'Writing Task 2';
  if (words >= minimum) return null;
  return {
    issue: words <= 20 ? 'Extremely insufficient sample' : 'Under-length response',
    suggestionZh: insufficientSampleMessageZh(label, minimum),
    severity: 'fatal' as const,
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
  if (typeof value === 'string' && value.trim()) return value;
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
    .map((item, index) => asString(item, FALLBACK_TEXT, `${path}[${index}]`, errors));

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

const buildSpeakingObsidianMarkdown = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>): string => {
  const mustFix = feedback.fatalErrors.length
    ? feedback.fatalErrors
        .map(item => `- ${item.original} -> ${item.correction}\n  - ${item.explanationZh}`)
        .join('\n')
    : '- No critical correction needed.';

  const polish = feedback.naturalnessHints.length
    ? feedback.naturalnessHints
        .map(item => `- ${item.original} -> ${item.better}\n  - ${item.explanationZh}`)
        .join('\n')
    : '- No optional polish item returned.';

  const refinements = feedback.band9Refinements.length
    ? feedback.band9Refinements
        .map(item => `- ${item.observation}\n  - Refinement: ${item.refinement}\n  - ${item.explanationZh}`)
        .join('\n')
    : '- No Band 9 refinement returned.';

  const reusable = feedback.reusableExample
    ? `\n## Reusable Example\n${feedback.reusableExample.example}\n\nCan be reused for: ${feedback.reusableExample.canBeReusedFor.join(', ')}\n\n${feedback.reusableExample.explanationZh}\n`
    : '';

  return `# IELTS Speaking Note

## Prompt
${feedback.question}

## Transcript
${feedback.transcript}

## Score Snapshot
- Training estimate excluding pronunciation: ${formatBandEstimate(feedback.bandEstimateExcludingPronunciation)}
- Fluency and Coherence: ${formatBandEstimate(feedback.scores.fluencyCoherence)}
- Lexical Resource: ${formatBandEstimate(feedback.scores.lexicalResource)}
- Grammatical Range and Accuracy: ${formatBandEstimate(feedback.scores.grammaticalRangeAccuracy)}
- Pronunciation: not assessed in V1

## Must Fix
${mustFix}

## Optional Polish
${polish}

## Band 9 Refinement
${refinements}

## High-Band Transformation
${feedback.upgradedAnswer}
${reusable}`;
};

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
    upgradedAnswer: limitTransformation
      ? buildInsufficientSpeakingTransformation(part)
      : asString(
          source.upgradedAnswer,
          'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
          'upgradedAnswer',
          validationErrors,
        ),
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

  return {
    ...feedbackWithoutMarkdown,
    obsidianMarkdown: typeof source.obsidianMarkdown === 'string' && source.obsidianMarkdown.trim()
      ? source.obsidianMarkdown
      : (() => {
          normalizedFields.push('obsidianMarkdown');
          return buildSpeakingObsidianMarkdown(feedbackWithoutMarkdown);
        })(),
  };
};

const normalizeSeverity = (
  value: unknown,
  path: string,
  errors: string[],
): WritingFeedback['frameworkFeedback'][number]['severity'] => {
  if (value === 'fatal' || value === 'naturalness' || value === 'preserved') return value;
  errors.push(`${path} missing or invalid severity`);
  return 'naturalness';
};

const normalizeDimension = (value: unknown, path: string, errors: string[]) => {
  if (value === 'TR' || value === 'CC' || value === 'LR' || value === 'GRA') return value;
  errors.push(`${path} missing or invalid dimension`);
  return 'TR';
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
  const lengthFeedback = buildWritingLengthFeedback(essayWords, task);

  return {
    mode: source.mode === 'mock' ? 'mock' : 'practice',
    module: 'writing',
    task,
    question: asString(source.question, request.question || FALLBACK_TEXT, 'question', validationErrors),
    essay: asString(source.essay, request.essay || FALLBACK_TEXT, 'essay', validationErrors),
    scores: {
      taskResponse: applyLengthCap(asNumber(scores.taskResponse, 'scores.taskResponse', validationErrors), essayWords, 250),
      coherenceCohesion: applyLengthCap(asNumber(scores.coherenceCohesion, 'scores.coherenceCohesion', validationErrors), essayWords, 250),
      lexicalResource: applyLengthCap(asNumber(scores.lexicalResource, 'scores.lexicalResource', validationErrors), essayWords, 250),
      grammaticalRangeAccuracy: applyLengthCap(
        asNumber(scores.grammaticalRangeAccuracy, 'scores.grammaticalRangeAccuracy', validationErrors),
        essayWords,
        250,
      ),
    },
    frameworkFeedback: [
      ...(lengthFeedback ? [lengthFeedback] : []),
      ...asArray(source.frameworkFeedback, 'frameworkFeedback', validationErrors).map((item, index) => {
        const record = isRecord(item) ? item : {};
        if (!isRecord(item)) validationErrors.push(`frameworkFeedback[${index}] missing or invalid object`);
        return {
          issue: asString(record.issue, FALLBACK_TEXT, `frameworkFeedback[${index}].issue`, validationErrors),
          suggestionZh: asString(
            record.suggestionZh,
            'Provider feedback was incomplete; this item was normalized safely.',
            `frameworkFeedback[${index}].suggestionZh`,
            validationErrors,
          ),
          severity: normalizeSeverity(record.severity, `frameworkFeedback[${index}].severity`, validationErrors),
        };
      }),
    ],
    sentenceFeedback: asArray(source.sentenceFeedback, 'sentenceFeedback', validationErrors).map((item, index) => {
      const record = isRecord(item) ? item : {};
      if (!isRecord(item)) validationErrors.push(`sentenceFeedback[${index}] missing or invalid object`);
      return {
        original: asString(record.original, FALLBACK_TEXT, `sentenceFeedback[${index}].original`, validationErrors),
        correction: asString(record.correction, FALLBACK_TEXT, `sentenceFeedback[${index}].correction`, validationErrors),
        dimension: normalizeDimension(record.dimension, `sentenceFeedback[${index}].dimension`, validationErrors),
        tag: asString(record.tag, 'provider_safety', `sentenceFeedback[${index}].tag`, validationErrors),
        explanationZh: asString(
          record.explanationZh,
          'Provider feedback was incomplete; this item was normalized safely.',
          `sentenceFeedback[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
    modelAnswer: asString(
      source.modelAnswer,
      'The provider returned incomplete feedback. Please retry analysis after checking the Debug Panel.',
      'modelAnswer',
      validationErrors,
    ),
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
          'Provider feedback was incomplete; this item was normalized safely.',
          `reusableArguments[${index}].explanationZh`,
          validationErrors,
        ),
      };
    }),
    obsidianMarkdown: asString(
      source.obsidianMarkdown,
      '# IELTS Writing Note\n\nProvider output was malformed or incomplete. Please retry analysis.',
      'obsidianMarkdown',
      validationErrors,
    ),
  };
};

const buildWritingTask1Markdown = (feedback: Omit<WritingTask1Feedback, 'obsidianMarkdown'>): string =>
  `# IELTS Writing Task 1 Note

## Prompt
${feedback.instruction}

## Visual Brief
${feedback.visualBrief}

## Training Estimate
${formatBandEstimate(feedback.estimatedBand)}

## Must Fix
${feedback.mustFix.length ? feedback.mustFix.map(item => `- ${item}`).join('\n') : '- No critical Task 1 issue returned.'}

## Rewrite Task
${feedback.rewriteTask}

## Reusable Report Patterns
${feedback.reusableReportPatterns.length ? feedback.reusableReportPatterns.map(item => `- ${item}`).join('\n') : '- No reusable pattern returned.'}

## Improved Report / Model Excerpt
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
    obsidianMarkdown: typeof source.obsidianMarkdown === 'string' && source.obsidianMarkdown.trim()
      ? source.obsidianMarkdown
      : (() => {
          normalizedFields.push('obsidianMarkdown');
          return buildWritingTask1Markdown(feedbackWithoutMarkdown);
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
