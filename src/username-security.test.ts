import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const db = new PGlite();
const id = "11111111-1111-1111-1111-111111111111";
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;create table public.team_directory(username text,user_id uuid);insert into auth.users values('${id}','owner@example.test','fixture-initial-hash');insert into public.team_directory values('OWNER','${id}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/20261119_username_login.sql", "utf8"),
  );
}, 30000);
afterAll(() => db.close());
describe("private username login", () => {
  it("normalizes usernames and limits persistent attempts", async () => {
    await db.exec("set role service_role");
    for (let i = 0; i < 10; i++)
      expect(
        (
          await db.query<{ v: string }>(
            "select public.resolve_login_username($1) v",
            [" owner "],
          )
        ).rows[0].v,
      ).toBe("owner@example.test");
    expect(
      (
        await db.query<{ v: null }>(
          "select public.resolve_login_username($1) v",
          ["OWNER"],
        )
      ).rows[0].v,
    ).toBeNull();
  });
  it("prevents public and authenticated email enumeration", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`reset role;set role ${role}`);
      await expect(
        db.exec("select public.resolve_login_username('OWNER')"),
      ).rejects.toThrow("permission denied");
      await expect(
        db.exec("select * from public.username_login_attempts"),
      ).rejects.toThrow("permission denied");
    }
  });
  it("requires an actual provider password change before clearing the first-login flag", async () => {
    await db.exec(
      `reset role;insert into public.required_password_changes values('${id}','fixture-initial-hash');set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
    );
    expect(
      (
        await db.query<{ v: boolean }>(
          "select public.password_setup_required() v",
        )
      ).rows[0].v,
    ).toBe(true);
    await expect(
      db.exec("select public.complete_password_change()"),
    ).rejects.toThrow("changed first");
    await db.exec(
      `reset role;update auth.users set encrypted_password='fixture-updated-provider-hash';set role authenticated;`,
    );
    await db.exec("select public.complete_password_change()");
    expect(
      (
        await db.query<{ v: boolean }>(
          "select public.password_setup_required() v",
        )
      ).rows[0].v,
    ).toBe(false);
  });
  it("rejects ambiguous username mappings", async () => {
    await db.exec("reset role");
    await expect(
      db.exec(`insert into public.team_directory values('owner','${id}')`),
    ).rejects.toThrow("duplicate");
  });
});
