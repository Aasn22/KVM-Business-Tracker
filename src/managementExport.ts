import { dollarExcelFormat, isMoneyMetric } from "./format";
import { managementExportTables, type ManagementReport } from "./management";
export async function exportManagementReport(
  report: ManagementReport,
  demo: boolean,
) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  for (const table of managementExportTables(report, demo)) {
    const sheet = workbook.addWorksheet(table.name);
    table.rows.forEach((row) => sheet.addRow(row));
    sheet.eachRow((r) => {
      r.eachCell((c) => {
        if (typeof c.value === "number") c.numFmt = "#,##0;(#,##0);0";
      });
      // Only commercial revenue/ADR rows, never independent categories or counts.
      if (
        isMoneyMetric(String(r.getCell(2).value)) &&
        (table.name === "Market Performance" ||
          r.getCell(1).value === "Commercial")
      ) {
        for (let c = 3; c <= r.cellCount; c++)
          if ((c - 3) % 4 !== 3 && typeof r.getCell(c).value === "number")
            r.getCell(c).numFmt = dollarExcelFormat;
      }
    });
    sheet.columns.forEach((col, i) => {
      col.width = i === 0 || i === 1 ? 25 : 20;
    });
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 7 }];
    sheet.pageSetup = {
      orientation: "landscape",
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    };
  }
  const blob = new Blob([await workbook.xlsx.writeBuffer()], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `KVM-management-lense-${report.year}-${report.market}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
