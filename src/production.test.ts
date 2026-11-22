import { describe, it, expect } from "vitest";
import { buildProduction, productionSummary } from "./production";
import { cleanProductionSnapshot } from "../api/production";
const headers = [
  "Confirmed Date",
  "Reservation Status",
  "Arrival Date",
  "Departure Date",
  "Nights",
  "Adults",
  "Child",
  "Agent Name",
  "Source Code",
  "Market Code",
  "Cancelled Date",
  "Country",
  "Room Type",
  "Rate Code",
  "Room Rate",
  "Room Rate",
  "Meal Plan",
];
const row = (changes: Record<number, unknown> = {}) => {
  const r: unknown[] = [
    "2025-12-01",
    "CHECKED OUT",
    "2026-01-01",
    "2026-01-03",
    2,
    2,
    0,
    "PRIVATE AGENT",
    "FIT",
    "BAR",
    "",
    "IN",
    "BVR",
    "REG",
    100,
    { formula: "O2*E2", result: 200 },
    "HB",
  ];
  for (const [k, v] of Object.entries(changes)) r[Number(k)] = v;
  return r;
};
describe("production workbook analytics", () => {
  it("allocates revenue by stay day, excludes departure and retains approved agent field", () => {
    const d = buildProduction(headers, [row()]);
    expect(d.days.map((r) => r.date)).toEqual(["2026-01-01", "2026-01-02"]);
    expect(
      productionSummary(d, "2026-01-02", "2026-01-02", "asia", "room"),
    ).toMatchObject({ nights: 1, revenue: 100, arrivals: 0 });
    expect(productionSummary(d, "2026-01-03", "2026-01-03").nights).toBe(0);
    expect(d.reservations![0].agent).toBe("PRIVATE AGENT");
    expect(d.pace[0]).toMatchObject({ bookings: 1, revenue: 200 });
  });
  it("retains complimentary/house-use stays and does not zero unknown regular revenue", () => {
    const d = buildProduction(headers, [
      row({ 8: "CMP", 15: null }),
      row({ 9: "HSE", 15: null }),
      row({ 13: "SYST", 15: null }),
      row({ 15: null }),
    ]);
    expect(d.rows).toBe(4);
    expect(d.missingRevenue).toBe(1);
    expect(productionSummary(d, d.from, d.to).complimentary).toBe(6);
    expect(productionSummary(d, d.from, d.to).nights).toBe(8);
  });
  it("keeps cancelled potential values separate and retains zero-night administrative rows", () => {
    const d = buildProduction(headers, [
      row(),
      row({ 1: "CANCELLED" }),
      row({ 3: "2026-01-01", 4: 0, 12: "PM", 15: 0 }),
    ]);
    expect(d.checkedOut).toBe(2);
    expect(d.cancelled).toBe(1);
    expect(productionSummary(d, d.from, d.to).revenue).toBe(200);
    expect(
      productionSummary(d, d.from, d.to, null, "country", "CANCELLED").revenue,
    ).toBe(200);
  });
  it("rejects mismatched nights but accepts reservation statuses", () => {
    expect(() => buildProduction(headers, [row({ 4: 3 })])).toThrow("Nights");
    expect(
      buildProduction(headers, [row({ 1: "RESERVED" })]).statuses?.RESERVED,
    ).toBe(1);
  });
  it("sanitizes server payload, removes private keys, and rejects bad values", () => {
    const d = buildProduction(headers, [row()]);
    const safe = cleanProductionSnapshot({
      ...d,
      guest: "SECRET",
      days: d.days.map((r) => ({ ...r, guest: "SECRET" })),
    });
    expect(JSON.stringify(safe)).not.toContain("SECRET");
    expect(() =>
      cleanProductionSnapshot({
        ...d,
        reservations: [{ ...d.reservations![0], revenue: Infinity }],
      }),
    ).toThrow();
  });
});
