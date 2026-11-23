import { useEffect, useState } from "react";
import {
  loadProduction,
  productionChanged,
  watchProduction,
} from "./productionClient";
import {
  productionSummary,
  productionRowsForBasis,
  type ProductionBasis,
  type ProductionData,
} from "./production";
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
  initialBasis = "stay",
}: {
  year?: number;
  market?: string | null;
  initialDimension?: ProductionReportMode;
  reportTitle?: string;
  snapshotMode?: boolean;
  initialStatus?: string;
  initialBasis?: ProductionBasis;
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
  const [dateBasis, setDateBasis] = useState<ProductionBasis>(
    initialDimension === "pace" ? "booking" : initialBasis,
  );
  const [sourceFilter, setSourceFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
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
    const stopWatching = snapshotMode ? null : watchProduction(load);
    if (!snapshotMode) window.addEventListener(productionChanged, load);
    return () => {
      active = false;
      stopWatching?.();
      window.removeEventListener(productionChanged, load);
    };
  }, []);
  const eventData = data ? productionRowsForBasis(data, dateBasis) : null;
  const analysisData = data ? { ...data, days: eventData!.rows } : null;
  const legacyUnavailable =
    !!data &&
    !data.reservations &&
    (dateBasis !== "stay" ||
      status === "NO SHOW" ||
      ["source", "agent", "marketCode"].includes(dimension));
  const baseSummary =
    analysisData && !legacyUnavailable
      ? productionSummary(
          {
            ...analysisData,
            days: analysisData.days.filter(
              (r) =>
                (!countryFilter || r.country === countryFilter) &&
                (!roomFilter || r.room === roomFilter) &&
                (!mealFilter || r.meal === mealFilter) &&
                (!sourceFilter || r.source === sourceFilter) &&
                (!agentFilter || r.agent === agentFilter),
            ),
          },
          from,
          to,
          market,
          ["pace", "market", "monthly"].includes(dimension)
            ? "country"
            : (dimension as
                | "country"
                | "room"
                | "meal"
                | "segment"
                | "source"
                | "agent"
                | "marketCode"),
          status,
        )
      : null;
  const summary = (() => {
    if (!analysisData || !baseSummary) return null;
    if (!["market", "monthly", "pace"].includes(dimension)) return baseSummary;
    const groups = new Map<
      string,
      { code: string; nights: number; revenue: number; arrivals: number }
    >();
    for (const r of analysisData.days) {
      if (
        r.date < from ||
        r.date > to ||
        (status !== "ALL" && r.status !== status) ||
        (market && geographicMarket(r.country) !== market) ||
        (countryFilter && r.country !== countryFilter) ||
        (roomFilter && r.room !== roomFilter) ||
        (mealFilter && r.meal !== mealFilter) ||
        (sourceFilter && r.source !== sourceFilter) ||
        (agentFilter && r.agent !== agentFilter)
      )
        continue;
      const code = ["monthly", "pace"].includes(dimension)
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
        ["monthly", "pace"].includes(dimension)
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
    const rows = [
      ["Date basis", dateBasis],
      [
        "Code / grouping",
        "Description",
        "Stay-nights (event basis: whole stays)",
        "Value (stay basis: allocated)",
        "Reservation events",
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
            r
              .map((v) => {
                const text =
                  typeof v === "string" && /^[=+@\-\t\r]/.test(v)
                    ? "'" + v
                    : String(v);
                return '"' + text.replaceAll('"', '""') + '"';
              })
              .join(","),
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
      <p>
        {dateBasis === "stay"
          ? "Stay-date reporting allocates revenue over each night."
          : "Event-date reporting uses the full reservation value and stay-nights on its booking/cancellation date; these are not nights consumed on that date."}{" "}
        Statuses other than CHECKED OUT are not counted as realized stay
        revenue. Arrival-cohort coverage may be incomplete.
      </p>
      {legacyUnavailable && (
        <p role="status">
          This legacy baseline does not include these event dates, source/agent
          details or No Show records. Import the original production spreadsheet
          to populate this report; no zero total is inferred.
        </p>
      )}
      <div className="report-filters">
        <label>
          Date basis
          <select
            aria-label="Production date basis"
            value={dateBasis}
            onChange={(e) => setDateBasis(e.target.value as ProductionBasis)}
          >
            <option value="stay">
              Stay dates (arrival included; departure excluded)
            </option>
            <option value="booking">Booking / confirmation date</option>
            <option value="cancellation">Cancellation event date</option>
          </select>
        </label>
        <label>
          From
          <DatePicker
            label="Production analysis from"
            value={from}
            onChange={setFrom}
          />
        </label>
        <label>
          To
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
            <option value="pace">Monthly event timing</option>
            <option value="source">Source code</option>
            <option value="agent">Agent / company</option>
            <option value="marketCode">Opera market code</option>
          </select>
        </label>
        {data &&
          (
            [
              ["country", "Country", countryFilter, setCountryFilter],
              ["room", "Room type", roomFilter, setRoomFilter],
              ["meal", "Meal plan", mealFilter, setMealFilter],
              ["source", "Source", sourceFilter, setSourceFilter],
              ["agent", "Agent", agentFilter, setAgentFilter],
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
                {[...new Set(data.days.map((r) => r[key] ?? "UNAVAILABLE"))]
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
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="ALL">All uploaded statuses</option>
            {[
              ...new Set([
                "CHECKED OUT",
                "CANCELLED",
                "NO SHOW",
                ...(data?.days.map((r) => r.status) ?? []),
              ]),
            ]
              .sort()
              .map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
                  {dateBasis === "stay"
                    ? status === "CHECKED OUT"
                      ? "Allocated completed stay value"
                      : "Allocated booked value · not realized"
                    : "Booked event value · not realized"}
                </span>
                <strong>{money(summary.revenue)}</strong>
              </article>
              <article className="stat">
                <span>Complimentary / house-use stay-nights</span>
                <strong>{formatNumber(summary.complimentary)}</strong>
              </article>
              <article className="stat">
                <span>
                  {dateBasis === "stay"
                    ? "Arrivals within selected dates"
                    : "Reservation events"}
                </span>
                <strong>{formatNumber(summary.arrivals)}</strong>
              </article>
            </div>
            {!summary.groups.length && (
              <p role="status">
                No records for the selected dates/market. This is not a verified
                zero-performance period.
              </p>
            )}

            <>
              <h3>
                {status === "ALL" ? "All statuses" : status} performance by{" "}
                {dimension}
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
                      <th>
                        {dateBasis === "stay"
                          ? "Allocated value"
                          : "Whole reservation value"}
                      </th>
                      <th>{dateBasis === "stay" ? "Arrivals" : "Events"}</th>
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
            <div className="editor-actions">
              <button className="button outline" onClick={csv}>
                Export CSV breakdown
              </button>
              <button className="button outline" onClick={() => window.print()}>
                Print / Save PDF
              </button>
            </div>
            <p>
              {eventData!.missingDates > 0
                ? `${eventData!.missingDates} records lack the selected event date and are excluded. `
                : ""}
              {data.rows} source records: {data.checkedOut} checked out /{" "}
              {data.cancelled} cancelled · {data.statuses?.["NO SHOW"] ?? 0} no
              show (legacy baselines may lack status details). Source stay
              coverage {data.from} to {data.to}. Missing revenue records:{" "}
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
