import { afterEach, describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  formatMoney,
  formatCompact,
  formatNumber,
  formatInsightMoney,
} from "./format";
import App, { Numeric } from "./App";
import BusinessInsight from "./BusinessInsight";
import { makeDemo } from "./model";
import TotalReview from "./TotalReview";
afterEach(() => vi.unstubAllGlobals());
describe("consistent currency and compact numbers", () => {
  it("formats full dollars with grouping and negative accounting parentheses", () => {
    expect(formatMoney(1234567)).toBe("$1,234,567");
    expect(formatMoney(-1234567)).toBe("($1,234,567)");
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(1234.56)).toBe("$1,235");
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(NaN)).toBe("—");
  });
  it("uses uppercase K/M for abbreviated counts, not currency", () => {
    expect(formatCompact(1900838)).toBe("1.9M");
    expect(formatCompact(1200)).toBe("1.2K");
    expect(formatCompact(690000000)).toBe("690M");
    expect(formatNumber(1234)).toBe("1,234");
    expect(formatNumber(150.25)).toBe("150");
    expect(formatMoney(1013.78)).toBe("$1,014");
  });
  it("uses dollar amounts in market and management views while keeping counts distinct", () => {
    vi.stubGlobal("window", { location: { pathname: "/" } });
    const html = renderToStaticMarkup(<App publicDemo />);
    expect(html).not.toContain("US$");
    expect(html).not.toContain("All revenue values in USD");
    const money = renderToStaticMarkup(
      <Numeric
        editable={false}
        label="Room Revenue budget"
        value={1234567}
        onChange={() => {}}
      />,
    );
    const count = renderToStaticMarkup(
      <Numeric
        editable={false}
        label="Room Nights budget"
        value={1234}
        onChange={() => {}}
      />,
    );
    expect(money).toContain("$1,234,567");
    expect(count).not.toContain("$");
    const review = renderToStaticMarkup(
      <TotalReview
        entries={makeDemo(2027)}
        year={2027}
        loading={false}
        demo={false}
      />,
    );
    expect(review).toContain("$");
    expect(review).not.toContain("US$");
  });
  it("shows compact dollar receipts and uppercase arrival counts without changing source units", () => {
    const html = renderToStaticMarkup(<BusinessInsight />);
    expect(html).toContain("$400M");
    expect(html).toContain("1.9M");
    expect(html).toContain("690M");
    expect(html).not.toContain("US$");
    expect(html).not.toContain("690m");
    expect(html).toContain("$844M");
  });
  it("isolates compact currency to Business Insight without changing full-dollar formatting", () => {
    expect(formatInsightMoney(400100000)).toBe("$400M");
    expect(formatInsightMoney(1500)).toBe("$2K");
    expect(formatInsightMoney(-400100000)).toBe("($400M)");
    expect(formatInsightMoney(null)).toBe("—");
    expect(formatMoney(400100000)).toBe("$400,100,000");
  });
});
