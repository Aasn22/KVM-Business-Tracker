import { describe, it, expect, vi } from "vitest";
import ExcelJS from "exceljs";
import { makeDemo, summarize, row, blank, adr, type Entry } from "./model";
import { periodMonths, sumData, totalReview, totalLabel } from "./totals";
import { exportWorkbook } from "./workbooks";
describe("automatic total review", () => {
  it("maps monthly, quarterly and annual periods", () => {
    expect(periodMonths("year")).toHaveLength(12);
    expect(periodMonths("q2")).toEqual([4, 5, 6]);
    expect(periodMonths("12")).toEqual([12]);
    expect(periodMonths("q5")).toEqual([]);
  });
  it("totals exactly the five markets once for the selected year", () => {
    const records = makeDemo(2027);
    const review = totalReview([...records, ...makeDemo(2021)], 2027, "year");
    expect(review.complete).toBe(true);
    expect(review.monthly).toHaveLength(12);
    expect(review.sources).toHaveLength(60);
    expect(review.coverage).toBe("60/60 market-month records available");
    expect(summarize(review.monthly)).toEqual(summarize(records));
    const doubled = totalReview(
      [...records, ...records, ...review.monthly],
      2027,
      "year",
    );
    expect(summarize(doubled.monthly)).toEqual(summarize(records));
  });
  it("filters historical monthly and quarterly totals", () => {
    const entries = makeDemo(2021);
    expect(totalReview(entries, 2021, "q1").sources).toHaveLength(15);
    expect(totalReview(entries, 2021, "5").sources).toHaveLength(5);
    expect(totalReview(entries, 2027, "year").sources).toHaveLength(0);
  });
  it("marks missing or unauthorized records as partial without inventing rows", () => {
    const onlyAsia = makeDemo(2027).filter(
      (e) => e.market_id === "asia" && e.month === 1,
    );
    const r = totalReview(onlyAsia, 2027, "q1");
    expect(r.complete).toBe(false);
    expect(r.missing).toHaveLength(14);
    expect(r.monthly).toHaveLength(1);
    expect(r.notice).toContain("Partial total");
    expect(r.coverage).toContain("1/15");
    expect(totalReview([], 2027, "year").monthly).toHaveLength(0);
  });
  it("sums category labels and all weekly target/BOB pairs without modifying sources", () => {
    const a: Entry = {
      market_id: "asia",
      year: 2027,
      month: 1,
      version: 1,
      data: blank("asia"),
    };
    const b: Entry = { ...a, market_id: "europe", data: blank("europe") };
    a.data.villas = [row("Shared", 10, 4), row("Only Asia", 3, 1)];
    b.data.villas = [row("Shared", 20, 8)];
    a.data.villas[0].weekly = [1, 2, 3, 4];
    b.data.villas[0].weekly = [4, 3, 2, 1];
    const original = structuredClone([a, b]);
    const r = sumData([a, b]);
    expect(r.villas[0]).toEqual({
      label: "Shared",
      budget: 30,
      bob: 12,
      targets: [18, 7.5, 3, 1.5],
      weekly: [5, 5, 5, 5],
    });
    expect(r.villas[1].budget).toBe(3);
    expect([a, b]).toEqual(original);
  });
  it("calculates weighted ADR from totals instead of adding market ADRs", () => {
    const records = makeDemo(2027)
      .filter((e) => e.month === 1)
      .slice(0, 2);
    records[0].data.commercial = [
      row("Room Nights", 1, 1),
      row("Room Revenue", 100, 100),
    ];
    records[1].data.commercial = [
      row("Room Nights", 9, 9),
      row("Room Revenue", 1800, 1800),
    ];
    const d = totalReview(records, 2027, "1").data;
    expect(adr(d.commercial[1].budget, d.commercial[0].budget)).toBe(190);
  });
  it("reflects saved market changes in subsequent totals", () => {
    const records = makeDemo(2027);
    const before = summarize(totalReview(records, 2027, "year").sources).bob;
    records.find((e) => e.market_id === "europe")!.data.commercial[1].bob +=
      500;
    expect(summarize(totalReview(records, 2027, "year").sources).bob).toBe(
      before + 500,
    );
  });
  it("exports derived totals and weekly breakdowns with year and partial coverage metadata", async () => {
    const records = makeDemo(2025).filter(
      (e) => e.market_id === "europe" && e.month <= 3,
    );
    const review = totalReview(records, 2025, "q1");
    let captured: Blob | undefined;
    const click = vi.fn();
    vi.stubGlobal("document", {
      createElement: () => ({ click, href: "", download: "" }),
    });
    const create = vi
      .spyOn(URL, "createObjectURL")
      .mockImplementation((blob) => {
        captured = blob as Blob;
        return "blob:test";
      });
    try {
      await exportWorkbook(review.monthly, "total-test");
      expect(click).toHaveBeenCalledOnce();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await captured!.arrayBuffer());
      const sheet = workbook.getWorksheet("Performance")!;
      expect(sheet.rowCount).toBe(4);
      expect(sheet.getCell("A2").value).toBe(totalLabel);
      expect(sheet.getCell("B2").value).toBe(2025);
      expect(sheet.getCell("L2").value).toContain("Partial total");
      expect(
        sheet
          .getColumn(4)
          .values.slice(2)
          .reduce((a, b) => Number(a) + Number(b), 0),
      ).toBe(summarize(records).budget);
      expect(workbook.getWorksheet("Breakdowns")!.getCell("A2").value).toBe(
        totalLabel,
      );
    } finally {
      create.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
