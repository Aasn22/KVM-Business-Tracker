import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { validData, summarize } from "./model";
import { loadPublicBudgets } from "./publicBudgets";
const baseline = JSON.parse(
  readFileSync("public/data/budgets-2027.json", "utf8"),
);
afterEach(() => vi.unstubAllGlobals());
describe("published actual budgets", () => {
  it("contains exactly the five real market years, no notes or credentials", () => {
    expect(baseline.entries).toHaveLength(60);
    expect(new Set(baseline.entries.map((e: any) => e.market_id)).size).toBe(5);
    expect(
      baseline.entries.every(
        (e: any) => e.year === 2027 && e.data.notes === "" && validData(e.data),
      ),
    ).toBe(true);
    expect(summarize(baseline.entries).nights).toBe(22042);
    expect(summarize(baseline.entries).budget).toBeCloseTo(24553920.435789473);
    const text = JSON.stringify(baseline);
    for (const key of [
      "password",
      "username",
      "responsible",
      "email",
      "manager",
    ])
      expect(text.toLowerCase()).not.toContain(key);
  });
  it("shows workbook provenance on database failure, never fictional fallback", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => baseline })
        .mockResolvedValueOnce({ ok: false }),
    );
    const result = await loadPublicBudgets(2027);
    expect(result.entries).toHaveLength(60);
    expect(result.notice).toContain("not a live feed");
    expect(result.lastUpdatedAt).toBeNull();
    expect(result.databaseAvailable).toBe(false);
  });
  it("overlays saved months on actual workbook months and strips notes", async () => {
    const entry = structuredClone(baseline.entries[0]);
    entry.data.commercial[1].bob += 1;
    entry.data.notes = "Private staff note";
    entry.version = 1;
    entry.updated_at = "2026-11-20T07:00:00Z";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => baseline })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ entries: [entry] }),
        }),
    );
    const result = await loadPublicBudgets(2027);
    expect(result.entries).toHaveLength(60);
    expect(result.entries[0].data.notes).toBe("");
    expect(result.notice).toContain("1 saved database months");
    expect(result.lastUpdatedAt).toBe("2026-11-20T07:00:00.000Z");
    expect(result.databaseAvailable).toBe(true);
  });
  it("does not invent historical data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await loadPublicBudgets(2021);
    expect(result.entries).toEqual([]);
    expect(result.notice).toContain("no workbook figures");
  });
});
