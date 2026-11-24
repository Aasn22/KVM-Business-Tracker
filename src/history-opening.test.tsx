import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  blankHistory,
  cleanHistory,
  historySummary,
  withRevenueReference,
} from "./history";
import { HistoryTable } from "./HistoryUpdate";
import { pulseActual } from "./pulseData";
import { pasteHistory } from "./historyPaste";
describe("2021 opening-year revenue", () => {
  it("matches all supplied monthly totals, leaves room metrics unavailable and carries through Pulse", () => {
    const y = withRevenueReference([]).find((h) => h.year === 2021)!;
    const t = historySummary(y.months);
    expect(t.budgetTotalRevenue).toBe(8921065);
    expect(t.actualTotalRevenue).toBe(7844799);
    expect(t.actualRoomRevenue).toBeNull();
    expect(t.actualNights).toBeNull();
    expect(t.actualADR).toBeNull();
    expect(y.months[5]).toMatchObject({
      month: 6,
      budgetTotalRevenue: 720790,
      actualTotalRevenue: 22183,
    });
    expect(y.months[11].actualTotalRevenue).toBe(2440492);
    expect(pulseActual(null, 2021, [y]).totalRevenue).toBe(7844799);
  });
  it("marks Jan-May not opened instead of false zero occupancy and renders the source note", () => {
    const y = withRevenueReference([]).find((h) => h.year === 2021)!;
    expect(y.months.slice(0, 5).every((m) => m.notOpened === true)).toBe(true);
    expect(cleanHistory(y).months[0].notOpened).toBe(true);
    const html = renderToStaticMarkup(<HistoryTable data={y} />);
    expect(html.match(/NOT OPENED/g)).toHaveLength(5);
    expect(html).toContain("$8,921,065");
    expect(html).toContain("$7,844,799");
  });
  it("preserves saved financial overrides and rejects accidental paste into pre-opening rows", () => {
    const y = blankHistory(2021);
    y.version = 2;
    y.months[5].actualTotalRevenue = 12345;
    const merged = withRevenueReference([y]).find((h) => h.year === 2021)!;
    expect(merged.months[5].actualTotalRevenue).toBe(12345);
    expect(merged.version).toBe(2);
    expect(() => pasteHistory(merged, 0, "budgetNights", "1")).toThrow(
      "not opened",
    );
  });
});

it("does not reject a whole year when a saved room/total figure needs reconciliation", () => {
  const y = blankHistory(2021);
  y.version = 1;
  y.months[9].actualRoomRevenue = 2000000;
  y.months[9].actualTotalRevenue = 1948140;
  expect(() => cleanHistory(y)).not.toThrow();
  const merged = withRevenueReference([y]).find((h) => h.year === 2021)!;
  expect(merged.months[9].actualRoomRevenue).toBe(2000000);
  expect(merged.months[9].actualTotalRevenue).toBe(1948140);
  const html = renderToStaticMarkup(<HistoryTable data={merged} />);
  expect(html).toContain("Reconciliation");
  expect(html).toContain("exceeds actual total");
});
