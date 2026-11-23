import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { defaultProperty } from "./property";
const db = new PGlite();
const superId = "33333333-3333-3333-3333-333333333333";
const admin = "22222222-2222-2222-2222-222222222222";
const viewer = "11111111-1111-1111-1111-111111111111";
const migration = readFileSync(
  "supabase/migrations/20261119_property_setup.sql",
  "utf8",
);
async function login(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
function save(version = 0, data = defaultProperty) {
  return db.query(
    "select public.save_property_settings($1::jsonb,$2) version",
    [JSON.stringify(data), version],
  );
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${superId}'),('${admin}'),('${viewer}');`,
  );
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(
    `insert into public.app_admins values('${admin}');insert into public.app_super_admins values('${superId}');`,
  );
}, 30000);
afterAll(() => db.close());
describe("Super Admin property authorization", () => {
  it("does not promote regular admins or grant budget admin by implication", async () => {
    await login(admin);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.is_super_admin() allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
    await expect(save()).rejects.toThrow("Super Admin");
    await login(superId);
    expect(
      (
        await db.query<{ allowed: boolean }>(
          "select public.is_app_admin() allowed",
        )
      ).rows[0].allowed,
    ).toBe(false);
  });
  it("allows Super Admin save and writes an audit snapshot", async () => {
    await login(superId);
    expect((await save()).rows[0]).toEqual({ version: 1 });
    await db.exec("reset role");
    expect(
      (
        await db.query<{ actor: string }>(
          "select actor from public.property_audit_log",
        )
      ).rows[0].actor,
    ).toBe(superId);
  });
  it("lets every signed-in user view, including unassigned users, but denies edits", async () => {
    for (const id of [viewer, admin]) {
      await login(id);
      expect(
        (await db.query("select * from public.property_settings")).rows,
      ).toHaveLength(1);
      await expect(save(1)).rejects.toThrow("Super Admin");
    }
  });
  it("denies anonymous reads, direct writes, role escalation and audit changes", async () => {
    await login(admin);
    for (const sql of [
      "update public.property_settings set version=99",
      `insert into public.app_super_admins values('${admin}')`,
      "delete from public.property_audit_log",
    ])
      await expect(db.exec(sql)).rejects.toThrow("permission denied");
    await db.exec("reset role;set role anon");
    await expect(
      db.exec("select * from public.property_settings"),
    ).rejects.toThrow("permission denied");
    await expect(save(1)).rejects.toThrow("permission denied");
  });
  it("checks optimistic versions and content at the database boundary", async () => {
    await login(superId);
    await expect(save()).rejects.toThrow("changed");
    await expect(
      save(1, { ...defaultProperty, logo: "javascript:alert(1)" }),
    ).rejects.toThrow("logo");
    await expect(
      save(1, {
        ...defaultProperty,
        villaCategories: [{ name: "Villa", units: -1 }],
      }),
    ).rejects.toThrow("inventory");
    await expect(
      save(1, { ...defaultProperty, mealPlans: ["BB", "bb"] }),
    ).rejects.toThrow("Duplicate");
  });
  it("denies a revoked Super Admin even from an existing session", async () => {
    await db.exec(
      `reset role;delete from public.app_super_admins where user_id='${superId}';`,
    );
    await login(superId);
    await expect(save(1)).rejects.toThrow("Super Admin");
    await db.exec(
      `reset role;insert into public.app_super_admins values('${superId}');`,
    );
  });
  it("reruns migration without changing existing property data or granting extra roles", async () => {
    await db.exec("reset role");
    const before = (await db.query("select * from public.property_settings"))
      .rows;
    await db.exec(migration);
    await db.exec(migration);
    expect(
      (await db.query("select * from public.property_settings")).rows,
    ).toEqual(before);
    await login(admin);
    await expect(save(1)).rejects.toThrow("Super Admin");
    await login(superId);
    await save(1, { ...defaultProperty, name: "Updated property" });
  });
});
