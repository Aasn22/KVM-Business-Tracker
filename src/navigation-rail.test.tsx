import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("persistent navigation rail", () => {
  it("has accessible Portal, Markets and Admin toggles with a closed inert panel", () => {
    vi.stubGlobal("window", { location: { pathname: "/reports" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain('aria-label="Navigation categories"');
    for (const group of ["Portal", "Markets", "Admin"])
      expect(html).toContain(`aria-label="Open ${group} navigation"`);
    expect(html).toContain(
      'aria-label="Expanded navigation" inert="" aria-hidden="true"',
    );
    expect(html).toContain('aria-label="Close navigation"');
    expect(html).toContain("Reports Library");
    expect(html).toContain("Data Input");
  });
});
