import { formatMoney, formatNumber, isMoneyMetric } from "./format";
import { useEffect, useState } from "react";
import { db } from "./api";
import {
  adr,
  blank,
  months,
  type Entry,
  type MonthData,
  validData,
} from "./model";
import { exportWorkbook } from "./workbooks";
type CountryEntry = {
  country: string;
  year: number;
  month: number;
  data: MonthData;
  version: number;
};
export default function CountryPerformance({
  year,
  scope,
  editable,
  demo,
}: {
  year: number;
  scope?: "india" | "kazakhstan";
  editable: boolean;
  demo: boolean;
}) {
  const [country, setCountry] = useState(scope ?? "india");
  const [month, setMonth] = useState(1);
  const [rows, setRows] = useState<CountryEntry[]>([]);
  const [data, setData] = useState<MonthData>(blank(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const name = country === "india" ? "India" : "Kazakhstan";
  const current = rows.find((r) => r.month === month);
  useEffect(() => {
    let active = true;
    setRows([]);
    setError("");
    if (demo) {
      try {
        setRows(
          JSON.parse(
            localStorage.getItem(`country-${country}-${year}`) ?? "[]",
          ),
        );
      } catch {}
      return;
    }
    if (!db) return;
    setBusy(true);
    db.from("country_months")
      .select("*")
      .eq("year", year)
      .eq("country", country)
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setError(error.message);
        else setRows(data as CountryEntry[]);
        setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [country, year, demo]);
  useEffect(() => {
    setData(structuredClone(current?.data ?? blank("")));
  }, [current, month, country, year]);
  async function save() {
    if (!editable || !validData(data)) return;
    setBusy(true);
    setError("");
    try {
      let version = (current?.version ?? 0) + 1;
      if (!demo) {
        const r = await db!.rpc("save_country_month", {
          p_country: country,
          p_year: year,
          p_month: month,
          p_data: data,
          p_version: current?.version ?? 0,
        });
        if (r.error) throw r.error;
        version = r.data;
      }
      const next = [
        ...rows.filter((r) => r.month !== month),
        { country, year, month, data: structuredClone(data), version },
      ];
      if (demo)
        localStorage.setItem(
          `country-${country}-${year}`,
          JSON.stringify(next),
        );
      setRows(next);
      setMessage("Country figures saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    try {
      await exportWorkbook(
        rows.map(
          (r) =>
            ({
              market_id: name,
              year,
              month: r.month,
              data: r.data,
              version: r.version,
            }) as Entry,
        ),
        `BUSINESS-EYE-${country}-${year}`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel country-performance">
      <div className="section-heading">
        <div>
          <h2>
            {editable
              ? "Country financial data input"
              : `${name}-only performance`}{" "}
            · {year}
          </h2>
          <p>
            Explicit country records only. Regional budgets, other countries,
            and regional audit notes are not included.
          </p>
        </div>
      </div>
      <div className="notice">
        Country booking-count breakdowns do not contain country revenue, room
        nights or ADR. These values are never estimated from regional totals.{" "}
        {rows.length}/12 country months available. Country records are not
        automatically added to parent market totals, avoiding double-counting.
      </div>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <div className="report-filters">
        {editable && (
          <label>
            Country
            <select
              aria-label="Country data input"
              value={country}
              onChange={(e) =>
                setCountry(e.target.value as "india" | "kazakhstan")
              }
            >
              <option value="india">India</option>
              <option value="kazakhstan">Kazakhstan</option>
            </select>
          </label>
        )}
        <label>
          Month
          <select
            aria-label="Country month"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {months.map((m, i) => (
              <option value={i + 1} key={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        {editable && (
          <button className="button primary" disabled={busy} onClick={save}>
            Save country figures
          </button>
        )}
        <button
          className="button outline"
          disabled={busy || !rows.length}
          onClick={download}
        >
          Export {name} report
        </button>
      </div>
      {!editable && !current ? (
        <div className="empty">
          No saved {name} figures for {months[month - 1]}. Regional figures
          remain hidden.
        </div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>KPI</th>
                <th>Budget</th>
                <th>BOB</th>
                <th>Variance</th>
              </tr>
            </thead>
            <tbody>
              {data.commercial.map((r, i) => (
                <tr key={r.label}>
                  <th>{r.label}</th>
                  <td>
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        aria-label={`Country ${r.label} budget`}
                        value={r.budget}
                        onChange={(e) =>
                          setData({
                            ...data,
                            commercial: data.commercial.map((v, j) =>
                              j === i
                                ? { ...v, budget: Number(e.target.value) }
                                : v,
                            ),
                          })
                        }
                      />
                    ) : isMoneyMetric(r.label) ? (
                      formatMoney(r.budget)
                    ) : (
                      formatNumber(r.budget)
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        aria-label={`Country ${r.label} BOB`}
                        value={r.bob}
                        onChange={(e) =>
                          setData({
                            ...data,
                            commercial: data.commercial.map((v, j) =>
                              j === i
                                ? { ...v, bob: Number(e.target.value) }
                                : v,
                            ),
                          })
                        }
                      />
                    ) : isMoneyMetric(r.label) ? (
                      formatMoney(r.bob)
                    ) : (
                      formatNumber(r.bob)
                    )}
                  </td>
                  <td>
                    {isMoneyMetric(r.label)
                      ? formatMoney(r.bob - r.budget)
                      : formatNumber(r.bob - r.budget)}
                  </td>
                </tr>
              ))}
              <tr>
                <th>ADR (calculated)</th>
                <td>
                  {formatMoney(
                    adr(data.commercial[1].budget, data.commercial[0].budget),
                  )}
                </td>
                <td>
                  {formatMoney(
                    adr(data.commercial[1].bob, data.commercial[0].bob),
                  )}
                </td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
