import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { blank } from "./model";
const manager = "11111111-1111-1111-1111-111111111111";
const admin = "22222222-2222-2222-2222-222222222222";
const schema = readFileSync("supabase/schema.sql", "utf8");
const db = new PGlite();
async function setup(connection: PGlite, sql = schema) {
  await connection.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${manager}'),('${admin}');`,
  );
  await connection.exec(sql);
  await connection.exec(
    `insert into public.market_members values('${manager}','asia');insert into public.app_admins values('${admin}');`,
  );
}
async function login(id: string, connection = db) {
  await connection.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
function save(
  market = "asia",
  version = 0,
  data = blank(market),
  month = 1,
  year = 2027,
  connection = db,
) {
  return connection.query(
    "select public.save_market_month($1,$2,$3,$4::jsonb,$5) as version",
    [market, year, month, JSON.stringify(data), version],
  );
}
function imports(year = 2027, market = "asia") {
  return Array.from({ length: 12 }, (_, i) => ({
    market_id: market,
    year,
    month: i + 1,
    data: blank(market),
    version: 0,
  }));
}
beforeAll(() => setup(db), 30000);
afterAll(() => db.close());
describe("admin-only data input and read permissions", () => {
  it("verifies role from protected administrator membership, not market assignment", async () => {
    await login(manager);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.is_app_admin() allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await login(admin);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.is_app_admin() allowed",
        )
      ).rows[0].allowed,
    ).toBe(true);
  });
  it("permits admin saves with immutable actor audit snapshots", async () => {
    await login(admin);
    await save();
    expect(
      (
        await db.query<{ version: number }>(
          "select version from public.market_months",
        )
      ).rows[0].version,
    ).toBe(1);
    expect(
      (await db.query<{ actor: string }>("select actor from public.audit_log"))
        .rows[0].actor,
    ).toBe(admin);
  });
  it("allows assigned managers to read but rejects their direct RPC saves", async () => {
    await login(manager);
    expect(
      (
        await db.query(
          "select * from public.market_months where market_id='asia'",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(save("asia", 1)).rejects.toThrow(
      "Administrator access required",
    );
    await expect(save("russia")).rejects.toThrow(
      "Administrator access required",
    );
  });
  it("rejects manager imports before validation, even for assigned markets", async () => {
    await login(manager);
    await expect(
      db.query("select public.import_market_months($1::jsonb)", [
        JSON.stringify(imports(2025)),
      ]),
    ).rejects.toThrow("Administrator access required");
    await expect(
      db.query("select public.import_market_months('[]'::jsonb)"),
    ).rejects.toThrow("Administrator access required");
  });
  it("preserves manager cross-market read isolation", async () => {
    await login(admin);
    await save("russia");
    await login(manager);
    expect(
      (
        await db.query(
          "select * from public.market_months where market_id='russia'",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from public.audit_log where market_id='russia'",
        )
      ).rows,
    ).toHaveLength(0);
  });
  it("forbids self-promotion, assignment, direct table writes and audit tampering", async () => {
    await login(manager);
    for (const sql of [
      "update public.market_months set version=99",
      "delete from public.audit_log",
      `insert into public.app_admins values('${manager}')`,
      `insert into public.market_members values('${manager}','russia')`,
    ])
      await expect(db.exec(sql)).rejects.toThrow("permission denied");
  });
  it("validates admin input and refuses stale versions", async () => {
    await login(admin);
    await expect(save("asia", 0)).rejects.toThrow("Another manager");
    const data = blank("asia");
    data.commercial[0].budget = -1;
    await expect(save("asia", 1, data)).rejects.toThrow("out of range");
    data.commercial[0].budget = 0;
    data.commercial.reverse();
    await expect(save("asia", 1, data)).rejects.toThrow("Commercial rows");
  });
  it("atomically rolls back an admin import with a stale month", async () => {
    await login(admin);
    const entries = imports(2025);
    entries[11].version = 9;
    await expect(
      db.query("select public.import_market_months($1::jsonb)", [
        JSON.stringify(entries),
      ]),
    ).rejects.toThrow("Another manager");
    expect(
      (await db.query("select * from public.market_months where year=2025"))
        .rows,
    ).toHaveLength(0);
  });
  it("allows admin imports and keeps historical years separate", async () => {
    await login(admin);
    for (const year of [2021, 2022, 2023, 2024, 2025]) {
      await db.query("select public.import_market_months($1::jsonb)", [
        JSON.stringify(imports(year)),
      ]);
      expect(
        (
          await db.query("select * from public.market_months where year=$1", [
            year,
          ])
        ).rows,
      ).toHaveLength(12);
    }
    expect(
      (
        await db.query(
          "select * from public.market_months where market_id='asia' and year=2027",
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("keeps Europe reads assigned while only admins can enter its figures", async () => {
    await login(admin);
    await save("europe");
    await login(manager);
    expect(
      (
        await db.query(
          "select * from public.market_months where market_id='europe'",
        )
      ).rows,
    ).toHaveLength(0);
    await db.exec(
      `reset role;insert into public.market_members values('${manager}','europe');`,
    );
    await login(manager);
    expect(
      (
        await db.query(
          "select * from public.market_months where market_id='europe'",
        )
      ).rows,
    ).toHaveLength(1);
    await expect(save("europe", 1)).rejects.toThrow(
      "Administrator access required",
    );
  });
  it("revokes existing admin session writes when role is removed", async () => {
    await db.exec(
      `reset role;delete from public.app_admins where user_id='${admin}';`,
    );
    await login(admin);
    await expect(save("asia", 1)).rejects.toThrow(
      "Administrator access required",
    );
    await db.exec(
      `reset role;insert into public.app_admins values('${admin}');`,
    );
  });
  it("rejects anonymous financial reads, role lookup and writes", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.exec("select * from public.market_months")).rejects.toThrow(
      "permission denied",
    );
    await expect(db.exec("select public.is_app_admin()")).rejects.toThrow(
      "permission denied",
    );
    await expect(save()).rejects.toThrow("permission denied");
  });
});
describe("existing database migrations", () => {
  it("upgrades manager-writable installs while preserving data, reads, audits and admin imports", async () => {
    const old = new PGlite();
    try {
      // Reproduce the previous RPC authorization rules against an otherwise identical database.
      const legacy = schema
        .replace(
          "if not public.is_app_admin() then raise exception 'Administrator access required for data input' using errcode='42501'; end if;",
          "if not public.can_access_market(p_market) then raise exception 'not assigned' using errcode='42501'; end if;",
        )
        .replace(
          " if not public.is_app_admin() then raise exception 'Administrator access required for imports' using errcode='42501'; end if;\n",
          "",
        );
      await setup(old, legacy);
      await login(manager, old);
      await save("asia", 0, blank("asia"), 1, 2027, old);
      const before = await old.query("select * from public.market_months");
      await old.exec("reset role");
      const migration = readFileSync(
        "supabase/migrations/20261119_admin_only_data_input.sql",
        "utf8",
      );
      await old.exec(migration);
      await old.exec(migration);
      expect(
        (await old.query("select * from public.market_months")).rows,
      ).toEqual(before.rows);
      await login(manager, old);
      expect(
        (await old.query("select * from public.market_months")).rows,
      ).toHaveLength(1);
      await expect(
        save("asia", 1, blank("asia"), 1, 2027, old),
      ).rejects.toThrow("Administrator access required");
      await expect(
        old.query("select public.import_market_months($1::jsonb)", [
          JSON.stringify(imports(2026)),
        ]),
      ).rejects.toThrow("Administrator access required");
      await login(admin, old);
      await save("asia", 1, blank("asia"), 1, 2027, old);
      await old.query("select public.import_market_months($1::jsonb)", [
        JSON.stringify(imports(2026)),
      ]);
      expect(
        (await old.query("select * from public.audit_log")).rows,
      ).toHaveLength(14);
    } finally {
      await old.close();
    }
  }, 30000);
  it("retains the non-destructive Europe migration", async () => {
    await db.exec("reset role");
    const before = await db.query(
      "select * from public.market_months order by market_id,year,month",
    );
    const migration = readFileSync(
      "supabase/migrations/20261119_add_europe.sql",
      "utf8",
    );
    await db.exec(migration);
    await db.exec(migration);
    expect(
      (
        await db.query(
          "select * from public.market_months order by market_id,year,month",
        )
      ).rows,
    ).toEqual(before.rows);
  });
});
