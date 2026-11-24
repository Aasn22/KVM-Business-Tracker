import { periodOccupancy, formatOccupancy } from "./occupancy";
import { useEffect, useState } from "react";
import {
  fetchPerformance,
  performanceChanged,
  watchPerformance,
} from "./performanceClient";
import {
  bookingSegment,
  geographicMarket,
  summarizePerformance,
  type PerformanceRow,
  type SourceKind,
  type SourceDimension,
} from "./performanceSources";
import { formatMoney, formatNumber } from "./format";
import { markets, months } from "./model";
import { periodMonths } from "./totals";
export default function PerformanceAnalysis({
  year,
  market = null,
  initialKind = "history",
  initialDimension = "country",
  initialByCode = false,
  initialPeriod = "year",
}: {
  year: number;
  market?: string | null;
  initialKind?: SourceKind;
  initialDimension?: SourceDimension;
  initialByCode?: boolean;
  initialPeriod?: string;
}) {
  const [kind, setKind] = useState<SourceKind>(initialKind),
    [dimension, setDimension] = useState<SourceDimension>(initialDimension),
    [rows, setRows] = useState<PerformanceRow[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [sourceRunDates, setSourceRunDates] = useState<string[]>([]);
  const [byCode, setByCode] = useState(initialByCode);
  const [period, setPeriod] = useState(initialPeriod);
  const d = market ? "country" : dimension;
  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchPerformance(kind, d, year);
        if (active) {
          setRows(data);
          setSourceRunDates(
            Array.from(new Set(data.map((r) => r.sourceAsOf))).sort(),
          );
        }
      } catch (e) {
        if (active) {
          setRows([]);
          setError((e as Error).message);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const stopWatching = watchPerformance(kind, d, year, load);
    window.addEventListener(performanceChanged, load);
    return () => {
      active = false;
      stopWatching();
      window.removeEventListener(performanceChanged, load);
    };
  }, [kind, d, year]);
  const selectedMonths = periodMonths(period);
  const periodRows = rows.filter((r) =>
    selectedMonths.includes(Number(r.date.slice(5, 7))),
  );
  const filtered = market
    ? periodRows.filter((r) => geographicMarket(r.code) === market)
    : periodRows;
  const summary = summarizePerformance(filtered);
  const grouped = new Map<string, PerformanceRow[]>();
  for (const r of filtered) {
    const label =
      d === "country"
        ? market || byCode
          ? r.code
          : (markets.find((m) => m.id === geographicMarket(r.code))?.name ??
            "Unmapped country codes")
        : d === "market"
          ? bookingSegment(r.code)
          : r.code;
    grouped.set(label, [...(grouped.get(label) ?? []), r]);
  }
  const groups = [...grouped].map(([label, data]) => ({
    label,
    ...summarizePerformance(data),
  }));
  const max = Math.max(...groups.map((r) => Math.abs(r.revenue)), 1);
  return (
    <section className="panel primary-source-analysis">
      <header>
        <h2>Primary Source Analysis</h2>
        <p>
          Stay-date source for {year} · These figures are separate from budget
          planning and legacy workbook BOB. Source dimensions are not added
          together.
        </p>
      </header>
      <div className="report-filters">
        <label>
          Stay period
          <select
            aria-label="Primary stay period"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="year">Full year (available dates)</option>
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
          Performance basis
          <select
            aria-label="Performance basis"
            value={kind}
            onChange={(e) => setKind(e.target.value as SourceKind)}
          >
            <option value="history">History · reported performance</option>
            <option value="forecast">
              Forecast · on-books projection (not pickup)
            </option>
          </select>
        </label>
        {!market && (
          <label>
            Source dimension
            <select
              aria-label="Source dimension"
              value={dimension}
              onChange={(e) => setDimension(e.target.value as SourceDimension)}
            >
              <option value="country">Country → geographic markets</option>
              <option value="market">Opera market → Retail / Wholesale</option>
              <option value="room">Room types</option>
            </select>
          </label>
        )}
        {!market && d === "country" && (
          <label>
            Group countries
            <select
              aria-label="Country grouping"
              value={byCode ? "codes" : "geography"}
              onChange={(e) => setByCode(e.target.value === "codes")}
            >
              <option value="geography">Geographic market</option>
              <option value="codes">Individual country codes</option>
            </select>
          </label>
        )}
      </div>
      {loading ? (
        <p role="status">Loading primary source…</p>
      ) : error ? (
        <p className="notice" role="status">
          {error} No legacy figures are substituted as actuals or forecasts.
        </p>
      ) : !filtered.length ? (
        <p className="empty">
          No published {kind} {d} source for this selection. Missing data stays
          unavailable.
        </p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat">
              <span>Source room nights</span>
              <strong>{formatNumber(summary.rooms)}</strong>
            </div>
            <div className="stat">
              <span>
                {kind === "history" ? "Reported" : "Forecast"} room revenue
              </span>
              <strong>{formatMoney(summary.revenue)}</strong>
            </div>
            <div className="stat">
              <span>Weighted ADR</span>
              <strong>{formatMoney(summary.adr)}</strong>
            </div>
            <div className="stat">
              <span>Covered stay dates</span>
              <strong>{new Set(filtered.map((r) => r.date)).size}</strong>
            </div>
          </div>
          <p>
            Source run date(s): {sourceRunDates.join(", ") || "Unavailable"}.
            Values refresh every 60 seconds; publication in this session
            refreshes immediately.
          </p>
          <p>
            Coverage {filtered.map((r) => r.date).sort()[0]} to{" "}
            {filtered
              .map((r) => r.date)
              .sort()
              .at(-1)}
            . Occupancy (75-unit assumption):{" "}
            {formatOccupancy(
              periodOccupancy(summary.rooms, year, selectedMonths),
            )}
            . Selected source may be incomplete. Some adjustments may have
            negative revenue.
          </p>
          {groups.map((r) => (
            <div className="primary-source-bar" key={r.label}>
              <span>{r.label}</span>
              <div>
                <i style={{ width: `${(Math.abs(r.revenue) / max) * 100}%` }} />
              </div>
              <b>{formatMoney(r.revenue)}</b>
            </div>
          ))}
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Source grouping</th>
                  <th>Room nights</th>
                  <th>Room revenue</th>
                  <th>ADR</th>
                  <th>F&amp;B revenue</th>
                  <th>Other revenue</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((r) => (
                  <tr key={r.label}>
                    <th>{r.label}</th>
                    <td>{r.rooms}</td>
                    <td>{formatMoney(r.revenue)}</td>
                    <td>{formatMoney(r.adr)}</td>
                    <td>{formatMoney(r.food)}</td>
                    <td>{formatMoney(r.other)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details>
            <summary>
              Monthly primary performance (available stay dates only)
            </summary>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Room nights</th>
                    <th>Room revenue</th>
                    <th>Weighted ADR</th>
                    <th>Covered dates</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(filtered.map((r) => r.date.slice(0, 7))))
                    .sort()
                    .map((month) => {
                      const data = filtered.filter((r) =>
                          r.date.startsWith(month),
                        ),
                        s = summarizePerformance(data);
                      return (
                        <tr key={month}>
                          <th>{month}</th>
                          <td>{s.rooms}</td>
                          <td>{formatMoney(s.revenue)}</td>
                          <td>{formatMoney(s.adr)}</td>
                          <td>{new Set(data.map((r) => r.date)).size}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </details>
          <button
            className="button outline"
            onClick={() => {
              const fields = [
                "date",
                "code",
                "rooms",
                "roomRevenue",
                "foodRevenue",
                "otherRevenue",
                "guests",
              ] as const;
              const csv = [
                fields.join(","),
                ...filtered.map((r) =>
                  fields
                    .map(
                      (f) =>
                        `"${String(typeof r[f] === "string" && /^[=+@-]/.test(String(r[f])) ? "'" + r[f] : (r[f] ?? "")).replaceAll('"', '""')}"`,
                    )
                    .join(","),
                ),
              ].join("\r\n");
              const url = URL.createObjectURL(
                new Blob([csv], { type: "text/csv" }),
              );
              const a = document.createElement("a");
              a.href = url;
              a.download = `${kind}-${d}-${year}-source.csv`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            }}
          >
            Export primary rows CSV
          </button>
          {d === "market" && (
            <p>
              Retail: ADV/BAR/PKG/PRO/DAY/OTA/RET · Wholesale: ITO/LTO/GRP.
              Corporate, Discount, Events, Complimentary, House Use and System
              Use are separate. No country-by-segment split is inferred.
            </p>
          )}
          {d === "country" && (
            <p>
              Explicit country mappings are used; unknown/unmapped codes remain
              visible for review, not assigned by guess. Geographic totals do
              not include unassigned codes.
            </p>
          )}
          {d === "country" && (
            <details>
              <summary>Country mapping review</summary>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Source country code</th>
                      <th>Assigned market</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from(new Set(rows.map((r) => r.code)))
                      .sort()
                      .map((code) => (
                        <tr key={code}>
                          <th>{code}</th>
                          <td>
                            {markets.find(
                              (m) => m.id === geographicMarket(code),
                            )?.name ?? "Unmapped — review required"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <button className="button outline" onClick={() => window.print()}>
            Print source analysis / Save PDF
          </button>
        </>
      )}
    </section>
  );
}
