import { describe, it, expect, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Workbook } from "exceljs";
import {
  parseDate,
  sanitizeOperation,
  validateBatch,
  readOperations,
  saveOperationBatch,
  operationTotals,
  operationsKey,
  type OperationRow,
  type OperationBatch,
} from "./operational";
import {
  parseDelimited,
  parseTable,
  parseOperaPage,
  reconcilePdfTotals,
  parseOperationFile,
  type PdfCell,
} from "./operationParser";
import OperationalInput from "./OperationalInput";
import OperationalReports, { OperationTable } from "./OperationalReports";
import { quickReports } from "./quickReports";
const cancel: OperationRow = {
  roomType: "BVR",
  arrival: "2026-12-16",
  nights: 5,
  amount: 8200,
  eventDate: "2026-11-19",
  leadTime: 27,
  marketCode: "RET",
  rateCode: "TRIPBB",
};
const reservation: OperationRow = {
  roomType: "WVR",
  arrival: "2027-02-15",
  departure: "2027-02-17",
  nights: 2,
  amount: 1800,
  eventDate: "2026-11-19",
  rateCode: "CNHB01",
  company: "Example Agency",
  mealPlan: "HBS",
  nationality: "CN",
  country: "CN",
  reservationType: "DER",
};
const batch = (
  id = "one",
  kind: "cancellations" | "reservations" = "cancellations",
): OperationBatch => ({
  id,
  kind,
  from: "2026-11-19",
  to: "2026-11-19",
  savedAt: "2026-11-20T00:00:00Z",
  rows: [kind === "cancellations" ? cancel : reservation],
});
const storage = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
  };
};
afterEach(() => vi.unstubAllGlobals());
describe("separate operational activity imports", () => {
  it("validates exact calendar dates, required fields and date-window semantics", () => {
    expect(parseDate("19-11-26")).toBe("2026-11-19");
    expect(() => parseDate("31-02-26")).toThrow();
    expect(() =>
      validateBatch("cancellations", [cancel], "2026-11-20", "2026-11-20"),
    ).toThrow("outside");
    expect(() =>
      sanitizeOperation({ ...cancel, amount: -1 }, "cancellations"),
    ).toThrow();
    expect(() =>
      sanitizeOperation(
        { ...reservation, departure: "2027-02-14" },
        "reservations",
      ),
    ).toThrow();
    expect(
      sanitizeOperation(
        { ...reservation, nights: 0, departure: reservation.arrival },
        "reservations",
      ).nights,
    ).toBe(0);
  });
  it("stores only approved fields, no identity/contact/reference information", () => {
    const safe = sanitizeOperation(
      {
        ...reservation,
        guestName: "Do not retain",
        confirmation: "private-id",
        enteredBy: "private-staff",
        email: "private-email",
      },
      "reservations",
    );
    expect(safe).toEqual(reservation);
    expect(JSON.stringify(safe)).not.toContain("private");
    const c = sanitizeOperation(
      { ...cancel, country: "do not guess", guestName: "private" },
      "cancellations",
    );
    expect(c.country).toBeUndefined();
  });
  it("parses CSV and tab-delimited TXT with quoted agency names and ignores extra columns", () => {
    const csv =
      'Room Type,Arrival Date,Departure Date,Nights,Total Room Revenue,Entered On,Rate Code,Company,Meal Plan,Nationality,Country Code,Reservation Type,Name\nWVR,15-02-27,17-02-27,2,1800,19-11-26,CNHB01,"Example, Agency",HBS,CN,CN,DER,PRIVATE';
    const rows = parseTable(parseDelimited(csv), "reservations");
    expect(rows[0].company).toBe("Example, Agency");
    expect(JSON.stringify(rows)).not.toContain("PRIVATE");
    expect(parseDelimited('a\tb\n"c\td"\te')).toEqual([
      ["a", "b"],
      ["c\td", "e"],
    ]);
    expect(() => parseDelimited('a,b\n"broken')).toThrow("Unclosed");
  });
  it("refuses duplicate files and overlapping date ranges, allows different activity kinds", () => {
    const s = storage();
    saveOperationBatch(s, batch());
    expect(readOperations(s)).toHaveLength(1);
    expect(() => saveOperationBatch(s, batch())).toThrow("already");
    expect(() => saveOperationBatch(s, batch("two"))).toThrow("overlaps");
    saveOperationBatch(s, batch("three", "reservations"));
    expect(readOperations(s)).toHaveLength(2);
    expect(s.getItem("business-eye-local-2027")).toBeNull();
  });
  it("never silently replaces corrupt stored imports and keeps storage quota failures visible", () => {
    const s = storage();
    s.setItem(operationsKey, "bad");
    expect(() => saveOperationBatch(s, batch())).toThrow();
    expect(() =>
      saveOperationBatch(
        {
          getItem: () => null,
          setItem: () => {
            throw Error("quota");
          },
        },
        batch(),
      ),
    ).toThrow("quota");
  });
  it("does not interpret guest sharers as occupied room nights or all entries as confirmations", () => {
    const totals = operationTotals([
      reservation,
      { ...reservation, rateCode: "SHARER", amount: 0 },
    ]);
    expect(totals.amount).toBe(1800);
    expect(totals.rows).toBe(2);
    expect(totals.stayNights).toBe(2);
    expect(totals.sharers).toBe(1);
  });
  it("parses the approved PDF columns and reconciles totals without retaining excluded cells", () => {
    const c = (x: number, y: number, text: string): PdfCell => ({ x, y, text });
    const cells = [
      c(319, 546, "Reservation Cancellations"),
      c(22, 316, "PRIVATE NAME"),
      c(39, 303, "PRIVATE REF"),
      c(265, 316, "BVR"),
      c(295, 316, "16-12-26"),
      c(354, 316, "27"),
      c(414, 316, "5"),
      c(421.6, 316, "RET"),
      c(451, 316, "TRIPBB"),
      c(593, 316, "8,200.00"),
      c(107, 303, "19-11-26"),
      c(207, 303, "PRIVATE STAFF"),
      c(272, 123, "Grand Total"),
      c(382, 123, "1"),
      c(409, 123, "5"),
      c(595, 123, "8200"),
    ];
    const parsed = parseOperaPage(cells, "cancellations");
    expect(parsed).toEqual([cancel]);
    expect(JSON.stringify(parsed)).not.toContain("PRIVATE");
    expect(() =>
      reconcilePdfTotals([cells], parsed, "cancellations"),
    ).not.toThrow();
    expect(() =>
      reconcilePdfTotals([cells], [{ ...cancel, amount: 1 }], "cancellations"),
    ).toThrow("reconcile");
    expect(() => parseOperaPage([], "reservations")).toThrow("match");
  });
  it("handles structured XLSX and rejects unsupported files without reading server data", async () => {
    const w = new Workbook();
    const sheet = w.addWorksheet("Cancellation");
    sheet.addRow([
      "Room Type",
      "Arrival Date",
      "Lead Time",
      "Nights",
      "Market Code",
      "Rate Code",
      "Revenue Loss",
      "Cancel Date",
    ]);
    sheet.addRow(["BVR", "16-12-26", 27, 5, "RET", "TRIPBB", 8200, "19-11-26"]);
    const file = new File([await w.xlsx.writeBuffer()], "report.xlsx");
    const result = await parseOperationFile(
      file,
      "cancellations",
      "2026-11-19",
      "2026-11-19",
    );
    expect(result.rows).toEqual([cancel]);
    expect(result.id).toHaveLength(64);
    await expect(
      parseOperationFile(
        new File(["x"], "bad.xls"),
        "cancellations",
        "2026-11-19",
        "2026-11-19",
      ),
    ).rejects.toThrow("Supported");
  });
  it("renders paired input panels and operational report controls without altering BOB pages", () => {
    const html = renderToStaticMarkup(
      <OperationalInput onBusyChange={() => {}} />,
    );
    expect(html).toContain("Cancellation Data Input");
    expect(html).toContain("Reservations Entered Data Input");
    expect(html).toContain('accept=".pdf,.csv,.txt,.xlsx"');
    expect(html).toContain("No BOB or market");
    const report = renderToStaticMarkup(
      <OperationalReports kind="reservations" onClose={() => {}} />,
    );
    expect(report).toContain("Not every row");
    expect(report).toContain("No PIN required");
    const table = renderToStaticMarkup(
      <OperationTable rows={[cancel]} kind="cancellations" />,
    );
    expect(table).toContain("$8,200");
    expect(table).not.toContain("Country code");
    expect(quickReports.find((q) => q.id === "cancellation")!.operational).toBe(
      "cancellations",
    );
    expect(quickReports.find((q) => q.id === "reservations")!.operational).toBe(
      "reservations",
    );
  });
});
