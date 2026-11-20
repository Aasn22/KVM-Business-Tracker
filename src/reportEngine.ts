import { dollarExcelFormat } from "./format";
import { markets, months, type Entry, type MonthData } from "./model";
import { periodMonths, totalReview } from "./totals";
import { lastSavedUpdate } from "./updateStatus";
export const reportTypes = [
  {
    id: "executive",
    title: "Executive overview",
    group: "Executive",
    description:
      "A clear view of revenue, market contribution, monthly pace and coverage.",
  },
  {
    id: "markets",
    title: "Market performance",
    group: "Revenue",
    description:
      "Compare market budgets, revenue on the books and weighted ADR.",
  },
  {
    id: "monthly",
    title: "Monthly revenue pace",
    group: "Revenue",
    description:
      "Follow saved monthly budget and BOB snapshots, with weekly detail.",
  },
  {
    id: "nights",
    title: "Room nights & ADR",
    group: "Revenue",
    description:
      "Understand room-night delivery and weighted average daily rates.",
  },
  {
    id: "villas",
    title: "Villa category review",
    group: "Breakdowns",
    description:
      "Compare the saved villa breakdowns without mixing them with commercial revenue.",
  },
  {
    id: "countries",
    title: "Country contribution",
    group: "Breakdowns",
    description: "Review saved country budgets and BOB by category.",
  },
  {
    id: "meals",
    title: "Meal-plan performance",
    group: "Breakdowns",
    description: "Visualize saved meal-plan figures and category variances.",
  },
] as const;
export type ReportType = (typeof reportTypes)[number]["id"];
export type ReportMetric = {
  label: string;
  budget: number | null;
  bob: number | null;
  budgetNights?: number;
  bobNights?: number;
  count?: number;
  expected?: number;
};
export type ReportSnapshot = {
  id: string;
  title: string;
  type: ReportType;
  year: number;
  market: string;
  period: string;
  source: string;
  limitation?: string;
  generatedAt: string;
  lastUpdatedAt: string | null;
  entries: Entry[];
  expected: number;
  missing: string[];
  revenue: ReportMetric;
  nights: ReportMetric;
  adr: ReportMetric;
  byMarket: ReportMetric[];
  byMonth: ReportMetric[];
  breakdown: ReportMetric[];
  weekly: { label: string; budget: number; bob: number }[];
};
export type ReportRequest = {
  type: ReportType;
  title?: string;
  year: number;
  market: string;
  period: string;
  source: string;
  limitation?: string;
};
export function captureReport(entries: Entry[], request: ReportRequest) {
  if (
    !reportTypes.some((t) => t.id === request.type) ||
    !periodMonths(request.period).length ||
    (request.market !== "all" && !markets.some((m) => m.id === request.market))
  )
    throw Error("Choose a valid report, market and period.");
  const records = totalReview(
    entries,
    request.year,
    request.period,
  ).sources.filter(
    (e) => request.market === "all" || e.market_id === request.market,
  );
  if (!records.length)
    throw Error(
      "No saved figures are available for this selection. Choose another market or period, or enter data first.",
    );
  return structuredClone(records);
}
function sum(rows: Entry[], label: string, index: number): ReportMetric {
  if (!rows.length) return { label, budget: null, bob: null };
  return {
    label,
    budget: rows.reduce((s, e) => s + e.data.commercial[index].budget, 0),
    bob: rows.reduce((s, e) => s + e.data.commercial[index].bob, 0),
  };
}
export function calculateReport(
  records: Entry[],
  request: ReportRequest,
  generatedAt = new Date().toISOString(),
): ReportSnapshot {
  const known = markets.filter(
    (m) => request.market === "all" || request.market === m.id,
  );
  const chosenMonths = periodMonths(request.period);
  const revenue = sum(records, "Revenue", 1),
    nights = sum(records, "Room nights", 0);
  const rate = (r: number | null, n: number | null) =>
    r !== null && n !== null && n > 0 ? r / n : null;
  const byMarket = known.map((m) => {
    const data = records.filter((e) => e.market_id === m.id),
      n = sum(data, "", 0);
    return {
      ...sum(data, m.name, 1),
      budgetNights: n.budget ?? undefined,
      bobNights: n.bob ?? undefined,
      count: data.length,
      expected: chosenMonths.length,
    };
  });
  const byMonth = chosenMonths.map((m) => {
    const data = records.filter((e) => e.month === m),
      n = sum(data, "", 0);
    return {
      ...sum(data, months[m - 1], 1),
      budgetNights: n.budget ?? undefined,
      bobNights: n.bob ?? undefined,
      count: data.length,
      expected: known.length,
    };
  });
  const breakdown = new Map<string, ReportMetric>();
  if (["villas", "countries", "meals"].includes(request.type))
    for (const e of records)
      for (const row of e.data[
        request.type as keyof Pick<MonthData, "villas" | "countries" | "meals">
      ]) {
        const r = breakdown.get(row.label) ?? {
          label: row.label,
          budget: 0,
          bob: 0,
        };
        r.budget! += row.budget;
        r.bob! += row.bob;
        breakdown.set(row.label, r);
      }
  const weekly = [0, 1, 2, 3].map((w) => ({
    label: w === 3 ? "Week 4/5" : `Week ${w + 1}`,
    budget: records.reduce((s, e) => s + e.data.commercial[1].targets[w], 0),
    bob: records.reduce((s, e) => s + e.data.commercial[1].weekly[w], 0),
  }));
  return {
    id: `${generatedAt}-${request.type}`,
    ...request,
    title:
      request.title?.trim().slice(0, 100) ||
      reportTypes.find((t) => t.id === request.type)!.title,
    generatedAt,
    lastUpdatedAt: lastSavedUpdate(records),
    entries: structuredClone(records),
    expected: known.length * chosenMonths.length,
    missing: known.flatMap((m) =>
      chosenMonths
        .filter(
          (month) =>
            !records.some((e) => e.market_id === m.id && e.month === month),
        )
        .map((month) => `${m.name} · ${months[month - 1]}`),
    ),
    revenue,
    nights,
    adr: {
      label: "Weighted ADR",
      budget: rate(revenue.budget, nights.budget),
      bob: rate(revenue.bob, nights.bob),
    },
    byMarket,
    byMonth,
    breakdown: [...breakdown.values()],
    weekly,
  };
}
export const generationStages = [
  "Capturing saved records",
  "Calculating performance",
  "Preparing visual snapshot",
];
export async function generateReport(
  entries: Entry[],
  request: ReportRequest,
  signal: AbortSignal,
  onStage: (stage: number) => void,
  yieldWork = () =>
    new Promise<void>((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    ),
) {
  const check = () => {
    if (signal.aborted)
      throw new DOMException("Report generation cancelled.", "AbortError");
  };
  check();
  onStage(0);
  await yieldWork();
  check();
  const captured = captureReport(entries, request);
  onStage(1);
  await yieldWork();
  check();
  const report = calculateReport(captured, request);
  onStage(2);
  await yieldWork();
  check();
  return report;
}
export function periodLabel(period: string) {
  return period === "year"
    ? "Full year"
    : period.startsWith("q")
      ? `Quarter ${period.slice(1)}`
      : months[Number(period) - 1];
}
export function reportTables(report: ReportSnapshot) {
  const table = (name: string, rows: ReportMetric[]) => ({
    name,
    rows: [
      [
        "Category",
        "Budget",
        "BOB",
        "Variance (BOB − budget)",
        "Achievement %",
        "Budget room nights",
        "BOB room nights",
        "Budget weighted ADR",
        "BOB weighted ADR",
        "Records",
        "Expected",
      ],
      ...rows.map((r) => [
        r.label,
        r.budget,
        r.bob,
        r.budget === null || r.bob === null ? null : r.bob - r.budget,
        r.budget && r.bob !== null ? (r.bob / r.budget) * 100 : null,
        r.budgetNights ?? null,
        r.bobNights ?? null,
        r.budgetNights && r.budget !== null ? r.budget / r.budgetNights : null,
        r.bobNights && r.bob !== null ? r.bob / r.bobNights : null,
        r.count ?? null,
        r.expected ?? null,
      ]),
    ],
  });
  return [
    {
      name: "Snapshot",
      rows: [
        [report.title],
        ["Generated (UTC)", report.generatedAt],
        ["Source", report.source],
        ["Report scope", report.limitation ?? "Saved source figures only"],
        ["Year", report.year],
        ["Market", report.market],
        ["Period", periodLabel(report.period)],
        ["Last saved (UTC)", report.lastUpdatedAt],
        ["Available records", report.entries.length],
        ["Expected records", report.expected],
        [
          "Definition",
          "BOB is bookings on the books, not actual revenue. No forecasts estimated. Blank cells mean unavailable.",
        ],
        [
          "Breakdowns",
          "Independent figures from source sheets; units depend on source. Do not add to commercial totals.",
        ],
        ["Missing records", report.missing.join("; ")],
      ],
    },
    table("Summary", [report.revenue, report.nights, report.adr]),
    table("Markets", report.byMarket),
    table("Monthly", report.byMonth),
    table("Categories", report.breakdown),
    table("Weekly snapshots", report.weekly),
  ];
}
export async function exportVisualReport(report: ReportSnapshot) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  for (const t of reportTables(report)) {
    const sheet = workbook.addWorksheet(t.name);
    t.rows.forEach((r) => sheet.addRow(r));
    sheet.eachRow((r, i) => {
      if (i < 2) return;
      const moneyColumns = ["Markets", "Monthly"].includes(t.name)
        ? [2, 3, 4, 8, 9]
        : t.name === "Weekly snapshots"
          ? [2, 3, 4]
          : t.name === "Summary" &&
              ["Revenue", "Weighted ADR"].includes(String(r.getCell(1).value))
            ? [2, 3, 4]
            : [];
      moneyColumns.forEach((c) => {
        if (typeof r.getCell(c).value === "number")
          r.getCell(c).numFmt = dollarExcelFormat;
      });
    });
    sheet.columns.forEach((c, i) => (c.width = i === 0 ? 32 : 24));
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }
  const url = URL.createObjectURL(
    new Blob([await workbook.xlsx.writeBuffer()], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `KVM-${report.type}-${report.year}-snapshot.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
