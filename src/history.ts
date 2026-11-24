export const historyFields = [
  "budgetNights",
  "actualNights",
  "budgetRoomRevenue",
  "actualRoomRevenue",
  "budgetTotalRevenue",
  "actualTotalRevenue",
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
      const v = m[field];
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
  const totals = Object.fromEntries(
    historyFields.map((k) => {
      const values = months
        .map((m) => m[k])
        .filter((n): n is number => n !== null);
      return [k, values.length ? values.reduce((a, b) => a + b, 0) : null];
    }),
  ) as Record<HistoryField, number | null>;
  const adr = (revenue: HistoryField, nights: HistoryField) => {
    const pairs = months.filter(
      (m) => m[revenue] !== null && m[nights] !== null,
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
    foodRevenue: null as number | null,
    otherRevenue: null as number | null,
    occupancy: null as number | null,
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
