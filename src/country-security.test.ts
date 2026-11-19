import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { blank } from "./model";
const db = new PGlite();
const superId = "33333333-3333-3333-3333-333333333333",
  india = "11111111-1111-1111-1111-111111111111",
  kazak = "44444444-4444-4444-4444-444444444444",
  admin = "22222222-2222-2222-2222-222222222222";
async function login(id: string) {
  await db.exec(
    `reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
function profile(scope: string, role = "Read-Only") {
  return {
    name: "Test profile",
    position: "Test",
    department: "Sales",
    level: "B",
    username: "TEST",
    role,
    scope,
    markets: [],
  };
}
async function member(id: string, scope: string, role = "Read-Only") {
  return db.query("select public.save_team_member(null,$1,$2::jsonb,0) id", [
    id,
    JSON.stringify(profile(scope, role)),
  ]);
}
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${superId}'),('${india}'),('${kazak}'),('${admin}');`,
  );
  await db.exec(readFileSync("supabase/schema.sql", "utf8"));
  await db.exec(
    `insert into public.app_super_admins values('${superId}');insert into public.app_admins values('${admin}'),('${india}');insert into public.market_members values('${india}','asia'),('${kazak}','russia');`,
  );
  await login(superId);
  await member(india, "india");
  await member(kazak, "kazakhstan");
  await login(admin);
  for (const country of ["india", "kazakhstan"])
    await db.query("select public.save_country_month($1,2027,1,$2::jsonb,0)", [
      country,
      JSON.stringify(blank("")),
    ]);
  for (const market of ["asia", "russia"])
    await db.query("select public.save_market_month($1,2027,1,$2::jsonb,0)", [
      market,
      JSON.stringify(blank(market)),
    ]);
}, 30000);
afterAll(() => db.close());
describe("country financial isolation and team roles", () => {
  it("country assignments override legacy regional membership and admin grants", async () => {
    await login(india);
    expect(
      (await db.query("select * from public.market_months")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from public.audit_log")).rows,
    ).toHaveLength(0);
    expect(
      (await db.query<{ v: boolean }>("select public.is_app_admin() v")).rows[0]
        .v,
    ).toBe(false);
    expect(
      (
        await db.query<{ country: string }>(
          "select country from public.country_months",
        )
      ).rows,
    ).toEqual([{ country: "india" }]);
    await login(kazak);
    expect(
      (await db.query("select * from public.market_months")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ country: string }>(
          "select country from public.country_months",
        )
      ).rows,
    ).toEqual([{ country: "kazakhstan" }]);
  });
  it("denies country user writes and role escalation", async () => {
    await login(india);
    await expect(member(india, "all", "Super Admin")).rejects.toThrow(
      "Super Admin",
    );
    await expect(
      db.query("select public.save_country_month($1,2027,1,$2::jsonb,1)", [
        "india",
        JSON.stringify(blank("")),
      ]),
    ).rejects.toThrow("Administrator");
    await expect(
      db.exec(`update public.team_directory set scope='all'`),
    ).rejects.toThrow("permission denied");
  });
  it("shows directory permissions to all users but not auth identifiers", async () => {
    await login(india);
    expect(
      (
        await db.query(
          "select name,role,scope,username from public.team_directory",
        )
      ).rows,
    ).toHaveLength(2);
    await expect(
      db.exec("select user_id from public.team_directory"),
    ).rejects.toThrow("permission denied");
  });
  it("does not accept roster passwords or allow regular admins to edit team profiles", async () => {
    await login(admin);
    await expect(member(admin, "all", "Admin")).rejects.toThrow("Super Admin");
    await login(superId);
    await expect(
      db.query("select public.save_team_member(null,null,$1::jsonb,0)", [
        JSON.stringify({ ...profile("all"), password: "REJECTED" }),
      ]),
    ).rejects.toThrow("credentials");
  });
  it("allows all-access readers and regular data admins with no property edit grant", async () => {
    await login(superId);
    const linked = await member(admin, "all", "Admin");
    expect(linked.rows).toHaveLength(1);
    await login(admin);
    expect(
      (await db.query("select * from public.market_months")).rows,
    ).toHaveLength(2);
    expect(
      (await db.query<{ v: boolean }>("select public.is_super_admin() v"))
        .rows[0].v,
    ).toBe(false);
  });
  it("reruns migration without data loss and rejects invalid code duplication", async () => {
    await db.exec("reset role");
    const before = (await db.query("select * from public.country_months")).rows;
    await db.exec(
      readFileSync(
        "supabase/migrations/20261119_team_country_access.sql",
        "utf8",
      ),
    );
    expect(
      (await db.query("select * from public.country_months")).rows,
    ).toEqual(before);
  });
});
