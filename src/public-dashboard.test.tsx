import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("public read-only dashboard", () => {
  it("opens the dashboard with clear real-data labels and no login form", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain("Maintained by Revenue Director");
    expect(html).toContain("Database manually sourced from Opera (PMS)");
    expect(html).toContain("Last update: Not available");
    expect(html).not.toContain("Live database from Opera");
    expect(html).not.toContain("Data source details");
    expect(html).not.toContain("WORKBOOK SNAPSHOT");
    expect(html).toContain("compact-status");
    expect(html).not.toContain("Fictional figures");
    expect(html).toContain(
      "Commercial performance, from historical benchmarks to future targets.",
    );
    expect(html).not.toContain("Email me a sign-in link");
    expect(html).not.toContain("Try Super Admin");
    expect(html).not.toContain(">Data Input</button>");
    expect(html).not.toContain(">Property Setup</button>");
    expect(html).toContain('href="/property-setup"');
    expect(html).toContain('href="/admin-data-input"');
    expect(html).toContain("Property Setup");
    expect(html).toContain("Data Input");
    expect(html).not.toContain("PIN workspace");
    const sidebar = html.slice(
      html.indexOf('<nav class="icon-rail'),
      html.indexOf("</nav>"),
    );
    const order = [
      "Commercial Pulse",
      "Management Lense",
      "Reports Library",
      "Business Insight",
      "Property Setup",
      "Data Input",
      "Activity Log",
    ];
    for (let i = 1; i < order.length; i++)
      expect(sidebar.indexOf(order[i])).toBeGreaterThan(
        sidebar.indexOf(order[i - 1]),
      );
  });
});
