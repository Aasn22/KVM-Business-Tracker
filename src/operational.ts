export type OperationKind = "cancellations" | "reservations";
export type OperationRow = {
  roomType: string;
  arrival: string;
  nights: number;
  amount: number;
  eventDate: string;
  leadTime?: number;
  marketCode?: string;
  rateCode: string;
  company?: string;
  departure?: string;
  mealPlan?: string;
  nationality?: string;
  country?: string;
  reservationType?: string;
};
export type OperationBatch = {
  id: string;
  kind: OperationKind;
  from: string;
  to: string;
  savedAt: string;
  rows: OperationRow[];
};
export const operationsKey = "kvm-operations-v1";
export const operationChanged = "kvm-operations-changed";
export function parseDate(input: string): string {
  const s = input.trim();
  let y: number, m: number, d: number;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s),
    short = /^(\d{2})[-/](\d{2})[-/](\d{2}|\d{4})$/.exec(s);
  if (iso) {
    [, y, m, d] = iso.map(Number);
  } else if (short) {
    d = Number(short[1]);
    m = Number(short[2]);
    y = Number(short[3]);
    if (y < 100) y += 2000;
  } else throw Error("Use valid dates (YYYY-MM-DD or DD-MM-YY).");
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    throw Error("Invalid calendar date.");
  return date.toISOString().slice(0, 10);
}
function text(v: unknown, required = false) {
  const t = String(v ?? "").trim();
  if (
    t.length > 200 ||
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(t) ||
    (required && !t)
  )
    throw Error("Missing/invalid required field.");
  return t;
}
function number(v: unknown) {
  const raw = String(v ?? "").trim();
  if (raw.includes(",") && !/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(raw))
    throw Error("Invalid number grouping.");
  const s = raw.replaceAll(",", "");
  if (!s || !/^\d+(\.\d+)?$/.test(s))
    throw Error("Missing or invalid non-negative number.");
  const n = Number(s);
  if (!Number.isFinite(n) || n > 1e12) throw Error("Number out of range.");
  return n;
}
export function sanitizeOperation(
  value: Record<string, unknown>,
  kind: OperationKind,
): OperationRow {
  const row: OperationRow = {
    roomType: text(value.roomType, true),
    arrival: parseDate(text(value.arrival, true)),
    nights: number(value.nights),
    amount: number(value.amount),
    eventDate: parseDate(text(value.eventDate, true)),
    rateCode: text(value.rateCode, true),
  };
  if (!Number.isInteger(row.nights))
    throw Error("Nights must be whole numbers.");
  if (kind === "cancellations") {
    row.leadTime = number(value.leadTime);
    row.marketCode = text(value.marketCode, true);
  } else {
    row.company = text(value.company);
    row.departure = parseDate(text(value.departure, true));
    if (
      row.departure < row.arrival ||
      (row.departure === row.arrival && row.nights > 0)
    )
      throw Error(
        "Departure must follow arrival unless this is a zero-night stay.",
      );
    row.mealPlan = text(value.mealPlan);
    row.nationality = text(value.nationality);
    row.country = text(value.country);
    row.reservationType = text(value.reservationType, true);
  }
  return row;
}
export function validateBatch(
  kind: OperationKind,
  rows: OperationRow[],
  from: string,
  to: string,
) {
  if (parseDate(from) > parseDate(to))
    throw Error("From date must be on or before To date.");
  if (!rows.length || rows.length > 10000)
    throw Error("Report must contain 1–10,000 rows.");
  rows.forEach((r, i) => {
    sanitizeOperation(r as unknown as Record<string, unknown>, kind);
    if (r.eventDate < from || r.eventDate > to)
      throw Error(`Row ${i + 1}: activity date falls outside selected range.`);
  });
}
export function readOperations(
  storage: Pick<Storage, "getItem">,
): OperationBatch[] {
  const raw = storage.getItem(operationsKey);
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (!Array.isArray(data))
    throw Error(
      "Saved operational data is invalid. Restore a backup before importing.",
    );
  return data.map((b) => {
    if (
      !["reservations", "cancellations"].includes(b.kind) ||
      typeof b.id !== "string" ||
      typeof b.savedAt !== "string" ||
      !Array.isArray(b.rows)
    )
      throw Error("Invalid saved import.");
    const rows = b.rows.map((r: Record<string, unknown>) =>
      sanitizeOperation(r, b.kind),
    );
    validateBatch(b.kind, rows, b.from, b.to);
    return {
      id: b.id,
      kind: b.kind,
      from: b.from,
      to: b.to,
      savedAt: b.savedAt,
      rows,
    };
  });
}
export function saveOperationBatch(
  storage: Pick<Storage, "getItem" | "setItem">,
  batch: OperationBatch,
) {
  validateBatch(batch.kind, batch.rows, batch.from, batch.to);
  const prior = readOperations(storage);
  if (prior.some((b) => b.id === batch.id))
    throw Error("This file has already been saved.");
  if (
    prior.some(
      (b) => b.kind === batch.kind && batch.from <= b.to && batch.to >= b.from,
    )
  )
    throw Error(
      "This activity date range overlaps an existing import. Do not double-count: use a non-overlapping report range.",
    );
  const safe: OperationBatch = {
    id: batch.id,
    kind: batch.kind,
    from: batch.from,
    to: batch.to,
    savedAt: batch.savedAt,
    rows: batch.rows.map((r) =>
      sanitizeOperation(r as unknown as Record<string, unknown>, batch.kind),
    ),
  };
  storage.setItem(operationsKey, JSON.stringify([...prior, safe]));
  return safe;
}
export function operationTotals(rows: OperationRow[]) {
  return {
    rows: rows.length,
    amount: rows.reduce((s, r) => s + r.amount, 0),
    stayNights: rows
      .filter((r) => r.rateCode.toUpperCase() !== "SHARER")
      .reduce((s, r) => s + r.nights, 0),
    sharers: rows.filter((r) => r.rateCode.toUpperCase() === "SHARER").length,
  };
}
export const fieldLabels: Record<keyof OperationRow, string> = {
  roomType: "Room type",
  arrival: "Arrival date",
  nights: "Nights",
  amount: "Amount",
  eventDate: "Activity date",
  leadTime: "Lead time",
  marketCode: "Market code",
  rateCode: "Rate code",
  company: "Company / travel agent / source",
  departure: "Departure date",
  mealPlan: "Meal plan",
  nationality: "Nationality",
  country: "Country code",
  reservationType: "Reservation type",
};
export function operationFields(kind: OperationKind): (keyof OperationRow)[] {
  return kind === "cancellations"
    ? [
        "roomType",
        "arrival",
        "leadTime",
        "nights",
        "marketCode",
        "rateCode",
        "amount",
        "eventDate",
      ]
    : [
        "roomType",
        "company",
        "arrival",
        "departure",
        "nights",
        "mealPlan",
        "nationality",
        "country",
        "rateCode",
        "reservationType",
        "amount",
        "eventDate",
      ];
}
