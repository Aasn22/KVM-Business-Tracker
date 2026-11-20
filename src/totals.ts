import { markets, row, type Entry, type MonthData, type Row } from "./model";
export const totalLabel = "Management Review";
export type ReviewSection = "commercial" | "villas" | "countries" | "meals";
export function periodMonths(period: string): number[] {
  if (period === "year") return Array.from({ length: 12 }, (_, i) => i + 1);
  if (/^q[1-4]$/.test(period))
    return Array.from(
      { length: 3 },
      (_, i) => (Number(period[1]) - 1) * 3 + i + 1,
    );
  const month = Number(period);
  return Number.isInteger(month) && month >= 1 && month <= 12 ? [month] : [];
}
export function sumData(entries: Entry[]): MonthData {
  const sum = (key: ReviewSection): Row[] => {
    const grouped = new Map<string, Row>();
    for (const entry of entries)
      for (const source of entry.data[key]) {
        const target = grouped.get(source.label) ?? row(source.label);
        target.budget += source.budget;
        target.bob += source.bob;
        for (let i = 0; i < 4; i++) {
          target.targets[i] += source.targets[i];
          target.weekly[i] += source.weekly[i];
        }
        grouped.set(source.label, target);
      }
    return [...grouped.values()];
  };
  return {
    commercial: sum("commercial"),
    villas: sum("villas"),
    countries: sum("countries"),
    meals: sum("meals"),
    notes: "",
  };
}
export function totalReview(entries: Entry[], year: number, period: string) {
  const expectedMonths = periodMonths(period);
  const knownMarkets = new Set(markets.map((m) => m.id));
  // A derived total or repeated source record must never be counted again.
  const unique = new Map<string, Entry>();
  for (const entry of entries)
    if (
      entry.year === year &&
      knownMarkets.has(entry.market_id) &&
      expectedMonths.includes(entry.month)
    ) {
      const key = `${entry.market_id}:${entry.month}`;
      const prior = unique.get(key);
      if (!prior || entry.version > prior.version) unique.set(key, entry);
    }
  const sources = [...unique.values()];
  const expected = markets.length * expectedMonths.length;
  const missing = markets.flatMap((m) =>
    expectedMonths
      .filter((month) => !unique.has(`${m.id}:${month}`))
      .map((month) => ({ market: m.name, month })),
  );
  const coverage = `${sources.length}/${expected} market-month records available`;
  const complete = expected > 0 && missing.length === 0;
  const notice = `${complete ? "Complete market coverage" : "Partial total — missing or inaccessible market data"}. ${coverage}. Only saved records accessible to your account are included; no missing values are estimated.`;
  const monthly: Entry[] = expectedMonths.flatMap((month) => {
    const records = sources.filter((e) => e.month === month);
    return records.length
      ? [
          {
            market_id: totalLabel,
            year,
            month,
            data: { ...sumData(records), notes: notice },
            version: 0,
          },
        ]
      : [];
  });
  return {
    sources,
    monthly,
    data: sumData(sources),
    expectedMonths,
    missing,
    coverage,
    complete,
    notice,
  };
}
