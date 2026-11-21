import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import DatePicker from "./DatePicker";

export function spreadsheetSelectionError(file: {
  name: string;
  size: number;
}) {
  if (!/\.(xlsx|xls|csv|ods)$/i.test(file.name))
    return "Select a spreadsheet: XLSX, XLS, CSV or ODS.";
  if (!file.size) return "The selected file is empty.";
  if (file.size > 30 * 1024 * 1024)
    return "Select a spreadsheet no larger than 30 MB.";
  return "";
}

export default function PerformanceInput() {
  const [kind, setKind] = useState("history");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [file, setFile] = useState<{ name: string; size: number } | null>(null);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="operations-input">
      <h2>Reservation Production Reports</h2>
      <p>One spreadsheet source for reservation history or forecast.</p>
      <section className="panel operation-input production-spreadsheet">
        <h3>
          <Upload size={16} aria-hidden="true" /> Reservation Production
          Spreadsheet
        </h3>
        <fieldset>
          <label>
            Report type
            <select
              aria-label="Production report type"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              <option value="history">
                Reservation Production History Reports
              </option>
              <option value="forecast">
                Reservation Production Forecast Reports
              </option>
            </select>
          </label>
          <div className="production-date-range">
            <label>
              {kind === "history" ? "History" : "Forecast"} From Date
              <DatePicker
                label="Production from date"
                value={from}
                onChange={setFrom}
              />
            </label>
            <label>
              {kind === "history" ? "History" : "Forecast"} To Date
              <DatePicker
                label="Production to date"
                value={to}
                onChange={setTo}
              />
            </label>
          </div>
          {from && to && from > to && (
            <p className="error" role="alert">
              To date must be on or after From date.
            </p>
          )}
          <label>
            Upload spreadsheet
            <input
              ref={input}
              aria-label="Upload reservation production spreadsheet"
              type="file"
              accept=".xlsx,.xls,.csv,.ods"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                setFile(null);
                setError("");
                if (!selected) return;
                const issue = spreadsheetSelectionError(selected);
                if (issue) {
                  setError(issue);
                  e.target.value = "";
                  return;
                }
                setFile({ name: selected.name, size: selected.size });
              }}
            />
          </label>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {file && (
          <div role="status" className="notice">
            <p>
              Selected: {file.name} ({Math.ceil(file.size / 1024)} KB). This
              file has not been uploaded, saved or imported.
            </p>
            <button
              className="button outline"
              type="button"
              onClick={() => {
                setFile(null);
                setError("");
                if (input.current) input.current.value = "";
              }}
            >
              Remove file
            </button>
          </div>
        )}
        <p className="notice">
          Upload setup only — awaiting your sample spreadsheet to configure
          column mapping and validation. Selecting a file does not update
          reports, figures or the database. No file contents are read or sent.
        </p>
      </section>
    </section>
  );
}
