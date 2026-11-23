import type { ReportType } from "./reportEngine";
export const quickReports: {
  id: string;
  title: string;
  type?: ReportType;
  periodMode?: "month" | "quarter" | "year";
  limitation?: string;
  unavailable?: string;
  operational?: "cancellations" | "reservations";
  primary?: "country" | "market" | "room";
  primaryKind?: "history" | "forecast";
}[] = [
  {
    id: "hotel",
    title: "Hotel Performance Reports",
    type: "executive",
    primary: "country",
  },
  {
    id: "pace",
    primary: "country",
    primaryKind: "forecast",
    title: "Business Pace Reports",
    type: "monthly",
    limitation:
      "Monthly saved BOB and weekly snapshots only. Booking-date history and comparable prior snapshots are not collected, so true pickup / booking-pace comparisons are unavailable.",
  },
  {
    id: "segment",
    title: "Market Segment Reports",
    primary: "market",
  },
  {
    id: "sales",
    title: "Sales Performance Reports",
    limitation:
      "Agent/company production only; no salesperson attribution or sales targets inferred.",
  },
  { id: "meal", title: "Meal Plan Reports", type: "meals" },
  {
    id: "villa",
    title: "Villa Type Performance Reports",
    type: "villas",
    primary: "room",
  },
  {
    id: "market",
    title: "Market Performance Reports",
    type: "markets",
    primary: "country",
  },
  {
    id: "country",
    title: "Country Performance Reports",
    type: "countries",
    primary: "country",
  },
  {
    id: "cancellation",
    title: "Cancellation Reports",
    operational: "cancellations",
  },
  { id: "noshow", title: "No Show Reports" },
  {
    id: "reservations",
    title: "Reservations Confirmed Reports",
    operational: "reservations",
  },
  {
    id: "monthly",
    primary: "country",
    title: "Monthly Reports",
    type: "monthly",
    periodMode: "month",
  },
  {
    id: "quarterly",
    primary: "country",
    title: "Quarterly Reports",
    type: "executive",
    periodMode: "quarter",
  },
  {
    id: "yearly",
    primary: "country",
    title: "Yearly Reports",
    type: "executive",
    periodMode: "year",
  },
];
export function quickReportPeriod(
  mode: "month" | "quarter" | "year" | undefined,
  selected: string,
) {
  if (mode === "year") return "year";
  if (mode === "month")
    return /^(?:[1-9]|1[0-2])$/.test(selected) ? selected : "1";
  if (mode === "quarter")
    return /^q[1-4]$/.test(selected)
      ? selected
      : /^(?:[1-9]|1[0-2])$/.test(selected)
        ? `q${Math.ceil(Number(selected) / 3)}`
        : "q1";
  return selected;
}
