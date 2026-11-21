import type { ProductionData } from "./production";
export const productionChanged = "kvm-production-updated";
export async function loadProduction(): Promise<{
  data: ProductionData;
  source: string;
}> {
  try {
    const r = await fetch("/api/production", { cache: "no-store" });
    if (r.ok) {
      const b = await r.json();
      if (b.data)
        return { data: b.data, source: "Shared saved spreadsheet snapshot" };
    }
  } catch {
    /* Explicitly labelled published baseline, not a live save. */
  }
  const r = await fetch("/data/production-2026-q1.json");
  if (!r.ok) throw Error("Production data is unavailable.");
  return {
    data: await r.json(),
    source:
      "Published Q1 2026 spreadsheet snapshot · Shared saving not verified",
  };
}
export async function saveProduction(data: ProductionData) {
  const r = await fetch("/api/production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.message || "Shared save failed.");
  window.dispatchEvent(new Event(productionChanged));
}
