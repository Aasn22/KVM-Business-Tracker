import { useState } from "react";
import { Upload, Save } from "lucide-react";
import DatePicker from "./DatePicker";
import { parsePerformanceFile } from "./performanceParser";
import { publishPerformance } from "./performanceClient";
import {
  summarizePerformance,
  type PerformanceImport,
  type SourceKind,
  type SourceDimension,
} from "./performanceSources";
import { formatMoney, formatNumber } from "./format";
import { recordActivity } from "./activity";
import { useAdminName } from "./AdminIdentity";
const names = {
  market: "Market Codes",
  room: "Room Types",
  country: "Country Codes",
};
function SourceBox({
  kind,
  dimension,
  onBusy,
}: {
  kind: SourceKind;
  dimension: SourceDimension;
  onBusy: (v: boolean) => void;
}) {
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<PerformanceImport | null>(null);
  const actor = useAdminName();
  const unavailable = kind === "forecast" && dimension === "room";
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (!from || !to) {
      setError("Choose the exact source From/To dates first");
      return;
    }
    setBusy(true);
    onBusy(true);
    try {
      setPreview(await parsePerformanceFile(file, kind, dimension, from, to));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  const totals = preview ? summarizePerformance(preview.rows) : null;
  return (
    <section className="panel operation-input">
      <h3>
        Reservation {kind === "history" ? "History" : "Forecast"} Reports ·{" "}
        {names[dimension]}
      </h3>
      {unavailable ? (
        <p>
          Awaiting the Forecast by Room Types sample. This source is
          unavailable; country or market data is not used to invent room-type
          figures.
        </p>
      ) : (
        <>
          <fieldset disabled={busy || !!preview}>
            <label>
              {kind === "history" ? "History" : "Forecast"} From Date
              <DatePicker
                label={`${kind} ${dimension} from`}
                value={from}
                onChange={setFrom}
              />
            </label>
            <label>
              {kind === "history" ? "History" : "Forecast"} To Date
              <DatePicker
                label={`${kind} ${dimension} to`}
                value={to}
                onChange={setTo}
              />
            </label>
            <label>
              Upload selectable Opera PDF
              <input
                type="file"
                accept=".pdf"
                aria-label={`Upload ${kind} by ${dimension}`}
                onChange={(e) => {
                  void upload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
          </fieldset>
          {busy && (
            <p role="status">Processing and reconciling daily columns…</p>
          )}
          {preview && (
            <>
              <h4>Review primary source</h4>
              <p>
                Run date {preview.asOf} · {preview.from} to {preview.to} ·{" "}
                {preview.rows.length} dated codes ·{" "}
                {formatNumber(totals!.rooms)} room nights ·{" "}
                {formatMoney(totals!.revenue)} room revenue.
              </p>
              <p>
                Publishing replaces this source dimension's matching stay dates.
                Other dimensions are not added to this total. Budgets remain
                unchanged. Signed revenue adjustments are retained.
              </p>
              <div className="table-scroll operation-source-preview">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Code</th>
                      <th>Rooms</th>
                      <th>Room revenue</th>
                      <th>F&amp;B</th>
                      <th>Other</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 100).map((r) => (
                      <tr key={r.date + r.code}>
                        <td>{r.date}</td>
                        <td>{r.code}</td>
                        <td>{r.rooms}</td>
                        <td>{formatMoney(r.roomRevenue)}</td>
                        <td>{formatMoney(r.foodRevenue)}</td>
                        <td>{formatMoney(r.otherRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>First 100 rows shown; all validated records will publish.</p>
              <button
                className="button primary"
                disabled={busy || !actor}
                onClick={async () => {
                  setBusy(true);
                  onBusy(true);
                  try {
                    await publishPerformance(preview);
                    recordActivity(
                      "change",
                      actor!,
                      `${kind} ${dimension} source published · ${from} to ${to}`,
                    );
                    setPreview(null);
                    setMessage(
                      "Published. Refresh related pages to read the new primary source.",
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                    onBusy(false);
                  }
                }}
              >
                <Save size={16} />
                Publish / Replace Source
              </button>
              <button
                className="button outline"
                disabled={busy}
                onClick={() => setPreview(null)}
              >
                Discard
              </button>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
export default function PerformanceInput({
  onBusy,
}: {
  onBusy: (v: boolean) => void;
}) {
  return (
    <section className="operations-input">
      <h2>Primary reservation performance sources</h2>
      <p>
        History = reported performance; forecast = saved on-books projection,
        not realized revenue. All three dimensions describe the same
        business—never add their totals together. Publication needs the
        shared-performance database setup.
      </p>
      <div className="operation-input-grid">
        {(["market", "room", "country"] as const).flatMap((d) =>
          (["history", "forecast"] as const).map((k) => (
            <SourceBox key={k + d} kind={k} dimension={d} onBusy={onBusy} />
          )),
        )}
      </div>
    </section>
  );
}
