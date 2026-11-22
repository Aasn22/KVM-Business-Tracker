import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { adr, months, summarize, type Entry } from "./model";
import { formatMoney, formatNumber, isMoneyMetric } from "./format";
export default function MarketPage({
  market,
  name,
  year,
  entries,
  onBack,
}: {
  market: string;
  name: string;
  year: number;
  entries: Entry[];
  onBack: () => void;
}) {
  const [month, setMonth] = useState(1),
    [category, setCategory] = useState<
      "commercial" | "villas" | "countries" | "meals" | "notes"
    >("commercial");
  const saved = entries.filter(
      (e) => e.market_id === market && e.year === year,
    ),
    current = saved.find((e) => e.month === month)?.data;
  const annual = summarize(saved).budget,
    rev = current?.commercial[1],
    nights = current?.commercial[0];
  const money = (v: number | undefined) =>
    v === undefined ? "—" : formatMoney(v);
  const ratio = (r: number | undefined, n: number | undefined) =>
    r === undefined || n === undefined || n <= 0 ? "—" : formatMoney(adr(r, n));
  const cards = [
    [
      "Annual Revenue Budget",
      saved.length ? money(annual) : "—",
      `${name} · ${year}`,
    ],
    ["Monthly Revenue", money(rev?.budget), `${months[month - 1]} Budget`],
    [
      "Monthly BOB",
      money(rev?.bob),
      rev && rev.budget > 0
        ? `${((rev.bob / rev.budget) * 100).toFixed(1)}% of Budget`
        : "Budget comparison unavailable",
    ],
    [
      "Revenue Variance",
      rev ? money(rev.bob - rev.budget) : "—",
      "BOB Minus Budget",
    ],
  ];
  return (
    <section className="market-page" aria-label={`${name} market performance`}>
      <button className="market-back" onClick={onBack}>
        <ArrowLeft size={26} /> All Markets
      </button>
      <nav className="market-categories" aria-label="Market breakdown">
        {(
          [
            ["commercial", "Commercial Targets"],
            ["villas", "Villa Types"],
            ["countries", "Countries"],
            ["meals", "Meal Plans"],
            ["notes", "Action Plans"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            aria-pressed={category === id}
            onClick={() => setCategory(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <p className="market-hint">Select the breakdown you wish to view</p>
      <nav className="market-months" aria-label="Market month">
        {months.map((m, i) => (
          <button
            key={m}
            aria-pressed={month === i + 1}
            onClick={() => setMonth(i + 1)}
          >
            {m.slice(0, 3).toUpperCase()}
          </button>
        ))}
      </nav>
      <h2>Monthly performance</h2>
      <p className="market-hint">
        BOB = business on the books. ADR is calculated automatically. Saved
        planning / workbook BOB—not uploaded completed stays.
      </p>
      <div className="market-summary">
        {cards.map(([title, value, note], i) => (
          <article key={title}>
            <h3>{title}</h3>
            <strong
              className={
                i === 3 && rev && rev.bob < rev.budget ? "market-loss" : ""
              }
            >
              {value}
            </strong>
            <span>{note}</span>
          </article>
        ))}
      </div>
      {!current ? (
        <p className="market-empty">
          No saved planning figures for {name} · {months[month - 1]} {year}.
          Missing data is not zero.
        </p>
      ) : category === "commercial" ? (
        <div className="market-weeks">
          {[0, 1, 2, 3].map((w) => (
            <article key={w}>
              <h3>
                WEEK {w + 1}
                {w === 3 ? " / 5" : ""}
              </h3>
              {[
                [
                  formatNumber(nights?.targets[w] ?? null),
                  "Target Room Nights",
                ],
                [money(rev?.targets[w]), "Target Room Revenue"],
                [ratio(rev?.targets[w], nights?.targets[w]), "Target ADR"],
                [formatNumber(nights?.weekly[w] ?? null), "BOB Room Nights"],
                [money(rev?.weekly[w]), "BOB Room Revenue"],
                [ratio(rev?.weekly[w], nights?.weekly[w]), "BOB ADR"],
              ].map(([value, label]) => (
                <div key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </article>
          ))}
        </div>
      ) : category === "notes" ? (
        <article className="market-action">
          <h3>Performance review & corrective actions</h3>
          <p>{current.notes || "No saved action plan recorded."}</p>
        </article>
      ) : (
        <div className="market-breakdowns">
          {current[category].map((r, i) => (
            <article key={i}>
              <h3>{r.label}</h3>
              <dl>
                {[
                  ["Budget", r.budget],
                  ["BOB", r.bob],
                  ["Variance", r.bob - r.budget],
                ].map(([label, value]) => (
                  <div key={String(label)}>
                    <dt>{label}</dt>
                    <dd>
                      {isMoneyMetric(r.label)
                        ? formatMoney(Number(value))
                        : formatNumber(Number(value))}
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="market-category-weeks">
                {[0, 1, 2, 3].map((w) => (
                  <div key={w}>
                    <h4>
                      Week {w + 1}
                      {w === 3 ? " / 5" : ""}
                    </h4>
                    <p>
                      Target:{" "}
                      {isMoneyMetric(r.label)
                        ? money(r.targets[w])
                        : formatNumber(r.targets[w])}
                    </p>
                    <p>
                      BOB:{" "}
                      {isMoneyMetric(r.label)
                        ? money(r.weekly[w])
                        : formatNumber(r.weekly[w])}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      <p className="market-hint">
        Read-only. Weekly snapshots are independent of monthly totals; the
        fourth slot includes week 5 when supplied. {saved.length}/12 planning
        months available.
      </p>
    </section>
  );
}
