import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
import { validSession } from "./pin-session.js";
import {
  cleanPerformanceImport,
  cleanPerformanceRow,
  sourceKinds,
  dimensions,
  type SourceKind,
  type SourceDimension,
} from "../src/performanceSources.js";
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, message: string, extra = {}) => {
    res.statusCode = status;
    res.end(JSON.stringify({ message, ...extra }));
  };
  if (!["GET", "POST"].includes(req.method ?? ""))
    return send(405, "Use GET or POST");
  if (
    req.method === "POST" &&
    (!process.env.BUSINESS_EYE_PIN ||
      !validSession(req.headers.cookie ?? "", process.env.BUSINESS_EYE_PIN))
  )
    return send(401, "Admin PIN required to publish sources");
  if (
    req.method === "POST" &&
    req.headers.origin !== `https://${req.headers.host}`
  )
    return send(403, "Invalid origin");
  const url = process.env.SUPABASE_URL,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return send(503, "Shared performance source storage is not configured");
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    if (req.method === "GET") {
      const query = new URL(req.url ?? "/", "https://local.invalid")
          .searchParams,
        year = Number(query.get("year")),
        kind = query.get("kind") as SourceKind,
        dimension = query.get("dimension") as SourceDimension;
      if (
        !Number.isInteger(year) ||
        year < 2020 ||
        year > 2060 ||
        !sourceKinds.includes(kind) ||
        !dimensions.includes(dimension)
      )
        return send(400, "Invalid source selection");
      // Pagination is explicit: never silently truncate a year of country records.
      const rows: unknown[] = [];
      for (let start = 0; start < 100000; start += 1000) {
        const r = await db
          .from("performance_source_rows")
          .select("date,code,data,as_of,updated_at")
          .eq("kind", kind)
          .eq("dimension", dimension)
          .gte("date", `${year}-01-01`)
          .lte("date", `${year}-12-31`)
          .order("date")
          .order("code")
          .range(start, start + 999);
        if (r.error)
          return send(
            503,
            "Performance source setup required. Apply the shared-performance migration.",
          );
        rows.push(
          ...r.data.map((r) => ({
            ...cleanPerformanceRow({ ...r.data, date: r.date, code: r.code }),
            asOf: r.as_of,
            updatedAt: r.updated_at,
          })),
        );
        if (Buffer.byteLength(JSON.stringify(rows)) > 3500000)
          return send(
            413,
            "This source year exceeds response limits. Use a smaller source dataset; no partial total returned.",
          );
        if (r.data.length < 1000) return send(200, "Sources loaded", { rows });
      }
      return send(413, "Source selection too large");
    }
    let body = req.body;
    if (body === undefined) {
      let raw = "";
      for await (const c of req) {
        raw += c;
        if (Buffer.byteLength(raw) > 3500000)
          return send(413, "Split source into smaller date ranges");
      }
      body = JSON.parse(raw);
    }
    if (typeof body === "string") body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body)) > 3500000)
      return send(413, "Split source into smaller date ranges");
    const b = cleanPerformanceImport(body as Record<string, unknown>);
    const result = await db.rpc("publish_performance_source", {
      p_id: b.id,
      p_kind: b.kind,
      p_dimension: b.dimension,
      p_from: b.from,
      p_to: b.to,
      p_as_of: b.asOf,
      p_rows: b.rows,
    });
    if (result.error) {
      if (result.error.code === "P0001")
        return send(
          409,
          "A newer source exists for these dates or this exact import is already published. No replacement made.",
        );
      return send(
        503,
        "Shared source publication unavailable. Apply the shared-performance migration; nothing was published.",
      );
    }
    return send(
      200,
      "Source published; related pages use the new dated records",
    );
  } catch {
    return send(
      400,
      "Source request failed validation or connection unavailable; no success confirmed",
    );
  }
}
