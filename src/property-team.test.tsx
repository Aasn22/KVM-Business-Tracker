import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PropertyTeam, { parsePropertyTeam } from "./PropertyTeam";
describe("private property directory", () => {
  it("keeps only five descriptive fields without creating access grants", () => {
    const rows = parsePropertyTeam([
      {
        name: "Example User",
        position: "Director",
        assignedMarket: "India",
        section: "Sales",
        level: "B",
      },
    ]);
    expect(rows[0].assignedMarket).toBe("India");
    expect(rows[0]).not.toHaveProperty("role");
    expect(() =>
      parsePropertyTeam([{ name: "Test", password: "secret" }]),
    ).toThrow();
    expect(() =>
      parsePropertyTeam([{ name: "Test", role: "Super Admin" }]),
    ).toThrow();
  });
  it("renders compact table headers without personal data preloaded", () => {
    const html = renderToStaticMarkup(<PropertyTeam />);
    for (const title of [
      "Team name",
      "Position",
      "Assigned market",
      "Section",
      "Level",
    ])
      expect(html).toContain(title);
    expect(html).toContain("saved in this browser only");
    expect(html).toContain("Import property team details");
  });
});
