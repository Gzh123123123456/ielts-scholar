import type { SpeakingFeedback, SpeakingThreadAnswer } from './schemas';

export interface Part1ThreadIntegrityExpectedAnswer {
  questionId?: string;
  question: string;
  answer?: string;
  transcript?: string;
}

export interface Part1ThreadIntegrityReport {
  ok: boolean;
  expectedCount: number;
  validCleanRetryCount: number;
  expectedRefs: string[];
  validCleanRetryRefs: string[];
  missingCleanRetryRefs: string[];
  duplicateCleanRetryRefs: string[];
  unknownCleanRetryRefs: string[];
  missingContainers: string[];
  threadAnswerMismatch: string[];
  summary: string;
}

const answerText = (answer: Part1ThreadIntegrityExpectedAnswer | SpeakingThreadAnswer) =>
  ('answer' in answer ? answer.answer : undefined) || ('transcript' in answer ? answer.transcript : undefined) || '';

export const expectedPart1QuestionRefs = (count: number) =>
  Array.from({ length: Math.max(0, count) }, (_, index) => `Q${index + 1}`);

export const validatePart1ThreadFeedbackIntegrity = (
  feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'> | SpeakingFeedback | undefined | null,
  expectedAnswers: Part1ThreadIntegrityExpectedAnswer[],
): Part1ThreadIntegrityReport => {
  const expectedRefs = expectedPart1QuestionRefs(expectedAnswers.length);
  const expectedRefSet = new Set(expectedRefs);
  const missingContainers: string[] = [];
  const threadAnswerMismatch: string[] = [];
  const duplicateCleanRetryRefs: string[] = [];
  const unknownCleanRetryRefs: string[] = [];

  if (!feedback) missingContainers.push('feedback');
  if (feedback?.sessionKind !== 'part1_topic_thread') missingContainers.push('sessionKind');
  if (!feedback?.threadFeedback) missingContainers.push('threadFeedback');
  if (!Array.isArray(feedback?.threadAnswers)) missingContainers.push('threadAnswers');
  if (!Array.isArray(feedback?.threadFeedback?.materialBank?.myUsableMaterial)) missingContainers.push('materialBank.myUsableMaterial');
  if (!Array.isArray(feedback?.threadFeedback?.materialBank?.reusableSpokenLanguage)) missingContainers.push('materialBank.reusableSpokenLanguage');
  if (!Array.isArray(feedback?.threadFeedback?.answerByAnswerCoaching)) missingContainers.push('answerByAnswerCoaching');
  if (!Array.isArray(feedback?.threadFeedback?.highImpactPhraseFixes)) missingContainers.push('highImpactPhraseFixes');
  if (!Array.isArray(feedback?.threadFeedback?.optionalPolish)) missingContainers.push('optionalPolish');

  const threadAnswers = feedback?.threadAnswers || [];
  if (threadAnswers.length !== expectedAnswers.length) {
    threadAnswerMismatch.push(`count:${threadAnswers.length}->${expectedAnswers.length}`);
  }
  expectedAnswers.forEach((expected, index) => {
    const actual = threadAnswers[index];
    if (!actual) return;
    if (expected.questionId && actual.questionId && actual.questionId !== expected.questionId) {
      threadAnswerMismatch.push(`${expectedRefs[index]}:questionId`);
    }
    if (expected.question && actual.question && actual.question.trim() !== expected.question.trim()) {
      threadAnswerMismatch.push(`${expectedRefs[index]}:question`);
    }
    if (answerText(expected).trim() && actual.answer.trim() && actual.answer.trim() !== answerText(expected).trim()) {
      threadAnswerMismatch.push(`${expectedRefs[index]}:answer`);
    }
  });

  const cleanRetryAnswers = feedback?.threadFeedback?.cleanRetryAnswers || [];
  const seen = new Set<string>();
  const validCleanRetryRefs: string[] = [];
  cleanRetryAnswers.forEach(item => {
    const questionRef = item.questionRef?.trim();
    if (!questionRef || !expectedRefSet.has(questionRef)) {
      if (questionRef) unknownCleanRetryRefs.push(questionRef);
      return;
    }
    if (seen.has(questionRef)) {
      duplicateCleanRetryRefs.push(questionRef);
      return;
    }
    seen.add(questionRef);
    if (item.answer?.trim()) validCleanRetryRefs.push(questionRef);
  });
  const missingCleanRetryRefs = expectedRefs.filter(ref => !validCleanRetryRefs.includes(ref));
  const ok = Boolean(
    feedback &&
    feedback.sessionKind === 'part1_topic_thread' &&
    expectedAnswers.length > 0 &&
    missingContainers.length === 0 &&
    threadAnswerMismatch.length === 0 &&
    validCleanRetryRefs.length === expectedAnswers.length &&
    missingCleanRetryRefs.length === 0 &&
    duplicateCleanRetryRefs.length === 0 &&
    unknownCleanRetryRefs.length === 0,
  );

  return {
    ok,
    expectedCount: expectedAnswers.length,
    validCleanRetryCount: validCleanRetryRefs.length,
    expectedRefs,
    validCleanRetryRefs,
    missingCleanRetryRefs,
    duplicateCleanRetryRefs,
    unknownCleanRetryRefs,
    missingContainers,
    threadAnswerMismatch,
    summary: ok
      ? `Part 1 thread feedback complete: ${validCleanRetryRefs.length}/${expectedAnswers.length} clean retry answers.`
      : `Part 1 thread feedback incomplete: ${validCleanRetryRefs.length}/${expectedAnswers.length} valid clean retry answers.`,
  };
};
