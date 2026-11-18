import { describe, it, expect } from "vitest";
import {
  adr,
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
    expect(makeDemo(2027)).toHaveLength(48);
    expect(
      new Set(makeDemo(2027).map((e) => `${e.market_id}-${e.month}`)).size,
    ).toBe(48);
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
