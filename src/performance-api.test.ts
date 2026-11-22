import { afterEach, describe, it, expect, vi } from "vitest";
import { randomBytes, createHmac } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import handler from "../api/performance";
const row = {
  date: "2026-11-01",
  code: "BAR",
  rooms: 2,
  roomRevenue: 200,
  foodRevenue: 10,
  otherRevenue: 0,
  guests: 4,
  reportedOccupancy: 2.67,
  reportedADR: 100,
};
const body = {
  id: "a".repeat(64),
  kind: "history",
  dimension: "market",
  from: row.date,
  to: row.date,
  asOf: "2026-11-21",
  rows: [row],
};
function response() {
  let value = "";
  const r = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (s: string) => {
      value = s;
    },
  };
  return { res: r as unknown as ServerResponse, json: () => JSON.parse(value) };
}
function request(method = "GET", data?: unknown, cookie = "") {
  return {
    method,
    body: data,
    url: "/api/performance?year=2026&kind=history&dimension=market",
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
describe("public primary-source reads and admin replacement", () => {
  it("returns only the newest source revision for lightweight polling", async () => {
    env();
    const maybeSingle = vi.fn(async () => ({
      data: { updated_at: "revision-1" },
      error: null,
    }));
    factory.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({
                    limit: () => ({ maybeSingle }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
    const r = response();
    await handler(
      {
        ...request(),
        url: `${request().url}&revision=1`,
      } as unknown as IncomingMessage,
      r.res,
    );
    expect(r.res.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ revision: "revision-1" });
    expect(maybeSingle).toHaveBeenCalledOnce();
  });
  it("fails closed for anonymous publication", async () => {
    const r = response();
    await handler(request("POST", body), r.res);
    expect(r.res.statusCode).toBe(401);
    expect(factory).not.toHaveBeenCalled();
  });
  it("returns public sanitized rows with explicit source dates, not private payload fields", async () => {
    env();
    factory.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              gte: () => ({
                lte: () => ({
                  order: () => ({
                    order: () => ({
                      range: async () => ({
                        data: [
                          {
                            date: row.date,
                            code: "BAR",
                            data: { ...row, guest: "PRIVATE" },
                            as_of: "2026-11-21",
                            updated_at: "2026-11-21T00:00:00Z",
                          },
                        ],
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    });
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(200);
    expect(r.json().rows[0].roomRevenue).toBe(200);
    expect(r.json().rows[0].asOf).toBe("2026-11-21");
    expect(JSON.stringify(r.json())).not.toContain("PRIVATE");
  });
  it("publishes validated source with PIN-cookie and returns explicit schema blocker", async () => {
    env();
    const pin = randomBytes(16).toString("hex");
    vi.stubEnv("BUSINESS_EYE_PIN", pin);
    const p = `${Date.now() + 60000}.nonce`,
      cookie = `business_eye_pin=${p}.${createHmac("sha256", pin).update(p).digest("hex")}`;
    const rpc = vi.fn().mockResolvedValue({ error: null });
    factory.mockReturnValue({ rpc });
    const r = response();
    await handler(
      request(
        "POST",
        { ...body, rows: [{ ...row, private: "PRIVATE" }] },
        cookie,
      ),
      r.res,
    );
    expect(r.res.statusCode).toBe(200);
    expect(rpc.mock.calls[0][1].p_rows).toEqual([row]);
    rpc.mockResolvedValue({ error: { code: "42P01" } });
    const error = response();
    await handler(request("POST", body, cookie), error.res);
    expect(error.res.statusCode).toBe(503);
    expect(error.json().message).toContain("nothing was published");
  });
});
