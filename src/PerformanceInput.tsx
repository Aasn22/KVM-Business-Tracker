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
          <Upload size={16} /> Production spreadsheet · All reservation statuses
        </h3>
        <p>
          Upload XLSX with the supplied reservation-level columns.
          Arrival/departure dates control daily stay analysis; dates are not
          relabeled. All reservation statuses and new codes are retained,
          including NO SHOW. Booked/cancelled dates are kept separately for
          event reports. Each upload must be a complete export for its
          arrival-date range; that range replaces older records, while other
          dates/years are preserved.
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
            <h4>Review import</h4>
            <p>
              Detected statuses:{" "}
              {Object.entries(data.statuses ?? {})
                .map(([s, n]) => `${s}: ${formatNumber(n)}`)
                .join(" · ")}
            </p>
            <p>
              Arrival replacement range: {data.coverage?.[0]?.from} through{" "}
              {data.coverage?.[0]?.to}. Upload the complete range; without a
              unique reservation ID partial overlapping files cannot safely be
              merged.
            </p>
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
              Reservation dates, status, codes, agent/company and financial
              figures are retained for the requested public reports. Guest
              names/contact information are excluded. Publishing makes these
              approved fields available to public visitors. New codes are
              discoverable immediately but not guessed into Retail/Wholesale or
              a geographic market.
            </p>
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    `Publish ${data.rows} records and replace only arrivals from ${data.coverage?.[0]?.from} through ${data.coverage?.[0]?.to}? All other arrival dates/years and budgets are preserved. Confirm this file is a COMPLETE export for that range.`,
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
                    "Production records saved and read back from the shared database. Related views refresh within 60 seconds.",
                  );
                  setData(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save Production Records
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
          The published Q1 baseline is available until shared imports are
          activated. Shared saving requires the production reservation import
          migration; only a verified database save updates the reports for all
          devices.
        </p>
      </section>
    </section>
  );
}
