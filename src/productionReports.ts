export type ProductionReportMode =
  | "country"
  | "room"
  | "meal"
  | "segment"
  | "pace"
  | "market"
  | "monthly"
  | "agent"
  | "source"
  | "marketCode";
export function productionReportMode(id: string): ProductionReportMode {
  if (["villas", "villa"].includes(id)) return "room";
  if (["meals", "meal"].includes(id)) return "meal";
  if (id === "sales") return "agent";
  if (id === "segment") return "segment";
  if (["pace", "reservations"].includes(id)) return "pace";
  if (["monthly", "quarterly", "yearly"].includes(id)) return "monthly";
  if (["market", "markets", "executive", "hotel"].includes(id)) return "market";
  return "country";
}
