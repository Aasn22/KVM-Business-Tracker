import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import MarketPage, { MarketBreakdownCard } from "./MarketPage";
import { blank, markets, type Entry } from "./model";
describe("shared market sample layout", () => {
  it("renders category/month selectors and four independent weekly cards without wide tables", () => {
    const data = blank("asia");
    data.commercial[0].targets = [10.25, 20, 30, 40];
    data.commercial[1].targets = [1000, 2000, 3000, 4000];
    const html = renderToStaticMarkup(
      <MarketPage
        market="asia"
        name="Asia"
        year={2027}
        entries={[
          {
            market_id: "asia",
            year: 2027,
            month: 1,
            version: 1,
            data,
          } as Entry,
        ]}
        onBack={() => {}}
      />,
    );
    expect(html).toContain("Commercial Targets");
    expect(html).toContain("Villa Types");
    expect(html).toContain("Action Plans");
    expect(html).toContain("Target ADR");
    expect(html).toContain("$98");
    expect(html).not.toContain("10.25");
    expect(html).toContain("Room Nights</h3>");
    expect(html).toContain("WEEK 4 / 5");
    expect(html).not.toContain("<table");
    expect(html).toContain('aria-pressed="true"');
  });
  it("applies to every market and never converts missing planning data to zero", () => {
    for (const market of markets) {
      const html = renderToStaticMarkup(
        <MarketPage
          market={market.id}
          name={market.name}
          year={2026}
          entries={[]}
          onBack={() => {}}
        />,
      );
      expect(html).toContain("Missing data is not zero");
      expect(html).toContain("—");
    }
  });
});

describe("compact category cards", () => {
  it("uses five compact rows for villa, country and meal breakdowns, not four week boxes", () => {
    for (const key of ["villas", "countries", "meals"] as const) {
      for (const row of blank("asia")[key]) {
        const html = renderToStaticMarkup(<MarketBreakdownCard row={row} />);
        expect(html).toContain("market-mini-breakdown");
        expect(html.match(/role="row"/g)).toHaveLength(5);
        expect(html).toContain("Target");
        expect(html).toContain("Variance");
        expect(html).not.toContain("market-category-weeks");
      }
    }
  });
});
