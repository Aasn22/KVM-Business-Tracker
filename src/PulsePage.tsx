import { useEffect, useState } from "react";
import { loadPublicBudgets, type PublicBudgets } from "./publicBudgets";
import {
  loadProduction,
  productionChanged,
  watchProduction,
} from "./productionClient";
import type { ProductionData } from "./production";
import type { Entry } from "./model";
import { formatMoney, formatNumber } from "./format";
import {
  pulseYears,
  pulsePlanning,
  pulseActual,
  pulseYoY,
  pulseMarketOrder,
  pulseMarketLabel,
} from "./pulseData";
type Metric = { label: string; value: string; note: string; detail?: string };
export function PulseContent({
  budgets,
  production,
  sourceNote = "",
}: {
  budgets: Entry[];
  production: ProductionData | null;
  sourceNote?: string;
}) {
  const historical = budgets.filter((e) => pulseYears.includes(e.year)),
    planning = pulsePlanning(historical),
    future = budgets.filter((e) => e.year === 2027),
    target = pulsePlanning(future);
  const actuals = pulseYears.map((y) => pulseActual(production, y));
  const achieved = actuals.some((a) => a.revenue !== null)
    ? actuals.reduce((a, r) => a + (r.revenue ?? 0), 0)
    : null;
  const yoy = pulseYoY(production),
    unavailable = "Not supplied by current data. No value estimated.";
  const historicalNote = `${planning.coverage}/${72 * 6} saved market-month budget records. Actuals: only supplied completed-stay dates; not necessarily full years. ${sourceNote}`;
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
      note: "Year 2021 – Year 2026",
      detail: historicalNote,
    },
    {
      label: "Total Revenue Budgeted",
      value: "—",
      note: "Year 2021 – Year 2026",
      detail:
        "F&B and other revenue budgets not supplied; room revenue is not total revenue.",
    },
    {
      label: "Total Revenue Achieved",
      value: "—",
      note: "Year 2021 – Year 2026",
      detail:
        "Production source contains room value only; no complete F&B/other achieved revenue.",
    },
    {
      label: "Room Revenue YOY",
      value: formatMoney(yoy.revenue?.amount ?? null),
      note: change(yoy.revenue),
      detail:
        "2026 vs 2025 on matching supplied completed stay-day coverage only. Unmatched/missing dates or unknown revenue means unavailable.",
    },
    { label: "Total Revenue YOY", value: "—", note: "—", detail: unavailable },
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
      value: "—",
      note: "Year 2027",
      detail: "Verified daily room inventory denominator not supplied.",
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
      value: "—",
      note: "Year 2027",
      detail: "Requires room + F&B + other revenue budgets; not inferred.",
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
    const p = pulsePlanning(rows);
    const a = actualYear ? pulseActual(production, actualYear) : null;
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
        ].map(([n, title]) => (
          <div key={String(title)}>
            <strong>
              {/Revenue|ADR/.test(String(title))
                ? formatMoney(n as number | null)
                : formatNumber(n as number | null)}
            </strong>
            <span>{title}</span>
          </div>
        ))}
      </article>
    );
  };
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
          </div>
        </div>
      </section>
    </div>
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
  useEffect(() => {
    let active = true,
      busy = false;
    async function refresh() {
      if (busy) return;
      busy = true;
      try {
        const [years, prod] = await Promise.all([
          Promise.all([...pulseYears, 2027].map((y) => readYear(y))),
          loadProduction().catch(() => null),
        ]);
        if (active) {
          setBudgets(years.flatMap((r) => r.entries));
          setProduction(prod?.data ?? null);
          setNote(
            `${years.every((r) => r.databaseAvailable) ? "Saved database budgets." : "Some budget sources unavailable or published workbook baseline."} ${prod?.source ?? "Uploaded production unavailable."}`,
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
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      stop();
      clearInterval(timer);
      window.removeEventListener(productionChanged, refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [readYear]);
  return (
    <PulseContent budgets={budgets} production={production} sourceNote={note} />
  );
}
