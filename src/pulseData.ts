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
  const revenue =
    rows.length && !rows.some((r) => r.missingRevenue > 0)
      ? rows.reduce((a, r) => a + r.revenue, 0)
      : null;
  const nights = rows.length ? rows.reduce((a, r) => a + r.nights, 0) : null;
  return {
    revenue,
    nights,
    adr:
      revenue !== null && nights !== null && nights > 0
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
    JSON.stringify(latest.dates) === JSON.stringify(previous.dates);
  const change = (a: number | null, b: number | null) =>
    comparable && a !== null && b !== null && b !== 0
      ? { amount: a - b, percent: ((a - b) / b) * 100 }
      : null;
  return {
    revenue: change(latest.revenue, previous.revenue),
    adr: change(latest.adr, previous.adr),
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
