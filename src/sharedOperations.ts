import {
  sanitizeOperation,
  type OperationKind,
  type OperationBatch,
} from "./operational";
export async function loadSharedOperations(
  kind: OperationKind,
  from: string,
  to: string,
) {
  const res = await fetch(
    `/api/operations?${new URLSearchParams({ kind, from, to })}`,
    { cache: "no-store" },
  );
  const body = await res.json();
  if (!res.ok) throw Error(body.message || "Shared reports unavailable.");
  if (!Array.isArray(body.rows)) throw Error("Invalid report response.");
  return body.rows.map((r: Record<string, unknown>) =>
    sanitizeOperation(r, kind),
  );
}
export async function publishOperationBatch(batch: OperationBatch) {
  const res = await fetch("/api/operations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: batch.id,
      kind: batch.kind,
      from: batch.from,
      to: batch.to,
      rows: batch.rows,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw Error(body.message || "Unable to publish import.");
}
