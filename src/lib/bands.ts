export const roundToHalfBand = (value: number): number =>
  Math.round(value * 2) / 2;

export const floorToHalfBand = (value: number): number =>
  Math.floor(value * 2) / 2;

export const formatBandEstimate = (value: number | null | undefined, fallback = '-'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return roundToHalfBand(value).toFixed(1);
};

export const conservativeDisplayBand = (value: number | null | undefined): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  if (value > 5.5 && value < 6.0) return 5.5;
  return roundToHalfBand(value);
};

export const formatConservativeBandEstimate = (
  value: number | null | undefined,
  fallback = '-',
): string => {
  const conservative = conservativeDisplayBand(value);
  return conservative === null ? fallback : conservative.toFixed(1);
};

export const formatApproxBandEstimate = (value: number | null | undefined, fallback = 'Not enough data'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return `≈ ${formatConservativeBandEstimate(value)}`;
};

export type TrainingTargetKind = 'answer' | 'modelAnswer' | 'report';

export const getTargetLayer = (estimate: number | null | undefined) => {
  const highLayer = typeof estimate === 'number' && Number.isFinite(estimate) && estimate >= 7.0;
  return highLayer
    ? {
        isHighLayer: true,
        label: 'Band 8+ Examiner-Friendly',
        zh: '8分以上表达与思路升级',
      }
    : {
        isHighLayer: false,
        label: 'Band 7.0+ Target',
        zh: '7分以上目标答案',
      };
};

export const getTargetLabel = (
  estimate: number | null | undefined,
  kind: TrainingTargetKind,
): string => {
  const layer = getTargetLayer(estimate);
  if (kind === 'modelAnswer') {
    return layer.isHighLayer
      ? 'Band 8+ Examiner-Friendly Model Answer'
      : 'Band 7.0+ Target Model Answer';
  }
  if (kind === 'report') {
    return layer.isHighLayer
      ? 'Band 8+ Examiner-Friendly Report'
      : 'Band 7.0+ Target Report';
  }
  return layer.isHighLayer
    ? 'Band 8+ Examiner-Friendly Answer'
    : 'Band 7.0+ Target Answer';
};

export const getTargetLabelZh = (
  estimate: number | null | undefined,
  kind: TrainingTargetKind,
): string => {
  const layer = getTargetLayer(estimate);
  if (kind === 'modelAnswer') {
    return layer.isHighLayer
      ? '8分以上表达与论证升级范文'
      : '7分以上目标范文';
  }
  if (kind === 'report') {
    return layer.isHighLayer
      ? '8分以上表达与概括升级报告'
      : '7分以上目标报告';
  }
  return layer.isHighLayer
    ? '8分以上表达与思路升级答案'
    : '7分以上目标答案';
};

export const capBand = (value: number, cap: number): number =>
  Math.min(value, cap);

export const conservativeRecentEstimate = (scores: number[]): number | null => {
  const valid = scores.filter(score => Number.isFinite(score) && score > 0 && score <= 9);
  if (!valid.length) return null;

  const recent = valid.slice(0, 5);
  const weights = recent.map((_, index) => 1 / (index + 1));
  const weightedAverage = recent.reduce((sum, score, index) => sum + score * weights[index], 0) /
    weights.reduce((sum, weight) => sum + weight, 0);
  const bestRecent = Math.max(...recent);
  const stableAverage = valid.length === 1
    ? Math.min(weightedAverage, 6.5)
    : valid.length === 2
      ? Math.min(weightedAverage, bestRecent - 0.5, 7)
      : weightedAverage;

  return valid.length < 3 ? floorToHalfBand(stableAverage) : roundToHalfBand(stableAverage);
};

export const combineWritingEstimates = (
  task1Estimate: number | null,
  task1Count: number,
  task2Estimate: number | null,
  task2Count: number,
): number | null => {
  if (task1Estimate === null && task2Estimate === null) return null;
  if (task2Estimate !== null && task1Estimate === null) {
    return task2Count < 2 ? floorToHalfBand(Math.min(task2Estimate, task2Estimate - 0.25)) : task2Estimate;
  }
  if (task1Estimate !== null && task2Estimate === null) {
    const capped = task1Count < 2 ? Math.min(task1Estimate, 6) : task1Estimate;
    return floorToHalfBand(capped);
  }

  const task2Weight = task2Count < 2 ? 0.55 : 0.65;
  const task1Weight = 1 - task2Weight;
  const combined = (task2Estimate as number) * task2Weight + (task1Estimate as number) * task1Weight;
  return (task1Count + task2Count) < 4 ? floorToHalfBand(combined) : roundToHalfBand(combined);
};
