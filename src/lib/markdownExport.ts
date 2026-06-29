import { formatConservativeBandEstimate, getTargetLabel, getTargetLabelZh } from './bands';
import type { Part1DevelopmentTarget, Part3AnswerFeedback, SpeakingFeedback, SpeakingMaterialBankItem, WritingFeedback, WritingTask1Feedback } from './ai/schemas';
import { validatePart1ThreadFeedbackIntegrity } from './ai/part1ThreadIntegrity';
import {
  buildPart1LearningDisplayModel,
  normalizePart1ComparableText,
  normalizePart1LearnerText,
  normalizePart1TranscriptDisplayText,
  part1DevelopmentChunkKey,
  part1LearningItemKey,
} from './part1LearningDisplayModel';
import type { WritingTask1AcademicPrompt } from '../data/questions/bank';
import type { WritingTask1QuickPlan } from './practiceRecords';
import {
  HIGH_BAND_BOUNDARY_ZH,
  HIGH_BAND_STABLE_ZH,
  resolveSpeakingTargetState,
  resolveTask1TargetState,
  resolveWritingTargetState,
} from './scoreLayer';

type ExportModule = 'speaking' | 'writing';
type ExportTaskOrPart = 'p1' | 'p2' | 'p3' | 'task1' | 'task2';

interface MarkdownFilenameInput {
  module: ExportModule;
  taskOrPart: ExportTaskOrPart;
  topic?: string;
  prompt?: string;
  timestamp?: string | Date;
  sessionKind?: 'part1_topic_thread' | 'part3_discussion_thread' | 'single_question';
}

const GENERIC_TOPIC_PATTERN = /academic task|task 1|task 2|writing|speaking|general/i;

const dateFromInput = (value?: string | Date) => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value;
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
};

const pad = (value: number) => value.toString().padStart(2, '0');

const formatDateTimeStamp = (value?: string | Date) => {
  const date = dateFromInput(value);
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}${pad(date.getMinutes())}`,
  };
};

const unique = <T,>(items: T[]) => Array.from(new Set(items));

const cleanLines = (items: Array<string | undefined | null>) =>
  items.map(item => (item || '').replace(/\s+/g, ' ').trim()).filter(Boolean);

const BLOCKED_LEARNING_CONTENT =
  /provider output was malformed or incomplete|please retry analysis after checking the debug panel|provider_safety|raw parse|validation failure|parse_or_schema|incomplete feedback|debug panel|\[remove or rephrase sentence\]/i;

const cleanLearningText = (value?: string | null) => {
  const cleaned = (value || '').replace(/"{3,}/g, '').replace(/\s+/g, ' ').trim();
  return cleaned && !BLOCKED_LEARNING_CONTENT.test(cleaned) ? cleaned : '';
};

const cleanLearningLines = (items: Array<string | undefined | null>) =>
  cleanLines(items.map(cleanLearningText)).filter(Boolean);

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

const escapeTableCell = (value?: string | null) =>
  cleanLearningText(value).replace(/\|/g, '/');

const limitWords = (text: string, maxWords: number) =>
  text.split(/\s+/).filter(Boolean).slice(0, maxWords).join(' ');

export const slugifyMarkdownFilenamePart = (value?: string, maxWords = 8) => {
  const words = (value || '')
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);

  return words.join('-') || 'untitled';
};

const detectTask2Type = (text?: string) => {
  const source = (text || '').toLowerCase();
  if (/outweigh/.test(source)) return 'outweigh';
  if (/agree or disagree|to what extent do you agree/.test(source)) return 'agree-disagree';
  if (/discuss both/.test(source)) return 'discuss-both';
  if (/problem.*solution|cause.*solution|problems.*solutions/.test(source)) return 'problem-solution';
  if (/advantages and disadvantages|benefits and drawbacks/.test(source)) return 'advantages-disadvantages';
  if (/best way|best method|most effective way/.test(source)) return 'best-way';
  if (/responsib/.test(source)) return 'responsibility';
  if (/\?.*\?/.test(source)) return 'two-part';
  return '';
};

const topicKeywords = (text?: string, fallback?: string, maxWords = 3) => {
  const source = `${text || ''} ${fallback || ''}`.toLowerCase();
  const phraseMatches: Array<[RegExp, string[]]> = [
    [/work from home|working from home|remote work|telecommut/i, ['remote', 'work']],
    [/happy society|happiness|happy people/i, ['happy', 'society']],
    [/environment|pollution|climate/i, ['environment']],
    [/traffic|cars|transport/i, ['traffic']],
    [/education|school|university|students/i, ['education']],
    [/technology|internet|computer|online/i, ['technology']],
    [/health|medical|exercise/i, ['health']],
    [/government|public|responsib/i, ['government']],
  ];
  const matched = phraseMatches.find(([pattern]) => pattern.test(source))?.[1] || [];
  if (matched.length >= Math.min(2, maxWords)) return matched.slice(0, maxWords).join('-');
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'to', 'of', 'in', 'on', 'for', 'from', 'with', 'without',
    'some', 'people', 'think', 'believe', 'many', 'more', 'are', 'is', 'be', 'being', 'been',
    'that', 'this', 'these', 'those', 'should', 'would', 'could', 'instead', 'choosing',
    'below', 'chart', 'shows', 'table', 'diagram', 'map', 'process',
  ]);
  const words = source
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
  return unique([...matched, ...words]).slice(0, maxWords).join('-') || 'untitled';
};

const isReliableTopic = (topic?: string) =>
  Boolean(topic?.trim()) && !GENERIC_TOPIC_PATTERN.test(topic || '');

export const buildMarkdownExportFilename = ({
  module,
  taskOrPart,
  topic,
  prompt,
  timestamp,
  sessionKind,
}: MarkdownFilenameInput) => {
  const { date, time } = formatDateTimeStamp(timestamp);
  if (module === 'speaking' && taskOrPart === 'p1' && sessionKind === 'part1_topic_thread') {
    const topicSlug = slugifyMarkdownFilenamePart(isReliableTopic(topic) ? topic : prompt, 5);
    return `ielts-speaking-p1-${topicSlug || 'topic'}-topic-thread-${date}-${time}.md`;
  }
  const taskType = taskOrPart === 'task2' ? detectTask2Type(prompt) : '';
  const slug = taskOrPart === 'task2'
    ? unique([topicKeywords(prompt, topic, 3), taskType].filter(Boolean)).join('-')
    : taskOrPart === 'task1'
      ? topicKeywords(prompt, isReliableTopic(topic) ? topic : undefined, 4)
      : slugifyMarkdownFilenamePart(isReliableTopic(topic) ? `${topic} ${prompt || ''}` : prompt, 8);

  return `ielts-${module}-${taskOrPart}-${slug || 'untitled'}-${date}-${time}.md`;
};

const formatExportDate = (timestamp?: string | Date) => formatDateTimeStamp(timestamp).date;

const bulletList = (items: string[], fallback: string, limit = 5) => {
  const limited = cleanLines(items).slice(0, limit);
  return limited.length ? limited.map(item => `- ${item}`).join('\n') : `- ${fallback}`;
};

const numberedList = (items: string[], fallback: string, limit = 5) => {
  const limited = cleanLines(items).slice(0, limit);
  return limited.length ? limited.map((item, index) => `${index + 1}. ${item}`).join('\n') : `1. ${fallback}`;
};

const quoteBlock = (text: string) =>
  (text || 'No saved text.').split('\n').map(line => `> ${line}`).join('\n');

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const hasLowSignalText = (text: string) => {
  const normalized = text.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return true;
  const words = normalized.split(' ').filter(Boolean);
  return normalized.replace(/\s/g, '').length < 8 || (words.length >= 4 && new Set(words).size <= 2);
};

const isSpeakingInsufficient = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const words = countWords(feedback.transcript);
  if (feedback.fatalErrors.some(error => error.tag === 'insufficient_sample')) return true;
  if (/insufficient sample|starter outline/i.test(feedback.upgradedAnswer)) return true;
  if (feedback.part === 1) return words <= 8;
  if (feedback.part === 2) return words < 60;
  return words < 35;
};

const isMeaningfulShortAnswer = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) =>
  countWords(feedback.transcript) > 0 && !hasLowSignalText(feedback.transcript);

const isHighBandSpeakingStable = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) =>
  (feedback.targetState || resolveSpeakingTargetState(feedback)) === 'high_band_stable';

const isHighBandWritingStable = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  (feedback.targetState || resolveWritingTargetState(feedback)) === 'high_band_stable';

const hasUnstableWritingTarget = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  ['needs_repair', 'target_failed_or_borderline'].includes(feedback.targetState || resolveWritingTargetState(feedback));

const phraseChunk = (value?: string, maxWords = 7) => {
  const cleaned = cleanLearningText(value)
    .replace(/["`]/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/);
  if (words.length > maxWords || /[,;:]/.test(cleaned)) return '';
  return cleaned;
};

const INCOMPLETE_PHRASE_ENDINGS = /\b(?:to|with|and|or|because|so|so i|when|where|that|which|of|for|in|on|at|by|from|the|a|an)$/i;
const META_INSTRUCTION_PATTERN = /^(?:add|include|mention|explain|describe|use|integrate|avoid|try to|make sure|expand|replace|rewrite|give|remove|rephrase|correct|fix)\b/i;
const UNCLEAR_REUSABLE_PHRASE_PATTERN = /^(?:wherever possible|increasingly|very|really|actually|basically|generally|overall|more|better|good|bad)$/i;

const cleanReusablePhrase = (value?: string, maxWords = 8) => {
  const cleaned = cleanLearningText(value)
    .replace(/^[\s\-*•\d.]+/, '')
    .replace(/["`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/g, '');
  if (!cleaned) return '';
  if (/^\[[^\]]+\]$/.test(cleaned) || /[\u4e00-\u9fff]/.test(cleaned)) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) return '';
  if (/[,;:/]/.test(cleaned)) return '';
  if (META_INSTRUCTION_PATTERN.test(cleaned)) return '';
  if (UNCLEAR_REUSABLE_PHRASE_PATTERN.test(cleaned)) return '';
  if (INCOMPLETE_PHRASE_ENDINGS.test(cleaned)) return '';
  if (/\b(?:specific genre|specific detail|personal reason|instruction|answer path)\b/i.test(cleaned)) return '';
  return cleaned;
};

const speakingShortAnswerExpressionFallback = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (!isSpeakingInsufficient(feedback)) return [];
  if (/read/i.test(feedback.question)) {
    return ['[type of books]', 'when I want to relax', 'it helps me [personal reason]'];
  }
  return feedback.part === 1
    ? ['先补一个具体细节', '先补一个真实原因']
    : ['先补一个具体场景', '先补两个关键细节'];
};

const speakingActiveExpressions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const candidates = unique(cleanLines([
    ...feedback.naturalnessHints.map(item => cleanReusablePhrase(item.better)),
    ...feedback.band9Refinements.map(item => cleanReusablePhrase(item.refinement)),
    feedback.reusableExample && cleanReusablePhrase(feedback.reusableExample.example),
  ])).slice(0, 4);

  return candidates.length ? candidates : speakingShortAnswerExpressionFallback(feedback).slice(0, 4);
};

const splitSentences = (text: string) =>
  text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(item => item.trim()) || [];

const genericSpeakingPath = (part: SpeakingFeedback['part']) => {
  if (part === 1) return ['Direct answer', 'One specific detail', 'Light reason or feeling', 'Stop'];
  if (part === 2) return ['Topic: what you are describing', 'Scene: where/when it happens', 'Details: two concrete details', 'Feeling: how you feel', 'Meaning: why it matters'];
  return ['Direct position', 'Contrast or condition', 'Example', 'Consequence', 'Balanced close'];
};

const speakingAnswerPath = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const source = feedback.upgradedAnswer && !/insufficient sample|starter outline/i.test(feedback.upgradedAnswer)
    ? feedback.upgradedAnswer
    : feedback.transcript;
  const combined = `${feedback.question} ${source}`.toLowerCase();

  if (feedback.part === 2 && /daily routine|ideal day|routine/.test(combined)) {
    return [
      'Routine: ideal day / wake up naturally',
      'Morning: breakfast + jog / gym',
      'Midday: lunch + short nap',
      'Afternoon: focused work or study',
      'Evening: PC games with roommates + family time',
      'Meaning: balance between activity, productivity, and connection',
    ];
  }

  if (feedback.part === 1 && /read/.test(combined)) {
    return [
      'Direct answer: yes, I enjoy reading',
      'Detail: add [type of books]',
      'Reason: it helps me [personal reason]',
      'Stop',
    ];
  }

  if (feedback.part === 2 && /relax|leisure|game|family|productive|work|study/.test(combined)) {
    return [
      'Topic: the activity or routine',
      'Scene: when and where it usually happens',
      'Details: two concrete actions',
      'Feeling: why it feels relaxing or productive',
      'Meaning: what it adds to your life',
    ];
  }

  return genericSpeakingPath(feedback.part);
};

const starterTargetAnswer = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const question = feedback.question.trim();
  if (/^do you/i.test(question) && /read/i.test(question)) {
    return 'Yes, I do. I usually read [type of books] when I want to relax. It helps me [personal reason].';
  }
  if (/^do you/i.test(question)) {
    return 'Yes, I do. I usually [specific detail] when I want to relax. It helps me [personal reason].';
  }
  if (/^what/i.test(question)) {
    return 'I usually [direct answer]. For example, [specific detail]. I like it because [personal reason].';
  }
  if (/^describe/i.test(question)) {
    return 'I would like to describe [person/place/activity]. It happened / happens [time or place]. The main reason I remember it is [personal reason].';
  }
  return 'My answer is [direct answer]. One specific detail is [personal detail]. This matters because [personal reason].';
};

const speakingMission = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (isSpeakingInsufficient(feedback)) {
    return {
      must: feedback.part === 1
        ? ['Direct answer: Yes / No / It depends.', 'Detail: what kind, when, where, or how often.', 'Reason: why you like it, dislike it, or do it.', 'Stop after 2-4 spoken sentences.']
        : ['Say one complete answer first.', 'Add at least two concrete details.', 'Explain why the example matters.'],
      optional: ['Use the starter target answer as a frame, then replace brackets with your real details.'],
    };
  }
  if (feedback.part === 1) {
    return {
      must: ['直接回答问题。', '补一个具体个人细节。', '用一句轻理由或感受收住答案。'],
      optional: ['如果答案超过 4 句，删掉解释性废话。'],
    };
  }
  if (feedback.part === 2) {
    return {
      must: ['把素材讲成连续场景。', '保留 2-3 个最清楚的细节。', '结尾说清楚这件事为什么重要。'],
      optional: ['练一次 90-120 秒版本，避免过早停下。'],
    };
  }
  return {
    must: ['先给清楚立场。', '加入对比、条件或让步。', '用一个现实例子支撑观点。'],
    optional: ['结尾补一句影响或趋势。'],
  };
};

const diagnosisRows = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (isSpeakingInsufficient(feedback)) {
    return [{
      category: '样本不足',
      issue: feedback.fatalErrors[0]?.original || '答案太短，暂时不能形成稳定诊断。',
      fix: feedback.part === 1
        ? '先用 2-4 句补出直接回答、具体细节和真实原因。'
        : '先按 Answer Path 说出一个完整答案，再追求高级表达。',
    }];
  }

  const rows = [
    ...feedback.fatalErrors.map(item => ({ priority: 1, category: '优先修复', issue: `${item.original} -> ${item.correction}`, fix: item.explanationZh })),
    ...feedback.naturalnessHints.map(item => ({ priority: 2, category: '自然表达', issue: `${item.original} -> ${item.better}`, fix: item.explanationZh })),
    ...feedback.band9Refinements.map(item => ({ priority: 3, category: '高分稳定', issue: item.observation, fix: item.refinement })),
  ].sort((a, b) => a.priority - b.priority).slice(0, 5);

  return rows.length ? rows : [{
    category: isSpeakingInsufficient(feedback) ? '样本不足' : '本次重点',
    issue: isSpeakingInsufficient(feedback) ? '答案太短，无法形成完整个性化改写。' : '结构基本可用，但还需要更稳定地展开。',
    fix: isSpeakingInsufficient(feedback) ? '先按 Answer Path 说出一个完整答案，再追求高级表达。' : '下一次先按回答路线复述，再加入一个具体细节。',
  }];
};

const transferQuestions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const direct = (feedback.reusableExample?.canBeReusedFor || [])
    .map(item => item
      .replace(/^Can this idea also help you answer:\s*/i, '')
      .replace(/^This idea can also help you answer:\s*/i, '')
      .replace(/^Can this material be reused for:\s*/i, '')
    .trim())
    .filter(item => /^(describe|what|do|how|why|when|where|should|is|are|can|could|would)\b/i.test(item))
    .filter(item => !/^can this\b/i.test(item))
    .map(item => /^describe\b/i.test(item) ? `${item.replace(/[?.!]+$/, '')}.` : item.endsWith('?') ? item : `${item}?`)
    .slice(0, 3);
  const fallback = feedback.part === 1
    ? ['Do you enjoy reading?', 'What do you usually do to relax?', 'How often do you spend time on this activity?']
    : feedback.part === 2
      ? ['Describe a leisure activity you enjoy.', 'Describe something you do to relax.', 'Describe a time when you had a productive day.']
      : ['How has technology changed people\'s daily routines?', 'Do people today have a better work-life balance than in the past?', 'What can companies do to improve employees\' wellbeing?'];
  return unique([...direct, ...fallback]).slice(0, 3);
};

const reviewCardGenericPath = (part: SpeakingFeedback['part']) => {
  if (part === 1) return ['直接回答', '一个具体细节', '一个简单原因', '收住'];
  if (part === 2) return ['说明要讲的人/物/地点/事件', '给一个具体场景', '补两个细节', '说明感受变化', '解释为什么重要'];
  return ['先给观点', '补原因或对比', '给一个例子', '说明影响', '简短收束'];
};

const reviewCardAnswerPath = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const cleanAnswer = cleanLearningText(feedback.upgradedAnswer);
  const source = cleanAnswer && !/insufficient sample|starter outline/i.test(cleanAnswer)
    ? cleanAnswer
    : feedback.transcript;
  const combined = `${feedback.question} ${source}`.toLowerCase();

  if (feedback.part === 3 && /cities|city|urban|rural|residential|apartment|transport|parks|green/.test(combined)) {
    return [
      '总变化：cities have become larger and more convenient',
      '变化一：rural areas -> residential districts / apartments',
      '变化二：more parks and green spaces',
      '变化三：public transport has improved',
      '总结影响：bigger and busier, but also more liveable',
    ];
  }
  if (feedback.part === 2 && /daily routine|ideal day|routine/.test(combined)) {
    return [
      '主题：ideal daily routine / wake up naturally',
      '早上：breakfast + jog / gym',
      '中午：lunch + short nap',
      '下午：focused work or study',
      '晚上：PC games with roommates + family time',
      '意义：balance between activity, productivity, and connection',
    ];
  }
  if (feedback.part === 1 && /read/.test(combined)) {
    return [
      '直接回答：Yes, I do.',
      '具体细节：read [type of books]',
      '简单原因：it helps me [personal reason]',
      '收住：不要展开成小作文',
    ];
  }
  if (feedback.part === 2 && /relax|leisure|game|family|productive|work|study/.test(combined)) {
    return [
      '主题：the activity or routine',
      '场景：when and where it usually happens',
      '细节：two concrete actions',
      '感受：why it feels relaxing or productive',
      '意义：what it adds to your life',
    ];
  }
  return reviewCardGenericPath(feedback.part);
};

const reviewCardRequirements = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const words = countWords(feedback.transcript);
  if (feedback.part === 1) {
    const status = words <= 3
      ? '当前回答：太短，需要补一个个人细节或简单原因。'
      : words <= 40
        ? '当前回答：长度接近 Part 1，但要确认有具体个人细节。'
        : '当前回答：可能偏长，注意保持像对话里的短答。';
    return ['Part 1：自然短答，后续通常会被追问同话题问题。', '目标长度：2-4 句 / 约 15-30 秒。', status];
  }
  if (feedback.part === 2) {
    const status = words < 60
      ? '当前回答：长答素材不足，需要补场景、细节、感受和意义。'
      : '当前回答：检查是否有清楚场景、关键细节、感受变化和 why-it-matters。';
    return ['Part 2：个人长答，不是逐条翻译 cue card。', '目标长度：1.5-2 分钟。', status];
  }
  const status = words < 35
    ? '当前回答：讨论展开不足，需要观点、例子和影响。'
    : '当前回答：检查是否有 position、example、consequence 和自然口语清晰度。';
  return ['Part 3：抽象讨论，但仍然是自然口语，不是写作作文。', '目标长度：4-6 句 / 约 35-60 秒。', status];
};

const reviewCardRows = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const labelIssueType = (type?: string, sourceText = '') => {
    const normalized = `${type || ''} ${sourceText}`.toLowerCase().replace(/[_-]+/g, ' ');
    if (/spelling|word form|typo/.test(normalized)) return '拼写';
    if (/lexical|vocabulary|word choice|collocation/.test(normalized)) return '词汇';
    if (/noun agreement|plural|countable noun|count noun|singular/.test(normalized)) return '单复数 / 可数名词';
    if (/tense|grammatical tense|present perfect|past tense/.test(normalized)) return '时态';
    if (/awkward|phrasing|clarity|naturalness|wording/.test(normalized)) return '表达不自然';
    if (/grammar|grammatical|subject verb|article|preposition/.test(normalized)) return '语法';
    if (/discourse marker|opening phrase|cohesion|transition|connector/.test(normalized)) return '开头 / 衔接';
    if (/filler|hesitation|you know|um|uh|like/.test(normalized)) return '填充词';
    if (/reason|effect|impact|consequence|develop|logic|explain|why|so what|展开|逻辑|影响|原因/.test(normalized)) return '展开 / 逻辑';
    if (/high band|高分|refinement|band9/.test(normalized)) return '高分稳定';
    if (/insufficient|sample|short/.test(normalized)) return '展开';
    return '表达';
  };

  const conciseIssueNote = (type: string, item: { original: string; correction: string; explanationZh?: string }) => {
    const source = `${item.original} ${item.correction}`.toLowerCase();
    const firstSentence = (item.explanationZh || '').replace(/\s+/g, ' ').trim().match(/[^。！？.!?]+[。！？.!?]?/)?.[0]?.trim() || '';
    if (/回答展开不足/.test(item.original) && firstSentence) return firstSentence;
    if (/拼写/.test(type)) return '关键词拼写错误会影响理解。';
    if (/可数名词|单复数/.test(type)) return '可数名词要和数量词、单复数形式保持一致。';
    if (/时态/.test(type)) return '描述近年变化或持续影响时要选对时态。';
    if (/表达不自然/.test(type)) return '这个说法能理解，但不够像自然口语。';
    if (/词汇/.test(type)) return '换成更准确的搭配后意思更清楚。';
    if (/填充词/.test(type)) return '重复填充词会削弱流利度和连贯性。';
    if (/开头|衔接/.test(type)) return '开头和衔接要帮助考官马上听清逻辑。';
    if (/语法/.test(type)) return '基础语法错误会影响句子清晰度。';
    if (/高分稳定/.test(type)) return '这不是硬错误；重点是保持自然、清晰和可迁移。';
    if (/展开|逻辑/.test(type) || /why|so what|consequence|effect|reason/.test(source)) {
      return 'Part 3 需要说明原因或影响，而不是只列变化。';
    }
    return firstSentence && !BLOCKED_LEARNING_CONTENT.test(firstSentence)
      ? firstSentence.replace(/[.!?]$/, '。')
      : '下次优先把这个点说得更清楚。';
  };

  if (feedback.part === 2) {
    const anchoredRows = (feedback.part2Feedback?.annotations || [])
      .flatMap(annotation => annotation.layers.map(layer => ({
        priority: layer.severity === 'must_fix' ? 1 : layer.severity === 'better_spoken_choice' ? 2 : 3,
        original: annotation.sourceQuote || layer.original,
        correction: annotation.combinedRepair || layer.better,
        type: layer.issueType || layer.severity,
        explanationZh: layer.explanationZh,
      })))
      .map(item => ({
        ...item,
        original: escapeTableCell(item.original),
        correction: escapeTableCell(item.correction),
        type: escapeTableCell(labelIssueType(item.type, `${item.original} ${item.correction} ${item.explanationZh || ''}`)),
      }))
      .map(item => ({
        ...item,
        note: escapeTableCell(conciseIssueNote(item.type, item)),
      }))
      .filter(item => item.original && item.correction && item.type && item.note)
      .sort((a, b) => a.priority - b.priority);

    if (anchoredRows.length) return anchoredRows;

    return [{
      original: '本次没有稳定锚定批注',
      correction: feedback.part2Feedback?.priorityFocusZh || '先补完整故事骨架',
      type: 'Part 2 路线',
      note: 'Part 2 批注只导出 provider 原生可锚定 span；不从旧 phrase cards 倒推。',
    }];
  }

  const part3NeedsMacroReasoningRow = () => {
    if (feedback.part !== 3) return false;
    const text = `${feedback.question} ${feedback.transcript} ${feedback.upgradedAnswer}`.toLowerCase();
    const hasContent = countWords(feedback.transcript) >= 25;
    const hasChangeList = /change|changed|become|became|now|before|city|cities|urban|transport|apartment|park|green/.test(text);
    const alreadyCovered = [...feedback.fatalErrors, ...feedback.naturalnessHints]
      .some(item => {
        const replacement = 'correction' in item ? item.correction : item.better;
        return /reason|effect|impact|consequence|develop|logic|why|so what|展开|逻辑|影响|原因/.test(`${item.tag} ${item.original} ${replacement} ${item.explanationZh}`.toLowerCase());
      });
    return hasContent && hasChangeList && !alreadyCovered;
  };

  const insufficientRows = isSpeakingInsufficient(feedback)
    && !feedback.fatalErrors.some(item => item.tag === 'insufficient_sample')
    ? [{
      priority: 0,
      original: '回答展开不足',
      correction: feedback.part === 1 ? '补 direct answer + detail + reason' : '先说完整路线，再补细节和影响',
      type: '展开',
      explanationZh: feedback.part === 1 ? 'Part 1 至少要有直接回答和一个真实细节。' : '当前样本不足，先把答案说完整再看语言细节。',
    }]
    : [];

  const rows = [
    ...insufficientRows,
    ...feedback.fatalErrors.map(item => ({
      priority: 1,
      original: item.original,
      correction: item.correction,
      type: item.tag || '错误',
      explanationZh: item.explanationZh,
    })),
    ...feedback.naturalnessHints.map(item => ({
      priority: 2,
      original: item.original,
      correction: item.better,
      type: item.tag || '自然度',
      explanationZh: item.explanationZh,
    })),
    ...feedback.band9Refinements.map(item => ({
      priority: 3,
      original: item.observation,
      correction: item.refinement,
      type: '高分稳定',
      explanationZh: item.explanationZh,
    })),
    ...(part3NeedsMacroReasoningRow() ? [{
      priority: 2,
      original: '原因和影响展开不足',
      correction: '每个变化后补一句 why / so what',
      type: '展开',
      explanationZh: 'Part 3 需要说明变化背后的原因或影响，而不是只列变化。',
    }] : []),
  ]
    .map(item => ({
      ...item,
      original: escapeTableCell(item.original),
      correction: escapeTableCell(item.correction),
      type: escapeTableCell(labelIssueType(item.type, `${item.original} ${item.correction} ${item.explanationZh || ''}`)),
    }))
    .map(item => ({
      ...item,
      note: escapeTableCell(conciseIssueNote(item.type, item)),
    }))
    .filter(item => item.original && item.correction && item.type && item.note)
    .sort((a, b) => a.priority - b.priority);

  return rows.length ? rows : [{
    original: '回答可以更具体',
    correction: feedback.part === 1 ? '补一个真实个人细节' : '补 cause / example / so what',
    type: '展开',
    note: feedback.part === 3 ? 'Part 3 需要把观点后的原因、例子或影响说出来。' : '具体细节能让答案更真实、更容易展开。',
  }];
};

const hasSpeakingFillerIssue = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const source = `${feedback.transcript} ${feedback.fatalErrors.map(item => item.original).join(' ')} ${feedback.naturalnessHints.map(item => `${item.original} ${item.explanationZh}`).join(' ')}`;
  const matches = source.toLowerCase().match(/\b(?:well|honestly|you know|like|um|uh|er)\b/g) || [];
  return matches.length >= 2 || /filler|填充词|口头禅|重复/.test(source);
};

const reviewCardTransferQuestions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const direct = (feedback.reusableExample?.canBeReusedFor || [])
    .map(cleanLearningText)
    .filter(Boolean)
    .map(item => item
      .replace(/^Can this idea also help you answer:\s*/i, '')
      .replace(/^This idea can also help you answer:\s*/i, '')
      .replace(/^Can this material be reused for:\s*/i, '')
      .trim())
    .filter(item => /^(describe|what|do|how|why|when|where|should|is|are|can|could|would)\b/i.test(item))
    .filter(item => !/^can this\b/i.test(item))
    .map(item => /^describe\b/i.test(item) ? `${item.replace(/[?.!]+$/, '')}.` : item.endsWith('?') ? item : `${item}?`)
    .slice(0, 3);
  const fallback = feedback.part === 1
    ? (/read/i.test(feedback.question)
      ? ['What kind of books do you usually read?', 'Did you enjoy reading when you were a child?', 'Do you prefer paper books or e-books?']
      : ['How often do you do this?', 'Did you enjoy it when you were younger?', 'Would you like to do it more in the future?'])
    : feedback.part === 2
      ? ['Describe a leisure activity you enjoy.', 'Describe something you do to relax.', 'Describe a time when you had a productive day.']
      : /cit(?:y|ies)|urban|transport|park/i.test(`${feedback.question} ${feedback.transcript} ${feedback.upgradedAnswer}`)
        ? ['How has technology changed people\'s daily lives?', 'How have people\'s lifestyles changed in recent years?', 'What changes make a city more liveable?']
        : ['How has technology changed people\'s daily lives?', 'Do people today have a better work-life balance than in the past?', 'What changes make a place more liveable?'];
  return unique([...direct, ...fallback]).slice(0, 3);
};

const reviewCardTargetHeading = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (feedback.part === 2) return '## 4. NEXT SPEAKABLE VERSION';
  const state = feedback.targetState || resolveSpeakingTargetState(feedback);
  const lowerBound = feedback.bandEstimateRange?.lower ?? feedback.bandEstimateExcludingPronunciation;
  if (isSpeakingInsufficient(feedback) && isMeaningfulShortAnswer(feedback)) return '## 4. BAND 7 TARGET ANSWER';
  if (isSpeakingInsufficient(feedback)) return '## 4. NEEDS REPAIR';
  if (state === 'high_band_stable') return '## 4. STANDARD ANSWER';
  if (lowerBound < 7) return '## 4. BAND 7 TARGET ANSWER';
  return '## 4. BAND 7+ TARGET ANSWER';
};

const reviewCardTargetBody = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (feedback.part === 2 && feedback.part2Feedback?.nextSpeakableVersion) {
    const highlights = feedback.part2Feedback.nextSpeakableVersionHighlights.length
      ? feedback.part2Feedback.nextSpeakableVersionHighlights
        .map(item => cleanLines([
          `- ${cleanLearningText(item.quote)}`,
          item.signal ? `  - Signal: ${part2SignalLabel(item.signal)}` : undefined,
          item.storyRole ? `  - Story role: ${part2StoryRoleLabel(item.storyRole)}` : undefined,
          item.labelZh ? `  - Label: ${cleanLearningText(item.labelZh)}` : undefined,
          item.whyItWorksZh ? `  - Why: ${cleanLearningText(item.whyItWorksZh)}` : undefined,
        ]).join('\n'))
        .join('\n')
      : '';
    return cleanLines([
      cleanLearningText(feedback.part2Feedback.nextSpeakableVersion),
      highlights ? `\n### Highlighted upgrades\n${highlights}` : undefined,
    ]).join('\n\n');
  }

  const state = feedback.targetState || resolveSpeakingTargetState(feedback);
  if (state === 'high_band_stable') {
    return cleanLines([
      feedback.highBandStabilityZh || HIGH_BAND_STABLE_ZH,
      feedback.nextStepZh,
      cleanLearningText(feedback.upgradedAnswer) || cleanLearningText(feedback.transcript),
    ]).join('\n\n');
  }
  if (state === 'high_band_boundary') {
    return cleanLines([
      HIGH_BAND_BOUNDARY_ZH,
      cleanLearningText(feedback.upgradedAnswer),
    ]).join('\n\n');
  }

  const targetLabel = isHighBandSpeakingStable(feedback)
    ? '目标层级已达到。下一步重点是自然输出、时间控制和迁移练习。'
    : (feedback.bandEstimateRange?.lower ?? feedback.bandEstimateExcludingPronunciation) >= 7
    ? '目标训练方向：Band 7+ Target Answer，表达更自然、逻辑更清楚，但不要写成作文。'
    : '目标训练方向：Band 7 Target Answer，保持自然口语，不写成作文。';
  if (isSpeakingInsufficient(feedback) && isMeaningfulShortAnswer(feedback)) {
    return `${targetLabel}\n\n${starterTargetAnswer(feedback)}\n\n请把方括号里的内容替换成你的真实细节。`;
  }
  if (isSpeakingInsufficient(feedback)) {
    return '当前录音/转写不足以生成可靠目标答案。请先重录一个可理解的完整答案。';
  }
  if (isHighBandSpeakingStable(feedback)) {
    return cleanLines([
      targetLabel,
      feedback.highBandStabilityZh,
      feedback.nextStepZh,
      '本次没有必须修改的问题。',
      '本次没有必要的可选微调。',
    ]).join('\n\n');
  }
  return cleanLines([
    targetLabel,
    feedback.highBandStabilityZh || feedback.targetAnswerRationaleZh,
    cleanLearningText(feedback.upgradedAnswer) || '请先重录一个完整答案。',
  ]).join('\n\n');
};

const speakingExpressionMeaning = (expression: string) => {
  const normalized = expression.toLowerCase();
  if (normalized === 'urban expansion') return '城市扩张';
  if (normalized === 'residential districts') return '住宅区';
  if (normalized === 'green spaces') return '城市绿地';
  if (normalized === 'public transport has improved') return '公共交通改善';
  if (normalized === 'cities are increasingly investing in green spaces') return '城市越来越重视绿地建设';
  if (normalized === 'more efficient and liveable') return '更高效、更宜居';
  if (normalized === 'more liveable') return '更宜居';
  if (normalized === 'my day feels balanced') return '一天的节奏很平衡';
  if (normalized === 'work-life balance') return '工作与生活平衡';
  return '';
};

const topicExpressionCandidates = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const source = `${feedback.question} ${feedback.transcript} ${feedback.upgradedAnswer}`.toLowerCase();
  const candidates: string[] = [];
  if (/urban|city|cities|rural|residential|transport|green spaces|liveable/.test(source)) {
    candidates.push(
      'urban expansion',
      'residential districts',
      'green spaces',
      'public transport has improved',
      'more liveable',
    );
  }
  if (/balance|routine|work|study|relax|productive/.test(source)) {
    candidates.push('my day feels balanced', 'work-life balance');
  }
  return candidates;
};

const reviewCardExpressions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (feedback.part === 2 && feedback.part2Feedback) {
    const expressions = unique(cleanLearningLines([
      ...feedback.part2Feedback.languageSignals.map(item => cleanReusablePhrase(item.bestUpgrade)),
      ...feedback.part2Feedback.languageSignals.flatMap(item => item.alternatives),
      ...feedback.part2Feedback.languageSignals.flatMap(item =>
        (item.alternativeUpgrades || []).map(alternative => cleanReusablePhrase(alternative.upgrade))),
      ...feedback.part2Feedback.storyModules.map(item => cleanReusablePhrase(item.improvedVersion)),
      feedback.reusableExample && cleanReusablePhrase(feedback.reusableExample.example),
    ])).slice(0, 5);
    return expressions.length
      ? expressions.map(item => `- ${item}`).join('\n')
      : '- 暂无稳定可复用表达。';
  }

  const expressions = unique(cleanLearningLines([
    ...feedback.naturalnessHints.map(item => cleanReusablePhrase(item.better)),
    ...feedback.band9Refinements.map(item => cleanReusablePhrase(item.refinement)),
    feedback.reusableExample && cleanReusablePhrase(feedback.reusableExample.example),
    ...topicExpressionCandidates(feedback).map(item => cleanReusablePhrase(item)),
  ])).slice(0, 5);
  return expressions.length
    ? expressions.map(item => {
        const meaning = speakingExpressionMeaning(item);
        return `- ${meaning ? `${item}：${meaning}` : item}`;
      }).join('\n')
    : '- 暂无稳定可复用表达。';
};

const speakingExpansionFallback = (part: SpeakingFeedback['part']) => {
  if (part === 1) return 'Add one real detail and one short reason; keep it brief.';
  if (part === 2) return 'Build it into a story spine with scene, action, change, feeling, and meaning.';
  return 'Turn the personal material into a claim, contrast or condition, example, and consequence.';
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

const part2SignalLabel = (value: string) => {
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

const part2MaterialTypeLabel = (value?: string) => {
  if (value === 'person') return 'person';
  if (value === 'place') return 'place';
  if (value === 'object') return 'object';
  if (value === 'experience_event') return 'experience/event';
  if (value === 'abstract_or_opinion_experience') return 'abstract/opinion-shaped experience';
  return 'unclear';
};

const reviewCardPart2StoryPackage = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (feedback.part !== 2 || !feedback.part2Feedback) return '';
  const part2 = feedback.part2Feedback;
  const moduleLines = part2.storyModules.length
    ? part2.storyModules.map(item => cleanLines([
        `- ${part2StoryRoleLabel(item.role)} (${item.status})`,
        item.sourceWording && `  - Source: ${cleanLearningText(item.sourceWording)}`,
        item.improvedVersion && `  - Speakable module: ${cleanLearningText(item.improvedVersion)}`,
        item.coachingZh && `  - Coaching: ${cleanLearningText(item.coachingZh)}`,
        item.confirmationNeeded ? '  - Confirm this before treating it as personal memory.' : undefined,
      ]).join('\n')).join('\n')
    : '- No stable story modules returned.';
  const signalLines = part2.languageSignals.length
    ? part2.languageSignals.map(item => cleanLines([
        `- ${part2SignalLabel(item.signal)} (${item.foundInTranscript ? 'found' : 'missing'} / ${item.status})`,
        item.requirementZh && `  - Requirement: ${cleanLearningText(item.requirementZh)}`,
        item.evidenceQuotes?.length ? `  - Transcript evidence: ${cleanLearningLines(item.evidenceQuotes).slice(0, 3).join(' / ')}` : undefined,
        item.evidence && `  - Evidence: ${cleanLearningText(item.evidence)}`,
        item.qualityZh && `  - Quality: ${cleanLearningText(item.qualityZh)}`,
        item.nextMoveZh && `  - Next move: ${cleanLearningText(item.nextMoveZh)}`,
        item.insertLocationZh && `  - Where: ${cleanLearningText(item.insertLocationZh)}`,
        item.bestUpgrade && `  - Best upgrade: ${cleanLearningText(item.bestUpgrade)}`,
        item.alternatives.length ? `  - Alternatives: ${cleanLearningLines(item.alternatives).slice(0, 3).join(' / ')}` : undefined,
        item.alternativeUpgrades?.length ? `  - Alternative upgrades: ${item.alternativeUpgrades.slice(0, 3).map(alternative => cleanLearningText([
          alternative.sourceQuote ? `replace "${alternative.sourceQuote}"` : 'add',
          alternative.upgrade ? `with ${alternative.upgrade}` : '',
          alternative.insertLocationZh ? `at ${alternative.insertLocationZh}` : '',
          alternative.guidanceZh ? `(${alternative.guidanceZh})` : '',
        ].filter(Boolean).join(' '))).join(' / ')}` : undefined,
        item.usedInNextVersionQuote && `  - Used in next version: ${cleanLearningText(item.usedInNextVersionQuote)}`,
        item.profileSignalZh && `  - Profile signal: ${cleanLearningText(item.profileSignalZh)}`,
      ]).join('\n')).join('\n')
    : '- No stable language-signal checklist returned.';
  return cleanLines([
    `## 3A. Part 2 Story Package`,
    `- Material type: ${part2MaterialTypeLabel(part2.materialType)}`,
    part2.materialTypeRationaleZh && `- Why: ${cleanLearningText(part2.materialTypeRationaleZh)}`,
    part2.priorityFocusZh && `- Priority focus: ${cleanLearningText(part2.priorityFocusZh)}`,
    '',
    `### Story modules`,
    moduleLines,
    '',
    `### Six language signals`,
    signalLines,
  ]).join('\n');
};

const reviewCardIdeaExpansion = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (feedback.part === 2 && feedback.part2Feedback?.storyModules.length) {
    return feedback.part2Feedback.storyModules
      .map((item, index) => {
        const lines = [
          `### ${index + 1}. ${part2StoryRoleLabel(item.role)}`,
          item.sourceWording && `- Your material: ${cleanLearningText(item.sourceWording)}`,
          item.improvedVersion && `- Speakable module: ${cleanLearningText(item.improvedVersion)}`,
          item.coachingZh && `- How to expand: ${cleanLearningText(item.coachingZh)}`,
          item.confirmationNeeded && '- Confirm before using this as personal memory.',
        ].filter(Boolean);
        return lines.join('\n');
      })
      .join('\n\n');
  }

  const expressionItems = topicExpressionCandidates(feedback).slice(0, 3);
  const material = feedback.preservedStyle.length
    ? feedback.preservedStyle.slice(0, 3)
    : [{
        text: feedback.reusableExample?.example || limitWords(feedback.transcript, 14),
        reasonZh: feedback.part === 3
          ? 'This material can develop into reason, example, and consequence.'
          : 'This material is worth keeping, but it needs more concrete detail.',
        expansionZh: speakingExpansionFallback(feedback.part),
      }];

  return material
    .filter(item => cleanLearningText(item.text))
    .map((item, index) => {
      const lines = [
        `### ${index + 1}. Personal Material`,
        `- Your material: ${cleanLearningText(item.text)}`,
        `- Why keep it: ${cleanLearningText(item.reasonZh) || 'This idea is relevant and can be used as answer material.'}`,
        `- How to expand: ${cleanLearningText(item.expansionZh) || speakingExpansionFallback(feedback.part)}`,
        cleanLearningText(item.partUseZh) && `- Part use: ${cleanLearningText(item.partUseZh)}`,
        cleanLearningText(item.sampleNextStep) && `- Sample sentence: ${cleanLearningText(item.sampleNextStep)}`,
        item.transferQuestions?.length && `- Transfer to: ${cleanLearningLines(item.transferQuestions).slice(0, 3).join(' / ')}`,
        `- 可用表达: ${expressionItems.length ? expressionItems.join(' / ') : 'because of this / a good example would be / this probably leads to'}`,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n') || '- No stable personal material yet. Next time, add one real detail before upgrading the language.';
};

const questionRefLine = (refs: string[]) => refs.length ? `(${refs.join(' / ')}) ` : '';

const part1AnnotationLabel = (severity: string) => {
  if (severity === 'must_fix') return 'MUST FIX';
  if (severity === 'better_spoken_choice') return 'BETTER SPOKEN CHOICE';
  return 'OPTIONAL POLISH';
};

const part1AnnotationLayerLabel = (layer: { severity: string; origin?: string }) =>
  layer.origin === 'previous_cleaner_answer_conflict'
    ? 'PREVIOUS CLEANER ANSWER CONFLICT'
    : part1AnnotationLabel(layer.severity);

export const formatPart1IssueTypeLabel = (issueType?: string) => {
  const normalized = (issueType || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const mapped: Record<string, string> = {
    grammatical_structure: 'grammar structure',
    'grammatical structure': 'grammar structure',
    singular_plural_agreement: 'number agreement',
    'singular plural agreement': 'number agreement',
    missing_verb: 'missing verb',
    'missing verb': 'missing verb',
    word_choice: 'word choice',
    'word choice': 'word choice',
    pronoun_agreement: 'pronoun agreement',
    'pronoun agreement': 'pronoun agreement',
    subject_verb_agreement: 'subject-verb agreement',
    'subject verb agreement': 'subject-verb agreement',
  };
  return mapped[normalized] || normalized || 'language issue';
};

const part1MaterialItemLines = (item: {
  sourceWording?: string;
  reusableVersion: string;
  reuseFor: string[];
  explanationZh?: string;
  materialCore?: string;
  materialKind?: string;
  part1UseCases?: string[];
  developmentMoveZh?: string;
  developedExample?: string;
  expressionFrames?: string[];
}) => {
  const english = normalizePart1TranscriptDisplayText(item.developedExample || item.reusableVersion || item.materialCore || item.sourceWording);
  const chinese = normalizePart1LearnerText(item.explanationZh || '');
  return [
    english && `- ${english}`,
    chinese && `  - ${chinese}`,
  ].filter((line): line is string => Boolean(line && line.trim())).join('\n');
};

const part1ExpressionItemLines = (item: SpeakingMaterialBankItem) =>
  `- ${normalizePart1LearnerText(item.reusableVersion)}`;

const normalizePart1MaterialExportText = (item: {
  sourceWording?: string;
  reusableVersion: string;
  materialCore?: string;
  developmentMoveZh?: string;
  developedExample?: string;
  expressionFrames?: string[];
  materialKind?: string;
}) =>
  normalizePart1ExportComparableText(`${item.materialCore || ''} ${item.sourceWording || ''} ${item.reusableVersion || ''} ${item.developmentMoveZh || ''} ${item.developedExample || ''} ${(item.expressionFrames || []).join(' ')}`);

const isUsefulPart1ExportMaterial = (item: {
  sourceWording?: string;
  reusableVersion: string;
  materialCore?: string;
  developmentMoveZh?: string;
  developedExample?: string;
  expressionFrames?: string[];
  materialKind?: string;
}) => {
  const text = normalizePart1MaterialExportText(item);
  if (!text) return false;
  if (item.materialKind === 'development_seed') {
    return Boolean(item.materialCore || item.developmentMoveZh || item.expressionFrames?.length);
  }
  if (/^(yes|yeah|no|sure|definitely|absolutely|of course|not really)$/i.test(text)) return false;
  if (/^my hometown is [a-z]+(?: i was born and raised here)?$/i.test(text)) return false;
  if (/^it is a [a-z-]+(?: [a-z-]+){0,2} city$/i.test(text)) return false;
  const hasPersonalSignal = /\b(i|im|ive|id|me|my|mine|we|were|weve|our|us)\b/.test(text);
  const hasValueSignal = /\b(because|so|although|though|but|rather than|instead of|prefer|like|enjoy|miss|missed|feel|felt|family|friend|friends|college|university|school|team|club|match|game|nba|e-?sports?|point guard|captain|role|years?|months?|born|raised|childhood|lived|living|grew up|moved|returned|spent|used to|usually|often)\b/.test(text);
  const hasDevelopmentField = Boolean(item.materialCore || item.developmentMoveZh || item.developedExample || item.expressionFrames?.length);
  return hasPersonalSignal && hasValueSignal && hasDevelopmentField;
};

const isPart1ExportSeedMaterial = (item: { materialKind?: string; materialCore?: string; developmentMoveZh?: string; expressionFrames?: string[] }) =>
  item.materialKind === 'development_seed' && Boolean(item.materialCore || item.developmentMoveZh || item.expressionFrames?.length);

const isPart1ExportReusableMaterial = (item: {
  sourceWording?: string;
  reusableVersion: string;
  materialCore?: string;
  developmentMoveZh?: string;
  developedExample?: string;
  expressionFrames?: string[];
  materialKind?: string;
}) => item.materialKind !== 'development_seed' && isUsefulPart1ExportMaterial(item);

const normalizePart1ExportComparableText = (text: string) =>
  cleanLearningText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPart1ExportCleanerEquivalent = (learnerAnswer: string, cleanerAnswer: string) => {
  const learnerKey = normalizePart1ExportComparableText(learnerAnswer);
  const cleanerKey = normalizePart1ExportComparableText(cleanerAnswer);
  if (!learnerKey || !cleanerKey) return false;
  if (learnerKey === cleanerKey) return true;
  const learnerWords = learnerKey.split(' ').filter(Boolean);
  const cleanerWords = cleanerKey.split(' ').filter(Boolean);
  if (Math.abs(learnerWords.length - cleanerWords.length) > 2) return false;
  const learnerSet = new Set(learnerWords);
  const overlap = cleanerWords.filter(word => learnerSet.has(word)).length;
  return overlap / Math.max(learnerWords.length, cleanerWords.length) >= 0.92;
};

const derivePart1ThreadExportState = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const thread = feedback.threadFeedback;
  if (!thread) return undefined;
  const certificationPassed = thread.cleanRetryCertificationStatus === 'certified_first_attempt' ||
    thread.cleanRetryCertificationStatus === 'certified_after_rewrite';
  const hasOrdinaryMustFix = Boolean(
    thread.mustFix.some(item => item.origin !== 'previous_cleaner_answer_conflict') ||
    thread.annotations?.some(annotation =>
      annotation.layers.some(layer => layer.severity === 'must_fix' && layer.origin !== 'previous_cleaner_answer_conflict'),
    ) ||
    feedback.fatalErrors.length,
  );
  const hasConflict = Boolean(
    (thread.previousCleanerConflictCount || 0) > 0 ||
    thread.annotations?.some(annotation =>
      annotation.layers.some(layer => layer.origin === 'previous_cleaner_answer_conflict'),
    ),
  );
  if (hasOrdinaryMustFix) return 'core_repair_needed';
  if (hasConflict) return 'system_revision_conflict';
  if (certificationPassed && thread.developmentTargets?.length) return 'development_needed';
  if (certificationPassed) return 'topic_complete';
  return thread.part1SessionPriorityState;
};

const part1ExportStateLabel = (state: ReturnType<typeof derivePart1ThreadExportState>) => {
  if (state === 'core_repair_needed') return '需要先修正核心语言';
  if (state === 'system_revision_conflict') return '系统 cleaner answer 需要修订';
  if (state === 'development_needed') return '需要补充一个真实细节';
  if (state === 'topic_complete') return '本话题已完成';
  return '未完成 / 旧记录';
};

const isLowValuePart1ExportPattern = (item: { observationZh: string; whyItMattersZh: string; retryRule: string }) => {
  const text = normalizePart1ExportComparableText(`${item.observationZh} ${item.whyItMattersZh} ${item.retryRule}`);
  const purePraise = /\b(accurate|direct|natural|clear|stable|good|strong|complete|sufficient|no major|no obvious|well answered)\b/.test(text) &&
    !/\b(need|needs|add|repair|fix|avoid|limit|thin|short|underdeveloped|error|mistake|grammar|range|specific|detail|reason|contrast)\b/.test(text);
  return purePraise;
};

const buildPart1TopicThreadMarkdown = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
  options: {
    hiddenPart1DevelopmentKeys?: string[];
    hiddenPart1ExpressionKeys?: string[];
    hiddenPart1MaterialKeys?: string[];
  } = {},
) => {
  const thread = feedback.threadFeedback;
  const answers = feedback.threadAnswers || [];
  const range = feedback.bandEstimateRange;
  const estimateText = range && Number.isFinite(range.lower) && Number.isFinite(range.upper)
    ? `${formatConservativeBandEstimate(range.lower)}-${formatConservativeBandEstimate(range.upper)}`
    : `${formatConservativeBandEstimate(feedback.bandEstimateExcludingPronunciation)} 左右`;
  const exportDisplay = buildPart1LearningDisplayModel(thread, { answers });
  const hiddenDevelopmentKeys = new Set(options.hiddenPart1DevelopmentKeys || []);
  const hiddenExpressionKeys = new Set(options.hiddenPart1ExpressionKeys || []);
  const hiddenMaterialKeys = new Set(options.hiddenPart1MaterialKeys || []);
  const exportReusableMaterial = exportDisplay.userMaterials.filter(item => !hiddenMaterialKeys.has(part1LearningItemKey(item)));
  const exportExpressions = exportDisplay.expressionBank.filter(item => !hiddenExpressionKeys.has(part1LearningItemKey(item)));
  const priorityState = derivePart1ThreadExportState(feedback);
  const threadStable = priorityState === 'topic_complete';
  const developmentTargets = consolidatePart1DevelopmentTargets(exportDisplay.answerCoaching);
  const developmentTargetByQuestion = new Map(developmentTargets.map(target => [target.questionRef, target] as const));
  const answerActionByQuestion = new Map(exportDisplay.answerActions.map(action => [action.questionRef, action] as const));

  const cleanRetryByQuestion = new Map((thread?.cleanRetryAnswers || []).map(item => [item.questionRef, item] as const));
  const shouldExportSessionReview = exportReusableMaterial.length || exportExpressions.length;
  const integrity = validatePart1ThreadFeedbackIntegrity(feedback, answers);
  const legacyCompletenessNote = integrity.ok
    ? ''
    : `\n> Stored result note: this topic-thread feedback is incomplete (${integrity.validCleanRetryCount}/${integrity.expectedCount} cleaner answers). Re-analyze the locked thread for a complete export.\n`;

  return `# IELTS Speaking Part 1｜${feedback.topic || thread?.topic || 'Topic Practice'} Topic Thread
${legacyCompletenessNote}

## Session Summary
- Questions completed: ${answers.length}
- Session priority: ${part1ExportStateLabel(priorityState)}
- Topic Practice Estimate: ${estimateText}
${priorityState === 'development_needed' ? '- 发展状态: 核心语言基本稳定，但还需要在重点题目补一个真实原因、细节、例子或对比。' : ''}
${threadStable ? '- 话题状态: 准确性和展开已经足够稳定，可以换新话题。' : ''}
${feedback.estimateRationaleZh ? `- 估计依据: ${feedback.estimateRationaleZh}` : ''}

# Part 1｜Annotated Answers
${answers.map((answer, index) => {
    const questionRef = `Q${index + 1}`;
    const annotations = thread?.annotations?.filter(item => item.questionRef === questionRef) || [];
    const cleanRetry = cleanRetryByQuestion.get(questionRef);
    const developmentTarget = developmentTargetByQuestion.get(questionRef);
    const answerAction = answerActionByQuestion.get(questionRef);
    const developmentChunks = [
      ...(developmentTarget?.phraseChunks || []),
      ...(answerAction?.examples || []),
    ]
      .filter(chunk => !hiddenDevelopmentKeys.has(part1DevelopmentChunkKey(questionRef, chunk)))
      .map(chunk => {
        const text = normalizePart1LearnerText(chunk.text);
        const purposeZh = normalizePart1LearnerText(chunk.purposeZh || '');
        return text ? (purposeZh ? `${purposeZh}: ${text}` : text) : '';
      })
      .filter(Boolean)
      .filter((chunk, chunkIndex, chunks) => chunks.indexOf(chunk) === chunkIndex)
      .slice(0, 12);
    const developedAnswer = cleanLearningText(developmentTarget?.optionalDevelopedAnswer);
    const suppressUnsafeCleaner = Boolean(cleanRetry && isPart1ExportCleanerEquivalent(answer.answer, cleanRetry.answer));
    const annotationLines = annotations.length
      ? annotations.map(item => [
        `- Source: "${item.sourceQuote}"`,
        item.combinedRepair && `  - Combined repair: ${item.combinedRepair}`,
        ...item.layers.map(layer => `  - ${part1AnnotationLayerLabel(layer)} / ${formatPart1IssueTypeLabel(layer.issueType)}: ${layer.original} -> ${layer.better}\n    - ${layer.explanationZh}${layer.origin === 'previous_cleaner_answer_conflict' ? `\n    - System revision note: This wording came from a previous cleaner answer and is corrected here for consistency; it is not counted as a new learner-introduced error.` : ''}${layer.reuseGuidanceZh ? `\n    - Reuse: ${layer.reuseGuidanceZh}` : ''}`),
      ].filter(Boolean).join('\n')).join('\n')
      : '';
    const cleanRetryBlock = cleanRetry && !suppressUnsafeCleaner
      ? `\n\n### A Cleaner Answer for Your Next Try\n${cleanRetry.answer}`
      : '';
    const developmentBlock = developedAnswer || developmentChunks.length
      ? `\n\n### Development${developedAnswer ? `\n- Developed answer to try: ${developedAnswer}` : ''}${developmentChunks.length ? `\n- 可用表达: ${developmentChunks.join(' / ')}` : ''}`
      : '';
    return `## ${questionRef}. ${answer.question}\n> Original answer: ${answer.answer}${annotationLines ? `\n\n### Annotations\n${annotationLines}` : ''}${cleanRetryBlock}${developmentBlock}`;
  }).join('\n\n')}

${shouldExportSessionReview ? `
# Topic-Thread Review｜Part 1 Material Development

${exportReusableMaterial.length ? `## 可积累素材
${exportReusableMaterial.map(part1MaterialItemLines).join('\n')}\n` : ''}

${exportExpressions.length ? `## 可积累表达
${exportExpressions.map(part1ExpressionItemLines).join('\n')}\n` : ''}
` : ''}

  _Exported: ${formatExportDate(timestamp)}_`;
};

const part3FeedbackModeExportLabel = (mode?: string) => {
  if (mode === 'language_repair') return 'Language repair';
  if (mode === 'part3_generalisation') return 'Part 3 generalisation';
  if (mode === 'answer_scope') return 'Answer scope';
  if (mode === 'precision_upgrade') return 'Precision upgrade';
  if (mode === 'compression_upgrade') return 'Compression upgrade';
  if (mode === 'nuance_upgrade') return 'Nuance upgrade';
  if (mode === 'micro_upgrade') return 'Micro-upgrade';
  return 'Reasoning upgrade';
};

const splitPart3SpokenSentences = (text = '') =>
  (text.replace(/\s+/g, ' ').trim().match(/[^.!?。！？]+[.!?。！？]?/g) || [])
    .map(sentence => sentence.trim())
    .filter(Boolean);

const part3TryThisWordCount = (text: string) =>
  text.trim().split(/\s+/).filter(Boolean).length;

const isWeakPart3TryThisLine = (line = '') => {
  const cleaned = line.replace(/\s+/g, ' ').trim();
  if (!cleaned || /[\u3400-\u9fff]/.test(cleaned)) return true;
  if (/[\[\]{}]/.test(cleaned)) return true;
  const words = part3TryThisWordCount(cleaned);
  const lower = cleaned.toLowerCase();
  if (words < 7) return true;
  if (/^(in my opinion|overall|to sum up|all in all|i'd say|i would say|yes|no|not really|it depends)\b/.test(lower) && words < 14) return true;
  if (/\b(wide variety|different kinds|many things|several reasons|depends on the situation)\b/.test(lower) &&
    !/\b(such as|including|like|because|while|whereas|rather than|instead of|not .* but|for example|for instance|which means|as a result)\b/.test(lower)) {
    return true;
  }
  return false;
};

const hasPart3GroupSubject = (line: string) =>
  /\b(people|families|workers|students|children|parents|older people|young people|readers|audiences|society|government|some people|others|those who|busy adults|modern life|modern families)\b/i.test(line);

const isFirstPersonCenteredPart3Line = (line: string) =>
  /\b(for me|personally|in my opinion|my family|my view|i think|i feel|i can|i usually|i personally)\b/i.test(line);

const hasPart3CategoryContent = (line: string) => {
  const lower = line.toLowerCase();
  if (/\b(such as|including|like|a mix of|types of|categories|genre|genres|classic|online|self-help|fiction|non-fiction)\b/.test(lower)) return true;
  return /,\s*[^,]+,\s*(and|or)\s+/.test(line);
};

const part3TryThisMatchesIssue = (sentence: string, item: Part3AnswerFeedback) => {
  if (isWeakPart3TryThisLine(sentence)) return false;
  if (item.feedbackMode === 'part3_generalisation') {
    return hasPart3GroupSubject(sentence) && !isFirstPersonCenteredPart3Line(sentence);
  }
  if (item.feedbackMode === 'answer_scope' || item.questionFrame === 'category_criteria') {
    return hasPart3CategoryContent(sentence);
  }
  return true;
};

const part3TryThisSentenceScore = (sentence: string) => {
  if (isWeakPart3TryThisLine(sentence)) return -100;
  const lower = sentence.toLowerCase();
  let score = Math.min(part3TryThisWordCount(sentence), 32);
  if (/\b(such as|including|like|for example|for instance)\b/.test(lower)) score += 16;
  if (/\b(because|since|while|whereas|rather than|instead of|not .* but|which means|as a result|so that)\b/.test(lower)) score += 14;
  if (/\b(people|families|workers|students|children|parents|older people|young people|readers|audiences|society|government)\b/.test(lower)) score += 8;
  if (/,/.test(sentence)) score += 3;
  if (/^(in my opinion|overall|to sum up|all in all|i'd say|i would say)\b/.test(lower)) score -= 10;
  return score;
};

const part3TryThisLine = (item: Part3AnswerFeedback) => {
  const upgradedLine = cleanLearningText(item.microUpgrade?.upgradedLine);
  if (upgradedLine && part3TryThisMatchesIssue(upgradedLine, item)) return upgradedLine;
  const candidates = splitPart3SpokenSentences(cleanLearningText(item.targetAnswer));
  const best = candidates
    .filter(sentence => part3TryThisMatchesIssue(sentence, item))
    .map(sentence => ({ sentence, score: part3TryThisSentenceScore(sentence) }))
    .sort((a, b) => b.score - a.score)[0];
  if (best && best.score > 0) return best.sentence;
  return candidates.find(sentence => part3TryThisMatchesIssue(sentence, item)) || '';
};

const part3ReusableFrameGuidance = (frame?: Part3AnswerFeedback['questionFrame']) => {
  if (frame === 'category_criteria') return '替换方法：把 A/B/C 换成具体类别，再补选择原因。';
  if (frame === 'solution_suggestion') return '替换方法：把 A/B 换成两个改进方向，C 换成具体动作。';
  if (frame === 'comparison_contrast') return '替换方法：把 A/B 换成两类人、两个时代或两种场景。';
  if (frame === 'cause_reason') return '替换方法：把 A 换成表层原因，B 换成更深层原因。';
  if (frame === 'change_trend') return '替换方法：把 A/B 换成变化前后，再补原因。';
  if (frame === 'advantages_disadvantages') return '替换方法：把 A 换成适用场景，B 换成风险或边界。';
  if (frame === 'consequence_impact') return '替换方法：把 A 换成短期影响，B 换成长期结果。';
  return '替换方法：把 X 换成题目对象，再用两类人或两种情况对照。';
};

const part3ReusableFrameFallback = (frame?: Part3AnswerFeedback['questionFrame']) => {
  if (frame === 'category_criteria') return 'People tend to choose a mix of A, B and C, depending on their interests and lifestyle.';
  if (frame === 'solution_suggestion') return 'X could improve both A and B, for example by doing C.';
  if (frame === 'comparison_contrast') return 'A may..., because..., whereas B often...';
  if (frame === 'cause_reason') return 'One reason is A, but there is also a deeper reason: B.';
  if (frame === 'change_trend') return 'The biggest change is that A has become B, mainly because...';
  if (frame === 'advantages_disadvantages') return 'It can be useful when A, but it becomes a problem if B.';
  if (frame === 'consequence_impact') return 'This can lead to A in the short term, and B in the long run.';
  return 'For some people, X can be difficult because..., but for others, it can be worthwhile because...';
};

const isBackendStylePart3Frame = (frame = '') =>
  /[\[\]{}]/.test(frame) || /\bplaceholder\b/i.test(frame);

const part3ReusableFrameLine = (item: Part3AnswerFeedback) => {
  const providerFrame = cleanLearningText(item.thinkingDiagnosis?.reusableFrame);
  return providerFrame && !isBackendStylePart3Frame(providerFrame)
    ? providerFrame
    : part3ReusableFrameFallback(item.questionFrame);
};

const part3LanguageExportItem = (item: unknown) => {
  const record = item && typeof item === 'object' ? item as Record<string, unknown> : null;
  const expressionSource = typeof item === 'string'
    ? item
    : typeof record?.expression === 'string'
      ? record.expression
      : typeof record?.phrase === 'string'
        ? record.phrase
        : typeof record?.term === 'string'
          ? record.term
          : '';
  const expression = cleanLearningText(expressionSource);
  if (!expression) return null;
  const meaningSource = typeof record?.meaningZh === 'string'
    ? record.meaningZh
    : typeof record?.meaning === 'string'
      ? record.meaning
      : typeof record?.translationZh === 'string'
        ? record.translationZh
        : '';
  return {
    expression,
    meaningZh: cleanLearningText(meaningSource),
  };
};

const buildPart3DiscussionMarkdown = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
) => {
  const part3 = feedback.part3Feedback;
  const answers = part3?.answers || [];
  const shortTopic = limitWords(part3?.topic || feedback.topic || feedback.question || 'Part 3 Discussion', 10);
  const range = feedback.bandEstimateRange;
  const estimateText = range && Number.isFinite(range.lower) && Number.isFinite(range.upper)
    ? `${formatConservativeBandEstimate(range.lower)}-${formatConservativeBandEstimate(range.upper)}`
    : `${formatConservativeBandEstimate(feedback.bandEstimateExcludingPronunciation)} 左右`;
  const thinkingBlocks = answers.map(item => {
    const diagnosis = item.thinkingDiagnosis;
    const tryLine = part3TryThisLine(item);
    const upgradeRule = diagnosis?.upgradeRuleZh ||
      [diagnosis?.mainCeilingZh || item.ctChain.missingLinkZh, diagnosis?.bestNextMoveZh || item.ctChain.nextMoveZh]
        .filter(Boolean)
        .join(' ');
    const reusableFrame = part3ReusableFrameLine(item);
    return cleanLines([
      `### ${item.questionRef}. ${cleanLearningText(item.question)}`,
      `- Mode: ${part3FeedbackModeExportLabel(item.feedbackMode)}`,
      `- 这题怎么想: ${cleanLearningText(diagnosis?.questionThinkingZh || item.questionFrameGuidanceZh)}`,
      (diagnosis?.retainedIdeaZh || diagnosis?.whatWorksZh) && `- 保留你的思路: ${cleanLearningText(diagnosis?.retainedIdeaZh || diagnosis?.whatWorksZh)}`,
      upgradeRule && `- 升级规则: ${cleanLearningText(upgradeRule)}`,
      reusableFrame && `- 可迁移句型: ${cleanLearningText(diagnosis?.reusableFrameZh || part3ReusableFrameGuidance(item.questionFrame))}\n  ${cleanLearningText(reusableFrame)}`,
      tryLine && `- 试着这样说: ${tryLine}`,
    ]).join('\n');
  }).join('\n\n');
  const language = (part3?.topicLanguage || []).length
    ? (part3?.topicLanguage || []).slice(0, 3).map(section => {
      const items = Array.isArray(section.items) ? section.items : [];
      return cleanLines([
        `### ${cleanLearningText(section.title)}`,
        section.noteZh && cleanLearningText(section.noteZh),
        items.slice(0, 6)
          .map(part3LanguageExportItem)
          .filter((item): item is { expression: string; meaningZh: string } => Boolean(item))
          .map(item => `- ${item.expression}${item.meaningZh ? `：${item.meaningZh}` : ''}`)
          .join('\n'),
      ]).join('\n');
    }).join('\n\n')
    : '- 暂无稳定的题组专属表达。';
  const nextAnswers = answers
    .filter(item => item.targetAnswer.trim())
    .map(item => cleanLines([
      `### ${item.questionRef}. ${cleanLearningText(item.question)}`,
      cleanLearningText(item.targetAnswer),
    ]).join('\n\n'))
    .join('\n\n');

  return `# IELTS Speaking Part 3｜${shortTopic}

## 1. 题组估计
- Ideal-delivery estimate：${estimateText}

## 2. Topic-bound Language
${language}

## 3. Thinking Diagnosis
${part3?.sessionPriorityZh ? `${cleanLearningText(part3.sessionPriorityZh)}\n\n` : ''}${thinkingBlocks || '- 本次没有稳定的 Part 3 thinking diagnosis。'}

## 4. Three Next Speakable Answers
${nextAnswers || '- 本次没有可靠的 next speakable answer。'}

_Exported: ${formatExportDate(timestamp)}_`;
};

export const buildSpeakingTrainingMarkdown = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
  options: {
    hiddenPart1DevelopmentKeys?: string[];
    hiddenPart1ExpressionKeys?: string[];
    hiddenPart1MaterialKeys?: string[];
  } = {},
) => {
  if (feedback.sessionKind === 'part1_topic_thread' && feedback.threadFeedback) {
    return buildPart1TopicThreadMarkdown(feedback, timestamp, options);
  }
  if (feedback.sessionKind === 'part3_discussion_thread' && feedback.part3Feedback) {
    return buildPart3DiscussionMarkdown(feedback, timestamp);
  }

  const shortQuestion = limitWords(feedback.question, 9);
  const path = reviewCardAnswerPath(feedback).map(cleanLearningText).filter(Boolean);
  const rows = reviewCardRows(feedback)
    .map(item => `| ${item.original} | ${item.correction} | ${item.note} |`)
    .join('\n');
  const range = feedback.bandEstimateRange;
  const estimateText = range && Number.isFinite(range.lower) && Number.isFinite(range.upper)
    ? `${formatConservativeBandEstimate(range.lower)}-${formatConservativeBandEstimate(range.upper)}`
    : `${formatConservativeBandEstimate(feedback.bandEstimateExcludingPronunciation)} 左右`;
  const estimateLine = `- Ideal-delivery estimate：${estimateText}`;
  const estimateNotes = cleanLines([
    feedback.scoreConsistencyNoteZh && `- Score consistency: ${feedback.scoreConsistencyNoteZh}`,
    range?.rationaleZh && `- Boundary rationale: ${range.rationaleZh}`,
    feedback.estimateRationaleZh && `- Estimate rationale: ${feedback.estimateRationaleZh}`,
  ]).join('\n');
  const estimateNotesWithCeiling = estimateNotes;
  const transferTitle = feedback.part === 1
    ? '## 6. 可能追问｜Possible follow-ups'
    : '## 6. 可迁移题目';
  const fillerNote = hasSpeakingFillerIssue(feedback)
    ? '\n\n> Filler Control：减少重复的 well / honestly / you know / like / um，用短暂停顿代替拖音。'
    : '';

  return `# IELTS Speaking Part ${feedback.part}｜${shortQuestion}

## 1. 本题要求
${estimateLine}
${estimateNotesWithCeiling}
${reviewCardRequirements(feedback).map(item => `- ${item}`).join('\n')}${fillerNote}

## 2. 回答路线
${path.map((item, index) => `${index + 1}. ${item}`).join('\n')}

${reviewCardPart2StoryPackage(feedback)}

## 3. 问题清单
| 原表达 | 修改 | 说明 |
|---|---|---|
${rows}

${reviewCardTargetHeading(feedback)}
${reviewCardTargetBody(feedback)}

## 5. 可复用表达
${reviewCardExpressions(feedback)}

## 6. 个人素材与观点发散｜Personal Material & Idea Expansion
${reviewCardIdeaExpansion(feedback)}

${transferTitle.replace('## 6.', '## 7.')}
${numberedList(reviewCardTransferQuestions(feedback), 'Try another IELTS-style question with the same answer route.', 3)}

_Exported: ${formatExportDate(timestamp)}_`;
};

const averageWritingScore = (scores: WritingFeedback['scores']) =>
  (scores.taskResponse + scores.coherenceCohesion + scores.lexicalResource + scores.grammaticalRangeAccuracy) / 4;

const conciseAction = (text?: string, maxWords = 28) => {
  const cleaned = (splitSentences(text || '')[0] || text || '').replace(/\s+/g, ' ').trim();
  return cleaned ? limitWords(cleaned, maxWords) : '';
};

const prioritizedLogic = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  [...feedback.frameworkFeedback]
    .sort((a, b) => {
      const priority = (item: WritingFeedback['frameworkFeedback'][number]) => {
        const source = `${item.issue} ${item.issueType || ''} ${item.suggestionZh}`.toLowerCase();
        if (/task response|task command|outweigh|opposing|concession|irrelevant|thesis/.test(source)) return 1;
        if (/paragraph|logic|coherence|structure/.test(source)) return 2;
        if (/example|support|develop/.test(source)) return 3;
        return 4;
      };
      return priority(a) - priority(b);
    })
    .slice(0, 3);

const prioritizedSentences = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  [...feedback.sentenceFeedback]
    .sort((a, b) => {
      const priority = (item: WritingFeedback['sentenceFeedback'][number]) => {
        if (item.dimension === 'TR' || item.dimension === 'CC') return 1;
        if (item.dimension === 'LR') return 2;
        if (item.severity === 'major' || item.severity === 'medium') return 3;
        return 4;
      };
      return priority(a) - priority(b);
    })
    .slice(0, 5);

const task2RevisionFocus = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  cleanLines([
    feedback.essayLevelWarnings[0]?.messageZh && `补足篇幅：${conciseAction(feedback.essayLevelWarnings[0].messageZh, 16)}`,
    prioritizedLogic(feedback)[0]?.paragraphFixZh && `先改结构：${conciseAction(prioritizedLogic(feedback)[0].paragraphFixZh, 16)}`,
    prioritizedSentences(feedback)[0]?.transferGuidanceZh && `再改句子：${conciseAction(prioritizedSentences(feedback)[0].transferGuidanceZh, 14)}`,
  ]).slice(0, 3);

const task2Checklist = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  cleanLines([
    prioritizedLogic(feedback)[0]?.paragraphFixZh && `结构：${conciseAction(prioritizedLogic(feedback)[0].paragraphFixZh, 14)}`,
    prioritizedSentences(feedback)[0]?.transferGuidanceZh && `句子：${conciseAction(prioritizedSentences(feedback)[0].transferGuidanceZh, 14)}`,
    feedback.vocabularyUpgrade.expressionUpgrades[0]?.better
      && phraseChunk(feedback.vocabularyUpgrade.expressionUpgrades[0].better, 8)
      && `表达：主动使用 ${phraseChunk(feedback.vocabularyUpgrade.expressionUpgrades[0].better, 8)}`,
    '检查是否回应题型关键词。',
    '每个主体段保留一个清楚例子。',
  ]).slice(0, 5);

const phraseLevelUpgrade = (item: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number]) => ({
  original: item.original ? phraseChunk(item.original, 7) : '',
  better: phraseChunk(item.better, 9),
  note: conciseAction(item.explanationZh || item.reuseWhenZh, 18),
});

export const buildWritingTask2TrainingMarkdown = (
  feedback: Omit<WritingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
) => {
  const estimate = averageWritingScore(feedback.scores);
  const logicItems = prioritizedLogic(feedback);
  const sentenceItems = prioritizedSentences(feedback);
  const topicVocabulary = feedback.vocabularyUpgrade.topicVocabulary.slice(0, 5);
  const fromEssay = feedback.vocabularyUpgrade.expressionUpgrades
    .filter(item => item.original || item.category === 'from_essay')
    .map(phraseLevelUpgrade)
    .filter(item => item.better)
    .filter(item => countWords(item.better) <= 9)
    .slice(0, 3);
  const frames = feedback.vocabularyUpgrade.expressionUpgrades
    .filter(item => !item.original || item.category === 'argument_frame')
    .map(phraseLevelUpgrade)
    .filter(item => item.better)
    .filter(item => countWords(item.better) <= 14)
    .slice(0, 3);
  const annotations = feedback.modelAnswerAnnotations?.length
    ? `\n\n### 范文标注｜Key Labels\n${feedback.modelAnswerAnnotations.slice(0, 5).map(item => `- ${phraseChunk(item.quote, 8)}: ${item.labelZh}`).join('\n')}`
    : '';
  const targetLayerLabel = isHighBandWritingStable(feedback)
    ? '高分稳定检查'
    : hasUnstableWritingTarget(feedback)
      ? '目标范文待加强'
      : feedback.targetAnswerStatus !== 'meets_target'
        ? '目标范文尚未完成校验'
        : feedback.targetLayer || feedback.modelAnswerTargetLevel || getTargetLabel(estimate, 'modelAnswer');
  const targetStatusNote = cleanLines([
    hasUnstableWritingTarget(feedback) && '这版目标答案还没有稳定达到目标层级，需要进一步强化逻辑或表达。',
    isHighBandWritingStable(feedback) && (feedback.nextStepZh || '目标层级已达到。下一步重点是限时稳定、复盘表达和迁移到新题。'),
    feedback.targetAnswerRepairFocusZh || feedback.highBandStabilityZh || feedback.targetAnswerRationaleZh,
  ]).join('\n');
  const shouldExportModelAnswer = feedback.targetAnswerStatus === 'meets_target' &&
    !isHighBandWritingStable(feedback) &&
    !hasUnstableWritingTarget(feedback) &&
    Boolean(feedback.modelAnswer.trim());

  return `# IELTS Writing Task 2 训练笔记 - ${topicKeywords(feedback.question, undefined, 4).replace(/-/g, ' ')} - ${formatExportDate(timestamp)}

## 0. 本次先改什么｜Revision Focus
${numberedList(task2RevisionFocus(feedback), '先确认题目任务、中心立场、每段功能和一个具体例子。', 3)}

## 1. 题目｜Prompt
${feedback.question}

## 2. 我的原文｜My Essay
${feedback.essay}

## 3. 分数快照｜Training Estimate
- 任务回应｜Task Response: ${formatConservativeBandEstimate(feedback.scores.taskResponse)}
- 连贯与衔接｜Coherence & Cohesion: ${formatConservativeBandEstimate(feedback.scores.coherenceCohesion)}
- 词汇资源｜Lexical Resource: ${formatConservativeBandEstimate(feedback.scores.lexicalResource)}
- 语法多样性与准确性｜Grammatical Range & Accuracy: ${formatConservativeBandEstimate(feedback.scores.grammaticalRangeAccuracy)}
- 综合训练估计｜Overall training estimate: ${formatConservativeBandEstimate(estimate)}
- 目标层级｜Target layer: ${targetLayerLabel} / ${isHighBandWritingStable(feedback) ? '高分稳定检查' : getTargetLabelZh(estimate, 'modelAnswer')}
${feedback.scoreConsistencyNoteZh ? `- 分数一致性｜Score consistency: ${feedback.scoreConsistencyNoteZh}` : ''}
${feedback.targetUpgradeFocusZh ? `- 范文修复重点｜Target focus: ${feedback.targetUpgradeFocusZh}` : ''}
${feedback.targetValidationZh ? `- 目标校验｜Target validation: ${feedback.targetValidationZh}` : ''}
${targetStatusNote ? `- 目标状态｜Target status: ${targetStatusNote}` : ''}

## 4. 任务回应与结构诊断｜TR / Logic Review
${logicItems.length ? logicItems.map((item, index) => `### ${index + 1}. ${item.issue}
- 问题: ${conciseAction(item.suggestionZh || item.issue, 18)}
- 为什么影响分数: ${conciseAction(item.transferGuidanceZh || item.suggestionZh, 18)}
- 这次怎么改: ${conciseAction(item.paragraphFixZh || item.transferGuidanceZh, 18) || '先明确这个段落的功能，再补足支撑。'}${item.exampleFrame ? `\n- 可复用句: ${phraseChunk(item.exampleFrame, 14)}` : ''}`).join('\n\n') : '- 这次没有稳定的结构诊断；下一篇先检查立场、分段和例子是否完整。'}

## 5. 关键句子修改｜Key Sentence Corrections
${sentenceItems.length ? sentenceItems.map((item, index) => `### ${index + 1}. ${item.primaryIssue || item.tag}
- Original: ${item.original}
- Better: ${item.correction}
- 中文说明: ${conciseAction(item.explanationZh, 26)}${item.microUpgrades?.[0] ? `\n- 可复用短语: ${phraseChunk(item.microUpgrades[0].better, 8)}` : ''}`).join('\n\n') : '- 这次没有稳定的句子级修改；下一篇先保证每句语法完整、指代清楚。'}

## 6. 词汇与表达积累｜Language Bank
### Topic Vocabulary
${topicVocabulary.length ? topicVocabulary.map(item => `- ${item.expression}`).join('\n') : '- 从题目关键词提炼 3-5 个主题表达。'}

### From My Essay
${fromEssay.length ? fromEssay.map(item => `- ${item.original ? `${item.original} -> ` : ''}${item.better}${item.note ? `\n  - ${item.note}` : ''}`).join('\n') : '- 暂无稳定的原文短语升级。'}

### Argument Frames
${frames.length ? frames.map(item => `- ${item.better}${item.note ? `\n  - ${item.note}` : ''}`).join('\n') : '- While [drawback] is a valid concern, it does not outweigh [main benefit].'}

## 7. ${targetLayerLabel}｜${isHighBandWritingStable(feedback) ? '高分稳定检查' : getTargetLabelZh(estimate, 'modelAnswer')}
${shouldExportModelAnswer ? `${feedback.modelAnswer}${annotations}` : isHighBandWritingStable(feedback) ? cleanLearningText(feedback.modelAnswer) || feedback.essay : '目标范文未通过或尚未完成独立校验，暂不作为成功目标展示。'}

## 8. 下次写作前检查｜Next Attempt Checklist
${bulletList(task2Checklist(feedback), '先确认题目任务、中心立场、每段功能和一个具体例子，再开始写。', 5)}`;
};

const task1RevisionFocus = (feedback: Omit<WritingTask1Feedback, 'obsidianMarkdown'>) =>
  cleanLines([
    feedback.mustFix[0],
    feedback.overviewFeedback && `Overview: ${conciseAction(feedback.overviewFeedback, 18)}`,
    feedback.keyFeaturesFeedback && `Key features: ${conciseAction(feedback.keyFeaturesFeedback, 18)}`,
  ]).slice(0, 3);

export const buildWritingTask1TrainingMarkdown = (
  feedback: Omit<WritingTask1Feedback, 'obsidianMarkdown'>,
  prompt?: WritingTask1AcademicPrompt,
  quickPlan?: WritingTask1QuickPlan,
  timestamp?: string | Date,
) => {
  const task1TargetState = feedback.targetState || resolveTask1TargetState(feedback);
  const task1TargetHeading = task1TargetState === 'high_band_stable'
    ? 'EXAMINER-FRIENDLY VERSION'
    : task1TargetState === 'needs_repair' || task1TargetState === 'target_failed_or_borderline'
      ? 'OPTIMIZED REPORT HIDDEN'
      : 'OPTIMIZED REPORT';
  const planItems = cleanLines([
    quickPlan?.overview && `Overview: ${quickPlan.overview}`,
    quickPlan?.keyFeatures && `Key features: ${quickPlan.keyFeatures}`,
    quickPlan?.comparisons && `Comparisons: ${quickPlan.comparisons}`,
    quickPlan?.paragraphPlan && `Paragraph plan: ${quickPlan.paragraphPlan}`,
  ]).slice(0, 4);
  const languageCorrections = feedback.languageCorrections.slice(0, 5);

  return `# IELTS Writing Task 1 训练笔记 - ${topicKeywords(feedback.instruction, feedback.taskType || prompt?.topic, 4).replace(/-/g, ' ')} - ${formatExportDate(timestamp)}

## 0. 本次先改什么｜Revision Focus
${numberedList(task1RevisionFocus(feedback), '先写清楚 overview，再选择最重要的数据和比较关系。', 3)}

## 1. 题目｜Prompt
${feedback.instruction}

## 2. 我的报告｜My Report
${feedback.report}

## 3. 分数快照｜Training Estimate
- 任务完成度｜Task Achievement: ${formatConservativeBandEstimate(feedback.taskAchievement?.score ?? feedback.estimatedBand)}
- 综合训练估计｜Overall training estimate: ${formatConservativeBandEstimate(feedback.estimatedBand)}
- 目标层级｜Target layer: ${task1TargetHeading} / ${task1TargetState === 'generated_target' ? 'generated, not independently validated' : getTargetLabelZh(feedback.estimatedBand, 'report')}

## 4. Overview 与关键信息｜Overview / Key Features
- Overview: ${conciseAction(feedback.overviewFeedback, 28)}
- Key features: ${conciseAction(feedback.keyFeaturesFeedback, 28)}

## 5. 数据与比较｜Data Accuracy / Comparisons
- Comparisons: ${conciseAction(feedback.comparisonFeedback, 24)}
- Data accuracy: ${conciseAction(feedback.dataAccuracyFeedback, 24)}
- Coherence: ${conciseAction(feedback.coherenceFeedback, 24)}

## 6. 语言修改｜Language Corrections
${languageCorrections.length ? languageCorrections.map(item => `- Original: ${item.original}\n  - Better: ${item.correction}\n  - 中文说明: ${conciseAction(item.explanation, 20)}`).join('\n') : '- 暂无稳定语言修改；先检查 overview、比较句和数据表达。'}

## 7. ${task1TargetHeading}
${feedback.improvedReport || feedback.modelExcerpt || 'No improved report returned.'}

## 8. 下次写作前检查｜Next Attempt Checklist
${bulletList(cleanLines([
  ...feedback.mustFix.slice(0, 2),
  feedback.rewriteTask,
  ...feedback.reusableReportPatterns.slice(0, 2),
  ...planItems,
]), '先写 overview，再按趋势、类别、阶段或大小分组主体段，并核对所有数据。', 5)}`;
};
