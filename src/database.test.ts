import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { blank } from "./model";
const db = new PGlite();
const manager = "11111111-1111-1111-1111-111111111111";
const admin = "22222222-2222-2222-2222-222222222222";
async function login(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function save(
  market = "asia",
  version = 0,
  data = blank("asia"),
  month = 1,
) {
  return db.query(
    "select public.save_market_month($1,2027,$2,$3::jsonb,$4) as version",
    [market, month, JSON.stringify(data), version],
  );
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${manager}'),('${admin}');`,
  );
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(
    `insert into public.market_members values('${manager}','asia');insert into public.app_admins values('${admin}');`,
  );
}, 30000);
afterAll(async () => {
  await db.close();
});
describe("database security and integrity", () => {
  it("allows assigned saves and atomically writes audit snapshots", async () => {
    await login(manager);
    await save();
    const result = await db.query<{ version: number }>(
      "select version from public.market_months",
    );
    expect(result.rows[0].version).toBe(1);
    const audit = await db.query<{ actor: string }>(
      "select actor from public.audit_log",
    );
    expect(audit.rows[0].actor).toBe(manager);
  });
  it("rejects stale versions", async () => {
    await login(manager);
    await expect(save()).rejects.toThrow("Another manager");
  });
  it("rejects cross-market RPC writes", async () => {
    await login(manager);
    await expect(save("russia")).rejects.toThrow("not assigned");
  });
  it("enforces read isolation for managers", async () => {
    await login(admin);
    await save("russia");
    await login(manager);
    const r = await db.query(
      "select * from public.market_months where market_id='russia'",
    );
    expect(r.rows).toHaveLength(0);
    const a = await db.query(
      "select * from public.audit_log where market_id='russia'",
    );
    expect(a.rows).toHaveLength(0);
  });
  it("forbids direct writes, audit tampering, and self-assignment", async () => {
    await login(manager);
    await expect(
      db.exec("update public.market_months set version=99"),
    ).rejects.toThrow("permission denied");
    await expect(db.exec("delete from public.audit_log")).rejects.toThrow(
      "permission denied",
    );
    await expect(
      db.exec(
        `insert into public.market_members values('${manager}','russia')`,
      ),
    ).rejects.toThrow("permission denied");
    await expect(
      db.exec(`insert into public.app_admins values('${manager}')`),
    ).rejects.toThrow("permission denied");
  });
  it("validates numbers and commercial row ordering at database boundary", async () => {
    await login(manager);
    const d = blank("asia");
    d.commercial[0].budget = -1;
    await expect(save("asia", 1, d)).rejects.toThrow("out of range");
    d.commercial[0].budget = 0;
    d.commercial.reverse();
    await expect(save("asia", 1, d)).rejects.toThrow("Commercial rows");
  });
  it("rolls back all twelve imported months if any version is stale", async () => {
    await login(manager);
    const entries = Array.from({ length: 12 }, (_, i) => ({
      market_id: "asia",
      year: 2027,
      month: i + 1,
      data: blank("asia"),
      version: i === 0 ? 1 : 0,
    }));
    entries[11].version = 5;
    await expect(
      db.query("select public.import_market_months($1::jsonb)", [
        JSON.stringify(entries),
      ]),
    ).rejects.toThrow("Another manager");
    const count = await db.query<{ n: number }>(
      "select count(*)::integer n from public.market_months",
    );
    expect(count.rows[0].n).toBe(1);
  });
  it("allows a valid twelve-month import and increments versions", async () => {
    await login(manager);
    const entries = Array.from({ length: 12 }, (_, i) => ({
      market_id: "asia",
      year: 2027,
      month: i + 1,
      data: blank("asia"),
      version: i === 0 ? 1 : 0,
    }));
    await db.query("select public.import_market_months($1::jsonb)", [
      JSON.stringify(entries),
    ]);
    const r = await db.query<{ n: number }>(
      "select count(*)::integer n from public.market_months",
    );
    expect(r.rows[0].n).toBe(12);
  });
  it("stores historical years independently from the existing budget year", async () => {
    await login(manager);
    for (const year of [2021, 2022, 2023, 2024, 2025]) {
      const data = blank("asia");
      data.commercial[1].budget = year;
      await db.query(
        "select public.save_market_month('asia',$1,1,$2::jsonb,0)",
        [year, JSON.stringify(data)],
      );
      const result = await db.query<{ year: number; budget: number }>(
        "select year, (data#>>'{commercial,1,budget}')::integer as budget from public.market_months where year=$1",
        [year],
      );
      expect(result.rows).toEqual([{ year, budget: year }]);
    }
    const current = await db.query<{ n: number }>(
      "select count(*)::integer n from public.market_months where year=2027",
    );
    expect(current.rows[0].n).toBe(12);
  });
  it("rejects all unauthenticated financial reads and RPC calls", async () => {
    await db.exec("reset role;set role anon;");
    await expect(db.exec("select * from public.market_months")).rejects.toThrow(
      "permission denied",
    );
    await expect(save()).rejects.toThrow("permission denied");
  });
});
