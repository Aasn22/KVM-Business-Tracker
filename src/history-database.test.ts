import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { blankHistory } from "./history";
describe("history database year isolation and optimistic locking", () => {
  it("is rerunnable, preserves other years and rejects stale edits", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "create role anon;create role authenticated;create role service_role;",
      );
      const sql = readFileSync(
        "supabase/migrations/20261124_history_update.sql",
        "utf8",
      );
      await db.exec(sql);
      await db.exec(sql);
      const save = (year: number, v: number) =>
        db.query("select public.save_history_year($1,$2,$3::jsonb)", [
          year,
          v,
          JSON.stringify(blankHistory(year).months),
        ]);
      await save(2024, 0);
      await save(2025, 0);
      await save(2024, 1);
      await expect(save(2024, 1)).rejects.toThrow("conflict");
      const r = await db.query<{ year: number; version: number }>(
        "select year,version from history_years order by year",
      );
      expect(r.rows).toEqual([
        { year: 2024, version: 2 },
        { year: 2025, version: 1 },
      ]);
    } finally {
      await db.close();
    }
  }, 30000);
});
