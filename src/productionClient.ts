import {
  productionFromReservations,
  sanitizeProductionReservations,
  type ProductionData,
} from "./production";
export const productionChanged = "kvm-production-updated";
export async function loadProduction(): Promise<{
  data: ProductionData;
  source: string;
}> {
  let unavailable = "Shared saving not verified";
  try {
    const r = await fetch("/api/production", { cache: "no-store" });
    if (r.ok) {
      const b = await r.json();
      if (b.data)
        return {
          data:
            b.data.schema === 2
              ? productionFromReservations(
                  sanitizeProductionReservations(b.data.reservations),
                )
              : b.data,
          source: "Shared database · imported reservation records",
        };
    } else {
      const issue = await r.json();
      unavailable = String(issue.message || "Shared database unavailable");
    }
  } catch {
    /* Explicitly labelled published baseline, not a live save. */
  }
  const r = await fetch("/data/production-2026-q1.json");
  if (!r.ok) throw Error("Production data is unavailable.");
  return {
    data: await r.json(),
    source:
      "Published Q1 2026 baseline · " +
      unavailable +
      ". Booking/cancellation dates, agent/source and new statuses require a database import of the production spreadsheet.",
  };
}
export async function saveProduction(data: ProductionData) {
  let body = JSON.stringify({ reservations: data.reservations });
  if (
    new TextEncoder().encode(body).length > 1000000 &&
    typeof CompressionStream !== "undefined"
  ) {
    const stream = new Blob([body])
      .stream()
      .pipeThrough(new CompressionStream("gzip"));
    const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192)
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    body = JSON.stringify({ compressed: btoa(binary) });
  }
  const r = await fetch("/api/production", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
  const b = await r.json();
  if (!r.ok) throw Error(b.message || "Shared save failed.");
  window.dispatchEvent(new Event(productionChanged));
}
