// User-confirmed property assumption: 75 units available every calendar day.
export const propertyUnits = 75;
export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function availableNights(year: number, months: number[]) {
  return [...new Set(months)].reduce(
    (n, m) => n + daysInMonth(year, m) * propertyUnits,
    0,
  );
}
export function occupancy(
  nights: number | null | undefined,
  available: number,
) {
  return nights === null ||
    nights === undefined ||
    !Number.isFinite(nights) ||
    available <= 0
    ? null
    : (nights / available) * 100;
}
export function periodOccupancy(
  nights: number | null | undefined,
  year: number,
  months: number[],
) {
  return occupancy(nights, availableNights(year, months));
}
export function occupancyForDates(
  nights: number | null | undefined,
  from: string,
  to: string,
) {
  const start = Date.parse(from),
    end = Date.parse(to);
  return occupancy(
    nights,
    Number.isFinite(start) && Number.isFinite(end)
      ? ((end - start) / 86400000 + 1) * propertyUnits
      : 0,
  );
}
export function formatOccupancy(n: number | null) {
  return n === null ? "—" : `${n.toFixed(1)}%`;
}
