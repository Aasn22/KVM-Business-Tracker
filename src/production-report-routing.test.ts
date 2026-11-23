import { describe, it, expect } from "vitest";
import { productionReportMode } from "./productionReports";
import { readFileSync } from "node:fs";
describe("existing reports use uploaded production", () => {
  it("maps Quick Reports and custom report types to the same supported production breakdowns", () => {
    for (const id of ["villas", "villa"])
      expect(productionReportMode(id)).toBe("room");
    for (const id of ["meals", "meal"])
      expect(productionReportMode(id)).toBe("meal");
    expect(productionReportMode("executive")).toBe("market");
    expect(productionReportMode("market")).toBe("market");
    expect(productionReportMode("monthly")).toBe("monthly");
    expect(productionReportMode("segment")).toBe("segment");
    expect(productionReportMode("pace")).toBe("pace");
  });
  it("removes the two source report entry buttons and routes both existing report flows to production", () => {
    const source = readFileSync("src/ReportLibrary.tsx", "utf8");
    expect(source).not.toContain("Q1 2026 Reservation Production Reports");
    expect(source).not.toContain("Primary Reservation Source Reports");
    expect(source).toContain("productionReportMode(selected)");
    expect(source).toContain("productionReportMode(quick.id)");
    expect(source).toContain("initialStatus={productionStatus}");
  });
});
