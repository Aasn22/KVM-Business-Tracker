import { useState } from "react";
import { ArrowDownToLine, LockKeyhole, Printer } from "lucide-react";
import {
  adr,
  markets,
  months,
  percentage,
  summarize,
  type Entry,
} from "./model";
import { totalReview, type ReviewSection } from "./totals";
import { exportWorkbook } from "./workbooks";
const number = (value: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
  const [period, setPeriod] = useState("year");
  const [section, setSection] = useState<ReviewSection>("commercial");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const review = totalReview(entries, year, period);
  const totals = summarize(review.sources);
  const revenue = review.data.commercial.find(
    (r) => r.label === "Room Revenue",
  );
  const nights = review.data.commercial.find((r) => r.label === "Room Nights");
  const periodLabel =
    period === "year"
      ? "Full year"
      : period.startsWith("q")
        ? `Quarter ${period[1]}`
        : months[Number(period) - 1];
  async function download() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await exportWorkbook(
        review.monthly.map((e) => ({
          ...e,
          data: {
            ...e.data,
            notes: `${demo ? "Fictional demo data. " : ""}${e.data.notes}`,
          },
        })),
        `KVM-total-budget-${year}-${period}`,
      );
      setMessage(
        `Total Budget Review Excel report generated for ${year} · ${periodLabel}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <section className="panel report-filters total-controls">
        <label>
          Review period
          <select
            aria-label="Total review period"
            value={period}
            disabled={busy || loading}
            onChange={(e) => {
              setPeriod(e.target.value);
              setMessage("");
            }}
          >
            <option value="year">Full year</option>
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={`q${q}`}>
                Quarter {q}
              </option>
            ))}
            {months.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button outline"
          disabled={busy || loading || !review.sources.length}
          onClick={download}
        >
          <ArrowDownToLine size={16} />
          {busy ? "Generating…" : "Export total report"}
        </button>
        <button
          className="button outline"
          disabled={busy || loading || !review.sources.length}
          onClick={() => window.print()}
        >
          <Printer size={16} />
          Print / Save PDF
        </button>
      </section>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      <div className="notice total-coverage">
        <strong>
          {demo ? "Fictional demo data · " : ""}
          {loading ? "Loading market records…" : review.notice}
        </strong>
        <p>
          <LockKeyhole size={13} /> Read-only roll-up. Update individual market
          tabs to change these totals. FULL BUDGET.xlsx is not added again.
        </p>
        {!loading && review.missing.length > 0 && (
          <details>
            <summary>
              View missing market-month records ({review.missing.length})
            </summary>
            <ul>
              {markets.map((m) => {
                const missing = review.missing.filter(
                  (item) => item.market === m.name,
                );
                return missing.length ? (
                  <li key={m.id}>
                    {m.name}:{" "}
                    {missing.map((item) => months[item.month - 1]).join(", ")}
                  </li>
                ) : null;
              })}
            </ul>
          </details>
        )}
      </div>
      <section className="stats-grid">
        <TotalStat title="Total revenue budget" value={money(totals.budget)} />
        <TotalStat title="Total BOB revenue" value={money(totals.bob)} />
        <TotalStat
          title="Revenue variance"
          value={money(totals.bob - totals.budget)}
        />
        <TotalStat
          title="Budget achievement"
          value={`${percentage(totals.bob, totals.budget).toFixed(1)}%`}
        />
      </section>
      <section className="panel total-review-report">
        <div className="section-heading">
          <div>
            <h2>
              Total Budget Review · {year} · {periodLabel}
            </h2>
            <p>
              {review.complete
                ? "Five-market total"
                : "Partial accessible-market total"}{" "}
              · {review.coverage} · USD ·{" "}
              {demo ? "Fictional figures" : "Saved figures only"}
            </p>
          </div>
        </div>
        {!review.sources.length ? (
          <div className="empty">
            No saved market records are available for this period. Sign in with
            the appropriate access or import data through the market tabs.
          </div>
        ) : (
          <>
            <div className="editor-subheader">
              <div className="detail-tabs">
                {(
                  [
                    ["commercial", "Commercial targets"],
                    ["villas", "Villa types"],
                    ["countries", "Countries"],
                    ["meals", "Meal plans"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    className={section === key ? "active" : ""}
                    onClick={() => setSection(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <span className="save-status">Calculated · read-only</span>
            </div>
            <p className="total-table-note">
              {period === "year" || period.startsWith("q")
                ? "Weekly columns sum the same week across the selected months. "
                : "Weekly figures reflect the selected month. "}
              BOB snapshots are not added to monthly BOB. Breakdown figures
              retain their source units and do not automatically reconcile to
              commercial totals.
            </p>
            <div className="table-scroll">
              <table className="total-table">
                <thead>
                  <tr>
                    <th>
                      {section === "commercial"
                        ? "KPI"
                        : section === "villas"
                          ? "Villa category"
                          : section === "countries"
                            ? "Country"
                            : "Meal plan"}
                    </th>
                    <th>Budget</th>
                    <th>BOB</th>
                    <th>Variance</th>
                    {[1, 2, 3, 4].map((w) => (
                      <th key={w} colSpan={2}>
                        Week {w === 4 ? "4/5" : w}
                      </th>
                    ))}
                  </tr>
                  <tr className="subhead">
                    <th />
                    <th />
                    <th />
                    <th />
                    {[1, 2, 3, 4].map((w) => (
                      <WeekHead key={w} />
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {review.data[section].map((r) => (
                    <tr key={r.label}>
                      <th>{r.label}</th>
                      <td>{number(r.budget)}</td>
                      <td>{number(r.bob)}</td>
                      <td
                        className={r.bob < r.budget ? "negative" : "positive"}
                      >
                        {number(r.bob - r.budget)}
                      </td>
                      {r.targets.map((target, i) => (
                        <WeekValues key={i} target={target} bob={r.weekly[i]} />
                      ))}
                    </tr>
                  ))}
                  {section === "commercial" && revenue && nights && (
                    <tr className="derived">
                      <th>ADR (weighted)</th>
                      <td>{number(adr(revenue.budget, nights.budget))}</td>
                      <td>{number(adr(revenue.bob, nights.bob))}</td>
                      <td>
                        {number(
                          adr(revenue.bob, nights.bob) -
                            adr(revenue.budget, nights.budget),
                        )}
                      </td>
                      {revenue.targets.map((v, i) => (
                        <WeekValues
                          key={i}
                          target={adr(v, nights.targets[i])}
                          bob={adr(revenue.weekly[i], nights.weekly[i])}
                        />
                      ))}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>Market contributions</h2>
            <p>
              Each saved market record is counted once. Missing or inaccessible
              records are not assumed to be zero.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Market</th>
                <th>Available months</th>
                <th>Revenue budget</th>
                <th>Revenue BOB</th>
                <th>Variance</th>
                <th>BOB nights</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((m) => {
                const records = review.sources.filter(
                  (e) => e.market_id === m.id,
                );
                const t = summarize(records);
                return (
                  <tr key={m.id}>
                    <th>{m.name}</th>
                    <td>
                      {records.length}/{review.expectedMonths.length}
                    </td>
                    <td>
                      {records.length ? money(t.budget) : "Not available"}
                    </td>
                    <td>{records.length ? money(t.bob) : "—"}</td>
                    <td>{records.length ? money(t.bob - t.budget) : "—"}</td>
                    <td>{records.length ? number(t.booked) : "—"}</td>
                  </tr>
                );
              })}
              <tr className="derived">
                <th>{review.complete ? "Total" : "Partial total"}</th>
                <td>{review.coverage}</td>
                <td>{money(totals.budget)}</td>
                <td>{money(totals.bob)}</td>
                <td>{money(totals.bob - totals.budget)}</td>
                <td>{number(totals.booked)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function TotalStat({ title, value }: { title: string; value: string }) {
  return (
    <article className="stat">
      <div>
        <span>{title}</span>
      </div>
      <strong>{value}</strong>
      <small>Selected period · accessible saved records</small>
    </article>
  );
}
function WeekHead() {
  return (
    <>
      <th>Target</th>
      <th>BOB</th>
    </>
  );
}
function WeekValues({ target, bob }: { target: number; bob: number }) {
  return (
    <>
      <td>{number(target)}</td>
      <td>{number(bob)}</td>
    </>
  );
}
