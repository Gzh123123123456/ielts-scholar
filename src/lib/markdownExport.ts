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
  const cleaned = (value || '')
    .replace(/["`]/g, '')
    .replace(/[.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  const words = cleaned.split(/\s+/);
  if (words.length > maxWords || /[,;:]/.test(cleaned)) return limitWords(cleaned, maxWords);
  return cleaned;
};

const speakingActiveExpressions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) =>
  unique(cleanLines([
    ...feedback.naturalnessHints.map(item => phraseChunk(item.better)),
    ...feedback.band9Refinements.map(item => phraseChunk(item.refinement)),
    feedback.reusableExample && phraseChunk(feedback.reusableExample.example),
  ]))
    .filter(item => countWords(item) <= 8)
    .slice(0, 4);

const splitSentences = (text: string) =>
  text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map(item => item.trim()) || [];

const genericSpeakingPath = (part: SpeakingFeedback['part']) => {
  if (part === 1) return ['Direct answer', 'one personal detail', 'light reason or feeling', 'stop'];
  if (part === 2) return ['Topic', 'opening scene', 'two concrete details', 'feeling change', 'why it matters'];
  return ['direct position', 'contrast or condition', 'example', 'consequence', 'balanced close'];
};

const speakingAnswerPath = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const source = feedback.upgradedAnswer && !/insufficient sample|starter outline/i.test(feedback.upgradedAnswer)
    ? feedback.upgradedAnswer
    : feedback.transcript;
  const chunks = splitSentences(source).map(sentence => phraseChunk(sentence, 7)).filter(Boolean);

  if (chunks.length >= 3 && feedback.part === 2) {
    return [
      `Topic: ${chunks[0]}`,
      `Start: ${chunks[1] || chunks[0]}`,
      `Details: ${chunks[2] || chunks[1]}`,
      `Feeling: ${chunks[3] || 'how it felt'}`,
      `Meaning: ${chunks[4] || 'why it mattered'}`,
    ];
  }
  if (chunks.length >= 2 && feedback.part === 1) {
    return [
      `Answer: ${chunks[0]}`,
      `Detail: ${chunks[1]}`,
      'Reason / feeling',
      'Stop naturally',
    ];
  }
  if (chunks.length >= 3 && feedback.part === 3) {
    return [
      `Position: ${chunks[0]}`,
      `Contrast: ${chunks[1]}`,
      `Example: ${chunks[2]}`,
      'Consequence / balanced close',
    ];
  }
  return genericSpeakingPath(feedback.part);
};

const starterTargetAnswer = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const question = feedback.question.trim();
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
    .map(item => item.replace(/^Can this idea also help you answer:\s*/i, '').trim())
    .filter(item => /^(describe|what|do|how|why|when|where|should|is|are|can|could|would)\b/i.test(item))
    .map(item => item.endsWith('?') || /^describe\b/i.test(item) ? item : `${item}?`)
    .slice(0, 3);
  if (direct.length >= 3) return direct;
  if (feedback.part === 1) return ['Do you enjoy reading?', 'What do you usually do to relax?', 'How often do you spend time on this activity?'];
  if (feedback.part === 2) return ['Describe a leisure activity you enjoy.', 'Describe something you do to relax.', 'Describe a time when you had a productive day.'];
  return ['How has technology changed people\'s daily routines?', 'Do people today have a better work-life balance than in the past?', 'What can companies do to improve employees\' wellbeing?'];
};

export const buildSpeakingTrainingMarkdown = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
) => {
  const insufficient = isSpeakingInsufficient(feedback);
  const meaningfulShort = insufficient && isMeaningfulShortAnswer(feedback);
  const shortQuestion = slugifyMarkdownFilenamePart(feedback.question, 8).replace(/-/g, ' ');
  const path = speakingAnswerPath(feedback);
  const mission = speakingMission(feedback);
  const activeExpressions = speakingActiveExpressions(feedback);
  const rows = diagnosisRows(feedback).map(item => `| ${item.category} | ${item.issue} | ${item.fix} |`).join('\n');
  const answerHeading = meaningfulShort ? '### 5. 起步目标答案｜Starter Target Answer' : '### 5. 优化答案｜Revised Answer';
  const answerBody = meaningfulShort
    ? `${starterTargetAnswer(feedback)}\n\n这只是起步示范，不是完全个性化高分答案。请把方括号替换成你的真实细节。`
    : insufficient
      ? '请先录入一个完整、可理解的答案；当前样本不足以生成目标答案。'
      : feedback.upgradedAnswer;

  return `# IELTS Speaking 训练笔记 - Part ${feedback.part} - ${shortQuestion}

## 0. 先练什么｜Start Here
### 今日 3 个训练目标
- 先按 Answer Path 说完整，再追求高级表达。
- 只修复诊断表里的前 1-2 个关键问题。
- 下一次录音前主动使用 2-4 个短语块。

### 今天主动使用
${bulletList(activeExpressions, '先使用一个具体细节，再使用一个自然连接表达。', 4)}

### 停顿与填充词控制｜Filler Control
可以短暂停顿；不要用 well / honestly / you know 连续拖时间。卡住时先回到 Answer Path 的下一步。

## Attempt 1: ${feedback.question}

### 1. 回答路线｜Answer Path
不要背 Revised Answer。只记这条回答路线。

${path.map((item, index) => `${index + 1}. ${item}`).join('\n')}

### 2. 重练任务｜Re-answer Mission
**Must do**
${bulletList(mission.must, '按回答路线重新说一次。')}

**Try to use**
${bulletList(activeExpressions, '使用一个更自然的短语块或更具体的细节。', 4)}

**Optional**
${bulletList(mission.optional, '录第二遍时减少犹豫和重复。')}

### 3. 原始回答｜Original Answer
${quoteBlock(feedback.transcript)}

### 4. 诊断｜Diagnosis
| Category | 问题 | 这次怎么改 |
|---|---|---|
${rows}

${answerHeading}
${answerBody}

### 6. 为什么这样更好｜Why This Works
这份笔记只保留下一次复练最需要的信息：回答路线、少量关键修正、短语块和一个目标答案。复练时不要背全文，先复用路线，再替换成自己的真实细节。

### 7. 迁移练习｜Transfer
**Same material｜同一个素材还能回答**
${numberedList(transferQuestions(feedback), 'Describe another IELTS-style question using the same material.', 3)}

**Same skill｜同一个能力迁移**
- 直接回答后补一个具体细节。
- 用原因、感受或影响把答案收住。
- 录音后检查是否有无意义重复。

### 8. 回到产品重测前｜Ready to Test Again
- [ ] 我能不看目标答案说出 Answer Path。
- [ ] 我已经把方括号或泛泛表达换成自己的真实细节。
- [ ] 我能把答案控制在本 Part 合适长度。

## Mini Review｜小复盘
本次重点不是保存一份“报告”，而是让下一次开口更快、更具体、更自然。

## Transfer Questions｜迁移问题
${numberedList(transferQuestions(feedback), 'Try the same answer path with a new IELTS-style question.', 3)}

_Exported: ${formatExportDate(timestamp)}_`;
};

const averageWritingScore = (scores: WritingFeedback['scores']) =>
  (scores.taskResponse + scores.coherenceCohesion + scores.lexicalResource + scores.grammaticalRangeAccuracy) / 4;

const conciseAction = (text?: string, maxWords = 28) => {
  const cleaned = (text || '').replace(/\s+/g, ' ').trim();
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
    feedback.essayLevelWarnings[0]?.messageZh && `处理篇幅/完整度：${conciseAction(feedback.essayLevelWarnings[0].messageZh, 24)}`,
    prioritizedLogic(feedback)[0]?.paragraphFixZh && `先改结构：${conciseAction(prioritizedLogic(feedback)[0].paragraphFixZh, 24)}`,
    prioritizedSentences(feedback)[0]?.transferGuidanceZh && `再改句子：${conciseAction(prioritizedSentences(feedback)[0].transferGuidanceZh, 22)}`,
  ]).slice(0, 3);

const task2Checklist = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  cleanLines([
    prioritizedLogic(feedback)[0]?.paragraphFixZh && `结构：${conciseAction(prioritizedLogic(feedback)[0].paragraphFixZh, 18)}`,
    prioritizedSentences(feedback)[0]?.transferGuidanceZh && `句子：${conciseAction(prioritizedSentences(feedback)[0].transferGuidanceZh, 18)}`,
    feedback.vocabularyUpgrade.expressionUpgrades[0]?.better && `表达：主动使用 ${phraseChunk(feedback.vocabularyUpgrade.expressionUpgrades[0].better, 8)}`,
    '写完后检查题目任务、立场、例子、回扣是否齐全。',
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
    .slice(0, 5);
  const frames = feedback.vocabularyUpgrade.expressionUpgrades
    .filter(item => !item.original || item.category === 'argument_frame')
    .map(phraseLevelUpgrade)
    .filter(item => item.better)
    .slice(0, 4);
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
- 中文诊断: ${conciseAction(item.suggestionZh, 30)}
- 这次怎么改: ${conciseAction(item.paragraphFixZh || item.transferGuidanceZh, 28) || '先明确这个段落的功能，再补足支撑。'}${item.exampleFrame ? `\n- 可复用框架: ${phraseChunk(item.exampleFrame, 14)}` : ''}`).join('\n\n') : '- 这次没有稳定的结构诊断；下一篇先检查立场、分段和例子是否完整。'}

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
