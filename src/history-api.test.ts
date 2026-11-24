import { describe, it, expect, vi, afterEach } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import handler from "../api/history";
import { blankHistory } from "./history";
function response() {
  let text = "";
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (s: string) => (text = s),
  };
  return {
    res: res as unknown as ServerResponse,
    json: () => JSON.parse(text),
  };
}
function req(method = "GET", body?: unknown, cookie = "") {
  return {
    method,
    body,
    url: "/api/history?year=2024",
    headers: { host: "app.example", origin: "https://app.example", cookie },
  } as unknown as IncomingMessage;
}
function env() {
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "fixture");
}
afterEach(() => {
  vi.unstubAllEnvs();
  factory.mockReset();
});
describe("PIN history API", () => {
  it("fails closed for anonymous writes", async () => {
    const r = response();
    await handler(req("POST", blankHistory(2024)), r.res);
    expect(r.res.statusCode).toBe(401);
    expect(factory).not.toHaveBeenCalled();
  });
  it("allows sanitized public year reads without PIN", async () => {
    env();
    factory.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [{ ...blankHistory(2024), version: 1, secret: "HIDDEN" }],
            }),
          }),
        }),
      }),
    });
    const r = response();
    await handler(req(), r.res);
    expect(r.res.statusCode).toBe(200);
    expect(r.json().years[0].year).toBe(2024);
    expect(JSON.stringify(r.json())).not.toContain("HIDDEN");
  });
  it("reports success only after shared save and matching readback", async () => {
    env();
    const pin = randomBytes(24).toString("hex");
    vi.stubEnv("BUSINESS_EYE_PIN", pin);
    const exp = String(Date.now() + 60000),
      nonce = "fixture",
      sig = createHmac("sha256", pin).update(`${exp}.${nonce}`).digest("hex"),
      cookie = `business_eye_pin=${exp}.${nonce}.${sig}`;
    const rpc = vi.fn(async (..._args: unknown[]) => ({ error: null }));
    factory.mockReturnValue({
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { ...blankHistory(2024), version: 1 },
            }),
          }),
        }),
      }),
    });
    const r = response();
    await handler(req("POST", blankHistory(2024), cookie), r.res);
    expect(r.res.statusCode).toBe(200);
    expect(r.json().year.version).toBe(1);
    expect(rpc.mock.calls[0][0]).toBe("save_history_year");
  });
});
