import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { IncomingMessage, ServerResponse } from "node:http";
const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
import handler from "../api/invite-user";
const profile = {
  id: "11111111-1111-1111-1111-111111111111",
  user_id: null,
  name: "Test Profile",
  role: "Read-Only",
  scope: "india",
  markets: [],
  version: 1,
};
function response() {
  let body = "";
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: vi.fn((s: string) => {
      body = s;
    }),
  };
  return {
    res: res as unknown as ServerResponse,
    get message() {
      return JSON.parse(body).message as string;
    },
  };
}
function request(
  body: unknown = { email: "test@example.com", memberId: profile.id },
) {
  return {
    method: "POST",
    headers: {
      authorization: "Bearer test-placeholder-not-a-credential",
      origin: "https://business-eye.example",
    },
    body,
  } as IncomingMessage & { body: unknown };
}
beforeEach(() => {
  vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "test-publishable-placeholder");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-placeholder");
  vi.stubEnv("BUSINESS_EYE_APP_URL", "https://business-eye.example");
  mocks.createClient.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
function clients(
  options: {
    role?: boolean;
    linked?: boolean;
    linkError?: boolean;
    passwordRequired?: boolean;
  } = {},
) {
  const invite = vi.fn().mockResolvedValue({
    data: { user: { id: "22222222-2222-2222-2222-222222222222" } },
    error: null,
  });
  const rpc = vi.fn().mockImplementation((name: string) =>
    Promise.resolve(
      name === "is_super_admin"
        ? { data: options.role !== false, error: null }
        : name === "password_setup_required"
          ? { data: options.passwordRequired === true, error: null }
          : {
              data: profile.id,
              error: options.linkError ? { message: "conflict" } : null,
            },
    ),
  );
  const caller = {
    auth: {
      getUser: vi
        .fn()
        .mockResolvedValue({ data: { user: { id: profile.id } }, error: null }),
    },
    rpc,
  };
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { ...profile, user_id: options.linked ? "linked" : null },
            error: null,
          }),
        }),
      }),
    }),
    auth: { admin: { inviteUserByEmail: invite } },
  };
  mocks.createClient.mockReturnValueOnce(caller).mockReturnValueOnce(admin);
  return { invite, rpc };
}
describe("server-only Super Admin invitations", () => {
  it("fails closed if server settings are missing", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(503);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects anonymous and regular-admin callers before inviting", async () => {
    let r = response();
    const req = request();
    req.headers.authorization = undefined;
    await handler(req, r.res);
    expect(r.res.statusCode).toBe(401);
    const c = clients({ role: false });
    r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(403);
    expect(c.invite).not.toHaveBeenCalled();
  });
  it("rejects passwords in invitation requests", async () => {
    let c = clients();
    let r = response();
    await handler(
      request({
        email: "test@example.com",
        memberId: profile.id,
        password: "test-password-field-rejected",
      }),
      r.res,
    );
    expect(r.res.statusCode).toBe(400);
    expect(c.invite).not.toHaveBeenCalled();
  });
  it("avoids reinviting an already linked profile", async () => {
    const c = clients({ linked: true });
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(409);
    expect(c.invite).not.toHaveBeenCalled();
  });
  it("sends one invite to the configured passwordless route and links reviewed permissions", async () => {
    const c = clients();
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(200);
    expect(c.invite).toHaveBeenCalledWith("test@example.com", {
      redirectTo: "https://business-eye.example/auth/confirm",
    });
    expect(c.rpc).toHaveBeenCalledWith(
      "save_team_member",
      expect.objectContaining({
        p_id: profile.id,
        p_user_id: "22222222-2222-2222-2222-222222222222",
        p_version: 1,
      }),
    );
  });
  it("reports partial invitation/link failure without silently retrying", async () => {
    const c = clients({ linkError: true });
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(409);
    expect(r.message).toContain("Invitation was sent");
    expect(r.message).toContain("Do not resend");
    expect(c.invite).toHaveBeenCalledOnce();
  });
  it("rejects a foreign request origin", async () => {
    const c = clients();
    const req = request();
    req.headers.origin = "https://untrusted.example";
    const r = response();
    await handler(req, r.res);
    expect(r.res.statusCode).toBe(403);
    expect(c.invite).not.toHaveBeenCalled();
  });
});
