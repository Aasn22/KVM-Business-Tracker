import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { gzipSync, gunzipSync } from "node:zlib";
import { validSession } from "./pin-session.js";
import {
  productionFromReservations,
  sanitizeProductionReservations,
} from "../src/production.js";
export function cleanProductionSnapshot(raw: unknown) {
  const b = raw as { reservations?: unknown };
  const reservations = sanitizeProductionReservations(b?.reservations);
  return productionFromReservations(reservations);
}
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, message: string, extra = {}) => {
    res.statusCode = status;
    const text = JSON.stringify({ message, ...extra });
    if (Buffer.byteLength(text) > 1000000) {
      res.setHeader("Content-Encoding", "gzip");
      res.end(gzipSync(text));
    } else res.end(text);
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
      "Shared production database is not configured. No data saved.",
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    if (req.method === "GET") {
      const revisionOnly = new URL(
        req.url ?? "/",
        "https://local.invalid",
      ).searchParams.has("revision");
      if (revisionOnly) {
        const revision = await db
          .from("production_snapshots")
          .select("updated_at")
          .eq("id", "current")
          .maybeSingle();
        if (revision.error)
          return send(
            503,
            "Production database table unavailable. Apply production database setup.",
          );
        return send(200, "Production revision loaded", {
          data: null,
          revision: revision.data?.updated_at ?? null,
        });
      }
      const result = await db
        .from("production_snapshots")
        .select("data,updated_at")
        .eq("id", "current")
        .maybeSingle();
      if (result.error)
        return send(
          503,
          "Production database table unavailable. Apply production database setup.",
        );
      const stored = result.data?.data;
      if (!stored) return send(200, "No shared import yet", { data: null });
      if (stored.schema === 2 && stored.reservations) {
        const reservations = sanitizeProductionReservations(
          stored.reservations,
        );
        return send(200, "Database records loaded", {
          data: { schema: 2, reservations },
          revision: result.data?.updated_at,
        });
      }
      return send(200, "Legacy shared snapshot loaded", {
        data: stored,
        revision: result.data?.updated_at,
      });
    }
    let raw = req.body;
    if (raw === undefined) {
      let s = "";
      for await (const c of req) {
        s += c;
        if (Buffer.byteLength(s) > 3500000)
          return send(
            413,
            "Upload exceeds 3.5 MB normalized request. Split into complete non-overlapping arrival periods.",
          );
      }
      raw = JSON.parse(s);
    }
    if (typeof raw === "string") raw = JSON.parse(raw);
    if (Buffer.byteLength(JSON.stringify(raw)) > 3500000)
      return send(413, "Split upload into complete arrival periods.");
    if (raw && typeof raw === "object" && "compressed" in raw) {
      const packed = (raw as { compressed: unknown }).compressed;
      if (typeof packed !== "string")
        return send(400, "Invalid compressed source");
      raw = JSON.parse(
        gunzipSync(Buffer.from(packed, "base64"), {
          maxOutputLength: 30000000,
        }).toString("utf8"),
      );
    }
    const reservations = sanitizeProductionReservations(
      (raw as { reservations?: unknown }).reservations,
    );
    const dates = reservations.map((r) => r.arrival).sort(),
      from = dates[0],
      to = dates[dates.length - 1];
    const result = await db.rpc("import_production_reservations", {
      p_reservations: reservations,
      p_from: from,
      p_to: to,
    });
    if (result.error)
      return send(
        503,
        "Production save is unavailable. Apply the production reservation import SQL setup; no successful save was confirmed.",
      );
    // Verify the stored payload before acknowledging publication. RPC hash/count comes from DB transaction.
    const check = await db
      .from("production_snapshots")
      .select("data,updated_at")
      .eq("id", "current")
      .single();
    if (check.error || !check.data?.data?.reservations)
      return send(
        503,
        "Database write returned but read-back failed. Do not repeat until the stored import is checked.",
      );
    const persisted = sanitizeProductionReservations(
      check.data.data.reservations,
    ).filter((r) => r.arrival >= from && r.arrival <= to);
    if (JSON.stringify(persisted) !== JSON.stringify(reservations))
      return send(
        409,
        "Another import changed the same arrival range before verification. Refresh and inspect current data before retrying.",
      );
    return send(200, "Saved and verified in the shared database", {
      from,
      to,
      rows: reservations.length,
      revision: check.data.updated_at,
    });
  } catch (e) {
    return send(
      400,
      e instanceof Error
        ? e.message
        : "Invalid production data. No import confirmed.",
    );
  }
}
