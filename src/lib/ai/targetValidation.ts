import {
  ProviderDiagnostic,
  SpeakingFeedback,
  SpeakingScoreOnlyResult,
  SpeakingTargetValidationResult,
  TargetAnswerStatus,
  WritingFeedback,
  WritingTargetValidationResult,
} from './schemas';
import {
  routedAnalyzeSpeaking,
  routedScoreSpeakingOnly,
  routedAnalyzeWriting,
  routedValidateWritingTarget,
} from './router';
import {
  buildSpeakingTrainingMarkdown,
  buildWritingTask2TrainingMarkdown,
} from '../markdownExport';
import {
  HIGH_BAND_BOUNDARY_ZH,
  HIGH_BAND_STABLE_ZH,
  resolveSpeakingTargetState,
  resolveWritingTargetState,
} from '../scoreLayer';

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

const speakingValidationFloor = (feedback: SpeakingFeedback) => {
  if (feedback.targetAnswerLayer === 'band_7_to_7_5') return 7;
  if (feedback.targetAnswerLayer === 'band_8_plus') return 8;
  return feedback.targetAnswerFloor || (feedback.bandEstimateExcludingPronunciation >= 7 ? 8 : 7);
};

const writingValidationFloor = (feedback: WritingFeedback) => {
  if (feedback.targetAnswerLayer === 'band_7_to_7_5') return 7.5;
  if (feedback.targetAnswerLayer === 'band_8_plus') return 8;
  return feedback.targetAnswerFloor || (averageWritingScore(feedback) >= 7 ? 8 : 7);
};

const applySpeakingValidation = (
  feedback: SpeakingFeedback,
  validation: SpeakingTargetValidationResult,
): SpeakingFeedback => {
  const status = normalizeFailedStatus(validation.status);
  const nextBase = {
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
  const targetState = status === 'meets_target' && nextBase.targetAnswerLayer !== 'high_band_stability'
    ? 'generated_target'
    : resolveSpeakingTargetState(nextBase);
  const next = {
    ...nextBase,
    targetState,
    targetValidationZh: targetState === 'high_band_boundary'
      ? HIGH_BAND_BOUNDARY_ZH
      : nextBase.targetValidationZh,
    highBandStabilityZh: targetState === 'high_band_stable'
      ? nextBase.highBandStabilityZh || HIGH_BAND_STABLE_ZH
      : nextBase.highBandStabilityZh,
    targetAnswerRepairFocusZh: targetState === 'high_band_boundary'
      ? undefined
      : nextBase.targetAnswerRepairFocusZh,
  };
  return {
    ...next,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
  };
};

export const applyAuthoritativeSpeakingScore = (
  feedback: SpeakingFeedback,
  score: SpeakingScoreOnlyResult,
): SpeakingFeedback => {
  const targetAnswerLayer = score.bandEstimateExcludingPronunciation >= 8
    ? 'high_band_stability'
    : score.bandEstimateExcludingPronunciation >= 7
      ? 'band_8_plus'
      : 'band_7_to_7_5';
  const targetAnswerFloor = targetAnswerLayer === 'band_7_to_7_5' ? 7 : 8;
  const nextBase: SpeakingFeedback = {
    ...feedback,
    bandEstimateExcludingPronunciation: score.bandEstimateExcludingPronunciation,
    estimateRationaleZh: score.rationaleZh || feedback.estimateRationaleZh,
    scores: {
      ...feedback.scores,
      fluencyCoherence: score.scores.fluencyCoherence,
      lexicalResource: score.scores.lexicalResource,
      grammaticalRangeAccuracy: score.scores.grammaticalRangeAccuracy,
      pronunciation: null,
    },
    targetBandFloor: targetAnswerFloor,
    targetAnswerFloor,
    targetAnswerLayer,
    targetLayer: targetAnswerLayer === 'high_band_stability'
      ? feedback.targetLayer
      : score.bandEstimateExcludingPronunciation >= 7
        ? 'Band 8+ Examiner-Friendly Answer'
        : 'Band 7.0+ Target Answer',
    targetAnswerStatus: targetAnswerLayer === 'high_band_stability'
      ? 'meets_target'
      : feedback.targetAnswerStatus === 'not_generated' || feedback.targetAnswerStatus === 'not_applicable'
        ? feedback.targetAnswerStatus
        : 'borderline',
    targetAnswerValidationScores: undefined,
    targetAnswerValidationRationaleZh: undefined,
    scoreConsistencyNoteZh: 'Visible Speaking score locked by authoritative blind score-only pass.',
  };
  const targetState = resolveSpeakingTargetState(nextBase);
  const next = {
    ...nextBase,
    targetState,
    obsidianMarkdown: '',
  };
  return {
    ...next,
    obsidianMarkdown: buildSpeakingTrainingMarkdown(next),
  };
};

const scoreToSpeakingValidation = (
  score: SpeakingScoreOnlyResult,
  floor: number,
): SpeakingTargetValidationResult => {
  const scores = score.scores;
  const meets = scores.fluencyCoherence >= floor &&
    scores.lexicalResource >= floor &&
    scores.grammaticalRangeAccuracy >= floor &&
    score.bandEstimateExcludingPronunciation >= floor;
  const near = [
    scores.fluencyCoherence,
    scores.lexicalResource,
    scores.grammaticalRangeAccuracy,
    score.bandEstimateExcludingPronunciation,
  ].some(item => item < floor - 0.5);

  return {
    module: 'speaking',
    operation: 'speaking_target_validation',
    targetFloor: floor,
    status: meets ? 'meets_target' : near ? 'failed' : 'borderline',
    scores: {
      fluencyCoherence: scores.fluencyCoherence,
      lexicalResource: scores.lexicalResource,
      grammaticalRangeAccuracy: scores.grammaticalRangeAccuracy,
      pronunciation: null,
    },
    rationaleZh: score.rationaleZh,
    repairFocusZh: meets
      ? ''
      : 'Blind score-only judge did not certify this target at the required threshold. Strengthen development, precision, spoken organization, and grammar control without changing the current learner score.',
  };
};

const applySpeakingCertificationUnavailable = (
  feedback: SpeakingFeedback,
  reason: string,
): SpeakingFeedback => {
  const nextBase: SpeakingFeedback = {
    ...feedback,
    targetAnswerStatus: feedback.targetAnswerLayer === 'high_band_stability' ? feedback.targetAnswerStatus : 'borderline',
    targetAnswerValidationScores: undefined,
    targetAnswerValidationRationaleZh: reason,
    targetAnswerRepairFocusZh: reason,
    targetValidationZh: 'Target certification is not yet verified by the authoritative judge.',
  };
  const targetState = resolveSpeakingTargetState(nextBase);
  const next = {
    ...nextBase,
    targetState,
    obsidianMarkdown: '',
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
  const nextBase = {
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
  const targetState = resolveWritingTargetState(nextBase);
  const next = {
    ...nextBase,
    targetState,
    targetValidationZh: targetState === 'high_band_boundary'
      ? HIGH_BAND_BOUNDARY_ZH
      : nextBase.targetValidationZh,
    highBandStabilityZh: targetState === 'high_band_stable'
      ? nextBase.highBandStabilityZh || HIGH_BAND_STABLE_ZH
      : nextBase.highBandStabilityZh,
    targetAnswerRepairFocusZh: targetState === 'high_band_boundary'
      ? undefined
      : nextBase.targetAnswerRepairFocusZh,
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
): Promise<{ feedback: SpeakingFeedback; diagnostic?: ProviderDiagnostic; diagnostics: ProviderDiagnostic[] }> => {
  if (!shouldValidateSpeakingTarget(initialFeedback)) {
    return { feedback: initialFeedback, diagnostics: [] };
  }

  let current = initialFeedback;
  let lastDiagnostic: ProviderDiagnostic | undefined;
  const diagnostics: ProviderDiagnostic[] = [];
  let repairFocus = '';

  for (let attempt = 1; attempt <= MAX_TARGET_GENERATION_ATTEMPTS; attempt += 1) {
    const floor = speakingValidationFloor(current);
    const validationResult = await routedScoreSpeakingOnly({
      part: current.part,
      question: current.question,
      transcript: current.upgradedAnswer,
    });
    lastDiagnostic = validationResult.diagnostic;
    diagnostics.push(validationResult.diagnostic);
    if (validationResult.diagnostic.failureKind || validationResult.diagnostic.providerName === 'unsupported') {
      return {
        feedback: applySpeakingCertificationUnavailable(
          current,
          validationResult.diagnostic.parseError || validationResult.diagnostic.validationErrors.join('; ') || 'Authoritative Speaking certification unavailable.',
        ),
        diagnostic: lastDiagnostic,
        diagnostics,
      };
    }

    let validation = scoreToSpeakingValidation(validationResult.feedback, floor);
    if (validation.status === 'meets_target' && current.targetAnswerLayer === 'band_8_plus') {
      const confirmationResult = await routedScoreSpeakingOnly({
        part: current.part,
        question: current.question,
        transcript: current.upgradedAnswer,
      });
      lastDiagnostic = confirmationResult.diagnostic;
      diagnostics.push(confirmationResult.diagnostic);
      if (confirmationResult.diagnostic.failureKind || confirmationResult.diagnostic.providerName === 'unsupported') {
        return {
          feedback: applySpeakingCertificationUnavailable(
            current,
            confirmationResult.diagnostic.parseError || confirmationResult.diagnostic.validationErrors.join('; ') || 'Band 8+ consistency confirmation unavailable.',
          ),
          diagnostic: lastDiagnostic,
          diagnostics,
        };
      }
      const confirmation = scoreToSpeakingValidation(confirmationResult.feedback, floor);
      if (confirmation.status !== 'meets_target') validation = confirmation;
    }

    const validated = applySpeakingValidation(current, validation);

    if (validation.status === 'meets_target' || attempt >= MAX_TARGET_GENERATION_ATTEMPTS) {
      return { feedback: validated, diagnostic: lastDiagnostic, diagnostics };
    }

    repairFocus = validation.repairFocusZh || TARGET_NOT_STABLE_ZH;
    const lockedScore: SpeakingScoreOnlyResult = {
      module: 'speaking',
      operation: 'speaking_score_only',
      part: current.part,
      scores: {
        fluencyCoherence: current.scores.fluencyCoherence,
        lexicalResource: current.scores.lexicalResource,
        grammaticalRangeAccuracy: current.scores.grammaticalRangeAccuracy,
        pronunciation: null,
      },
      bandEstimateExcludingPronunciation: current.bandEstimateExcludingPronunciation,
      rationaleZh: current.estimateRationaleZh || '',
    };
    const regenerated = await routedAnalyzeSpeaking({
      part: current.part,
      question: current.question,
      transcript: current.transcript,
      authoritativeScore: lockedScore,
      targetRepairFocus: repairFocus,
      targetAttempt: attempt + 1,
      priorTargetAnswer: current.upgradedAnswer,
    }, insufficientSample);
    lastDiagnostic = regenerated.diagnostic;
    diagnostics.push(regenerated.diagnostic);
    current = applyAuthoritativeSpeakingScore(regenerated.feedback, lockedScore);
  }

  return { feedback: current, diagnostic: lastDiagnostic, diagnostics };
};

export const validateWritingTargetLoop = async (
  initialFeedback: WritingFeedback,
  insufficientSample = false,
  frameworkNotes?: string,
  finalFrameworkSummary?: string,
): Promise<{ feedback: WritingFeedback; diagnostic?: ProviderDiagnostic; diagnostics: ProviderDiagnostic[] }> => {
  if (!shouldValidateWritingTarget(initialFeedback)) {
    return { feedback: initialFeedback, diagnostics: [] };
  }

  let current = initialFeedback;
  let lastDiagnostic: ProviderDiagnostic | undefined;
  const diagnostics: ProviderDiagnostic[] = [];
  let repairFocus = '';

  for (let attempt = 1; attempt <= MAX_TARGET_GENERATION_ATTEMPTS; attempt += 1) {
    const validationResult = await routedValidateWritingTarget({
      task: current.task,
      question: current.question,
      candidateTargetAnswer: current.modelAnswer,
      targetFloor: writingValidationFloor(current),
      originalCurrentScore: averageWritingScore(current),
      targetLayer: current.targetAnswerLayer,
    });
    lastDiagnostic = validationResult.diagnostic;
    diagnostics.push(validationResult.diagnostic);
    const validated = applyWritingValidation(current, validationResult.feedback);

    if (validationResult.feedback.status === 'meets_target' || attempt >= MAX_TARGET_GENERATION_ATTEMPTS) {
      return { feedback: validated, diagnostic: lastDiagnostic, diagnostics };
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
    diagnostics.push(regenerated.diagnostic);
    current = regenerated.feedback;
  }

  return { feedback: current, diagnostic: lastDiagnostic, diagnostics };
};
