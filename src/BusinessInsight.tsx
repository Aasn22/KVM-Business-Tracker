import { useState } from "react";
import { formatCompact, formatInsightMoney } from "./format";
import { Globe2, ExternalLink, AlertTriangle, TrendingUp } from "lucide-react";
import {
  insightReviewed,
  insightSources,
  annualArrivals,
  ytdArrivals,
  sourceMarkets,
  travelReceipts,
  globalQuarters,
  riskSurvey,
  yoy,
  type InsightSource,
} from "./insightData";
const number = (v: number) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(v);
function Source({ id }: { id: InsightSource }) {
  const s = insightSources[id];
  return (
    <p className="insight-source">
      <a href={s.url} target="_blank" rel="noopener noreferrer">
        {s.name} <ExternalLink size={11} />
      </a>
      <span>
        {s.type} · {s.period}
      </span>
    </p>
  );
}
export function InsightChart({
  title,
  rows,
  unit,
  source,
  note,
}: {
  title: string;
  rows: { label: string; value: number }[];
  unit: string;
  source: InsightSource;
  note?: string;
}) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const display = (value: number) =>
    unit === "$ amounts" ? formatInsightMoney(value) : number(value);
  return (
    <section className="panel insight-card">
      <h2>{title}</h2>
      <p className="insight-unit">
        {unit}
        {unit === "$ amounts" ? " · rounded K/M" : ""}
      </p>
      <div
        className="insight-bars"
        role="img"
        aria-label={`${title}: ${rows.map((r) => `${r.label} ${display(r.value)} ${unit}`).join("; ")}`}
      >
        {rows.map((r) => (
          <div className="insight-bar-row" key={r.label}>
            <span>{r.label}</span>
            <div className="insight-track">
              <div
                className={
                  r.value < 0 ? "insight-bar declining" : "insight-bar"
                }
                style={{ width: `${(Math.abs(r.value) / max) * 100}%` }}
              />
            </div>
            <strong>
              {display(r.value)}
              {unit === "% year on year" || unit === "% of experts" ? "%" : ""}
            </strong>
          </div>
        ))}
      </div>
      {note && <p className="insight-note">{note}</p>}
      <details className="insight-data">
        <summary>View chart data</summary>
        <div className="table-scroll">
          <table>
            <caption>
              {title} · {unit}
            </caption>
            <thead>
              <tr>
                <th>Period / category</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label}>
                  <th>{r.label}</th>
                  <td>{display(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <Source id={source} />
    </section>
  );
}
export default function BusinessInsight() {
  const [topic, setTopic] = useState("all");
  const show = (t: string) => topic === "all" || topic === t;
  return (
    <section className="business-insight">
      <div className="insight-intro">
        <Globe2 size={26} />
        <div>
          <h2>Hospitality intelligence, with context.</h2>
          <p>
            Research reviewed {insightReviewed}. Dated snapshot, not an
            automatic live feed. Each chart uses its own reporting period;
            figures are national or global, not Kuda Villingili performance.
          </p>
        </div>
      </div>
      <div className="insight-official">
        <strong>Official Maldives tourism updates</strong>
        <p>
          The Ministry pages retrieved here list daily releases through 26 Oct
          and status releases through 22 Oct 2026. Newer November arrivals below
          are explicitly secondary reporting, not a directly verified Ministry
          bulletin. Open the official hubs for subsequent releases.
        </p>
        <div>
          <a
            href={insightSources.ministry.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ministry Daily Reports ↗
          </a>
          <a
            href={insightSources.status.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Ministry Status Updates ↗
          </a>
        </div>
      </div>
      <label className="insight-filter">
        Explore{" "}
        <select
          aria-label="Insight topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        >
          <option value="all">All intelligence</option>
          <option value="maldives">Maldives & business</option>
          <option value="global">Global hospitality</option>
          <option value="risk">Tourism risk watch</option>
        </select>
      </label>
      <div className="insight-kpis">
        <article>
          <span>Maldives arrivals</span>
          <strong>{formatCompact(1900838)}</strong>
          <small>
            To 17 Nov 2026 · {yoy(1900838, 1961566)!.toFixed(1)}% YoY
            (calculated)
          </small>
          <Source id="arrivals" />
        </article>
        <article>
          <span>Maldives travel receipts</span>
          <strong>{formatInsightMoney(400100000)}</strong>
          <small>Aug 2026 · +10.2% YoY (reported)</small>
          <Source id="receipts" />
        </article>
        <article>
          <span>Global international arrivals</span>
          <strong>{formatCompact(690000000)}</strong>
          <small>H1 2026 · +0.4% YoY (estimated)</small>
          <Source id="global" />
        </article>
      </div>
      <div className="insight-grid">
        {show("maldives") && (
          <>
            <InsightChart
              title="Maldives arrivals: comparable YTD"
              rows={ytdArrivals}
              unit="tourist arrivals"
              source="arrivals"
              note="Same cutoff date in each year. A reported 3.1% decline; calculation from the counts rounds to −3.1%. Counts are not room nights or hotel occupancy."
            />
            <InsightChart
              title="Annual tourism benchmark"
              rows={annualArrivals}
              unit="tourist arrivals"
              source="annual"
              note={`Full-year 2025 arrivals grew ${yoy(2246516, 2046615)!.toFixed(1)}% versus 2024 (calculated). Do not compare full years directly with the partial 2026 period.`}
            />
            <InsightChart
              title="Leading source markets: Maldives"
              rows={sourceMarkets}
              unit="tourist arrivals to 17 Nov 2026"
              source="arrivals"
              note="Three leading markets reported by Sun. Not all nationalities; no shares inferred. National arrivals do not establish this property's market mix."
            />
            <InsightChart
              title="Maldives travel receipts: Jan–Aug 2026"
              rows={travelReceipts.map((r) => ({ ...r, value: r.value * 1e6 }))}
              unit="$ amounts"
              source="receipts"
              note="MMA series 246 estimates receipts from tourism-related taxes and fees; not this property's revenue and not a direct measure of cash available to operators. Later months unavailable in the verified series."
            />
          </>
        )}
        {show("global") && (
          <>
            <InsightChart
              title="Global demand momentum"
              rows={globalQuarters}
              unit="% year on year"
              source="global"
              note="Quarterly changes and the H1 aggregate are separate comparisons, not additive. Red bars denote declines; bar length represents magnitude."
            />
            <section className="panel insight-card">
              <h2>
                <TrendingUp size={18} /> Hospitality demand signals
              </h2>
              <ul>
                <li>
                  UN Tourism's September Barometer reports 690M international
                  tourists in H1 2026, around 3M above H1 2025.
                </li>
                <li>
                  Western Europe arrivals fell 6% in June; South-East Asia fell
                  5%. The report cites heat, travel costs, weaker demand and
                  route disruption among the pressures.
                </li>
                <li>
                  The earlier June release reported global accommodation
                  occupancy of 64% in March 2026, matching March 2025, based on
                  STR data. This is a dated global benchmark, not a Maldives
                  resort target.
                </li>
              </ul>
              <Source id="global" />
              <Source id="risks" />
            </section>
          </>
        )}
        {show("risk") && (
          <>
            <InsightChart
              title="Conflict-related demand pressure"
              rows={riskSurvey}
              unit="% of experts"
              source="risks"
              note="Spring 2026 UN Tourism expert survey: 64% reported negative effects (43% moderate + 21% high). Survey opinions, not a measured percentage loss in arrivals; not a November assessment."
            />
            <section className="panel insight-card">
              <h2>
                <AlertTriangle size={18} /> Global tensions: transmission to
                tourism
              </h2>
              <ul>
                <li>
                  <strong>Air connectivity:</strong> UN Tourism links Middle
                  East instability to rerouted/cancelled flights and reduced
                  capacity. Long-haul island destinations can face access
                  friction.
                </li>
                <li>
                  <strong>Oil and inflation:</strong> higher jet-fuel and travel
                  costs can pressure demand and operator margins; the September
                  Barometer cites elevated oil prices and inflation.
                </li>
                <li>
                  <strong>Confidence and substitution:</strong> uncertainty may
                  shift travellers toward closer or better-value destinations.
                  Effects differ by source market.
                </li>
              </ul>
              <p className="insight-note">
                Reported global risk context, not a prediction of loss for
                Maldives or this property. No invented incident alerts,
                probability scores or real-time travel advisories.
              </p>
              <Source id="global" />
              <Source id="risks" />
            </section>
          </>
        )}
      </div>
      <section className="panel insight-card">
        <h2>Executive watchlist · analysis, not reported forecasts</h2>
        <div className="insight-watchlist">
          <article>
            <h3>Protect booking pace</h3>
            <p>
              Monitor pickup, cancellations and booking windows by source
              market. Check connecting-flight exposure with travel partners
              before changing rate strategy.
            </p>
          </article>
          <article>
            <h3>Balance value and margin</h3>
            <p>
              Compare national arrival direction with property conversion, ADR
              and cost trends. National tourism growth is not a substitute for
              property-level performance.
            </p>
          </article>
          <article>
            <h3>Keep periods comparable</h3>
            <p>
              Compare the same dates and definitions. Avoid mixing arrivals,
              room nights, occupancy and receipts. Keep targets and forecasts
              separate from observed statistics.
            </p>
          </article>
        </div>
      </section>
      <section className="panel insight-card">
        <h2>Sources & methodology</h2>
        <p>
          Public-source research; figures transcribed from the linked releases.
          Ministry year-end counts and MMA receipts are primary statistics.
          November arrivals are local news reporting of Ministry figures. Later
          releases may revise these values. No scheduled ingestion is
          configured; content needs a reviewed update to reflect newer releases.
        </p>
        {Object.keys(insightSources).map((id) => (
          <Source key={id} id={id as InsightSource} />
        ))}
      </section>
    </section>
  );
}
