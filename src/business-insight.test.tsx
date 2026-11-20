import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import BusinessInsight, { InsightChart } from "./BusinessInsight";
import {
  annualArrivals,
  globalQuarters,
  insightSources,
  riskSurvey,
  sourceMarkets,
  travelReceipts,
  yoy,
} from "./insightData";
import App from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("dated Business Insight", () => {
  it("labels primary vs secondary sources, publication gaps and no automatic feed", () => {
    const html = renderToStaticMarkup(<BusinessInsight />);
    expect(html).toContain("20 November 2026");
    expect(html).toContain("not an automatic live feed");
    expect(html).toContain("Secondary reporting of Ministry statistics");
    expect(html).toContain("26 Oct");
    expect(html).toContain("not a November assessment");
    expect(html).toContain("analysis, not reported forecasts");
    for (const source of Object.values(insightSources)) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(html).toContain(source.url.replaceAll("&", "&amp;"));
    }
  });
  it("uses evidence values and never invents missing months", () => {
    expect(annualArrivals.map((r) => r.value)).toEqual([2046615, 2246516]);
    expect(travelReceipts).toHaveLength(8);
    expect(travelReceipts.at(-1)).toEqual({ label: "Aug", value: 400.1 });
    expect(globalQuarters.map((r) => r.value)).toEqual([2, -1, 0.4]);
    expect(riskSurvey.reduce((s, r) => s + r.value, 0)).toBe(100);
    expect(sourceMarkets).toHaveLength(3);
    expect(yoy(1900838, 1961566)).toBeCloseTo(-3.09589, 3);
  });
  it("gives every chart exact visible values, an accessible data table, source and period", () => {
    const html = renderToStaticMarkup(
      <InsightChart
        title="Evidence chart"
        rows={globalQuarters}
        unit="% year on year"
        source="global"
      />,
    );
    expect(html).toContain('role="img"');
    expect(html).toContain("View chart data");
    expect(html).toContain("<caption>");
    expect(html).toContain("Q2 2026");
    expect(html).toContain("-1%");
    expect(html).toContain("January–June 2026");
  });
  it("opens a public standalone insight route without irrelevant budget export/year controls", () => {
    vi.stubGlobal("window", { location: { pathname: "/business-insight" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain("Business Insight</h1>");
    expect(html).toContain("Sources &amp; methodology");
    expect(html).not.toContain("Budget year");
    expect(html).not.toContain("Export report");
  });
});
