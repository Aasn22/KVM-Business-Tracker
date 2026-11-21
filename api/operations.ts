import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { validSession } from "./pin-session.js";
import {
  sanitizeOperation,
  validateBatch,
  parseDate,
  type OperationKind,
} from "../src/operational.js";
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const reply = (status: number, message: string, extra = {}) => {
    res.statusCode = status;
    res.end(JSON.stringify({ message, ...extra }));
  };
  if (!["GET", "POST"].includes(req.method ?? "")) {
    res.setHeader("Allow", "GET, POST");
    return reply(405, "Method not allowed.");
  }
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return reply(
      503,
      "Shared operational storage is not configured. Administrator setup is required.",
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  if (req.method === "GET") {
    const query = new URL(req.url ?? "/", "https://local.invalid").searchParams;
    const kind = query.get("kind") as OperationKind;
    const from = query.get("from") ?? "",
      to = query.get("to") ?? "";
    try {
      if (!["cancellations", "reservations"].includes(kind))
        return reply(400, "Invalid report kind.");
      if (parseDate(from) !== from || parseDate(to) !== to || from > to)
        return reply(400, "Choose valid From and To report dates.");
    } catch {
      return reply(400, "Choose valid From and To report dates.");
    }
    try {
      const result = await db
        .from("operational_imports")
        .select("id,kind,from_date,to_date,saved_at,rows")
        .eq("kind", kind)
        .gte("to_date", from)
        .lte("from_date", to)
        .limit(201);
      if (result.error)
        return reply(
          503,
          "Shared report storage is unavailable. Apply the operational-import migration; no data was read.",
        );
      if (result.data.length > 200)
        return reply(413, "Select a narrower date range.");
      try {
        const rows = result.data
          .flatMap((b) =>
            (b.rows as Record<string, unknown>[]).map((r) =>
              sanitizeOperation(r, kind),
            ),
          )
          .filter((r) => r.eventDate >= from && r.eventDate <= to);
        if (rows.length > 20000)
          return reply(413, "Select a narrower date range.");
        return reply(200, "Shared report loaded.", {
          rows,
          source: "shared",
          lastSavedAt:
            result.data.reduce(
              (s, b) => (b.saved_at > s ? b.saved_at : s),
              "",
            ) || null,
        });
      } catch {
        return reply(
          503,
          "Stored report failed validation. Administrator review required.",
        );
      }
    } catch {
      return reply(
        503,
        "Shared report connection unavailable. No report was loaded.",
      );
    }
  }
  if (
    !process.env.BUSINESS_EYE_PIN ||
    !validSession(req.headers.cookie ?? "", process.env.BUSINESS_EYE_PIN)
  )
    return reply(401, "Administrator PIN access required to save uploads.");
  if (req.headers.origin !== `https://${req.headers.host}`)
    return reply(403, "Invalid request origin.");
  try {
    let body = req.body;
    if (body === undefined) {
      let raw = "";
      for await (const c of req) {
        raw += c;
        if (Buffer.byteLength(raw) > 3 * 1024 * 1024)
          return reply(
            413,
            "Import too large for shared saving; split the activity period.",
          );
      }
      body = JSON.parse(raw);
    }
    if (
      Buffer.byteLength(
        typeof body === "string" ? body : JSON.stringify(body ?? {}),
      ) >
      3 * 1024 * 1024
    )
      return reply(413, "Import too large; split the activity period.");
    if (typeof body === "string") body = JSON.parse(body);
    const b = body as Record<string, unknown>;
    const kind = b.kind as OperationKind;
    if (
      !["cancellations", "reservations"].includes(kind) ||
      typeof b.id !== "string" ||
      !/^([a-f0-9]{64})$/.test(b.id) ||
      !Array.isArray(b.rows) ||
      b.rows.length > 10000
    )
      return reply(400, "Invalid import payload.");
    const rows = b.rows.map((r) => sanitizeOperation(r, kind));
    validateBatch(kind, rows, String(b.from ?? ""), String(b.to ?? ""));
    const result = await db.rpc("save_operational_import", {
      p_id: b.id,
      p_kind: kind,
      p_from: b.from,
      p_to: b.to,
      p_rows: rows,
    });
    if (result.error) {
      if (["23505", "23P01", "P0001"].includes(result.error.code))
        return reply(
          409,
          "This file or an overlapping activity-date range is already published. No duplicate was saved.",
        );
      return reply(
        503,
        "Shared saving unavailable. Apply the operational-import migration. Nothing was published; do not assume a local save is shared.",
      );
    }
    return reply(200, "Published for public reports.");
  } catch {
    return reply(400, "Invalid report data or request. Nothing was published.");
  }
}
