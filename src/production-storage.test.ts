import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
describe("arrival-range database import", () => {
  it("is atomic and repeatable, preserves other years and refuses unreviewed legacy destruction", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "create role anon;create role authenticated;create role service_role;",
      );
      const sql = readFileSync(
        "supabase/migrations/20261122_production_reservations.sql",
        "utf8",
      );
      await db.exec(sql);
      await db.exec(sql);
      const save = async (records: unknown[], from: string, to: string) =>
        db.query(
          "select public.import_production_reservations($1::jsonb,$2::date,$3::date)",
          [JSON.stringify(records), from, to],
        );
      await save(
        [{ arrival: "2025-01-01", status: "CHECKED OUT" }],
        "2025-01-01",
        "2025-01-01",
      );
      await save(
        [{ arrival: "2026-01-01", status: "NO SHOW" }],
        "2026-01-01",
        "2026-01-01",
      );
      await save(
        [{ arrival: "2026-01-01", status: "NO SHOW" }],
        "2026-01-01",
        "2026-01-01",
      );
      const result = await db.query<{
        data: { reservations: { arrival: string }[] };
      }>("select data from production_snapshots where id='current'");
      expect(result.rows[0].data.reservations).toHaveLength(2);
      expect(result.rows[0].data.reservations[0].arrival).toBe("2025-01-01");
      await expect(
        save([{ arrival: "2027-01-01" }], "2026-01-01", "2026-12-31"),
      ).rejects.toThrow("outside");
      await db.exec(
        "update production_snapshots set data='{\"schema\":1}'::jsonb",
      );
      await expect(
        save([{ arrival: "2026-01-01" }], "2026-01-01", "2026-01-01"),
      ).rejects.toThrow("Legacy");
    } finally {
      await db.close();
    }
  }, 30000);
});
