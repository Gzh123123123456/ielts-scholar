import {
  ProviderDiagnostic,
  SpeakingFeedback,
  SpeakingTargetValidationResult,
  TargetAnswerStatus,
  WritingFeedback,
  WritingTargetValidationResult,
} from './schemas';
import {
  routedAnalyzeSpeaking,
  routedAnalyzeWriting,
  routedValidateSpeakingTarget,
  routedValidateWritingTarget,
} from './router';
import {
  buildSpeakingTrainingMarkdown,
  buildWritingTask2TrainingMarkdown,
} from '../markdownExport';

const MAX_TARGET_GENERATION_ATTEMPTS = 2;
const TARGET_NOT_STABLE_ZH = '这版目标答案还没有稳定达到目标层级，需要继续强化。';

const averageWritingScore = (feedback: WritingFeedback) =>
  Math.round(((feedback.scores.taskResponse +
    feedback.scores.coherenceCohesion +
    feedback.scores.lexicalResource +
    feedback.scores.grammaticalRangeAccuracy) / 4) * 2) / 2;

const targetValidatedZh = (floor: number) =>
  `独立评分校验已达到 ${floor.toFixed(1)}+ 目标层级。`;

const normalizeFailedStatus = (status: TargetAnswerStatus): TargetAnswerStatus =>
  status === 'meets_target' ? 'meets_target' : status === 'failed' ? 'failed' : 'borderline';

const applySpeakingValidation = (
  feedback: SpeakingFeedback,
  validation: SpeakingTargetValidationResult,
): SpeakingFeedback => {
  const status = normalizeFailedStatus(validation.status);
  const next = {
    ...feedback,
    targetAnswerFloor: validation.targetFloor,
    targetAnswerStatus: status,
    targetAnswerValidationScores: validation.scores,
    targetAnswerValidationRationaleZh: validation.rationaleZh,
    targetAnswerRationaleZh: validation.rationaleZh,
    targetAnswerRepairFocusZh: status === 'meets_target'
      ? feedback.targetAnswerRepairFocusZh
      : validation.repairFocusZh || TARGET_NOT_STABLE_ZH,
    targetValidationZh: status === 'meets_target'
      ? targetValidatedZh(validation.targetFloor)
      : TARGET_NOT_STABLE_ZH,
  };
  return {
    ...next,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
  };
};

const applyWritingValidation = (
  feedback: WritingFeedback,
  validation: WritingTargetValidationResult,
): WritingFeedback => {
  const status = normalizeFailedStatus(validation.status);
  const next = {
    ...feedback,
    targetAnswerFloor: validation.targetFloor,
    targetAnswerStatus: status,
    targetAnswerValidationScores: validation.scores,
    targetAnswerValidationRationaleZh: validation.rationaleZh,
    targetAnswerRationaleZh: validation.rationaleZh,
    targetAnswerRepairFocusZh: status === 'meets_target'
      ? feedback.targetAnswerRepairFocusZh
      : validation.repairFocusZh || TARGET_NOT_STABLE_ZH,
    targetValidationZh: status === 'meets_target'
      ? targetValidatedZh(validation.targetFloor)
      : TARGET_NOT_STABLE_ZH,
  };
  return {
    ...next,
    obsidianMarkdown: buildWritingTask2TrainingMarkdown(next),
  };
};

const shouldValidateSpeakingTarget = (feedback: SpeakingFeedback) =>
  feedback.targetAnswerLayer !== 'high_band_stability' &&
  feedback.targetAnswerStatus !== 'not_generated' &&
  feedback.targetAnswerStatus !== 'not_applicable' &&
  Boolean(feedback.upgradedAnswer.trim());

const shouldValidateWritingTarget = (feedback: WritingFeedback) =>
  feedback.targetAnswerLayer !== 'high_band_stability' &&
  feedback.targetAnswerStatus !== 'not_generated' &&
  feedback.targetAnswerStatus !== 'not_applicable' &&
  Boolean(feedback.modelAnswer.trim());

export const validateSpeakingTargetLoop = async (
  initialFeedback: SpeakingFeedback,
  insufficientSample = false,
): Promise<{ feedback: SpeakingFeedback; diagnostic?: ProviderDiagnostic }> => {
  if (!shouldValidateSpeakingTarget(initialFeedback)) {
    return { feedback: initialFeedback };
  }

  let current = initialFeedback;
  let lastDiagnostic: ProviderDiagnostic | undefined;
  let repairFocus = '';

  for (let attempt = 1; attempt <= MAX_TARGET_GENERATION_ATTEMPTS; attempt += 1) {
    const validationResult = await routedValidateSpeakingTarget({
      part: current.part,
      question: current.question,
      candidateTargetAnswer: current.upgradedAnswer,
      targetFloor: current.targetAnswerFloor || (current.bandEstimateExcludingPronunciation >= 7 ? 8 : 7),
      originalCurrentScore: current.bandEstimateExcludingPronunciation,
      targetLayer: current.targetAnswerLayer,
    });
    lastDiagnostic = validationResult.diagnostic;
    const validated = applySpeakingValidation(current, validationResult.feedback);

    if (validationResult.feedback.status === 'meets_target' || attempt >= MAX_TARGET_GENERATION_ATTEMPTS) {
      return { feedback: validated, diagnostic: lastDiagnostic };
    }

    repairFocus = validationResult.feedback.repairFocusZh || TARGET_NOT_STABLE_ZH;
    const regenerated = await routedAnalyzeSpeaking({
      part: current.part,
      question: current.question,
      transcript: current.transcript,
      targetRepairFocus: repairFocus,
      targetAttempt: attempt + 1,
      priorTargetAnswer: current.upgradedAnswer,
    }, insufficientSample);
    lastDiagnostic = regenerated.diagnostic;
    current = regenerated.feedback;
  }

  return { feedback: current, diagnostic: lastDiagnostic };
};

export const validateWritingTargetLoop = async (
  initialFeedback: WritingFeedback,
  insufficientSample = false,
  frameworkNotes?: string,
  finalFrameworkSummary?: string,
): Promise<{ feedback: WritingFeedback; diagnostic?: ProviderDiagnostic }> => {
  if (!shouldValidateWritingTarget(initialFeedback)) {
    return { feedback: initialFeedback };
  }

  let current = initialFeedback;
  let lastDiagnostic: ProviderDiagnostic | undefined;
  let repairFocus = '';

  for (let attempt = 1; attempt <= MAX_TARGET_GENERATION_ATTEMPTS; attempt += 1) {
    const validationResult = await routedValidateWritingTarget({
      task: current.task,
      question: current.question,
      candidateTargetAnswer: current.modelAnswer,
      targetFloor: current.targetAnswerFloor || (averageWritingScore(current) >= 7 ? 8 : 7),
      originalCurrentScore: averageWritingScore(current),
      targetLayer: current.targetAnswerLayer,
    });
    lastDiagnostic = validationResult.diagnostic;
    const validated = applyWritingValidation(current, validationResult.feedback);

    if (validationResult.feedback.status === 'meets_target' || attempt >= MAX_TARGET_GENERATION_ATTEMPTS) {
      return { feedback: validated, diagnostic: lastDiagnostic };
    }

    repairFocus = validationResult.feedback.repairFocusZh || TARGET_NOT_STABLE_ZH;
    const regenerated = await routedAnalyzeWriting({
      task: current.task,
      question: current.question,
      essay: current.essay,
      frameworkNotes,
      finalFrameworkSummary,
      targetRepairFocus: repairFocus,
      targetAttempt: attempt + 1,
      priorTargetAnswer: current.modelAnswer,
    }, insufficientSample);
    lastDiagnostic = regenerated.diagnostic;
    current = regenerated.feedback;
  }

  return { feedback: current, diagnostic: lastDiagnostic };
};
