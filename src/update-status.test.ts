import { describe, it, expect } from "vitest";
import { blank, markets, makeDemo, summarize, type Entry } from "./model";
import { formatUpdate, lastSavedUpdate } from "./updateStatus";
import { managementReport } from "./management";
const entry = (version: number, updated_at?: string): Entry => ({
  market_id: "other-markets",
  year: 2027,
  month: 1,
  version,
  updated_at,
  data: blank("other-markets"),
});
describe("truthful update status and Other Markets", () => {
  it("uses actual latest saved timestamps, never a browser load or version-zero snapshot", () => {
    expect(
      lastSavedUpdate([entry(0, "2030-01-01"), entry(1, "invalid")]),
    ).toBeNull();
    expect(
      lastSavedUpdate([
        entry(1, "2026-11-20T07:00:00Z"),
        entry(2, "2026-11-20T08:00:00Z"),
      ]),
    ).toBe("2026-11-20T08:00:00.000Z");
    expect(formatUpdate(null)).toContain("Not available");
    expect(formatUpdate("2026-11-20T08:00:00Z")).toContain("20 Nov 2026");
    expect(formatUpdate("2026-11-20T08:00:00Z", true)).toContain("(local)");
  });
  it("places Other Markets after Europe, initializes blank and aggregates entered data", () => {
    expect(markets.at(-1)?.id).toBe("other-markets");
    const empty = makeDemo(2027).filter((e) => e.market_id === "other-markets");
    expect(empty).toHaveLength(12);
    expect(summarize(empty)).toEqual({
      budget: 0,
      bob: 0,
      nights: 0,
      booked: 0,
    });
    const entered = entry(1);
    entered.data.commercial[1].budget = 100;
    const report = managementReport([entered], 2027, "other-markets");
    expect(report.commercial("year", "Room Revenue").budget).toBe(100);
    expect(report.annual.complete).toBe(false);
  });
});
