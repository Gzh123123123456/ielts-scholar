export type IELTSModule = 'speaking' | 'writing' | 'writing_task1';
export type IELTSMode = 'practice' | 'mock';
export type SpeakingPart = 1 | 2 | 3;
export type WritingTask = 'task1' | 'task2';
export type ProviderOperation =
  | 'speaking_analysis'
  | 'writing_analysis'
  | 'writing_task1_analysis'
  | 'writing_framework_coach'
  | 'writing_framework_extraction';
export type ProviderFailureKind = 'provider_unavailable' | 'parse_or_schema';

export interface ProviderDiagnostic {
  module: IELTSModule;
  operation: ProviderOperation;
  providerName: string;
  modelName?: string;
  requestPayload: unknown;
  rawResponse: unknown;
  parsedJson: unknown;
  parseError?: string;
  validationErrors: string[];
  fallbackUsed: boolean;
  failureKind?: ProviderFailureKind;
  normalizedFields?: string[];
  timestamp: string;
}

export interface ScoreSet {
  fluencyCoherence?: number;
  lexicalResource: number;
  grammaticalRangeAccuracy: number;
  pronunciation?: number | null;
  taskResponse?: number;
  coherenceCohesion?: number;
}

export interface FatalError {
  original: string;
  correction: string;
  tag: string;
  explanationZh: string;
}

export interface NaturalnessHint {
  original: string;
  better: string;
  tag: string;
  explanationZh: string;
}

export interface Band9Refinement {
  observation: string;
  refinement: string;
  explanationZh: string;
}

export interface SpeakingFeedback {
  mode: IELTSMode;
  module: 'speaking';
  part: SpeakingPart;
  question: string;
  transcript: string;
  bandEstimateExcludingPronunciation: number;
  scores: {
    fluencyCoherence: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
    pronunciation: null;
    pronunciationNote: string;
  };
  fatalErrors: FatalError[];
  naturalnessHints: NaturalnessHint[];
  band9Refinements: Band9Refinement[];
  preservedStyle: { text: string; reasonZh: string }[];
  upgradedAnswer: string;
  reusableExample: {
    example: string;
    canBeReusedFor: string[];
    explanationZh: string;
  } | null;
  obsidianMarkdown: string;
}

export interface WritingFeedback {
  mode: IELTSMode;
  module: 'writing';
  task: WritingTask;
  question: string;
  essay: string;
  scores: {
    taskResponse: number;
    coherenceCohesion: number;
    lexicalResource: number;
    grammaticalRangeAccuracy: number;
  };
  frameworkFeedback: {
    issue: string;
    suggestionZh: string;
    severity: 'fatal' | 'naturalness' | 'preserved';
  }[];
  sentenceFeedback: {
    original: string;
    correction: string;
    dimension: 'TR' | 'CC' | 'LR' | 'GRA';
    tag: string;
    explanationZh: string;
  }[];
  modelAnswer: string;
  reusableArguments: {
    argument: string;
    canBeReusedFor: string[];
    explanationZh: string;
  }[];
  obsidianMarkdown: string;
}

export interface WritingTask1Feedback {
  mode: IELTSMode;
  module: 'writing_task1';
  task: 'task1';
  taskType: string;
  instruction: string;
  visualBrief: string;
  report: string;
  estimatedBand: number;
  taskAchievement: {
    score: number;
    feedback: string;
  };
  overviewFeedback: string;
  keyFeaturesFeedback: string;
  comparisonFeedback: string;
  dataAccuracyFeedback: string;
  coherenceFeedback: string;
  languageCorrections: {
    original: string;
    correction: string;
    explanation: string;
  }[];
  mustFix: string[];
  rewriteTask: string;
  reusableReportPatterns: string[];
  improvedReport: string;
  modelExcerpt?: string;
  obsidianMarkdown: string;
}

export interface WritingFrameworkSummary {
  mode: IELTSMode;
  module: 'writing';
  task: 'task2';
  question: string;
  sourceNotes: string;
  position: string;
  viewA: string;
  viewB: string;
  myOpinion: string;
  paragraphPlan: string;
  possibleExample: string;
  editableSummary: string;
}

export type WritingFrameworkReadiness = 'not_ready' | 'almost_ready' | 'ready_to_write';

export interface WritingFrameworkCoachFeedback {
  mode: IELTSMode;
  module: 'writing';
  task: 'task2';
  question: string;
  sourceNotes: string;
  readiness: WritingFrameworkReadiness;
  checklist: {
    taskTypeAnswered: boolean;
    clearPosition: boolean;
    bothViewsCovered: boolean;
    supportExists: boolean;
    paragraphPlanClear: boolean;
  };
  mainGaps: string[];
  nextQuestions: string[];
  finalFixes: string[];
  readySummary: string;
  message: string;
  comments?: string[];
}
