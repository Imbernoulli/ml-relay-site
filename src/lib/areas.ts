// MLS-Bench's area taxonomy. The README writes a task's area as "<area> / <topic>";
// filters and badges use the top-level area, in this fixed order.
export const AREA_ORDER = [
  "Language Models",
  "Classical & Adaptive Learning",
  "Reinforcement Learning",
  "Optimization & Theory",
  "Robotics",
  "Vision & Generation",
  "Deep Learning",
  "ML Systems & Efficient ML",
  "AI for Science",
  "Time Series & Forecasting",
  "Structured & Causal Reasoning",
  "Trustworthy Learning",
];

export function splitArea(a?: string | null): { area: string; topic: string | null } {
  if (!a) return { area: "—", topic: null };
  const i = a.indexOf(" / ");
  return i < 0 ? { area: a.trim(), topic: null } : { area: a.slice(0, i).trim(), topic: a.slice(i + 3).trim() || null };
}

/** [area, count] for the areas that have tasks: the fixed order first, any other area after. */
export function areaCounts(areas: (string | null | undefined)[]): [string, number][] {
  const m = new Map<string, number>();
  for (const a of areas) {
    const k = splitArea(a).area;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const rank = (k: string) => {
    const i = AREA_ORDER.indexOf(k);
    return i < 0 ? AREA_ORDER.length : i;
  };
  return [...m.entries()].filter(([, n]) => n > 0).sort((x, y) => rank(x[0]) - rank(y[0]) || x[0].localeCompare(y[0]));
}
