import DatePicker from "./DatePicker";
import { useEffect, useState } from "react";
import { Upload, Save, X } from "lucide-react";
import { parseOperationFile } from "./operationParser";
import {
  saveOperationBatch,
  readOperations,
  operationChanged,
  operationTotals,
  operationFields,
  fieldLabels,
  type OperationKind,
  type OperationRow,
} from "./operational";
import { OperationTable } from "./OperationalReports";
import { formatMoney } from "./format";
import { recordActivity } from "./activity";
import { useAdminName } from "./AdminIdentity";
type Preview = {
  id: string;
  kind: OperationKind;
  from: string;
  to: string;
  rows: OperationRow[];
  warnings: string[];
};
function InputBox({
  kind,
  onBusyChange,
}: {
  kind: OperationKind;
  onBusyChange: (v: boolean) => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [pending, setPending] = useState<Preview | null>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const actor = useAdminName();
  useEffect(() => () => onBusyChange(false), []);
  async function parse(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    setPending(null);
    if (!from || !to || from > to) {
      setError("Select From and To dates before uploading.");
      return;
    }
    setBusy(true);
    onBusyChange(true);
    try {
      const parsed = await parseOperationFile(file, kind, from, to);
      const existing = readOperations(localStorage);
      if (existing.some((b) => b.id === parsed.id))
        throw Error("This file has already been saved.");
      setPending(parsed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  function save() {
    if (!pending || !actor) return;
    setError("");
    try {
      saveOperationBatch(localStorage, {
        ...pending,
        savedAt: new Date().toISOString(),
      });
      window.dispatchEvent(new Event(operationChanged));
      if (
        !recordActivity(
          "change",
          actor,
          `${kind === "cancellations" ? "Cancellation" : "Reservations entered"} import saved · ${pending.from} to ${pending.to}`,
        )
      )
        setError(
          "Data saved, but the browser activity log could not be updated.",
        );
      setMessage(
        `${pending.rows.length} source rows saved in this browser. Separate activity reports are updated; BOB and market totals unchanged.`,
      );
      setPending(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function template() {
    const labels = operationFields(kind).map((f) =>
      f === "amount"
        ? kind === "cancellations"
          ? "Revenue Loss"
          : "Total Room Revenue"
        : f === "eventDate"
          ? kind === "cancellations"
            ? "Cancel Date"
            : "Entered On"
          : fieldLabels[f],
    );
    const url = URL.createObjectURL(
      new Blob([labels.join(",") + "\n"], { type: "text/csv" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${kind}-template.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel operation-input">
      <h3>
        {kind === "cancellations"
          ? "Cancellation Data Input"
          : "Reservations Entered Data Input"}
      </h3>
      <fieldset disabled={busy || !!pending}>
        <label>
          {kind === "cancellations" ? "Cancel" : "Booked"} From date
          <DatePicker label={`${kind} from`} value={from} onChange={setFrom} />
        </label>
        <label>
          {kind === "cancellations" ? "Cancel" : "Booked"} To date
          <DatePicker label={`${kind} to`} value={to} onChange={setTo} />
        </label>
        <label className="operation-file">
          <Upload size={16} />
          Upload file
          <input
            aria-label={`Upload ${kind} report`}
            type="file"
            accept=".pdf,.csv,.txt,.xlsx"
            onChange={(e) => {
              void parse(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </fieldset>
      <button className="text-button" onClick={template}>
        Download CSV header template
      </button>
      {busy && <p role="status">Reading and validating report…</p>}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {pending && (
        <section className="operation-preview">
          <h4>Review before saving</h4>
          <p>
            {pending.rows.length} rows ·{" "}
            {formatMoney(operationTotals(pending.rows).amount)} · {pending.from}{" "}
            to {pending.to}
          </p>
          <ul>
            {pending.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <OperationTable rows={pending.rows} kind={kind} />
          <div className="editor-actions">
            <button className="button primary" disabled={!actor} onClick={save}>
              <Save size={16} />
              Save activity data
            </button>
            <button className="button outline" onClick={() => setPending(null)}>
              <X size={16} />
              Discard
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
export default function OperationalInput({
  onBusyChange,
}: {
  onBusyChange: (v: boolean) => void;
}) {
  return (
    <section className="operations-input">
      <h2>Daily reservation activity uploads</h2>
      <p>
        PDF, CSV, tab/comma-delimited TXT or XLSX. Preview and save only
        highlighted fields; no guest names, confirmation numbers or staff names
        are stored. No BOB or market balance updates.
      </p>
      <div className="operation-input-grid">
        <InputBox kind="cancellations" onBusyChange={onBusyChange} />
        <InputBox kind="reservations" onBusyChange={onBusyChange} />
      </div>
      <p>
        Browser-local datasets: users on other devices cannot see these imports.
        Use Reports Library from this named admin session for cancellation and
        reservations-entered reports. Overlapping date ranges are blocked to
        prevent double-counting. Reservations entered is not the same as all
        bookings confirmed.
      </p>
    </section>
  );
}
