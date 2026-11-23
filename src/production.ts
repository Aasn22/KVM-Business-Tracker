import { geographicMarket, bookingSegment } from "./performanceSources.js";
export type ProductionReservation = {
  arrival: string;
  departure: string;
  confirmed: string;
  cancelledOn: string;
  status: string;
  country: string;
  room: string;
  meal: string;
  source: string;
  marketCode: string;
  rateCode: string;
  agent: string;
  revenue: number | null;
  quantity: number | null;
};
export type ProductionDay = {
  date: string;
  status: string;
  country: string;
  room: string;
  meal: string;
  segment: string;
  complimentary: boolean;
  nights: number;
  revenue: number;
  missingRevenue: number;
  arrivals: number;
  source?: string;
  agent?: string;
  marketCode?: string;
  confirmed?: string;
  cancelledOn?: string;
};
export type ProductionData = {
  schema: 1 | 2;
  reservations?: ProductionReservation[];
  statuses?: Record<string, number>;
  coverage?: { from: string; to: string }[];
  from: string;
  to: string;
  rows: number;
  checkedOut: number;
  cancelled: number;
  missingRevenue: number;
  warnings: string[];
  days: ProductionDay[];
  pace: { date: string; bookings: number; revenue: number }[];
};
export function productionCell(v: unknown): unknown {
  if (v && typeof v === "object" && "result" in v)
    return (v as { result: unknown }).result;
  return v;
}
function text(v: unknown) {
  return String(productionCell(v) ?? "")
    .trim()
    .toUpperCase();
}
function date(v: unknown) {
  v = productionCell(v);
  if (v instanceof Date && !isNaN(+v)) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
      .toISOString()
      .slice(0, 10);
  }
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/.exec(s);
  return m
    ? `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`
    : "";
}
function amount(v: unknown): number | null {
  v = productionCell(v);
  if (v === null || v === undefined || v === "") return null;
  const n =
    typeof v === "number" ? v : Number(String(v).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && Math.abs(n) <= 1e12 ? n : null;
}
export function buildProduction(
  headers: unknown[],
  records: unknown[][],
): ProductionData {
  const h = headers.map(text);
  const index = (name: string) => h.indexOf(name.toUpperCase());
  for (const name of [
    "Confirmed Date",
    "Reservation Status",
    "Arrival Date",
    "Departure Date",
    "Nights",
    "Source Code",
    "Market Code",
    "Country",
    "Room Type",
    "Rate Code",
    "Meal Plan",
  ])
    if (index(name) < 0) throw Error(`Missing column: ${name}`);
  let revenueIndex = index("Room Revenue");
  if (revenueIndex < 0) {
    const matches = h.flatMap((v, i) => (v === "ROOM RATE" ? [i] : []));
    if (matches.length !== 2)
      throw Error(
        "Provide Room Revenue or the supplied pair of Room Rate columns.",
      );
    revenueIndex = matches[1];
  }
  let total = 0;
  const reservations: ProductionReservation[] = [];
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (row.every((v) => v === null || v === undefined || v === "")) continue;
    const get = (name: string) => row[index(name)];
    const status = normalizeStatus(get("Reservation Status"));
    const arrival = date(get("Arrival Date")),
      departure = date(get("Departure Date")),
      confirmed = date(get("Confirmed Date"));
    const n = (Date.parse(departure) - Date.parse(arrival)) / 86400000;
    if (!arrival || !departure || !Number.isInteger(n) || n < 0 || n > 730)
      throw Error(`Row ${i + 2}: invalid arrival/departure dates.`);
    if (amount(get("Nights")) !== n)
      throw Error(
        `Row ${i + 2}: Nights does not match arrival/departure. No dates guessed.`,
      );
    const source = text(get("Source Code")),
      market = text(get("Market Code")),
      rate = text(get("Rate Code"));
    const complimentary =
      ["CMP", "HSE"].includes(source) ||
      ["CMP", "HSE"].includes(market) ||
      ["COMP", "SYST"].includes(rate);
    let revenue = amount(row[revenueIndex]);
    if (revenue === null && complimentary) revenue = 0;
    const country = text(get("Country")) || "UNSPECIFIED",
      room = text(get("Room Type")) || "UNSPECIFIED",
      meal = text(get("Meal Plan")) || "UNSPECIFIED";
    for (const v of [country, room, meal, source, market, rate])
      if (v.length > 100 || /[\x00-\x1f]/.test(v))
        throw Error(`Row ${i + 2}: invalid code text.`);
    const cancelledOn = date(get("Cancelled Date"));
    const agent =
      String(productionCell(get("Agent Name")) ?? "").trim() || "UNSPECIFIED";
    const quantity = amount(get("Room Quantity"));
    reservations.push({
      arrival,
      departure,
      confirmed,
      cancelledOn,
      status,
      country,
      room,
      meal,
      source: source || "UNSPECIFIED",
      marketCode: market || "UNSPECIFIED",
      rateCode: rate || "UNSPECIFIED",
      agent,
      revenue,
      quantity,
    });
    total++;
  }
  if (!total) throw Error("No valid reservation rows found.");
  return productionFromReservations(
    sanitizeProductionReservations(reservations),
  );
}
export async function parseProductionFile(file: File) {
  if (!/\.xlsx$/i.test(file.name))
    throw Error("Use XLSX in the supplied production layout.");
  if (file.size > 30 * 1024 * 1024) throw Error("Maximum 30 MB.");
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  if (workbook.worksheets.length !== 1) throw Error("Use one data worksheet.");
  const sheet = workbook.worksheets[0];
  if (sheet.rowCount > 50001) throw Error("Maximum 50,000 rows per file.");
  const headers = Array.from(
    { length: sheet.columnCount },
    (_, i) => sheet.getRow(1).getCell(i + 1).value,
  );
  const rows = [];
  for (let i = 2; i <= sheet.rowCount; i++)
    rows.push(
      Array.from(
        { length: sheet.columnCount },
        (_, j) => sheet.getRow(i).getCell(j + 1).value,
      ),
    );
  return buildProduction(headers, rows);
}
export function productionSummary(
  data: ProductionData,
  from: string,
  to: string,
  market: string | null = null,
  dimension:
    | "country"
    | "room"
    | "meal"
    | "segment"
    | "source"
    | "agent"
    | "marketCode" = "country",
  status = "CHECKED OUT",
) {
  const rows = data.days.filter(
    (r) =>
      r.date >= from &&
      r.date <= to &&
      (status === "ALL" || r.status === status) &&
      (!market || geographicMarket(r.country) === market),
  );
  const groups = new Map<
    string,
    { code: string; nights: number; revenue: number; arrivals: number }
  >();
  for (const r of rows) {
    const code = r[dimension] ?? "UNAVAILABLE";
    const g = groups.get(code) ?? { code, nights: 0, revenue: 0, arrivals: 0 };
    g.nights += r.nights;
    g.revenue += r.revenue;
    g.arrivals += r.arrivals;
    groups.set(code, g);
  }
  return {
    nights: rows.reduce((a, r) => a + r.nights, 0),
    revenue: rows.reduce((a, r) => a + r.revenue, 0),
    arrivals: rows.reduce((a, r) => a + r.arrivals, 0),
    complimentary: rows
      .filter((r) => r.complimentary)
      .reduce((a, r) => a + r.nights, 0),
    missingRevenue: rows.reduce((a, r) => a + r.missingRevenue, 0),
    groups: [...groups.values()].sort((a, b) => b.revenue - a.revenue),
  };
}

export function normalizeStatus(v: unknown) {
  const status = text(v)
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");
  if (!status || status.length > 80 || /[\x00-\x1f]/.test(status))
    throw Error(
      "Reservation status must be nonempty text (max 80 characters).",
    );
  return (
    (
      {
        "NO SHOW": "NO SHOW",
        NOSHOW: "NO SHOW",
        CANCELED: "CANCELLED",
        CHECKEDOUT: "CHECKED OUT",
        "CHECKED IN": "CHECKED IN",
      } as Record<string, string>
    )[status] ?? status
  );
}
export function productionFromReservations(
  reservations: ProductionReservation[],
): ProductionData {
  const days = new Map<string, ProductionDay>(),
    pace = new Map<
      string,
      { date: string; bookings: number; revenue: number }
    >(),
    statuses: Record<string, number> = {};
  let first = "",
    last = "";
  let expandedDays = 0;
  for (const r of reservations) {
    statuses[r.status] = (statuses[r.status] ?? 0) + 1;
    if (!first || r.arrival < first) first = r.arrival;
    if (!last || r.departure > last) last = r.departure;
    const n = (Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000;
    expandedDays += Math.max(1, n);
    if (expandedDays > 1000000)
      throw Error(
        "Source exceeds one million stay-day records. Split into complete arrival periods; no partial data imported.",
      );
    const complimentary =
      ["CMP", "HSE"].includes(r.source) ||
      ["CMP", "HSE"].includes(r.marketCode) ||
      ["COMP", "SYST"].includes(r.rateCode);
    const segment = complimentary
      ? r.source === "HSE" || r.marketCode === "HSE"
        ? "House Use"
        : "Complimentary"
      : bookingSegment(r.marketCode) === "Unmapped segment"
        ? `Unclassified: ${r.marketCode}`
        : bookingSegment(r.marketCode);
    for (let i = 0; i < Math.max(1, n); i++) {
      const d = new Date(Date.parse(r.arrival) + i * 86400000)
        .toISOString()
        .slice(0, 10);
      const key = JSON.stringify([
        d,
        r.status,
        r.country,
        r.room,
        r.meal,
        segment,
        r.source,
        r.agent,
        r.marketCode,
        r.confirmed,
        r.cancelledOn,
      ]);
      let day = days.get(key);
      if (!day) {
        day = {
          date: d,
          status: r.status,
          country: r.country,
          room: r.room,
          meal: r.meal,
          segment,
          source: r.source,
          agent: r.agent,
          marketCode: r.marketCode,
          confirmed: r.confirmed,
          cancelledOn: r.cancelledOn,
          complimentary,
          nights: 0,
          revenue: 0,
          missingRevenue: 0,
          arrivals: 0,
        };
        days.set(key, day);
      }
      day.nights += n > 0 ? (r.quantity ?? 1) : 0;
      day.revenue += (r.revenue ?? 0) / Math.max(1, n);
      day.missingRevenue += r.revenue === null ? 1 : 0;
      if (i === 0) day.arrivals++;
    }
    if (r.confirmed) {
      const p = pace.get(r.confirmed) ?? {
        date: r.confirmed,
        bookings: 0,
        revenue: 0,
      };
      p.bookings++;
      p.revenue += r.revenue ?? 0;
      pace.set(r.confirmed, p);
    }
  }
  const arrivalDates = reservations.map((r) => r.arrival).sort();
  return {
    schema: 2,
    reservations,
    statuses,
    coverage: arrivalDates.length
      ? [{ from: arrivalDates[0], to: arrivalDates[arrivalDates.length - 1] }]
      : [],
    from: first,
    to: last,
    rows: reservations.length,
    checkedOut: statuses["CHECKED OUT"] ?? 0,
    cancelled: statuses.CANCELLED ?? 0,
    missingRevenue: reservations.filter((r) => r.revenue === null).length,
    warnings: [
      "Every source status/code is retained. Unknown segment and geography codes remain unclassified until mapped.",
      "Stay dates include arrival and exclude departure. Monthly/quarterly/year reporting follows each stay night, including cross-year stays.",
      "Stay revenue is allocated evenly across nights because daily rates are not supplied; it is not verified daily PMS actuals.",
      "Missing room quantities use one reservation unit; room occupancy cannot be verified.",
      "Non-stayed statuses (cancelled, no show, future/unknown) retain potential booked value, not realized revenue.",
      "Booking/cancellation date reports use their event dates, not stay dates; missing event dates are excluded and disclosed.",
      "A final export supports booking/cancellation timing but cannot reconstruct past modifications or verified historical on-books snapshots.",
    ],
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    pace: [...pace.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
export type ProductionBasis = "stay" | "booking" | "cancellation";
export function productionRowsForBasis(
  data: ProductionData,
  basis: ProductionBasis,
): { rows: ProductionDay[]; missingDates: number } {
  if (basis === "stay") return { rows: data.days, missingDates: 0 };
  if (!data.reservations) return { rows: [], missingDates: data.rows };
  let missingDates = 0;
  const rows: ProductionDay[] = [];
  for (const r of data.reservations) {
    if (basis === "cancellation" && r.status !== "CANCELLED") continue;
    const d = basis === "booking" ? r.confirmed : r.cancelledOn;
    if (!d) {
      missingDates++;
      continue;
    }
    const n = (Date.parse(r.departure) - Date.parse(r.arrival)) / 86400000;
    const comp =
      ["CMP", "HSE"].includes(r.source) ||
      ["CMP", "HSE"].includes(r.marketCode) ||
      ["COMP", "SYST"].includes(r.rateCode);
    rows.push({
      date: d,
      status: r.status,
      country: r.country,
      room: r.room,
      meal: r.meal,
      source: r.source,
      agent: r.agent,
      marketCode: r.marketCode,
      confirmed: r.confirmed,
      cancelledOn: r.cancelledOn,
      segment: comp
        ? r.source === "HSE" || r.marketCode === "HSE"
          ? "House Use"
          : "Complimentary"
        : bookingSegment(r.marketCode) === "Unmapped segment"
          ? `Unclassified: ${r.marketCode}`
          : bookingSegment(r.marketCode),
      complimentary: comp,
      nights: n * (r.quantity ?? 1),
      revenue: r.revenue ?? 0,
      missingRevenue: r.revenue === null ? 1 : 0,
      arrivals: 1,
    });
  }
  return { rows, missingDates };
}
export function sanitizeProductionReservations(
  raw: unknown,
): ProductionReservation[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 50000)
    throw Error("Expected up to 50,000 reservations");
  const cleanText = (v: unknown, max = 100) => {
    if (
      typeof v !== "string" ||
      !v.trim() ||
      v.length > max ||
      /[\x00-\x1f]/.test(v)
    )
      throw Error("Invalid code or agent");
    return v.trim();
  };
  const cleanDate = (v: unknown, optional = false) => {
    if (optional && v === "") return "";
    if (
      typeof v !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(v) ||
      !Number.isFinite(Date.parse(v)) ||
      new Date(v).toISOString().slice(0, 10) !== v
    )
      throw Error("Invalid date");
    return v;
  };
  return raw.map((v) => {
    const arrival = cleanDate(v.arrival),
      departure = cleanDate(v.departure),
      n = (Date.parse(departure) - Date.parse(arrival)) / 86400000;
    if (n < 0 || n > 730) throw Error("Invalid stay");
    if (
      v.revenue !== null &&
      (typeof v.revenue !== "number" ||
        !Number.isFinite(v.revenue) ||
        Math.abs(v.revenue) > 1e12)
    )
      throw Error("Invalid revenue");
    if (
      v.quantity !== null &&
      (!Number.isInteger(v.quantity) || v.quantity <= 0 || v.quantity > 1000)
    )
      throw Error("Invalid room quantity");
    return {
      arrival,
      departure,
      confirmed: cleanDate(v.confirmed, true),
      cancelledOn: cleanDate(v.cancelledOn, true),
      status: normalizeStatus(v.status),
      country: cleanText(v.country),
      room: cleanText(v.room),
      meal: cleanText(v.meal),
      source: cleanText(v.source),
      agent: cleanText(v.agent, 160),
      marketCode: cleanText(v.marketCode),
      rateCode: cleanText(v.rateCode),
      revenue: v.revenue,
      quantity: v.quantity,
    };
  });
}
