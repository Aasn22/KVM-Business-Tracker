import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { blankHistory } from "./history";
import { historyInputValue, pasteHistory } from "./historyPaste";
describe("Excel history range paste", () => {
  it("pastes six editable columns over multiple months, parsing currency/grouping and blank cells", () => {
    const y = pasteHistory(
      blankHistory(2026),
      0,
      "budgetNights",
      "100\t80\t$1,000\t800\t$2,000\t1,200\r\n200\t\t3000\t\t4000\t",
    );
    expect(y.months[0]).toMatchObject({
      budgetNights: 100,
      actualRoomRevenue: 800,
      budgetTotalRevenue: 2000,
    });
    expect(y.months[1].actualNights).toBeNull();
  });
  it("accepts full screenshot table columns/months/header/footer, ignoring ADR formulas", () => {
    const y = pasteHistory(
      blankHistory(2026),
      0,
      "budgetNights",
      "Month\tBudgeted Room Nights\tActual Room Nights\tBudgeted Room Revenue\tActual Room Revenue\tBudgeted ADR\tActual ADR\tBudgeted Total Revenue\tActual Total Revenue\nMarch\t10\t5\t100\t50\t=1/0\t#DIV/0!\t200\t100\nTOTAL\t10\t5\t100\t50\t10\t10\t200\t100",
    );
    expect(y.months[2].budgetNights).toBe(10);
    expect(y.months[0].budgetNights).toBeNull();
  });
  it("supports partial range from selected cell and keeps rejected paste atomic", () => {
    const y = blankHistory(2026);
    expect(
      pasteHistory(y, 4, "actualRoomRevenue", "500").months[4]
        .actualRoomRevenue,
    ).toBe(500);
    expect(() => pasteHistory(y, 11, "budgetNights", "2\n3")).toThrow();
    expect(() => pasteHistory(y, 0, "budgetNights", "2\t3\nBOGUS")).toThrow();
    expect(y.months[0].budgetNights).toBeNull();
  });
  it("rejects the oversized screenshot input, decimal nights, formulas and inconsistent totals", () => {
    expect(() =>
      historyInputValue("184618461348740155", "budgetNights"),
    ).toThrow();
    expect(() => historyInputValue("1e100", "budgetNights")).toThrow();
    expect(() => historyInputValue("1.5", "actualNights")).toThrow();
    expect(() =>
      pasteHistory(
        blankHistory(2026),
        0,
        "budgetRoomRevenue",
        "100\t50\t10\t20",
      ),
    ).toThrow("Total revenue");
    expect(historyInputValue("0", "actualNights")).toBe(0);
  });
});

it("places History Update after the existing production and activity upload controls", () => {
  const source = readFileSync("src/App.tsx", "utf8");
  expect(source.indexOf("<HistoryUpdate")).toBeGreaterThan(
    source.indexOf("<PerformanceInput"),
  );
  expect(source.indexOf("<HistoryUpdate")).toBeGreaterThan(
    source.indexOf("<OperationalInput"),
  );
});
