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
        pronunciationNote: "Not formally assessed in V1."
      },
      fatalErrors: [
        {
          original: "I likes to play football",
          correction: "I like to play football",
          tag: "grammar",
          explanationZh: "主谓一致错误。'I' 是第一人称，动词不用加 -s。"
        }
      ],
      naturalnessHints: [
        {
          original: "It is very good",
          better: "It's absolutely fantastic",
          tag: "word_choice",
          explanationZh: "使用更地道的副词和形容词搭配来增强口语的自然度。"
        }
      ],
      band9Refinements: [
        {
          observation: "The answer is clear, but it could sound more spontaneous.",
          refinement: "Add one short personal detail instead of making the answer more formal.",
          explanationZh: "高分口语不只是更复杂，也要像真实交流。Part 1 尤其适合简短、自然、带一点个人细节的回答。"
        }
      ],
      preservedStyle: [
        {
          text: "I used to be a shy boy",
          reasonZh: "保留了个人的成长故事，这在 Part 1 中很真实。"
        }
      ],
      upgradedAnswer: "Actually, I'm quite fond of my hometown since I've spent my entire childhood there. It's a vibrant city with a rich history, and I've witnessed its rapid transformation over the years.",
      reusableExample: {
        example: "The rapid transformation of my city",
        canBeReusedFor: ["Hometown", "Environment", "Changes"],
        explanationZh: "这个短语可以用来描述任何关于城市变化或发展的场景。"
      },
      obsidianMarkdown: "# IELTS Speaking Note\n..."
    };
  }

  async analyzeWriting(params: {
    task: string;
    question: string;
    essay: string;
  }): Promise<WritingFeedback> {
    await new Promise(r => setTimeout(r, 2000));
    return {
      mode: 'practice',
      module: 'writing',
      task: params.task as any,
      question: params.question,
      essay: params.essay,
      scores: {
        taskResponse: 7.5,
        coherenceCohesion: 7.0,
        lexicalResource: 6.5,
        grammaticalRangeAccuracy: 6.5
      },
      frameworkFeedback: [
        {
          issue: "Conclusion is a bit brief",
          suggestionZh: "可以再总结一下两个观点的平衡点。",
          severity: "naturalness"
        }
      ],
      sentenceFeedback: [
        {
          original: "People should study what they want.",
          correction: "Individuals should be encouraged to pursue subjects they are passionate about.",
          dimension: "LR",
          tag: "lexical_precision",
          explanationZh: "使用更正式、更多样化的词汇来提升学术写作的质量。"
        }
      ],
      modelAnswer: "Sample Band 9 essay content...",
      reusableArguments: [
        {
          argument: "Personal interest leads to better academic performance",
          canBeReusedFor: ["Education", "Work satisfaction"],
          explanationZh: "这是一个通用的教育类观点。"
        }
      ],
      obsidianMarkdown: "# IELTS Writing Note\n..."
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

    const words = params.report.trim().split(/\s+/).filter(Boolean).length;
    const lower = params.report.toLowerCase();
    const hasOverview = /\b(overall|in general|it is clear|it can be seen|the main trend|broadly)\b/.test(lower);
    const hasNumbers = /\d|percent|percentage|million|thousand|km|tonnes|units/.test(lower);
    const comparisonExpected = !['process'].includes(params.taskType.toLowerCase());
    const hasComparison = /\b(compared|whereas|while|than|higher|lower|largest|smallest|respectively|in contrast)\b/.test(lower);
    const mustFix = [
      words < 150 ? '字数还不足 150 词，先不要把这次当作完整 Task 1 训练结果。' : '',
      !hasOverview ? '必须补一个清晰 overview，用一句话概括整体趋势、主要模式或关键阶段。' : '',
      !hasNumbers ? '加入来自图表的准确数字和单位，不要只做笼统描述。' : '',
      comparisonExpected && !hasComparison ? '增加直接比较，例如 higher than, whereas, in contrast, the largest proportion。' : '',
      '不要解释原因，除非题目视觉信息本身明确给出原因。',
    ].filter(Boolean);

    const estimatedBand = words < 120 ? 5.5 : hasOverview && hasNumbers && (!comparisonExpected || hasComparison) ? 7 : 6.5;
    const patterns = params.reusablePatterns?.length
      ? params.reusablePatterns
      : [
        'Start the overview with "Overall, ..." and describe only the biggest pattern.',
        'Group details by trend or size instead of listing every number.',
        'Use comparison language before adding exact figures.',
      ];

    const improvedReport = `Overall, the visual shows a clear main pattern, with the most important changes concentrated in the largest categories. The strongest body paragraph should group the leading figures together, while a second paragraph can compare the smaller or less dramatic figures. Exact numbers should support each point, but the report should avoid explaining why the changes happened unless the visual provides that information.`;

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
        feedback: words < 150
          ? '文章低于 Task 1 字数要求，所以即使内容相关，Task Achievement 也会受限。'
          : '这篇报告回应了图表，但估计表现主要取决于 overview 是否概括全图，以及数据选择是否抓住重点。',
      },
      overviewFeedback: hasOverview
        ? '已经有 overview 信号。下一步要确认它概括的是全图主趋势，而不是某一个孤立数据点。'
        : '没有检测到清楚的 overview。建议在细节段前加入一句总览，例如 "Overall, ...", 概括主要趋势或最突出的差异。',
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
      coherenceFeedback: '建议使用四个紧凑段落：改写题目、overview、细节组 1、细节组 2。细节段按趋势/大小/阶段分组。',
      languageCorrections: [
        {
          original: 'The chart explains why...',
          correction: 'The chart shows that...',
          explanation: 'Task 1 只描述可见信息，不要自行推测原因。可以改成 "The chart shows that..."。',
        },
      ],
      mustFix,
      rewriteTask: [
        '- 重写 overview：用一句话概括全图最大趋势、主要差异或流程结果。',
        '- 重新分组主体段：按趋势、大小、阶段或类别组合信息，避免逐项流水账。',
        '- 加入比较：使用 higher than, whereas, in contrast 等表达说明关键差异。',
        '- 核对数据准确性：至少保留 3 个准确数字、单位或排名。',
      ].join('\n'),
      reusableReportPatterns: patterns,
      improvedReport,
      modelExcerpt: improvedReport,
      obsidianMarkdown: `# IELTS Writing Task 1 Note\n\n## Prompt\n${params.instruction}\n\n## Training Estimate\n${estimatedBand.toFixed(1)}\n\n## Must Fix\n${mustFix.map(item => `- ${item}`).join('\n')}\n\n## Reusable Patterns\n${patterns.map(item => `- ${item}`).join('\n')}`,
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

    const summary = {
      mode: 'practice' as const,
      module: 'writing' as const,
      task: params.task,
      question: params.question,
      sourceNotes: params.notes,
      position: `Balanced position based on the notes: ${conciseAnchor}`,
      viewA: 'One side can be acknowledged as reasonable, especially where it protects practical outcomes or short-term social benefits.',
      viewB: 'The opposing side should be developed with a clearer long-term consequence and a stronger link to the question wording.',
      myOpinion: 'My opinion should be explicit: partially agree with both views, but give more weight to the side that is better supported by evidence.',
      paragraphPlan: 'Introduction: paraphrase + balanced thesis.\nBody 1: explain View A with one concrete reason.\nBody 2: explain View B and show why it is stronger.\nConclusion: restate the weighed opinion.',
      possibleExample: 'Use a simple education, work, technology, or public policy example that directly proves the stronger body paragraph.',
    };

    return {
      ...summary,
      editableSummary: `Position:\n${summary.position}\n\nView A:\n${summary.viewA}\n\nView B:\n${summary.viewB}\n\nMy opinion:\n${summary.myOpinion}\n\nParagraph plan:\n${summary.paragraphPlan}\n\nPossible example:\n${summary.possibleExample}`,
    };
  }
}
