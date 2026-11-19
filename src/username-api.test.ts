import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import handler from "../api/username-login";
function res() {
  let body = "";
  const r = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (s: string) => {
      body = s;
    },
  };
  return {
    r: r as unknown as ServerResponse,
    get json() {
      return JSON.parse(body);
    },
  };
}
beforeEach(() => {
  factory.mockReset();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "fixture-public");
  vi.stubEnv("SUPABASE_SECRET_KEY", "fixture-server");
});
afterEach(() => vi.unstubAllEnvs());
describe("username endpoint", () => {
  it("returns session tokens but never an email lookup result", async () => {
    const sign = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "fixture-access",
          refresh_token: "fixture-refresh",
        },
      },
      error: null,
    });
    factory
      .mockReturnValueOnce({
        rpc: async () => ({ data: "test@example.test", error: null }),
      })
      .mockReturnValueOnce({ auth: { signInWithPassword: sign } });
    const r = res();
    await handler(
      {
        method: "POST",
        body: { username: "TEST", password: "fixture-private" },
      } as IncomingMessage & { body: unknown },
      r.r,
    );
    expect(r.r.statusCode).toBe(200);
    expect(r.json).toEqual({
      access_token: "fixture-access",
      refresh_token: "fixture-refresh",
    });
    expect(JSON.stringify(r.json)).not.toContain("@");
  });
  it("uses the same error for unknown and invalid credentials", async () => {
    for (const email of [null, "test@example.test"]) {
      factory
        .mockReturnValueOnce({
          rpc: async () => ({ data: email, error: null }),
        })
        .mockReturnValueOnce({
          auth: {
            signInWithPassword: async () => ({
              data: { session: null },
              error: { message: "invalid" },
            }),
          },
        });
      const r = res();
      await handler(
        {
          method: "POST",
          body: { username: "TEST", password: "fixture-private" },
        } as IncomingMessage & { body: unknown },
        r.r,
      );
      expect(r.r.statusCode).toBe(401);
      expect(r.json.message).toContain("Invalid username or password");
    }
  });
});
