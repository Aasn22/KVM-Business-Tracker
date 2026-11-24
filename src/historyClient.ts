import { cleanHistory, type HistoryYear } from "./history";
export const historyChanged = "kvm-history-updated";
export async function loadHistory(year?: number): Promise<HistoryYear[]> {
  const r = await fetch(`/api/history${year ? `?year=${year}` : ""}`, {
    cache: "no-store",
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.message || "History database unavailable.");
  if (!Array.isArray(b.years)) throw Error("Invalid history response.");
  return b.years.map((y: HistoryYear) => ({
    ...cleanHistory(y),
    updated_at: y.updated_at,
  }));
}
export async function saveHistory(year: HistoryYear): Promise<HistoryYear> {
  const r = await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cleanHistory(year)),
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.message || "History was not saved.");
  const saved = cleanHistory(b.year);
  window.dispatchEvent(new Event(historyChanged));
  return { ...saved, updated_at: b.year.updated_at };
}
