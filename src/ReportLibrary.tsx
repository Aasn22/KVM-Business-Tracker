import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Download,
  FileChartColumn,
  Globe2,
  Layers,
  PieChart,
  BriefcaseBusiness,
  ChartNoAxesCombined,
  CircleX,
  Hotel,
  Play,
  Printer,
  X,
} from "lucide-react";
import { formatMoney, formatNumber } from "./format";
import { budgetYears, markets, months, type Entry } from "./model";
import OperationalReports from "./OperationalReports";
import ProductionAnalysis from "./ProductionAnalysis";
import {
  productionReportMode,
  type ProductionReportMode,
} from "./productionReports";
import type { OperationKind } from "./operational";
import { quickReports, quickReportPeriod } from "./quickReports";
import {
  reportTypes,
  generateReport,
  generationStages,
  periodLabel,
  exportVisualReport,
  type ReportType,
  type ReportSnapshot,
  type ReportMetric,
} from "./reportEngine";
const quickIcons = [
  Hotel,
  ChartNoAxesCombined,
  Layers,
  BriefcaseBusiness,
  Layers,
  Building2,
  BarChart3,
  Globe2,
  CircleX,
  Hotel,
  CalendarDays,
  PieChart,
  FileChartColumn,
];
export function QuickReports({
  group,
  loading,
  onSelect,
}: {
  group: string;
  loading: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="quick-reports" aria-labelledby="quick-reports-heading">
      <h3 id="quick-reports-heading">QUICK REPORTS</h3>
      <p>
        Select a shortcut. Period reports use your selected month/quarter;
        otherwise January or Quarter 1. Yearly uses the full year.
      </p>
      <div className="quick-report-grid">
        {quickReports
          .filter((r) => {
            if (group === "All") return true;
            const type = reportTypes.find((t) => t.id === r.type);
            if (r.operational) return group === "All" || group === "Revenue";
            return group === "Unavailable inputs"
              ? !!r.unavailable
              : type?.group === group;
          })
          .map((r) => {
            const Icon = quickIcons[quickReports.indexOf(r)];
            return (
              <button
                className="quick-report-button"
                key={r.id}
                disabled={loading}
                onClick={() => onSelect(r.id)}
                title={r.unavailable ? `${r.title}: inputs required` : r.title}
              >
                <Icon size={21} aria-hidden="true" />
                <span>
                  {r.title}
                  {r.unavailable && <small>Inputs required</small>}
                </span>
              </button>
            );
          })}
      </div>
    </section>
  );
}
const colors = [
  "#c5a46d",
  "#69b4aa",
  "#8d9dc9",
  "#c88777",
  "#a898c7",
  "#a5b77d",
];
const fmt = (v: number | null, currency = false) =>
  currency ? formatMoney(v) : formatNumber(v, 1);
const detailFmt = (v: number | null, currency = false) =>
  currency ? formatMoney(v) : formatNumber(v, 2);
const pct = (r: ReportMetric) =>
  r.budget && r.bob !== null
    ? `${((r.bob / r.budget) * 100).toFixed(1)}%`
    : "—";
function PairBars({
  title,
  rows,
  currency = true,
  note,
}: {
  title: string;
  rows: ReportMetric[];
  currency?: boolean;
  note?: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget ?? 0, r.bob ?? 0]));
  return (
    <section className="visual-panel">
      <h3>{title}</h3>
      <div className="visual-legend">
        <span>
          <i className="budget-key" />
          Budget
        </span>
        <span>
          <i className="bob-key" />
          BOB
        </span>
      </div>
      <div className="visual-pairs">
        {!rows.length && <p>No saved category figures available.</p>}
        {rows.map((r) => (
          <div className="visual-pair" key={r.label}>
            <div>
              <strong>{r.label}</strong>
              <small>
                {r.count === undefined
                  ? ""
                  : `${r.count}/${r.expected} records`}
              </small>
            </div>
            {r.budget === null ? (
              <p>No saved figures</p>
            ) : (
              <div className="visual-pair-bars">
                <div>
                  <span
                    className="visual-budget"
                    style={{ width: `${(r.budget / max) * 100}%` }}
                  />
                  <b>{fmt(r.budget, currency)}</b>
                </div>
                <div>
                  <span
                    className="visual-bob"
                    style={{ width: `${((r.bob ?? 0) / max) * 100}%` }}
                  />
                  <b>{fmt(r.bob, currency)}</b>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {note && <p className="visual-note">{note}</p>}
    </section>
  );
}
function Trend({ rows }: { rows: ReportMetric[] }) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget ?? 0, r.bob ?? 0]));
  const x = (i: number) => 35 + (i * 570) / Math.max(1, rows.length - 1),
    y = (v: number) => 190 - (v / max) * 155;
  return (
    <section className="visual-panel">
      <h3>Monthly revenue direction</h3>
      <div className="visual-legend">
        <span>
          <i className="budget-key" />
          Budget
        </span>
        <span>
          <i className="bob-key" />
          BOB
        </span>
      </div>
      <svg
        className="visual-trend"
        viewBox="0 0 640 230"
        role="img"
        aria-label="Monthly budget and BOB trend. Exact values and missing records are in the monthly table below."
      >
        {[0, 0.5, 1].map((n) => (
          <g key={n}>
            <line
              x1="35"
              x2="605"
              y1={y(n * max)}
              y2={y(n * max)}
              stroke="#c5a46d25"
            />
            <text x="35" y={y(n * max) - 6} fill="#d9c49e" fontSize="10">
              {fmt(n * max, true)}
            </text>
          </g>
        ))}
        {(["budget", "bob"] as const).map((key, k) => (
          <g key={key}>
            {rows.map((r, i) => (
              <g key={r.label}>
                {i > 0 && r[key] !== null && rows[i - 1][key] !== null && (
                  <line
                    x1={x(i - 1)}
                    y1={y(rows[i - 1][key]!)}
                    x2={x(i)}
                    y2={y(r[key]!)}
                    stroke={k === 0 ? "#c5a46d" : "#69b4aa"}
                    strokeWidth="2"
                  />
                )}
                {r[key] !== null && (
                  <circle
                    cx={x(i)}
                    cy={y(r[key]!)}
                    r="3"
                    fill={k === 0 ? "#c5a46d" : "#69b4aa"}
                  />
                )}
              </g>
            ))}
          </g>
        ))}
        {rows.map((r, i) => (
          <text
            key={r.label}
            x={x(i)}
            y="215"
            textAnchor="middle"
            fill="#d9c49e"
            fontSize="10"
          >
            {r.label.slice(0, 3)}
          </text>
        ))}
      </svg>
      <p className="visual-note">
        Missing months create gaps, not zero values. This shows saved monthly
        BOB, not a daily pickup or forecast series.
      </p>
    </section>
  );
}
function Contribution({ rows }: { rows: ReportMetric[] }) {
  const known = rows.filter((r) => r.bob !== null && r.bob > 0),
    total = known.reduce((s, r) => s + r.bob!, 0);
  let start = 0;
  const gradient = known
    .map((r, i) => {
      const end = start + (r.bob! / total) * 100;
      const val = `${colors[i % colors.length]} ${start}% ${end}%`;
      start = end;
      return val;
    })
    .join(",");
  return (
    <section className="visual-panel">
      <h3>Revenue on books · market mix</h3>
      {total > 0 ? (
        <div className="visual-mix">
          <div
            className="visual-donut"
            role="img"
            aria-label={`BOB contribution: ${known.map((r) => `${r.label} ${((r.bob! / total) * 100).toFixed(1)}%`).join(", ")}`}
            style={{ background: `conic-gradient(${gradient})` }}
          >
            <span>
              {fmt(total, true)}
              <small>Total BOB</small>
            </span>
          </div>
          <ul>
            {known.map((r, i) => (
              <li key={r.label}>
                <i style={{ background: colors[i % colors.length] }} />
                {r.label}
                <strong>{((r.bob! / total) * 100).toFixed(1)}%</strong>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="visual-note">
          No positive BOB revenue to chart. Recorded zeros remain zeros; missing
          records are excluded.
        </p>
      )}
      <p className="visual-note">
        Share of available saved BOB only. Missing markets are not assumed to
        have zero business.
      </p>
    </section>
  );
}
function DetailTable({
  title,
  rows,
  currency = true,
  nights = false,
}: {
  title: string;
  rows: ReportMetric[];
  currency?: boolean;
  nights?: boolean;
}) {
  return (
    <section className="visual-panel">
      <h3>{title}</h3>
      <div className="table-scroll">
        <table className="visual-table">
          <caption>
            {currency ? "$ amounts" : "Source units"} · rounded for display;
            source precision retained in Excel; — means unavailable
          </caption>
          <thead>
            <tr>
              <th>Category / period</th>
              <th>Budget</th>
              <th>BOB</th>
              <th>Variance</th>
              <th>Achievement</th>
              {nights && (
                <>
                  <th>Budget nights</th>
                  <th>BOB nights</th>
                  <th>Budget ADR</th>
                  <th>BOB ADR</th>
                </>
              )}
              <th>Coverage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th>{r.label}</th>
                <td>{detailFmt(r.budget, currency)}</td>
                <td>{detailFmt(r.bob, currency)}</td>
                <td>
                  {detailFmt(
                    r.budget === null || r.bob === null
                      ? null
                      : r.bob - r.budget,
                    currency,
                  )}
                </td>
                <td>{pct(r)}</td>
                {nights && (
                  <>
                    <td>{detailFmt(r.budgetNights ?? null)}</td>
                    <td>{detailFmt(r.bobNights ?? null)}</td>
                    <td>
                      {detailFmt(
                        r.budgetNights && r.budget !== null
                          ? r.budget / r.budgetNights
                          : null,
                        true,
                      )}
                    </td>
                    <td>
                      {detailFmt(
                        r.bobNights && r.bob !== null
                          ? r.bob / r.bobNights
                          : null,
                        true,
                      )}
                    </td>
                  </>
                )}
                <td>
                  {r.count === undefined
                    ? "Source categories"
                    : `${r.count}/${r.expected}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
export function VisualReport({ report }: { report: ReportSnapshot }) {
  const breakdown = ["villas", "countries", "meals"].includes(report.type);
  const comparison = breakdown
    ? report.breakdown
    : report.type === "monthly"
      ? report.byMonth
      : report.type === "nights"
        ? report.byMarket.map((r) => ({
            ...r,
            budget: r.budgetNights ?? null,
            bob: r.bobNights ?? null,
          }))
        : report.byMarket;
  const best = report.byMarket
    .filter((r) => r.bob !== null)
    .sort((a, b) => b.bob! - a.bob!)[0];
  const gap = report.revenue.budget! - report.revenue.bob!;
  return (
    <article className="generated-report print-report">
      <header className="visual-report-head">
        <div className="eyebrow">KVM BUSINESS LENSE · REPORT SNAPSHOT</div>
        <h2>{report.title}</h2>
        <p>
          {report.year} · {periodLabel(report.period)} ·{" "}
          {report.market === "all"
            ? "All available markets"
            : markets.find((m) => m.id === report.market)?.name}
        </p>
        <p>
          Generated{" "}
          {new Date(report.generatedAt).toLocaleString("en-GB", {
            timeZone: "UTC",
          })}{" "}
          UTC · {report.source}
        </p>
        <p>
          Last saved data:{" "}
          {report.lastUpdatedAt
            ? `${new Date(report.lastUpdatedAt).toLocaleString("en-GB", { timeZone: "UTC" })} UTC`
            : "Timestamp unavailable in source"}
        </p>
      </header>
      <div className="report-source-note">
        <strong>
          {report.entries.length}/{report.expected} market-month records
          available.
        </strong>{" "}
        {report.missing.length
          ? `Partial snapshot: ${report.missing.length} records missing. No missing values estimated.`
          : "Complete coverage for the selection."}{" "}
        BOB means bookings on the books, not realized revenue. This report does
        not estimate forecasts.
      </div>
      {report.limitation && (
        <div className="report-source-note">
          <strong>Report scope:</strong> {report.limitation}
        </div>
      )}
      <div className="visual-kpis">
        {[report.revenue, report.nights, report.adr].map((r, i) => (
          <section key={r.label}>
            <span>
              {r.label}
              {i === 0 ? " on books" : ""}
            </span>
            <strong>{fmt(r.bob, i !== 1)}</strong>
            <small>Budget {fmt(r.budget, i !== 1)}</small>
            {i === 0 && <small>{pct(r)} of budget</small>}
          </section>
        ))}
      </div>
      <section className="visual-panel visual-summary">
        <h3>Executive reading</h3>
        <p>
          For the available records, revenue on books is{" "}
          <strong>{fmt(report.revenue.bob, true)}</strong> against a budget of{" "}
          <strong>{fmt(report.revenue.budget, true)}</strong>.{" "}
          {gap >= 0
            ? `${fmt(gap, true)} remains to reach budget.`
            : `BOB exceeds budget by ${fmt(-gap, true)}.`}{" "}
          {best
            ? `${best.label} has the largest saved BOB contribution at ${fmt(best.bob, true)}.`
            : ""}
        </p>
        <p>
          ADR is weighted revenue divided by room nights, not an average of
          market ADRs. Coverage and source definitions should be reviewed before
          making commercial or pricing decisions.
        </p>
      </section>
      <div className="visual-chart-grid">
        <PairBars
          title={
            breakdown
              ? "Category budget vs BOB"
              : report.type === "nights"
                ? "Room-night performance"
                : report.type === "monthly"
                  ? "Monthly revenue comparison"
                  : "Market revenue comparison"
          }
          rows={comparison}
          currency={!breakdown && report.type !== "nights"}
          note={
            breakdown
              ? "Independent source-sheet units. They may represent different measures; verify source definitions and do not add category figures to commercial revenue."
              : "Bars share a common zero baseline; numeric labels preserve values."
          }
        />
        {report.type === "monthly" || report.type === "executive" ? (
          <Trend rows={report.byMonth} />
        ) : (
          <Contribution rows={report.byMarket} />
        )}
      </div>
      {report.type === "executive" && <Contribution rows={report.byMarket} />}
      {breakdown && (
        <DetailTable
          title="Category detail"
          rows={report.breakdown}
          currency={false}
        />
      )}
      <DetailTable title="Market detail" rows={report.byMarket} nights />
      <DetailTable title="Monthly detail" rows={report.byMonth} nights />
      <DetailTable
        title="Weekly revenue targets and BOB snapshots"
        rows={report.weekly}
      />
      <section className="visual-panel">
        <h3>Read before sharing</h3>
        <p>
          Weekly BOB and monthly BOB are independently saved snapshots; they are
          not added together. Villa, country and meal-plan breakdowns are
          independent inputs and may not reconcile to commercial totals. This is
          a fixed report captured at generation time, not an automatically
          changing view.
        </p>
        {report.missing.length > 0 && (
          <details>
            <summary>Missing records ({report.missing.length})</summary>
            <ul>
              {report.missing.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </article>
  );
}
export default function ReportLibrary({
  entries,
  year,
  source,
  loading,
  onYearChange,
}: {
  onYearChange?: (year: number) => void;
  entries: Entry[];
  year: number;
  source: string;
  loading: boolean;
}) {
  const [entered, setEntered] = useState(false),
    [market, setMarket] = useState("all"),
    [period, setPeriod] = useState("year"),
    [group, setGroup] = useState("All"),
    [type, setType] = useState<ReportType>("executive"),
    [title, setTitle] = useState("");
  const [stage, setStage] = useState<number | null>(null),
    [error, setError] = useState(""),
    [snapshot, setSnapshot] = useState<ReportSnapshot | null>(null),
    [recent, setRecent] = useState<ReportSnapshot[]>([]),
    [exporting, setExporting] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [productionPeriod, setProductionPeriod] = useState("q1");
  const [productionOpen, setProductionOpen] =
    useState<ProductionReportMode | null>(null);
  const [productionStatus, setProductionStatus] = useState<
    "CHECKED OUT" | "CANCELLED"
  >("CHECKED OUT");
  const [productionTitle, setProductionTitle] = useState("");
  const [basis, setBasis] = useState<"production" | "budget">("production");
  const [reportYear, setReportYear] = useState(2026);
  const [operational, setOperational] = useState<OperationKind | null>(null);
  const [inputNotice, setInputNotice] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    controller.current = null;
    setStage(null);
    setSnapshot(null);
    setError("");
    setInputNotice(null);
  }, [year]);
  async function generate(
    selected: ReportType,
    custom = false,
    quick?: { title: string; period: string; limitation?: string },
  ) {
    if (stage !== null || loading) return;
    if (basis === "production") {
      setProductionStatus("CHECKED OUT");
      setProductionTitle(
        quick?.title ||
          (custom && title.trim()) ||
          reportTypes.find((t) => t.id === selected)?.title ||
          "Report",
      );
      setProductionPeriod(quick?.period ?? period);
      setProductionOpen(productionReportMode(selected));
      return;
    }
    const current = new AbortController();
    controller.current = current;
    setError("");
    setStage(0);
    try {
      const result = await generateReport(
        entries,
        {
          type: selected,
          title: quick?.title ?? (custom ? title : undefined),
          year,
          market,
          period: quick?.period ?? period,
          source,
          limitation: quick?.limitation,
        },
        current.signal,
        setStage,
      );
      if (!current.signal.aborted) {
        setSnapshot(result);
        setRecent((prev) => [result, ...prev].slice(0, 8));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (controller.current === current) {
        setStage(null);
        controller.current = null;
      }
    }
  }
  if (productionOpen)
    return (
      <section>
        <button
          className="button outline"
          onClick={() => setProductionOpen(null)}
        >
          Back to Reports Library
        </button>
        <ProductionAnalysis
          year={reportYear}
          market={market === "all" ? null : market}
          initialDimension={productionOpen}
          initialPeriod={productionPeriod}
          reportTitle={productionTitle}
          snapshotMode
          initialStatus={productionStatus}
        />
      </section>
    );
  if (operational)
    return (
      <div className="report-library">
        <OperationalReports
          kind={operational}
          onClose={() => setOperational(null)}
        />
      </div>
    );
  if (!entered)
    return (
      <section className="report-welcome">
        <img
          className="report-welcome-logo"
          src="/kuda-villingili-logo.png"
          alt="Kuda Villingili"
          width={200}
          height={200}
        />
        <div className="eyebrow">KVM BUSINESS LENSE · EXECUTIVE REPORTING</div>
        <h2>Clarity for every commercial decision.</h2>
        <p>
          Generate a visual snapshot of your saved performance. Clear
          intelligence for leadership and revenue teams.
        </p>
        <button className="report-gold-button" onClick={() => setEntered(true)}>
          <Play size={16} />
          Explore Report Library
        </button>
        <small>
          Budgets · market pace · room nights · category performance
        </small>
      </section>
    );
  if (stage !== null)
    return (
      <section className="report-generating">
        <div className="report-spinner" aria-hidden="true" />
        <h2>Your report is being prepared</h2>
        <p role="status" aria-live="polite">
          Step {stage + 1} of {generationStages.length} ·{" "}
          {generationStages[stage]}
        </p>
        <ol>
          {generationStages.map((s, i) => (
            <li key={s} className={i <= stage ? "completed" : ""}>
              {i < stage ? <Check size={14} /> : <span>{i + 1}</span>}
              {s}
            </li>
          ))}
        </ol>
        <button
          className="report-outline-button"
          autoFocus
          onClick={() => {
            controller.current?.abort();
            setError("Report generation cancelled. No snapshot was saved.");
          }}
        >
          <X size={16} />
          Cancel generation
        </button>
      </section>
    );
  return (
    <section className="report-library">
      {error && (
        <p className="report-error" role="alert">
          {error}
        </p>
      )}
      {snapshot ? (
        <>
          <div className="report-toolbar">
            <button
              className="report-outline-button"
              onClick={() => setSnapshot(null)}
            >
              <ArrowLeft size={16} />
              Report library
            </button>
            <button
              className="report-outline-button"
              onClick={() => window.print()}
            >
              <Printer size={16} />
              Print / Save PDF
            </button>
            <button
              className="report-gold-button"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                setError("");
                try {
                  await exportVisualReport(snapshot);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setExporting(false);
                }
              }}
            >
              <Download size={16} />
              {exporting ? "Preparing Excel…" : "Export snapshot Excel"}
            </button>
          </div>
          <VisualReport report={snapshot} />
        </>
      ) : (
        <>
          <header className="report-library-head">
            <div>
              <div className="eyebrow">REPORT LIBRARY</div>
              <h2>From saved data to a clear story.</h2>
              <p>
                Choose a report or build a tailored snapshot. Reports reflect
                saved records only—not unsaved input fields.
              </p>
            </div>
            <button
              className="report-gold-button"
              aria-expanded={customOpen}
              aria-controls="custom-report-builder"
              onClick={() => setCustomOpen(!customOpen)}
            >
              <FileChartColumn size={17} />
              {customOpen ? "Hide Custom Report" : "Generate Your Own Report"}
            </button>
          </header>
          <div className="report-controls report-source-controls">
            <label>
              Report data
              <select
                aria-label="Report data source"
                value={basis}
                onChange={(e) => setBasis(e.target.value as typeof basis)}
              >
                <option value="production">
                  Uploaded reservation production
                </option>
                <option value="budget">Budget / legacy BOB planning</option>
              </select>
            </label>
            <label>
              Report year
              <select
                aria-label="Quick report year"
                value={basis === "production" ? reportYear : year}
                onChange={(e) =>
                  basis === "production"
                    ? setReportYear(Number(e.target.value))
                    : onYearChange?.(Number(e.target.value))
                }
              >
                {budgetYears.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
            </label>
          </div>
          {customOpen && (
            <section id="custom-report-builder">
              <p className="report-selected-source">{source}</p>
              <div className="report-controls">
                <label>
                  Report year
                  <select
                    aria-label="Report year"
                    value={basis === "production" ? reportYear : year}
                    onChange={(e) =>
                      basis === "production"
                        ? setReportYear(Number(e.target.value))
                        : onYearChange?.(Number(e.target.value))
                    }
                  >
                    {budgetYears.map((y) => (
                      <option value={y} key={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Market
                  <select
                    aria-label="Report market"
                    value={market}
                    onChange={(e) => setMarket(e.target.value)}
                  >
                    <option value="all">All available markets</option>
                    {markets.map((m) => (
                      <option value={m.id} key={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reporting period
                  <select
                    aria-label="Report period"
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
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
                <label>
                  Category
                  <select
                    aria-label="Report category"
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  >
                    {[
                      "All",
                      "Executive",
                      "Revenue",
                      "Breakdowns",
                      "Unavailable inputs",
                    ].map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                </label>
              </div>
              <section className="report-builder">
                <div>
                  <h3>
                    <FileChartColumn size={18} />
                    Build your report
                  </h3>
                  <p>
                    Set the title and visual report type; market, year and
                    period use your current selection.
                  </p>
                </div>
                <label>
                  Report title
                  <input
                    aria-label="Custom report title"
                    maxLength={100}
                    placeholder="e.g. Monthly commercial review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label>
                  Report type
                  <select
                    aria-label="Custom report type"
                    value={type}
                    onChange={(e) => setType(e.target.value as ReportType)}
                  >
                    {reportTypes.map((t) => (
                      <option value={t.id} key={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="report-gold-button"
                  disabled={loading}
                  onClick={() => void generate(type, true)}
                >
                  Generate report
                </button>
              </section>
            </section>
          )}
          <p className="report-selection">
            {basis === "production" ? reportYear : year} ·{" "}
            {market === "all"
              ? "All available markets"
              : markets.find((m) => m.id === market)?.name}{" "}
            · {periodLabel(period)}. Change selection using Generate Your Own
            Report.
          </p>
          {loading && (
            <p role="status">Loading saved data before generation…</p>
          )}
          <QuickReports
            group={customOpen ? group : "All"}
            loading={loading}
            onSelect={(id) => {
              const quick = quickReports.find((r) => r.id === id)!;
              if (basis === "production" && !quick.unavailable) {
                setProductionStatus(
                  quick.id === "cancellation" ? "CANCELLED" : "CHECKED OUT",
                );
                setProductionTitle(quick.title);
                setProductionPeriod(
                  quickReportPeriod(quick.periodMode, period),
                );
                setProductionOpen(productionReportMode(quick.id));
                return;
              }
              if (quick.operational) {
                setOperational(quick.operational);
                return;
              }
              if (quick.unavailable) {
                setInputNotice(`${quick.title}: ${quick.unavailable}`);
                return;
              }
              if (!quick.type) {
                setInputNotice(
                  `${quick.title}: budget/legacy inputs do not include this breakdown. Choose uploaded reservation production for this report.`,
                );
                return;
              }
              setInputNotice(null);
              const quickPeriod = quickReportPeriod(quick.periodMode, period);
              setPeriod(quickPeriod);
              void generate(quick.type!, false, {
                title: quick.title,
                period: quickPeriod,
                limitation: quick.limitation,
              });
            }}
          />
          {inputNotice && (
            <section className="report-input-notice" role="status">
              <h3>Additional inputs required</h3>
              <p>{inputNotice}</p>
              <button
                className="report-outline-button"
                onClick={() => setInputNotice(null)}
              >
                Dismiss
              </button>
            </section>
          )}
          {recent.length > 0 && (
            <section className="report-recent">
              <h3>Generated this visit</h3>
              <p>
                Fixed snapshots kept in this page session only. Export to retain
                them; changes to inputs won't rewrite a generated report.
              </p>
              <div>
                {recent.map((r, i) => (
                  <button
                    className="report-outline-button"
                    key={`${r.id}-${i}`}
                    onClick={() => setSnapshot(r)}
                  >
                    {r.title} · {r.year} · {periodLabel(r.period)}
                  </button>
                ))}
              </div>
            </section>
          )}
          <p className="report-disclaimer">
            BOB is bookings on the books, not actual revenue. Missing records
            remain unavailable. Browser-local input changes are available only
            in the local editor session; they do not update the public
            dashboard.
          </p>
        </>
      )}
    </section>
  );
}
