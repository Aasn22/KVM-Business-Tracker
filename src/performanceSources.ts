import { parseDate } from "./operational";
export const sourceKinds = ["history", "forecast"] as const;
export const dimensions = ["market", "room", "country"] as const;
export type SourceKind = (typeof sourceKinds)[number];
export type SourceDimension = (typeof dimensions)[number];
export type PerformanceRow = {
  date: string;
  code: string;
  rooms: number;
  roomRevenue: number;
  foodRevenue: number | null;
  otherRevenue: number | null;
  guests: number;
  reportedOccupancy: number | null;
  reportedADR: number | null;
};
export type PerformanceImport = {
  id: string;
  kind: SourceKind;
  dimension: SourceDimension;
  from: string;
  to: string;
  asOf: string;
  rows: PerformanceRow[];
};
export const segmentCodes: Record<string, string> = {
  ADV: "Retail",
  BAR: "Retail",
  PKG: "Retail",
  PRO: "Retail",
  DAY: "Retail",
  OTA: "Retail",
  RET: "Retail",
  ITO: "Wholesale",
  LTO: "Wholesale",
  GRP: "Wholesale",
  CMP: "Complimentary",
  CGR: "Corporate",
  COR: "Corporate",
  HOB: "Corporate",
  DNG: "Discount",
  FNF: "Discount",
  WPH: "Discount",
  MIC: "Events",
  HSE: "House Use",
  SYS: "System Use",
};
export function bookingSegment(code: string) {
  return segmentCodes[code.toUpperCase()] ?? "Unmapped segment";
}
// Explicit, reviewable operational grouping; unknown/transcontinental codes stay unmapped.
const countryGroups: Record<string, string> = {
  asia: "AF BD BT BN KH CN HK IN ID JP KP KR LA MO MY MV MN MM NP PK PH SG LK TW TH TL VN",
  america:
    "US CA MX AR BO BR CL CO EC GY PY PE SR UY VE BZ CR SV GT HN NI PA BS BB CU DM DO GD HT JM KN LC VC TT PR",
  russia: "RU BY KZ KG TJ TM UZ AM AZ MD",
  europe:
    "AD AL AT BE BG BA HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MC ME NL MK NO PL PT RO SM RS SK SI ES SE CH GB VA UA",
  "middle-east": "BH EG IR IQ IL JO KW LB OM PS QA SA SY AE YE",
  "other-markets":
    "AU NZ FJ PG WS TO VU SB KI NR TV FM MH PW ZA KE TZ UG RW NG GH MA TN DZ LY SD SS ET SO MU SC MG ZM ZW BW NA MZ AO CM SN CI GA GM GN LR SL MW LS SZ",
};
export function geographicMarket(code: string): string | null {
  const c = code.toUpperCase();
  return (
    Object.entries(countryGroups).find(([, codes]) =>
      codes.split(" ").includes(c),
    )?.[0] ?? null
  );
}
export function cleanPerformanceRow(
  raw: Record<string, unknown>,
): PerformanceRow {
  const n = (key: string, nullable = false): number | null => {
    if (raw[key] === null && nullable) return null;
    const v = Number(raw[key]);
    if (
      raw[key] === undefined ||
      raw[key] === null ||
      raw[key] === "" ||
      !Number.isFinite(v) ||
      Math.abs(v) > 1e12
    )
      throw Error(`Invalid ${key}`);
    return v;
  };
  const code = String(raw.code ?? "").trim();
  if (code.toLowerCase() === "total" || !/^[A-Za-z0-9 _/-]{1,40}$/.test(code))
    throw Error("Invalid source code");
  const rooms = n("rooms")!,
    guests = n("guests")!;
  if (
    rooms < 0 ||
    guests < 0 ||
    !Number.isInteger(rooms) ||
    !Number.isInteger(guests)
  )
    throw Error("Invalid room/guest count");
  return {
    date: parseDate(String(raw.date)),
    code,
    rooms,
    guests,
    roomRevenue: n("roomRevenue")!,
    foodRevenue: n("foodRevenue", true),
    otherRevenue: n("otherRevenue", true),
    reportedOccupancy: n("reportedOccupancy", true),
    reportedADR: n("reportedADR", true),
  };
}
export function cleanPerformanceImport(
  raw: Record<string, unknown>,
): PerformanceImport {
  if (
    !sourceKinds.includes(raw.kind as SourceKind) ||
    !dimensions.includes(raw.dimension as SourceDimension) ||
    !Array.isArray(raw.rows) ||
    !raw.rows.length ||
    raw.rows.length > 100000
  )
    throw Error("Invalid performance source");
  const from = parseDate(String(raw.from)),
    to = parseDate(String(raw.to)),
    asOf = parseDate(String(raw.asOf));
  if (from > to) throw Error("Invalid date range");
  const seen = new Set<string>();
  const rows = raw.rows.map((r) => {
    const row = cleanPerformanceRow(r);
    if (row.date < from || row.date > to)
      throw Error("Row outside selected stay dates");
    const key = row.date + ":" + row.code;
    if (seen.has(key)) throw Error("Duplicate dated code in report");
    seen.add(key);
    return row;
  });
  const dayCount =
    Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (dayCount > 3660 || new Set(rows.map((r) => r.date)).size !== dayCount)
    throw Error("Incomplete source date coverage");
  if (typeof raw.id !== "string" || !/^[a-f0-9]{64}$/.test(raw.id))
    throw Error("Invalid file fingerprint");
  return {
    id: raw.id,
    kind: raw.kind as SourceKind,
    dimension: raw.dimension as SourceDimension,
    from,
    to,
    asOf,
    rows,
  };
}
export function summarizePerformance(rows: PerformanceRow[]) {
  const rooms = rows.reduce((s, r) => s + r.rooms, 0),
    revenue = rows.reduce((s, r) => s + r.roomRevenue, 0);
  return {
    rooms,
    revenue,
    adr: rooms > 0 ? revenue / rooms : null,
    food: rows.every((r) => r.foodRevenue !== null)
      ? rows.reduce((s, r) => s + r.foodRevenue!, 0)
      : null,
    other: rows.every((r) => r.otherRevenue !== null)
      ? rows.reduce((s, r) => s + r.otherRevenue!, 0)
      : null,
  };
}
export function replacePerformance(
  prior: PerformanceRow[],
  next: PerformanceRow[],
  from: string,
  to: string,
) {
  return [...prior.filter((r) => r.date < from || r.date > to), ...next];
}
