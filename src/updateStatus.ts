import type { Entry } from "./model";
export function lastSavedUpdate(entries: Entry[]) {
  const values = entries
    .filter((e) => e.version > 0 && e.updated_at)
    .map((e) => Date.parse(e.updated_at!))
    .filter(Number.isFinite);
  if (!values.length) return null;
  return new Date(Math.max(...values)).toISOString();
}
export function formatUpdate(iso: string | null, local = false) {
  const unavailable = `LAST UPDATE BY ${local ? "THIS BROWSER" : "TEAM"}: DATE/TIME NOT AVAILABLE`;
  if (!iso) return unavailable;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return unavailable;
  const stamp = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  })
    .format(date)
    .toUpperCase();
  return `LAST UPDATE BY ${local ? "THIS BROWSER" : "TEAM"}: ${stamp} UTC`;
}
