import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import ExcelJS from "exceljs";
import { makeDemo, blank, row, type Entry } from "./model";
import {
  managementReport,
  managementExportTables,
  unavailable,
} from "./management";
import { exportManagementReport } from "./managementExport";
import TotalReview from "./TotalReview";
describe("spreadsheet management report", () => {
  it("derives each month, quarter and year from the same six-market records", () => {
    const entries = makeDemo(2027);
    const r = managementReport(entries, 2027);
    expect(r.annual.count).toBe(72);
    expect(r.annual.complete).toBe(true);
    expect(r.commercial("year", "Room Revenue").budget).toBe(
      entries.reduce((s, e) => s + e.data.commercial[1].budget, 0),
    );
    const q = r.commercial("q1", "Room Revenue").budget!;
    expect(q).toBe(
      [1, 2, 3].reduce(
        (s, m) => s + r.commercial(String(m), "Room Revenue").budget!,
        0,
      ),
    );
    expect(r.periods).toHaveLength(17);
    const marketTable = managementExportTables(r, false)[1];
    const asia = marketTable.rows.find(
      (row) => row[0] === "Asia" && row[1] === "Room Revenue",
    )!;
    expect(asia[5]).toBe("1/1"); // January coverage for this market, not all five.
  });
  it("filters market/year without changing sources or turning no data into zero", () => {
    const e = makeDemo(2027);
    const r = managementReport([...e, ...makeDemo(2025)], 2027, "europe");
    expect(r.annual.count).toBe(12);
    expect(r.annual.expected).toBe(12);
    expect(r.annual.complete).toBe(true);
    const missing = managementReport(
      e.filter((v) => v.month !== 1),
      2027,
    );
    expect(missing.periods[0].count).toBe(0);
    expect(missing.commercial("1", "Room Nights").budget).toBeNull();
    expect(missing.annual.complete).toBe(false);
  });
  it("keeps missing category data unavailable and aggregates shared labels exactly once", () => {
    const e = makeDemo(2027).filter((v) => v.month === 1);
    e.forEach((v) => (v.data.villas = [row("Shared Villa", 10, 5)]));
    const r = managementReport([...e, ...e], 2027);
    expect(r.values("1", "villas", "Shared Villa").budget).toBe(60);
    expect(r.values("2", "villas", "Shared Villa").budget).toBeNull();
  });
  it("uses weighted ADR and no available rate when room nights are zero", () => {
    const entries: Entry[] = [
      {
        market_id: "asia",
        year: 2027,
        month: 1,
        data: blank("asia"),
        version: 0,
      },
      {
        market_id: "europe",
        year: 2027,
        month: 1,
        data: blank("europe"),
        version: 0,
      },
    ];
    entries[0].data.commercial = [
      row("Room Nights", 1, 0),
      row("Room Revenue", 100, 0),
    ];
    entries[1].data.commercial = [
      row("Room Nights", 9, 0),
      row("Room Revenue", 1800, 0),
    ];
    const r = managementReport(entries, 2027);
    expect(r.commercial("year", "ADR").budget).toBe(190);
    expect(r.commercial("year", "ADR").bob).toBeNull();
  });
  it("synchronizes saved data and notes without additional input", () => {
    const entries = makeDemo(2027);
    const before = managementReport(entries, 2027).commercial(
      "year",
      "Room Revenue",
    ).bob!;
    entries[0].data.commercial[1].bob += 123;
    entries[0].data.notes = "Saved corrective action";
    const r = managementReport(entries, 2027);
    expect(r.commercial("year", "Room Revenue").bob).toBe(before + 123);
    expect(r.notes[0]).toMatchObject({
      market: "Asia",
      month: 1,
      quarter: 1,
      text: "Saved corrective action",
    });
  });
  it("renders all six spreadsheet sections and has no writable fields", () => {
    const html = renderToStaticMarkup(
      <TotalReview entries={makeDemo(2027)} year={2027} loading={false} demo />,
    );
    for (const text of [
      "MONTHLY COMMERCIAL",
      "VILLA TYPE",
      "QUARTERLY TARGETS",
      "MEAL PLAN BOOKING",
      "MARKET PERFORMANCE",
      "SIGN-OFF",
      "BOB is business on the books",
      "Not available",
    ])
      expect(html).toContain(text);
    expect(html).not.toContain("<input");
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("contentEditable");
    expect(html).not.toContain("Save changes");
  });
  it("exports all months, quarters, market contributions and notes with honest missing fields", async () => {
    const r = managementReport(makeDemo(2027), 2027);
    const tables = managementExportTables(r, true);
    expect(tables.map((t) => t.name)).toEqual([
      "Management Review",
      "Market Performance",
      "Actions",
    ]);
    expect(tables[0].rows[6]).toContain("December budget");
    expect(tables[0].rows[6]).toContain("Quarter 4 BOB");
    let blob: Blob | undefined;
    vi.stubGlobal("document", {
      createElement: () => ({ click: vi.fn(), href: "", download: "" }),
    });
    const spy = vi.spyOn(URL, "createObjectURL").mockImplementation((b) => {
      blob = b as Blob;
      return "blob:test";
    });
    try {
      await exportManagementReport(r, true);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(await blob!.arrayBuffer());
      expect(book.getWorksheet("Management Review")!.getCell("A1").value).toBe(
        "Management Review",
      );
      expect(book.getWorksheet("Market Performance")!.rowCount).toBeGreaterThan(
        20,
      );
      expect(JSON.stringify(tables)).toContain("Fictional demo figures");
      expect(unavailable).toBe("Not available");
    } finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
