import { periodOccupancy } from "./occupancy.js";
import revenueSource from "./historyRevenueSource.json" with { type: "json" };
export const historyFields = [
  "budgetNights",
  "actualNights",
  "budgetRoomRevenue",
  "actualRoomRevenue",
  "budgetTotalRevenue",
  "actualTotalRevenue",
  "actualFoodRevenue",
  "actualOtherRevenue",
] as const;
export type HistoryField = (typeof historyFields)[number];
export type HistoryMonth = { month: number } & Record<
  HistoryField,
  number | null
>;
export type HistoryYear = {
  year: number;
  version: number;
  months: HistoryMonth[];
  updated_at?: string;
};
export function blankHistory(year: number): HistoryYear {
  return {
    year,
    version: 0,
    months: Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      budgetNights: null,
      actualNights: null,
      budgetRoomRevenue: null,
      actualRoomRevenue: null,
      budgetTotalRevenue: null,
      actualTotalRevenue: null,
      actualFoodRevenue: null,
      actualOtherRevenue: null,
    })),
  };
}
export function cleanHistory(raw: unknown): HistoryYear {
  const r = raw as HistoryYear;
  if (
    !r ||
    !Number.isInteger(r.year) ||
    r.year < 2021 ||
    r.year > 2060 ||
    !Number.isInteger(r.version) ||
    r.version < 0 ||
    !Array.isArray(r.months) ||
    r.months.length !== 12
  )
    throw Error("Select a valid year and supply all 12 month rows.");
  const months = r.months.map((m, i) => {
    if (m.month !== i + 1)
      throw Error("Month rows must be January to December.");
    const out = { month: m.month } as HistoryMonth;
    for (const field of historyFields) {
      const v = m[field] ?? null;
      if (
        v !== null &&
        (typeof v !== "number" ||
          !Number.isFinite(v) ||
          v < 0 ||
          v > 1e12 ||
          (/Nights$/.test(field) && !Number.isInteger(v)))
      )
        throw Error(
          `Invalid ${field} in month ${i + 1}. Nights must be whole, non-negative numbers.`,
        );
      out[field] = v;
    }
    for (const p of [
      ["budgetTotalRevenue", "budgetRoomRevenue"],
      ["actualTotalRevenue", "actualRoomRevenue"],
    ] as const) {
      if (out[p[0]] !== null && out[p[1]] !== null && out[p[0]]! < out[p[1]]!)
        throw Error(
          `Total revenue cannot be less than room revenue in month ${i + 1}.`,
        );
    }
    return out;
  });
  return { year: r.year, version: r.version, months };
}
export function historySummary(months: HistoryMonth[]) {
  const normalized = months.map((m) => ({
    ...m,
    actualTotalRevenue:
      m.actualTotalRevenue ??
      (typeof m.actualRoomRevenue === "number" &&
      typeof m.actualFoodRevenue === "number" &&
      typeof m.actualOtherRevenue === "number"
        ? m.actualRoomRevenue + m.actualFoodRevenue + m.actualOtherRevenue
        : null),
  }));
  const totals = Object.fromEntries(
    historyFields.map((k) => {
      const values = normalized
        .map((m) => m[k])
        .filter((n): n is number => typeof n === "number");
      return [k, values.length ? values.reduce((a, b) => a + b, 0) : null];
    }),
  ) as Record<HistoryField, number | null>;
  const adr = (revenue: HistoryField, nights: HistoryField) => {
    const pairs = months.filter(
      (m) => typeof m[revenue] === "number" && typeof m[nights] === "number",
    );
    if (!pairs.length) return null;
    const n = pairs.reduce((a, m) => a + m[nights]!, 0);
    return n > 0 ? pairs.reduce((a, m) => a + m[revenue]!, 0) / n : null;
  };
  return {
    ...totals,
    budgetADR: adr("budgetRoomRevenue", "budgetNights"),
    actualADR: adr("actualRoomRevenue", "actualNights"),
    knownMonths: months.filter((m) => historyFields.some((k) => m[k] !== null))
      .length,
  };
}
export function historyActual(data: HistoryYear) {
  const t = historySummary(data.months);
  return {
    revenue: t.actualRoomRevenue,
    nights: t.actualNights,
    adr: t.actualADR,
    totalRevenue: t.actualTotalRevenue,
    missingRevenue: data.months.filter(
      (m) => m.actualNights !== null && m.actualRoomRevenue === null,
    ).length,
    foodRevenue: t.actualFoodRevenue,
    otherRevenue: t.actualOtherRevenue,
    occupancy: periodOccupancy(
      t.actualNights,
      data.year,
      data.months.map((m) => m.month),
    ),
    dates: data.months
      .filter((m) => m.actualRoomRevenue !== null)
      .map((m) => String(m.month).padStart(2, "0")),
    coverage: t.knownMonths,
  };
}
export function historyPlan(data: HistoryYear) {
  const t = historySummary(data.months);
  return {
    budget: t.budgetRoomRevenue,
    nights: t.budgetNights,
    targetADR: t.budgetADR,
    bob: null,
    booked: null,
    bobADR: null,
    coverage: t.knownMonths,
  };
}

export function withRevenueReference(saved: HistoryYear[]): HistoryYear[] {
  const map = new Map(saved.map((y) => [y.year, cleanHistory(y)]));
  for (const [year, values] of Object.entries(revenueSource)) {
    const y = map.get(+year) ?? blankHistory(+year);
    y.months = y.months.map((m) => {
      const reference = values.find((v) => v.month === m.month);
      return {
        ...m,
        actualFoodRevenue:
          m.actualFoodRevenue ?? reference?.actualFoodRevenue ?? null,
        actualOtherRevenue:
          m.actualOtherRevenue ?? reference?.actualOtherRevenue ?? null,
      };
    });
    map.set(+year, y);
  }
  return [...map.values()].sort((a, b) => a.year - b.year);
}
export const revenueReferenceNote =
  "F&B/Other source: user-supplied monthly table; saved nonblank entries override it. December 2026 missing. Monthly sums differ from printed totals: 2024 F&B sums $1,288,228 vs $1,378,228 printed; minor $1 differences in 2022 Other, 2024 Other and 2026 components. Existing explicit total revenue is preserved; components are not added twice.";
