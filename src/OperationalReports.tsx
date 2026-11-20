import { useEffect, useState } from "react";
import { Download, Printer, X } from "lucide-react";
import { formatMoney, formatNumber } from "./format";
import {
  readOperations,
  operationChanged,
  operationFields,
  fieldLabels,
  operationTotals,
  type OperationKind,
  type OperationRow,
} from "./operational";
export function OperationTable({
  rows,
  kind,
}: {
  rows: OperationRow[];
  kind: OperationKind;
}) {
  return (
    <div className="table-scroll">
      <table>
        <caption>
          Approved source fields only · amounts rounded for display
        </caption>
        <thead>
          <tr>
            {operationFields(kind).map((f) => (
              <th key={f}>
                {f === "amount"
                  ? kind === "cancellations"
                    ? "Revenue loss"
                    : "Total room revenue"
                  : fieldLabels[f]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {operationFields(kind).map((f) => (
                <td key={f}>
                  {f === "amount"
                    ? formatMoney(r.amount)
                    : (r[f] ?? "Not supplied")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export default function OperationalReports({
  kind,
  onClose,
}: {
  kind: OperationKind;
  onClose: () => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [error, setError] = useState(""),
    [saved, setSaved] = useState<OperationRow[]>([]),
    [report, setReport] = useState<{
      rows: OperationRow[];
      at: string;
      from: string;
      to: string;
    } | null>(null);
  useEffect(() => {
    function refresh() {
      try {
        setSaved(
          readOperations(localStorage)
            .filter((b) => b.kind === kind)
            .flatMap((b) => b.rows),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    }
    refresh();
    window.addEventListener(operationChanged, refresh);
    return () => window.removeEventListener(operationChanged, refresh);
  }, [kind]);
  const rows = report?.rows ?? [],
    totals = operationTotals(rows),
    grouped = Array.from(new Set(rows.map((r) => r.roomType))).map((label) => ({
      label,
      value: rows
        .filter((r) => r.roomType === label)
        .reduce((s, r) => s + r.amount, 0),
    })),
    max = Math.max(...grouped.map((g) => g.value), 1);
  async function exportCsv() {
    if (!report) return;
    const quote = (v: unknown) =>
      `"${String(typeof v === "string" && /^\s*[=+@-]/.test(v) ? "'" + v : (v ?? "")).replaceAll('"', '""')}"`;
    const fields = operationFields(kind);
    const content = [
      fields.map((f) => fieldLabels[f]),
      ...rows.map((r) => fields.map((f) => r[f] ?? "")),
    ]
      .map((r) => r.map(quote).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob([content], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-snapshot.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="operational-report">
      <div className="report-toolbar">
        <button className="report-outline-button" onClick={onClose}>
          <X size={16} />
          Close activity report
        </button>
      </div>
      <h2>
        {kind === "cancellations"
          ? "Cancellation Reports"
          : "Reservations Confirmed Reports"}
      </h2>
      <p>
        Separate daily activity dataset · Saved in this browser only. No effect
        on BOB, market budgets or other devices.
      </p>
      {kind === "reservations" && (
        <p>
          Source: reservations entered, including held, moved, complimentary and
          sharer records. Not every row is a confirmed, revenue-producing
          booking.
        </p>
      )}
      <div className="report-controls">
        <label>
          From date
          <input
            type="date"
            aria-label="Activity report from"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To date
          <input
            type="date"
            aria-label="Activity report to"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button
          className="report-gold-button"
          onClick={() => {
            setError("");
            if (!from || !to || from > to) {
              setError("Choose a valid activity date range.");
              return;
            }
            const selected = saved.filter(
              (r) => r.eventDate >= from && r.eventDate <= to,
            );
            if (!selected.length) {
              setError(
                "No saved uploaded rows for this range on this browser. Import and save a report in Data Input first.",
              );
              setReport(null);
              return;
            }
            setReport({
              rows: structuredClone(selected),
              at: new Date().toISOString(),
              from,
              to,
            });
          }}
        >
          Generate activity report
        </button>
      </div>
      {error && (
        <p role="alert" className="report-error">
          {error}
        </p>
      )}
      {report && (
        <>
          <p>
            Snapshot generated {report.at} · {report.from} to {report.to}
          </p>
          <div className="visual-kpis">
            <section>
              <span>Source rows</span>
              <strong>{totals.rows}</strong>
            </section>
            <section>
              <span>
                {kind === "cancellations"
                  ? "Revenue loss"
                  : "Room revenue entered"}
              </span>
              <strong>{formatMoney(totals.amount)}</strong>
            </section>
            <section>
              <span>
                {kind === "cancellations"
                  ? "Cancelled stay nights"
                  : "Non-sharer stay nights (not room nights)"}
              </span>
              <strong>{formatNumber(totals.stayNights)}</strong>
            </section>
          </div>
          <p>
            Sharer rows excluded from stay-night total: {totals.sharers}. Room
            quantities were not approved for capture, so occupied room nights
            are not calculated. Cancellation country is unavailable.
          </p>
          <section className="visual-panel">
            <h3>
              {kind === "cancellations" ? "Revenue loss" : "Entered revenue"} by
              room type
            </h3>
            {grouped.map((g) => (
              <div className="operation-bar" key={g.label}>
                <span>{g.label}</span>
                <div>
                  <i style={{ width: `${(g.value / max) * 100}%` }} />
                </div>
                <b>{formatMoney(g.value)}</b>
              </div>
            ))}
          </section>
          <div className="report-toolbar">
            <button
              className="report-outline-button"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print / Save PDF
            </button>
            <button
              className="report-gold-button"
              onClick={() => void exportCsv()}
            >
              <Download size={16} />
              Export source rows CSV
            </button>
          </div>
          <OperationTable kind={kind} rows={rows} />
        </>
      )}
    </section>
  );
}
