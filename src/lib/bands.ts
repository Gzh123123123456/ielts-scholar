export const roundToHalfBand = (value: number): number =>
  Math.round(value * 2) / 2;

export const floorToHalfBand = (value: number): number =>
  Math.floor(value * 2) / 2;

export const formatBandEstimate = (value: number | null | undefined, fallback = '-'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return roundToHalfBand(value).toFixed(1);
};

export const formatApproxBandEstimate = (value: number | null | undefined, fallback = 'Not enough data'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return `≈ ${roundToHalfBand(value).toFixed(1)}`;
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
