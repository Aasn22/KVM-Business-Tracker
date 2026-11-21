import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { validSession } from "./pin-session.js";
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (n: number, message: string, data?: unknown) => {
    res.statusCode = n;
    res.end(JSON.stringify({ message, ...(data ? { data } : {}) }));
  };
  if (!["GET", "POST"].includes(req.method ?? ""))
    return send(405, "Use GET or POST");
  if (
    req.method === "POST" &&
    (!process.env.BUSINESS_EYE_PIN ||
      !validSession(req.headers.cookie ?? "", process.env.BUSINESS_EYE_PIN))
  )
    return send(401, "Admin PIN required");
  if (
    req.method === "POST" &&
    req.headers.origin !== `https://${req.headers.host}`
  )
    return send(403, "Invalid origin");
  const url = process.env.SUPABASE_URL,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return send(
      503,
      "Shared production storage not configured. Published snapshot unchanged.",
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    if (req.method === "GET") {
      const r = await db
        .from("production_snapshots")
        .select("data")
        .eq("id", "current")
        .maybeSingle();
      if (r.error)
        return send(503, "Shared production storage setup required.");
      return send(200, "Snapshot loaded", r.data?.data);
    }
    let raw = req.body;
    if (raw === undefined) {
      let s = "";
      for await (const c of req) {
        s += c;
        if (Buffer.byteLength(s) > 3000000)
          return send(413, "Maximum 3 MB analytical payload");
      }
      raw = JSON.parse(s);
    }
    if (typeof raw === "string") raw = JSON.parse(raw);
    if (Buffer.byteLength(JSON.stringify(raw)) > 3000000)
      return send(413, "Maximum 3 MB analytical payload");
    const data = cleanProductionSnapshot(raw);
    const r = await db
      .from("production_snapshots")
      .upsert({ id: "current", data, updated_at: new Date().toISOString() });
    if (r.error)
      return send(
        503,
        "Shared production save failed. Apply production snapshot migration; published figures unchanged.",
      );
    return send(200, "Shared snapshot saved");
  } catch {
    return send(400, "Invalid production snapshot. Nothing saved.");
  }
}
export function cleanProductionSnapshot(raw: unknown) {
  const b = raw as Record<string, unknown>;
  if (
    !b ||
    b.schema !== 1 ||
    !Array.isArray(b.days) ||
    !b.days.length ||
    b.days.length > 15000 ||
    !Array.isArray(b.pace) ||
    b.pace.length > 4000
  )
    throw Error("invalid");
  const date = (v: unknown) => {
    if (
      typeof v !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      !Number.isFinite(Date.parse(v))
    )
      throw Error("date");
    return v;
  };
  const num = (v: unknown, signed = false) => {
    if (
      typeof v !== "number" ||
      !Number.isFinite(v) ||
      (!signed && v < 0) ||
      Math.abs(v) > 1e12
    )
      throw Error("number");
    return v;
  };
  const code = (v: unknown, max = 32) => {
    if (
      typeof v !== "string" ||
      !v.length ||
      v.length > max ||
      !/^[-A-Za-z0-9 /]+$/.test(v)
    )
      throw Error("code");
    return v;
  };
  const days = b.days.map((x: Record<string, unknown>) => {
    if (
      !["CHECKED OUT", "CANCELLED"].includes(String(x.status)) ||
      typeof x.complimentary !== "boolean"
    )
      throw Error("status");
    return {
      date: date(x.date),
      status: x.status,
      country: code(x.country),
      room: code(x.room),
      meal: code(x.meal),
      segment: code(x.segment),
      complimentary: x.complimentary,
      nights: num(x.nights),
      revenue: num(x.revenue, true),
      missingRevenue: num(x.missingRevenue),
      arrivals: num(x.arrivals),
    };
  });
  return {
    schema: 1,
    from: date(b.from),
    to: date(b.to),
    rows: num(b.rows),
    checkedOut: num(b.checkedOut),
    cancelled: num(b.cancelled),
    missingRevenue: num(b.missingRevenue),
    warnings: [
      "Arrival cohort only; incomplete occupancy coverage.",
      "One record per reservation; room quantities unavailable.",
      "Daily revenue allocated evenly across stay nights, not daily PMS actuals.",
      "Cancelled values are potential stay values, not realized revenue.",
    ],
    days,
    pace: b.pace.map((x: Record<string, unknown>) => ({
      date: date(x.date),
      bookings: num(x.bookings),
      revenue: num(x.revenue, true),
    })),
  };
}
