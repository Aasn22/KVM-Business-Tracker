import {
  afterEach,
  beforeAll,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { IncomingMessage, ServerResponse } from "node:http";
const factory = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: factory }));
import handler from "../api/operations";
import {
  loadSharedOperations,
  publishOperationBatch,
} from "./sharedOperations";
import { calendarDays } from "./DatePicker";
const row = {
  roomType: "BVR",
  arrival: "2026-12-01",
  nights: 2,
  amount: 100,
  eventDate: "2026-11-19",
  leadTime: 12,
  marketCode: "RET",
  rateCode: "BB",
};
const batch = {
  id: "a".repeat(64),
  kind: "cancellations" as const,
  from: "2026-11-19",
  to: "2026-11-19",
  savedAt: "2026-11-20T00:00:00Z",
  rows: [row],
};
function response() {
  let body = "";
  const res = {
    statusCode: 200,
    setHeader: vi.fn(),
    end: (s: string) => {
      body = s;
    },
  };
  return {
    res: res as unknown as ServerResponse,
    json: () => JSON.parse(body),
  };
}
const request = (
  method = "GET",
  body?: unknown,
  cookie = "",
  origin = "https://example.test",
) =>
  ({
    method,
    body,
    url: "/api/operations?kind=cancellations&from=2026-11-19&to=2026-11-19",
    headers: { host: "example.test", origin, cookie },
  }) as unknown as IncomingMessage;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  factory.mockReset();
});
describe("public reports with protected shared publication", () => {
  function env() {
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-server-placeholder");
  }
  it("lets anonymous users read sanitized published rows, never account/upload metadata", async () => {
    env();
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          rows: [{ ...row, guestName: "PRIVATE", staff: "PRIVATE" }],
          saved_at: "2026-11-20T00:00:00Z",
        },
      ],
      error: null,
    });
    factory.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({ gte: () => ({ lte: () => ({ limit }) }) }),
        }),
      }),
    });
    const r = response();
    await handler(request(), r.res);
    expect(r.res.statusCode).toBe(200);
    expect(r.json().rows).toEqual([row]);
    expect(JSON.stringify(r.json())).not.toContain("PRIVATE");
  });
  it("rejects anonymous writes and fails honestly on missing storage", async () => {
    env();
    factory.mockReturnValue({});
    const r = response();
    await handler(request("POST", batch), r.res);
    expect(r.res.statusCode).toBe(401);
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const missing = response();
    await handler(request(), missing.res);
    expect(missing.res.statusCode).toBe(503);
  });
  it("uses PIN cookie only for saving, strips private data and rejects cross-origin writes", async () => {
    env();
    const pin = randomBytes(16).toString("hex");
    vi.stubEnv("BUSINESS_EYE_PIN", pin);
    const payload = `${Date.now() + 60000}.testnonce`;
    const cookie = `business_eye_pin=${payload}.${createHmac("sha256", pin).update(payload).digest("hex")}`;
    const rpc = vi.fn().mockResolvedValue({ error: null });
    factory.mockReturnValue({ rpc });
    const r = response();
    await handler(
      request(
        "POST",
        { ...batch, rows: [{ ...row, name: "PRIVATE" }] },
        cookie,
      ),
      r.res,
    );
    expect(r.res.statusCode).toBe(200);
    expect(rpc.mock.calls[0][1].p_rows).toEqual([row]);
    const x = response();
    await handler(request("POST", batch, cookie, "https://other.test"), x.res);
    expect(x.res.statusCode).toBe(403);
  });
  it("public client uses shared endpoint with no PIN and publication never reports failed save as success", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ rows: [row] }) });
    vi.stubGlobal("fetch", fetch);
    expect(
      await loadSharedOperations("cancellations", batch.from, batch.to),
    ).toEqual([row]);
    expect(fetch.mock.calls[0][0]).toContain("/api/operations?");
    fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Migration required" }),
    });
    await expect(publishOperationBatch(batch)).rejects.toThrow(
      "Migration required",
    );
  });
  it("calendar grid covers leap years without any typed date controls", () => {
    expect(calendarDays(2028, 1).filter((x) => x !== null)).toHaveLength(29);
    expect(calendarDays(2027, 1).filter((x) => x !== null)).toHaveLength(28);
  });
});
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    "create role anon;create role authenticated;create role service_role bypassrls;",
  );
}, 30000);
afterAll(() => db.close());
describe("shared import migration", () => {
  it("is rerunnable, denies direct public access and serializes duplicate/overlapping imports", async () => {
    const sql = readFileSync(
      "supabase/migrations/20261120_shared_operational_imports.sql",
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    await db.exec("set role anon");
    await expect(
      db.query("select * from public.operational_imports"),
    ).rejects.toThrow("permission denied");
    await db.exec("reset role;set role service_role;");
    const save = (id: string, from = batch.from, to = batch.to) =>
      db.query("select public.save_operational_import($1,$2,$3,$4,$5::jsonb)", [
        id,
        "cancellations",
        from,
        to,
        JSON.stringify([row]),
      ]);
    await save(batch.id);
    await expect(save(batch.id)).rejects.toThrow("Duplicate");
    await expect(save("b".repeat(64))).rejects.toThrow("overlapping");
    await save("c".repeat(64), "2026-11-20", "2026-11-20");
    expect(
      (await db.query("select * from public.operational_imports")).rows,
    ).toHaveLength(2);
  });
});
