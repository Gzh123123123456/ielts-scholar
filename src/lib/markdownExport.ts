import { formatBandEstimate } from './bands';
import type { SpeakingFeedback, WritingFeedback, WritingTask1Feedback } from './ai/schemas';
import type { WritingTask1AcademicPrompt } from '../data/questions/bank';
import type { WritingTask1QuickPlan } from './practiceRecords';

type ExportModule = 'speaking' | 'writing';
type ExportTaskOrPart = 'p1' | 'p2' | 'p3' | 'task1' | 'task2';

interface MarkdownFilenameInput {
  module: ExportModule;
  taskOrPart: ExportTaskOrPart;
  topic?: string;
  prompt?: string;
  timestamp?: string | Date;
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
  /provider output was malformed or incomplete|please retry analysis after checking the debug panel|provider_safety|raw parse|validation failure|parse_or_schema|incomplete feedback|debug panel/i;

const cleanLearningText = (value?: string | null) => {
  const cleaned = (value || '').replace(/\s+/g, ' ').trim();
  return cleaned && !BLOCKED_LEARNING_CONTENT.test(cleaned) ? cleaned : '';
};

const cleanLearningLines = (items: Array<string | undefined | null>) =>
  cleanLines(items.map(cleanLearningText)).filter(Boolean);

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
}: MarkdownFilenameInput) => {
  const { date, time } = formatDateTimeStamp(timestamp);
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
const META_INSTRUCTION_PATTERN = /^(?:add|include|mention|explain|describe|use|integrate|avoid|try to|make sure|expand|replace|rewrite|give)\b/i;

const cleanReusablePhrase = (value?: string, maxWords = 8) => {
  const cleaned = cleanLearningText(value)
    .replace(/^[\s\-*•\d.]+/, '')
    .replace(/["`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!?]+$/g, '');
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length > maxWords) return '';
  if (/[,;:]/.test(cleaned)) return '';
  if (META_INSTRUCTION_PATTERN.test(cleaned)) return '';
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
    ...feedback.band9Refinements.map(item => ({ priority: 3, category: '高分打磨', issue: item.observation, fix: item.refinement })),
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
  if (isSpeakingInsufficient(feedback)) {
    return [{
      original: '回答展开不足',
      correction: feedback.part === 1 ? '补 direct answer + detail + reason' : '先说完整路线，再补细节和影响',
      type: '展开',
    }];
  }

  const rows = [
    ...feedback.fatalErrors.map(item => ({
      priority: 1,
      original: item.original,
      correction: item.correction,
      type: item.tag || '错误',
    })),
    ...feedback.naturalnessHints.map(item => ({
      priority: 2,
      original: item.original,
      correction: item.better,
      type: item.tag || '自然度',
    })),
    ...feedback.band9Refinements.map(item => ({
      priority: 3,
      original: item.observation,
      correction: item.refinement,
      type: '高分打磨',
    })),
  ]
    .map(item => ({
      ...item,
      original: escapeTableCell(item.original),
      correction: escapeTableCell(item.correction),
      type: escapeTableCell(item.type),
    }))
    .filter(item => item.original && item.correction && item.type)
    .sort((a, b) => a.priority - b.priority);

  return rows.length ? rows : [{
    original: '回答可以更具体',
    correction: feedback.part === 1 ? '补一个真实个人细节' : feedback.part === 2 ? '补具体场景和感受变化' : '补 cause / example / so what',
    type: '展开',
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
  if (isSpeakingInsufficient(feedback) && isMeaningfulShortAnswer(feedback)) return '## 4. 起步目标答案';
  if (isSpeakingInsufficient(feedback)) return '## 4. 请先重录一个完整答案';
  return '## 4. 目标答案';
};

const reviewCardTargetBody = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  if (isSpeakingInsufficient(feedback) && isMeaningfulShortAnswer(feedback)) {
    return `${starterTargetAnswer(feedback)}\n\n请把方括号里的内容替换成你的真实细节。`;
  }
  if (isSpeakingInsufficient(feedback)) {
    return '当前录音/转写不足以生成可靠目标答案。请先重录一个可理解的完整答案。';
  }
  return cleanLearningText(feedback.upgradedAnswer) || '请先重录一个完整答案。';
};

const speakingExpressionMeaning = (expression: string) => {
  const normalized = expression.toLowerCase();
  if (normalized === 'residential districts') return '住宅区';
  if (normalized === 'green spaces') return '城市绿地';
  if (normalized === 'public transport has improved') return '公共交通改善';
  if (normalized === 'more efficient and liveable') return '更高效、更宜居';
  if (normalized === 'my day feels balanced') return '一天的节奏很平衡';
  if (normalized === 'work-life balance') return '工作与生活平衡';
  return '';
};

const reviewCardExpressions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const expressions = unique(cleanLearningLines([
    ...feedback.naturalnessHints.map(item => cleanReusablePhrase(item.better)),
    ...feedback.band9Refinements.map(item => cleanReusablePhrase(item.refinement)),
    feedback.reusableExample && cleanReusablePhrase(feedback.reusableExample.example),
  ])).slice(0, 5);
  return expressions.length
    ? expressions.map(item => {
        const meaning = speakingExpressionMeaning(item);
        return `- ${meaning ? `${item}：${meaning}` : item}`;
      }).join('\n')
    : '- 暂无稳定可复用表达。';
};

export const buildSpeakingTrainingMarkdown = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
) => {
  const shortQuestion = limitWords(feedback.question, 9);
  const path = reviewCardAnswerPath(feedback).map(cleanLearningText).filter(Boolean);
  const rows = reviewCardRows(feedback)
    .map(item => `| ${item.original} | ${item.correction} | ${item.type} |`)
    .join('\n');
  const transferTitle = feedback.part === 1
    ? '## 6. 可能追问｜Possible follow-ups'
    : '## 6. 可迁移题目';
  const fillerNote = hasSpeakingFillerIssue(feedback)
    ? '\n\n> Filler Control：减少重复的 well / honestly / you know / like / um，用短暂停顿代替拖音。'
    : '';

  return `# IELTS Speaking Part ${feedback.part}｜${shortQuestion}

## 1. 本题要求
${reviewCardRequirements(feedback).map(item => `- ${item}`).join('\n')}${fillerNote}

## 2. 回答路线
${path.map((item, index) => `${index + 1}. ${item}`).join('\n')}

## 3. 问题清单
| 原表达 | 修改 | 类型 |
|---|---|---|
${rows}

${reviewCardTargetHeading(feedback)}
${reviewCardTargetBody(feedback)}

## 5. 可复用表达
${reviewCardExpressions(feedback)}

${transferTitle}
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

  return `# IELTS Writing Task 2 训练笔记 - ${topicKeywords(feedback.question, undefined, 4).replace(/-/g, ' ')} - ${formatExportDate(timestamp)}

## 0. 本次先改什么｜Revision Focus
${numberedList(task2RevisionFocus(feedback), '先确认题目任务、中心立场、每段功能和一个具体例子。', 3)}

## 1. 题目｜Prompt
${feedback.question}

## 2. 我的原文｜My Essay
${feedback.essay}

## 3. 分数快照｜Training Estimate
- 任务回应｜Task Response: ${formatBandEstimate(feedback.scores.taskResponse)}
- 连贯与衔接｜Coherence & Cohesion: ${formatBandEstimate(feedback.scores.coherenceCohesion)}
- 词汇资源｜Lexical Resource: ${formatBandEstimate(feedback.scores.lexicalResource)}
- 语法多样性与准确性｜Grammatical Range & Accuracy: ${formatBandEstimate(feedback.scores.grammaticalRangeAccuracy)}
- 综合训练估计｜Overall training estimate: ${formatBandEstimate(estimate)}

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

## 7. 目标范文｜Target Model Answer
${feedback.modelAnswer || 'No reliable target model answer for this attempt.'}${annotations}

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
- 任务完成度｜Task Achievement: ${formatBandEstimate(feedback.taskAchievement?.score ?? feedback.estimatedBand)}
- 综合训练估计｜Overall training estimate: ${formatBandEstimate(feedback.estimatedBand)}

## 4. Overview 与关键信息｜Overview / Key Features
- Overview: ${conciseAction(feedback.overviewFeedback, 28)}
- Key features: ${conciseAction(feedback.keyFeaturesFeedback, 28)}

## 5. 数据与比较｜Data Accuracy / Comparisons
- Comparisons: ${conciseAction(feedback.comparisonFeedback, 24)}
- Data accuracy: ${conciseAction(feedback.dataAccuracyFeedback, 24)}
- Coherence: ${conciseAction(feedback.coherenceFeedback, 24)}

## 6. 语言修改｜Language Corrections
${languageCorrections.length ? languageCorrections.map(item => `- Original: ${item.original}\n  - Better: ${item.correction}\n  - 中文说明: ${conciseAction(item.explanation, 20)}`).join('\n') : '- 暂无稳定语言修改；先检查 overview、比较句和数据表达。'}

## 7. 优化范文｜Improved Report
${feedback.improvedReport || feedback.modelExcerpt || 'No improved report returned.'}

## 8. 下次写作前检查｜Next Attempt Checklist
${bulletList(cleanLines([
  ...feedback.mustFix.slice(0, 2),
  feedback.rewriteTask,
  ...feedback.reusableReportPatterns.slice(0, 2),
  ...planItems,
]), '先写 overview，再按趋势、类别、阶段或大小分组主体段，并核对所有数据。', 5)}`;
};
