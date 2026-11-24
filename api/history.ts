import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { validSession } from "./pin-session.js";
import { cleanHistory } from "../src/history.js";
import {
  initializeAndSaveHistory,
  missingHistorySchema,
} from "../src/server/historyStorage.js";
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
    return send(405, "Use GET or POST.");
  if (
    req.method === "POST" &&
    (!process.env.BUSINESS_EYE_PIN ||
      !validSession(req.headers.cookie ?? "", process.env.BUSINESS_EYE_PIN))
  )
    return send(401, "Administrator PIN required.");
  if (
    req.method === "POST" &&
    req.headers.origin !== `https://${req.headers.host}`
  )
    return send(403, "Invalid request origin.");
  const url = process.env.SUPABASE_URL,
    key =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    return send(
      503,
      "History database connection is not configured. Nothing saved.",
    );
  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    if (req.method === "GET") {
      const value = new URL(
        req.url ?? "/api/history",
        "https://local.invalid",
      ).searchParams.get("year");
      if (
        value !== null &&
        (!/^\d{4}$/.test(value) || +value < 2021 || +value > 2060)
      )
        return send(400, "Invalid history year.");
      let query = db
        .from("history_years")
        .select("year,version,months,updated_at");
      if (value) query = query.eq("year", +value);
      const r = await query.order("year");
      if (r.error)
        return send(
          503,
          missingHistorySchema(r.error)
            ? "History storage needs initialization. You may enter figures and use Save History to initialize and save securely."
            : "History database could not be read. Your unsaved entries will not be discarded; try Save History or download a backup.",
          { canInitialize: missingHistorySchema(r.error) },
        );
      return send(200, "History loaded", {
        years: (r.data ?? []).map((y) => ({
          ...cleanHistory(y),
          updated_at: y.updated_at,
        })),
      });
    }
    let raw = req.body;
    if (raw === undefined) {
      let text = "";
      for await (const chunk of req) {
        text += chunk;
        if (Buffer.byteLength(text) > 20000)
          return send(413, "History entry too large.");
      }
      raw = JSON.parse(text);
    }
    if (typeof raw === "string") raw = JSON.parse(raw);
    if (Buffer.byteLength(JSON.stringify(raw)) > 20000)
      return send(413, "History entry too large.");
    const y = cleanHistory(raw);
    const saved = await db.rpc("save_history_year", {
      p_year: y.year,
      p_version: y.version,
      p_months: y.months,
    });
    let stored: unknown;
    if (saved.error) {
      if (String(saved.error.message).includes("conflict"))
        return send(
          409,
          "History changed on another device. Your entries are kept. Download a backup before reloading.",
        );
      if (!missingHistorySchema(saved.error))
        return send(
          503,
          "History save failed. Your entries are kept; download a backup and retry.",
        );
      try {
        stored = await initializeAndSaveHistory(y.year, y.version, y.months);
      } catch (e) {
        const code = (e as { code?: string }).code,
          message = (e as Error).message;
        if (code === "P0001" && message.includes("conflict"))
          return send(
            409,
            "History exists or changed on another device. Your entries are kept; download a backup before reloading.",
          );
        return send(
          503,
          "Unable to initialize shared History storage using the connected database. Your entries are kept. Download a backup; database connection/permissions need attention.",
        );
      }
    } else {
      const result = await db
        .from("history_years")
        .select("year,version,months,updated_at")
        .eq("year", y.year)
        .single();
      if (result.error)
        return send(
          503,
          "Save returned but read-back failed. Keep your entries and check saved data before retrying.",
        );
      stored = result.data;
    }
    const verify = cleanHistory(stored);
    if (
      verify.version !== y.version + 1 ||
      JSON.stringify(verify.months) !== JSON.stringify(y.months)
    )
      return send(
        409,
        "Another save occurred before verification. Reload the saved year.",
      );
    return send(200, "History saved and verified", {
      year: {
        ...verify,
        updated_at: (stored as { updated_at?: unknown }).updated_at,
      },
    });
  } catch (e) {
    return send(400, e instanceof Error ? e.message : "Invalid history data.");
  }
}
