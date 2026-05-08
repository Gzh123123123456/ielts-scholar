export const roundToHalfBand = (value: number): number =>
  Math.round(value * 2) / 2;

export const formatBandEstimate = (value: number | null | undefined, fallback = '-'): string => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return fallback;
  return roundToHalfBand(value).toFixed(1);
};
