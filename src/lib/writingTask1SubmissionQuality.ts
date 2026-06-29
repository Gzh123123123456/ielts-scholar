export type Task1SubmissionQualityKind = 'analyzable' | 'weak_analyzable' | 'not_analyzable';

export type Task1LearnerRoute =
  | 'invalid'
  | 'rescue'
  | 'guided'
  | 'coverage_repair'
  | 'optional_upgrade'
  | 'band_unlocker';

export interface Task1PromptMatchCandidate {
  id: string;
  taskType: string;
  topic: string;
  sourceText: string;
}

export interface Task1SubmissionQuality {
  kind: Task1SubmissionQualityKind;
  route: Task1LearnerRoute;
  wordCount: number;
  reasons: string[];
  nextSteps: string[];
}

const englishWordPattern = /[a-zA-Z][a-zA-Z'-]*/g;

const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

const uniqueRatio = (tokens: string[]) => {
  if (!tokens.length) return 0;
  return new Set(tokens.map(token => token.toLowerCase())).size / tokens.length;
};

const sentenceCount = (text: string) =>
  text
    .split(/[.!?]+/)
    .map(part => part.trim())
    .filter(part => (part.match(englishWordPattern) || []).length >= 4)
    .length;

const overlapRatio = (answerTokens: string[], sourceText: string) => {
  if (!answerTokens.length || !sourceText.trim()) return 0;
  const sourceTokens = new Set((sourceText.toLowerCase().match(englishWordPattern) || []).filter(token => token.length > 2));
  if (!sourceTokens.size) return 0;
  const copied = answerTokens.filter(token => sourceTokens.has(token.toLowerCase())).length;
  return copied / answerTokens.length;
};

const task1SignalCount = (text: string) => {
  const lower = text.toLowerCase();
  const signalGroups = [
    /\b(overall|in general|it is clear|it can be seen|the main trend|broadly)\b/,
    /\b(increase|increased|rise|rose|grew|growth|decline|declined|fall|fell|drop|dropped|fluctuated|remained|peaked)\b/,
    /\b(higher|lower|largest|smallest|highest|lowest|whereas|while|compared|in contrast|respectively)\b/,
    /\d/,
    /\b(percent|percentage|proportion|share|million|thousand|minutes|dollars|stage|process|map|north|south|east|west)\b/,
  ];
  return signalGroups.filter(pattern => pattern.test(lower)).length;
};

const genericMatchTerms = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'shows',
  'show',
  'chart',
  'table',
  'graph',
  'diagram',
  'compares',
  'compare',
  'summarize',
  'summarise',
  'information',
  'main',
  'features',
  'where',
  'whereas',
  'while',
  'overall',
  'figure',
  'figures',
  'highest',
  'lowest',
  'average',
  'different',
  'period',
  'year',
  'years',
  'using',
  'measured',
  'percentage',
  'percent',
]);

const matchTokens = (text: string) =>
  Array.from(new Set((text.toLowerCase().match(/[a-z][a-z+-]*/g) || [])
    .filter(token => token.length >= 4 && !genericMatchTerms.has(token))));

export const findLikelyTask1PromptMismatch = (
  report: string,
  currentPrompt: Task1PromptMatchCandidate,
  promptBank: Task1PromptMatchCandidate[],
) => {
  const reportTokens = matchTokens(report);
  if (reportTokens.length < 6) return null;

  const scorePrompt = (prompt: Task1PromptMatchCandidate) => {
    const sourceTokens = new Set(matchTokens(`${prompt.taskType} ${prompt.topic} ${prompt.sourceText}`));
    const matches = reportTokens.filter(token => sourceTokens.has(token));
    return {
      prompt,
      score: matches.length,
      matches,
    };
  };

  const currentScore = scorePrompt(currentPrompt);
  const bestOther = promptBank
    .filter(prompt => prompt.id !== currentPrompt.id)
    .map(scorePrompt)
    .sort((a, b) => b.score - a.score)[0];

  if (!bestOther) return null;
  const clearLead = bestOther.score >= currentScore.score + 3;
  const enoughEvidence = bestOther.score >= 5;

  if (!clearLead || !enoughEvidence) return null;

  return {
    currentScore,
    suggestedPrompt: bestOther.prompt,
    matchedTerms: bestOther.matches.slice(0, 8),
  };
};

export const evaluateTask1SubmissionQuality = (
  report: string,
  sourceText = '',
): Task1SubmissionQuality => {
  const trimmed = report.trim();
  const wordCount = countWords(trimmed);
  const englishTokens = trimmed.match(englishWordPattern) || [];
  const alphaChars = (trimmed.match(/[a-zA-Z]/g) || []).length;
  const visibleChars = trimmed.replace(/\s/g, '').length;
  const alphaRatio = visibleChars ? alphaChars / visibleChars : 0;
  const repeatedRun = /(.)\1{12,}/.test(trimmed);
  const repetitionRatio = uniqueRatio(englishTokens);
  const connectedSentences = sentenceCount(trimmed);
  const taskSignals = task1SignalCount(trimmed);
  const copiedPromptRatio = overlapRatio(englishTokens, sourceText);

  const reasons: string[] = [];
  const nextSteps: string[] = [];

  if (wordCount < 15) {
    reasons.push('The submission is too short to judge as connected Task 1 writing.');
    nextSteps.push('Write one introduction sentence, one overview sentence, and two short detail sentences.');
  }
  if (alphaRatio < 0.45) {
    reasons.push('The text does not contain enough readable English words.');
    nextSteps.push('Use complete English sentences rather than symbols, fragments, or copied data only.');
  }
  if (repeatedRun || (englishTokens.length >= 30 && repetitionRatio < 0.24)) {
    reasons.push('The text is highly repetitive, so a band estimate would be unreliable.');
    nextSteps.push('Rewrite with four different report functions: introduction, overview, detail group 1, detail group 2.');
  }
  if (wordCount >= 15 && connectedSentences === 0) {
    reasons.push('The submission is not yet written as connected report text.');
    nextSteps.push('Turn notes into full sentences with a subject, verb, and data point.');
  }
  if (englishTokens.length >= 25 && copiedPromptRatio > 0.82) {
    reasons.push('The answer appears to mostly copy the task wording rather than produce an original report.');
    nextSteps.push('Paraphrase the task in one sentence, then add your own overview and selected details.');
  }

  if (reasons.length) {
    return {
      kind: 'not_analyzable',
      route: 'invalid',
      wordCount,
      reasons,
      nextSteps: Array.from(new Set(nextSteps)),
    };
  }

  if (wordCount < 80 || taskSignals <= 1) {
    return {
      kind: 'weak_analyzable',
      route: 'rescue',
      wordCount,
      reasons: [
        wordCount < 80
          ? 'The report is related to the task but too thin for normal Task 1 scoring.'
          : 'The report needs clearer Task 1 signals: overview, data, trends, comparisons, or stages.',
      ],
      nextSteps: [
        'Add a no-number overview sentence that states the main pattern.',
        'Choose three important data points or stages.',
        'Add one comparison using higher than, whereas, by contrast, or the largest/smallest.',
      ],
    };
  }

  if (wordCount < 150 || taskSignals <= 3) {
    return {
      kind: 'weak_analyzable',
      route: 'guided',
      wordCount,
      reasons: ['The report can be analyzed, but it still needs a guided Task 1 structure check.'],
      nextSteps: [
        'Keep a four-paragraph structure: introduction, overview, detail group 1, detail group 2.',
        'Make sure each detail paragraph has selected data, not a full list of every number.',
      ],
    };
  }

  return {
    kind: 'analyzable',
    route: 'coverage_repair',
    wordCount,
    reasons: [],
    nextSteps: [],
  };
};

export const routeTask1FeedbackLevel = (
  estimatedBand: number,
  submissionQuality: Task1SubmissionQuality,
): Task1LearnerRoute => {
  if (submissionQuality.route === 'invalid') return 'invalid';
  if (estimatedBand <= 4.5 || submissionQuality.route === 'rescue') return 'rescue';
  if (estimatedBand < 6) return 'guided';
  if (estimatedBand < 7) return 'optional_upgrade';
  return 'band_unlocker';
};
