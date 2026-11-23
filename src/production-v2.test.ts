import { describe, it, expect } from "vitest";
import {
  buildProduction,
  productionRowsForBasis,
  productionSummary,
  sanitizeProductionReservations,
} from "./production";
import { quickReports } from "./quickReports";
const h = [
  "Confirmed Date",
  "Reservation Status",
  "Arrival Date",
  "Departure Date",
  "Nights",
  "Source Code",
  "Market Code",
  "Country",
  "Room Type",
  "Rate Code",
  "Meal Plan",
  "Room Revenue",
  "Cancelled Date",
  "Agent Name",
];
const row = (status = "NO SHOW") => [
  "2025-11-01",
  status,
  "2025-12-31",
  "2026-01-02",
  2,
  "NEW CHANNEL",
  "NEWSEG",
  "XY",
  "NEWROOM",
  "NEW RATE",
  "NEWMEAL",
  200,
  "2026-02-12",
  "Example Travel",
];
describe("production status and calendar/event model", () => {
  it("accepts No Show and unconfigured codes with their raw identity, without adding them to stayed revenue", () => {
    const d = buildProduction(h, [row()]);
    expect(d.rows).toBe(1);
    expect(d.statuses?.["NO SHOW"]).toBe(1);
    expect(d.checkedOut).toBe(0);
    expect(d.cancelled).toBe(0);
    expect(d.days[0].source).toBe("NEW CHANNEL");
    expect(d.days[0].agent).toBe("Example Travel");
    expect(d.days[0].segment).toBe("Unclassified: NEWSEG");
    expect(productionSummary(d, "2025-01-01", "2026-12-31").revenue).toBe(0);
    expect(
      productionSummary(
        d,
        "2026-01-01",
        "2026-01-01",
        null,
        "country",
        "NO SHOW",
      ).revenue,
    ).toBe(100);
  });
  it("splits cross-year stays, retains booking and cancellation event dates in their proper years", () => {
    const d = buildProduction(h, [row("CANCELLED")]);
    expect(d.days.map((r) => r.date)).toEqual(["2025-12-31", "2026-01-01"]);
    const cancelled = productionRowsForBasis(d, "cancellation");
    expect(cancelled.rows[0]).toMatchObject({
      date: "2026-02-12",
      nights: 2,
      revenue: 200,
      arrivals: 1,
    });
    expect(productionRowsForBasis(d, "booking").rows[0].date).toBe(
      "2025-11-01",
    );
  });
  it("retains every supplied nonblank status and tracks missing event dates rather than using stay dates", () => {
    for (const status of [
      "RESERVED",
      "CHECKED IN",
      "DUE IN",
      "NO-SHOW",
      "CANCELED",
      "CUSTOM STATUS",
    ])
      expect(buildProduction(h, [row(status)]).rows).toBe(1);
    const r = row("CANCELLED");
    r[12] = "";
    const d = buildProduction(h, [r]);
    expect(productionRowsForBasis(d, "cancellation")).toMatchObject({
      rows: [],
      missingDates: 1,
    });
  });
  it("sanitizes saved reservations and does not retain arbitrary guest/password fields", () => {
    const d = buildProduction(h, [row()]);
    const clean = sanitizeProductionReservations(
      d.reservations!.map((r) => ({
        ...r,
        guestName: "SECRET",
        password: "SECRET",
      })),
    );
    expect(JSON.stringify(clean)).not.toContain("SECRET");
  });
  it("adds No Show Quick Report", () =>
    expect(quickReports.find((r) => r.id === "noshow")?.title).toBe(
      "No Show Reports",
    ));
});
