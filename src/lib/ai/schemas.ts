export type IELTSModule = 'speaking' | 'writing';
export type IELTSMode = 'practice' | 'mock';
export type SpeakingPart = 1 | 2 | 3;
export type WritingTask = 'task1' | 'task2';
export type ProviderOperation = 'speaking_analysis' | 'writing_analysis' | 'writing_framework_extraction';
export type ProviderFailureKind = 'provider_unavailable' | 'parse_or_schema';

export interface ProviderDiagnostic {
  module: IELTSModule;
  operation: ProviderOperation;
  providerName: string;
  requestPayload: unknown;
  rawResponse: unknown;
  parsedJson: unknown;
  parseError?: string;
  validationErrors: string[];
  fallbackUsed: boolean;
  failureKind?: ProviderFailureKind;
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
