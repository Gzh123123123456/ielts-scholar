import type {
  SpeakingFeedback,
  SpeakingTargetAnswerSelfScores,
  TargetAnswerLayer,
  TargetAnswerStatus,
  WritingFeedback,
  WritingTargetAnswerSelfScores,
  WritingTask1Feedback,
} from './ai/schemas';

export type TargetState =
  | 'needs_repair'
  | 'generated_target'
  | 'target_failed_or_borderline'
  | 'high_band_boundary'
  | 'high_band_stable';

export const HIGH_BAND_BOUNDARY_ZH =
  '这版回答已经接近目标层级。单题估分在 7.5/8.0 附近可能有半档波动；下一步重点是稳定自然输出，而不是继续堆高级表达。';

export const HIGH_BAND_STABLE_ZH =
  '当前输出已经进入目标层级。下一步重点是限时稳定、自然复现和迁移到新题，而不是继续生成完整替换版本。';

const hasNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const scoreValues = (scores?: Record<string, unknown>) =>
  Object.values(scores || {}).filter(hasNumber);

const scoresMeetFloor = (scores: number[], floor: number) =>
  scores.length > 0 && scores.every(score => score >= floor);

const scoresBelowFloor = (scores: number[], floor: number) =>
  scores.length > 0 && scores.some(score => score < floor);

const hasIndependentValidation = (
  scores?: SpeakingTargetAnswerSelfScores | WritingTargetAnswerSelfScores,
) => scoreValues(scores as Record<string, unknown> | undefined).length > 0;

const targetStatusFailed = (status?: TargetAnswerStatus) =>
  status === 'borderline' || status === 'failed';

const targetFloorForLayer = (layer?: TargetAnswerLayer, fallback = 8) =>
  layer === 'band_7_to_7_5' ? 7 : fallback;

const hasSpeakingHardBlocker = (feedback: Pick<SpeakingFeedback, 'fatalErrors'>) =>
  feedback.fatalErrors.some(error =>
    error.tag === 'prompt_mismatch' ||
    error.tag === 'insufficient_sample' ||
    /mismatch|insufficient|off.?topic|nonsense/i.test(`${error.tag} ${error.original} ${error.correction}`),
  );

const hasWritingBlocker = (feedback: Pick<WritingFeedback, 'essayLevelWarnings' | 'frameworkFeedback'>) =>
  feedback.essayLevelWarnings.some(warning =>
    /mismatch|under-length|insufficient/i.test(`${warning.title} ${warning.messageZh}`),
  ) || feedback.frameworkFeedback.some(item => item.severity === 'fatal');

export const averageWritingScore = (feedback: Pick<WritingFeedback, 'scores'>) =>
  Math.round(((feedback.scores.taskResponse +
    feedback.scores.coherenceCohesion +
    feedback.scores.lexicalResource +
    feedback.scores.grammaticalRangeAccuracy) / 4) * 2) / 2;

interface ResolveTargetStateInput {
  currentScore: number;
  targetLayer?: TargetAnswerLayer;
  targetFloor?: number;
  targetStatus?: TargetAnswerStatus;
  validationScores?: SpeakingTargetAnswerSelfScores | WritingTargetAnswerSelfScores;
  selfScores?: SpeakingTargetAnswerSelfScores | WritingTargetAnswerSelfScores;
  hasTargetText?: boolean;
  hasFatalBlocker?: boolean;
}

export const resolveTargetState = ({
  currentScore,
  targetLayer,
  targetFloor,
  targetStatus,
  validationScores,
  selfScores,
  hasTargetText,
  hasFatalBlocker,
}: ResolveTargetStateInput): TargetState => {
  if (hasFatalBlocker) return 'needs_repair';
  if (currentScore >= 8) return 'high_band_stable';
  if (targetStatusFailed(targetStatus)) return 'target_failed_or_borderline';
  if (!hasTargetText && targetLayer !== 'high_band_stability') return 'needs_repair';

  const floor = targetFloor || targetFloorForLayer(targetLayer, currentScore >= 7 ? 8 : 7);
  const validationValues = scoreValues(validationScores as Record<string, unknown> | undefined);
  const selfValues = scoreValues(selfScores as Record<string, unknown> | undefined);
  const hasValidation = hasIndependentValidation(validationScores);

  if (hasValidation && scoresBelowFloor(validationValues, floor)) return 'target_failed_or_borderline';
  if (hasValidation && scoresMeetFloor(validationValues, 8) && currentScore >= 7.5 && currentScore < 8) {
    return 'high_band_boundary';
  }
  if (hasValidation && scoresMeetFloor(validationValues, 8) && currentScore >= 8) return 'high_band_stable';
  if (targetStatus === 'meets_target' && !hasValidation && scoresMeetFloor(selfValues, floor)) return 'generated_target';
  if (targetStatus === 'meets_target') return currentScore >= 7.5 && floor >= 8
    ? 'high_band_boundary'
    : 'generated_target';
  if (currentScore < 7) return 'needs_repair';
  return 'generated_target';
};

export const resolveSpeakingTargetState = (feedback: Omit<SpeakingFeedback, 'obsidianMarkdown'>): TargetState => {
  if (hasSpeakingHardBlocker(feedback)) return 'needs_repair';
  if (feedback.bandEstimateExcludingPronunciation >= 8) return 'high_band_stable';
  if (targetStatusFailed(feedback.targetAnswerStatus)) return 'target_failed_or_borderline';
  if (feedback.upgradedAnswer.trim()) return 'generated_target';
  return 'needs_repair';
};

export const resolveWritingTargetState = (feedback: Omit<WritingFeedback, 'obsidianMarkdown'>): TargetState =>
  resolveTargetState({
    currentScore: averageWritingScore(feedback),
    targetLayer: feedback.targetAnswerLayer,
    targetFloor: feedback.targetAnswerFloor,
    targetStatus: feedback.targetAnswerStatus,
    validationScores: feedback.targetAnswerValidationScores,
    selfScores: feedback.targetAnswerSelfScores,
    hasTargetText: Boolean(feedback.modelAnswer.trim()),
    hasFatalBlocker: hasWritingBlocker(feedback),
  });

export const resolveTask1TargetState = (feedback: Omit<WritingTask1Feedback, 'obsidianMarkdown'>): TargetState => {
  if (feedback.estimatedBand >= 8) return 'high_band_stable';
  if (feedback.estimatedBand < 6 || feedback.mustFix.length > 0) return 'needs_repair';
  return feedback.improvedReport.trim() || feedback.modelExcerpt?.trim()
    ? 'generated_target'
    : 'needs_repair';
};

export const isHighBandStableState = (state?: TargetState) => state === 'high_band_stable';
export const isHighBandBoundaryState = (state?: TargetState) => state === 'high_band_boundary';
export const isRepairState = (state?: TargetState) =>
  state === 'needs_repair' || state === 'target_failed_or_borderline';
