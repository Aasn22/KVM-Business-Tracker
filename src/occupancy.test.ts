import { describe, it, expect } from "vitest";
import {
  availableNights,
  periodOccupancy,
  occupancyForDates,
  formatOccupancy,
} from "./occupancy";
import {
  blankHistory,
  cleanHistory,
  historyActual,
  historySummary,
  withRevenueReference,
} from "./history";
import { pulseActual } from "./pulseData";
describe("75-unit calendar occupancy and component history", () => {
  it("uses leap-aware 75 x period days without averaging monthly percentages", () => {
    expect(availableNights(2024, [2])).toBe(2175);
    expect(availableNights(2023, [2])).toBe(2100);
    expect(periodOccupancy(2175, 2024, [2])).toBe(100);
    expect(
      periodOccupancy(22042, 2027, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
    ).toBeCloseTo(80.5187);
    expect(occupancyForDates(75, "2026-01-01", "2026-01-01")).toBe(100);
    expect(formatOccupancy(null)).toBe("—");
    expect(periodOccupancy(0, 2026, [1])).toBe(0);
  });
  it("backward-compatible old saved months and new F&B/Other values feed annual actuals without replacing explicit totals", () => {
    const y = blankHistory(2022);
    Object.assign(y.months[0], {
      actualNights: 1846,
      actualRoomRevenue: 1559075,
      actualTotalRevenue: 2608766,
    });
    const seeded = withRevenueReference([y]);
    const a = historyActual(seeded.find((r) => r.year === 2022)!);
    expect(a.occupancy).toBeCloseTo((1846 / (75 * 365)) * 100);
    expect(a.foodRevenue).toBe(4208441);
    expect(a.otherRevenue).toBe(1992250);
    expect(a.totalRevenue).toBe(2608766);
    expect(pulseActual(null, 2022, seeded).foodRevenue).toBe(4208441);
    const old = JSON.parse(JSON.stringify(y));
    delete old.months[0].actualFoodRevenue;
    expect(cleanHistory(old).months[0].actualFoodRevenue).toBeNull();
  });
  it("retains December 2026 missing and sums monthly entries rather than wrong printed footer", () => {
    const y = withRevenueReference([]);
    expect(
      historySummary(y.find((r) => r.year === 2024)!.months).actualFoodRevenue,
    ).toBe(1288228);
    expect(
      y.find((r) => r.year === 2026)!.months[11].actualFoodRevenue,
    ).toBeNull();
  });
  it("derives an absent actual total only when all components exist; preserves explicit saved total", () => {
    const y = blankHistory(2026);
    Object.assign(y.months[0], {
      actualRoomRevenue: 100,
      actualFoodRevenue: 20,
      actualOtherRevenue: 10,
    });
    expect(historySummary(y.months).actualTotalRevenue).toBe(130);
    y.months[0].actualTotalRevenue = 140;
    expect(historySummary(y.months).actualTotalRevenue).toBe(140);
  });
});
