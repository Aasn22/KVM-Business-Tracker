import { periodOccupancy, formatOccupancy } from "./occupancy";
import { useEffect, useState } from "react";
import { loadPublicBudgets, type PublicBudgets } from "./publicBudgets";
import {
  loadProduction,
  productionChanged,
  watchProduction,
} from "./productionClient";
import type { ProductionData } from "./production";
import { loadHistory, historyChanged } from "./historyClient";
import {
  historySummary,
  withRevenueReference,
  revenueReferenceNote,
  type HistoryYear,
} from "./history";
import type { Entry } from "./model";
import { formatMoney, formatNumber } from "./format";
import {
  pulseYears,
  pulsePlanning,
  pulseActual,
  pulseYoY,
  pulseMarketOrder,
  pulseMarketLabel,
  pulseKnownSum,
  pulseYearPlanning,
} from "./pulseData";
type Metric = { label: string; value: string; note: string; detail?: string };
export function PulseContent({
  budgets,
  production,
  sourceNote = "",
  histories = [],
}: {
  budgets: Entry[];
  production: ProductionData | null;
  sourceNote?: string;
  histories?: HistoryYear[];
}) {
  const historical = budgets.filter((e) => pulseYears.includes(e.year)),
    planning = (() => {
      const values = pulseYears.map((y) =>
        pulseYearPlanning(historical, y, histories),
      );
      return {
        ...pulsePlanning(historical),
        budget: pulseKnownSum(values.map((v) => v.budget)),
      };
    })(),
    future = budgets.filter((e) => e.year === 2027),
    target = pulseYearPlanning(future, 2027, histories);
  const actuals = pulseYears.map((y) => pulseActual(production, y, histories));
  const achieved = pulseKnownSum(actuals.map((a) => a.revenue));
  const totalAchieved = pulseKnownSum(actuals.map((a) => a.totalRevenue));
  const yoy = pulseYoY(production, histories),
    unavailable = "Not supplied by current data. No value estimated.";
  const historicalNote = `${planning.coverage}/${72 * 6} saved market-month budget records. Actuals: sum of known room values on supplied completed-stay dates only; missing revenue values/years excluded, not verified zero; not necessarily full years. ${sourceNote}`;
  const change = (v: { amount: number; percent: number } | null) =>
    v ? `${v.percent.toFixed(1)}%` : "—";
  const top: Metric[] = [
    {
      label: "Room Revenue Budget",
      value: formatMoney(planning.budget),
      note: "Year 2021 – Year 2026",
      detail: historicalNote,
    },
    {
      label: "Room Revenue Achieved",
      value: formatMoney(achieved),
      note: `Known values · ${actuals.filter((a) => a.revenue !== null).length}/6 years`,
      detail: historicalNote,
    },
    {
      label: "Total Revenue Budgeted",
      value: formatMoney(
        pulseKnownSum(
          histories
            .filter((h) => pulseYears.includes(h.year))
            .map((h) => historySummary(h.months).budgetTotalRevenue),
        ),
      ),
      note: "Year 2021 – Year 2026",
      detail:
        "Sum of saved History Update budget total revenue values; missing months/years excluded. Room-only budgets are not called total revenue.",
    },
    {
      label: "Total Revenue Achieved",
      value: formatMoney(totalAchieved),
      note: "Year 2021 – Year 2026",
      detail:
        "Sum of saved History Update actual total revenue values. Production room-only revenue is never substituted for total revenue.",
    },
    {
      label: "Room Revenue YOY",
      value: formatMoney(yoy.revenue?.amount ?? null),
      note: change(yoy.revenue),
      detail:
        "2026 vs 2025 on matching supplied completed stay-day coverage only. Unmatched/missing dates or unknown revenue means unavailable.",
    },
    {
      label: "Total Revenue YOY",
      value: formatMoney(yoy.totalRevenue?.amount ?? null),
      note: change(yoy.totalRevenue),
      detail: unavailable,
    },
    {
      label: "ADR YOY",
      value: formatMoney(yoy.adr?.amount ?? null),
      note: change(yoy.adr),
      detail:
        "Weighted room value per reservation stay-night. 2026 vs 2025 matching supplied stay days only.",
    },
  ];
  const bottom: Metric[] = [
    {
      label: "Room Revenue Budget",
      value: formatMoney(target.budget),
      note: "Year 2027",
    },
    {
      label: "Occupancy %",
      value: formatOccupancy(
        periodOccupancy(
          target.nights,
          2027,
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
        ),
      ),
      note: "Year 2027",
      detail:
        "Budget room nights / (75 units × 365 calendar days). Supplied budget coverage only; no occupancy inferred for missing target records.",
    },
    {
      label: "Room Nights",
      value: formatNumber(target.nights),
      note: "Year 2027",
    },
    { label: "ADR", value: formatMoney(target.targetADR), note: "Year 2027" },
    {
      label: "F&B Revenue",
      value: "—",
      note: "Year 2027",
      detail: unavailable,
    },
    {
      label: "Other Revenue Budget",
      value: "—",
      note: "Year 2027",
      detail: unavailable,
    },
    {
      label: "Total Revenue Budget",
      value: formatMoney(
        histories.find((h) => h.year === 2027)
          ? historySummary(histories.find((h) => h.year === 2027)!.months)
              .budgetTotalRevenue
          : null,
      ),
      note: "Year 2027",
      detail:
        "Saved History Update 2027 property total if entered; no total inferred from room-only sources.",
    },
  ];
  const metrics = (items: Metric[]) => (
    <div className="pulse-mini-metrics">
      {items.map((m) => (
        <article
          key={m.label}
          title={
            m.detail ??
            `${target.coverage}/72 market-month records available. ${sourceNote}`
          }
        >
          <span>{m.label}</span>
          <strong>{m.value}</strong>
          <small>{m.note}</small>
        </article>
      ))}
    </div>
  );
  const column = (
    label: string,
    rows: Entry[],
    detail: string,
    actualYear?: number,
  ) => {
    const p = actualYear
      ? pulseYearPlanning(rows, actualYear, histories)
      : label === "TOTAL"
        ? pulseYearPlanning(rows, 2027, histories)
        : pulsePlanning(rows);
    const a = actualYear
      ? pulseActual(production, actualYear, histories)
      : null;
    return (
      <article className="pulse-mini-column" key={label} title={detail}>
        <h3>{label}</h3>
        {[
          [p.nights, "Target Room Nights"],
          [p.budget, "Target Room Revenue"],
          [p.targetADR, "Target ADR"],
          [
            a ? a.nights : p.booked,
            a ? "Achieved Room Nights" : "BOB Room Nights",
          ],
          [
            a ? a.revenue : p.bob,
            a ? "Achieved Room Revenue" : "BOB Room Revenue",
          ],
          [a ? a.adr : p.bobADR, a ? "Achieved ADR" : "BOB ADR"],
          ...(a
            ? [
                [a.occupancy, "Actual Occupancy"],
                [a.foodRevenue, "Actual F&B Revenue"],
                [a.otherRevenue, "Actual Other Revenue"],
                [a.totalRevenue, "Actual Total Revenue"],
              ]
            : []),
        ].map(([n, title]) => (
          <div key={String(title)}>
            <strong>
              {String(title) === "Actual Occupancy"
                ? n === null
                  ? "—"
                  : `${Number(n).toFixed(1)}%`
                : /Revenue|ADR/.test(String(title))
                  ? formatMoney(n as number | null)
                  : formatNumber(n as number | null)}
            </strong>
            <span>{title}</span>
          </div>
        ))}
      </article>
    );
  };
  const annualRows = pulseYears.map((y, i) => ({
    label: String(y),
    budget: pulseYearPlanning(historical, y, histories),
    actual: actuals[i],
  }));
  const marketRows = pulseMarketOrder.map((id) => ({
    label: pulseMarketLabel(id),
    value: pulsePlanning(future.filter((e) => e.market_id === id)),
  }));
  return (
    <div className="pulse-board">
      <section aria-label="Commercial performance 2021 to 2026">
        <h2>Commercial performance · KVM (2021 – 2026)</h2>
        <div
          className="pulse-horizontal"
          tabIndex={0}
          role="region"
          aria-label="Historical performance, horizontally scrollable on narrow screens"
        >
          <div className="pulse-section-inner">
            {metrics(top)}
            <div className="pulse-mini-columns pulse-years">
              {pulseYears.map((y) =>
                column(
                  String(y),
                  historical.filter((e) => e.year === y),
                  `${y}: saved planning targets and achieved completed stay production on supplied dates only. ${pulsePlanning(historical.filter((e) => e.year === y)).coverage}/72 target market-month records. ${sourceNote}`,
                  y,
                ),
              )}
            </div>
          </div>
        </div>
      </section>
      <section aria-label="Commercial Budget 2027">
        <h2>Commercial Budget · KVM (2027)</h2>
        <div
          className="pulse-horizontal"
          tabIndex={0}
          role="region"
          aria-label="2027 market budgets, horizontally scrollable on narrow screens"
        >
          <div className="pulse-section-inner">
            {metrics(bottom)}
            <div className="pulse-mini-columns">
              {pulseMarketOrder.map((id) =>
                column(
                  pulseMarketLabel(id),
                  future.filter((e) => e.market_id === id),
                  `2027 ${id}: ${future.filter((e) => e.market_id === id).length}/12 saved months. ${sourceNote}`,
                ),
              )}
              {column(
                "TOTAL",
                future,
                `Sum of supplied market records only; ${target.coverage}/72 available. ${sourceNote}`,
              )}
            </div>
            <div
              className="pulse-mini-graphs"
              aria-label="Mini performance charts"
            >
              <PulseMiniGraph
                title="Annual Room Revenue"
                money
                rows={annualRows.map((r) => ({
                  label: r.label,
                  a: r.budget.budget,
                  b: r.actual.revenue,
                }))}
                aLabel="Budget"
                bLabel="Known achieved"
              />
              <PulseMiniGraph
                title="Annual Room Nights"
                rows={annualRows.map((r) => ({
                  label: r.label,
                  a: r.budget.nights,
                  b: r.actual.nights,
                }))}
                aLabel="Target"
                bLabel="Achieved"
              />
              <PulseMiniGraph
                title="Annual ADR"
                money
                rows={annualRows.map((r) => ({
                  label: r.label,
                  a: r.budget.targetADR,
                  b: r.actual.adr,
                }))}
                aLabel="Target"
                bLabel="Achieved"
              />
              <PulseMiniGraph
                title="2027 Market Room Revenue"
                money
                rows={marketRows.map((r) => ({
                  label: r.label,
                  a: r.value.budget,
                  b: r.value.bob,
                }))}
                aLabel="Budget"
                bLabel="BOB"
              />
              <PulseMiniGraph
                title="2027 Market Room Nights"
                rows={marketRows.map((r) => ({
                  label: r.label,
                  a: r.value.nights,
                  b: r.value.booked,
                }))}
                aLabel="Target"
                bLabel="BOB"
              />
              <PulseMiniGraph
                title="2027 Market ADR"
                money
                rows={marketRows.map((r) => ({
                  label: r.label,
                  a: r.value.targetADR,
                  b: r.value.bobADR,
                }))}
                aLabel="Target"
                bLabel="BOB"
              />
              <PulseMiniGraph
                title="Actual Revenue Components"
                money
                rows={annualRows.map((r) => ({
                  label: r.label,
                  a: r.actual.foodRevenue,
                  b: r.actual.otherRevenue,
                }))}
                aLabel="F&B"
                bLabel="Other"
              />
              <PulseMiniGraph
                title="Actual Occupancy"
                percent
                rows={annualRows.map((r) => ({
                  label: r.label,
                  a: r.actual.occupancy,
                  b: null,
                }))}
                aLabel="Occupancy"
                bLabel=""
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
export function PulseMiniGraph({
  title,
  rows,
  money = false,
  percent = false,
  aLabel,
  bLabel,
}: {
  title: string;
  rows: { label: string; a: number | null; b: number | null }[];
  money?: boolean;
  percent?: boolean;
  aLabel: string;
  bLabel: string;
}) {
  const maximum = Math.max(
    1,
    ...rows.flatMap((r) => [Math.abs(r.a ?? 0), Math.abs(r.b ?? 0)]),
  );
  const fmt = (n: number | null) =>
    n === null
      ? "Not available"
      : money
        ? formatMoney(n)
        : percent
          ? `${n.toFixed(1)}%`
          : formatNumber(n);
  const available = rows.some((r) => r.a !== null || r.b !== null);
  return (
    <figure className="pulse-mini-graph">
      <figcaption>{title}</figcaption>
      <div className="pulse-graph-legend">
        <span>
          <i />
          {aLabel}
        </span>
        {bLabel && (
          <span>
            <i />
            {bLabel}
          </span>
        )}
      </div>
      {!available ? (
        <p className="pulse-graph-empty">
          Not available — required source data not supplied.
        </p>
      ) : (
        <div className="pulse-graph-rows">
          {rows.map((r) => (
            <div className="pulse-graph-row" key={r.label}>
              <span>{r.label}</span>
              <div>
                {(
                  [
                    ["a", r.a, aLabel],
                    ["b", r.b, bLabel],
                  ] as const
                )
                  .filter(([, , name]) => name)
                  .map(([key, value, name]) => (
                    <div
                      key={key}
                      className={`pulse-graph-track ${key}`}
                      aria-label={`${r.label} ${name}: ${fmt(value)}`}
                      title={`${r.label} ${name}: ${fmt(value)}`}
                    >
                      <i
                        style={{
                          width:
                            value === null
                              ? "0"
                              : `${(Math.abs(value) / maximum) * 100}%`,
                        }}
                      />
                      {value === null && <small>—</small>}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <small className="pulse-graph-footnote">
        Supplied values only; — is missing, not zero.
        {title === "Annual Room Revenue"
          ? " Known achieved may exclude missing revenue records."
          : ""}
      </small>
    </figure>
  );
}
export default function PulsePage({
  readYear = loadPublicBudgets,
}: {
  readYear?: (year: number) => Promise<PublicBudgets>;
}) {
  const [budgets, setBudgets] = useState<Entry[]>([]),
    [production, setProduction] = useState<ProductionData | null>(null),
    [note, setNote] = useState("Loading saved sources.");
  const [histories, setHistories] = useState<HistoryYear[]>([]);
  useEffect(() => {
    let active = true,
      busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const [years, prod, history] = await Promise.all([
          Promise.all([...pulseYears, 2027].map((y) => readYear(y))),
          loadProduction().catch(() => null),
          loadHistory().catch(() => withRevenueReference([])),
        ]);
        if (active) {
          setBudgets(years.flatMap((r) => r.entries));
          setProduction(prod?.data ?? null);
          setHistories(history ?? []);
          setNote(
            `${years.every((r) => r.databaseAvailable) ? "Saved database budgets." : "Some budget sources unavailable or published workbook baseline."} ${prod?.source ?? "Uploaded production unavailable."} ${history === null ? "History Update database unavailable." : `Manual history available for ${history.map((h) => h.year).join(", ") || "no years"}. Saved manual year actuals/targets take precedence, never added to production; partial months possible. Occupancy assumes 75 units throughout each included calendar period. ${revenueReferenceNote}`}`,
          );
        }
      } catch (e) {
        if (active) setNote(`Source refresh failed: ${(e as Error).message}`);
      } finally {
        busy = false;
      }
    }
    void refresh();
    const stop = watchProduction(() => void refresh());
    const timer = setInterval(refresh, 60000);
    const visible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener(productionChanged, refresh);
    window.addEventListener(historyChanged, refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      stop();
      clearInterval(timer);
      window.removeEventListener(productionChanged, refresh);
      window.removeEventListener(historyChanged, refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [readYear]);
  return (
    <PulseContent
      budgets={budgets}
      production={production}
      sourceNote={note}
      histories={histories}
    />
  );
}
