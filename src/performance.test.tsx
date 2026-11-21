import {
  afterEach,
  describe,
  it,
  expect,
  vi,
  beforeAll,
  afterAll,
} from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  bookingSegment,
  geographicMarket,
  cleanPerformanceImport,
  cleanPerformanceRow,
  replacePerformance,
  summarizePerformance,
  type PerformanceRow,
} from "./performanceSources";
import { parseStatPages, type StatPage } from "./performanceParser";
import PerformanceInput, {
  spreadsheetSelectionError,
} from "./PerformanceInput";
import PerformanceAnalysis from "./PerformanceAnalysis";
const row: PerformanceRow = {
  date: "2026-11-01",
  code: "BAR",
  rooms: 2,
  roomRevenue: 200,
  foodRevenue: 10,
  otherRevenue: -2,
  guests: 4,
  reportedOccupancy: 2.67,
  reportedADR: 100,
};
const source = {
  id: "a".repeat(64),
  kind: "history",
  dimension: "market",
  from: row.date,
  to: row.date,
  asOf: "2026-11-21",
  rows: [row],
};
afterEach(() => vi.unstubAllGlobals());
describe("primary source semantics", () => {
  it("maps exactly the supplied Retail/Wholesale codes and keeps other groups distinct", () => {
    for (const c of ["ADV", "BAR", "PKG", "PRO", "DAY", "OTA", "RET"])
      expect(bookingSegment(c)).toBe("Retail");
    for (const c of ["ITO", "LTO", "GRP"])
      expect(bookingSegment(c)).toBe("Wholesale");
    expect(bookingSegment("CMP")).toBe("Complimentary");
    expect(bookingSegment("SYS")).toBe("System Use");
    expect(bookingSegment("unknown")).toBe("Unmapped segment");
  });
  it("uses country codes for geography and preserves unmapped rather than inventing location", () => {
    expect(geographicMarket("CN")).toBe("asia");
    expect(geographicMarket("IN")).toBe("asia");
    expect(geographicMarket("KZ")).toBe("russia");
    expect(geographicMarket("RU")).toBe("russia");
    expect(geographicMarket("AE")).toBe("middle-east");
    expect(geographicMarket("GB")).toBe("europe");
    expect(geographicMarket("US")).toBe("america");
    expect(geographicMarket("AU")).toBe("other-markets");
    expect(geographicMarket("Unknown")).toBeNull();
    expect(geographicMarket("TR")).toBeNull();
  });
  it("retains signed financial adjustments, rejects missing counts and duplicate/partial date source", () => {
    expect(
      cleanPerformanceRow({ ...row, roomRevenue: -77.7 }).roomRevenue,
    ).toBe(-77.7);
    expect(() => cleanPerformanceRow({ ...row, rooms: null })).toThrow();
    expect(() => cleanPerformanceRow({ ...row, code: "Total" })).toThrow();
    expect(() =>
      cleanPerformanceImport({ ...source, rows: [row, row] }),
    ).toThrow("Duplicate");
    expect(() =>
      cleanPerformanceImport({ ...source, to: "2026-11-02" }),
    ).toThrow("coverage");
    expect(cleanPerformanceImport(source).rows).toEqual([row]);
  });
  it("replaces matching stay dates rather than adding repeated snapshots", () => {
    const before = [row, { ...row, date: "2026-10-31" }];
    const after = replacePerformance(
      before,
      [{ ...row, roomRevenue: 300 }],
      row.date,
      row.date,
    );
    expect(after).toHaveLength(2);
    expect(summarizePerformance(after).revenue).toBe(500);
    expect(
      summarizePerformance([{ ...row, foodRevenue: null }]).food,
    ).toBeNull();
  });
  it("parses source daily cells, excludes printed total, retains signed revenue and refuses bad reconciliation", () => {
    const c = (x: number, y: number, t: string) => ({ x, y, t });
    const items = [
      c(725, 580, "21-11-26"),
      c(326, 548, "Reservation Statistics 1"),
      c(39, 44, "From Date 01-11-26"),
      c(102, 44, "To Date 01-11-26"),
      c(39, 20, "Option Market All"),
      c(120, 514, "BAR"),
      c(180, 514, "SYS"),
      c(240, 515, "Total"),
      c(17, 495, "01-11-26"),
      c(50, 484, "No. of Rms."),
      c(130, 484, "2"),
      c(190, 484, "0"),
      c(250, 484, "2"),
      c(52, 450, "Room Rev."),
      c(120, 450, "200"),
      c(180, 450, "- 10"),
      c(240, 450, "190"),
      c(56, 440, "F&B Rev."),
      c(120, 440, "10"),
      c(180, 440, "0"),
      c(240, 440, "10"),
      c(55, 428, "Misc Rev."),
      c(120, 428, "0"),
      c(180, 428, "0"),
      c(240, 428, "0"),
      c(46, 417, "No. of Guests"),
      c(130, 417, "4"),
      c(190, 417, "0"),
      c(250, 417, "4"),
    ];
    const pages: StatPage[] = [{ width: 792, items }];
    const parsed = parseStatPages(
      pages,
      "history",
      "market",
      row.date,
      row.date,
    );
    expect(parsed.rows).toHaveLength(2);
    expect(summarizePerformance(parsed.rows).revenue).toBe(190);
    expect(parsed.rows.every((r) => r.code !== "Total")).toBe(true);
    expect(() =>
      parseStatPages(pages, "history", "country", row.date, row.date),
    ).toThrow("Wrong source");
    expect(() =>
      parseStatPages(pages, "history", "market", "2026-11-02", "2026-11-02"),
    ).toThrow("exactly match");
    const broken = structuredClone(pages);
    broken[0].items.find((i) => i.x === 240 && i.y === 450)!.t = "500";
    expect(() =>
      parseStatPages(broken, "history", "market", row.date, row.date),
    ).toThrow("reconciliation");
  });
  it("renders one spreadsheet selection area without active import or PDF panels", () => {
    const html = renderToStaticMarkup(<PerformanceInput />);
    expect(html.match(/type="file"/g)).toHaveLength(1);
    expect(html).toContain("Reservation Production History Reports");
    expect(html).toContain("Reservation Production Forecast Reports");
    expect(html).toContain("Upload setup only");
    expect(html).not.toContain("Market Codes");
    expect(html).not.toContain("Publish / Replace Source");
    expect(html).not.toContain('type="date"');
    expect(html).toContain("Open calendar for Production from date");
    expect(html).toContain("Open calendar for Production to date");
    const analysis = renderToStaticMarkup(<PerformanceAnalysis year={2026} />);
    expect(analysis).toContain("Primary Source Analysis");
    expect(analysis).toContain("legacy workbook BOB");
  });
});
describe("spreadsheet selection validation", () => {
  it("accepts named spreadsheet formats but rejects PDF, empty and oversized files", () => {
    for (const ext of ["xlsx", "XLS", "csv", "ods"])
      expect(
        spreadsheetSelectionError({ name: `source.${ext}`, size: 100 }),
      ).toBe("");
    expect(
      spreadsheetSelectionError({ name: "source.pdf", size: 100 }),
    ).toContain("spreadsheet");
    expect(
      spreadsheetSelectionError({ name: "source.xlsx", size: 0 }),
    ).toContain("empty");
    expect(
      spreadsheetSelectionError({
        name: "source.xlsx",
        size: 31 * 1024 * 1024,
      }),
    ).toContain("30 MB");
  });
});
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;",
  );
}, 30000);
afterAll(() => db.close());
describe("shared source replacement migration", () => {
  it("replaces only same kind/dimension/date and rejects stale run dates without changing unrelated sources", async () => {
    const sql = readFileSync(
      "supabase/migrations/20261121_performance_sources.sql",
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.exec("set role anon");
    await expect(
      db.query("select * from public.performance_source_rows"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role service_role");
    const save = (
      id: string,
      dim: string,
      kind: string,
      asOf: string,
      amount: number,
    ) =>
      db.query(
        "select public.publish_performance_source($1,$2,$3,$4,$5,$6,$7::jsonb)",
        [
          id,
          kind,
          dim,
          row.date,
          row.date,
          asOf,
          JSON.stringify([{ ...row, roomRevenue: amount }]),
        ],
      );
    await save("first", "market", "history", "2026-11-21", 200);
    await save("country", "country", "history", "2026-11-21", 200);
    await save("forecast", "market", "forecast", "2026-11-21", 200);
    await save("second", "market", "history", "2026-11-22", 300);
    const rows = (
      await db.query<{ data: { roomRevenue: number } }>(
        "select * from public.performance_source_rows where kind='history' and dimension='market'",
      )
    ).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].data.roomRevenue).toBe(300);
    expect(
      (await db.query("select * from public.performance_source_rows")).rows,
    ).toHaveLength(3);
    await expect(
      save("old", "market", "history", "2026-11-20", 5),
    ).rejects.toThrow("stale");
    await expect(
      save("second", "market", "history", "2026-11-22", 5),
    ).rejects.toThrow("Duplicate");
  });
});
