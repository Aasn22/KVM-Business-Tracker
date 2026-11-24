import { useEffect, useState } from "react";
import {
  blankHistory,
  cleanHistory,
  historyFields,
  historySummary,
  type HistoryYear,
  type HistoryMonth,
} from "./history";
import { loadHistory, saveHistory, historyChanged } from "./historyClient";
import { months } from "./model";
import { pasteHistory, historyInputValue } from "./historyPaste";
import { formatMoney, formatNumber } from "./format";
export const historyColumns = [
  "Month",
  "Budgeted Room Nights",
  "Actual Room Nights",
  "Budgeted Room Revenue",
  "Actual Room Revenue",
  "Budgeted ADR",
  "Actual ADR",
  "Budgeted Total Revenue",
  "Actual Total Revenue",
];
const years = Array.from({ length: 40 }, (_, i) => 2021 + i);
const fields = [
  "budgetNights",
  "actualNights",
  "budgetRoomRevenue",
  "actualRoomRevenue",
  "budgetADR",
  "actualADR",
  "budgetTotalRevenue",
  "actualTotalRevenue",
] as const;
export function HistoryTable({
  data,
  onChange,
}: {
  data: HistoryYear;
  onChange?: (months: HistoryMonth[]) => void;
}) {
  const [inputError, setInputError] = useState("");
  const total = historySummary(data.months),
    editable = !!onChange;
  return (
    <div
      className="history-table-scroll"
      role="region"
      aria-label="Monthly history table"
      tabIndex={0}
    >
      {inputError && (
        <p role="alert" className="error">
          {inputError}
        </p>
      )}
      <table className="history-table">
        <thead>
          <tr>
            {historyColumns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.months.map((r, i) => {
            const computed = historySummary([r]);
            return (
              <tr key={r.month}>
                <th scope="row">{months[r.month - 1]}</th>
                {fields.map((field) => (
                  <td key={field}>
                    {editable &&
                    field !== "budgetADR" &&
                    field !== "actualADR" ? (
                      <input
                        type="number"
                        min="0"
                        max="1000000000000"
                        step={field.endsWith("Nights") ? "1" : "any"}
                        aria-label={`${months[r.month - 1]} ${field}`}
                        value={r[field] ?? ""}
                        onPaste={(e) => {
                          e.preventDefault();
                          try {
                            const next = pasteHistory(
                              data,
                              i,
                              field,
                              e.clipboardData.getData("text/plain"),
                            );
                            onChange(next.months);
                            setInputError("");
                          } catch (err) {
                            setInputError((err as Error).message);
                          }
                        }}
                        onChange={(e) => {
                          try {
                            const value = historyInputValue(
                              e.target.value,
                              field,
                            );
                            onChange(
                              data.months.map((row, j) =>
                                i === j ? { ...row, [field]: value } : row,
                              ),
                            );
                            setInputError("");
                          } catch (err) {
                            setInputError((err as Error).message);
                          }
                        }}
                      />
                    ) : field.endsWith("Nights") ? (
                      formatNumber(
                        computed[field as "budgetNights" | "actualNights"],
                      )
                    ) : (
                      formatMoney(computed[field])
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">TOTAL (known)</th>
            {fields.map((field) => (
              <td key={field}>
                {field.endsWith("Nights")
                  ? formatNumber(
                      total[field as "budgetNights" | "actualNights"],
                    )
                  : formatMoney(total[field])}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
export default function HistoryUpdate({
  onDirtyChange,
  onBusyChange,
}: {
  onDirtyChange?: (v: boolean) => void;
  onBusyChange?: (v: boolean) => void;
} = {}) {
  const [year, setYear] = useState(2026),
    [data, setData] = useState<HistoryYear>(blankHistory(2026)),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [ready, setReady] = useState(false);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    onBusyChange?.(busy);
    return () => onBusyChange?.(false);
  }, [busy, onBusyChange]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setReady(false);
    setError("");
    setMessage("");
    setDirty(false);
    setData(blankHistory(year));
    loadHistory(year)
      .then((rows) => {
        if (active) {
          setData(rows[0] ?? blankHistory(year));
          setReady(true);
        }
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);
  return (
    <section className="panel history-update">
      <header>
        <h2>History Update</h2>
        <label>
          Year
          <select
            aria-label="History Update year"
            value={year}
            disabled={busy}
            onChange={(e) => {
              if (dirty && !window.confirm("Discard unsaved history changes?"))
                return;
              setYear(+e.target.value);
            }}
          >
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <button
          className="button primary"
          disabled={loading || busy || !dirty || !ready}
          onClick={async () => {
            setBusy(true);
            setError("");
            setMessage("");
            try {
              const clean = cleanHistory(data);
              const saved = await saveHistory(clean);
              setData(saved);
              setDirty(false);
              setMessage(
                `History ${year} saved and verified. Pulse and History Update reports refresh from these property totals; they are not added to production figures.`,
              );
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Saving…" : "Save History"}
        </button>
      </header>
      <p>
        Excel paste: copy numeric cells and paste into the first matching input.
        Six input columns or all eight columns (ADR ignored/recalculated) are
        supported; month names and headers may be included. Enter property
        totals for the selected year. Blank = unavailable; 0 = a confirmed zero.
        ADR is calculated from room revenue ÷ room nights; TOTAL ADR is
        weighted, not a sum. Budget and actual total revenue includes room
        revenue.
      </p>
      {loading && <p role="status">Loading saved year…</p>}
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <fieldset disabled={busy || loading}>
        <HistoryTable
          data={data}
          onChange={(m) => {
            setData({ ...data, months: m });
            setDirty(true);
            setMessage("");
          }}
        />
      </fieldset>
      <small>
        Manual monthly history is a separate source. Saved nonblank figures take
        precedence for matching property-level historical summaries, never
        distributed to markets or added to uploaded production.{" "}
        {historySummary(data.months).knownMonths}/12 months contain figures.
        Shared saving requires the History Update database table; no
        browser-only save is reported as shared.
      </small>
    </section>
  );
}
export function HistoryReport({
  year,
  period,
  title,
  onClose,
}: {
  year: number;
  period: number[];
  title: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<HistoryYear | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadHistory(year)
      .then((rows) => {
        if (active) setData(rows[0] ?? null);
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [year]);
  const visible = data
    ? { ...data, months: data.months.filter((m) => period.includes(m.month)) }
    : null;
  return (
    <section className="history-report">
      <button className="button outline" onClick={onClose}>
        Back to Reports Library
      </button>
      <h2>
        {title} · {year}
      </h2>
      <p>
        Saved History Update property totals · fixed report copy, not
        market/country/villa data or BOB. Blank fields are unavailable. Manual
        actuals are not added to production actuals.
      </p>
      {loading && <p role="status">Generating from saved history…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !data && (
        <p>No History Update saved for {year}.</p>
      )}
      {visible && (
        <>
          <HistoryTable data={visible} />
          <div className="history-mini-bars">
            {visible.months.map((m) => (
              <div key={m.month}>
                <span>{months[m.month - 1]}</span>
                <meter
                  min={0}
                  max={Math.max(
                    1,
                    ...visible.months.map((r) =>
                      Math.max(
                        r.budgetRoomRevenue ?? 0,
                        r.actualRoomRevenue ?? 0,
                      ),
                    ),
                  )}
                  value={m.actualRoomRevenue ?? 0}
                  aria-label={`${months[m.month - 1]} actual room revenue ${formatMoney(m.actualRoomRevenue)}`}
                />
                <strong>{formatMoney(m.actualRoomRevenue)}</strong>
              </div>
            ))}
          </div>
          <button className="button outline" onClick={() => window.print()}>
            Print / Save PDF
          </button>
        </>
      )}
    </section>
  );
}
