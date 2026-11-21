import { useEffect, useState } from "react";
import { loadProduction, productionChanged } from "./productionClient";
import { productionSummary, type ProductionData } from "./production";
import {
  defaultProperty,
  propertyStorageKey,
  type PropertyData,
  validProperty,
} from "./property";
import { formatMoney, formatNumber, formatInsightMoney } from "./format";
import DatePicker from "./DatePicker";
import { periodMonths } from "./totals";
import { markets } from "./model";
import { geographicMarket } from "./performanceSources";
import type { ProductionReportMode } from "./productionReports";
export default function ProductionAnalysis({
  year = 2026,
  market = null,
  initialDimension = "country",
  compactMoney = false,
  initialPeriod = "q1",
  reportTitle,
  snapshotMode = false,
  initialStatus = "CHECKED OUT",
}: {
  year?: number;
  market?: string | null;
  initialDimension?: ProductionReportMode;
  reportTitle?: string;
  snapshotMode?: boolean;
  initialStatus?: "CHECKED OUT" | "CANCELLED";
  compactMoney?: boolean;
  initialPeriod?: string;
}) {
  const money = compactMoney ? formatInsightMoney : formatMoney;
  const [data, setData] = useState<ProductionData | null>(null),
    [source, setSource] = useState(""),
    [error, setError] = useState("");
  const [from, setFrom] = useState(`${year}-01-01`),
    [to, setTo] = useState(`${year}-03-31`),
    [dimension, setDimension] = useState(initialDimension),
    [status, setStatus] = useState(initialStatus);
  const [countryFilter, setCountryFilter] = useState(""),
    [roomFilter, setRoomFilter] = useState(""),
    [mealFilter, setMealFilter] = useState("");
  const [property, setProperty] = useState<PropertyData>(defaultProperty);
  useEffect(() => {
    const months = periodMonths(initialPeriod),
      first = months[0],
      last = months[months.length - 1];
    setFrom(`${year}-${String(first).padStart(2, "0")}-01`);
    setTo(new Date(Date.UTC(year, last, 0)).toISOString().slice(0, 10));
  }, [year, initialPeriod]);
  useEffect(() => {
    try {
      const p = JSON.parse(
        localStorage.getItem("business-eye-local-property") ||
          localStorage.getItem(propertyStorageKey) ||
          "null",
      );
      if (p?.data && validProperty(p.data)) setProperty(p.data);
    } catch {}
  }, []);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const b = await loadProduction();
        if (active) {
          setData(b.data);
          setSource(b.source);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void load();
    if (!snapshotMode) window.addEventListener(productionChanged, load);
    const timer = snapshotMode ? null : setInterval(load, 60000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      window.removeEventListener(productionChanged, load);
    };
  }, []);
  const baseSummary = data
    ? productionSummary(
        {
          ...data,
          days: data.days.filter(
            (r) =>
              (!countryFilter || r.country === countryFilter) &&
              (!roomFilter || r.room === roomFilter) &&
              (!mealFilter || r.meal === mealFilter),
          ),
        },
        from,
        to,
        market,
        ["pace", "market", "monthly"].includes(dimension)
          ? "country"
          : (dimension as "country" | "room" | "meal" | "segment"),
        status,
      )
    : null;
  const summary = (() => {
    if (!data || !baseSummary) return null;
    if (!["market", "monthly"].includes(dimension)) return baseSummary;
    const groups = new Map<
      string,
      { code: string; nights: number; revenue: number; arrivals: number }
    >();
    for (const r of data.days) {
      if (
        r.date < from ||
        r.date > to ||
        r.status !== status ||
        (market && geographicMarket(r.country) !== market) ||
        (countryFilter && r.country !== countryFilter) ||
        (roomFilter && r.room !== roomFilter) ||
        (mealFilter && r.meal !== mealFilter)
      )
        continue;
      const code =
        dimension === "monthly"
          ? r.date.slice(0, 7)
          : (markets.find((m) => m.id === geographicMarket(r.country))?.name ??
            "Unmapped country");
      const g = groups.get(code) ?? {
        code,
        nights: 0,
        revenue: 0,
        arrivals: 0,
      };
      g.nights += r.nights;
      g.revenue += r.revenue;
      g.arrivals += r.arrivals;
      groups.set(code, g);
    }
    return {
      ...baseSummary,
      groups: [...groups.values()].sort((a, b) =>
        dimension === "monthly"
          ? a.code.localeCompare(b.code)
          : b.revenue - a.revenue,
      ),
    };
  })();
  const roomName = (code: string) =>
    property.villaCategories.find((v) => v.code === code)?.name ??
    `${code} · unmapped room code`;
  const mealName = (code: string) =>
    Object.entries(property.mealPlanCodes ?? {}).find(
      ([, v]) => v === code,
    )?.[0] ?? `${code} · unmapped meal code`;
  const label = (code: string) =>
    dimension === "room"
      ? roomName(code)
      : dimension === "meal"
        ? mealName(code)
        : code;
  const csv = () => {
    if (!summary) return;
    const rows =
      dimension === "pace"
        ? [
            [
              "Confirmation date (whole surviving checked-out cohort)",
              "Bookings",
              "Stay value",
            ],
            ...data!.pace.map((r) => [r.date, r.bookings, r.revenue]),
          ]
        : [
            [
              "Code",
              "Description",
              "Reservation stay-nights",
              "Allocated stay revenue",
              "Arrivals",
            ],
            ...summary.groups.map((r) => [
              r.code,
              label(r.code),
              r.nights,
              r.revenue,
              r.arrivals,
            ]),
          ];
    const blob = new Blob(
      [
        rows
          .map((r) =>
            r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
          )
          .join("\r\n"),
      ],
      { type: "text/csv" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `production-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <section className="panel primary-source-analysis production-analysis">
      <h2>
        {reportTitle ?? "Commercial performance"} · {year}
      </h2>
      {snapshotMode && (
        <p>
          Generated from a fixed copy of the uploaded production figures for
          this report. Changing the filters below recalculates this copy; later
          uploads do not change it.
        </p>
      )}
      <p role="status">
        {source || "Loading uploaded figures and preparing report…"}
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="report-filters">
        <label>
          Stay From
          <DatePicker
            label="Production analysis from"
            value={from}
            onChange={setFrom}
          />
        </label>
        <label>
          Stay To
          <DatePicker
            label="Production analysis to"
            value={to}
            onChange={setTo}
          />
        </label>
        <label>
          Breakdown
          <select
            aria-label="Production breakdown"
            value={dimension}
            onChange={(e) => setDimension(e.target.value as typeof dimension)}
          >
            <option value="market">Geographic markets</option>
            <option value="monthly">Monthly performance</option>
            <option value="country">Country / nationality</option>
            <option value="room">Room type</option>
            <option value="meal">Meal plan</option>
            <option value="segment">Retail / Wholesale / other</option>
            <option value="pace">Booking confirmation timing</option>
          </select>
        </label>
        {data &&
          (
            [
              ["country", "Country", countryFilter, setCountryFilter],
              ["room", "Room type", roomFilter, setRoomFilter],
              ["meal", "Meal plan", mealFilter, setMealFilter],
            ] as const
          ).map(([key, title, value, setter]) => (
            <label key={key}>
              {title} filter
              <select
                aria-label={`Production ${key} filter`}
                value={value}
                onChange={(e) => setter(e.target.value)}
              >
                <option value="">All {title.toLowerCase()} codes</option>
                {[...new Set(data.days.map((r) => r[key]))]
                  .sort()
                  .map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
              </select>
            </label>
          ))}
        <label>
          Reservation status
          <select
            aria-label="Production status"
            value={status}
            onChange={(e) =>
              setStatus(e.target.value as "CHECKED OUT" | "CANCELLED")
            }
          >
            <option value="CHECKED OUT">Checked out · completed stays</option>
            <option value="CANCELLED">Cancelled · potential stays</option>
          </select>
        </label>
      </div>
      {from && to && from > to ? (
        <p role="alert">Choose an end date on or after the start.</p>
      ) : (
        data &&
        summary && (
          <>
            <div className="stats-grid">
              <article className="stat">
                <span>Reservation stay-nights</span>
                <strong>{formatNumber(summary.nights)}</strong>
              </article>
              <article className="stat">
                <span>
                  {status === "CANCELLED"
                    ? "Cancelled potential stay value"
                    : "Allocated stay revenue"}
                </span>
                <strong>{money(summary.revenue)}</strong>
              </article>
              <article className="stat">
                <span>Complimentary / house-use stay-nights</span>
                <strong>{formatNumber(summary.complimentary)}</strong>
              </article>
              <article className="stat">
                <span>Arrivals within selected dates</span>
                <strong>{formatNumber(summary.arrivals)}</strong>
              </article>
            </div>
            {!summary.groups.length && (
              <p role="status">
                No records for the selected dates/market. This is not a verified
                zero-performance period.
              </p>
            )}
            {dimension === "pace" ? (
              <>
                <h3>
                  Confirmation-month timing for surviving checked-out bookings
                </h3>
                <p>
                  Whole uploaded arrival cohort only; not filtered by the stay
                  dates, market, code filters or status above. Not historical
                  on-books pickup: cancelled and modified states at past
                  snapshots are unknown.
                </p>
                {Array.from(
                  new Set(data.pace.map((r) => r.date.slice(0, 7))),
                ).map((month) => {
                  const rows = data.pace.filter((r) =>
                      r.date.startsWith(month),
                    ),
                    n = rows.reduce((a, r) => a + r.bookings, 0);
                  return (
                    <div className="production-bar" key={month}>
                      <span>{month}</span>
                      <meter
                        min={0}
                        max={data.checkedOut}
                        value={n}
                        aria-label={`${month} confirmations`}
                      />
                      <strong>{formatNumber(n)} bookings</strong>
                    </div>
                  );
                })}
              </>
            ) : (
              <>
                <h3>
                  {status === "CANCELLED" ? "Cancelled" : "Completed"}{" "}
                  performance by {dimension}
                </h3>
                {summary.groups.slice(0, 15).map((r) => (
                  <div className="production-bar" key={r.code}>
                    <span>{r.code}</span>
                    <meter
                      min={0}
                      max={Math.max(1, ...summary.groups.map((x) => x.revenue))}
                      value={Math.max(0, r.revenue)}
                      aria-label={`${label(r.code)} allocated revenue`}
                    />
                    <strong>{money(r.revenue)}</strong>
                  </div>
                ))}
                <p>Top 15 by allocated revenue; complete breakdown below.</p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Code / description</th>
                        <th>Stay-nights</th>
                        <th>Allocated revenue</th>
                        <th>Arrivals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.groups.map((r) => (
                        <tr key={r.code}>
                          <td>
                            {r.code} · {label(r.code)}
                          </td>
                          <td>{formatNumber(r.nights)}</td>
                          <td>{money(r.revenue)}</td>
                          <td>{formatNumber(r.arrivals)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <div className="editor-actions">
              <button className="button outline" onClick={csv}>
                Export CSV breakdown
              </button>
              <button className="button outline" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>
            <p>
              {data.rows} source records: {data.checkedOut} checked out /{" "}
              {data.cancelled} cancelled. Export arrivals cover Q1 2026;
              departures extend to {data.to}. Missing revenue records:{" "}
              {data.missingRevenue}. Unknown codes are retained, not guessed.
            </p>
            <ul className="production-caveats">
              {data.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </>
        )
      )}
    </section>
  );
}
