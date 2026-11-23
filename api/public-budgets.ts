import { createClient } from "@supabase/supabase-js";
import type { IncomingMessage, ServerResponse } from "node:http";
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    res.end(JSON.stringify({ message: "Use GET." }));
    return;
  }
  const year = Number(
    new URL(req.url ?? "/", "https://local.invalid").searchParams.get("year"),
  );
  if (!Number.isInteger(year) || year < 2021 || year > 2030) {
    res.statusCode = 400;
    res.end(JSON.stringify({ message: "Invalid budget year." }));
    return;
  }
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) {
    res.statusCode = 503;
    res.end(JSON.stringify({ message: "Live budget connection unavailable." }));
    return;
  }
  try {
    const db = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const result = await db
      .from("market_months")
      .select("market_id,year,month,data,version,updated_at")
      .eq("year", year)
      .in("market_id", [
        "asia",
        "america",
        "middle-east",
        "russia",
        "europe",
        "other-markets",
      ]);
    if (result.error) throw result.error;
    // Explicit numeric section allowlist. Never publish notes, team, Auth data, audits or property settings.
    const entries = (result.data ?? []).map((e) => ({
      market_id: e.market_id,
      year: e.year,
      month: e.month,
      version: e.version,
      updated_at: e.updated_at,
      data: {
        commercial: numeric(e.data.commercial),
        villas: numeric(e.data.villas),
        countries: numeric(e.data.countries),
        meals: numeric(e.data.meals),
        notes: "",
      },
    }));
    res.end(JSON.stringify({ entries, source: "database" }));
  } catch {
    res.statusCode = 503;
    res.end(
      JSON.stringify({
        message:
          "Saved database budgets are not available. Database setup or import may still be required.",
      }),
    );
  }
}
function numeric(rows: unknown) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    label: String(r.label ?? ""),
    budget: Number(r.budget),
    bob: Number(r.bob),
    targets: Array.isArray(r.targets) ? r.targets.map(Number) : [],
    weekly: Array.isArray(r.weekly) ? r.weekly.map(Number) : [],
  }));
}
