import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("direct page icon rail", () => {
  it("keeps main pages direct and groups only Markets with a full-name menu", () => {
    vi.stubGlobal("window", { location: { pathname: "/reports" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain('aria-label="Page navigation"');
    for (const name of [
      "Commercial Pulse",
      "Management Lense",
      "Reports Library",
      "Business Insight",
      "Property Setup",
      "Data Input",
      "Activity Log",
    ])
      expect(html).toContain(`aria-label="${name}"`);
    expect(html).toContain('aria-label="Markets"');
    expect(html).toContain('aria-label="Show full navigation"');
    expect(html).not.toContain('id="full-navigation"');
    expect(html).not.toContain('aria-label="Asia"');
    expect(html).not.toContain("Open Portal navigation");
    expect(html).toContain('href="/admin-data-input"');
  });
});
