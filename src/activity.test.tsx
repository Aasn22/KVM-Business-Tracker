import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  activityKey,
  appendActivity,
  cleanActor,
  readActivity,
} from "./activity";
import { ActivityPanels } from "./ActivityLog";
import App from "./App";
function storage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, val: string) => {
      values.set(key, val);
    },
  };
}
afterEach(() => vi.unstubAllGlobals());
describe("self-reported browser activity", () => {
  it("requires a bounded display name, never treating it as verified identity", () => {
    expect(cleanActor("  Ahmed   A  ")).toBe("Ahmed A");
    expect(() => cleanActor("  ")).toThrow("Enter your name");
    expect(() => cleanActor("a".repeat(81))).toThrow();
    expect(() => cleanActor("ab\u0000cd")).toThrow();
  });
  it("retains timestamp, name, kind and summary only with newest first and bounded history", () => {
    const s = storage();
    for (let i = 0; i < 201; i++)
      appendActivity(
        {
          kind: "change",
          actor: "Test Admin",
          summary: `Property settings updated ${i}`,
        },
        s,
        "2026-11-20T14:00:00Z",
      );
    const rows = readActivity(s);
    expect(rows).toHaveLength(200);
    expect(rows[0].summary).toContain("200");
    expect(Object.keys(rows[0]).sort()).toEqual([
      "actor",
      "at",
      "id",
      "kind",
      "summary",
    ]);
    expect(rows[0].at).toBe("2026-11-20T14:00:00Z");
  });
  it("ignores corrupt records and surfaces write failures rather than claiming retention", () => {
    const s = storage();
    s.setItem(activityKey, "invalid");
    expect(readActivity(s)).toEqual([]);
    s.setItem(
      activityKey,
      JSON.stringify([
        { kind: "visit", actor: "X", at: "bad", id: "a", summary: "test" },
      ]),
    );
    expect(readActivity(s)).toEqual([]);
    expect(() =>
      appendActivity(
        { kind: "visit", actor: "Visitor", summary: "Platform opened" },
        {
          getItem: () => null,
          setItem: () => {
            throw Error("quota");
          },
        },
      ),
    ).toThrow("quota");
  });
  it("keeps change details out of the middle box and only shows metadata in latest changes", () => {
    const s = storage();
    appendActivity(
      { kind: "visit", actor: "Anonymous visitor", summary: "Platform opened" },
      s,
    );
    appendActivity(
      {
        kind: "change",
        actor: "Test Admin",
        summary: "Property Setup settings updated",
      },
      s,
    );
    const html = renderToStaticMarkup(
      <ActivityPanels rows={readActivity(s)} />,
    );
    expect(html.match(/class="panel activity-panel"/g)).toHaveLength(3);
    const middle = html.slice(
      html.indexOf("Updates by user"),
      html.indexOf("Latest changes"),
    );
    expect(middle).toContain("Test Admin");
    expect(middle).not.toContain("Property Setup settings updated");
    expect(html).toContain("self-reported");
    expect(html).toContain("Property Setup settings updated");
    expect(html).toContain("UTC");
  });
  it("does not show a year filter or public activity rows", () => {
    vi.stubGlobal("window", { location: { pathname: "/activity-log" } });
    const html = renderToStaticMarkup(<App localPin />);
    expect(html).not.toContain("Budget year");
    expect(html).toContain("Browser-local activity only");
    expect(html).toContain("Platform access");
    const publicHtml = renderToStaticMarkup(<App publicDemo />);
    expect(publicHtml).toContain('href="/activity-log"');
    expect(publicHtml).not.toContain("Browser-local activity only");
  });
});
