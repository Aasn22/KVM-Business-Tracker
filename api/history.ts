import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { validSession } from "./pin-session.js";
import { cleanHistory } from "../src/history.js";
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
          "History database setup required. No saved history could be loaded.",
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
    if (saved.error)
      return send(
        String(saved.error.message).includes("conflict") ? 409 : 503,
        String(saved.error.message).includes("conflict")
          ? "History changed on another device. Reload before editing."
          : "History save unavailable. Apply the History Update database setup; nothing confirmed saved.",
      );
    const result = await db
      .from("history_years")
      .select("year,version,months,updated_at")
      .eq("year", y.year)
      .single();
    if (result.error)
      return send(
        503,
        "Save returned but read-back failed. Reload before retrying.",
      );
    const verify = cleanHistory(result.data);
    if (
      verify.version !== y.version + 1 ||
      JSON.stringify(verify.months) !== JSON.stringify(y.months)
    )
      return send(
        409,
        "Another save occurred before verification. Reload the saved year.",
      );
    return send(200, "History saved and verified", {
      year: { ...verify, updated_at: result.data.updated_at },
    });
  } catch (e) {
    return send(400, e instanceof Error ? e.message : "Invalid history data.");
  }
}
