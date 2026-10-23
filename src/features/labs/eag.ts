/**
 * Estimated average glucose (mg/dL) from HbA1c (%), using the published ADAG
 * linear formula eAG = 28.7 × A1c − 46.7, rounded half up to a whole number. It
 * is a derived display value: only HbA1c is stored. HbA1c has one decimal place
 * (numeric(4,1)), so the sum is done in exact integer tenths: in floating point
 * 28.7 × 6 − 46.7 is 125.4999… and would round down.
 */
export function eagFromHba1c(hba1c: number): number {
  const tenths = Math.round(hba1c * 10);
  return Math.round((287 * tenths - 4670) / 100);
}
