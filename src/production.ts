import { geographicMarket, bookingSegment } from "./performanceSources.js";
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
};
export type ProductionData = {
  schema: 1;
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
  const days = new Map<string, ProductionDay>(),
    pace = new Map<
      string,
      { date: string; bookings: number; revenue: number }
    >();
  let checkedOut = 0,
    cancelled = 0,
    missingRevenue = 0,
    total = 0;
  const unknownStatuses = new Set<string>();
  let first = "",
    last = "";
  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (row.every((v) => v === null || v === undefined || v === "")) continue;
    const get = (name: string) => row[index(name)];
    const status = text(get("Reservation Status"));
    if (!["CHECKED OUT", "CANCELLED"].includes(status)) {
      unknownStatuses.add(status || "blank");
      continue;
    }
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
    if (revenue === null) missingRevenue++;
    const country = text(get("Country")) || "UNSPECIFIED",
      room = text(get("Room Type")) || "UNSPECIFIED",
      meal = text(get("Meal Plan")) || "UNSPECIFIED";
    for (const code of [country, room, meal, source, market, rate])
      if (code && !/^[A-Z0-9_-]{1,32}$/.test(code))
        throw Error(
          `Row ${i + 2}: expected code fields, not descriptions or private names.`,
        );
    const segment = complimentary
      ? source === "HSE" || market === "HSE"
        ? "House Use"
        : "Complimentary"
      : bookingSegment(market);
    total++;
    if (status === "CHECKED OUT") checkedOut++;
    else cancelled++;
    if (!first || arrival < first) first = arrival;
    if (!last || departure > last) last = departure;
    for (let j = 0; j < Math.max(1, n); j++) {
      const d = new Date(Date.parse(arrival) + j * 86400000)
        .toISOString()
        .slice(0, 10);
      const key = [d, status, country, room, meal, segment, complimentary].join(
        "|",
      );
      let r = days.get(key);
      if (!r) {
        r = {
          date: d,
          status,
          country,
          room,
          meal,
          segment,
          complimentary,
          nights: 0,
          revenue: 0,
          missingRevenue: 0,
          arrivals: 0,
        };
        days.set(key, r);
        if (days.size > 15000)
          throw Error(
            "Analytical snapshot exceeds 15,000 date/code combinations. Use a smaller complete cohort.",
          );
      }
      r.nights += n > 0 ? 1 : 0;
      r.revenue += n > 0 ? (revenue ?? 0) / n : (revenue ?? 0);
      r.missingRevenue += revenue === null ? 1 : 0;
      if (j === 0) r.arrivals++;
    }
    if (confirmed && status === "CHECKED OUT") {
      const p = pace.get(confirmed) ?? {
        date: confirmed,
        bookings: 0,
        revenue: 0,
      };
      p.bookings++;
      p.revenue += revenue ?? 0;
      pace.set(confirmed, p);
    }
  }
  if (unknownStatuses.size)
    throw Error(
      `Unsupported reservation status: ${[...unknownStatuses].join(", ")}. Use this history sheet with CHECKED OUT / CANCELLED only.`,
    );
  if (!total) throw Error("No valid reservation rows found.");
  return {
    schema: 1,
    from: first,
    to: last,
    rows: total,
    checkedOut,
    cancelled,
    missingRevenue,
    warnings: [
      "Arrival-cohort export, not complete occupancy: stays arriving before the source start may be missing.",
      "One record counted as one reservation; no room quantity or unique booking reference supplied.",
      "Daily revenue is stay revenue allocated evenly across arrival-inclusive, departure-exclusive dates; not daily PMS actuals.",
      "Cancelled revenue is potential cancelled stay value, not posted revenue or a cash loss.",
      ...(missingRevenue
        ? [
            `${missingRevenue} record(s) have unknown revenue and are excluded from revenue totals, not treated as verified zero.`,
          ]
        : []),
    ],
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    pace: [...pace.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
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
  if (sheet.rowCount > 20000) throw Error("Maximum 20,000 rows per file.");
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
  dimension: "country" | "room" | "meal" | "segment" = "country",
  status = "CHECKED OUT",
) {
  const rows = data.days.filter(
    (r) =>
      r.date >= from &&
      r.date <= to &&
      r.status === status &&
      (!market || geographicMarket(r.country) === market),
  );
  const groups = new Map<
    string,
    { code: string; nights: number; revenue: number; arrivals: number }
  >();
  for (const r of rows) {
    const code = r[dimension];
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
