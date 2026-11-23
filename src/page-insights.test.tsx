import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PageInsights, { pageInsightNotes } from "./PageInsights";
import { blank, type Entry } from "./model";
describe("public page insights", () => {
  it("is absent on every administrator page", () => {
    for (const view of ["admin", "property", "activity", "setup"])
      expect(
        renderToStaticMarkup(
          <PageInsights view={view} entries={[]} year={2027} market={null} />,
        ),
      ).toBe("");
  });
  it("uses only the selected year and market with explicit planning scope", () => {
    const data = blank("asia");
    data.commercial[1].budget = 1234;
    data.commercial[1].bob = 500;
    const rows = [
      { year: 2027, month: 1, market_id: "asia", data, version: 1 },
      { year: 2026, month: 1, market_id: "asia", data, version: 1 },
    ] as Entry[];
    const notes = pageInsightNotes("overview", rows, 2027, "asia").join(" ");
    expect(notes).toContain("$1,234");
    expect(notes).toContain("$500");
    expect(notes).toContain("1 of 12");
    expect(notes).toContain("not realized revenue");
    expect(
      pageInsightNotes("overview", rows, 2027, "europe").join(" "),
    ).toContain("No saved");
  });
  it("provides relevant notes without inventing missing report or industry values", () => {
    expect(pageInsightNotes("reports", [], 2027, null).join(" ")).toContain(
      "date range",
    );
    expect(pageInsightNotes("insight", [], 2027, null).join(" ")).toContain(
      "not a live news feed",
    );
    const html = renderToStaticMarkup(
      <PageInsights view="reports" entries={[]} year={2027} market={null} />,
    );
    expect(html).toContain("INSIGHTS");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('role="region"');
  });
});
