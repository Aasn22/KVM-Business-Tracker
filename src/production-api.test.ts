import { describe, it, expect, vi, afterEach } from "vitest";
import { gzipSync } from "node:zlib";
import { createHmac, randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import handler from "../api/production";
const reservation = {
  arrival: "2026-01-01",
  departure: "2026-01-03",
  confirmed: "2025-11-01",
  cancelledOn: "",
  status: "NO SHOW",
  country: "IN",
  room: "NEWROOM",
  meal: "NEWMEAL",
  source: "NEW SOURCE",
  marketCode: "NEWSEG",
  rateCode: "NORMAL",
  agent: "Example Travel",
  revenue: 200,
  quantity: null,
};
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
function request(method = "GET", body?: unknown, cookie = "") {
  return {
    method,
    body,
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
describe("database production publication", () => {
  it("allows public reads of approved record fields but strips guest/secret keys", async () => {
    env();
    factory.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                data: {
                  schema: 2,
                  reservations: [
                    {
                      ...reservation,
                      guestName: "PRIVATE",
                      password: "PRIVATE",
                    },
                  ],
                },
                updated_at: "2026-11-22",
              },
            }),
          }),
        }),
      }),
    });
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(200);
    expect(r.json().data.reservations[0].status).toBe("NO SHOW");
    expect(JSON.stringify(r.json())).not.toContain("PRIVATE");
  });
  it("never writes from anonymous requests", async () => {
    env();
    const r = response();
    await handler(request("POST", { reservations: [reservation] }), r.res);
    expect(r.res.statusCode).toBe(401);
    expect(factory).not.toHaveBeenCalled();
  });
  it("confirms a save only after the same approved records can be read back", async () => {
    env();
    const pin = randomBytes(24).toString("hex");
    vi.stubEnv("BUSINESS_EYE_PIN", pin);
    const expiry = String(Date.now() + 60000),
      nonce = "fixture",
      signature = createHmac("sha256", pin)
        .update(`${expiry}.${nonce}`)
        .digest("hex");
    const cookie = `business_eye_pin=${expiry}.${nonce}.${signature}`;
    const rpc = vi.fn(async (..._args: unknown[]) => ({ error: null }));
    factory.mockReturnValue({
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: {
                data: { schema: 2, reservations: [reservation] },
                updated_at: "revision",
              },
            }),
          }),
        }),
      }),
    });
    const r = response();
    await handler(
      request(
        "POST",
        {
          compressed: gzipSync(
            JSON.stringify({ reservations: [reservation] }),
          ).toString("base64"),
        },
        cookie,
      ),
      r.res,
    );
    expect(r.res.statusCode).toBe(200);
    expect(r.json().rows).toBe(1);
    expect(rpc.mock.calls[0][0]).toBe("import_production_reservations");
  });
});
