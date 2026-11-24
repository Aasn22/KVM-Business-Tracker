import { periodOccupancy } from "./occupancy";
import { periodMonths } from "./totals";
import { adr, markets, months, type Entry } from "./model";
import { totalReview, type ReviewSection } from "./totals";
export const unavailable = "Not available";
export type Period = { key: string; label: string };
export type Metric = {
  label: string;
  budget: number | null;
  bob: number | null;
};
export const reportPeriods: Period[] = [
  ...months.map((label, i) => ({ key: String(i + 1), label })),
  ...[1, 2, 3, 4].map((q) => ({ key: `q${q}`, label: `Quarter ${q}` })),
  { key: "year", label: "Full year" },
];
export function managementReport(
  entries: Entry[],
  year: number,
  market = "all",
) {
  const known =
    market === "all" ? markets : markets.filter((m) => m.id === market);
  const allowed = new Set(known.map((m) => m.id));
  // Reuse source de-duplication and never add a separately stored total.
  const sources = totalReview(entries, year, "year").sources.filter((e) =>
    allowed.has(e.market_id),
  );
  const periods = reportPeriods.map((period) => {
    const result = totalReview(sources, year, period.key);
    const records = result.sources;
    const expected = known.length * result.expectedMonths.length;
    const count = records.length;
    const missing = known.flatMap((m) =>
      result.expectedMonths
        .filter(
          (month) =>
            !records.some((e) => e.market_id === m.id && e.month === month),
        )
        .map((month) => `${m.name} · ${months[month - 1]}`),
    );
    return {
      ...period,
      ...result,
      expected,
      count,
      missing,
      complete: expected > 0 && count === expected,
    };
  });
  function values(
    periodKey: string,
    section: ReviewSection,
    label: string,
  ): Metric {
    const period = periods.find((p) => p.key === periodKey);
    if (!period?.count) return { label, budget: null, bob: null };
    const match = period.data[section].find((r) => r.label === label);
    return { label, budget: match?.budget ?? null, bob: match?.bob ?? null };
  }
  function commercial(periodKey: string, label: string): Metric {
    if (label === "Occupancy %") {
      const nights = values(periodKey, "commercial", "Room Nights");
      return {
        label,
        budget: periodOccupancy(nights.budget, year, periodMonths(periodKey)),
        bob: periodOccupancy(nights.bob, year, periodMonths(periodKey)),
      };
    }
    if (label !== "ADR") return values(periodKey, "commercial", label);
    const revenue = values(periodKey, "commercial", "Room Revenue"),
      nights = values(periodKey, "commercial", "Room Nights");
    return {
      label,
      budget:
        revenue.budget !== null && nights.budget !== null && nights.budget > 0
          ? adr(revenue.budget, nights.budget)
          : null,
      bob:
        revenue.bob !== null && nights.bob !== null && nights.bob > 0
          ? adr(revenue.bob, nights.bob)
          : null,
    };
  }
  const notes = sources
    .filter((e) => e.data.notes.trim())
    .sort((a, b) => a.month - b.month || a.market_id.localeCompare(b.market_id))
    .map((e) => ({
      market: markets.find((m) => m.id === e.market_id)!.name,
      month: e.month,
      quarter: Math.ceil(e.month / 3),
      text: e.data.notes,
    }));
  const labels = (section: ReviewSection) =>
    Array.from(
      new Set(sources.flatMap((e) => e.data[section].map((r) => r.label))),
    );
  return {
    year,
    market,
    scope: market === "all" ? "All markets" : (known[0]?.name ?? "No market"),
    sources,
    periods,
    annual: periods[periods.length - 1],
    notes,
    labels,
    values,
    commercial,
  };
}
export type ManagementReport = ReturnType<typeof managementReport>;
export type ExportTable = { name: string; rows: (string | number | null)[][] };
export function managementExportTables(
  report: ManagementReport,
  demo: boolean,
): ExportTable[] {
  const annual = report.annual;
  const context = [
    ["Management Lense", report.year, report.scope],
    [demo ? "Fictional demo figures" : "Saved authorized market records only"],
    [
      "Coverage",
      `${annual.count}/${annual.expected}`,
      annual.complete
        ? "Complete coverage"
        : "Partial — missing or inaccessible records",
    ],
    [
      "Definition",
      "BOB = business on the books; not MTD actuals. Gap = BOB minus budget.",
    ],
    [
      "Unavailable",
      "MTD actuals, forecasts, F&B/other/total revenue, category ADR and sign-off are not in the source model.",
    ],
  ];
  const columns = [
    "Section",
    "KPI",
    ...report.periods.flatMap((p) => [
      `${p.label} budget`,
      `${p.label} BOB`,
      `${p.label} gap (BOB-budget)`,
      `${p.label} coverage`,
    ]),
  ];
  const metric = (
    section: string,
    label: string,
    get: (key: string) => Metric,
    coverageReport: ManagementReport = report,
  ) => [
    section,
    label,
    ...report.periods.flatMap((p) => {
      const v = get(p.key);
      return [
        v.budget,
        v.bob,
        v.budget !== null && v.bob !== null ? v.bob - v.budget : null,
        `${coverageReport.periods.find((v) => v.key === p.key)!.count}/${coverageReport.periods.find((v) => v.key === p.key)!.expected}`,
      ];
    }),
  ];
  const performance = ["Room Revenue", "Room Nights", "ADR", "Occupancy %"].map(
    (label) =>
      metric("Commercial", label, (key) => report.commercial(key, label)),
  );
  const breakdowns = (["villas", "meals", "countries"] as const).flatMap(
    (section) =>
      report
        .labels(section)
        .map((label) =>
          metric(section, label, (key) => report.values(key, section, label)),
        ),
  );
  const marketRows = markets
    .filter((m) => report.market === "all" || m.id === report.market)
    .flatMap((m) => {
      const r = managementReport(report.sources, report.year, m.id);
      return r.annual.count
        ? ["Room Revenue", "Room Nights", "ADR", "Occupancy %"].map((label) =>
            metric(m.name, label, (key) => r.commercial(key, label), r),
          )
        : [[m.name, "No accessible saved records"]];
    });
  const noteRows = report.notes.map((n) => [
    n.market,
    months[n.month - 1],
    `Quarter ${n.quarter}`,
    n.text,
  ]);
  return [
    {
      name: "Management Lense",
      rows: [...context, [], columns, ...performance, ...breakdowns],
    },
    {
      name: "Market Performance",
      rows: [...context, [], columns, ...marketRows],
    },
    {
      name: "Actions",
      rows: [
        ...context,
        [],
        ["Market", "Month", "Quarter", "Saved action plan"],
        ...(noteRows.length
          ? noteRows
          : [[unavailable, "", "", "No saved market action plans"]]),
      ],
    },
  ];
}
