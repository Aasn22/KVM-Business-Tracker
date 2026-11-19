import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import App from "./App";
afterEach(() => vi.unstubAllGlobals());
describe("public read-only dashboard", () => {
  it("opens the dashboard with clear real-data labels and no login form", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).toContain("Public real-budget review");
    expect(html).not.toContain("Fictional figures");
    expect(html).toContain("EYE on every market");
    expect(html).not.toContain("Email me a sign-in link");
    expect(html).not.toContain("Try Super Admin");
    expect(html).not.toContain(">Admin Data Input</button>");
    expect(html).not.toContain(">Property Setup</button>");
    expect(html).toContain("Protected admin access");
  });
});
