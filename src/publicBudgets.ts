import { lastSavedUpdate } from "./updateStatus";
import { validData, type Entry } from "./model";
export type PublicBudgets = {
  entries: Entry[];
  notice: string;
  lastUpdatedAt: string | null;
  databaseAvailable: boolean;
};
function readEntries(value: unknown, year: number): Entry[] {
  if (!Array.isArray(value)) throw Error("Invalid budget response");
  return value
    .filter(
      (e) =>
        e?.year === year &&
        [
          "asia",
          "america",
          "middle-east",
          "russia",
          "europe",
          "other-markets",
        ].includes(e.market_id) &&
        Number.isInteger(e.month) &&
        e.month >= 1 &&
        e.month <= 12 &&
        validData(e.data),
    )
    .map((e) => ({ ...e, data: { ...e.data, notes: "" } }));
}
export async function loadPublicBudgets(year: number): Promise<PublicBudgets> {
  let baseline: Entry[] = [];
  if (year === 2027) {
    const response = await fetch("/data/budgets-2027.json", {
      cache: "no-store",
    });
    if (!response.ok)
      throw Error("Published workbook figures could not be loaded.");
    baseline = readEntries((await response.json()).entries, year);
  }
  try {
    const response = await fetch(`/api/public-budgets?year=${year}`, {
      cache: "no-store",
    });
    if (!response.ok) throw Error();
    const saved = readEntries((await response.json()).entries, year);
    const records = new Map(
      baseline.map((e) => [`${e.market_id}:${e.month}`, e]),
    );
    saved.forEach((e) => records.set(`${e.market_id}:${e.month}`, e));
    return {
      entries: [...records.values()],
      lastUpdatedAt: lastSavedUpdate(saved),
      databaseAvailable: true,
      notice: saved.length
        ? `${saved.length} saved database months loaded${baseline.length > saved.length ? "; remaining months use published workbook figures" : ""}.`
        : baseline.length
          ? "Published 2027 workbook figures. No saved database months available yet."
          : "No published or saved figures for this year.",
    };
  } catch {
    return {
      entries: baseline,
      lastUpdatedAt: null,
      databaseAvailable: false,
      notice: baseline.length
        ? "Published 2027 workbook figures. Live database updates could not be verified; these figures are not a live feed."
        : "Live database unavailable and no workbook figures supplied for this year.",
    };
  }
}
