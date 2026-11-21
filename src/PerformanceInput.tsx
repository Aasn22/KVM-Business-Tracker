import { useState } from "react";
import { Upload } from "lucide-react";
import { parseProductionFile, type ProductionData } from "./production";
import { saveProduction } from "./productionClient";
import { recordActivity } from "./activity";
import { useAdminName } from "./AdminIdentity";
import { formatMoney, formatNumber } from "./format";
export function spreadsheetSelectionError(file: {
  name: string;
  size: number;
}) {
  if (!/\.xlsx$/i.test(file.name))
    return "Select an XLSX spreadsheet in the supplied layout.";
  if (!file.size) return "The selected file is empty.";
  if (file.size > 30 * 1024 * 1024) return "Maximum 30 MB.";
  return "";
}
export default function PerformanceInput() {
  const actor = useAdminName();
  const [data, setData] = useState<ProductionData | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="operations-input">
      <h2>Reservation Production Reports</h2>
      <section className="panel operation-input">
        <h3>
          <Upload size={16} /> Production spreadsheet · History
        </h3>
        <p>
          Upload XLSX with the supplied reservation-level columns.
          Arrival/departure dates control daily stay analysis; dates are not
          relabeled. Forecast imports remain unavailable until a forecast sample
          is supplied.
        </p>
        <label>
          Select production spreadsheet
          <input
            type="file"
            aria-label="Upload reservation production spreadsheet"
            accept=".xlsx"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setError("");
              setMessage("");
              setData(null);
              e.target.value = "";
              if (!file) return;
              const issue = spreadsheetSelectionError(file);
              if (issue) {
                setError(issue);
                return;
              }
              setBusy(true);
              try {
                setData(await parseProductionFile(file));
              } catch (err) {
                setError((err as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
        {busy && <p role="status">Validating production data…</p>}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && <p role="status">{message}</p>}
        {data && (
          <>
            <h4>Review analytical snapshot</h4>
            <p>
              {formatNumber(data.rows)} records · {data.checkedOut} checked out
              · {data.cancelled} cancelled · {data.missingRevenue} unknown
              revenue. Stay coverage {data.from} through departure {data.to}.
            </p>
            <p>
              Completed stay value (all source stay dates):{" "}
              {formatMoney(
                data.days
                  .filter((r) => r.status === "CHECKED OUT")
                  .reduce((a, r) => a + r.revenue, 0),
              )}
              . Cancelled stay value is kept separate.
            </p>
            <ul>
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
            <p>
              Only sanitized aggregates will be sent. No agent names, guest
              names or booking references are retained. Publishing REPLACES the
              entire current production snapshot; it does not merge quarters.
              Upload a complete cumulative file when adding periods.
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Replace the entire shared production snapshot with this reviewed file? Existing budgets are not changed.",
                  )
                )
                  return;
                setBusy(true);
                setError("");
                try {
                  await saveProduction(data);
                  recordActivity(
                    "change",
                    actor ?? "Self-reported administrator",
                    "Published production snapshot · " +
                      data.from +
                      " to " +
                      data.to,
                  );
                  setMessage(
                    "Shared production snapshot saved. Related views refresh within 60 seconds.",
                  );
                  setData(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Publish / Replace Production Snapshot
            </button>
            <button
              className="button outline"
              disabled={busy}
              onClick={() => setData(null)}
            >
              Discard
            </button>
          </>
        )}
        <p>
          The Q1 2026 source is already published on the website as an
          analytical snapshot. Shared saving requires its database migration; a
          failed save never updates public figures.
        </p>
      </section>
    </section>
  );
}
