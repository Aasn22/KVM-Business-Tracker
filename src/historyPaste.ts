import {
  cleanHistory,
  historyFields,
  type HistoryYear,
  type HistoryField,
} from "./history";
import { months } from "./model";
export const historyDisplayFields = [
  "budgetNights",
  "actualNights",
  "budgetRoomRevenue",
  "actualRoomRevenue",
  "budgetADR",
  "actualADR",
  "budgetTotalRevenue",
  "actualTotalRevenue",
] as const;
export function historyInputValue(
  text: string,
  field: HistoryField,
): number | null {
  const s = text
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (s === "" || s === "—" || s === "-") return null;
  const cleaned = s
    .replace(/^\$\s*/, "")
    .replace(/,/g, "")
    .replace(/\u00a0/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(cleaned))
    throw Error(
      "Use non-negative numbers only; formulas and text are not accepted.",
    );
  const n = Number(cleaned);
  if (
    !Number.isFinite(n) ||
    n > 1e12 ||
    (/Nights$/.test(field) && !Number.isSafeInteger(n))
  )
    throw Error(
      "Value too large or invalid. Maximum 1,000,000,000,000; room nights must be whole numbers.",
    );
  return n;
}
export function pasteHistory(
  data: HistoryYear,
  startRow: number,
  startField: HistoryField,
  text: string,
): HistoryYear {
  if (text.length > 30000) throw Error("Paste up to 12 monthly rows only.");
  let rows = text.replace(/\r\n?/g, "\n").split("\n");
  while (rows.length && rows[rows.length - 1] === "") rows.pop();
  let cells = rows.map((r) => r.split("\t"));
  if (!cells.length) throw Error("Clipboard has no data.");
  // Optional full table header and TOTAL footer from Excel.
  if (/^(month|budgeted room nights)$/i.test(cells[0][0]?.trim()))
    cells = cells.slice(1);
  cells = cells.filter(
    (r, i) => !(i === cells.length - 1 && /^total(?:\s|$)/i.test(r[0]?.trim())),
  );
  const hasMonths = cells.some((r) =>
    months.some((m) => m.toLowerCase() === r[0]?.trim().toLowerCase()),
  );
  const count = Math.max(
    ...cells.map((r) => (hasMonths ? r.length - 1 : r.length)),
  );
  const extendedDisplay = [
    ...historyDisplayFields,
    "actualFoodRevenue",
    "actualOtherRevenue",
    "budgetOccupancy",
    "actualOccupancy",
  ] as const;
  const columns =
    count >= 10 ||
    startField === "actualFoodRevenue" ||
    startField === "actualOtherRevenue"
      ? extendedDisplay
      : count > 6
        ? historyDisplayFields
        : historyFields.slice(0, 6);

  const start = hasMonths
    ? 0
    : (columns as readonly string[]).indexOf(startField);
  if (start < 0) throw Error("Select an editable numeric cell.");
  const next = structuredClone(data);
  const used = new Set<number>();
  cells.forEach((r, i) => {
    let row = startRow + i,
      values = r;
    if (hasMonths) {
      row = months.findIndex(
        (m) => m.toLowerCase() === r[0]?.trim().toLowerCase(),
      );
      if (row < 0) throw Error("Month names must be January–December.");
      values = r.slice(1);
    }
    if (row < 0 || row >= 12 || used.has(row))
      throw Error("Paste exceeds December or includes a duplicate month.");
    used.add(row);
    if (start + values.length > columns.length)
      throw Error(
        "Too many columns. Paste six input columns, or all eight columns including calculated ADR.",
      );
    if (next.months[row].notOpened) {
      if (
        values.some(
          (v) => v.trim() !== "" && v.trim() !== "—" && v.trim() !== "-",
        )
      )
        throw Error(
          `${months[row]} is marked not opened. Paste opening-year financial values from June onward, or include blank January–May cells.`,
        );
      return;
    }
    values.forEach((v, j) => {
      const field = columns[start + j];
      if (
        field === "budgetADR" ||
        field === "actualADR" ||
        field === "budgetOccupancy" ||
        field === "actualOccupancy"
      )
        return;
      next.months[row][field] = historyInputValue(v, field);
    });
  });
  return cleanHistory(next);
}
