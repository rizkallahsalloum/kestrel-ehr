import { eagFromHba1c } from "./eag";

const TICK_STEP = 0.5;

export type Hba1cPoint = { collectedOn: string; value: number };

export type ChartTick = { hba1c: number; eag: number; y: number };
export type PlottedPoint = Hba1cPoint & { eag: number; x: number; y: number };

export type Hba1cChartScale = {
  min: number;
  max: number;
  ticks: ChartTick[];
  points: PlottedPoint[];
};

/**
 * Scale for the HbA1c chart. The left axis is HbA1c (%) on whole half-percent
 * ticks with at least half a percent of space around the data; the right axis
 * labels the same tick lines with their eAG (mg/dL), so the two axes are one
 * scale and always line up. x and y are percentages of the plot area (y = 0 is
 * the top). Points are ordered oldest first and spread evenly.
 */
export function hba1cChartScale(results: readonly Hba1cPoint[]): Hba1cChartScale | null {
  if (results.length === 0) return null;
  const ordered = [...results].sort((a, b) => a.collectedOn.localeCompare(b.collectedOn));
  const values = ordered.map((result) => result.value);
  const min = floorTo(Math.min(...values) - TICK_STEP / 2);
  const max = ceilTo(Math.max(...values) + TICK_STEP / 2);
  const toY = (value: number) => round(((max - value) / (max - min)) * 100);

  const ticks: ChartTick[] = [];
  for (let tick = min; tick <= max + 1e-9; tick = round(tick + TICK_STEP)) {
    ticks.push({ hba1c: tick, eag: eagFromHba1c(tick), y: toY(tick) });
  }

  const points = ordered.map((result, index) => ({
    ...result,
    eag: eagFromHba1c(result.value),
    x: ordered.length === 1 ? 50 : round((index / (ordered.length - 1)) * 100),
    y: toY(result.value),
  }));

  return { min, max, ticks, points };
}

function floorTo(value: number): number {
  return round(Math.floor(value / TICK_STEP) * TICK_STEP);
}

function ceilTo(value: number): number {
  return round(Math.ceil(value / TICK_STEP) * TICK_STEP);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
