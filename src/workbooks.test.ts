import { describe, it, expect } from "vitest";
import { Workbook } from "exceljs";
import { importWorkbook } from "./workbooks";
import { months, makeDemo } from "./model";
async function fixture(
  market = "ASIA",
  year = 2027,
  missing = false,
  formulaMode: "cached" | "shared" | "missing" | "zero" = "cached",
) {
  const w = new Workbook();
  months.slice(0, missing ? 11 : 12).forEach((m) => {
    const s = w.addWorksheet(m.slice(0, 3).toUpperCase());
    s.getCell("A1").value = `RESORT - ${year}`;
    s.getCell("B4").value = market;
    s.getCell("A8").value = "Room Nights";
    s.getCell("B8").value = 100;
    s.getCell("C8").value = 20;
    s.getCell("A9").value = "Room Revenue";
    s.getCell("B9").value = { formula: "B8*1000", result: 100000 };
    s.getCell("C9").value = 20000;
    if (formulaMode === "zero")
      s.getCell("B9").value = { formula: "0*B8", result: 0 };
    if (formulaMode === "shared") {
      s.getCell("D8").value = { formula: "B8*0.6", result: 60 };
      s.getCell("D9").value = { sharedFormula: "D8", result: 60000 };
    }
    if (formulaMode === "missing")
      s.getCell("B9").value = { formula: "B8*1000" };
    for (const [r, label] of [
      [11, "2. VILLA TYPE TARGETS"],
      [12, "Villa Category"],
      [13, "Test Villa"],
      [14, "TOTAL"],
      [24, "3. COUNTRY REVENUE"],
      [25, "Meal Plan"],
      [26, "China"],
      [31, "Total"],
      [32, "4. MEAL PLAN TARGETS"],
      [33, "Meal Plan"],
      [34, "BB"],
      [39, "Total"],
      [40, "5. PERFORMANCE REVIEW"],
    ] as const)
      s.getCell(`A${r}`).value = label;
  });
  const buffer = await w.xlsx.writeBuffer();
  return new File([buffer], "test.xlsx");
}
describe("Excel imports", () => {
  it.each([2021, 2022, 2023, 2024, 2025])(
    "imports all twelve months for %i without accepting a different year",
    async (year) => {
      const file = await fixture("ASIA", year);
      const entries = await importWorkbook(file, "asia", year, []);
      expect(entries).toHaveLength(12);
      expect(entries.every((e) => e.year === year)).toBe(true);
      await expect(importWorkbook(file, "asia", 2027, [])).rejects.toThrow(
        "year",
      );
    },
  );
  it("preserves a cached zero formula without accepting missing results", async () => {
    const entries = await importWorkbook(
      await fixture("ASIA", 2027, false, "zero"),
      "asia",
      2027,
      [],
    );
    expect(entries[0].data.commercial[1].budget).toBe(0);
  });
  it("reads shared formula results", async () => {
    const entries = await importWorkbook(
      await fixture("ASIA", 2027, false, "shared"),
      "asia",
      2027,
      [],
    );
    expect(entries[0].data.commercial[1].targets[0]).toBe(60000);
  });
  it("rejects uncached formulas instead of importing zero", async () => {
    await expect(
      importWorkbook(
        await fixture("ASIA", 2027, false, "missing"),
        "asia",
        2027,
        [],
      ),
    ).rejects.toThrow("Missing numeric formula result");
  });
  it("maps twelve sheets, formulas, and breakdowns, preserving notes", async () => {
    const existing = makeDemo(2027);
    existing[0].data.notes = "Keep this plan";
    const e = await importWorkbook(await fixture(), "asia", 2027, existing);
    expect(e).toHaveLength(12);
    expect(e[0].data.commercial[1].budget).toBe(100000);
    expect(e[0].data.villas).toHaveLength(1);
    expect(e[0].data.countries[0].label).toBe("China");
    expect(e[0].data.meals[0].label).toBe("BB");
    expect(e[0].data.notes).toBe("Keep this plan");
  });
  it("rejects wrong market", async () => {
    await expect(
      importWorkbook(await fixture("AMERICA"), "asia", 2027, []),
    ).rejects.toThrow("market");
  });
  it("rejects wrong year", async () => {
    await expect(
      importWorkbook(await fixture(), "asia", 2028, []),
    ).rejects.toThrow("year");
  });
  it("requires all twelve sheets", async () => {
    await expect(
      importWorkbook(await fixture("ASIA", 2027, true), "asia", 2027, []),
    ).rejects.toThrow("Missing DEC");
  });
  it("rejects oversized files before parsing", async () => {
    const file = { size: 11 * 1024 * 1024 } as File;
    await expect(importWorkbook(file, "asia", 2027, [])).rejects.toThrow(
      "under 10 MB",
    );
  });
});
