import type { SpeakingFeedback, WritingFeedback, WritingTask1Feedback } from '@/src/lib/ai/schemas';
import type {
  PracticeRecord,
  SpeakingPracticeRecord,
  WritingTask1PracticeRecord,
  WritingTask2PracticeRecord,
} from '@/src/lib/practiceRecords';

const at = (day: number) => new Date(Date.UTC(2026, 4, day, 10, 0)).toISOString();

const speakingFeedback = (
  question: string,
  score: number,
  criteria: [number, number, number],
): SpeakingFeedback => ({
  mode: 'practice', module: 'speaking', part: 2, question, transcript: 'Synthetic portfolio demo response.',
  bandEstimateExcludingPronunciation: score,
  scores: {
    fluencyCoherence: criteria[0], lexicalResource: criteria[1], grammaticalRangeAccuracy: criteria[2],
    pronunciation: null, pronunciationNote: 'Not assessed from text.',
  },
  fatalErrors: [], naturalnessHints: [], band9Refinements: [], preservedStyle: [], upgradedAnswer: '',
  reusableExample: null, obsidianMarkdown: '',
});

const task2Feedback = (question: string, criteria: [number, number, number, number]): WritingFeedback => ({
  mode: 'practice', module: 'writing', task: 'task2', question, essay: 'Synthetic portfolio demo essay.',
  scores: {
    taskResponse: criteria[0], coherenceCohesion: criteria[1], lexicalResource: criteria[2], grammaticalRangeAccuracy: criteria[3],
  },
  frameworkFeedback: [], essayLevelWarnings: [], sentenceFeedback: [],
  vocabularyUpgrade: { topicVocabulary: [], expressionUpgrades: [] },
  modelAnswer: '', reusableArguments: [], obsidianMarkdown: '',
});

const task1Feedback = (taskType: string, score: number): WritingTask1Feedback => ({
  mode: 'practice', module: 'writing_task1', task: 'task1', taskType,
  instruction: 'Summarise the information by selecting and reporting the main features.',
  visualBrief: `Synthetic ${taskType} comparing changes over time.`, report: 'Synthetic portfolio demo report.',
  estimatedBand: score, taskAchievement: { score, feedback: 'Synthetic demo feedback.' },
  overviewFeedback: '', keyFeaturesFeedback: '', comparisonFeedback: '', dataAccuracyFeedback: '', coherenceFeedback: '',
  languageCorrections: [], mustFix: [], rewriteTask: '', reusableReportPatterns: [], improvedReport: '', obsidianMarkdown: '',
});

const speaking = (
  index: number,
  topic: string,
  category: string,
  question: string,
  score: number,
  criteria: [number, number, number],
): SpeakingPracticeRecord => ({
  id: `demo-speaking-${index}`, module: 'speaking', mode: 'practice', status: 'analyzed', part: 2,
  question, questionId: `demo-speaking-question-${index}`, topic, tags: [category],
  createdAt: at(index * 3), updatedAt: at(index * 3), analyzedAt: at(index * 3),
  transcript: 'Synthetic portfolio demo response.', transcriptOrigin: 'manual', transcriptSource: 'manual',
  feedback: speakingFeedback(question, score, criteria),
});

const task1 = (index: number, taskType: string, score: number): WritingTask1PracticeRecord => {
  const feedback = task1Feedback(taskType, score);
  return {
    id: `demo-writing-task1-${index}`, module: 'writing_task1', task: 'task1', mode: 'practice', status: 'analyzed',
    question: feedback.instruction, questionId: `demo-task1-question-${index}`, topic: 'Academic data', tags: [], taskType,
    createdAt: at(index * 4 + 1), updatedAt: at(index * 4 + 1), analyzedAt: at(index * 4 + 1),
    prompt: feedback.instruction, instruction: feedback.instruction, visualBrief: feedback.visualBrief, dataSummary: [],
    quickPlan: { overview: '', keyFeatures: '', comparisons: '', paragraphPlan: '' },
    report: feedback.report, feedback,
  };
};

const task2 = (
  index: number,
  topic: string,
  question: string,
  criteria: [number, number, number, number],
): WritingTask2PracticeRecord => ({
  id: `demo-writing-task2-${index}`, module: 'writing', task: 'task2', mode: 'practice', status: 'analyzed',
  question, questionId: `demo-task2-question-${index}`, topic, tags: [topic], taskType: 'opinion',
  createdAt: at(index * 4 + 2), updatedAt: at(index * 4 + 2), analyzedAt: at(index * 4 + 2),
  phase: 'results', frameworkChat: [], frameworkInput: '', finalFrameworkSummary: '', essay: 'Synthetic portfolio demo essay.',
  feedback: task2Feedback(question, criteria),
});

export const progressDemoRecords: readonly PracticeRecord[] = [
  speaking(1, 'Daily routines', 'Daily Life', 'What part of your day do you enjoy most?', 5.5, [5.5, 5.5, 5]),
  task1(1, 'line graph', 5.5),
  task2(1, 'Education', 'Universities should focus on practical skills. To what extent do you agree?', [5.5, 5.5, 6, 5.5]),
  speaking(2, 'Technology habits', 'Technology', 'Describe a useful app that you use regularly.', 6, [6, 6, 5.5]),
  task2(2, 'Transport & Cities', 'Public transport should be free in major cities. Discuss.', [6, 6, 6, 5.5]),
  task1(2, 'bar chart', 6),
  speaking(3, 'A memorable journey', 'Travel & Places', 'Describe a journey that you remember well.', 6.5, [6.5, 6, 6]),
  task2(3, 'Technology', 'Artificial intelligence will improve education. Discuss both views.', [6, 6.5, 6.5, 6]),
  task1(3, 'line graph', 6.5),
  speaking(4, 'A book worth sharing', 'Books & Reading', 'Describe a book you would recommend.', 6.5, [6.5, 6.5, 6]),
  task2(4, 'Education', 'Schools should teach financial literacy. To what extent do you agree?', [6.5, 6.5, 6.5, 6]),
];

export const getProgressDemoRecords = (): PracticeRecord[] => progressDemoRecords
  .map(record => ({ ...record }))
  .sort((a, b) => (b.analyzedAt || b.updatedAt).localeCompare(a.analyzedAt || a.updatedAt));
