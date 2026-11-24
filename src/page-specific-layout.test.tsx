import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import App from "./App";
import MarketPage from "./MarketPage";
import { makeDemo, markets } from "./model";
afterEach(() => vi.unstubAllGlobals());
describe("page-specific formats, no repeated commercial analysis", () => {
  it("does not mount global ProductionAnalysis on Management/Insight/market pages", () => {
    const source = readFileSync("src/App.tsx", "utf8");
    expect(source).not.toContain("<ProductionAnalysis");
    expect(source).not.toContain("market-source-details");
    expect(source).toContain("<TotalReview");
    expect(source).toContain("<BusinessInsight");
    expect(source).toContain("<PulsePage");
  });
  it("puts completed-stay section after monthly targets/categories for every market", () => {
    const source = readFileSync("src/MarketPage.tsx", "utf8");
    expect(source.lastIndexOf("<MarketProduction")).toBeGreaterThan(
      source.indexOf("current[category].map"),
    );
    for (const m of markets) {
      const html = renderToStaticMarkup(
        <MarketPage
          market={m.id}
          name={m.name}
          year={2027}
          entries={makeDemo(2027)}
          onBack={() => {}}
        />,
      );
      expect(html.indexOf("Loading uploaded production")).toBeGreaterThan(
        html.indexOf("Read-only. Weekly snapshots"),
      );
    }
  });
  it("keeps Business Insight research and removes repeated performance filter area", () => {
    vi.stubGlobal("window", { location: { pathname: "/business-insight" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain("Sources &amp; methodology");
    expect(html).not.toContain("Production date basis");
  });
});
