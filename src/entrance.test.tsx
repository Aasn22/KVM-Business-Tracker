import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import Entrance, { entranceDuration } from "./Entrance";
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
    expect(html).toContain(
      "DATA ON THIS PLATFORM IS PRIVATE AND CONFIDENTIAL - DO NOT SHARE",
    );
    expect(html).not.toContain("Enter workspace");
    expect(html).toContain("BUSINESS EYE");
  });
  it("uses a short finite welcome duration", () => {
    expect(entranceDuration).toBe(3600);
  });
});
