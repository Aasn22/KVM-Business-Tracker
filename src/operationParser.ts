import {
  sanitizeOperation,
  validateBatch,
  type OperationKind,
  type OperationRow,
} from "./operational";
export type PdfCell = { x: number; y: number; text: string };
function slice(
  cells: PdfCell[],
  y: number,
  min: number,
  max: number,
  below = 2,
) {
  return cells
    .filter((c) => c.x >= min && c.x < max && c.y <= y + 2 && c.y >= y - below)
    .sort((a, b) => b.y - a.y || a.x - b.x)
    .map((c) => c.text)
    .join(" ")
    .trim();
}
export function parseOperaPage(
  cells: PdfCell[],
  kind: OperationKind,
): OperationRow[] {
  const text = cells.map((c) => c.text).join(" ");
  if (
    !text.includes(
      kind === "reservations"
        ? "Reservation Entered"
        : "Reservation Cancellations",
    )
  )
    throw Error("PDF does not match selected report type.");
  // Match the supplied landscape Opera layout; refuse unknown columns rather than guessing.
  const arrivals = cells
    .filter(
      (c) =>
        c.x > (kind === "reservations" ? 255 : 290) &&
        c.x < (kind === "reservations" ? 275 : 315) &&
        /^\d{2}-\d{2}-\d{2}$/.test(c.text.trim()) &&
        c.y < 495 &&
        c.y > 75,
    )
    .sort((a, b) => b.y - a.y);
  if (!arrivals.length)
    throw Error(
      "Unsupported PDF layout or no selectable report rows. Scanned PDFs require a structured CSV/Excel export.",
    );
  return arrivals.map((a, i) => {
    const y = a.y;
    const below = Math.min(
      kind === "reservations" ? 15 : 20,
      i + 1 < arrivals.length ? y - arrivals[i + 1].y - 3 : 20,
    );
    const v = (min: number, max: number, b = 2) => slice(cells, y, min, max, b);
    const raw =
      kind === "reservations"
        ? {
            roomType: v(25, 51),
            company: v(185, 255, below),
            arrival: a.text,
            departure: v(297, 337),
            nights: v(374, 392),
            mealPlan: v(392, 412),
            nationality: v(413, 444),
            country: v(444, 475),
            rateCode: v(520, 559),
            reservationType: v(560, 610, below),
            amount: v(615, 672),
            eventDate: v(678, 718),
          }
        : {
            roomType: v(260, 290),
            arrival: a.text,
            leadTime: v(343, 373),
            nights: v(403, 421),
            marketCode: v(421, 450),
            rateCode: v(450, 520),
            amount: v(570, 645),
            eventDate: v(103, 146, below),
          };
    return sanitizeOperation(raw, kind);
  });
}
export function reconcilePdfTotals(
  pages: PdfCell[][],
  rows: OperationRow[],
  kind: OperationKind,
) {
  const cells = pages.at(-1) ?? [];
  const totalCell = cells.find((c) =>
    c.text.includes(
      kind === "reservations" ? "REPORT TOTAL SUM" : "Grand Total",
    ),
  );
  const total =
    totalCell &&
    cells.find(
      (c) =>
        c.x > (kind === "reservations" ? 590 : 570) &&
        c.x < 645 &&
        Math.abs(c.y - totalCell.y) < 4 &&
        /^\d[\d,.]*$/.test(c.text),
    );
  if (!total)
    throw Error(
      "Report total could not be verified. Use CSV/Excel or the supported Opera report layout.",
    );
  if (
    Math.abs(
      rows.reduce((sum, r) => sum + r.amount, 0) -
        Number(total.text.replaceAll(",", "")),
    ) > 0.02
  )
    throw Error(
      "Parsed revenue does not reconcile to PDF total. No data saved.",
    );
  if (kind === "cancellations" && totalCell) {
    const count = cells.find(
      (c) =>
        c.x > 375 &&
        c.x < 400 &&
        Math.abs(c.y - totalCell.y) < 4 &&
        /^\d+$/.test(c.text),
    );
    const nights = cells.find(
      (c) =>
        c.x > 403 &&
        c.x < 421 &&
        Math.abs(c.y - totalCell.y) < 4 &&
        /^\d+$/.test(c.text),
    );
    if (
      !count ||
      !nights ||
      Number(count.text) !== rows.length ||
      Number(nights.text) !== rows.reduce((sum, r) => sum + r.nights, 0)
    )
      throw Error(
        "Cancellation row/night totals do not reconcile. No data saved.",
      );
  }
}
const key = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
const aliases: Record<string, string[]> = {
  roomType: ["roomtype", "villatype"],
  arrival: ["arrivaldate", "arrdate", "arrival"],
  departure: ["departuredate", "depdate", "departure"],
  nights: ["nights", "nts"],
  leadTime: ["leadtime"],
  marketCode: ["marketcode", "mktcode"],
  rateCode: ["ratecode"],
  company: ["companytravelagentsource", "company", "travelagent", "source"],
  mealPlan: ["mealplan", "mp"],
  nationality: ["nationality"],
  country: ["countrycode", "country"],
  reservationType: ["reservationtype", "resvtype"],
  amount: [
    "amount",
    "revenueloss",
    "ttlrmrev",
    "totalroomrevenue",
    "roomrevenue",
  ],
  eventDate: [
    "activitydate",
    "canceldate",
    "cancellationdate",
    "enteredon",
    "bookeddate",
  ],
};
export function parseTable(table: unknown[][], kind: OperationKind) {
  if (table.length < 2) throw Error("A header row and data rows are required.");
  const header = table[0].map((h) => key(String(h ?? "")));
  return table
    .slice(1)
    .filter((r) =>
      r.some((c) => c !== null && c !== undefined && String(c).trim()),
    )
    .map((r, i) => {
      const raw: Record<string, unknown> = {};
      for (const [field, names] of Object.entries(aliases)) {
        const col = header.findIndex((h) => names.includes(h));
        raw[field] = col < 0 ? "" : r[col];
      }
      try {
        return sanitizeOperation(raw, kind);
      } catch (e) {
        throw Error(`Row ${i + 2}: ${(e as Error).message}`);
      }
    });
}
export function parseDelimited(text: string): string[][] {
  const delimiter = text.split(/\r?\n/)[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) throw Error("Unclosed quoted CSV field.");
  row.push(cell);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
export async function parseOperationFile(
  file: File,
  kind: OperationKind,
  from: string,
  to: string,
) {
  if (file.size > 15 * 1024 * 1024 || file.size === 0)
    throw Error("Choose a report up to 15 MB.");
  const ext = file.name.toLowerCase().split(".").pop();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice())),
  )
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  let rows: OperationRow[] = [];
  let warnings: string[] = [];
  if (ext === "pdf") {
    const pdf = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url"))
      .default;
    pdf.GlobalWorkerOptions.workerSrc = worker;
    const doc = await pdf.getDocument({
      data: bytes.slice(),
      isEvalSupported: false,
      useSystemFonts: true,
    }).promise;
    try {
      if (doc.numPages > 100) throw Error("PDF exceeds 100-page limit.");
      const pages: PdfCell[][] = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const viewport = page.getViewport({ scale: 1 });
        if (Math.abs(viewport.width - 792) > 15)
          throw Error(
            "Unsupported PDF page dimensions. Use the supplied Opera landscape layout or CSV/Excel.",
          );
        const content = await page.getTextContent();
        const cells = content.items
          .filter((i) => "str" in i)
          .map((i) => {
            const c = i as { str: string; transform: number[] };
            return { x: c.transform[4], y: c.transform[5], text: c.str.trim() };
          })
          .filter((c) => c.text);
        rows.push(...parseOperaPage(cells, kind));
        pages.push(cells);
      }
      reconcilePdfTotals(pages, rows, kind);
    } finally {
      await doc.destroy();
    }
    warnings.push(
      "PDF row/column extraction must be reviewed before saving. Unsupported layouts are rejected. No OCR for scans.",
    );
  } else if (ext === "xlsx") {
    const { default: ExcelJS } = await import("exceljs");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(bytes.buffer);
    if (book.worksheets.length !== 1)
      throw Error("Use one worksheet per operational report.");
    const table: unknown[][] = [];
    book.worksheets[0].eachRow((r) => {
      table.push(
        (r.values as unknown[])
          .slice(1)
          .map((v) =>
            typeof v === "object" && v !== null
              ? "result" in v
                ? (v as { result: unknown }).result
                : "text" in v
                  ? (v as { text: unknown }).text
                  : ""
              : v,
          ),
      );
    });
    rows = parseTable(table, kind);
  } else if (ext === "csv" || ext === "txt")
    rows = parseTable(parseDelimited(new TextDecoder().decode(bytes)), kind);
  else
    throw Error(
      "Supported files: selectable PDF, CSV, tab/comma-delimited TXT and XLSX. Export legacy XLS/other spreadsheets to XLSX or CSV.",
    );
  validateBatch(kind, rows, from, to);
  warnings.push(
    "Saved locally only; no updates to BOB, market totals, budgets or shared database.",
    "Overlapping activity-date ranges cannot be imported twice.",
  );
  return { id: hash, kind, from, to, rows, warnings };
}
