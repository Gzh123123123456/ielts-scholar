import type { WritingTask1AcademicPrompt } from '@/src/data/questions/bank';
import type { WritingTask1Feedback } from '@/src/lib/ai/schemas';
import type { Task1LearnerRoute } from '@/src/lib/writingTask1SubmissionQuality';

export type Task1CoverageStatus = 'covered' | 'thin' | 'missing' | 'passed' | 'check';

export interface Task1CoverageRow {
  label: string;
  status: Task1CoverageStatus;
  detail: string;
}

export interface Task1FeedbackDisplayModel {
  verdictLabel: string;
  verdictText: string;
  coverageRows: Task1CoverageRow[];
  mustFixItems: string[];
  optionalUpgrades: string[];
  reusablePatterns: string[];
  sampleHeading: string;
  sampleNote: string;
}

const unique = (items: string[]) =>
  Array.from(new Set(items.map(item => item.replace(/\s+/g, ' ').trim()).filter(Boolean)));

const looksWeak = (text: string) =>
  /\b(missing|incomplete|unclear|not clear|not enough|needs?|lack|lacks|weak|thin|add|rewrite|check whether)\b/i.test(text);

const looksMissing = (text: string) =>
  /\b(no overview|without overview|missing overview|no comparison|no data|does not include|failed to)\b/i.test(text);

const statusFromFeedback = (text: string, positive: Task1CoverageStatus = 'covered'): Task1CoverageStatus => {
  if (looksMissing(text)) return 'missing';
  if (looksWeak(text)) return 'thin';
  return positive;
};

const coverageRows = (feedback: WritingTask1Feedback): Task1CoverageRow[] => [
  {
    label: 'Overview',
    status: statusFromFeedback(feedback.overviewFeedback),
    detail: feedback.overviewFeedback,
  },
  {
    label: 'Key features',
    status: statusFromFeedback(feedback.keyFeaturesFeedback),
    detail: feedback.keyFeaturesFeedback,
  },
  {
    label: 'Comparisons',
    status: statusFromFeedback(feedback.comparisonFeedback),
    detail: feedback.comparisonFeedback,
  },
  {
    label: 'Data support',
    status: statusFromFeedback(feedback.taskAchievement.feedback),
    detail: feedback.taskAchievement.feedback,
  },
  {
    label: 'Accuracy',
    status: statusFromFeedback(feedback.dataAccuracyFeedback, 'passed'),
    detail: feedback.dataAccuracyFeedback,
  },
];

const defaultComparableUpgrades = (feedback: WritingTask1Feedback) => {
  const upgrades = [
    'Overview 可以再短一点：先写全局趋势，再点出例外或排名变化。',
    /\branked first\b|\branked last\b/i.test(feedback.report)
      ? '“ranked first/last” 可以换成 “recorded the highest/lowest figure”，更像 Task 1 的数据描述。'
      : '排名和极值尽量写成数据关系，例如 recorded the highest figure 或 had the lowest figure。',
    '主体段的数据已经够了；优先筛掉重复数字，把比较关系写清楚。',
  ];

  return upgrades;
};

const taskTypeUpgrades = (
  prompt: WritingTask1AcademicPrompt,
  feedback: WritingTask1Feedback,
) => {
  if (prompt.taskType === 'process') {
    return [
      'Overview 只抓流程骨架：起点、终点、是否循环，不需要塞细节。',
      '主体段按阶段分组，少用流水账式 one step after another。',
      '能用被动就用被动，例如 is collected, is sorted, is delivered。',
    ];
  }

  if (prompt.taskType === 'map') {
    return [
      'Overview 先说最大变化：新增、拆除、替换、扩建或位置变化。',
      '主体段按区域写，例如 north / central area / south-east，不要按图上每个小物件罗列。',
      '位置表达比高级词更重要，先把 where 和 what changed 写清楚。',
    ];
  }

  return defaultComparableUpgrades(feedback);
};

const correctionUpgrades = (feedback: WritingTask1Feedback) =>
  feedback.languageCorrections
    .filter(item => item.original.trim() && item.correction.trim())
    .filter(item => feedback.report.toLowerCase().includes(item.original.toLowerCase()))
    .map(item => `${item.original} 可以换成 ${item.correction}。${item.explanation}`)
    .slice(0, 2);

const reusableDefaults = (prompt: WritingTask1AcademicPrompt) => {
  if (prompt.taskType === 'process') {
    return [
      'Overall, the process begins with X and ends with Y.',
      'After X has been completed, Y is carried out.',
      'The final stage involves ..., before the product is ...',
    ];
  }

  if (prompt.taskType === 'map') {
    return [
      'Overall, the area became more ..., with X replacing Y.',
      'The most noticeable change was the addition/removal of X in the ... area.',
      'By the end of the period, X had been converted into Y.',
    ];
  }

  return [
    'Overall, figures fell/rose in most categories, while X was the only exception.',
    'X recorded the highest figure in ..., while Y had the lowest.',
    'The figure for X fell/rose by ... to ...',
  ];
};

const verdictLabel = (route: Task1LearnerRoute, mustFixItems: string[]) => {
  if (mustFixItems.length) return 'Must Fix First';
  if (route === 'invalid') return 'Report Not Ready';
  if (route === 'rescue') return 'Structure First';
  if (route === 'guided') return 'Guided Practice';
  if (route === 'band_unlocker') return 'Precision Upgrade';
  return 'Optional Upgrade';
};

const verdictText = ({
  route,
  feedback,
  coverage,
  mustFixItems,
}: {
  route: Task1LearnerRoute;
  feedback: WritingTask1Feedback;
  coverage: Task1CoverageRow[];
  mustFixItems: string[];
}) => {
  if (mustFixItems.length) {
    const firstIssue = coverage.find(item => item.status === 'missing' || item.status === 'thin')?.label.toLowerCase();
    return firstIssue
      ? `先处理 ${firstIssue} 这一块，再看表达优化。`
      : '先处理必须修改项，再看表达优化。';
  }

  if (route === 'rescue') {
    return '先把四段结构搭起来：改写题目、写 overview、分两组写细节。';
  }

  if (route === 'guided') {
    return '内容已经能分析了。下一步把 overview 和主体分组写稳。';
  }

  if (feedback.estimatedBand >= 7) {
    return '内容已经比较稳定。下一步看 overview 是否更锋利、数据是否更会取舍。';
  }

  return '这篇已经基本达标，不需要重写。可以重点优化 overview，让主要趋势、例外和最高/最低值更突出。';
};

export const buildTask1FeedbackDisplayModel = ({
  prompt,
  feedback,
  route,
}: {
  prompt: WritingTask1AcademicPrompt;
  feedback: WritingTask1Feedback;
  route: Task1LearnerRoute;
}): Task1FeedbackDisplayModel => {
  const mustFixItems = feedback.mustFix.filter(item => item.trim());
  const coverage = coverageRows(feedback);
  const optionalUpgrades = unique([
    ...correctionUpgrades(feedback),
    ...taskTypeUpgrades(prompt, feedback),
  ]).slice(0, 3);

  return {
    verdictLabel: verdictLabel(route, mustFixItems),
    verdictText: verdictText({ route, feedback, coverage, mustFixItems }),
    coverageRows: coverage,
    mustFixItems,
    optionalUpgrades,
    reusablePatterns: unique([...feedback.reusableReportPatterns, ...reusableDefaults(prompt)]).slice(0, 4),
    sampleHeading: 'Optional Sample Answer',
    sampleNote: '可选参考版本：先看上面的建议，再展开对照。',
  };
};
