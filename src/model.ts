export const budgetYears = [
  2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030,
];

export const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
export const markets = [
  {
    id: "asia",
    name: "Asia",
    tag: "AS",
    region: "Asia Pacific",
    color: "#397e72",
    countries: ["China", "India", "Japan", "Korea (South)", "Others Asia"],
  },
  {
    id: "america",
    name: "America",
    tag: "AM",
    region: "The Americas",
    color: "#a7764e",
    countries: ["USA", "Canada", "Others America"],
  },
  {
    id: "middle-east",
    name: "Middle East",
    tag: "ME",
    region: "Middle East",
    color: "#6b719f",
    countries: ["Saudi Arabia", "UAE", "Kuwait", "Qatar", "Others Middle East"],
  },
  {
    id: "russia",
    name: "Russia / CIS",
    tag: "RU",
    region: "Russia & CIS",
    color: "#5c8499",
    countries: ["Russia", "CIS"],
  },
  {
    id: "europe",
    name: "Europe",
    tag: "EU",
    region: "Europe",
    color: "#8b7953",
    countries: [
      "Austria",
      "Bulgaria",
      "France",
      "Germany",
      "Great Britain",
      "Italy",
      "Poland",
      "Romania",
      "Spain",
      "Switzerland",
      "Europe Other",
    ],
  },
];
export const villas = [
  "Sunrise Beach Villa",
  "Sunset Beach Villa",
  "Sunrise Water Villa",
  "Sunset Water Villa",
  "Two Bedroom Beach Pool",
  "Two Bedroom Beach Residence",
  "Three Bedroom Residence",
  "Three Bedroom Retreat (Suite)",
  "Four Bedroom Beach Pool",
  "Four Bedroom Beach Residence",
];
export const meals = [
  "BB — Bed & Breakfast",
  "HB — Half Board",
  "FB — Full Board",
  "AI — All Inclusive",
  "UAI — Ultra All Inclusive",
];
export type Row = {
  label: string;
  budget: number;
  bob: number;
  targets: number[];
  weekly: number[];
};
export type MonthData = {
  commercial: Row[];
  villas: Row[];
  countries: Row[];
  meals: Row[];
  notes: string;
};
export type Entry = {
  market_id: string;
  year: number;
  month: number;
  data: MonthData;
  version: number;
  updated_at?: string;
};
export type Audit = {
  id: number;
  market_id: string;
  year: number;
  month: number;
  changed_at: string;
  actor: string;
};
export function row(label: string, budget = 0, bob = 0): Row {
  return {
    label,
    budget,
    bob,
    targets: [0.6, 0.25, 0.1, 0.05].map((x) => budget * x),
    weekly: [0, 0, 0, 0],
  };
}
export function blank(market: string): MonthData {
  return {
    commercial: [row("Room Nights"), row("Room Revenue")],
    villas: villas.map((x) => row(x)),
    countries: (markets.find((x) => x.id === market)?.countries ?? []).map(
      (x) => row(x),
    ),
    meals: meals.map((x) => row(x)),
    notes: "",
  };
}
export function makeDemo(year: number): Entry[] {
  return markets.flatMap((m, i) =>
    months.map((_, j) => {
      const d = blank(m.id);
      const nights = 300 + i * 113 + j * 23;
      const revenue = nights * (900 + i * 180);
      const achievement = 0.43 + ((j + i) % 5) * 0.08;
      d.commercial = [
        row("Room Nights", nights, Math.round(nights * achievement)),
        row("Room Revenue", revenue, Math.round(revenue * achievement * 0.94)),
      ];
      for (const key of ["villas", "countries", "meals"] as const)
        d[key] = d[key].map((r, k) =>
          row(
            r.label,
            Math.round(nights / d[key].length),
            Math.round((nights * achievement) / d[key].length),
          ),
        );
      return { market_id: m.id, year, month: j + 1, data: d, version: 0 };
    }),
  );
}
export function adr(revenue: number, nights: number) {
  return nights > 0 ? revenue / nights : 0;
}
export function percentage(bob: number, budget: number) {
  return budget > 0 ? (bob / budget) * 100 : 0;
}
export function summarize(entries: Entry[]) {
  return entries.reduce(
    (a, e) => ({
      budget: a.budget + e.data.commercial[1].budget,
      bob: a.bob + e.data.commercial[1].bob,
      nights: a.nights + e.data.commercial[0].budget,
      booked: a.booked + e.data.commercial[0].bob,
    }),
    { budget: 0, bob: 0, nights: 0, booked: 0 },
  );
}
export function validData(data: MonthData) {
  return (
    (["commercial", "villas", "countries", "meals"] as const).every(
      (key) =>
        Array.isArray(data[key]) &&
        data[key].length <= 100 &&
        data[key].every(
          (r) =>
            typeof r.label === "string" &&
            r.label.length <= 200 &&
            [r.budget, r.bob, ...r.targets, ...r.weekly].every(
              (n) =>
                typeof n === "number" &&
                Number.isFinite(n) &&
                n >= 0 &&
                n <= 1e12,
            ) &&
            r.targets.length === 4 &&
            r.weekly.length === 4,
        ),
    ) &&
    data.commercial.length === 2 &&
    typeof data.notes === "string" &&
    data.notes.length <= 10000
  );
}
export function reportRows(entries: Entry[]) {
  return entries.map((e) => {
    const n = e.data.commercial[0],
      r = e.data.commercial[1];
    return {
      Market: markets.find((m) => m.id === e.market_id)?.name ?? e.market_id,
      Year: e.year,
      Month: months[e.month - 1],
      "Revenue budget": r.budget,
      "Revenue BOB": r.bob,
      "Revenue variance": r.bob - r.budget,
      "Achievement %": percentage(r.bob, r.budget),
      "Room night budget": n.budget,
      "Room night BOB": n.bob,
      "Budget ADR": adr(r.budget, n.budget),
      "BOB ADR": adr(r.bob, n.bob),
      "Action plan": e.data.notes,
    };
  });
}

// Merge newly supported markets without resetting browser-saved edits/imports.
export function restoreDemo(year: number, stored: unknown): Entry[] {
  const saved = Array.isArray(stored) ? stored : [];
  return makeDemo(year).map(
    (fallback) =>
      saved.find(
        (e) =>
          e &&
          e.year === year &&
          e.market_id === fallback.market_id &&
          e.month === fallback.month &&
          typeof e.version === "number" &&
          e.data &&
          validData(e.data),
      ) ?? fallback,
  );
}
