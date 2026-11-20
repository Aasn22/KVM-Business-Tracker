import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App, { Numeric } from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("read-only views and admin entry", () => {
  it("uses the transparent Kuda Villingili logo in both sidebar positions", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App />);
    expect(html).toMatch(
      /class="brand-icon"[^>]*src="\/kuda-villingili-logo.png"[^>]*alt="Kuda Villingili"/,
    );
    expect(html).toMatch(
      /class="workspace-icon"[^>]*src="\/kuda-villingili-logo.png"[^>]*alt=""/,
    );
    expect(html.match(/src="\/kuda-villingili-logo.png"/g)).toHaveLength(2);
    expect(html).toContain("KVM BUSINESS LENSE");
    expect(html).toContain("EYE on every market. One clear view.");
    expect(html).not.toContain("BUSINESS TRACKER");
  });
  it("merges the resort card and duplicate overview into one current-page button", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App />);
    expect(html.match(/aria-label="KVM-OVERVIEW"/g)).toHaveLength(1);
    expect(html).toContain('aria-current="page"');
    expect(html).not.toContain(">Overview</button>");
    expect(html).not.toContain("Resort Maldives</small>");
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
      "KVM-OVERVIEW</div>",
      "PORTAL",
      "Management Review",
      "Reports",
      "YOUR MARKETS",
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
    expect(sidebar.match(/Management Review/g)).toHaveLength(1);
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
