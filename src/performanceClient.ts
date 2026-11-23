import {
  cleanPerformanceRow,
  type PerformanceRow,
  type PerformanceImport,
  type SourceKind,
  type SourceDimension,
} from "./performanceSources";
export const performanceChanged = "kvm-performance-source-updated";
async function fetchPerformanceRevision(
  kind: SourceKind,
  dimension: SourceDimension,
  year: number,
): Promise<string | null> {
  const query = new URLSearchParams({
    kind,
    dimension,
    year: String(year),
    revision: "1",
  });
  const response = await fetch(`/api/performance?${query}`, {
    cache: "no-store",
  });
  if (!response.ok) throw Error("Performance revision unavailable");
  const body = await response.json();
  return typeof body.revision === "string" ? body.revision : null;
}
export function watchPerformance(
  kind: SourceKind,
  dimension: SourceDimension,
  year: number,
  onChange: () => void,
) {
  let active = true;
  let checking = false;
  let revision: string | null | undefined;
  async function check() {
    if (!active || checking || document.visibilityState === "hidden") return;
    checking = true;
    try {
      const next = await fetchPerformanceRevision(kind, dimension, year);
      if (revision === undefined) revision = next;
      else if (next !== revision) {
        revision = next;
        onChange();
      }
    } catch {
      // The full source request reports setup and availability errors.
    } finally {
      checking = false;
    }
  }
  void check();
  const timer = window.setInterval(() => void check(), 15000);
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") void check();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    active = false;
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
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
