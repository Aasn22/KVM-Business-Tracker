import { markets, summarize, type Entry } from "./model";
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
export function pulseActual(data: ProductionData | null, year: number) {
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
    foodRevenue: null as number | null,
    otherRevenue: null as number | null,
    totalRevenue: null as number | null,
    occupancy: null as number | null,
    nights,
    adr:
      revenue !== null && nights !== null && nights > 0 && missingRevenue === 0
        ? revenue / nights
        : null,
    dates: [...new Set(rows.map((r) => r.date.slice(5)))].sort(),
    coverage: rows.length,
  };
}
export function pulseYoY(data: ProductionData | null) {
  const latest = pulseActual(data, 2026),
    previous = pulseActual(data, 2025);
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
    totalRevenue: change(latest.totalRevenue, previous.totalRevenue),
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
