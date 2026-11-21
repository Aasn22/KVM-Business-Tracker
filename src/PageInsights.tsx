import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { summarize, markets, type Entry } from "./model";
import { formatMoney, formatNumber } from "./format";
import { insightReviewed } from "./insightData";

export function pageInsightNotes(
  view: string,
  entries: Entry[],
  year: number,
  market: string | null,
) {
  if (["admin", "property", "activity", "setup"].includes(view)) return [];
  if (view === "reports")
    return [
      "Choose a Quick Report or Generate Your Own Report to explore the available inputs.",
      "Check the report’s date range and source coverage. Missing data is not treated as zero.",
      "History, forecasts and budgets are separate; reports do not add their totals together.",
    ];
  if (view === "insight")
    return [
      `Industry research snapshot reviewed ${insightReviewed}; not a live news feed.`,
      "National tourism figures describe the Maldives, not this property’s performance.",
      "Use each chart’s reporting period and source link before comparing figures.",
    ];
  const rows = entries.filter(
    (e) => e.year === year && (!market || e.market_id === market),
  );
  if (!rows.length)
    return [
      `No saved planning figures are available for ${market ? (markets.find((m) => m.id === market)?.name ?? market) : "all markets"} in ${year}.`,
      "Missing figures are not zero. Primary-source history and forecasts remain separate.",
    ];
  const t = summarize(rows);
  const label = market
    ? (markets.find((m) => m.id === market)?.name ?? market)
    : "Combined markets";
  const notes = [
    `${label} · ${year}: ${formatMoney(t.budget)} saved revenue budget and ${formatMoney(t.bob)} legacy workbook BOB.`,
    `${formatNumber(t.nights)} budgeted room nights; ${formatNumber(t.booked)} on the books. BOB is not realized revenue.`,
  ];
  const coverage = new Set(rows.map((r) => `${r.market_id}:${r.month}`)).size;
  notes.push(
    `${coverage} of ${(market ? 1 : markets.length) * 12} market-month planning records available. Primary Source Analysis is separate; this note does not summarize its filters.`,
  );
  return notes;
}
export default function PageInsights({
  view,
  entries,
  year,
  market,
}: {
  view: string;
  entries: Entry[];
  year: number;
  market: string | null;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => setOpen(false), [view, year, market]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    root.current
      ?.querySelector<HTMLButtonElement>(".page-insights-close")
      ?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const notes = pageInsightNotes(view, entries, year, market);
  if (!notes.length) return null;
  return (
    <div className="page-insights" ref={root}>
      <button
        className="page-insights-trigger"
        type="button"
        ref={trigger}
        aria-label="Show page insights"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <img src="/insights-bulb.png" alt="" width={48} height={48} />
        <span>INSIGHTS</span>
      </button>
      {open && (
        <section
          id={id}
          className="page-insights-panel"
          role="region"
          aria-label="Page insights"
        >
          <header>
            <h2>Page insights</h2>
            <button
              type="button"
              className="page-insights-close"
              aria-label="Close insights"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          </header>
          <ul>
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
          <small>
            Summary of available page context · No estimated or AI-generated
            figures.
          </small>
        </section>
      )}
    </div>
  );
}
