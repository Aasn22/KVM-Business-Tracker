import { parseDate } from "./operational";
import {
  cleanPerformanceImport,
  type PerformanceImport,
  type PerformanceRow,
  type SourceKind,
  type SourceDimension,
} from "./performanceSources";
export type StatCell = { x: number; y: number; t: string };
export type StatPage = { width: number; items: StatCell[] };
const metricLabels: Record<string, keyof PerformanceRow> = {
  "No. of Rms.": "rooms",
  "Room Rev.": "roomRevenue",
  "F&B Rev.": "foodRevenue",
  "Misc Rev.": "otherRevenue",
  "No. of Guests": "guests",
  "% Occ.": "reportedOccupancy",
  "%Occ.": "reportedOccupancy",
  ADR: "reportedADR",
};
function numeric(t: string) {
  const v = Number(t.replaceAll(",", "").replace(/\s/g, ""));
  if (!t.trim() || !Number.isFinite(v))
    throw Error("Unreadable numeric source cell");
  return v;
}
export function parseStatPages(
  pages: StatPage[],
  kind: SourceKind,
  dimension: SourceDimension,
  from: string,
  to: string,
) {
  const rows: PerformanceRow[] = [],
    totals = new Map<string, { rooms: number; roomRevenue: number }>();
  let asOf = "";
  for (const page of pages) {
    const c = page.items,
      text = c.map((i) => i.t).join(" ");
    if (
      Math.abs(page.width - 792) > 15 ||
      !text.includes(
        kind === "history" ? "Reservation Statistics" : "Reservation Forecast",
      ) ||
      !text.includes(
        `Option ${dimension === "market" ? "Market" : dimension === "room" ? "Room Type" : "Country"} All`,
      )
    )
      throw Error("Wrong source type/dimension or unsupported layout");
    const sourceFrom = /From Date (\d{2}-\d{2}-\d{2})/.exec(text)?.[1],
      sourceTo = /To Date (\d{2}-\d{2}-\d{2})/.exec(text)?.[1];
    if (
      !sourceFrom ||
      !sourceTo ||
      parseDate(sourceFrom) !== from ||
      parseDate(sourceTo) !== to
    )
      throw Error("Selected dates must exactly match PDF From/To filters");
    const stamp = c.find(
      (i) => i.y > 570 && i.x > 700 && /^\d{2}-\d{2}-\d{2}$/.test(i.t),
    );
    if (!stamp) throw Error("Source run date unavailable");
    asOf = parseDate(stamp.t);
    const headers = c
      .filter((i) => i.y > 510 && i.y < 520 && i.x > 100 && i.t !== "Day")
      .sort((a, b) => a.x - b.x);
    if (!headers.length) throw Error("Missing source column headers");
    const dates = c
      .filter(
        (i) =>
          i.x < 35 && i.y > 100 && i.y < 510 && /^\d{2}-\d{2}-\d{2}$/.test(i.t),
      )
      .sort((a, b) => b.y - a.y);
    for (let d = 0; d < dates.length; d++) {
      const day = dates[d],
        date = parseDate(day.t),
        lower = d + 1 < dates.length ? dates[d + 1].y : 100;
      const totalMarker = c.find(
        (i) => i.x < 35 && i.t === "Totals" && i.y < day.y && i.y > lower,
      );
      const bottom = totalMarker ? totalMarker.y + 3 : lower;
      const labels = c.filter(
        (i) =>
          i.x > 35 &&
          i.x < 105 &&
          i.y <= day.y + 2 &&
          i.y > bottom &&
          metricLabels[i.t],
      );
      const roomLabel = labels.find((l) => l.t === "No. of Rms.");
      if (!roomLabel) throw Error("Daily room count row missing");
      const roomCells = c
        .filter(
          (i) =>
            i.x > 105 &&
            Math.abs(i.y - roomLabel.y) < 2 &&
            /^-?\s*[\d,.]+$/.test(i.t),
        )
        .sort((a, b) => a.x - b.x);
      if (roomCells.length !== headers.length)
        throw Error("Column count mismatch; no values guessed");
      const values = headers.map(
        () =>
          ({
            rooms: undefined,
            roomRevenue: undefined,
            foodRevenue: kind === "forecast" ? null : undefined,
            otherRevenue: kind === "forecast" ? null : undefined,
            guests: undefined,
            reportedOccupancy: null,
            reportedADR: null,
          }) as unknown as PerformanceRow,
      );
      for (const label of labels) {
        const cells = c.filter(
          (i) =>
            i.x > 100 &&
            Math.abs(i.y - label.y) < 2 &&
            /^-?\s*[\d,.]+$/.test(i.t),
        );
        if (cells.length !== headers.length)
          throw Error(`Numeric count mismatch in ${label.t}`);
        // right alignment varies by digit count, but source columns are separated ~58pt.
        const ordered = cells.sort((a, b) => a.x - b.x);
        ordered.forEach((v, i) => {
          (values[i] as unknown as Record<string, unknown>)[
            metricLabels[label.t]
          ] = numeric(v.t);
        });
      }
      headers.forEach((h, i) => {
        const val = { ...values[i], date, code: h.t };
        if (h.t === "Total") {
          if (
            totals.has(date) &&
            Math.abs(totals.get(date)!.roomRevenue - val.roomRevenue) > 0.05
          )
            throw Error("Conflicting daily report totals");
          totals.set(date, { rooms: val.rooms, roomRevenue: val.roomRevenue });
        } else rows.push(val);
      });
    }
  }
  if (!rows.length) throw Error("No daily data extracted");
  const dateSet = new Set(rows.map((r) => r.date));
  for (const date of dateSet) {
    const t = totals.get(date);
    if (!t) throw Error("Daily Total column missing");
    const day = rows.filter((r) => r.date === date);
    if (
      day.reduce((s, r) => s + r.rooms, 0) !== t.rooms ||
      Math.abs(day.reduce((s, r) => s + r.roomRevenue, 0) - t.roomRevenue) >
        Math.max(0.15, day.length * 0.011)
    )
      throw Error(`Daily source reconciliation failed on ${date}`);
  }
  const expected =
    Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (dateSet.size !== expected) throw Error("Incomplete daily date coverage");
  return { rows, asOf };
}
export async function parsePerformanceFile(
  file: File,
  kind: SourceKind,
  dimension: SourceDimension,
  from: string,
  to: string,
): Promise<PerformanceImport> {
  if (
    file.size > 30 * 1024 * 1024 ||
    file.size === 0 ||
    !file.name.toLowerCase().endsWith(".pdf")
  )
    throw Error(
      "Use a selectable-text Opera PDF up to 30 MB in the supplied layout",
    );
  if (kind === "forecast" && dimension === "room")
    throw Error(
      "Room-type forecast layout awaits the missing sample; no data inferred",
    );
  const bytes = new Uint8Array(await file.arrayBuffer()),
    id = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice())),
    )
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
  const pdf = await import("pdfjs-dist");
  pdf.GlobalWorkerOptions.workerSrc = (
    await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
  ).default;
  const doc = await pdf.getDocument({
    data: bytes,
    isEvalSupported: false,
    useSystemFonts: true,
  }).promise;
  try {
    if (doc.numPages > 250) throw Error("PDF exceeds 250 pages");
    const pages: StatPage[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i),
        t = await p.getTextContent();
      pages.push({
        width: p.getViewport({ scale: 1 }).width,
        items: t.items
          .filter((x) => "str" in x)
          .map((x) => {
            const c = x as { str: string; transform: number[] };
            return { x: c.transform[4], y: c.transform[5], t: c.str.trim() };
          })
          .filter((x) => x.t),
      });
    }
    return cleanPerformanceImport({
      id,
      kind,
      dimension,
      from,
      to,
      ...parseStatPages(pages, kind, dimension, from, to),
    });
  } finally {
    await doc.destroy();
  }
}
