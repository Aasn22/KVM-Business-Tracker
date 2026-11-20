import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import DatePicker from "./DatePicker";
import { CancellationSummary } from "./OperationalReports";
describe("print layout and cancellation presentation", () => {
  it("shows requested metrics without inventing a country ranking", () => {
    const html = renderToStaticMarkup(
      <CancellationSummary
        kind="cancellations"
        rows={[
          {
            roomType: "BVR",
            arrival: "2026-12-16",
            nights: 43,
            amount: 8200,
            eventDate: "2026-11-19",
            rateCode: "RET",
          },
        ]}
      />,
    );
    for (const label of [
      "Cancelled Room Nights Total",
      "Room Revenue Loss",
      "Highest Cancellation Country",
      "Not available",
      "source Nts.",
      "$8,200",
      "43",
    ])
      expect(html).toContain(label);
  });
  it("provides a visible accessible calendar trigger as well as native date input", () => {
    const html = renderToStaticMarkup(
      <DatePicker label="From date" value="2026-11-19" onChange={() => {}} />,
    );
    expect(html).toContain('type="date"');
    expect(html).toContain('aria-label="Open calendar for From date"');
    expect(html).toContain('type="button"');
  });
  it("sets paginated A4 print constraints with repeat headers and no interactive controls", () => {
    const css = readFileSync("src/style.css", "utf8");
    expect(css).toContain("@page executive-report");
    expect(css).toMatch(/size:\s*A4 landscape/);
    expect(css).toContain("table-header-group");
    expect(css).toContain("page-break-inside: avoid");
  });
});
