import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PulseContent } from "./PulsePage";
import { pulsePlanning, pulseActual, pulseYoY, pulseYears } from "./pulseData";
import { blank, type Entry } from "./model";
import type { ProductionData } from "./production";
const e = (year: number, market_id = "asia") => {
  const data = blank(market_id);
  data.commercial[0].budget = 10;
  data.commercial[0].bob = 5;
  data.commercial[1].budget = 1000;
  data.commercial[1].bob = 600;
  return { year, market_id, month: 1, version: 1, data } as Entry;
};
describe("compact linked Pulse", () => {
  it("has exactly two requested sections, six unique historical years and six markets plus total", () => {
    const html = renderToStaticMarkup(
      <PulseContent budgets={[e(2027)]} production={null} />,
    );
    expect(html.match(/<section /g)).toHaveLength(2);
    expect(html.match(/class="pulse-mini-column"/g)).toHaveLength(13);
    expect(pulseYears).toEqual([2021, 2022, 2023, 2024, 2025, 2026]);
    expect(html).toContain("RUSSIA / CIS");
    expect(html).toContain("TOTAL");
    expect(html).not.toContain("<button");
    expect(html).not.toContain("Revenue at a glance");
    expect(html).not.toContain("Source reports");
    expect(html).toContain("—");
  });
  it("derives budgets/weighted ADR from same records and keeps missing data unavailable", () => {
    expect(pulsePlanning([e(2027), e(2027, "europe")])).toMatchObject({
      budget: 2000,
      bob: 1200,
      nights: 20,
      targetADR: 100,
      bobADR: 120,
    });
    expect(pulsePlanning([]).budget).toBe(null);
    expect(pulsePlanning([e(2027), e(2027)]).budget).toBe(1000);
  });
  it("counts completed stays only and suppresses unmatched YoY", () => {
    const data = {
      days: [
        {
          date: "2026-01-01",
          status: "CHECKED OUT",
          revenue: 100,
          nights: 1,
          missingRevenue: 0,
        },
        {
          date: "2026-01-01",
          status: "CANCELLED",
          revenue: 999,
          nights: 1,
          missingRevenue: 0,
        },
      ],
    } as ProductionData;
    expect(pulseActual(data, 2026).revenue).toBe(100);
    expect(pulseYoY(data).revenue).toBe(null);
    const both = {
      ...data,
      days: [
        ...data.days,
        { ...data.days[0], date: "2025-01-01", revenue: 80 },
      ],
    };
    expect(pulseYoY(both).revenue?.amount).toBe(20);
    expect(pulseYoY(both).revenue?.percent).toBe(25);
  });
});
