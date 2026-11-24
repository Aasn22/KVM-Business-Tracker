import { periodOccupancy, formatOccupancy } from "./occupancy";
import { useEffect, useState } from "react";
import {
  loadProduction,
  productionChanged,
  watchProduction,
} from "./productionClient";
import {
  productionSummary,
  productionRowsForBasis,
  type ProductionData,
} from "./production";
import { formatMoney, formatNumber } from "./format";
export default function MarketProduction({
  market,
  year,
  month,
  category,
}: {
  market: string;
  year: number;
  month: number;
  category: string;
}) {
  const [data, setData] = useState<ProductionData | null>(null),
    [source, setSource] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function refresh() {
      try {
        const r = await loadProduction();
        if (active) {
          setData(r.data);
          setSource(r.source);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void refresh();
    const stopWatching = watchProduction(refresh);
    window.addEventListener(productionChanged, refresh);
    return () => {
      active = false;
      stopWatching();
      window.removeEventListener(productionChanged, refresh);
    };
  }, []);
  if (!data)
    return (
      <p className="market-hint">{error || "Loading uploaded production…"}</p>
    );
  const from = `${year}-${String(month).padStart(2, "0")}-01`,
    to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const dimension =
    category === "villas" ? "room" : category === "meals" ? "meal" : "country";
  const completed = productionSummary(data, from, to, market, dimension),
    noShow = productionSummary(data, from, to, market, dimension, "NO SHOW");
  const events = productionRowsForBasis(data, "cancellation");
  const cancellation = productionSummary(
    { ...data, days: events.rows },
    from,
    to,
    market,
    dimension,
    "CANCELLED",
  );
  return (
    <section
      className="market-uploaded-summary"
      aria-label="Uploaded monthly performance"
    >
      <h3>Uploaded production · selected month</h3>
      <p className="market-hint">
        {source}. Completed values below are separate from planning budgets/BOB.
      </p>
      <div className="market-summary">
        {[
          ["Completed stay-nights", completed.nights],
          ["Completed allocated value", formatMoney(completed.revenue)],
          ["No-show potential nights", data.reservations ? noShow.nights : "—"],
          [
            "Cancellations recorded this month",
            data.reservations ? cancellation.arrivals : "—",
          ],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <h3>{label}</h3>
            <strong>
              {typeof value === "number" ? formatNumber(value) : value}
            </strong>
          </article>
        ))}
      </div>
      <p className="market-hint">
        Completed occupancy contribution:{" "}
        {completed.groups.length
          ? formatOccupancy(periodOccupancy(completed.nights, year, [month]))
          : "—"}{" "}
        · fixed 75-unit property capacity; uploaded arrival cohort may not
        include every in-house stay.
      </p>
      {!completed.groups.length && (
        <p className="market-hint">
          No completed rows supplied for this month/market; not a verified zero.
        </p>
      )}
      {events.missingDates > 0 && (
        <p className="market-hint">
          Cancellation dates unavailable for {events.missingDates} source
          records; undated cancellations excluded.
        </p>
      )}
      {["villas", "countries", "meals"].includes(category) &&
        completed.groups.length > 0 && (
          <div className="market-production-rows">
            {completed.groups.map((r) => (
              <div key={r.code}>
                <strong>{r.code}</strong>
                <span>{formatNumber(r.nights)} stay-nights</span>
                <span>{formatMoney(r.revenue)}</span>
              </div>
            ))}
          </div>
        )}
      <p className="market-hint">
        Revenue allocated evenly over stay nights, not verified daily PMS
        revenue. Unknown country codes remain unassigned to geography.
      </p>
    </section>
  );
}
