import { useEffect, useState } from "react";
export type PropertyTeamRow = {
  name: string;
  position: string;
  assignedMarket: string;
  section: string;
  level: string;
};
const fields = [
  "name",
  "position",
  "assignedMarket",
  "section",
  "level",
] as const;
export function parsePropertyTeam(value: unknown): PropertyTeamRow[] {
  if (!Array.isArray(value) || value.length > 100)
    throw Error("Use an array of up to 100 team entries.");
  return value.map((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      Object.keys(row).some(
        (k) => !fields.includes(k as (typeof fields)[number]),
      )
    )
      throw Error(
        "Only name, position, assignedMarket, section and level are accepted. No passwords or account fields.",
      );
    const r = Object.fromEntries(
      fields.map((k) => [k, String(row[k] ?? "").trim()]),
    ) as PropertyTeamRow;
    if (!r.name || fields.some((k) => r[k].length > 200))
      throw Error("Each entry needs a name; maximum 200 characters per field.");
    return r;
  });
}
export default function PropertyTeam() {
  const [rows, setRows] = useState<PropertyTeamRow[]>([]),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("kvm-property-team-details");
      if (stored) setRows(parsePropertyTeam(JSON.parse(stored)));
    } catch {
      setError("Saved team details could not be read.");
    }
  }, []);
  return (
    <section className="property-team">
      <h2>Team members</h2>
      <p className="mini-table-note">
        Private directory · saved in this browser only. These details do not
        create accounts or change permissions.
      </p>
      <div className="table-scroll">
        <table className="property-mini-table">
          <thead>
            <tr>
              <th>Team name</th>
              <th>Position</th>
              <th>Assigned market</th>
              <th>Section</th>
              <th>Level</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {fields.map((k) => (
                  <td key={k}>{r[k] || "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <p className="mini-table-note">
          Import the private team details file provided in chat to display your
          roster here.
        </p>
      )}
      <label className="roster-import">
        Import / replace team details (JSON)
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Import property team details"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            setError("");
            setMessage("");
            if (!file) return;
            try {
              if (file.size > 100000) throw Error("Maximum 100 KB.");
              const next = parsePropertyTeam(JSON.parse(await file.text()));
              if (
                rows.length &&
                !window.confirm(
                  "Replace this browser’s team directory? No account permissions will change.",
                )
              )
                return;
              localStorage.setItem(
                "kvm-property-team-details",
                JSON.stringify(next),
              );
              setRows(next);
              setMessage("Team details saved in this browser.");
            } catch (err) {
              setError((err as Error).message);
            }
          }}
        />
      </label>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
