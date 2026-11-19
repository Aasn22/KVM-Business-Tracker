import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Entrance, { ConfidentialityNotice, entranceDuration } from "./Entrance";
describe("branded entrance", () => {
  it("renders transparent logo on entrance and makes underlying content inert", () => {
    const html = renderToStaticMarkup(
      <Entrance>
        <button>Private workspace</button>
      </Entrance>,
    );
    expect(html).toContain("/kuda-villingili-logo.png");
    expect(html).toContain('alt="Kuda Villingili"');
    expect(html).toContain('inert=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("DO NOT SHARE");
    expect(html).not.toContain("Continue to platform");
    expect(html).toContain("<p>KVM BUSINESS LENSE</p>");
  });
  it("shows a separate professional notice with a continue action", () => {
    const html = renderToStaticMarkup(
      <ConfidentialityNotice onContinue={() => {}} />,
    );
    expect(html).toContain("Private &amp; Confidential");
    expect(html).toContain("authorized business use only");
    expect(html).toContain("Continue to platform");
    expect(html).not.toContain("entrance-logo");
  });
  it("uses a short finite welcome duration", () => {
    expect(entranceDuration).toBe(2400);
  });
});
