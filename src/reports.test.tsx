import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Workbook } from "exceljs";
import { readFileSync } from "node:fs";
import ReportLibrary, { QuickReports, VisualReport } from "./ReportLibrary";
import { blank, type Entry } from "./model";
import {
  calculateReport,
  captureReport,
  exportVisualReport,
  generateReport,
  generationStages,
  reportTables,
  reportTypes,
  type ReportRequest,
} from "./reportEngine";
import App from "./App";
import { quickReports, quickReportPeriod } from "./quickReports";
const request: ReportRequest = {
  type: "executive",
  year: 2027,
  market: "all",
  period: "q1",
  source: "Test saved input",
};
function entry(
  market_id = "asia",
  month = 1,
  revenue = 100,
  nights = 1,
): Entry {
  const data = blank(market_id);
  data.commercial[1].budget = revenue * 2;
  data.commercial[1].bob = revenue;
  data.commercial[0].budget = nights * 2;
  data.commercial[0].bob = nights;
  return {
    market_id,
    year: 2027,
    month,
    data,
    version: 1,
    updated_at: "2026-11-20T09:00:00Z",
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("executive saved-data reports", () => {
  it("reconciles the real published workbook snapshot without fabricating Other Markets", () => {
    const baseline = JSON.parse(
      readFileSync("public/data/budgets-2027.json", "utf8"),
    ).entries as Entry[];
    const r = { ...request, period: "year" };
    const report = calculateReport(captureReport(baseline, r), r);
    expect(report.entries).toHaveLength(60);
    expect(report.expected).toBe(72);
    expect(report.revenue.budget).toBeCloseTo(24553920.435789473);
    expect(report.nights.budget).toBe(22042);
    expect(report.missing.every((v) => v.startsWith("Other Markets"))).toBe(
      true,
    );
    expect(report.lastUpdatedAt).toBeNull();
  });

  it("captures deduplicated exact saved inputs with year/market/period filters", () => {
    const a = entry();
    const newer = { ...a, version: 2, data: structuredClone(a.data) };
    newer.data.commercial[1].bob = 123;
    const rows = captureReport(
      [a, newer, entry("europe"), entry("asia", 4), { ...entry(), year: 2025 }],
      { ...request, market: "asia" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data.commercial[1].bob).toBe(123);
    newer.data.commercial[1].bob = 456;
    expect(rows[0].data.commercial[1].bob).toBe(123);
  });
  it("calculates weighted ADR, missing coverage and genuine zeros without inventing forecasts", () => {
    const report = calculateReport(
      captureReport(
        [
          entry("asia", 1, 100, 1),
          entry("europe", 1, 1800, 9),
          entry("america", 1, 0, 0),
        ],
        request,
      ),
      request,
    );
    expect(report.revenue.bob).toBe(1900);
    expect(report.adr.bob).toBe(190);
    expect(report.expected).toBe(18);
    expect(report.missing).toHaveLength(15);
    expect(report.byMonth[1].budget).toBeNull();
    expect(report.byMarket.find((r) => r.label === "America")!.bob).toBe(0);
    expect(
      report.byMarket.find((r) => r.label === "Other Markets")!.bob,
    ).toBeNull();
    expect(report.lastUpdatedAt).toBe("2026-11-20T09:00:00.000Z");
    const html = renderToStaticMarkup(<VisualReport report={report} />);
    expect(html).toContain("Partial snapshot");
    expect(html).toContain("not realized revenue");
    expect(html).toContain('role="img"');
    expect(html).toContain("<caption>");
    expect(html).toContain("No saved figures");
  });
  it("leaves generated reports independent from subsequent saved-input mutations", () => {
    const rows = [entry()];
    const report = calculateReport(
      captureReport(rows, request),
      request,
      "2026-11-20T09:30:00Z",
    );
    rows[0].data.commercial[1].bob = 999;
    expect(report.entries[0].data.commercial[1].bob).toBe(100);
    expect(report.revenue.bob).toBe(100);
  });
  it.each(["villas", "countries", "meals"] as const)(
    "aggregates %s independently without inflating revenue",
    (type) => {
      const a = entry(),
        b = entry("europe");
      a.data[type] = [
        {
          label: "Shared",
          budget: 10,
          bob: 5,
          targets: [1, 2, 3, 4],
          weekly: [1, 1, 1, 1],
        },
      ];
      b.data[type] = structuredClone(a.data[type]);
      const report = calculateReport([a, b], {
        ...request,
        type,
        title: "Ownership review",
      });
      expect(report.title).toBe("Ownership review");
      expect(report.breakdown).toEqual([
        { label: "Shared", budget: 20, bob: 10 },
      ]);
      expect(report.revenue.budget).toBe(400);
    },
  );
  it("handles zero room nights with unavailable ADR", () => {
    const r = calculateReport([entry("asia", 1, 0, 0)], request);
    expect(r.adr.bob).toBeNull();
  });
  it("rejects missing or invalid selections", () => {
    expect(() => captureReport([], request)).toThrow("No saved figures");
    expect(() =>
      captureReport([entry()], { ...request, market: "unknown" }),
    ).toThrow("valid report");
    expect(() =>
      captureReport([entry()], { ...request, period: "q5" }),
    ).toThrow("valid report");
  });
  it("reports real ordered stages and never creates a report after cancellation", async () => {
    const stages: number[] = [];
    const controller = new AbortController();
    const r = await generateReport(
      [entry()],
      request,
      controller.signal,
      (s) => stages.push(s),
      async () => {},
    );
    expect(stages).toEqual([0, 1, 2]);
    expect(generationStages).toHaveLength(3);
    expect(r.entries).toHaveLength(1);
    const cancelled = new AbortController();
    await expect(
      generateReport(
        [entry()],
        request,
        cancelled.signal,
        () => {},
        async () => {
          cancelled.abort();
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
  it("renders a branded welcome instead of the old numbers-only report", () => {
    const html = renderToStaticMarkup(
      <ReportLibrary
        entries={[entry()]}
        year={2027}
        source="Published workbook"
        loading={false}
      />,
    );
    expect(html).toContain("report-welcome-logo");
    expect(html).not.toMatch(/owners|ownership/i);
    expect(html).toContain("Explore Report Library");
    expect(reportTypes).toHaveLength(7);
    vi.stubGlobal("window", { location: { pathname: "/reports" } });
    const app = renderToStaticMarkup(<App publicDemo />);
    expect(app).toContain("Reports Library");
    expect(app).not.toContain("Budget year");
    expect(app).not.toContain('aria-label="Report year"');
    expect(app).not.toContain("Market performance report ·");
  });
  it("exports captured metadata, full numeric precision and monthly/market/category detail", async () => {
    const e = entry();
    e.data.commercial[1].bob = 123.45678;
    const report = calculateReport([e], request, "2026-11-20T09:30:00Z");
    expect(reportTables(report)[0].rows.flat()).toContain(
      "2026-11-20T09:30:00Z",
    );
    let blob: Blob | undefined;
    vi.stubGlobal("document", {
      createElement: () => ({ click: vi.fn(), href: "", download: "" }),
    });
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
      blob = b as Blob;
      return "blob:test";
    });
    await exportVisualReport(report);
    const w = new Workbook();
    await w.xlsx.load(await blob!.arrayBuffer());
    expect(w.worksheets).toHaveLength(6);
    expect(w.getWorksheet("Markets")!.getCell("C2").value).toBe(123.45678);
    expect(w.getWorksheet("Markets")!.getCell("C2").numFmt).toContain('"$"');
    expect(w.getWorksheet("Markets")!.getCell("F2").numFmt ?? "").not.toContain(
      "$",
    );
    expect(w.getWorksheet("Snapshot")!.getCell("B3").value).toBe(
      "Test saved input",
    );
  });
  it("renders the operational shortcuts alongside the supplied reports as compact icon shortcuts without oversized cards", () => {
    const expected = [
      "Hotel Performance Reports",
      "Business Pace Reports",
      "Market Segment Reports",
      "Sales Performance Reports",
      "Meal Plan Reports",
      "Villa Type Performance Reports",
      "Market Performance Reports",
      "Country Performance Reports",
      "Cancellation Reports",
      "No Show Reports",
      "Reservations Confirmed Reports",
      "Monthly Reports",
      "Quarterly Reports",
      "Yearly Reports",
    ];
    expect(quickReports.map((r) => r.title)).toEqual(expected);
    const html = renderToStaticMarkup(
      <QuickReports group="All" loading={false} onSelect={() => {}} />,
    );
    expect(html).toContain("QUICK REPORTS");
    expect(html.match(/class="quick-report-button"/g)).toHaveLength(14);
    expect(html.match(/<svg/g)).toHaveLength(14);
    expect(html).not.toContain("report-category-card");
    for (const name of expected) expect(html).toContain(name);
  });
  it("discloses unavailable inputs and does not map segment, sales or cancellation to fabricated data", () => {
    for (const id of ["sales"]) {
      const r = quickReports.find((q) => q.id === id)!;
      expect(r.type).toBeUndefined();
      expect(r.unavailable).toBeUndefined();
      expect(r.limitation).toContain("no salesperson");
    }
    expect(quickReports.find((q) => q.id === "cancellation")!.operational).toBe(
      "cancellations",
    );
    expect(quickReports.find((q) => q.id === "reservations")!.operational).toBe(
      "reservations",
    );
    expect(quickReports.find((q) => q.id === "segment")!.primary).toBe(
      "market",
    );
    const pace = quickReports.find((q) => q.id === "pace")!;
    expect(pace.limitation).toContain("true pickup");
    const report = calculateReport([entry()], {
      ...request,
      limitation: pace.limitation,
    });
    expect(renderToStaticMarkup(<VisualReport report={report} />)).toContain(
      "true pickup",
    );
    expect(reportTables(report)[0].rows.flat()).toContain(pace.limitation);
  });
  it("applies month/quarter/year shortcuts without confusing annual and monthly periods", () => {
    expect(quickReportPeriod("month", "year")).toBe("1");
    expect(quickReportPeriod("month", "8")).toBe("8");
    expect(quickReportPeriod("quarter", "8")).toBe("q3");
    expect(quickReportPeriod("quarter", "q4")).toBe("q4");
    expect(quickReportPeriod("quarter", "year")).toBe("q1");
    expect(quickReportPeriod("year", "8")).toBe("year");
    expect(quickReportPeriod(undefined, "q2")).toBe("q2");
  });
});
