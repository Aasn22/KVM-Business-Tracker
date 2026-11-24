import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { historySetupSQL, missingHistorySchema } from "./server/historyStorage";
import { blankHistory } from "./history";
describe("admin History initializer SQL", () => {
  it("targets only missing History table/function errors", () => {
    expect(missingHistorySchema({ code: "PGRST202" })).toBe(true);
    expect(missingHistorySchema({ code: "42501" })).toBe(false);
    expect(missingHistorySchema(null)).toBe(false);
  });
  it("runs transactionally, is repeatable and preserves other years and stale-write protection", async () => {
    const db = new PGlite();
    try {
      await db.exec(
        "create role anon;create role authenticated;create role service_role;",
      );
      await db.exec("begin;" + historySetupSQL + "commit;");
      await db.query("select save_history_year($1,$2,$3::jsonb)", [
        2022,
        0,
        JSON.stringify(blankHistory(2022).months),
      ]);
      await db.exec("begin;" + historySetupSQL + "commit;");
      const r = await db.query<{ version: number }>(
        "select version from history_years where year=2022",
      );
      expect(r.rows[0].version).toBe(1);
      await expect(
        db.query("select save_history_year($1,$2,$3::jsonb)", [
          2022,
          0,
          JSON.stringify(blankHistory(2022).months),
        ]),
      ).rejects.toThrow("conflict");
    } finally {
      await db.close();
    }
  }, 30000);
});
