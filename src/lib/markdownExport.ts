import { formatBandEstimate } from './bands';
import type {
  SpeakingFeedback,
  WritingFeedback,
  WritingTask1Feedback,
} from './ai/schemas';
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

export const slugifyMarkdownFilenamePart = (value?: string, maxWords = 12) => {
  const words = (value || '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords);

  return words.join('-') || 'untitled';
};

const isReliableTopic = (topic?: string) =>
  Boolean(topic?.trim()) && !/academic task|task 1|task 2|writing|speaking|general/i.test(topic || '');

export const buildMarkdownExportFilename = ({
  module,
  taskOrPart,
  topic,
  prompt,
  timestamp,
}: MarkdownFilenameInput) => {
  const { date, time } = formatDateTimeStamp(timestamp);
  const slugSource = isReliableTopic(topic) && prompt
    ? `${topic} ${prompt}`
    : isReliableTopic(topic)
      ? topic
      : prompt;
  const slug = slugifyMarkdownFilenamePart(slugSource);
  return `ielts-${module}-${taskOrPart}-${slug}-${date}-${time}.md`;
};

const formatExportDate = (timestamp?: string | Date) =>
  formatDateTimeStamp(timestamp).date;

const cleanLines = (items: Array<string | undefined | null>) =>
  items.map(item => (item || '').trim()).filter(Boolean);

const bulletList = (items: string[], fallback: string) =>
  items.length ? items.map(item => `- ${item}`).join('\n') : `- ${fallback}`;

const numberedList = (items: string[], fallback: string) =>
  items.length ? items.map((item, index) => `${index + 1}. ${item}`).join('\n') : `1. ${fallback}`;

const quoteBlock = (text: string) =>
  (text || 'No saved text.')
    .split('\n')
    .map(line => `> ${line}`)
    .join('\n');

const sentenceSlice = (text: string, maxSentences: number) => {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
    ?.map(sentence => sentence.trim())
    .filter(Boolean) || [];
  return (sentences.length ? sentences.slice(0, maxSentences).join(' ') : text).trim();
};

const revisedSpeakingAnswer = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) =>
  feedback.part === 1 ? sentenceSlice(feedback.upgradedAnswer, 4) : feedback.upgradedAnswer;

const speakingAnswerPath = (part: SpeakingFeedback['part']) => {
  if (part === 1) {
    return [
      'Direct answer',
      'one personal detail',
      'light reason or feeling',
      'stop naturally',
    ];
  }
  if (part === 2) {
    return [
      'who / what / where',
      'specific scene',
      'two concrete details',
      'feeling change',
      'why it matters',
    ];
  }
  return [
    'direct position',
    'contrast or condition',
    'one example',
    'consequence',
    'balanced close',
  ];
};

const speakingMission = (part: SpeakingFeedback['part']) => {
  if (part === 1) {
    return {
      must: [
        '先用一句话直接回答，不要只说 yes / no。',
        '补一个具体个人细节，例如时间、地点、人物或频率。',
        '用一句轻理由或感受收住答案。',
      ],
      optional: ['如果答案已经超过 4 句，主动删掉解释性废话。'],
    };
  }
  if (part === 2) {
    return {
      must: [
        '把故事讲成一个连续场景，而不是列点。',
        '至少加入两个可视化细节。',
        '结尾说明这件事为什么对你重要。',
      ],
      optional: ['练一次 90-120 秒版本，避免过早停下。'],
    };
  }
  return {
    must: [
      '先给清楚立场。',
      '加入对比、条件或让步，让观点不绝对。',
      '用一个现实例子支撑抽象观点。',
    ],
    optional: ['结尾补一句影响或趋势，提升讨论感。'],
  };
};

const diagnosisRows = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const rows = [
    ...feedback.fatalErrors.map(item => ({
      category: '必须先改',
      issue: `${item.original} -> ${item.correction}`,
      fix: item.explanationZh,
    })),
    ...feedback.naturalnessHints.map(item => ({
      category: '自然度',
      issue: `${item.original} -> ${item.better}`,
      fix: item.explanationZh,
    })),
    ...feedback.band9Refinements.map(item => ({
      category: '高分打磨',
      issue: item.observation,
      fix: `${item.refinement}。${item.explanationZh}`,
    })),
  ];

  return rows.length ? rows : [{
    category: '本次重点',
    issue: '结构基本可用，但还需要更稳定地展开。',
    fix: '下一次先按回答路线复述，再加入一个具体细节。',
  }];
};

const transferQuestions = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>) => {
  const reusable = feedback.reusableExample?.canBeReusedFor || [];
  const fromReusable = reusable
    .filter(item => /[a-z]/i.test(item))
    .slice(0, 3)
    .map(item => item.endsWith('?') ? item : `Can this idea also help you answer: ${item}?`);

  if (fromReusable.length >= 3) return fromReusable;
  if (feedback.part === 1) {
    return [
      'What do you usually do with your friends?',
      'Do you prefer spending time alone or with other people?',
      'How often do you meet your friends?',
    ];
  }
  if (feedback.part === 2) {
    return [
      'Describe a daily routine that you enjoy.',
      'Describe an activity that helped you relax.',
      'Describe something you do regularly that is important to you.',
    ];
  }
  return [
    'How has technology changed the way people communicate?',
    'Do you think young people rely too much on technology?',
    'What changes might affect this area in the future?',
  ];
};

export const buildSpeakingTrainingMarkdown = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
) => {
  const shortQuestion = slugifyMarkdownFilenamePart(feedback.question, 8).replace(/-/g, ' ');
  const path = speakingAnswerPath(feedback.part);
  const mission = speakingMission(feedback.part);
  const rows = diagnosisRows(feedback)
    .map(item => `| ${item.category} | ${item.issue} | ${item.fix} |`)
    .join('\n');

  return `# IELTS Speaking 训练笔记 - Part ${feedback.part} - ${shortQuestion}

## 0. 先练什么｜Start Here
### 今日 3 个训练目标
- 按 Part ${feedback.part} 的回答路线先说完整，再追求高级表达。
- 修复诊断表里最影响理解的一项。
- 下一次录音前主动使用 1-2 个更自然的表达。

### 今天主动使用
${bulletList(cleanLines([
  feedback.naturalnessHints[0]?.better,
  feedback.band9Refinements[0]?.refinement,
  feedback.reusableExample?.example,
]), '先使用一个清楚的个人细节，再使用一个自然连接表达。')}

### Filler 预算
- 允许短暂停顿，但不要用长串 filler 替代内容；想不出时先回到回答路线。

## Attempt 1: ${feedback.question}

### 1. 回答路线｜Answer Path
不要背 Revised Answer。只记这条回答路线。

${path.map((item, index) => `${index + 1}. ${item}`).join('\n')}

### 2. 重练任务｜Re-answer Mission
**Must do**
${bulletList(mission.must, '按回答路线重新说一次。')}

**Try to use**
${bulletList(cleanLines([
  feedback.naturalnessHints[0]?.better,
  feedback.band9Refinements[0]?.refinement,
]), '使用一个更自然的表达或更具体的细节。')}

**Optional**
${bulletList(mission.optional, '录第二遍时减少犹豫和重复。')}

### 3. 原始回答｜Original Answer
${quoteBlock(feedback.transcript)}

### 4. 诊断｜Diagnosis
| Category | 问题 | 这次怎么改 |
|---|---|---|
${rows}

### 5. 优化答案｜Revised Answer
${revisedSpeakingAnswer(feedback)}

### 6. 为什么这样更好｜Why This Works
这版答案更适合训练，是因为它先保证回答路线清楚，再补充具体细节和自然表达。你下次不需要背全文，只要复用同一条展开顺序，并把细节换成自己的真实素材。

### 7. 迁移练习｜Transfer
**Same material｜同一个素材还能回答**
${bulletList(feedback.reusableExample?.canBeReusedFor || [], '把这次素材换到同主题或相邻主题的问题里。')}

**Same answer path｜同一条回答路线还能用于**
${bulletList(path.map(item => `练习 ${item}`), '用同一条路线回答另一个同 Part 问题。')}

**Same skill｜同一个能力迁移**
- 直接回答后补一个具体细节。
- 用原因、感受或影响把答案收住。
- 录音后检查是否有无意义重复。

### 8. 回到产品重测前｜Ready to Test Again
- [ ] 我能不看 Revised Answer 说出回答路线。
- [ ] 我已经主动替换了至少一个表达。
- [ ] 我能把答案控制在本 Part 合适长度。

## Mini Review｜小复盘
本次重点不是背一篇完美答案，而是把答案变得更清楚、更具体、更像真实口语。下次先复用路线，再检查诊断表中的第一项是否已经改善。

## Transfer Questions｜迁移问题
${numberedList(transferQuestions(feedback), 'Try the same answer path with a new IELTS-style question.')}

_Exported: ${formatExportDate(timestamp)}_`;
};

const averageWritingScore = (scores: WritingFeedback['scores']) =>
  (scores.taskResponse + scores.coherenceCohesion + scores.lexicalResource + scores.grammaticalRangeAccuracy) / 4;

const task2RevisionFocus = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  feedback.essayLevelWarnings[0]?.messageZh ||
  feedback.frameworkFeedback[0]?.paragraphFixZh ||
  feedback.frameworkFeedback[0]?.suggestionZh ||
  feedback.sentenceFeedback[0]?.explanationZh ||
  '下一次先确认立场、段落功能和例子是否服务题目，再处理句子表达。';

const task2Checklist = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>) =>
  cleanLines([
    feedback.frameworkFeedback[0]?.paragraphFixZh && `先改结构：${feedback.frameworkFeedback[0].paragraphFixZh}`,
    feedback.sentenceFeedback[0]?.transferGuidanceZh && `检查句子：${feedback.sentenceFeedback[0].transferGuidanceZh}`,
    feedback.vocabularyUpgrade.expressionUpgrades[0]?.better && `主动使用：${feedback.vocabularyUpgrade.expressionUpgrades[0].better}`,
  ]);

const expressionDetails = (
  item: WritingFeedback['vocabularyUpgrade']['expressionUpgrades'][number],
) => cleanLines([
  item.explanationZh && `  - 中文说明: ${item.explanationZh}`,
  item.reuseWhenZh && `  - 复用场景: ${item.reuseWhenZh}`,
  item.example && `  - Example: ${item.example}`,
]).join('\n');

export const buildWritingTask2TrainingMarkdown = (
  feedback: Omit<WritingFeedback, 'obsidianMarkdown'>,
  timestamp?: string | Date,
) => {
  const estimate = averageWritingScore(feedback.scores);
  const fromEssay = feedback.vocabularyUpgrade.expressionUpgrades.filter(item => item.original || item.category === 'from_essay');
  const frames = feedback.vocabularyUpgrade.expressionUpgrades.filter(item => !item.original || item.category === 'argument_frame');
  const annotations = feedback.modelAnswerAnnotations?.length
    ? `\n\n### 范文标注｜Annotations\n${feedback.modelAnswerAnnotations.map(item => `- ${item.quote}: ${item.labelZh}`).join('\n')}`
    : '';

  return `# IELTS Writing Task 2 训练笔记 - ${slugifyMarkdownFilenamePart(feedback.question, 8).replace(/-/g, ' ')} - ${formatExportDate(timestamp)}

## 0. 本次先改什么｜Revision Focus
${task2RevisionFocus(feedback)}

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
${feedback.frameworkFeedback.length ? feedback.frameworkFeedback.map((item, index) => `### ${index + 1}. ${item.location || 'Whole Essay'} - ${item.issue}
- 中文诊断: ${item.suggestionZh}
- 这次怎么改: ${item.paragraphFixZh || '先明确这个段落的功能，再补足支撑。'}
- 下次迁移: ${item.transferGuidanceZh || '写下一篇前先检查题目要求、立场和段落功能是否一致。'}${item.exampleFrame ? `\n- Example frame: ${item.exampleFrame}` : ''}`).join('\n\n') : '- 这次没有稳定的结构诊断；下一篇先检查立场、分段和例子是否完整。'}

## 5. 句子级修改｜Sentence Corrections
${feedback.sentenceFeedback.length ? feedback.sentenceFeedback.map((item, index) => `### ${item.correctionNumber || index + 1}. ${item.primaryIssue || item.tag}
- Original: ${item.original}
- Correction: ${item.correction}
- 中文说明: ${item.explanationZh}
- 下次自查: ${item.transferGuidanceZh || '检查这类句子是否清楚、准确、服务论证。'}${item.microUpgrades?.length ? `\n- Micro upgrades:\n${item.microUpgrades.map(upgrade => `  - ${upgrade.original} -> ${upgrade.better}: ${upgrade.explanationZh}`).join('\n')}` : ''}`).join('\n\n') : '- 这次没有稳定的句子级修改；下一篇先保证每句语法完整、指代清楚。'}

## 6. 词汇与表达积累｜Language Bank
### Topic Vocabulary
${feedback.vocabularyUpgrade.topicVocabulary.length ? feedback.vocabularyUpgrade.topicVocabulary.map(item => `- ${item.expression}\n  - 中文含义: ${item.meaningZh}\n  - 使用方法: ${item.usageZh}${item.example ? `\n  - Example: ${item.example}` : ''}`).join('\n') : '- 暂无稳定主题词汇；先从题目关键词提炼 2-3 个可复用表达。'}

### From Your Essay
${fromEssay.length ? fromEssay.map(item => `- ${item.original ? `${item.original} -> ` : ''}${item.better}${expressionDetails(item) ? `\n${expressionDetails(item)}` : ''}`).join('\n') : '- 暂无来自原文的短语升级。'}

### Argument Frames
${frames.length ? frames.map(item => `- ${item.better}${expressionDetails(item) ? `\n${expressionDetails(item)}` : ''}`).join('\n') : '- 暂无稳定论证框架；优先复用清楚的让步、因果、对比句型。'}

## 7. 目标范文｜Target Model Answer
${feedback.modelAnswer || 'No reliable target model answer for this attempt.'}${annotations}

## 8. 下次写作前检查｜Next Attempt Checklist
${bulletList(task2Checklist(feedback), '先确认题目任务、中心立场、每段功能和一个具体例子，再开始写。')}`;
};

const task1RevisionFocus = (feedback: Omit<WritingTask1Feedback, 'obsidianMarkdown'>) =>
  feedback.mustFix[0] ||
  feedback.overviewFeedback ||
  feedback.keyFeaturesFeedback ||
  '下一次先写清楚 overview，再选择最重要的数据和比较关系。';

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
  ]);
  const dataSummary = prompt?.data || [];

  return `# IELTS Writing Task 1 训练笔记 - ${slugifyMarkdownFilenamePart(feedback.taskType || prompt?.topic || feedback.instruction, 8).replace(/-/g, ' ')} - ${formatExportDate(timestamp)}

## 0. 本次先改什么｜Revision Focus
${task1RevisionFocus(feedback)}

## 1. 题目｜Prompt
${feedback.instruction}

## 2. 我的报告｜My Report
${feedback.report}

## 3. 分数快照｜Training Estimate
- 任务完成度｜Task Achievement: ${formatBandEstimate(feedback.taskAchievement?.score ?? feedback.estimatedBand)}
- 连贯与衔接｜Coherence & Cohesion: 见结构诊断
- 词汇资源｜Lexical Resource: 见语言修改
- 语法多样性与准确性｜Grammatical Range & Accuracy: 见语言修改
- 综合训练估计｜Overall training estimate: ${formatBandEstimate(feedback.estimatedBand)}

## 4. Overview 与关键信息｜Overview / Key Features
- Overview: ${feedback.overviewFeedback}
- Key features: ${feedback.keyFeaturesFeedback}

## 5. 数据与比较｜Data Accuracy / Comparisons
- Visual brief: ${feedback.visualBrief}
${dataSummary.length ? bulletList(dataSummary, 'No visual data stored.') : ''}
- Comparisons: ${feedback.comparisonFeedback}
- Data accuracy: ${feedback.dataAccuracyFeedback}
- Coherence: ${feedback.coherenceFeedback}

## 6. 语言修改｜Language Corrections
${feedback.languageCorrections.length ? feedback.languageCorrections.map(item => `- Original: ${item.original}\n  - Correction: ${item.correction}\n  - 中文说明: ${item.explanation}`).join('\n') : '- 暂无稳定语言修改；先检查 overview、比较句和数据表达。'}

## 7. 优化范文｜Improved Report
${feedback.improvedReport || feedback.modelExcerpt || 'No improved report returned.'}

## 8. 下次写作前检查｜Next Attempt Checklist
${bulletList(cleanLines([
  ...feedback.mustFix,
  feedback.rewriteTask,
  ...feedback.reusableReportPatterns,
  ...planItems,
]), '先写 overview，再按趋势、类别、阶段或大小分组主体段，并核对所有数据。')}`;
};
