import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { blankHistory, cleanHistory, historySummary } from "./history";
import { HistoryTable } from "./HistoryUpdate";
import { pulseActual, pulseYearPlanning, pulseYoY } from "./pulseData";
import type { ProductionData } from "./production";
describe("manual historical year entry", () => {
  it("validates month sequence, whole nights and total>=room revenue while retaining zero and blanks", () => {
    const y = blankHistory(2024);
    expect(cleanHistory(y).months[0].budgetNights).toBeNull();
    y.months[0].budgetNights = 0;
    expect(cleanHistory(y).months[0].budgetNights).toBe(0);
    y.months[0].budgetNights = 1.2;
    expect(() => cleanHistory(y)).toThrow("whole");
    y.months[0].budgetNights = 10;
    y.months[0].actualTotalRevenue = 50;
    y.months[0].actualRoomRevenue = 100;
    expect(cleanHistory(y).months[0].actualTotalRevenue).toBe(50);
  });
  it("calculates weighted ADR and avoids division errors or summing monthly ADR", () => {
    const y = blankHistory(2024);
    Object.assign(y.months[0], {
      budgetNights: 10,
      budgetRoomRevenue: 1000,
      actualNights: 0,
      actualRoomRevenue: 0,
    });
    Object.assign(y.months[1], { budgetNights: 30, budgetRoomRevenue: 6000 });
    const t = historySummary(y.months);
    expect(t.budgetADR).toBe(175);
    expect(t.actualADR).toBeNull();
    expect(t.actualNights).toBe(0);
    expect(t.budgetTotalRevenue).toBeNull();
  });
  it("shows screenshot columns and calculated ADR, with correct month labels in quarterly reports", () => {
    const y = blankHistory(2024);
    const html = renderToStaticMarkup(
      <HistoryTable data={y} onChange={() => {}} />,
    );
    for (const col of [
      "Budgeted Room Nights",
      "Actual Room Nights",
      "Budgeted Room Revenue",
      "Actual Room Revenue",
      "Budgeted ADR",
      "Actual ADR",
      "Budgeted Total Revenue",
      "Actual Total Revenue",
    ])
      expect(html).toContain(col);
    expect(html.match(/<input/g)).toHaveLength(96);
    expect(html).not.toContain("DIV/0");
    const q = renderToStaticMarkup(
      <HistoryTable data={{ ...y, months: y.months.slice(3, 6) }} />,
    );
    expect(q).toContain("April");
    expect(q).not.toContain("January");
  });
  it("uses manually saved actuals instead of adding them to source production and computes matched manual-year YoY", () => {
    const a = blankHistory(2026),
      b = blankHistory(2025);
    Object.assign(a.months[0], {
      actualRoomRevenue: 200,
      actualNights: 2,
      actualTotalRevenue: 300,
      budgetNights: 3,
      budgetRoomRevenue: 600,
    });
    Object.assign(b.months[0], {
      actualRoomRevenue: 100,
      actualNights: 1,
      actualTotalRevenue: 200,
    });
    const prod = {
      days: [
        {
          date: "2026-01-01",
          status: "CHECKED OUT",
          revenue: 999,
          nights: 2,
          missingRevenue: 0,
        },
      ],
    } as ProductionData;
    expect(pulseActual(prod, 2026, [a]).revenue).toBe(200);
    expect(pulseActual(prod, 2026, [a]).totalRevenue).toBe(300);
    expect(pulseYearPlanning([], 2026, [a]).budget).toBe(600);
    expect(pulseYoY(prod, [a, b]).revenue?.amount).toBe(100);
    expect(pulseYoY(prod, [a, b]).totalRevenue?.amount).toBe(100);
  });
});
