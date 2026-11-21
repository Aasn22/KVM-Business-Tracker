import {
  cleanPerformanceRow,
  type PerformanceRow,
  type PerformanceImport,
  type SourceKind,
  type SourceDimension,
} from "./performanceSources";
export const performanceChanged = "kvm-performance-source-updated";
export async function fetchPerformance(
  kind: SourceKind,
  dimension: SourceDimension,
  year: number,
): Promise<(PerformanceRow & { sourceAsOf: string })[]> {
  const res = await fetch(
    `/api/performance?${new URLSearchParams({ kind, dimension, year: String(year) })}`,
    { cache: "no-store" },
  );
  let body;
  try {
    body = await res.json();
  } catch {
    throw Error(
      "Primary source service unavailable. No values were loaded or published.",
    );
  }
  if (!res.ok) throw Error(body.message || "Performance source unavailable");
  if (!Array.isArray(body.rows)) throw Error("Invalid source response");
  return body.rows.map((r: Record<string, unknown>) => ({
    ...cleanPerformanceRow(r),
    sourceAsOf: String(r.asOf ?? "Unknown"),
  }));
}
export async function publishPerformance(data: PerformanceImport) {
  const res = await fetch("/api/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  let body;
  try {
    body = await res.json();
  } catch {
    throw Error(
      "Primary source service unavailable. No values were loaded or published.",
    );
  }
  if (!res.ok) throw Error(body.message || "Source was not published");
  window.dispatchEvent(new Event(performanceChanged));
}
