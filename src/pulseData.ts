import { periodOccupancy } from "./occupancy";
import { markets, summarize, type Entry } from "./model";
import { historyActual, historySummary, type HistoryYear } from "./history";
import type { ProductionData } from "./production";
export const pulseYears = [2021, 2022, 2023, 2024, 2025, 2026];
export function pulsePlanning(entries: Entry[]) {
  const known = [
    ...new Map(
      entries.map((e) => [`${e.year}:${e.market_id}:${e.month}`, e]),
    ).values(),
  ];
  const t = summarize(known);
  return {
    budget: known.length ? t.budget : null,
    bob: known.length ? t.bob : null,
    nights: known.length ? t.nights : null,
    booked: known.length ? t.booked : null,
    targetADR: known.length && t.nights > 0 ? t.budget / t.nights : null,
    bobADR: known.length && t.booked > 0 ? t.bob / t.booked : null,
    coverage: known.length,
  };
}
export function pulseActual(
  data: ProductionData | null,
  year: number,
  histories: HistoryYear[] = [],
) {
  const manual = histories.find((y) => y.year === year);
  if (
    manual &&
    manual.months.some(
      (m) =>
        m.actualNights !== null ||
        m.actualRoomRevenue !== null ||
        m.actualTotalRevenue !== null,
    )
  )
    return {
      ...historyActual(manual),
      dates: manual.months
        .filter((m) => m.actualRoomRevenue !== null)
        .map((m) => `manual-month-${m.month}`),
    };

  const rows =
    data?.days.filter(
      (r) =>
        r.status === "CHECKED OUT" && r.date.startsWith(String(year) + "-"),
    ) ?? [];
  const knownRows = rows.filter((r) => !r.missingRevenue);
  const revenue = knownRows.length
    ? knownRows.reduce((a, r) => a + r.revenue, 0)
    : null;
  const missingRevenue = rows.filter((r) => r.missingRevenue > 0).length;
  const nights = rows.length ? rows.reduce((a, r) => a + r.nights, 0) : null;
  return {
    revenue,
    missingRevenue,
    foodRevenue: manual
      ? historySummary(manual.months).actualFoodRevenue
      : null,
    otherRevenue: manual
      ? historySummary(manual.months).actualOtherRevenue
      : null,
    totalRevenue: null as number | null,
    occupancy: periodOccupancy(
      nights,
      year,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    ),
    nights,
    adr:
      revenue !== null && nights !== null && nights > 0 && missingRevenue === 0
        ? revenue / nights
        : null,
    dates: [...new Set(rows.map((r) => r.date.slice(5)))].sort(),
    coverage: rows.length,
  };
}
export function pulseYoY(
  data: ProductionData | null,
  histories: HistoryYear[] = [],
) {
  const latest = pulseActual(data, 2026, histories),
    previous = pulseActual(data, 2025, histories);
  // Do not present unmatched partial years as like-for-like growth.
  const comparable =
    latest.dates.length > 0 &&
    latest.missingRevenue === 0 &&
    previous.missingRevenue === 0 &&
    JSON.stringify(latest.dates) === JSON.stringify(previous.dates);
  const change = (a: number | null, b: number | null) =>
    comparable && a !== null && b !== null && b !== 0
      ? { amount: a - b, percent: ((a - b) / b) * 100 }
      : null;
  return {
    revenue: change(latest.revenue, previous.revenue),
    adr: change(latest.adr, previous.adr),
    totalRevenue: (() => {
      const a = histories.find((h) => h.year === 2026),
        b = histories.find((h) => h.year === 2025);
      if (!a || !b) return null;
      const ma = a.months
          .filter((m) => m.actualTotalRevenue !== null)
          .map((m) => m.month),
        mb = b.months
          .filter((m) => m.actualTotalRevenue !== null)
          .map((m) => m.month);
      const av = historySummary(a.months).actualTotalRevenue,
        bv = historySummary(b.months).actualTotalRevenue;
      return ma.length &&
        JSON.stringify(ma) === JSON.stringify(mb) &&
        av !== null &&
        bv !== null &&
        bv !== 0
        ? { amount: av - bv, percent: ((av - bv) / bv) * 100 }
        : null;
    })(),
  };
}
export const pulseMarketOrder = [
  "asia",
  "middle-east",
  "russia",
  "europe",
  "america",
  "other-markets",
];
export function pulseMarketLabel(id: string) {
  return (
    (
      {
        america: "AMERICAS",
        russia: "RUSSIA / CIS",
        "other-markets": "OTHER",
      } as Record<string, string>
    )[id] ??
    markets.find((m) => m.id === id)?.name.toUpperCase() ??
    id
  );
}

export function pulseKnownSum(values: (number | null)[]) {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

export function pulseYearPlanning(
  entries: Entry[],
  year: number,
  histories: HistoryYear[] = [],
) {
  const manual = histories.find((h) => h.year === year),
    base = pulsePlanning(entries.filter((e) => e.year === year));
  if (!manual) return base;
  const summary = historySummary(manual.months);
  const budget = summary.budgetRoomRevenue ?? base.budget,
    nights = summary.budgetNights ?? base.nights;
  return {
    ...base,
    budget,
    nights,
    targetADR:
      summary.budgetRoomRevenue !== null || summary.budgetNights !== null
        ? summary.budgetADR
        : base.targetADR,
  };
}
