import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("direct page icon rail", () => {
  it("shows every destination without grouped expanders or a drawer", () => {
    vi.stubGlobal("window", { location: { pathname: "/reports" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain('aria-label="Page navigation"');
    for (const name of [
      "Commercial Pulse",
      "Management Lense",
      "Reports Library",
      "Business Insight",
      "Asia",
      "America",
      "Middle East",
      "Russia / CIS",
      "Europe",
      "Other Markets",
      "Property Setup",
      "Data Input",
      "Activity Log",
    ])
      expect(html).toContain(`aria-label="${name}"`);
    expect(html).not.toContain('id="platform-navigation"');
    expect(html).not.toContain("Open Portal navigation");
    expect(html).toContain('href="/admin-data-input"');
  });
});
