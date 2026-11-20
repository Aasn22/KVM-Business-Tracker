import type { ReportType } from "./reportEngine";
export const quickReports: {
  id: string;
  title: string;
  type?: ReportType;
  periodMode?: "month" | "quarter" | "year";
  limitation?: string;
  unavailable?: string;
}[] = [
  { id: "hotel", title: "Hotel Performance Reports", type: "executive" },
  {
    id: "pace",
    title: "Business Pace Reports",
    type: "monthly",
    limitation:
      "Monthly saved BOB and weekly snapshots only. Booking-date history and comparable prior snapshots are not collected, so true pickup / booking-pace comparisons are unavailable.",
  },
  {
    id: "segment",
    title: "Market Segment Reports",
    unavailable:
      "Market segment classifications and segment-level figures are not collected. Add segment inputs before generating this report; country and geographic market totals are not segment data.",
  },
  {
    id: "sales",
    title: "Sales Performance Reports",
    unavailable:
      "Salesperson, account, channel and sales-target inputs are not collected. A sales performance report cannot be generated from geographic market totals alone.",
  },
  { id: "meal", title: "Meal Plan Reports", type: "meals" },
  { id: "villa", title: "Villa Type Performance Reports", type: "villas" },
  { id: "market", title: "Market Performance Reports", type: "markets" },
  { id: "country", title: "Country Performance Reports", type: "countries" },
  {
    id: "cancellation",
    title: "Cancellation Reports",
    unavailable:
      "Cancellation counts, cancelled room nights, cancellation dates and cancelled revenue are not collected. No cancellation figures or rates can be inferred from BOB.",
  },
  {
    id: "monthly",
    title: "Monthly Reports",
    type: "monthly",
    periodMode: "month",
  },
  {
    id: "quarterly",
    title: "Quarterly Reports",
    type: "executive",
    periodMode: "quarter",
  },
  {
    id: "yearly",
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
