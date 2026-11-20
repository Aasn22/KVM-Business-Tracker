import { describe, it, expect } from "vitest";
import {
  adr,
  markets,
  restoreDemo,
  budgetYears,
  percentage,
  summarize,
  makeDemo,
  blank,
  validData,
  reportRows,
} from "./model";
describe("financial calculations", () => {
  it("handles zero denominators", () => {
    expect(adr(100, 0)).toBe(0);
    expect(percentage(1, 0)).toBe(0);
  });
  it("uses weighted ADR and saved totals", () => {
    const data = makeDemo(2027).slice(0, 2);
    data[0].data.commercial[0].bob = 1;
    data[0].data.commercial[1].bob = 100;
    data[1].data.commercial[0].bob = 9;
    data[1].data.commercial[1].bob = 1800;
    const total = summarize(data);
    expect(adr(total.bob, total.booked)).toBe(190);
    expect(reportRows(data)[0]["Revenue variance"]).toBe(
      100 - data[0].data.commercial[1].budget,
    );
  });
  it("creates separate years and market months", () => {
    expect(makeDemo(2027)).toHaveLength(72);
    expect(
      new Set(makeDemo(2027).map((e) => `${e.market_id}-${e.month}`)).size,
    ).toBe(72);
  });
  it("rejects invalid numbers, weekly shapes, and oversized notes", () => {
    const d = blank("asia");
    expect(validData(d)).toBe(true);
    d.commercial[0].budget = -1;
    expect(validData(d)).toBe(false);
    d.commercial[0].budget = NaN;
    expect(validData(d)).toBe(false);
    d.commercial[0].budget = 0;
    d.commercial[0].weekly = [];
    expect(validData(d)).toBe(false);
  });
});

describe("historical years", () => {
  it("offers 2021–2025 while retaining the existing years", () => {
    expect(budgetYears).toEqual([
      2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
    ]);
  });
  it.each([2021, 2022, 2023, 2024, 2025])(
    "keeps %i entries and report rows tied to their year",
    (year) => {
      const historical = makeDemo(year);
      expect(historical).toHaveLength(72);
      expect(historical.every((e) => e.year === year)).toBe(true);
      expect(reportRows(historical).every((r) => r.Year === year)).toBe(true);
      historical[0].data.commercial[1].bob = 123;
      expect(makeDemo(2027)[0].data.commercial[1].bob).not.toBe(123);
    },
  );
});

describe("Europe market", () => {
  it("includes twelve Europe months in consolidated reports", () => {
    expect(markets.map((m) => m.id)).toContain("europe");
    const entries = makeDemo(2027);
    const europe = entries.filter((e) => e.market_id === "europe");
    expect(europe).toHaveLength(12);
    expect(blank("europe").countries).toHaveLength(11);
    expect(reportRows(europe).every((r) => r.Market === "Europe")).toBe(true);
    expect(summarize(entries).budget).toBe(
      summarize(entries.filter((e) => e.market_id !== "europe")).budget +
        summarize(europe).budget,
    );
  });
  it("preserves edits from the previous four-market demo while adding Europe", () => {
    const old = makeDemo(2027).filter((e) => e.market_id !== "europe");
    old[0].data.commercial[1].bob = 12345;
    old[0].data.notes = "Existing imported budget";
    const restored = restoreDemo(2027, old);
    expect(restored).toHaveLength(72);
    expect(restored[0].data).toEqual(old[0].data);
    expect(restored.filter((e) => e.market_id === "europe")).toHaveLength(12);
    expect(restoreDemo(2025, old)[0].data.notes).toBe("");
    expect(restoreDemo(2027, null)).toHaveLength(72);
  });
});
