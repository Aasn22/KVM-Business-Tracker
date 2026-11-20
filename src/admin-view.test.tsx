import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App, { Numeric } from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("read-only views and admin entry", () => {
  it("retains the main brand logo but gives Commercial Pulse a navigation icon", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App />);
    expect(html.match(/src="\/kuda-villingili-logo.png"/g)).toHaveLength(1);
    expect(html).toContain("KVM BUSINESS LENSE");
    expect(html).toContain(
      "Commercial performance, from historical benchmarks to future targets.",
    );
    expect(html).toContain(
      "A unified executive view of property budgets, market pace, and revenue forecasts.",
    );
    const button = html.match(
      /<button[^>]*aria-label="Commercial Pulse"[^>]*>[\s\S]*?<\/button>/,
    )?.[0];
    expect(button).toBeDefined();
    expect(button).not.toContain("<img");
    expect(button).toContain("<svg");
    expect(button).toContain('aria-current="page"');
    expect(html).not.toContain("KVM-OVERVIEW");
  });
  it("does not mark the overview card current on the admin page", () => {
    vi.stubGlobal("window", { location: { pathname: "/admin-data-input" } });
    expect(renderToStaticMarkup(<App />)).not.toContain('aria-current="page"');
  });
  it("groups Portal and Administrator pages in compact navigation", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App />);
    const sidebar = html.slice(
      html.indexOf("<aside"),
      html.indexOf("</aside>"),
    );
    const order = [
      "KVM PORTAL",
      "Commercial Pulse",
      "Management Lense",
      "Reports",
      "Business Insight",
      "MARKET INSIGHTS",
      "ADMINISTRATOR",
      "Property Setup",
      "Data Input",
      "Activity Log",
    ];
    for (let i = 1; i < order.length; i++)
      expect(sidebar.indexOf(order[i])).toBeGreaterThan(
        sidebar.indexOf(order[i - 1]),
      );
    expect(sidebar).not.toContain("WORKSPACE");
    expect(sidebar).not.toContain("Admin Data Input");
    expect(sidebar.match(/Management Lense/g)).toHaveLength(1);
  });
  it("provides a dedicated Property Setup route and visible navigation", () => {
    vi.stubGlobal("window", { location: { pathname: "/property-setup" } });
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Property Setup");
    expect(html).not.toContain("Demo Data Input");
    expect(html).not.toContain("Export report");
  });
  it("renders numbers as non-interactive text outside admin entry", () => {
    const html = renderToStaticMarkup(
      <Numeric
        editable={false}
        label="Room Revenue budget"
        value={270000}
        onChange={() => {
          throw Error("must not edit");
        }}
      />,
    );
    expect(html).toContain("270,000");
    expect(html).toContain('aria-label="Room Revenue budget: 270,000"');
    expect(html).not.toContain("<input");
    expect(html).not.toContain("spinbutton");
  });
  it("renders an editable numeric input only when explicitly enabled", () => {
    expect(
      renderToStaticMarkup(
        <Numeric
          editable
          label="Room Revenue budget"
          value={270000}
          onChange={() => {}}
        />,
      ),
    ).toContain('type="number"');
  });
  it("opens a distinct demo admin page through its URL", () => {
    vi.stubGlobal("window", { location: { pathname: "/admin-data-input" } });
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain("Demo Data Input");
    expect(html).toContain("Admin market");
    expect(html).toContain("Select a market");
    expect(html).not.toContain("Monthly performance");
  });
  it("does not display admin data-entry controls on the normal landing page", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App />);
    expect(html).not.toContain("Admin market");
    expect(html).not.toContain("Save changes");
    expect(html).not.toContain("Import Excel");
  });
});
