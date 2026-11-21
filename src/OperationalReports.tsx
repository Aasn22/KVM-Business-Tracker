import { loadSharedOperations } from "./sharedOperations";
import DatePicker from "./DatePicker";
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
      source: string;
    } | null>(null);
  const [generating, setGenerating] = useState(false);
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
    <section className="operational-report print-report">
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
        Public activity reports · No PIN required to view or generate. Admin
        uploads publish to shared report storage once configured. BOB and market
        budgets remain separate.
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
          <DatePicker
            label="Activity report from"
            value={from}
            onChange={setFrom}
          />
        </label>
        <label>
          To date
          <DatePicker label="Activity report to" value={to} onChange={setTo} />
        </label>
        <button
          className="report-gold-button"
          disabled={generating}
          onClick={async () => {
            setError("");
            if (!from || !to || from > to) {
              setError("Choose a valid activity date range.");
              return;
            }
            setGenerating(true);
            try {
              let selected: OperationRow[],
                source = "Published shared uploads";
              try {
                selected = await loadSharedOperations(kind, from, to);
              } catch (e) {
                selected = saved.filter(
                  (r) => r.eventDate >= from && r.eventDate <= to,
                );
                if (!selected.length) throw e;
                source =
                  "This browser's unpublished legacy uploads only — not shared across devices";
                setError(
                  `Shared report storage unavailable. Showing this browser's local data only. ${(e as Error).message}`,
                );
              }
              if (!selected.length) {
                setReport(null);
                setError(
                  "No published uploads for this date range. An admin must publish the report first.",
                );
                return;
              }
              setReport({
                rows: structuredClone(selected),
                at: new Date().toISOString(),
                from,
                to,
                source,
              });
            } catch (e) {
              setReport(null);
              setError((e as Error).message);
            } finally {
              setGenerating(false);
            }
          }}
        >
          {generating
            ? "Loading published report…"
            : "Generate activity report"}
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
            Snapshot generated {report.at} · {report.from} to {report.to} ·{" "}
            {report.source}
          </p>
          <CancellationSummary kind={kind} rows={rows} />
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

export function CancellationSummary({
  kind,
  rows,
}: {
  kind: OperationKind;
  rows: OperationRow[];
}) {
  const totals = operationTotals(rows);
  return (
    <>
      <div className="visual-kpis">
        <section>
          <span>
            {kind === "cancellations"
              ? "Cancelled Room Nights Total"
              : "Source rows"}
          </span>
          <strong>
            {kind === "cancellations"
              ? formatNumber(totals.stayNights)
              : totals.rows}
          </strong>
          {kind === "cancellations" && (
            <small>Sum of source Nts.; room quantities unavailable</small>
          )}
        </section>
        <section>
          <span>
            {kind === "cancellations"
              ? "Room Revenue Loss"
              : "Room revenue entered"}
          </span>
          <strong>{formatMoney(totals.amount)}</strong>
        </section>
        <section>
          <span>
            {kind === "cancellations"
              ? "Highest Cancellation Country"
              : "Non-sharer stay nights"}
          </span>
          <strong>
            {kind === "cancellations"
              ? "Not available"
              : formatNumber(totals.stayNights)}
          </strong>
          {kind === "cancellations" && (
            <small>Country not supplied; no ranking inferred</small>
          )}
        </section>
      </div>
      <p className="operation-definition">
        {totals.rows} source rows · {totals.sharers} SHARER rows excluded from
        the nights total. Nights are summed from the source Nts. column, not
        multiplied by room quantities. Country information can be supplied in a
        future source format; it is not guessed.
      </p>
    </>
  );
}
