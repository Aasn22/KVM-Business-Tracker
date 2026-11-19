import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { defaultProperty, validProperty, inventoryTotal } from "./property";
import PropertySetup from "./PropertySetup";
describe("property profile", () => {
  it("has safe defaults without inventing address or inventory", () => {
    expect(validProperty(defaultProperty)).toBe(true);
    expect(defaultProperty.address).toBe("");
    expect(inventoryTotal(defaultProperty)).toBe(0);
  });
  it("sums inventory and rejects duplicate/invalid category values", () => {
    const d = structuredClone(defaultProperty);
    d.villaCategories[0].units = 4;
    d.villaCategories[1].units = 6;
    expect(inventoryTotal(d)).toBe(10);
    d.villaCategories[0].units = -1;
    expect(validProperty(d)).toBe(false);
    d.villaCategories[0].units = 1.5;
    expect(validProperty(d)).toBe(false);
    d.villaCategories[0].units = 4;
    d.mealPlans.push(d.mealPlans[0].toLowerCase());
    expect(validProperty(d)).toBe(false);
  });
  it("rejects remote/script/SVG logos and invalid currency", () => {
    for (const logo of [
      "javascript:alert(1)",
      "https://tracker.example/logo.png",
      "data:image/svg+xml;base64,AAA",
    ])
      expect(validProperty({ ...defaultProperty, logo })).toBe(false);
    expect(validProperty({ ...defaultProperty, currency: "usd" })).toBe(false);
    expect(
      validProperty({ ...defaultProperty, logo: "data:image/png;base64,AAAA" }),
    ).toBe(true);
  });
  it("requires sign-in for live property viewing and exposes no anonymous editor", () => {
    const html = renderToStaticMarkup(
      <PropertySetup
        demo={false}
        userId={null}
        onDirtyChange={() => {}}
        onBusyChange={() => {}}
      />,
    );
    expect(html).toContain("Sign in to view property settings");
    expect(html).not.toContain("Save property");
    expect(html).not.toContain("<input");
  });
});
