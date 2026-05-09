import { AIProvider } from './base';
import { SpeakingFeedback, WritingFeedback, WritingFrameworkSummary, WritingTask1Feedback } from '../schemas';

const firstNonEmptyLine = (text: string, fallback: string): string => {
  const line = text
    .split(/\r?\n/)
    .map(item => item.trim())
    .find(Boolean);

  return line || fallback;
};

const shorten = (text: string, maxLength = 180): string => {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 3)}...` : cleaned;
};

const countWords = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

export class MockProvider implements AIProvider {
  async analyzeSpeaking(params: {
    part: number;
    question: string;
    transcript: string;
  }): Promise<SpeakingFeedback> {
    await new Promise(r => setTimeout(r, 1500));
    return {
      mode: 'practice',
      module: 'speaking',
      part: params.part as any,
      question: params.question,
      transcript: params.transcript,
      bandEstimateExcludingPronunciation: 6.5,
      scores: {
        fluencyCoherence: 6.5,
        lexicalResource: 7.0,
        grammaticalRangeAccuracy: 6.0,
        pronunciation: null,
        pronunciationNote: 'Not formally assessed in V1.',
      },
      fatalErrors: [
        {
          original: 'I likes to play football',
          correction: 'I like to play football',
          tag: 'grammar',
          explanationZh: '主谓一致错误。I 是第一人称，动词不需要加 -s。',
        },
      ],
      naturalnessHints: [
        {
          original: 'It is very good',
          better: "It's absolutely fantastic",
          tag: 'word_choice',
          explanationZh: '可以使用更自然的副词和形容词搭配，让口语表达更生动。',
        },
      ],
      band9Refinements: [
        {
          observation: 'The answer is clear, but it could sound more spontaneous.',
          refinement: 'Add one short personal detail instead of making the answer more formal.',
          explanationZh: '高分口语不只是更复杂，也要像真实交流。Part 1 尤其适合简短、自然、带一点个人细节的回答。',
        },
      ],
      preservedStyle: [
        {
          text: 'I used to be a shy boy',
          reasonZh: '保留了个人成长故事，这在 Part 1 中很真实。',
        },
      ],
      upgradedAnswer: "Actually, I'm quite fond of my hometown since I've spent my entire childhood there. It's a vibrant city with a rich history, and I've witnessed its rapid transformation over the years.",
      reusableExample: {
        example: 'The rapid transformation of my city',
        canBeReusedFor: ['Hometown', 'Environment', 'Changes'],
        explanationZh: '这个短语可以用来描述城市变化或发展类话题。',
      },
      obsidianMarkdown: '# IELTS Speaking Note\n...',
    };
  }

  async analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
  }): Promise<WritingFeedback> {
    await new Promise(r => setTimeout(r, 2000));
    const words = countWords(params.essay);
    const isExtremelyShort = words <= 20;
    const isUnderLength = words < 250;
    const scores = isExtremelyShort
      ? {
        taskResponse: 3.0,
        coherenceCohesion: 3.0,
        lexicalResource: 3.5,
        grammaticalRangeAccuracy: 3.5,
      }
      : isUnderLength
        ? {
          taskResponse: 5.0,
          coherenceCohesion: 5.0,
          lexicalResource: 5.0,
          grammaticalRangeAccuracy: 5.0,
        }
        : {
          taskResponse: 6.5,
          coherenceCohesion: 6.5,
          lexicalResource: 6.5,
          grammaticalRangeAccuracy: 6.5,
        };
    const lengthNote = isExtremelyShort
      ? '样本太短，无法形成可靠 Task 2 估计。先扩展到完整四段结构，再看论证和语言问题。'
      : isUnderLength
        ? '文章低于 250 词，训练估计会保守处理。请补足论点展开、例子和结论。'
        : '结构基本完整；下一步重点检查立场、段落推进和例证质量。';

    return {
      mode: 'practice',
      module: 'writing',
      task: params.task as any,
      question: params.question,
      essay: params.essay,
      scores,
      frameworkFeedback: [
        {
          issue: isUnderLength ? 'Under-length response' : 'Framework needs sharper development',
          suggestionZh: lengthNote,
          severity: isUnderLength ? 'fatal' : 'naturalness',
        },
      ],
      sentenceFeedback: [
        {
          original: 'People should study what they want.',
          correction: 'Individuals should be encouraged to pursue subjects they are passionate about.',
          dimension: 'LR',
          tag: 'lexical_precision',
          explanationZh: '可以用更正式、更准确的表达替代口语化词组，但前提是先把文章写成完整论证。',
        },
      ],
      modelAnswer: isUnderLength
        ? 'This sample is too short for a high training estimate. A complete response should state a clear position, develop two body paragraphs with specific reasoning, and finish with a concise conclusion.'
        : 'A stronger essay would maintain a clear position throughout, develop each body paragraph around one controlling idea, and use a specific example to show why the argument matters.',
      reusableArguments: [
        {
          argument: 'Personal interest leads to better academic performance',
          canBeReusedFor: ['Education', 'Work satisfaction'],
          explanationZh: '这是一个教育和职业类都可复用的论点，但需要具体例子支撑。',
        },
      ],
      obsidianMarkdown: `# IELTS Writing Note

## Prompt
${params.question}

## Training Estimate
${scores.taskResponse.toFixed(1)}

## Length Note
${lengthNote}

## Essay
${params.essay}`,
    };
  }

  async analyzeWritingTask1(params: {
    task: 'task1';
    taskType: string;
    instruction: string;
    visualBrief: string;
    dataSummary: string;
    report: string;
    expectedOverview?: string;
    expectedKeyFeatures?: string[];
    expectedComparisons?: string[];
    commonTraps?: string[];
    reusablePatterns?: string[];
  }): Promise<WritingTask1Feedback> {
    await new Promise(r => setTimeout(r, 900));

    const words = countWords(params.report);
    const lower = params.report.toLowerCase();
    const hasOverview = /\b(overall|in general|it is clear|it can be seen|the main trend|broadly)\b/.test(lower);
    const hasNumbers = /\d|percent|percentage|million|thousand|km|tonnes|units/.test(lower);
    const comparisonExpected = !['process'].includes(params.taskType.toLowerCase());
    const hasComparison = /\b(compared|whereas|while|than|higher|lower|largest|smallest|respectively|in contrast)\b/.test(lower);
    const isExtremelyShort = words <= 20;
    const isUnderLength = words < 150;
    const estimatedBand = isExtremelyShort
      ? 3.0
      : isUnderLength
        ? 5.0
        : hasOverview && hasNumbers && (!comparisonExpected || hasComparison)
          ? 6.5
          : 6.0;
    const mustFix = [
      isExtremelyShort ? '样本太短，无法判断完整 Task 1 表现。先写出 introduction、overview 和两个细节段。' : '',
      !isExtremelyShort && isUnderLength ? '字数低于 150 词，训练估计会保守处理。请补足关键数据和比较。' : '',
      !hasOverview ? '补写 overview：用一句话概括全图最大趋势、主要差异或流程结果。' : '',
      !hasNumbers ? '加入准确数据：至少写 3 个来自题目的数字、单位、排名或阶段信息。' : '',
      comparisonExpected && !hasComparison ? '增加比较：用 higher than, whereas, in contrast 等表达说明关键差异。' : '',
      '不要解释原因，除非题目视觉信息本身明确给出原因。',
    ].filter(Boolean);
    const patterns = params.reusablePatterns?.length
      ? params.reusablePatterns
      : [
        'Overall, X remained dominant, while Y declined and Z rose.',
        'By the end of the period, the gap between X and Y had narrowed considerably.',
        'The most notable exception was X, where the figure changed from ... to ...',
      ];

    const improvedReport = `Overall, the visual shows a clear main pattern, with the most important changes concentrated in the largest categories. The strongest body paragraph should group the leading figures together, while a second paragraph can compare the smaller or less dramatic figures. Exact numbers should support each point, but the report should avoid explaining why the changes happened unless the visual provides that information.`;
    const rewriteTask = [
      '- 重写 introduction：只改写题目，不加入原因或个人观点。',
      '- 重写 overview：用一句话概括全图最大趋势、最高/最低项或流程终点。',
      '- 补充主体段 1：选择最重要的 key feature，并加入准确数字或阶段。',
      '- 补充主体段 2：加入至少一个比较关系，例如 higher than, whereas, in contrast。',
      '- 检查语言：避免 explain why，改用 shows, illustrates, increased from X to Y 等描述性表达。',
    ].join('\n');

    return {
      mode: 'practice',
      module: 'writing_task1',
      task: 'task1',
      taskType: params.taskType,
      instruction: params.instruction,
      visualBrief: params.visualBrief,
      report: params.report,
      estimatedBand,
      taskAchievement: {
        score: estimatedBand,
        feedback: isUnderLength
          ? '这篇报告低于 Task 1 字数要求，所以估计必须保守。先补全 overview 和两组细节。'
          : '这篇报告回应了图表，但表现主要取决于 overview 是否概括全图，以及数据选择是否抓住重点。',
      },
      overviewFeedback: hasOverview
        ? '已经有 overview 信号。下一步要确认它概括的是全图主趋势，而不是某一个孤立数据点。'
        : '没有清楚的 overview。建议在细节段前加入一句总览，例如 "Overall, ...", 概括主要趋势或最突出的差异。',
      keyFeaturesFeedback: hasNumbers
        ? '已经使用了可量化信息。继续筛选最大变化、最高/最低值和最突出的阶段，不需要覆盖每个数字。'
        : '关键信息不够具体，需要从视觉信息中加入数字、单位或明确数值，例如 "rose from X to Y"。',
      comparisonFeedback: comparisonExpected
        ? (hasComparison
          ? '已经有比较语言。注意比较应服务于分组，而不只是用 while/whereas 连接两个句子。'
          : '需要加入比较关系，例如 higher than, whereas, in contrast, 或 the largest proportion，把类别、时间段或地点放在一起比较。')
        : '如果是流程图，重点不是类别比较，而是阶段顺序和变化结果。',
      dataAccuracyFeedback: hasNumbers
        ? '已经包含数字。请逐个检查数值、单位和排名是否与题目数据一致，避免近似数字造成误导。'
        : '没有检测到数据引用，这会让 Academic Task 1 显得太泛泛。至少加入 3 个准确数据点。',
      coherenceFeedback: '建议使用四个紧凑段落：改写题目、overview、细节组 1、细节组 2。细节段按趋势、大小或阶段分组。',
      languageCorrections: [
        {
          original: 'The chart explains why...',
          correction: 'The chart shows that...',
          explanation: 'Task 1 只描述可见信息，不要自行推测原因。可以改成 "The chart shows that..."。',
        },
      ],
      mustFix,
      rewriteTask,
      reusableReportPatterns: patterns,
      improvedReport,
      modelExcerpt: improvedReport,
      obsidianMarkdown: `# IELTS Writing Task 1 Note

## Prompt
${params.instruction}

## Training Estimate
${estimatedBand.toFixed(1)}

## Must Fix
${mustFix.map(item => `- ${item}`).join('\n')}

## Rewrite Task
${rewriteTask}

## Reusable Patterns
${patterns.map(item => `- ${item}`).join('\n')}`,
    };
  }

  async extractWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<WritingFrameworkSummary> {
    await new Promise(r => setTimeout(r, 700));

    const source = params.notes.trim();
    const anchor = firstNonEmptyLine(source, 'Use the strongest idea from the Phase 1 notes.');
    const conciseAnchor = shorten(anchor);

    const notDecided = 'Not decided yet / 需要继续补充';
    const summary = {
      mode: 'practice' as const,
      module: 'writing' as const,
      task: params.task,
      question: params.question,
      sourceNotes: params.notes,
      position: conciseAnchor ? `Local mock summary from notes: ${conciseAnchor}` : notDecided,
      viewA: notDecided,
      viewB: notDecided,
      myOpinion: notDecided,
      paragraphPlan: source ? `Use only confirmed notes so far: ${shorten(source, 240)}` : notDecided,
      possibleExample: 'Suggested example, please confirm: add an example only if it matches your own notes.',
    };

    return {
      ...summary,
      editableSummary: `Position:\n${summary.position}\n\nView A:\n${summary.viewA}\n\nView B:\n${summary.viewB}\n\nMy opinion:\n${summary.myOpinion}\n\nParagraph plan:\n${summary.paragraphPlan}\n\nPossible example:\n${summary.possibleExample}`,
    };
  }

  async coachWritingFramework(params: {
    task: 'task2';
    question: string;
    notes: string;
  }): Promise<string> {
    await new Promise(r => setTimeout(r, 450));
    const notes = params.notes.trim();
    const firstLine = firstNonEmptyLine(notes, '');
    const focus = firstLine ? shorten(firstLine, 120) : 'your position';
    return JSON.stringify({
      comments: [
        `Local mock coach: Your current focus seems to be "${focus}". Which side will your thesis finally support?`,
        'What is the strongest reason from your own notes, and what example can prove it?',
        'Which opposing view do you need to acknowledge without turning the essay into a list?',
      ],
    });
  }
}
