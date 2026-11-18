import { createClient } from "@supabase/supabase-js";
import type { Entry, MonthData } from "./model";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const db = url && key ? createClient(url, key) : null;
export async function loadYear(year: number) {
  if (!db) throw Error("Database is not configured.");
  const { data, error } = await db
    .from("market_months")
    .select("*")
    .eq("year", year);
  if (error) throw error;
  return data as Entry[];
}
export async function saveMonth(
  market: string,
  year: number,
  month: number,
  data: MonthData,
  version: number,
) {
  if (!db) throw Error("Database is not configured.");
  const result = await db.rpc("save_market_month", {
    p_market: market,
    p_year: year,
    p_month: month,
    p_data: data,
    p_version: version,
  });
  if (result.error) throw result.error;
  return result.data as number;
}
export async function saveImport(entries: Entry[]) {
  if (!db) throw Error("Database is not configured.");
  const { error } = await db.rpc("import_market_months", {
    p_entries: entries,
  });
  if (error) throw error;
}
