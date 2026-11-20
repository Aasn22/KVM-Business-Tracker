import { Fragment, useState } from "react";
import { ArrowDownToLine, LockKeyhole, Printer } from "lucide-react";
import { markets, months, type Entry } from "./model";
import {
  managementReport,
  unavailable,
  type ManagementReport,
  type Metric,
} from "./management";
import { exportManagementReport } from "./managementExport";
const n = (v: number | null) =>
  v === null
    ? "—"
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(v);
export default function TotalReview({
  entries,
  year,
  loading,
  demo,
}: {
  entries: Entry[];
  year: number;
  loading: boolean;
  demo: boolean;
}) {
  const [market, setMarket] = useState("all");
  const [quarter, setQuarter] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const report = managementReport(entries, year, market);
  const periods = [
    ...report.periods.filter(
      (p) =>
        Number(p.key) >= (quarter - 1) * 3 + 1 && Number(p.key) <= quarter * 3,
    ),
    ...report.periods.filter((p) => p.key.startsWith("q") || p.key === "year"),
  ];
  const annual = report.annual;
  async function download() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await exportManagementReport(report, demo);
      setMessage(
        `Management Review Excel report generated for ${year} · ${report.scope}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const matrix = (
    section: "commercial" | "villas" | "meals" | "countries",
    labels: string[],
  ) => (
    <div className="table-scroll">
      <table className="management-matrix">
        <thead>
          <tr>
            <th rowSpan={3}>KPI / Category</th>
            <th rowSpan={3}>
              Annual ADR
              <br />
              (Budget / BOB)
            </th>
            <th colSpan={6}>Quarter {quarter} · Monthly detail</th>
            {[1, 2, 3, 4].map((q) => (
              <th key={q} colSpan={3}>
                Quarter {q}
              </th>
            ))}
            <th colSpan={3}>Full year {year}</th>
          </tr>
          <tr>
            {periods.map((p) => (
              <th
                key={p.key}
                colSpan={p.key.startsWith("q") || p.key === "year" ? 3 : 2}
              >
                {p.label}
                <small>
                  {p.count}/{p.expected}
                  {!p.complete ? " · Partial" : ""}
                </small>
              </th>
            ))}
          </tr>
          <tr className="matrix-subhead">
            {periods.map((p) => (
              <Fragment key={p.key}>
                <th>Budgeted</th>
                <th>BOB</th>
                {(p.key.startsWith("q") || p.key === "year") && <th>Gap</th>}
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label) => (
            <tr key={label}>
              <th>{label}</th>
              <td>
                {section === "commercial"
                  ? `${n(report.commercial("year", "ADR").budget)} / ${n(report.commercial("year", "ADR").bob)}`
                  : unavailable}
              </td>
              {periods.map((p) => {
                const v =
                  section === "commercial"
                    ? report.commercial(p.key, label)
                    : report.values(p.key, section, label);
                return (
                  <Fragment key={p.key}>
                    <td>{n(v.budget)}</td>
                    <td>{n(v.bob)}</td>
                    {(p.key.startsWith("q") || p.key === "year") && (
                      <td
                        className={
                          v.bob !== null &&
                          v.budget !== null &&
                          v.bob >= v.budget
                            ? "positive"
                            : "negative"
                        }
                      >
                        {n(
                          v.budget !== null && v.bob !== null
                            ? v.bob - v.budget
                            : null,
                        )}
                      </td>
                    )}
                  </Fragment>
                );
              })}
            </tr>
          ))}
          {section !== "commercial" && labels.length > 0 && (
            <tr className="derived">
              <th>Category total</th>
              <td>{unavailable}</td>
              {periods.map((p) => {
                const values = labels.map((label) =>
                  report.values(p.key, section, label),
                );
                const budget = values.some((v) => v.budget !== null)
                  ? values.reduce((sum, v) => sum + (v.budget ?? 0), 0)
                  : null;
                const bob = values.some((v) => v.bob !== null)
                  ? values.reduce((sum, v) => sum + (v.bob ?? 0), 0)
                  : null;
                return (
                  <Fragment key={p.key}>
                    <td>{n(budget)}</td>
                    <td>{n(bob)}</td>
                    {(p.key.startsWith("q") || p.key === "year") && (
                      <td>
                        {n(
                          budget !== null && bob !== null ? bob - budget : null,
                        )}
                      </td>
                    )}
                  </Fragment>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <section className="panel report-filters management-controls">
        <label>
          Market scope
          <select
            aria-label="Management market"
            value={market}
            disabled={busy}
            onChange={(e) => {
              setMarket(e.target.value);
              setMessage("");
            }}
          >
            <option value="all">All markets</option>
            {markets.map((m) => (
              <option value={m.id} key={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Monthly detail
          <select
            aria-label="Management detail quarter"
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>
                Quarter {q}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button outline"
          disabled={busy || loading || !annual.count}
          onClick={download}
        >
          <ArrowDownToLine size={16} />
          {busy ? "Generating…" : "Export management report"}
        </button>
        <button
          className="button outline"
          disabled={loading || !annual.count}
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Print / Save PDF
        </button>
      </section>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {message && (
        <div role="status" className="notice">
          {message}
        </div>
      )}
      <div className="notice management-coverage">
        <LockKeyhole size={14} />
        <div>
          <strong>
            {loading
              ? "Loading saved market records…"
              : `${demo ? "Fictional demo data · " : ""}${annual.complete ? "Complete coverage" : "Partial — missing or inaccessible records"} · ${annual.count}/${annual.expected} market-month records`}
          </strong>
          <p>
            Automatic, read-only report. All figures come from saved market
            records; changes are made only in Admin Data Input. BOB is business
            on the books, not MTD actuals. Gap = BOB − budget.
          </p>
          {annual.missing.length > 0 && (
            <details>
              <summary>Missing records ({annual.missing.length})</summary>
              <p>{annual.missing.join("; ")}</p>
            </details>
          )}
        </div>
      </div>
      <article className="management-sheet">
        <header className="management-title">
          <div>
            <strong>KUDA VILLINGILI RESORT MALDIVES — {year}</strong>
            <span>MANAGEMENT REVIEW · {report.scope}</span>
          </div>
          <div>
            Automatic market consolidation
            <small>
              {demo
                ? "Fictional demonstration"
                : "Saved authorized records only"}
            </small>
          </div>
        </header>
        <p className="management-subtitle">
          Commercial team budget & performance review · Read-only · USD · Market
          contributions shown below
        </p>
        <div className="table-scroll">
          <table className="management-summary">
            <thead>
              <tr>
                <th>Budget details</th>
                <th>{year} full year</th>
                <th>ADR budget / BOB</th>
                <th>Room revenue budget / BOB</th>
                <th>F&B revenue</th>
                <th>Other revenue</th>
                <th>Total revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th>Occupancy %</th>
                <td>{unavailable}</td>
                <td rowSpan={2}>
                  {n(report.commercial("year", "ADR").budget)} /{" "}
                  {n(report.commercial("year", "ADR").bob)}
                </td>
                <td rowSpan={2}>
                  {n(report.commercial("year", "Room Revenue").budget)} /{" "}
                  {n(report.commercial("year", "Room Revenue").bob)}
                </td>
                <td rowSpan={2}>{unavailable}</td>
                <td rowSpan={2}>{unavailable}</td>
                <td rowSpan={2}>{unavailable}</td>
              </tr>
              <tr>
                <th>Room nights (budget / BOB)</th>
                <td>
                  {n(report.commercial("year", "Room Nights").budget)} /{" "}
                  {n(report.commercial("year", "Room Nights").bob)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <SheetSection title="1. MONTHLY COMMERCIAL TARGETS & BOB">
          {matrix("commercial", ["Room Revenue", "Room Nights", "ADR"])}
        </SheetSection>
        <SheetSection title="2. VILLA TYPE TARGETS & PERFORMANCE BY ROOM NIGHTS">
          {matrix("villas", report.labels("villas"))}
          <p className="management-footnote">
            Category ADR is not stored by the market pages. Villa figures
            preserve the source units; no revenue or ADR is inferred for
            individual categories.
          </p>
        </SheetSection>
        <SheetSection title="3. QUARTERLY TARGETS, BOB & CORRECTIVE ACTION">
          <div className="table-scroll">
            <table className="quarter-review">
              <thead>
                <tr>
                  <th rowSpan={2}>Quarter / Period</th>
                  <th rowSpan={2}>ADR budget / BOB</th>
                  <th colSpan={3}>Room nights</th>
                  <th colSpan={3}>Room revenue</th>
                  <th rowSpan={2}>Saved market action plans</th>
                </tr>
                <tr>
                  <th>Budgeted</th>
                  <th>BOB</th>
                  <th>Forecast</th>
                  <th>Budgeted</th>
                  <th>BOB</th>
                  <th>Forecast</th>
                </tr>
              </thead>
              <tbody>
                {report.periods
                  .filter((p) => p.key.startsWith("q") || p.key === "year")
                  .map((p) => (
                    <tr key={p.key}>
                      <th>
                        {p.label}
                        <small>
                          {p.count}/{p.expected}
                          {!p.complete ? " · Partial" : ""}
                        </small>
                      </th>
                      <td>
                        {n(report.commercial(p.key, "ADR").budget)} /{" "}
                        {n(report.commercial(p.key, "ADR").bob)}
                      </td>
                      <MetricCells
                        metric={report.commercial(p.key, "Room Nights")}
                      />
                      <MetricCells
                        metric={report.commercial(p.key, "Room Revenue")}
                      />
                      <td className="management-notes">
                        {p.key === "year"
                          ? "See saved action plans below."
                          : report.notes
                              .filter(
                                (note) => note.quarter === Number(p.key[1]),
                              )
                              .map(
                                (note) =>
                                  `${note.market} · ${months[note.month - 1]}: ${note.text}`,
                              )
                              .join("\n") || unavailable}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </SheetSection>
        <SheetSection title="4. MEAL PLAN BOOKING CONTROL">
          {matrix("meals", report.labels("meals"))}
          <p className="management-footnote">
            Meal-plan ADR and MTD actuals are not stored. Source market booking
            targets and BOB are shown without relabeling them as realized
            revenue.
          </p>
        </SheetSection>
        <SheetSection title="5. MARKET PERFORMANCE & ACTION PLAN">
          <MarketPerformance report={report} />
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Market / Month</th>
                  <th>Saved corrective action</th>
                  <th>Forecast / Director feedback</th>
                </tr>
              </thead>
              <tbody>
                {report.notes.length ? (
                  report.notes.map((note, i) => (
                    <tr key={i}>
                      <th>
                        {note.market} · {months[note.month - 1]}
                      </th>
                      <td className="management-notes">{note.text}</td>
                      <td>{unavailable}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>
                      No saved action plans available for this scope.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SheetSection>
        <SheetSection title="6. SIGN-OFF">
          <div className="management-signoffs">
            {[
              "Revenue Director",
              "Commercial Director",
              "General Manager",
              "Owner’s Representative",
            ].map((role) => (
              <div key={role}>
                <strong>{role}</strong>
                <span>{unavailable}</span>
              </div>
            ))}
          </div>
          <p className="management-footnote">
            No approval or signature records exist in the source data.
            Occupancy, MTD actuals, forecasts, F&B/other/total revenue and
            category ADR are not supplied; none are invented or entered here.
          </p>
        </SheetSection>
      </article>
    </>
  );
}
function SheetSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="management-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function MetricCells({ metric }: { metric: Metric }) {
  return (
    <>
      <td>{n(metric.budget)}</td>
      <td>{n(metric.bob)}</td>
      <td>{unavailable}</td>
    </>
  );
}
function MarketPerformance({ report }: { report: ManagementReport }) {
  return (
    <div className="table-scroll">
      <table className="market-performance">
        <thead>
          <tr>
            <th rowSpan={2}>Market</th>
            {[1, 2, 3, 4].map((q) => (
              <th key={q} colSpan={3}>
                Quarter {q} · Revenue
              </th>
            ))}
            <th colSpan={5}>Full year {report.year}</th>
          </tr>
          <tr>
            {[1, 2, 3, 4].map((q) => (
              <Fragment key={q}>
                <th>Budgeted</th>
                <th>BOB</th>
                <th>Gap</th>
              </Fragment>
            ))}
            <th>Budgeted</th>
            <th>BOB</th>
            <th>Gap</th>
            <th>Room nights BOB</th>
            <th>ADR BOB</th>
          </tr>
        </thead>
        <tbody>
          {markets
            .filter((m) => report.market === "all" || m.id === report.market)
            .map((m) => {
              const r = managementReport(report.sources, report.year, m.id);
              return (
                <tr key={m.id}>
                  <th>
                    {m.name}
                    <small>{r.annual.count}/12 months</small>
                  </th>
                  {[1, 2, 3, 4].map((q) => {
                    const v = r.commercial(`q${q}`, "Room Revenue");
                    return (
                      <Fragment key={q}>
                        <td>{n(v.budget)}</td>
                        <td>{n(v.bob)}</td>
                        <td>
                          {n(
                            v.budget !== null && v.bob !== null
                              ? v.bob - v.budget
                              : null,
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                  <td>{n(r.commercial("year", "Room Revenue").budget)}</td>
                  <td>{n(r.commercial("year", "Room Revenue").bob)}</td>
                  <td>
                    {n(
                      r.annual.count
                        ? r.commercial("year", "Room Revenue").bob! -
                            r.commercial("year", "Room Revenue").budget!
                        : null,
                    )}
                  </td>
                  <td>{n(r.commercial("year", "Room Nights").bob)}</td>
                  <td>{n(r.commercial("year", "ADR").bob)}</td>
                </tr>
              );
            })}
          <tr className="derived">
            <th>{report.annual.complete ? "Total" : "Partial total"}</th>
            {[1, 2, 3, 4].map((q) => {
              const v = report.commercial(`q${q}`, "Room Revenue");
              return (
                <Fragment key={q}>
                  <td>{n(v.budget)}</td>
                  <td>{n(v.bob)}</td>
                  <td>
                    {n(
                      v.budget !== null && v.bob !== null
                        ? v.bob - v.budget
                        : null,
                    )}
                  </td>
                </Fragment>
              );
            })}
            <td>{n(report.commercial("year", "Room Revenue").budget)}</td>
            <td>{n(report.commercial("year", "Room Revenue").bob)}</td>
            <td>
              {n(
                report.annual.count
                  ? report.commercial("year", "Room Revenue").bob! -
                      report.commercial("year", "Room Revenue").budget!
                  : null,
              )}
            </td>
            <td>{n(report.commercial("year", "Room Nights").bob)}</td>
            <td>{n(report.commercial("year", "ADR").bob)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
