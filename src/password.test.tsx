import {
  describe,
  it,
  expect,
  vi,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { passwordError, isPasswordRoute, passwordMode } from "./password";
import PasswordPage from "./PasswordPage";
describe("password policy and setup forms", () => {
  it("permits letters, numbers, symbols or mixtures with six Unicode characters", () => {
    for (const v of ["abcdef", "123456", "!@#$%^", "abc123", "éééééé"])
      expect(passwordError(v, v)).toBe("");
    expect(passwordError("12345", "12345")).toContain("6 characters");
    expect(passwordError("😀😀😀", "😀😀😀")).toContain("6 characters");
    expect(passwordError("abcdef", "abcdeg")).toContain("match");
  });
  it("does not bypass current-password checks by manually opening setup/reset routes", () => {
    expect(passwordMode("/setup-password", false, true, false)).toBe("change");
    expect(passwordMode("/reset-password", false, true, false)).toBe("change");
    expect(passwordMode("/reset-password", false, true, true)).toBe("reset");
    expect(passwordMode("/", true, true, false)).toBe("setup");
  });
  it("recognizes dedicated first-login, reset, change and recovery pages", () => {
    for (const path of [
      "/setup-password",
      "/reset-password",
      "/change-password",
      "/forgot-password",
    ])
      expect(isPasswordRoute(path)).toBe(true);
    expect(isPasswordRoute("/property-setup")).toBe(false);
  });
  it("never claims to send or update passwords in an unconfigured demo", () => {
    const html = renderToStaticMarkup(
      <PasswordPage mode="forgot" hasSession={false} onComplete={() => {}} />,
    );
    expect(html).toContain("Authentication is not connected");
    expect(html).toContain("Send reset link");
    expect(html).toContain("disabled");
  });
  it("asks for current password on voluntary change and new password on invitation", () => {
    const change = renderToStaticMarkup(
      <PasswordPage mode="change" hasSession onComplete={() => {}} />,
    );
    expect(change).toContain("Current password");
    const setup = renderToStaticMarkup(
      <PasswordPage mode="setup" hasSession onComplete={() => {}} />,
    );
    expect(setup).toContain("Confirm new password");
    expect(setup).not.toContain('aria-label="Current password"');
  });
});
const db = new PGlite();
const id = "11111111-1111-1111-1111-111111111111";
beforeAll(async () => {
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,encrypted_password text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${id}','');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/20261119_password_setup.sql", "utf8"),
  );
}, 30000);
afterAll(() => db.close());
describe("provider-backed first-login status", () => {
  it("requires setup until the Auth provider has a stored password", async () => {
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
    );
    expect(
      (
        await db.query<{ v: boolean }>(
          "select public.password_setup_required() v",
        )
      ).rows[0].v,
    ).toBe(true);
    await db.exec(
      `reset role;update auth.users set encrypted_password='test-fixture-provider-hash';set role authenticated;`,
    );
    expect(
      (
        await db.query<{ v: boolean }>(
          "select public.password_setup_required() v",
        )
      ).rows[0].v,
    ).toBe(false);
  });
  it("returns only state, denies anonymous invocation and never permits reading hashes", async () => {
    await expect(
      db.exec("select encrypted_password from auth.users"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role anon;");
    await expect(
      db.exec("select public.password_setup_required()"),
    ).rejects.toThrow("permission denied");
  });
});
