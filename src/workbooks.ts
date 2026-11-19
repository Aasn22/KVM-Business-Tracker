import {
  blank,
  months,
  validData,
  reportRows,
  markets,
  type Entry,
  type Row,
} from "./model";
import type { Cell, Worksheet } from "exceljs";
function text(cell: Cell): string {
  const v = cell.value;
  if (v && typeof v === "object" && "richText" in v)
    return v.richText.map((x) => x.text).join("");
  if (v && typeof v === "object" && "result" in v)
    return String(v.result ?? "");
  return String(v ?? "").trim();
}
function number(sheet: Worksheet, address: string) {
  const cell = sheet.getCell(address);
  let v = cell.value;
  if (v && typeof v === "object" && ("formula" in v || "sharedFormula" in v)) {
    if (typeof cell.result !== "number")
      throw Error(
        `Missing numeric formula result in ${sheet.name}!${address}. Recalculate and save in Excel.`,
      );
    v = cell.result!;
  }
  if (v === null || v === "") return 0;
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0)
    throw Error(
      `Invalid or uncalculated number in ${sheet.name}!${address}. Recalculate and save the workbook in Excel.`,
    );
  return v;
}
function readRow(sheet: Worksheet, n: number): Row {
  return {
    label: text(sheet.getCell(`A${n}`)),
    budget: number(sheet, `B${n}`),
    bob: number(sheet, `C${n}`),
    targets: ["D", "F", "H", "J"].map((c) => number(sheet, `${c}${n}`)),
    weekly: ["E", "G", "I", "K"].map((c) => number(sheet, `${c}${n}`)),
  };
}
export async function importWorkbook(
  file: File,
  market: string,
  year: number,
  existing: Entry[],
): Promise<Entry[]> {
  if (file.size > 10 * 1024 * 1024)
    throw Error("Please use an Excel workbook under 10 MB.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const aliases: Record<string, string[]> = {
    europe: ["EUROPE"],
    asia: ["ASIA"],
    america: ["AMERICA", "AMERICAS", "AMERICAS / OTHERS"],
    russia: ["RUSSIA CIS", "RUSSIA / CIS", "RUSSIA-CIS", "RUSSIA"],
    "middle-east": ["MIDDLE EAST"],
  };
  const entries: Entry[] = [];
  for (let i = 0; i < 12; i++) {
    const sheet = workbook.worksheets.find(
      (s) => s.name.toUpperCase() === months[i].slice(0, 3).toUpperCase(),
    );
    if (!sheet)
      throw Error(
        `Missing ${months[i].slice(0, 3).toUpperCase()} sheet. Use a market workbook, not FULL BUDGET.`,
      );
    if (!aliases[market]?.includes(text(sheet.getCell("B4")).toUpperCase()))
      throw Error(
        `${sheet.name}: the workbook market does not match the selected market.`,
      );
    const heading = text(sheet.getCell("A1"));
    if (!heading.includes(String(year)))
      throw Error(
        `Workbook year does not match ${year}. Select the correct year before importing.`,
      );
    const d = blank(market);
    d.commercial = [readRow(sheet, 8), readRow(sheet, 9)];
    d.villas = [];
    d.countries = [];
    d.meals = [];
    let section: "" | "villas" | "countries" | "meals" = "";
    for (let r = 11; r <= Math.min(sheet.rowCount, 120); r++) {
      const label = text(sheet.getCell(`A${r}`));
      if (/^2\./.test(label)) {
        section = "villas";
        continue;
      }
      if (/^3\./.test(label)) {
        section = "countries";
        continue;
      }
      if (/^4\./.test(label)) {
        section = "meals";
        continue;
      }
      if (/^5\./.test(label)) break;
      if (
        section &&
        label &&
        !/^(total|villa category|meal plan|country)/i.test(label)
      )
        d[section].push(readRow(sheet, r));
    }
    d.notes =
      existing.find((e) => e.market_id === market && e.month === i + 1)?.data
        .notes ?? "";
    if (!validData(d)) throw Error(`Unsupported data in ${sheet.name}.`);
    entries.push({
      market_id: market,
      year,
      month: i + 1,
      data: d,
      version:
        existing.find((e) => e.market_id === market && e.month === i + 1)
          ?.version ?? 0,
    });
  }
  return entries;
}
export async function exportWorkbook(entries: Entry[], name: string) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Performance");
  const rows = reportRows(entries);
  if (rows.length) {
    sheet.addRow(Object.keys(rows[0]));
    rows.forEach((r) => sheet.addRow(Object.values(r)));
  }
  const detail = workbook.addWorksheet("Breakdowns");
  detail.addRow([
    "Market",
    "Year",
    "Month",
    "Section",
    "Metric",
    "Budget",
    "BOB",
    "W1 Target",
    "W1 BOB",
    "W2 Target",
    "W2 BOB",
    "W3 Target",
    "W3 BOB",
    "W4/5 Target",
    "W4/5 BOB",
  ]);
  entries.forEach((e) =>
    (["commercial", "villas", "countries", "meals"] as const).forEach((k) =>
      e.data[k].forEach((r) =>
        detail.addRow([
          markets.find((m) => m.id === e.market_id)?.name,
          e.year,
          months[e.month - 1],
          k,
          r.label,
          r.budget,
          r.bob,
          ...r.targets.flatMap((v, i) => [v, r.weekly[i]]),
        ]),
      ),
    ),
  );
  for (const s of [sheet, detail]) {
    s.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    s.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF123C3E" },
    };
    s.columns.forEach((c) => {
      c.width = 23;
    });
    s.views = [{ state: "frozen", ySplit: 1 }];
    s.autoFilter = { from: "A1", to: { row: 1, column: s.columnCount } };
  }
  const blob = new Blob([await workbook.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".xlsx";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
